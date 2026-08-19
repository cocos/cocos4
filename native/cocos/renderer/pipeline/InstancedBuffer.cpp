/****************************************************************************
 Copyright (c) 2020-2023 Xiamen Yaji Software Co., Ltd.

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

#include <algorithm>

#include "InstancedBuffer.h"
#include "Define.h"
#include "gfx-base/GFXBuffer.h"
#include "gfx-base/GFXCommandBuffer.h"
#include "gfx-base/GFXDescriptorSet.h"
#include "gfx-base/GFXDevice.h"
#include "gfx-base/GFXInputAssembler.h"
#include "base/StringUtil.h"

namespace cc {
namespace pipeline {

InstancedBuffer::InstancedBuffer(const scene::Pass *pass)
: _pass(pass),
  _device(gfx::Device::getInstance()) {
}

InstancedBuffer::~InstancedBuffer() {
    destroy();
}

void InstancedBuffer::destroy() {
    for (auto &instance : _instances) {
        CC_SAFE_DESTROY_AND_DELETE(instance.vb);
        CC_SAFE_DESTROY_AND_DELETE(instance.ia);
        CC_FREE(instance.data);
    }
    _instances.clear();
    _instancesMap.clear();
}

void InstancedBuffer::merge(scene::SubModel *subModel, uint32_t passIdx) {
    merge(subModel, passIdx, nullptr);
}

void InstancedBuffer::merge(scene::SubModel *subModel, uint32_t passIdx, gfx::Shader *shaderImplant) {
    auto &attrs = subModel->getInstancedAttributeBlock();

    const auto stride = attrs.buffer.length();
    if (!stride) return; // we assume per-instance attributes are always present

    auto *sourceIA = subModel->getInputAssembler();
    auto *descriptorSet = subModel->getDescriptorSet();
    auto *lightingMap = descriptorSet->getTexture(LIGHTMAPTEXTURE::BINDING);
    auto *reflectionProbeCubemap = descriptorSet->getTexture(REFLECTIONPROBECUBEMAP::BINDING);
    auto *reflectionProbePlanarMap = descriptorSet->getTexture(REFLECTIONPROBEPLANARMAP::BINDING);
    auto *reflectionProbeBlendCubemap = ENABLE_PROBE_BLEND
                                                    ? descriptorSet->getTexture(REFLECTIONPROBEBLENDCUBEMAP::BINDING)
                                                    : nullptr;
    const uint32_t reflectionProbeType = subModel->getReflectionProbeType();
    auto *shader = shaderImplant;
    if (!shader) {
        shader = subModel->getShader(passIdx);
    }
    auto passPriority = static_cast<uint32_t>(subModel->getPass(passIdx)->getPriority());
    auto modelPriority = static_cast<uint32_t>(subModel->getPriority());
    auto shaderId = static_cast<uint32_t>(reinterpret_cast<uintptr_t>(subModel->getShader(passIdx)));
    const auto hash = (passPriority << 16) | (modelPriority << 8) | passIdx;
    _sortRender.hash = hash;
    _sortRender.shaderID = shaderId;
    _sortRender.passIndex = passIdx;
    const ccstd::string key = StringUtil::format("%u/%u/%u/%u/%u/%u/%u",
                                                 sourceIA->getIndexBuffer() ? sourceIA->getIndexBuffer()->getObjectID() : 0,
                                                 lightingMap ? lightingMap->getObjectID() : 0,
                                                 reflectionProbeType,
                                                 reflectionProbeCubemap ? reflectionProbeCubemap->getObjectID() : 0,
                                                 reflectionProbePlanarMap ? reflectionProbePlanarMap->getObjectID() : 0,
                                                 reflectionProbeBlendCubemap ? reflectionProbeBlendCubemap->getObjectID() : 0,
                                                 stride);
    const auto iter = _instancesMap.find(key);
    if (iter != _instancesMap.end()) {
        for (size_t idx : iter->second) {
            auto &instance = _instances[idx];
            if (instance.drawInfo.instanceCount >= MAX_CAPACITY) {
                continue;
            }
            _appendInstance(instance, attrs.buffer, shader, descriptorSet);
            return;
        }
    }

    _createInstance(
        key,
        sourceIA,
        attrs.attributes,
        attrs.buffer,
        stride,
        shader,
        descriptorSet,
        lightingMap,
        reflectionProbeType,
        reflectionProbeCubemap,
        reflectionProbePlanarMap,
        reflectionProbeBlendCubemap
        );
}

void InstancedBuffer::_appendInstance(InstancedItem& instance, Uint8Array buffer, gfx::Shader* shader, gfx::DescriptorSet* descriptorSet) {
    if (instance.drawInfo.instanceCount >= instance.capacity) { // resize buffers
        instance.capacity = std::min(instance.capacity << 1, MAX_CAPACITY);
        const auto newSize = instance.stride * instance.capacity;
        // NOLINTNEXTLINE(bugprone-suspicious-realloc-usage)
        instance.data = static_cast<uint8_t *>(CC_REALLOC(instance.data, newSize));
        instance.vb->resize(newSize);
    }
    if (instance.shader != shader) {
        instance.shader = shader;
    }
    if (instance.descriptorSet != descriptorSet) {
        instance.descriptorSet = descriptorSet;
    }
    auto *destination = instance.data + static_cast<size_t>(instance.stride) * instance.drawInfo.instanceCount;
    CC_ASSERT(destination);
    memcpy(destination, buffer.buffer()->getData(), instance.stride);
    instance.drawInfo.instanceCount++;
    _hasPendingModels = true;
}

void InstancedBuffer::_createInstance(const ccstd::string &key,
                                      gfx::InputAssembler *sourceIA,
                                      const ccstd::vector<gfx::Attribute> &attributes,
                                      Uint8Array buffer,
                                      uint32_t stride,
                                      gfx::Shader *shader,
                                      gfx::DescriptorSet *descriptorSet,
                                      gfx::Texture *lightingMap,
                                      const uint32_t reflectionProbeType,
                                      gfx::Texture *reflectionProbeCubemap,
                                      gfx::Texture *reflectionProbePlanarMap,
                                      gfx::Texture *reflectionProbeBlendCubemap) {
    const auto newSize = stride * INITIAL_CAPACITY;
    auto *vb = _device->createBuffer({
        gfx::BufferUsageBit::VERTEX | gfx::BufferUsageBit::TRANSFER_DST,
        gfx::MemoryUsageBit::HOST | gfx::MemoryUsageBit::DEVICE,
        static_cast<uint32_t>(newSize),
        static_cast<uint32_t>(stride),
    });
    auto *data = static_cast<uint8_t *>(CC_MALLOC(newSize));
    auto vertexBuffers = sourceIA->getVertexBuffers();
    auto iaAttributes = sourceIA->getAttributes();
    auto *indexBuffer = sourceIA->getIndexBuffer();

    for (const auto &attribute : attributes) {
        iaAttributes.emplace_back(gfx::Attribute{
            attribute.name,
            attribute.format,
            attribute.isNormalized,
            static_cast<uint32_t>(vertexBuffers.size()), // stream
            true,
            attribute.location});
    }
    CC_ASSERT(data);
    memcpy(data, buffer.buffer()->getData(), stride);

    vertexBuffers.emplace_back(vb);
    const gfx::InputAssemblerInfo iaInfo = {iaAttributes, vertexBuffers, indexBuffer};
    auto *ia = _device->createInputAssembler(iaInfo);
    InstancedItem item = {INITIAL_CAPACITY, vb, data, ia, stride, shader, descriptorSet,
                          lightingMap,
                          reflectionProbeCubemap,
                          reflectionProbePlanarMap,
                          reflectionProbeType,
                          reflectionProbeBlendCubemap,
                          ia->getDrawInfo()};
    item.drawInfo.instanceCount = 1;
    _instances.emplace_back(item);
    _instancesMap[key].emplace_back(_instances.size() - 1);
    _hasPendingModels = true;
}

void InstancedBuffer::uploadBuffers(gfx::CommandBuffer *cmdBuff) const {
    for (const auto &instance : _instances) {
        if (!instance.drawInfo.instanceCount) continue;

        // `instance.data` is only guaranteed to hold `instance.capacity * instance.stride` bytes.
        // If `instance.vb` was resized to a larger size than the CPU-side `instance.data`
        // buffer (e.g. due to a bug in the resize/append logic), copying `instance.vb->getSize()`
        // bytes from `instance.data` would read out of bounds and crash. Clamp to the smaller
        // of the two to avoid reading past the end of `instance.data`.
        const uint32_t dataCapacity = instance.capacity * instance.stride;
        const uint32_t copySize = std::min(instance.vb->getSize(), dataCapacity);
        CC_ASSERT(copySize == instance.vb->getSize());
        cmdBuff->updateBuffer(instance.vb, instance.data, copySize);
        instance.ia->setInstanceCount(instance.drawInfo.instanceCount);
    }
}

void InstancedBuffer::clear() {
    for (auto &instance : _instances) {
        instance.drawInfo.instanceCount = 0;
    }
    _hasPendingModels = false;
}

void InstancedBuffer::setDynamicOffset(uint32_t idx, uint32_t value) {
    if (_dynamicOffsets.size() <= idx) _dynamicOffsets.resize(1 + idx);
    _dynamicOffsets[idx] = value;
}
} // namespace pipeline
} // namespace cc
