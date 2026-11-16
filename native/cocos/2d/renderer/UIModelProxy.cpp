/****************************************************************************
 Copyright (c) 2019-2023 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
****************************************************************************/

#include "UIModelProxy.h"
#include "2d/renderer/RenderEntity.h"
#include "core/assets/RenderingSubMesh.h"

namespace cc {

namespace {

// GPU buffers are allocated on demand, in vertex/index counts, keep in sync with
// cocos/2d/assembler/graphics/constants.ts. Grow only: doResize re-creates the GPU buffer.
constexpr uint32_t MAX_VERTEX_COUNT = 65536;
constexpr uint32_t INDICES_PER_VERTEX = 3;
constexpr uint32_t MAX_INDEX_COUNT = MAX_VERTEX_COUNT * INDICES_PER_VERTEX;

// Graphics vertex layout: position.xyz, color.rgba, distance.
constexpr uint32_t FLOATS_PER_VERTEX = 8;
constexpr uint32_t VERTEX_STRIDE = FLOATS_PER_VERTEX * sizeof(float);
constexpr uint32_t ALPHA_OFFSET = 6;

inline uint32_t growCapacity(uint32_t needed, uint32_t current, uint32_t maxCap) {
    uint32_t cap = current > 1U ? current : 1U;
    while (cap < needed && cap < maxCap) {
        cap *= 2;
    }
    return cap < maxCap ? cap : maxCap;
}

class GraphicsModel final : public scene::Model {
public:
    void resizeGeometry(size_t size) {
        _geometry.resize(size);
        _lastOpacity = -1.F;
    }

    void setVertices(size_t index, const float* source, uint32_t count) {
        auto& chunk = _geometry[index];
        chunk.paintAlpha.clear();
        if (count) {
            // JS can replace its arrays after updateRenderer and before the native UI walk.
            chunk.vertices.assign(source, source + count * FLOATS_PER_VERTEX);
        } else {
            chunk.vertices.clear();
        }
    }

    void updateUBOs(uint32_t stamp) override {
        const auto* node = getNode();
        if (node && node->_getFinalOpacity() != _lastOpacity) {
            // The UI walk resolves this node's opacity immediately before submitting the model.
            const float opacity = node->_getFinalOpacity();
            for (size_t i = 0; i < _geometry.size(); ++i) {
                auto& chunk = _geometry[i];
                if (chunk.vertices.empty()) continue;
                if (opacity != 1.F && chunk.paintAlpha.empty()) {
                    chunk.paintAlpha.resize(chunk.vertices.size() / FLOATS_PER_VERTEX);
                    for (size_t v = 0; v < chunk.paintAlpha.size(); ++v) {
                        chunk.paintAlpha[v] = chunk.vertices[v * FLOATS_PER_VERTEX + ALPHA_OFFSET];
                    }
                }
                for (size_t v = 0; v < chunk.paintAlpha.size(); ++v) {
                    chunk.vertices[v * FLOATS_PER_VERTEX + ALPHA_OFFSET] = chunk.paintAlpha[v] * opacity;
                }
                auto* vb = getSubModels()[i]->getInputAssembler()->getVertexBuffers().front();
                vb->update(chunk.vertices.data(), static_cast<uint32_t>(chunk.vertices.size() * sizeof(float)));
            }
            _lastOpacity = opacity;
        }
        scene::Model::updateUBOs(stamp);
    }

    void destroy() override {
        _geometry.clear();
        scene::Model::destroy();
    }

private:
    struct Chunk {
        ccstd::vector<float> vertices;
        ccstd::vector<float> paintAlpha;
    };
    ccstd::vector<Chunk> _geometry;
    float _lastOpacity{-1.F};
};

} // namespace

UIModelProxy::UIModelProxy() {
    _device = Root::getInstance()->getDevice();
}

UIModelProxy::~UIModelProxy() {
    destroy();
}

void UIModelProxy::initModel(Node* node) {
    _model = Root::getInstance()->createModel<GraphicsModel>();
    _model->setNode(node);
    _model->setTransform(node);
    _node = node;
}

void UIModelProxy::activeSubModels() {
    if (_model == nullptr) return;
    auto* entity = static_cast<RenderEntity*>(_node->getUserData());
    auto drawInfoSize = entity->getDynamicRenderDrawInfos().size();
    auto subModelSize = _model->getSubModels().size();
    if (drawInfoSize > subModelSize) {
        for (size_t i = subModelSize; i < drawInfoSize; i++) {
            if (_model->getSubModels().size() <= i) {
                RenderDrawInfo* drawInfo = entity->getDynamicRenderDrawInfo(static_cast<uint32_t>(i));
                if (drawInfo == nullptr) {
                    return;
                }

                // Allocate exactly for the data of this chunk, rounded up to a power of two.
                const uint32_t vertexCapacity = growCapacity(drawInfo->getVertexOffset(), 0, MAX_VERTEX_COUNT);
                const uint32_t indexCapacity = growCapacity(drawInfo->getIndexOffset(), 0, MAX_INDEX_COUNT);

                auto* vertexBuffer = _device->createBuffer({
                    gfx::BufferUsageBit::VERTEX | gfx::BufferUsageBit::TRANSFER_DST,
                    gfx::MemoryUsageBit::DEVICE,
                    vertexCapacity * VERTEX_STRIDE,
                    VERTEX_STRIDE,
                });
                auto* indexBuffer = _device->createBuffer({
                    gfx::BufferUsageBit::INDEX | gfx::BufferUsageBit::TRANSFER_DST,
                    gfx::MemoryUsageBit::DEVICE,
                    static_cast<uint32_t>(indexCapacity * sizeof(uint16_t)),
                    sizeof(uint16_t),
                });
                gfx::BufferList vbReference;
                vbReference.emplace_back(vertexBuffer);

                auto* renderMesh = ccnew RenderingSubMesh(vbReference, _attributes, _primitiveMode, indexBuffer);
                renderMesh->setSubMeshIdx(0);

                _model->initSubModel(static_cast<index_t>(i), renderMesh, drawInfo->getMaterial());
                _graphicsUseSubMeshes.emplace_back(renderMesh);
            }
        }
    }
}

void UIModelProxy::uploadData() {
    if (!_model) return;
    auto* entity = static_cast<RenderEntity*>(_node->getUserData());
    const auto& drawInfos = entity->getDynamicRenderDrawInfos();
    const auto& subModelList = _model->getSubModels();
    auto* model = static_cast<GraphicsModel*>(_model.get());
    model->resizeGeometry(subModelList.size());
    for (size_t i = 0; i < subModelList.size(); i++) {
        auto* drawInfo = i < drawInfos.size() ? drawInfos[i] : nullptr;
        auto* ia = subModelList.at(i)->getInputAssembler();
        const uint32_t vertexCount = drawInfo ? drawInfo->getVertexOffset() : 0U;
        const uint32_t indexCount = drawInfo ? drawInfo->getIndexOffset() : 0U;
        const auto& vBuffers = ia->getVertexBuffers();
        if (!vertexCount || !indexCount || vBuffers.empty() || vertexCount > MAX_VERTEX_COUNT || indexCount > MAX_INDEX_COUNT ||
            vertexCount > drawInfo->getVbCount() || indexCount > drawInfo->getIbCount() ||
            !drawInfo->getVDataBuffer() || !drawInfo->getIDataBuffer()) {
            model->setVertices(i, nullptr, 0);
            ia->setVertexCount(0);
            ia->setIndexCount(0);
            continue;
        }

        gfx::Buffer* vBuffer = vBuffers[0];
        const uint32_t neededVBytes = vertexCount * VERTEX_STRIDE;
        if (neededVBytes > vBuffer->getSize()) {
            const uint32_t capacity = growCapacity(vertexCount, vBuffer->getSize() / VERTEX_STRIDE, MAX_VERTEX_COUNT);
            vBuffer->resize(capacity * VERTEX_STRIDE);
        }
        model->setVertices(i, drawInfo->getVDataBuffer(), vertexCount);
        ia->setVertexCount(vertexCount); // count

        gfx::Buffer* iBuffer = ia->getIndexBuffer();
        const auto neededIBytes = static_cast<uint32_t>(indexCount * sizeof(uint16_t));
        if (neededIBytes > iBuffer->getSize()) {
            const uint32_t capacity = growCapacity(indexCount, static_cast<uint32_t>(iBuffer->getSize() / sizeof(uint16_t)),
                                                   MAX_INDEX_COUNT);
            iBuffer->resize(static_cast<uint32_t>(capacity * sizeof(uint16_t)));
        }
        iBuffer->update(drawInfo->getIDataBuffer(), neededIBytes); // idata
        ia->setIndexCount(indexCount);                             // indexCount
        // drawInfo->setModel(_model); // hack, render by model
    }

    if (!drawInfos.empty() && drawInfos[0]) {
        drawInfos[0]->setModel(_model);
    }
}

void UIModelProxy::destroy() {
    if (_model != nullptr) {
        Root::getInstance()->destroyModel(_model);
        _model = nullptr;
    }

    for (auto& subMesh : _graphicsUseSubMeshes) {
        subMesh->destroy();
        subMesh = nullptr;
    }
    _graphicsUseSubMeshes.clear();

    _models.clear();
}

void UIModelProxy::clear() {
    if (_model == nullptr) {
        return;
    }
    static_cast<GraphicsModel*>(_model.get())->resizeGeometry(0);
    const auto& subModels = _model->getSubModels();
    for (const auto& subModel : subModels) {
        auto* ia = subModel->getInputAssembler();
        ia->setVertexCount(0);
        ia->setIndexCount(0);
    }
}

// for ui model
void UIModelProxy::updateModels(scene::Model* model) {
    _models.emplace_back(model);
}

void UIModelProxy::attachDrawInfo() {
    auto* entity = static_cast<RenderEntity*>(_node->getUserData());
    auto& drawInfos = entity->getDynamicRenderDrawInfos();
    if (drawInfos.size() != _models.size()) return;
    for (size_t i = 0; i < drawInfos.size(); i++) {
        drawInfos[i]->setModel(_models[i]);
    }
}

void UIModelProxy::attachNode(Node* node) {
    _node = node;
}

void UIModelProxy::clearModels() {
    _models.clear();
}

} // namespace cc
