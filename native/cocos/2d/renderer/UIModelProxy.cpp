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
// Graphics vertex format: position.xyz, color.rgba, distance.
constexpr uint32_t FLOATS_PER_VERTEX = 8;
constexpr uint32_t VERTEX_STRIDE = FLOATS_PER_VERTEX * sizeof(float);
constexpr uint32_t ALPHA_OFFSET = 6;
// After clear(), keep at most the float storage for one full, faded chunk.
constexpr size_t MAX_CACHED_FLOATS = MAX_VERTEX_COUNT * (FLOATS_PER_VERTEX + 1U);

inline uint32_t growCapacity(uint32_t needed, uint32_t current, uint32_t maxCap) {
    uint32_t cap = current > 1U ? current : 1U;
    while (cap < needed && cap < maxCap) {
        cap *= 2;
    }
    return cap < maxCap ? cap : maxCap;
}

class GraphicsModel final : public scene::Model {
public:
    void setGeometry(const ccstd::vector<RenderDrawInfo*>& drawInfos) {
        // clear() kept scratch for an immediate repaint. The component reached
        // its next update (or was disabled) with no new drawing.
        if (drawInfos.empty()) {
            _chunks.clear();
            resetDrawCounts();
            return;
        }
        const auto& subModels = getSubModels();
        _chunks.resize(subModels.size());
        bool hasGeometry = false;
        for (size_t i = 0; i < subModels.size(); ++i) {
            auto* drawInfo = i < drawInfos.size() ? drawInfos[i] : nullptr;
            auto* ia = subModels[i]->getInputAssembler();
            auto& chunk = _chunks[i];
            const auto vertexCount = drawInfo ? drawInfo->getVertexOffset() : 0U;
            const auto indexCount = drawInfo ? drawInfo->getIndexOffset() : 0U;
            // The offsets are emitted counts. The JS mesh reserves vbCount/ibCount
            // before writing; a failed reservation must never become a buffer read.
            if (!vertexCount || !indexCount || vertexCount > MAX_VERTEX_COUNT || indexCount > MAX_INDEX_COUNT ||
                vertexCount > drawInfo->getVbCount() || indexCount > drawInfo->getIbCount() ||
                !drawInfo->getVDataBuffer() || !drawInfo->getIDataBuffer()) {
                chunk.vertices.clear();
                chunk.paintAlpha.clear();
                chunk.appliedOpacity = -1.F;
                ia->setVertexCount(0);
                ia->setIndexCount(0);
                continue;
            }
            hasGeometry = true;
            if (!drawInfo->getVertDirty() && chunk.vertices.size() == vertexCount * FLOATS_PER_VERTEX &&
                ia->getDrawInfo().indexCount == indexCount) {
                continue;
            }
            ia->setVertexCount(vertexCount);
            ia->setIndexCount(indexCount);
            chunk.paintAlpha.clear();

            // JS may replace its backing arrays before the draw. Copy the active
            // vertices and consume the indices while their owner is live.
            const auto* vertices = drawInfo->getVDataBuffer();
            chunk.vertices.assign(vertices, vertices + vertexCount * FLOATS_PER_VERTEX);
            auto* vb = ia->getVertexBuffers().front();
            if (vertexCount * VERTEX_STRIDE > vb->getSize()) {
                vb->resize(growCapacity(vertexCount, vb->getSize() / VERTEX_STRIDE, MAX_VERTEX_COUNT) * VERTEX_STRIDE);
            }
            auto* ib = ia->getIndexBuffer();
            const auto indexBytes = static_cast<uint32_t>(indexCount * sizeof(uint16_t));
            if (indexBytes > ib->getSize()) {
                const auto capacity = growCapacity(indexCount, ib->getSize() / sizeof(uint16_t), MAX_INDEX_COUNT);
                ib->resize(capacity * sizeof(uint16_t));
            }
            ib->update(drawInfo->getIDataBuffer(), indexBytes);
            drawInfo->setVertDirty(false);
            chunk.appliedOpacity = -1.F;
            _lastOpacity = -1.F;
        }
        // A fill or stroke can create draw infos without emitting any triangles.
        if (!hasGeometry) _chunks.clear();
    }

    void clearGeometry() {
        size_t remaining = MAX_CACHED_FLOATS;
        for (auto& chunk : _chunks) {
            const auto capacity = chunk.vertices.capacity() + chunk.paintAlpha.capacity();
            if (capacity > remaining) {
                chunk = Chunk{};
            } else {
                remaining -= capacity;
                chunk.vertices.clear();
                chunk.paintAlpha.clear();
                chunk.appliedOpacity = -1.F;
            }
        }
        resetDrawCounts();
    }

    void updateUBOs(uint32_t stamp) override {
        const auto* node = getNode();
        if (node && node->_getFinalOpacity() != _lastOpacity) {
            updateVertexBuffers(node->_getFinalOpacity());
        }
        scene::Model::updateUBOs(stamp);
    }

    void destroy() override {
        _chunks.clear();
        scene::Model::destroy();
    }

private:
    struct Chunk {
        ccstd::vector<float> vertices;
        ccstd::vector<float> paintAlpha;
        float appliedOpacity{-1.F};
    };

    void resetDrawCounts() {
        _lastOpacity = -1.F;
        for (const auto& subModel : getSubModels()) {
            auto* ia = subModel->getInputAssembler();
            ia->setVertexCount(0);
            ia->setIndexCount(0);
        }
    }

    void updateVertexBuffers(float opacity) {
        const auto& subModels = getSubModels();
        for (size_t i = 0; i < _chunks.size(); ++i) {
            auto& chunk = _chunks[i];
            if (chunk.vertices.empty() || chunk.appliedOpacity == opacity) continue;
            if (!chunk.paintAlpha.empty()) {
                for (size_t v = 0; v < chunk.paintAlpha.size(); ++v) {
                    chunk.vertices[v * FLOATS_PER_VERTEX + ALPHA_OFFSET] = chunk.paintAlpha[v] * opacity;
                }
            } else if (opacity != 1.F) {
                // Opaque geometry needs no alpha backup until its first fade.
                chunk.paintAlpha.resize(chunk.vertices.size() / FLOATS_PER_VERTEX);
                for (size_t v = 0; v < chunk.paintAlpha.size(); ++v) {
                    auto& alpha = chunk.vertices[v * FLOATS_PER_VERTEX + ALPHA_OFFSET];
                    chunk.paintAlpha[v] = alpha;
                    alpha *= opacity;
                }
            }
            auto* vb = subModels[i]->getInputAssembler()->getVertexBuffers().front();
            vb->update(chunk.vertices.data(), static_cast<uint32_t>(chunk.vertices.size() * sizeof(float)));
            chunk.appliedOpacity = opacity;
        }
        _lastOpacity = opacity;
    }

    ccstd::vector<Chunk> _chunks;
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

                // An unindexed chunk can precede a drawable one. Its submodel needs only the minimum buffer.
                const uint32_t indexCount = drawInfo->getIndexOffset();
                const uint32_t vertexCapacity = growCapacity(indexCount ? drawInfo->getVertexOffset() : 0U, 0, MAX_VERTEX_COUNT);
                const uint32_t indexCapacity = growCapacity(indexCount, 0, MAX_INDEX_COUNT);

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
    static_cast<GraphicsModel*>(_model.get())->setGeometry(drawInfos);

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
    if (_model) {
        static_cast<GraphicsModel*>(_model.get())->clearGeometry();
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
