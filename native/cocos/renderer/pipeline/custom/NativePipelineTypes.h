/*
 Copyright (c) 2021-2024 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com

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
*/

/**
 * ========================= !DO NOT CHANGE THE FOLLOWING SECTION MANUALLY! =========================
 * The following section is auto-generated.
 * ========================= !DO NOT CHANGE THE FOLLOWING SECTION MANUALLY! =========================
 */
#pragma once // NOLINT(portability-avoid-pragma-once)
#include <array>
#include <cstdint>
#include <memory>
#include <string>
#include <string_view>
#include <tuple>
#include <utility>
#include <vector>
#include "NativePipelineFwd.h"
#include "boost/container/pmr/unsynchronized_pool_resource.hpp"
#include "cocos/base/Ptr.h"
#include "cocos/base/std/container/map.h"
#include "cocos/base/std/container/string.h"
#include "cocos/base/std/container/unordered_map.h"
#include "cocos/base/std/container/vector.h"
#include "cocos/core/ArrayBuffer.h"
#include "cocos/core/assets/EffectAsset.h"
#include "cocos/core/assets/Material.h"
#include "cocos/core/geometry/AABB.h"
#include "cocos/core/geometry/Frustum.h"
#include "cocos/math/Mat4.h"
#include "cocos/math/Quaternion.h"
#include "cocos/math/Vec2.h"
#include "cocos/math/Vec4.h"
#include "cocos/renderer/core/PassUtils.h"
#include "cocos/renderer/core/ProgramLib.h"
#include "cocos/renderer/gfx-base/GFXBuffer.h"
#include "cocos/renderer/gfx-base/GFXCommandBuffer.h"
#include "cocos/renderer/gfx-base/GFXDef-common.h"
#include "cocos/renderer/gfx-base/GFXDef.h"
#include "cocos/renderer/gfx-base/GFXDescriptorSet.h"
#include "cocos/renderer/gfx-base/GFXDescriptorSetLayout.h"
#include "cocos/renderer/gfx-base/GFXDevice.h"
#include "cocos/renderer/gfx-base/GFXInputAssembler.h"
#include "cocos/renderer/gfx-base/GFXPipelineLayout.h"
#include "cocos/renderer/gfx-base/GFXPipelineState.h"
#include "cocos/renderer/gfx-base/GFXRenderPass.h"
#include "cocos/renderer/gfx-base/GFXShader.h"
#include "cocos/renderer/gfx-base/GFXSwapchain.h"
#include "cocos/renderer/gfx-base/GFXTexture.h"
#include "cocos/renderer/gfx-base/states/GFXSampler.h"
#include "cocos/renderer/pipeline/GeometryRenderer.h"
#include "cocos/renderer/pipeline/GlobalDescriptorSetManager.h"
#include "cocos/renderer/pipeline/InstancedBuffer.h"
#include "cocos/renderer/pipeline/PipelineSceneData.h"
#include "cocos/renderer/pipeline/custom/CustomTypes.h"
#include "cocos/renderer/pipeline/custom/FGDispatcherTypes.h"
#include "cocos/renderer/pipeline/custom/LayoutGraphTypes.h"
#include "cocos/renderer/pipeline/custom/NativeTypes.h"
#include "cocos/renderer/pipeline/custom/PrivateTypes.h"
#include "cocos/renderer/pipeline/custom/RenderCommonTypes.h"
#include "cocos/renderer/pipeline/custom/RenderGraphTypes.h"
#include "cocos/renderer/pipeline/custom/RenderInterfaceTypes.h"
#include "cocos/renderer/pipeline/custom/details/Map.h"
#include "cocos/renderer/pipeline/custom/details/Set.h"
#include "cocos/scene/Camera.h"
#include "cocos/scene/DirectionalLight.h"
#include "cocos/scene/Light.h"
#include "cocos/scene/Model.h"
#include "cocos/scene/Pass.h"
#include "cocos/scene/PointLight.h"
#include "cocos/scene/RangedDirectionalLight.h"
#include "cocos/scene/ReflectionProbe.h"
#include "cocos/scene/RenderScene.h"
#include "cocos/scene/RenderWindow.h"
#include "cocos/scene/Shadow.h"
#include "cocos/scene/SphereLight.h"
#include "cocos/scene/SpotLight.h"
#include "cocos/scene/SubModel.h"

namespace cc {

namespace render {

struct RenderGraphFilter {
    bool operator()(RenderGraph::vertex_descriptor pass) const {
        return (*validPasses)[pass];
    }

    const ccstd::pmr::vector<bool> *validPasses{nullptr};
};

class NativeRenderNode {
public:
    NativeRenderNode(const PipelineRuntime* pipelineRuntimeIn, RenderGraph* renderGraphIn, RenderGraph::vertex_descriptor nodeIDIn) noexcept
    : pipelineRuntime(pipelineRuntimeIn),
      renderGraph(renderGraphIn),
      nodeID(nodeIDIn) {}

    ccstd::string getName() const;
    void setCustomBehavior(const ccstd::string &name);
    void setName(const ccstd::string &name);
    const PipelineRuntime *pipelineRuntime{nullptr};
    RenderGraph *renderGraph{nullptr};
    RenderGraph::vertex_descriptor nodeID{0xFFFFFFFF};
};

class NativeSetter : public NativeRenderNode {
public:
    NativeSetter(const PipelineRuntime* pipelineRuntimeIn, RenderGraph* renderGraphIn, RenderGraph::vertex_descriptor nodeIDIn, const LayoutGraphData* layoutGraphIn, LayoutGraphData::vertex_descriptor layoutIDIn) noexcept
    : NativeRenderNode(pipelineRuntimeIn, renderGraphIn, nodeIDIn),
      layoutGraph(layoutGraphIn),
      layoutID(layoutIDIn) {}

    void setArrayBuffer(const ccstd::string &name, const ArrayBuffer *arrayBuffer);
    void setBuffer(const ccstd::string &name, gfx::Buffer *buffer);
    void setBuiltinCameraConstants(const scene::Camera *camera);
    void setBuiltinDirectionalLightConstants(const scene::DirectionalLight *light, const scene::Camera *camera);
    void setBuiltinDirectionalLightFrustumConstants(const scene::Camera *camera, const scene::DirectionalLight *light, uint32_t csmLevel);
    void setBuiltinPointLightConstants(const scene::PointLight *light, const scene::Camera *camera);
    void setBuiltinRangedDirectionalLightConstants(const scene::RangedDirectionalLight *light, const scene::Camera *camera);
    void setBuiltinSphereLightConstants(const scene::SphereLight *light, const scene::Camera *camera);
    void setBuiltinSpotLightConstants(const scene::SpotLight *light, const scene::Camera *camera);
    void setBuiltinSpotLightFrustumConstants(const scene::SpotLight *light);
    void setColor(const ccstd::string &name, const gfx::Color &color);
    void setFloat(const ccstd::string &name, float v);
    void setMat4(const ccstd::string &name, const Mat4 &mat);
    void setQuaternion(const ccstd::string &name, const Quaternion &quat);
    void setSampler(const ccstd::string &name, gfx::Sampler *sampler);
    void setTexture(const ccstd::string &name, gfx::Texture *texture);
    void setVec2(const ccstd::string &name, const Vec2 &vec);
    void setVec4(const ccstd::string &name, const Vec4 &vec);
    void setVec4ArraySize(const ccstd::string &name, uint32_t sz);
    void setVec4ArrayElem(const ccstd::string &name, const Vec4 &vec, uint32_t id);
    void setMat4ArraySize(const ccstd::string &name, uint32_t sz);
    void setMat4ArrayElem(const ccstd::string &name, const Mat4 &mat, uint32_t id);

    const LayoutGraphData *layoutGraph{nullptr};
    LayoutGraphData::vertex_descriptor layoutID{0xFFFFFFFF};
};

class NativeRenderSubpassBuilderImpl : public NativeSetter {
public:
    NativeRenderSubpassBuilderImpl(const PipelineRuntime* pipelineRuntimeIn, RenderGraph* renderGraphIn, RenderGraph::vertex_descriptor nodeIDIn, const LayoutGraphData* layoutGraphIn, LayoutGraphData::vertex_descriptor layoutIDIn) noexcept
    : NativeSetter(pipelineRuntimeIn, renderGraphIn, nodeIDIn, layoutGraphIn, layoutIDIn) {}

    void addDepthStencil(const ccstd::string &name, AccessType accessType, const ccstd::string &depthSlotName, const ccstd::string &stencilSlotName, gfx::LoadOp loadOp, gfx::StoreOp storeOp, float depth, uint8_t stencil, gfx::ClearFlagBit clearFlags);
    RenderQueueBuilder *addQueue(QueueHint hint, const ccstd::string &phaseName, const ccstd::string &passName);
    void addRenderTarget(const ccstd::string &name, AccessType accessType, const ccstd::string &slotName, gfx::LoadOp loadOp, gfx::StoreOp storeOp, const gfx::Color &color);
    void addStorageBuffer(const ccstd::string &name, AccessType accessType, const ccstd::string &slotName);
    void addStorageImage(const ccstd::string &name, AccessType accessType, const ccstd::string &slotName);
    void addTexture(const ccstd::string &name, const ccstd::string &slotName, gfx::Sampler *sampler, uint32_t plane);
    bool getShowStatistics() const;
    void setCustomShaderStages(const ccstd::string &name, gfx::ShaderStageFlagBit stageFlags);
    void setShowStatistics(bool enable);
    void setViewport(const gfx::Viewport &viewport);
};

class NativeSceneBuilder final : public SceneBuilder, public NativeSetter {
public:
    NativeSceneBuilder(const PipelineRuntime* pipelineRuntimeIn, RenderGraph* renderGraphIn, RenderGraph::vertex_descriptor nodeIDIn, const LayoutGraphData* layoutGraphIn, LayoutGraphData::vertex_descriptor layoutIDIn) noexcept
    : NativeSetter(pipelineRuntimeIn, renderGraphIn, nodeIDIn, layoutGraphIn, layoutIDIn) {}

    ccstd::string getName() const override { return NativeSetter::getName(); }
    void setArrayBuffer(const ccstd::string &name, const ArrayBuffer *arrayBuffer) override { NativeSetter::setArrayBuffer(name, arrayBuffer); }
    void setBuffer(const ccstd::string &name, gfx::Buffer *buffer) override { NativeSetter::setBuffer(name, buffer); }
    void setBuiltinCameraConstants(const scene::Camera *camera) override { NativeSetter::setBuiltinCameraConstants(camera); }
    void setBuiltinDirectionalLightConstants(const scene::DirectionalLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinDirectionalLightConstants(light, camera); }
    void setBuiltinDirectionalLightFrustumConstants(const scene::Camera *camera, const scene::DirectionalLight *light, uint32_t csmLevel) override { NativeSetter::setBuiltinDirectionalLightFrustumConstants(camera, light, csmLevel); }
    void setBuiltinPointLightConstants(const scene::PointLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinPointLightConstants(light, camera); }
    void setBuiltinRangedDirectionalLightConstants(const scene::RangedDirectionalLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinRangedDirectionalLightConstants(light, camera); }
    void setBuiltinSphereLightConstants(const scene::SphereLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinSphereLightConstants(light, camera); }
    void setBuiltinSpotLightConstants(const scene::SpotLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinSpotLightConstants(light, camera); }
    void setBuiltinSpotLightFrustumConstants(const scene::SpotLight *light) override { NativeSetter::setBuiltinSpotLightFrustumConstants(light); }
    void setColor(const ccstd::string &name, const gfx::Color &color) override { NativeSetter::setColor(name, color); }
    void setCustomBehavior(const ccstd::string &name) override { NativeSetter::setCustomBehavior(name); }
    void setFloat(const ccstd::string &name, float v) override { NativeSetter::setFloat(name, v); }
    void setMat4(const ccstd::string &name, const Mat4 &mat) override { NativeSetter::setMat4(name, mat); }
    void setName(const ccstd::string &name) override { NativeSetter::setName(name); }
    void setQuaternion(const ccstd::string &name, const Quaternion &quat) override { NativeSetter::setQuaternion(name, quat); }
    void setSampler(const ccstd::string &name, gfx::Sampler *sampler) override { NativeSetter::setSampler(name, sampler); }
    void setTexture(const ccstd::string &name, gfx::Texture *texture) override { NativeSetter::setTexture(name, texture); }
    void setVec2(const ccstd::string &name, const Vec2 &vec) override { NativeSetter::setVec2(name, vec); }
    void setVec4(const ccstd::string &name, const Vec4 &vec) override { NativeSetter::setVec4(name, vec); }
    void useLightFrustum(IntrusivePtr<scene::Light> light, uint32_t csmLevel, const scene::Camera *optCamera) override;
};

class NativeRenderQueueBuilder final : public RenderQueueBuilder, public NativeSetter {
public:
    NativeRenderQueueBuilder(const PipelineRuntime* pipelineRuntimeIn, RenderGraph* renderGraphIn, RenderGraph::vertex_descriptor nodeIDIn, const LayoutGraphData* layoutGraphIn, LayoutGraphData::vertex_descriptor layoutIDIn) noexcept
    : NativeSetter(pipelineRuntimeIn, renderGraphIn, nodeIDIn, layoutGraphIn, layoutIDIn) {}

    void addCameraQuad(scene::Camera *camera, Material *material, uint32_t passID, SceneFlags sceneFlags) override;
    void addCustomCommand(std::string_view customBehavior) override;
    void addDraw2D(const scene::Camera *camera) override;
    void addDraw3D(const scene::Camera *camera, const std::vector<scene::Model *> &models, SceneFlags sceneFlags) override;
    void addFullscreenQuad(Material *material, uint32_t passID, SceneFlags sceneFlags) override;
    void addProfiler(const scene::Camera *camera) override;
    SceneBuilder *addScene(const scene::Camera *camera, SceneFlags sceneFlags, scene::Light *light, scene::RenderScene *scene) override;
    void addSceneOfCamera(scene::Camera *camera, LightInfo light, SceneFlags sceneFlags) override;
    void clearRenderTarget(const ccstd::string &name, const gfx::Color &color) override;
    ccstd::string getName() const override { return NativeSetter::getName(); }
    void setArrayBuffer(const ccstd::string &name, const ArrayBuffer *arrayBuffer) override { NativeSetter::setArrayBuffer(name, arrayBuffer); }
    void setBuffer(const ccstd::string &name, gfx::Buffer *buffer) override { NativeSetter::setBuffer(name, buffer); }
    void setBuiltinCameraConstants(const scene::Camera *camera) override { NativeSetter::setBuiltinCameraConstants(camera); }
    void setBuiltinDirectionalLightConstants(const scene::DirectionalLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinDirectionalLightConstants(light, camera); }
    void setBuiltinDirectionalLightFrustumConstants(const scene::Camera *camera, const scene::DirectionalLight *light, uint32_t csmLevel) override { NativeSetter::setBuiltinDirectionalLightFrustumConstants(camera, light, csmLevel); }
    void setBuiltinPointLightConstants(const scene::PointLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinPointLightConstants(light, camera); }
    void setBuiltinRangedDirectionalLightConstants(const scene::RangedDirectionalLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinRangedDirectionalLightConstants(light, camera); }
    void setBuiltinSphereLightConstants(const scene::SphereLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinSphereLightConstants(light, camera); }
    void setBuiltinSpotLightConstants(const scene::SpotLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinSpotLightConstants(light, camera); }
    void setBuiltinSpotLightFrustumConstants(const scene::SpotLight *light) override { NativeSetter::setBuiltinSpotLightFrustumConstants(light); }
    void setColor(const ccstd::string &name, const gfx::Color &color) override { NativeSetter::setColor(name, color); }
    void setCustomBehavior(const ccstd::string &name) override { NativeSetter::setCustomBehavior(name); }
    void setFloat(const ccstd::string &name, float v) override { NativeSetter::setFloat(name, v); }
    void setMat4(const ccstd::string &name, const Mat4 &mat) override { NativeSetter::setMat4(name, mat); }
    void setName(const ccstd::string &name) override { NativeSetter::setName(name); }
    void setQuaternion(const ccstd::string &name, const Quaternion &quat) override { NativeSetter::setQuaternion(name, quat); }
    void setSampler(const ccstd::string &name, gfx::Sampler *sampler) override { NativeSetter::setSampler(name, sampler); }
    void setTexture(const ccstd::string &name, gfx::Texture *texture) override { NativeSetter::setTexture(name, texture); }
    void setVec2(const ccstd::string &name, const Vec2 &vec) override { NativeSetter::setVec2(name, vec); }
    void setVec4(const ccstd::string &name, const Vec4 &vec) override { NativeSetter::setVec4(name, vec); }
    void setViewport(const gfx::Viewport &viewport) override;
};

class NativeRenderSubpassBuilder final : public RenderSubpassBuilder, public NativeRenderSubpassBuilderImpl {
public:
    NativeRenderSubpassBuilder(const PipelineRuntime* pipelineRuntimeIn, RenderGraph* renderGraphIn, RenderGraph::vertex_descriptor nodeIDIn, const LayoutGraphData* layoutGraphIn, LayoutGraphData::vertex_descriptor layoutIDIn) noexcept
    : NativeRenderSubpassBuilderImpl(pipelineRuntimeIn, renderGraphIn, nodeIDIn, layoutGraphIn, layoutIDIn) {}

    void addDepthStencil(const ccstd::string &name, AccessType accessType, const ccstd::string &depthSlotName, const ccstd::string &stencilSlotName, gfx::LoadOp loadOp, gfx::StoreOp storeOp, float depth, uint8_t stencil, gfx::ClearFlagBit clearFlags) override { NativeRenderSubpassBuilderImpl::addDepthStencil(name, accessType, depthSlotName, stencilSlotName, loadOp, storeOp, depth, stencil, clearFlags); }
    RenderQueueBuilder *addQueue(QueueHint hint, const ccstd::string &phaseName, const ccstd::string &passName) override { return NativeRenderSubpassBuilderImpl::addQueue(hint, phaseName, passName); }
    void addRenderTarget(const ccstd::string &name, AccessType accessType, const ccstd::string &slotName, gfx::LoadOp loadOp, gfx::StoreOp storeOp, const gfx::Color &color) override { NativeRenderSubpassBuilderImpl::addRenderTarget(name, accessType, slotName, loadOp, storeOp, color); }
    void addStorageBuffer(const ccstd::string &name, AccessType accessType, const ccstd::string &slotName) override { NativeRenderSubpassBuilderImpl::addStorageBuffer(name, accessType, slotName); }
    void addStorageImage(const ccstd::string &name, AccessType accessType, const ccstd::string &slotName) override { NativeRenderSubpassBuilderImpl::addStorageImage(name, accessType, slotName); }
    void addTexture(const ccstd::string &name, const ccstd::string &slotName, gfx::Sampler *sampler, uint32_t plane) override { NativeRenderSubpassBuilderImpl::addTexture(name, slotName, sampler, plane); }
    ccstd::string getName() const override { return NativeRenderSubpassBuilderImpl::getName(); }
    bool getShowStatistics() const override { return NativeRenderSubpassBuilderImpl::getShowStatistics(); }
    void setArrayBuffer(const ccstd::string &name, const ArrayBuffer *arrayBuffer) override { NativeRenderSubpassBuilderImpl::setArrayBuffer(name, arrayBuffer); }
    void setBuffer(const ccstd::string &name, gfx::Buffer *buffer) override { NativeRenderSubpassBuilderImpl::setBuffer(name, buffer); }
    void setBuiltinCameraConstants(const scene::Camera *camera) override { NativeRenderSubpassBuilderImpl::setBuiltinCameraConstants(camera); }
    void setBuiltinDirectionalLightConstants(const scene::DirectionalLight *light, const scene::Camera *camera) override { NativeRenderSubpassBuilderImpl::setBuiltinDirectionalLightConstants(light, camera); }
    void setBuiltinDirectionalLightFrustumConstants(const scene::Camera *camera, const scene::DirectionalLight *light, uint32_t csmLevel) override { NativeRenderSubpassBuilderImpl::setBuiltinDirectionalLightFrustumConstants(camera, light, csmLevel); }
    void setBuiltinPointLightConstants(const scene::PointLight *light, const scene::Camera *camera) override { NativeRenderSubpassBuilderImpl::setBuiltinPointLightConstants(light, camera); }
    void setBuiltinRangedDirectionalLightConstants(const scene::RangedDirectionalLight *light, const scene::Camera *camera) override { NativeRenderSubpassBuilderImpl::setBuiltinRangedDirectionalLightConstants(light, camera); }
    void setBuiltinSphereLightConstants(const scene::SphereLight *light, const scene::Camera *camera) override { NativeRenderSubpassBuilderImpl::setBuiltinSphereLightConstants(light, camera); }
    void setBuiltinSpotLightConstants(const scene::SpotLight *light, const scene::Camera *camera) override { NativeRenderSubpassBuilderImpl::setBuiltinSpotLightConstants(light, camera); }
    void setBuiltinSpotLightFrustumConstants(const scene::SpotLight *light) override { NativeRenderSubpassBuilderImpl::setBuiltinSpotLightFrustumConstants(light); }
    void setColor(const ccstd::string &name, const gfx::Color &color) override { NativeRenderSubpassBuilderImpl::setColor(name, color); }
    void setCustomBehavior(const ccstd::string &name) override { NativeRenderSubpassBuilderImpl::setCustomBehavior(name); }
    void setCustomShaderStages(const ccstd::string &name, gfx::ShaderStageFlagBit stageFlags) override { NativeRenderSubpassBuilderImpl::setCustomShaderStages(name, stageFlags); }
    void setFloat(const ccstd::string &name, float v) override { NativeRenderSubpassBuilderImpl::setFloat(name, v); }
    void setMat4(const ccstd::string &name, const Mat4 &mat) override { NativeRenderSubpassBuilderImpl::setMat4(name, mat); }
    void setName(const ccstd::string &name) override { NativeRenderSubpassBuilderImpl::setName(name); }
    void setQuaternion(const ccstd::string &name, const Quaternion &quat) override { NativeRenderSubpassBuilderImpl::setQuaternion(name, quat); }
    void setSampler(const ccstd::string &name, gfx::Sampler *sampler) override { NativeRenderSubpassBuilderImpl::setSampler(name, sampler); }
    void setShowStatistics(bool enable) override { NativeRenderSubpassBuilderImpl::setShowStatistics(enable); }
    void setTexture(const ccstd::string &name, gfx::Texture *texture) override { NativeRenderSubpassBuilderImpl::setTexture(name, texture); }
    void setVec2(const ccstd::string &name, const Vec2 &vec) override { NativeRenderSubpassBuilderImpl::setVec2(name, vec); }
    void setVec4(const ccstd::string &name, const Vec4 &vec) override { NativeRenderSubpassBuilderImpl::setVec4(name, vec); }
    void setViewport(const gfx::Viewport &viewport) override { NativeRenderSubpassBuilderImpl::setViewport(viewport); }
};

class NativeMultisampleRenderSubpassBuilder final : public MultisampleRenderSubpassBuilder, public NativeRenderSubpassBuilderImpl {
public:
    NativeMultisampleRenderSubpassBuilder(const PipelineRuntime* pipelineRuntimeIn, RenderGraph* renderGraphIn, RenderGraph::vertex_descriptor nodeIDIn, const LayoutGraphData* layoutGraphIn, LayoutGraphData::vertex_descriptor layoutIDIn) noexcept
    : NativeRenderSubpassBuilderImpl(pipelineRuntimeIn, renderGraphIn, nodeIDIn, layoutGraphIn, layoutIDIn) {}

    void addDepthStencil(const ccstd::string &name, AccessType accessType, const ccstd::string &depthSlotName, const ccstd::string &stencilSlotName, gfx::LoadOp loadOp, gfx::StoreOp storeOp, float depth, uint8_t stencil, gfx::ClearFlagBit clearFlags) override { NativeRenderSubpassBuilderImpl::addDepthStencil(name, accessType, depthSlotName, stencilSlotName, loadOp, storeOp, depth, stencil, clearFlags); }
    RenderQueueBuilder *addQueue(QueueHint hint, const ccstd::string &phaseName, const ccstd::string &passName) override { return NativeRenderSubpassBuilderImpl::addQueue(hint, phaseName, passName); }
    void addRenderTarget(const ccstd::string &name, AccessType accessType, const ccstd::string &slotName, gfx::LoadOp loadOp, gfx::StoreOp storeOp, const gfx::Color &color) override { NativeRenderSubpassBuilderImpl::addRenderTarget(name, accessType, slotName, loadOp, storeOp, color); }
    void addStorageBuffer(const ccstd::string &name, AccessType accessType, const ccstd::string &slotName) override { NativeRenderSubpassBuilderImpl::addStorageBuffer(name, accessType, slotName); }
    void addStorageImage(const ccstd::string &name, AccessType accessType, const ccstd::string &slotName) override { NativeRenderSubpassBuilderImpl::addStorageImage(name, accessType, slotName); }
    void addTexture(const ccstd::string &name, const ccstd::string &slotName, gfx::Sampler *sampler, uint32_t plane) override { NativeRenderSubpassBuilderImpl::addTexture(name, slotName, sampler, plane); }
    ccstd::string getName() const override { return NativeRenderSubpassBuilderImpl::getName(); }
    bool getShowStatistics() const override { return NativeRenderSubpassBuilderImpl::getShowStatistics(); }
    void resolveDepthStencil(const ccstd::string &source, const ccstd::string &target, gfx::ResolveMode depthMode, gfx::ResolveMode stencilMode) override;
    void resolveRenderTarget(const ccstd::string &source, const ccstd::string &target) override;
    void setArrayBuffer(const ccstd::string &name, const ArrayBuffer *arrayBuffer) override { NativeRenderSubpassBuilderImpl::setArrayBuffer(name, arrayBuffer); }
    void setBuffer(const ccstd::string &name, gfx::Buffer *buffer) override { NativeRenderSubpassBuilderImpl::setBuffer(name, buffer); }
    void setBuiltinCameraConstants(const scene::Camera *camera) override { NativeRenderSubpassBuilderImpl::setBuiltinCameraConstants(camera); }
    void setBuiltinDirectionalLightConstants(const scene::DirectionalLight *light, const scene::Camera *camera) override { NativeRenderSubpassBuilderImpl::setBuiltinDirectionalLightConstants(light, camera); }
    void setBuiltinDirectionalLightFrustumConstants(const scene::Camera *camera, const scene::DirectionalLight *light, uint32_t csmLevel) override { NativeRenderSubpassBuilderImpl::setBuiltinDirectionalLightFrustumConstants(camera, light, csmLevel); }
    void setBuiltinPointLightConstants(const scene::PointLight *light, const scene::Camera *camera) override { NativeRenderSubpassBuilderImpl::setBuiltinPointLightConstants(light, camera); }
    void setBuiltinRangedDirectionalLightConstants(const scene::RangedDirectionalLight *light, const scene::Camera *camera) override { NativeRenderSubpassBuilderImpl::setBuiltinRangedDirectionalLightConstants(light, camera); }
    void setBuiltinSphereLightConstants(const scene::SphereLight *light, const scene::Camera *camera) override { NativeRenderSubpassBuilderImpl::setBuiltinSphereLightConstants(light, camera); }
    void setBuiltinSpotLightConstants(const scene::SpotLight *light, const scene::Camera *camera) override { NativeRenderSubpassBuilderImpl::setBuiltinSpotLightConstants(light, camera); }
    void setBuiltinSpotLightFrustumConstants(const scene::SpotLight *light) override { NativeRenderSubpassBuilderImpl::setBuiltinSpotLightFrustumConstants(light); }
    void setColor(const ccstd::string &name, const gfx::Color &color) override { NativeRenderSubpassBuilderImpl::setColor(name, color); }
    void setCustomBehavior(const ccstd::string &name) override { NativeRenderSubpassBuilderImpl::setCustomBehavior(name); }
    void setCustomShaderStages(const ccstd::string &name, gfx::ShaderStageFlagBit stageFlags) override { NativeRenderSubpassBuilderImpl::setCustomShaderStages(name, stageFlags); }
    void setFloat(const ccstd::string &name, float v) override { NativeRenderSubpassBuilderImpl::setFloat(name, v); }
    void setMat4(const ccstd::string &name, const Mat4 &mat) override { NativeRenderSubpassBuilderImpl::setMat4(name, mat); }
    void setName(const ccstd::string &name) override { NativeRenderSubpassBuilderImpl::setName(name); }
    void setQuaternion(const ccstd::string &name, const Quaternion &quat) override { NativeRenderSubpassBuilderImpl::setQuaternion(name, quat); }
    void setSampler(const ccstd::string &name, gfx::Sampler *sampler) override { NativeRenderSubpassBuilderImpl::setSampler(name, sampler); }
    void setShowStatistics(bool enable) override { NativeRenderSubpassBuilderImpl::setShowStatistics(enable); }
    void setTexture(const ccstd::string &name, gfx::Texture *texture) override { NativeRenderSubpassBuilderImpl::setTexture(name, texture); }
    void setVec2(const ccstd::string &name, const Vec2 &vec) override { NativeRenderSubpassBuilderImpl::setVec2(name, vec); }
    void setVec4(const ccstd::string &name, const Vec4 &vec) override { NativeRenderSubpassBuilderImpl::setVec4(name, vec); }
    void setViewport(const gfx::Viewport &viewport) override { NativeRenderSubpassBuilderImpl::setViewport(viewport); }
};

class NativeComputeSubpassBuilder final : public ComputeSubpassBuilder, public NativeSetter {
public:
    NativeComputeSubpassBuilder(const PipelineRuntime* pipelineRuntimeIn, RenderGraph* renderGraphIn, RenderGraph::vertex_descriptor nodeIDIn, const LayoutGraphData* layoutGraphIn, LayoutGraphData::vertex_descriptor layoutIDIn) noexcept
    : NativeSetter(pipelineRuntimeIn, renderGraphIn, nodeIDIn, layoutGraphIn, layoutIDIn) {}

    ComputeQueueBuilder *addQueue(const ccstd::string &phaseName, const ccstd::string &passName) override;
    void addRenderTarget(const ccstd::string &name, const ccstd::string &slotName) override;
    void addStorageBuffer(const ccstd::string &name, AccessType accessType, const ccstd::string &slotName) override;
    void addStorageImage(const ccstd::string &name, AccessType accessType, const ccstd::string &slotName) override;
    void addTexture(const ccstd::string &name, const ccstd::string &slotName, gfx::Sampler *sampler, uint32_t plane) override;
    ccstd::string getName() const override { return NativeSetter::getName(); }
    void setArrayBuffer(const ccstd::string &name, const ArrayBuffer *arrayBuffer) override { NativeSetter::setArrayBuffer(name, arrayBuffer); }
    void setBuffer(const ccstd::string &name, gfx::Buffer *buffer) override { NativeSetter::setBuffer(name, buffer); }
    void setBuiltinCameraConstants(const scene::Camera *camera) override { NativeSetter::setBuiltinCameraConstants(camera); }
    void setBuiltinDirectionalLightConstants(const scene::DirectionalLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinDirectionalLightConstants(light, camera); }
    void setBuiltinDirectionalLightFrustumConstants(const scene::Camera *camera, const scene::DirectionalLight *light, uint32_t csmLevel) override { NativeSetter::setBuiltinDirectionalLightFrustumConstants(camera, light, csmLevel); }
    void setBuiltinPointLightConstants(const scene::PointLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinPointLightConstants(light, camera); }
    void setBuiltinRangedDirectionalLightConstants(const scene::RangedDirectionalLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinRangedDirectionalLightConstants(light, camera); }
    void setBuiltinSphereLightConstants(const scene::SphereLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinSphereLightConstants(light, camera); }
    void setBuiltinSpotLightConstants(const scene::SpotLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinSpotLightConstants(light, camera); }
    void setBuiltinSpotLightFrustumConstants(const scene::SpotLight *light) override { NativeSetter::setBuiltinSpotLightFrustumConstants(light); }
    void setColor(const ccstd::string &name, const gfx::Color &color) override { NativeSetter::setColor(name, color); }
    void setCustomBehavior(const ccstd::string &name) override { NativeSetter::setCustomBehavior(name); }
    void setCustomShaderStages(const ccstd::string &name, gfx::ShaderStageFlagBit stageFlags) override;
    void setFloat(const ccstd::string &name, float v) override { NativeSetter::setFloat(name, v); }
    void setMat4(const ccstd::string &name, const Mat4 &mat) override { NativeSetter::setMat4(name, mat); }
    void setName(const ccstd::string &name) override { NativeSetter::setName(name); }
    void setQuaternion(const ccstd::string &name, const Quaternion &quat) override { NativeSetter::setQuaternion(name, quat); }
    void setSampler(const ccstd::string &name, gfx::Sampler *sampler) override { NativeSetter::setSampler(name, sampler); }
    void setTexture(const ccstd::string &name, gfx::Texture *texture) override { NativeSetter::setTexture(name, texture); }
    void setVec2(const ccstd::string &name, const Vec2 &vec) override { NativeSetter::setVec2(name, vec); }
    void setVec4(const ccstd::string &name, const Vec4 &vec) override { NativeSetter::setVec4(name, vec); }
};

class NativeRenderPassBuilder final : public RenderPassBuilder, public NativeSetter {
public:
    NativeRenderPassBuilder(const PipelineRuntime* pipelineRuntimeIn, RenderGraph* renderGraphIn, RenderGraph::vertex_descriptor nodeIDIn, const LayoutGraphData* layoutGraphIn, LayoutGraphData::vertex_descriptor layoutIDIn) noexcept
    : NativeSetter(pipelineRuntimeIn, renderGraphIn, nodeIDIn, layoutGraphIn, layoutIDIn) {}

    ComputeSubpassBuilder *addComputeSubpass(const ccstd::string &subpassName) override;
    void addDepthStencil(const ccstd::string &name, gfx::LoadOp loadOp, gfx::StoreOp storeOp, float depth, uint8_t stencil, gfx::ClearFlagBit clearFlags) override;
    void addMaterialTexture(const ccstd::string &resourceName, gfx::ShaderStageFlagBit flags) override;
    MultisampleRenderSubpassBuilder *addMultisampleRenderSubpass(uint32_t count, uint32_t quality, const ccstd::string &subpassName) override;
    RenderQueueBuilder *addQueue(QueueHint hint, const ccstd::string &phaseName, const ccstd::string &passName) override;
    RenderSubpassBuilder *addRenderSubpass(const ccstd::string &subpassName) override;
    void addRenderTarget(const ccstd::string &name, gfx::LoadOp loadOp, gfx::StoreOp storeOp, const gfx::Color &color) override;
    void addStorageBuffer(const ccstd::string &name, AccessType accessType, const ccstd::string &slotName) override;
    void addStorageImage(const ccstd::string &name, AccessType accessType, const ccstd::string &slotName) override;
    void addTexture(const ccstd::string &name, const ccstd::string &slotName, gfx::Sampler *sampler, uint32_t plane) override;
    ccstd::string getName() const override { return NativeSetter::getName(); }
    bool getShowStatistics() const override;
    void setArrayBuffer(const ccstd::string &name, const ArrayBuffer *arrayBuffer) override { NativeSetter::setArrayBuffer(name, arrayBuffer); }
    void setBuffer(const ccstd::string &name, gfx::Buffer *buffer) override { NativeSetter::setBuffer(name, buffer); }
    void setBuiltinCameraConstants(const scene::Camera *camera) override { NativeSetter::setBuiltinCameraConstants(camera); }
    void setBuiltinDirectionalLightConstants(const scene::DirectionalLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinDirectionalLightConstants(light, camera); }
    void setBuiltinDirectionalLightFrustumConstants(const scene::Camera *camera, const scene::DirectionalLight *light, uint32_t csmLevel) override { NativeSetter::setBuiltinDirectionalLightFrustumConstants(camera, light, csmLevel); }
    void setBuiltinPointLightConstants(const scene::PointLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinPointLightConstants(light, camera); }
    void setBuiltinRangedDirectionalLightConstants(const scene::RangedDirectionalLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinRangedDirectionalLightConstants(light, camera); }
    void setBuiltinSphereLightConstants(const scene::SphereLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinSphereLightConstants(light, camera); }
    void setBuiltinSpotLightConstants(const scene::SpotLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinSpotLightConstants(light, camera); }
    void setBuiltinSpotLightFrustumConstants(const scene::SpotLight *light) override { NativeSetter::setBuiltinSpotLightFrustumConstants(light); }
    void setColor(const ccstd::string &name, const gfx::Color &color) override { NativeSetter::setColor(name, color); }
    void setCustomBehavior(const ccstd::string &name) override { NativeSetter::setCustomBehavior(name); }
    void setCustomShaderStages(const ccstd::string &name, gfx::ShaderStageFlagBit stageFlags) override;
    void setFloat(const ccstd::string &name, float v) override { NativeSetter::setFloat(name, v); }
    void setMat4(const ccstd::string &name, const Mat4 &mat) override { NativeSetter::setMat4(name, mat); }
    void setName(const ccstd::string &name) override { NativeSetter::setName(name); }
    void setQuaternion(const ccstd::string &name, const Quaternion &quat) override { NativeSetter::setQuaternion(name, quat); }
    void setSampler(const ccstd::string &name, gfx::Sampler *sampler) override { NativeSetter::setSampler(name, sampler); }
    void setShowStatistics(bool enable) override;
    void setTexture(const ccstd::string &name, gfx::Texture *texture) override { NativeSetter::setTexture(name, texture); }
    void setVec2(const ccstd::string &name, const Vec2 &vec) override { NativeSetter::setVec2(name, vec); }
    void setVec4(const ccstd::string &name, const Vec4 &vec) override { NativeSetter::setVec4(name, vec); }
    void setVersion(const ccstd::string &name, uint64_t version) override;
    void setViewport(const gfx::Viewport &viewport) override;
};

class NativeMultisampleRenderPassBuilder final : public MultisampleRenderPassBuilder, public NativeSetter {
public:
    NativeMultisampleRenderPassBuilder(const PipelineRuntime* pipelineRuntimeIn, RenderGraph* renderGraphIn, RenderGraph::vertex_descriptor nodeIDIn, const LayoutGraphData* layoutGraphIn, LayoutGraphData::vertex_descriptor layoutIDIn, RenderGraph::vertex_descriptor subpassIDIn, LayoutGraphData::vertex_descriptor subpassLayoutIDIn) noexcept
    : NativeSetter(pipelineRuntimeIn, renderGraphIn, nodeIDIn, layoutGraphIn, layoutIDIn),
      subpassID(subpassIDIn),
      subpassLayoutID(subpassLayoutIDIn) {}

    void addDepthStencil(const ccstd::string &name, gfx::LoadOp loadOp, gfx::StoreOp storeOp, float depth, uint8_t stencil, gfx::ClearFlagBit clearFlags) override;
    RenderQueueBuilder *addQueue(QueueHint hint, const ccstd::string &phaseName, const ccstd::string &passName) override;
    void addRenderTarget(const ccstd::string &name, gfx::LoadOp loadOp, gfx::StoreOp storeOp, const gfx::Color &color) override;
    void addStorageBuffer(const ccstd::string &name, AccessType accessType, const ccstd::string &slotName) override;
    void addStorageImage(const ccstd::string &name, AccessType accessType, const ccstd::string &slotName) override;
    void addTexture(const ccstd::string &name, const ccstd::string &slotName, gfx::Sampler *sampler, uint32_t plane) override;
    ccstd::string getName() const override { return NativeSetter::getName(); }
    bool getShowStatistics() const override;
    void resolveDepthStencil(const ccstd::string &source, const ccstd::string &target, gfx::ResolveMode depthMode, gfx::ResolveMode stencilMode) override;
    void resolveRenderTarget(const ccstd::string &source, const ccstd::string &target) override;
    void setArrayBuffer(const ccstd::string &name, const ArrayBuffer *arrayBuffer) override { NativeSetter::setArrayBuffer(name, arrayBuffer); }
    void setBuffer(const ccstd::string &name, gfx::Buffer *buffer) override { NativeSetter::setBuffer(name, buffer); }
    void setBuiltinCameraConstants(const scene::Camera *camera) override { NativeSetter::setBuiltinCameraConstants(camera); }
    void setBuiltinDirectionalLightConstants(const scene::DirectionalLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinDirectionalLightConstants(light, camera); }
    void setBuiltinDirectionalLightFrustumConstants(const scene::Camera *camera, const scene::DirectionalLight *light, uint32_t csmLevel) override { NativeSetter::setBuiltinDirectionalLightFrustumConstants(camera, light, csmLevel); }
    void setBuiltinPointLightConstants(const scene::PointLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinPointLightConstants(light, camera); }
    void setBuiltinRangedDirectionalLightConstants(const scene::RangedDirectionalLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinRangedDirectionalLightConstants(light, camera); }
    void setBuiltinSphereLightConstants(const scene::SphereLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinSphereLightConstants(light, camera); }
    void setBuiltinSpotLightConstants(const scene::SpotLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinSpotLightConstants(light, camera); }
    void setBuiltinSpotLightFrustumConstants(const scene::SpotLight *light) override { NativeSetter::setBuiltinSpotLightFrustumConstants(light); }
    void setColor(const ccstd::string &name, const gfx::Color &color) override { NativeSetter::setColor(name, color); }
    void setCustomBehavior(const ccstd::string &name) override { NativeSetter::setCustomBehavior(name); }
    void setFloat(const ccstd::string &name, float v) override { NativeSetter::setFloat(name, v); }
    void setMat4(const ccstd::string &name, const Mat4 &mat) override { NativeSetter::setMat4(name, mat); }
    void setName(const ccstd::string &name) override { NativeSetter::setName(name); }
    void setQuaternion(const ccstd::string &name, const Quaternion &quat) override { NativeSetter::setQuaternion(name, quat); }
    void setSampler(const ccstd::string &name, gfx::Sampler *sampler) override { NativeSetter::setSampler(name, sampler); }
    void setShowStatistics(bool enable) override;
    void setTexture(const ccstd::string &name, gfx::Texture *texture) override { NativeSetter::setTexture(name, texture); }
    void setVec2(const ccstd::string &name, const Vec2 &vec) override { NativeSetter::setVec2(name, vec); }
    void setVec4(const ccstd::string &name, const Vec4 &vec) override { NativeSetter::setVec4(name, vec); }
    void setVersion(const ccstd::string &name, uint64_t version) override;
    void setViewport(const gfx::Viewport &viewport) override;
    RenderGraph::vertex_descriptor subpassID{0xFFFFFFFF};
    LayoutGraphData::vertex_descriptor subpassLayoutID{0xFFFFFFFF};
};

class NativeComputeQueueBuilder final : public ComputeQueueBuilder, public NativeSetter {
public:
    NativeComputeQueueBuilder(const PipelineRuntime* pipelineRuntimeIn, RenderGraph* renderGraphIn, RenderGraph::vertex_descriptor nodeIDIn, const LayoutGraphData* layoutGraphIn, LayoutGraphData::vertex_descriptor layoutIDIn) noexcept
    : NativeSetter(pipelineRuntimeIn, renderGraphIn, nodeIDIn, layoutGraphIn, layoutIDIn) {}

    void addDispatch(uint32_t threadGroupCountX, uint32_t threadGroupCountY, uint32_t threadGroupCountZ, Material *material, uint32_t passID) override;
    ccstd::string getName() const override { return NativeSetter::getName(); }
    void setArrayBuffer(const ccstd::string &name, const ArrayBuffer *arrayBuffer) override { NativeSetter::setArrayBuffer(name, arrayBuffer); }
    void setBuffer(const ccstd::string &name, gfx::Buffer *buffer) override { NativeSetter::setBuffer(name, buffer); }
    void setBuiltinCameraConstants(const scene::Camera *camera) override { NativeSetter::setBuiltinCameraConstants(camera); }
    void setBuiltinDirectionalLightConstants(const scene::DirectionalLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinDirectionalLightConstants(light, camera); }
    void setBuiltinDirectionalLightFrustumConstants(const scene::Camera *camera, const scene::DirectionalLight *light, uint32_t csmLevel) override { NativeSetter::setBuiltinDirectionalLightFrustumConstants(camera, light, csmLevel); }
    void setBuiltinPointLightConstants(const scene::PointLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinPointLightConstants(light, camera); }
    void setBuiltinRangedDirectionalLightConstants(const scene::RangedDirectionalLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinRangedDirectionalLightConstants(light, camera); }
    void setBuiltinSphereLightConstants(const scene::SphereLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinSphereLightConstants(light, camera); }
    void setBuiltinSpotLightConstants(const scene::SpotLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinSpotLightConstants(light, camera); }
    void setBuiltinSpotLightFrustumConstants(const scene::SpotLight *light) override { NativeSetter::setBuiltinSpotLightFrustumConstants(light); }
    void setColor(const ccstd::string &name, const gfx::Color &color) override { NativeSetter::setColor(name, color); }
    void setCustomBehavior(const ccstd::string &name) override { NativeSetter::setCustomBehavior(name); }
    void setFloat(const ccstd::string &name, float v) override { NativeSetter::setFloat(name, v); }
    void setMat4(const ccstd::string &name, const Mat4 &mat) override { NativeSetter::setMat4(name, mat); }
    void setName(const ccstd::string &name) override { NativeSetter::setName(name); }
    void setQuaternion(const ccstd::string &name, const Quaternion &quat) override { NativeSetter::setQuaternion(name, quat); }
    void setSampler(const ccstd::string &name, gfx::Sampler *sampler) override { NativeSetter::setSampler(name, sampler); }
    void setTexture(const ccstd::string &name, gfx::Texture *texture) override { NativeSetter::setTexture(name, texture); }
    void setVec2(const ccstd::string &name, const Vec2 &vec) override { NativeSetter::setVec2(name, vec); }
    void setVec4(const ccstd::string &name, const Vec4 &vec) override { NativeSetter::setVec4(name, vec); }
};

class NativeComputePassBuilder final : public ComputePassBuilder, public NativeSetter {
public:
    NativeComputePassBuilder(const PipelineRuntime* pipelineRuntimeIn, RenderGraph* renderGraphIn, RenderGraph::vertex_descriptor nodeIDIn, const LayoutGraphData* layoutGraphIn, LayoutGraphData::vertex_descriptor layoutIDIn) noexcept
    : NativeSetter(pipelineRuntimeIn, renderGraphIn, nodeIDIn, layoutGraphIn, layoutIDIn) {}

    void addMaterialTexture(const ccstd::string &resourceName, gfx::ShaderStageFlagBit flags) override;
    ComputeQueueBuilder *addQueue(const ccstd::string &phaseName, const ccstd::string &passName) override;
    void addStorageBuffer(const ccstd::string &name, AccessType accessType, const ccstd::string &slotName) override;
    void addStorageImage(const ccstd::string &name, AccessType accessType, const ccstd::string &slotName) override;
    void addTexture(const ccstd::string &name, const ccstd::string &slotName, gfx::Sampler *sampler, uint32_t plane) override;
    ccstd::string getName() const override { return NativeSetter::getName(); }
    void setArrayBuffer(const ccstd::string &name, const ArrayBuffer *arrayBuffer) override { NativeSetter::setArrayBuffer(name, arrayBuffer); }
    void setBuffer(const ccstd::string &name, gfx::Buffer *buffer) override { NativeSetter::setBuffer(name, buffer); }
    void setBuiltinCameraConstants(const scene::Camera *camera) override { NativeSetter::setBuiltinCameraConstants(camera); }
    void setBuiltinDirectionalLightConstants(const scene::DirectionalLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinDirectionalLightConstants(light, camera); }
    void setBuiltinDirectionalLightFrustumConstants(const scene::Camera *camera, const scene::DirectionalLight *light, uint32_t csmLevel) override { NativeSetter::setBuiltinDirectionalLightFrustumConstants(camera, light, csmLevel); }
    void setBuiltinPointLightConstants(const scene::PointLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinPointLightConstants(light, camera); }
    void setBuiltinRangedDirectionalLightConstants(const scene::RangedDirectionalLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinRangedDirectionalLightConstants(light, camera); }
    void setBuiltinSphereLightConstants(const scene::SphereLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinSphereLightConstants(light, camera); }
    void setBuiltinSpotLightConstants(const scene::SpotLight *light, const scene::Camera *camera) override { NativeSetter::setBuiltinSpotLightConstants(light, camera); }
    void setBuiltinSpotLightFrustumConstants(const scene::SpotLight *light) override { NativeSetter::setBuiltinSpotLightFrustumConstants(light); }
    void setColor(const ccstd::string &name, const gfx::Color &color) override { NativeSetter::setColor(name, color); }
    void setCustomBehavior(const ccstd::string &name) override { NativeSetter::setCustomBehavior(name); }
    void setCustomShaderStages(const ccstd::string &name, gfx::ShaderStageFlagBit stageFlags) override;
    void setFloat(const ccstd::string &name, float v) override { NativeSetter::setFloat(name, v); }
    void setMat4(const ccstd::string &name, const Mat4 &mat) override { NativeSetter::setMat4(name, mat); }
    void setName(const ccstd::string &name) override { NativeSetter::setName(name); }
    void setQuaternion(const ccstd::string &name, const Quaternion &quat) override { NativeSetter::setQuaternion(name, quat); }
    void setSampler(const ccstd::string &name, gfx::Sampler *sampler) override { NativeSetter::setSampler(name, sampler); }
    void setTexture(const ccstd::string &name, gfx::Texture *texture) override { NativeSetter::setTexture(name, texture); }
    void setVec2(const ccstd::string &name, const Vec2 &vec) override { NativeSetter::setVec2(name, vec); }
    void setVec4(const ccstd::string &name, const Vec4 &vec) override { NativeSetter::setVec4(name, vec); }
};

struct DrawInstance {
    const scene::SubModel *subModel{nullptr};
    uint32_t priority{0};
    uint32_t hash{0};
    float depth{0};
    uint32_t shaderID{0};
    uint32_t passIndex{0};
};

struct ProbeHelperQueue {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {probeMap.get_allocator().resource()};
    }

    ProbeHelperQueue(const allocator_type& alloc); // NOLINT
    ProbeHelperQueue(ProbeHelperQueue&& rhs, const allocator_type& alloc);
    ProbeHelperQueue(ProbeHelperQueue const& rhs, const allocator_type& alloc);

    ProbeHelperQueue(ProbeHelperQueue&& rhs) noexcept = default;
    ProbeHelperQueue(ProbeHelperQueue const& rhs) = delete;
    ProbeHelperQueue& operator=(ProbeHelperQueue&& rhs) noexcept = default;
    ProbeHelperQueue& operator=(ProbeHelperQueue const& rhs) = default;

    static LayoutGraphData::vertex_descriptor getDefaultId(const LayoutGraphData &lg);
    void clear() noexcept {
        return probeMap.clear();
    }
    void removeMacro() const;
    static int32_t getPassIndexFromLayout(const IntrusivePtr<scene::SubModel> &subModel, LayoutGraphData::vertex_descriptor phaseLayoutId);
    void applyMacro(const LayoutGraphData &lg, const scene::Model &model, LayoutGraphData::vertex_descriptor probeLayoutId);

    ccstd::pmr::vector<scene::SubModel*> probeMap;
};

struct RenderInstancingQueue {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {sortedBatches.get_allocator().resource()};
    }

    RenderInstancingQueue(const allocator_type& alloc); // NOLINT
    RenderInstancingQueue(RenderInstancingQueue&& rhs, const allocator_type& alloc);
    RenderInstancingQueue(RenderInstancingQueue const& rhs, const allocator_type& alloc);

    RenderInstancingQueue(RenderInstancingQueue&& rhs) noexcept = default;
    RenderInstancingQueue(RenderInstancingQueue const& rhs) = delete;
    RenderInstancingQueue& operator=(RenderInstancingQueue&& rhs) noexcept = default;
    RenderInstancingQueue& operator=(RenderInstancingQueue const& rhs) = default;

    bool empty() const noexcept;
    void clear();
    void add(const scene::Pass &pass, scene::SubModel &submodel, uint32_t passID);
    void sort();
    void uploadBuffers(gfx::CommandBuffer *cmdBuffer) const;
    void recordCommandBuffer(gfx::RenderPass *renderPass, uint32_t subpassIndex, gfx::CommandBuffer *cmdBuffer, uint32_t lightByteOffset = 0xFFFFFFFF) const;

    ccstd::pmr::vector<pipeline::InstancedBuffer*> sortedBatches;
    PmrUnorderedMap<const scene::Pass*, uint32_t> passInstances;
    ccstd::pmr::vector<IntrusivePtr<pipeline::InstancedBuffer>> instanceBuffers;
};

struct RenderDrawQueue {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {instances.get_allocator().resource()};
    }

    RenderDrawQueue(const allocator_type& alloc); // NOLINT
    RenderDrawQueue(RenderDrawQueue&& rhs, const allocator_type& alloc);
    RenderDrawQueue(RenderDrawQueue const& rhs, const allocator_type& alloc);

    RenderDrawQueue(RenderDrawQueue&& rhs) noexcept = default;
    RenderDrawQueue(RenderDrawQueue const& rhs) = delete;
    RenderDrawQueue& operator=(RenderDrawQueue&& rhs) noexcept = default;
    RenderDrawQueue& operator=(RenderDrawQueue const& rhs) = default;

    void add(const scene::Model &model, float depth, uint32_t subModelIdx, uint32_t passIdx);
    void sortOpaqueOrCutout();
    void sortTransparent();
    void recordCommandBuffer(gfx::RenderPass *renderPass, uint32_t subpassIndex, gfx::CommandBuffer *cmdBuffer, uint32_t lightByteOffset = 0xFFFFFFFF) const;

    ccstd::pmr::vector<DrawInstance> instances;
};

struct NativeRenderQueue {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {opaqueQueue.get_allocator().resource()};
    }

    NativeRenderQueue(const allocator_type& alloc); // NOLINT
    NativeRenderQueue(NativeRenderQueue&& rhs, const allocator_type& alloc);

    NativeRenderQueue(NativeRenderQueue&& rhs) noexcept = default;
    NativeRenderQueue(NativeRenderQueue const& rhs) = delete;
    NativeRenderQueue& operator=(NativeRenderQueue&& rhs) noexcept = default;
    NativeRenderQueue& operator=(NativeRenderQueue const& rhs) = delete;

    void sort();
    void clear() noexcept;
    bool empty() const noexcept;
    void recordCommands(gfx::CommandBuffer *cmdBuffer, gfx::RenderPass *renderPass, uint32_t subpassIndex, SceneFlags sceneFlags) const;

    RenderDrawQueue opaqueQueue;
    RenderDrawQueue transparentQueue;
    ProbeHelperQueue probeQueue;
    RenderInstancingQueue opaqueInstancingQueue;
    RenderInstancingQueue transparentInstancingQueue;
    const scene::Camera *camera{nullptr};
    SceneFlags sceneFlags{SceneFlags::NONE};
    uint32_t lightByteOffset{0xFFFFFFFF};
};

struct ResourceGroup {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {instancingBuffers.get_allocator().resource()};
    }

    ResourceGroup(const allocator_type& alloc); // NOLINT
    ResourceGroup(ResourceGroup&&) = delete;
    ResourceGroup(const ResourceGroup&) = delete;
    ResourceGroup& operator=(ResourceGroup&&) = delete;
    ResourceGroup& operator=(const ResourceGroup&) = delete;

    ~ResourceGroup() noexcept;
    PmrUnorderedSet<IntrusivePtr<pipeline::InstancedBuffer>> instancingBuffers;
};

struct BufferPool {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {currentBuffers.get_allocator().resource()};
    }

    BufferPool(const allocator_type& alloc); // NOLINT
    BufferPool(gfx::Device* deviceIn, uint32_t bufferSizeIn, bool dynamicIn, const allocator_type& alloc);
    BufferPool(BufferPool&& rhs, const allocator_type& alloc);

    BufferPool(BufferPool&& rhs) noexcept = default;
    BufferPool(BufferPool const& rhs) = delete;
    BufferPool& operator=(BufferPool&& rhs) noexcept = default;
    BufferPool& operator=(BufferPool const& rhs) = delete;

    void init(gfx::Device *deviceIn, uint32_t sz, bool bDynamic);
    void syncResources();
    gfx::Buffer *allocateBuffer();

    gfx::Device *device{nullptr};
    uint32_t bufferSize{0};
    bool dynamic{false};
    ccstd::pmr::vector<IntrusivePtr<gfx::Buffer>> currentBuffers;
    ccstd::pmr::vector<IntrusivePtr<gfx::Buffer>> currentBufferViews;
    ccstd::pmr::vector<IntrusivePtr<gfx::Buffer>> freeBuffers;
    ccstd::pmr::vector<IntrusivePtr<gfx::Buffer>> freeBufferViews;
};

struct DescriptorSetPool {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {currentDescriptorSets.get_allocator().resource()};
    }

    DescriptorSetPool(const allocator_type& alloc); // NOLINT
    DescriptorSetPool(gfx::Device* deviceIn, IntrusivePtr<gfx::DescriptorSetLayout> setLayoutIn, const allocator_type& alloc);
    DescriptorSetPool(DescriptorSetPool&& rhs, const allocator_type& alloc);

    DescriptorSetPool(DescriptorSetPool&& rhs) noexcept = default;
    DescriptorSetPool(DescriptorSetPool const& rhs) = delete;
    DescriptorSetPool& operator=(DescriptorSetPool&& rhs) noexcept = default;
    DescriptorSetPool& operator=(DescriptorSetPool const& rhs) = delete;

    void init(gfx::Device *deviceIn, IntrusivePtr<gfx::DescriptorSetLayout> layout);
    void syncDescriptorSets();
    const gfx::DescriptorSet &getCurrentDescriptorSet() const;
    gfx::DescriptorSet &getCurrentDescriptorSet();
    gfx::DescriptorSet *allocateDescriptorSet();

    gfx::Device *device{nullptr};
    IntrusivePtr<gfx::DescriptorSetLayout> setLayout;
    ccstd::pmr::vector<IntrusivePtr<gfx::DescriptorSet>> currentDescriptorSets;
    ccstd::pmr::vector<IntrusivePtr<gfx::DescriptorSet>> freeDescriptorSets;
};

struct UniformBlockResource {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {cpuBuffer.get_allocator().resource()};
    }

    UniformBlockResource(const allocator_type& alloc); // NOLINT
    UniformBlockResource(UniformBlockResource&& rhs, const allocator_type& alloc);

    UniformBlockResource(UniformBlockResource&& rhs) noexcept = default;
    UniformBlockResource(UniformBlockResource const& rhs) = delete;
    UniformBlockResource& operator=(UniformBlockResource&& rhs) noexcept = default;
    UniformBlockResource& operator=(UniformBlockResource const& rhs) = delete;

    void init(gfx::Device *deviceIn, uint32_t sz, bool bDynamic);
    gfx::Buffer *createFromCpuBuffer();

    ccstd::pmr::vector<char> cpuBuffer;
    BufferPool bufferPool;
};

struct ProgramResource {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {uniformBuffers.get_allocator().resource()};
    }

    ProgramResource(const allocator_type& alloc); // NOLINT
    ProgramResource(ProgramResource&& rhs, const allocator_type& alloc);

    ProgramResource(ProgramResource&& rhs) noexcept = default;
    ProgramResource(ProgramResource const& rhs) = delete;
    ProgramResource& operator=(ProgramResource&& rhs) noexcept = default;
    ProgramResource& operator=(ProgramResource const& rhs) = delete;

    void syncResources() noexcept;

    ccstd::pmr::unordered_map<NameLocalID, UniformBlockResource> uniformBuffers;
    DescriptorSetPool descriptorSetPool;
};

struct LayoutGraphNodeResource {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {uniformBuffers.get_allocator().resource()};
    }

    LayoutGraphNodeResource(const allocator_type& alloc); // NOLINT
    LayoutGraphNodeResource(LayoutGraphNodeResource&& rhs, const allocator_type& alloc);

    LayoutGraphNodeResource(LayoutGraphNodeResource&& rhs) noexcept = default;
    LayoutGraphNodeResource(LayoutGraphNodeResource const& rhs) = delete;
    LayoutGraphNodeResource& operator=(LayoutGraphNodeResource&& rhs) noexcept = default;
    LayoutGraphNodeResource& operator=(LayoutGraphNodeResource const& rhs) = delete;

    void syncResources() noexcept;

    ccstd::pmr::unordered_map<NameLocalID, UniformBlockResource> uniformBuffers;
    DescriptorSetPool descriptorSetPool;
    PmrTransparentMap<ccstd::pmr::string, ProgramResource> programResources;
};

struct QuadResource {
    QuadResource() = default;
    QuadResource(IntrusivePtr<gfx::Buffer> quadVBIn, IntrusivePtr<gfx::Buffer> quadIBIn, IntrusivePtr<gfx::InputAssembler> quadIAIn)
    : quadVB(std::move(quadVBIn)),
      quadIB(std::move(quadIBIn)),
      quadIA(std::move(quadIAIn)) {}

    IntrusivePtr<gfx::Buffer> quadVB;
    IntrusivePtr<gfx::Buffer> quadIB;
    IntrusivePtr<gfx::InputAssembler> quadIA;
};

struct FrustumCullingKey {
    const scene::Camera *camera{nullptr};
    const scene::ReflectionProbe *probe{nullptr};
    const scene::Light *light{nullptr};
    uint32_t lightLevel{0xFFFFFFFF};
    bool castShadow{false};
    bool probePass{false};
};

inline bool operator==(const FrustumCullingKey& lhs, const FrustumCullingKey& rhs) noexcept {
    return std::forward_as_tuple(lhs.camera, lhs.probe, lhs.light, lhs.lightLevel, lhs.castShadow, lhs.probePass) ==
           std::forward_as_tuple(rhs.camera, rhs.probe, rhs.light, rhs.lightLevel, rhs.castShadow, rhs.probePass);
}

inline bool operator!=(const FrustumCullingKey& lhs, const FrustumCullingKey& rhs) noexcept {
    return !(lhs == rhs);
}

struct FrustumCullingID {
    explicit operator uint32_t() const {
        return value;
    }

    uint32_t value{0xFFFFFFFF};
};

inline bool operator==(const FrustumCullingID& lhs, const FrustumCullingID& rhs) noexcept {
    return std::forward_as_tuple(lhs.value) ==
           std::forward_as_tuple(rhs.value);
}

inline bool operator!=(const FrustumCullingID& lhs, const FrustumCullingID& rhs) noexcept {
    return !(lhs == rhs);
}

struct FrustumCulling {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {resultIndex.get_allocator().resource()};
    }

    FrustumCulling(const allocator_type& alloc); // NOLINT
    FrustumCulling(FrustumCulling&& rhs, const allocator_type& alloc);
    FrustumCulling(FrustumCulling const& rhs, const allocator_type& alloc);

    FrustumCulling(FrustumCulling&& rhs) noexcept = default;
    FrustumCulling(FrustumCulling const& rhs) = delete;
    FrustumCulling& operator=(FrustumCulling&& rhs) noexcept = default;
    FrustumCulling& operator=(FrustumCulling const& rhs) = default;

    ccstd::pmr::unordered_map<FrustumCullingKey, FrustumCullingID> resultIndex;
};

struct LightBoundsCullingID {
    explicit operator uint32_t() const {
        return value;
    }

    uint32_t value{0xFFFFFFFF};
};

inline bool operator==(const LightBoundsCullingID& lhs, const LightBoundsCullingID& rhs) noexcept {
    return std::forward_as_tuple(lhs.value) ==
           std::forward_as_tuple(rhs.value);
}

inline bool operator!=(const LightBoundsCullingID& lhs, const LightBoundsCullingID& rhs) noexcept {
    return !(lhs == rhs);
}

struct LightBoundsCullingKey {
    FrustumCullingID frustumCullingID;
    const scene::Camera *camera{nullptr};
    const scene::ReflectionProbe *probe{nullptr};
    const scene::Light *cullingLight{nullptr};
};

inline bool operator==(const LightBoundsCullingKey& lhs, const LightBoundsCullingKey& rhs) noexcept {
    return std::forward_as_tuple(lhs.frustumCullingID, lhs.camera, lhs.probe, lhs.cullingLight) ==
           std::forward_as_tuple(rhs.frustumCullingID, rhs.camera, rhs.probe, rhs.cullingLight);
}

inline bool operator!=(const LightBoundsCullingKey& lhs, const LightBoundsCullingKey& rhs) noexcept {
    return !(lhs == rhs);
}

struct LightBoundsCulling {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {resultIndex.get_allocator().resource()};
    }

    LightBoundsCulling(const allocator_type& alloc); // NOLINT
    LightBoundsCulling(LightBoundsCulling&& rhs, const allocator_type& alloc);
    LightBoundsCulling(LightBoundsCulling const& rhs, const allocator_type& alloc);

    LightBoundsCulling(LightBoundsCulling&& rhs) noexcept = default;
    LightBoundsCulling(LightBoundsCulling const& rhs) = delete;
    LightBoundsCulling& operator=(LightBoundsCulling&& rhs) noexcept = default;
    LightBoundsCulling& operator=(LightBoundsCulling const& rhs) = default;

    ccstd::pmr::unordered_map<LightBoundsCullingKey, LightBoundsCullingID> resultIndex;
};

struct NativeRenderQueueID {
    explicit operator uint32_t() const {
        return value;
    }

    uint32_t value{0xFFFFFFFF};
};

struct NativeRenderQueueKey {
    FrustumCullingID frustumCulledResultID;
    LightBoundsCullingID lightBoundsCulledResultID;
    uint32_t queueLayoutID{0xFFFFFFFF};
};

inline bool operator==(const NativeRenderQueueKey& lhs, const NativeRenderQueueKey& rhs) noexcept {
    return std::forward_as_tuple(lhs.frustumCulledResultID, lhs.lightBoundsCulledResultID, lhs.queueLayoutID) ==
           std::forward_as_tuple(rhs.frustumCulledResultID, rhs.lightBoundsCulledResultID, rhs.queueLayoutID);
}

inline bool operator!=(const NativeRenderQueueKey& lhs, const NativeRenderQueueKey& rhs) noexcept {
    return !(lhs == rhs);
}

struct NativeRenderQueueQuery {
    FrustumCullingID frustumCulledResultID;
    LightBoundsCullingID lightBoundsCulledResultID;
    NativeRenderQueueID renderQueueTarget;
};

struct LightBoundsCullingResult {
    ccstd::vector<const scene::Model*> instances;
    uint32_t lightByteOffset{0xFFFFFFFF};
};

struct SceneCulling {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {frustumCullings.get_allocator().resource()};
    }

    SceneCulling(const allocator_type& alloc); // NOLINT
    SceneCulling(SceneCulling&& rhs, const allocator_type& alloc);

    SceneCulling(SceneCulling&& rhs) noexcept = default;
    SceneCulling(SceneCulling const& rhs) = delete;
    SceneCulling& operator=(SceneCulling&& rhs) noexcept = default;
    SceneCulling& operator=(SceneCulling const& rhs) = delete;

    void clear() noexcept;
    void buildRenderQueues(const RenderGraph &rg, const LayoutGraphData &lg, const NativePipeline &ppl);
private:
    FrustumCullingID getOrCreateFrustumCulling(const SceneData &sceneData);
    LightBoundsCullingID getOrCreateLightBoundsCulling(const SceneData &sceneData, FrustumCullingID frustumCullingID);
    NativeRenderQueueID getOrCreateRenderQueue(const NativeRenderQueueKey &key, SceneFlags flags, const scene::Camera *camera);
    void collectCullingQueries(const RenderGraph &rg);
    void batchFrustumCulling(const NativePipeline &ppl);
    void batchLightBoundsCulling();
    void fillRenderQueues();

public:
    ccstd::pmr::unordered_map<const scene::RenderScene*, FrustumCulling> frustumCullings;
    ccstd::pmr::vector<ccstd::vector<const scene::Model*>> frustumCullingResults;
    ccstd::pmr::unordered_map<const scene::RenderScene*, LightBoundsCulling> lightBoundsCullings;
    ccstd::pmr::vector<LightBoundsCullingResult> lightBoundsCullingResults;
    ccstd::pmr::unordered_map<NativeRenderQueueKey, NativeRenderQueueID> renderQueueIndex;
    ccstd::pmr::vector<NativeRenderQueue> renderQueues;
    PmrFlatMap<RenderGraph::vertex_descriptor, NativeRenderQueueQuery> renderQueueQueryIndex;
    uint32_t numFrustumCulling{0};
    uint32_t numLightBoundsCulling{0};
    uint32_t numRenderQueues{0};
    RenderGraph::vertex_descriptor gpuCullingPassID{0xFFFFFFFF};
    bool enableLightCulling{true};
};

struct LightResource {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {cpuBuffer.get_allocator().resource()};
    }

    LightResource(const allocator_type& alloc); // NOLINT
    LightResource(LightResource&&) = delete;
    LightResource(const LightResource&) = delete;
    LightResource& operator=(LightResource&&) = delete;
    LightResource& operator=(const LightResource&) = delete;

    void init(const NativeProgramLibrary &programLib, gfx::Device *deviceIn, uint32_t maxNumLights);
    void buildLights(SceneCulling &sceneCulling, bool bHDR, const scene::Shadows *shadowInfo);
    void tryUpdateRenderSceneLocalDescriptorSet(const SceneCulling &sceneCulling);
    void clear();
    uint32_t addLight(const scene::Light *light, bool bHDR, float exposure, const scene::Shadows *shadowInfo);
    void buildLightBuffer(gfx::CommandBuffer *cmdBuffer) const;

    ccstd::pmr::vector<char> cpuBuffer;
    const NativeProgramLibrary *programLibrary{nullptr};
    gfx::Device *device{nullptr};
    uint32_t elementSize{0};
    uint32_t maxNumLights{16};
    uint32_t binding{0xFFFFFFFF};
    bool resized{false};
    IntrusivePtr<gfx::Buffer> lightBuffer;
    IntrusivePtr<gfx::Buffer> firstLightBufferView;
    ccstd::pmr::vector<const scene::Light*> lights;
    PmrFlatMap<const scene::Light*, uint32_t> lightIndex;
};

struct DescriptorSetKey {
    DescriptorSetKey(uint32_t nodeIDIn, UpdateFrequency frequencyIn) noexcept
    : nodeID(nodeIDIn),
      frequency(frequencyIn) {}

    uint32_t nodeID{0xFFFFFFFF};
    UpdateFrequency frequency{UpdateFrequency::PER_INSTANCE};
};

inline bool operator==(const DescriptorSetKey& lhs, const DescriptorSetKey& rhs) noexcept {
    return std::forward_as_tuple(lhs.nodeID, lhs.frequency) ==
           std::forward_as_tuple(rhs.nodeID, rhs.frequency);
}

inline bool operator!=(const DescriptorSetKey& lhs, const DescriptorSetKey& rhs) noexcept {
    return !(lhs == rhs);
}

inline bool operator<(const DescriptorSetKey& lhs, const DescriptorSetKey& rhs) noexcept {
    return std::forward_as_tuple(lhs.nodeID, lhs.frequency) <
           std::forward_as_tuple(rhs.nodeID, rhs.frequency);
}

struct DescriptorSetContext {
    DescriptorSetContext() = default;
    DescriptorSetContext(IntrusivePtr<gfx::DescriptorSet> descriptorSetIn) // NOLINT(google-explicit-constructor)
    : descriptorSet(std::move(descriptorSetIn)) {}

    DescriptorSetContext(DescriptorSetContext&& rhs) = default;
    DescriptorSetContext(DescriptorSetContext const& rhs) = delete;
    DescriptorSetContext& operator=(DescriptorSetContext&& rhs) = default;
    DescriptorSetContext& operator=(DescriptorSetContext const& rhs) = delete;

    IntrusivePtr<gfx::DescriptorSet> descriptorSet;
};

struct TextureWithAccessFlags {
    IntrusivePtr<gfx::Texture> texture;
    gfx::AccessFlagBit accessFlags{gfx::AccessFlagBit::NONE};
};

struct DeviceRenderData {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {buffers.get_allocator().resource()};
    }

    DeviceRenderData(const allocator_type& alloc); // NOLINT
    DeviceRenderData(DeviceRenderData&& rhs, const allocator_type& alloc);

    DeviceRenderData(DeviceRenderData&& rhs) noexcept = default;
    DeviceRenderData(DeviceRenderData const& rhs) = delete;
    DeviceRenderData& operator=(DeviceRenderData&& rhs) noexcept = default;
    DeviceRenderData& operator=(DeviceRenderData const& rhs) = delete;

    void clear() noexcept {
        hasConstants = false;
        required = false;
        buffers.clear();
        textures.clear();
        samplers.clear();
    }
    bool hasNoData() const noexcept {
        return !hasConstants && buffers.empty() && textures.empty() && samplers.empty();
    }

    bool hasConstants{false};
    bool required{false};
    PmrFlatMap<NameLocalID, IntrusivePtr<gfx::Buffer>> buffers;
    PmrFlatMap<NameLocalID, TextureWithAccessFlags> textures;
    PmrFlatMap<NameLocalID, gfx::Sampler*> samplers;
};

struct NativeRenderContext {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {resourceGroups.get_allocator().resource()};
    }

    NativeRenderContext(std::unique_ptr<gfx::DefaultResource> defaultResourceIn, const allocator_type& alloc);
    NativeRenderContext(NativeRenderContext&&) = delete;
    NativeRenderContext(const NativeRenderContext&) = delete;
    NativeRenderContext& operator=(NativeRenderContext&&) = delete;
    NativeRenderContext& operator=(const NativeRenderContext&) = delete;

    void clearPreviousResources(uint64_t finishedFenceValue) noexcept;

    std::unique_ptr<gfx::DefaultResource> defaultResource;
    uint64_t nextFenceValue{0ULL};
    ccstd::pmr::map<uint64_t, ResourceGroup> resourceGroups;
    ccstd::pmr::vector<LayoutGraphNodeResource> layoutGraphResources;
    QuadResource fullscreenQuad;
    SceneCulling sceneCulling;
    LightResource lightResources;
    ccstd::pmr::unordered_map<RenderGraph::vertex_descriptor, PmrFlatMap<NameLocalID, ResourceGraph::vertex_descriptor>> resourceGraphIndex;
    ccstd::pmr::unordered_map<DescriptorSetKey, DeviceRenderData> graphNodeRenderData;
    ccstd::pmr::unordered_map<DescriptorSetKey, gfx::DescriptorSet*> graphNodeDescriptorSets;
};

class NativeProgramLibrary final : public ProgramLibrary {
public:
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {layoutGraph.get_allocator().resource()};
    }

    NativeProgramLibrary(const allocator_type& alloc); // NOLINT
    NativeProgramLibrary(NativeProgramLibrary&&) = delete;
    NativeProgramLibrary(const NativeProgramLibrary&) = delete;
    NativeProgramLibrary& operator=(NativeProgramLibrary&&) = delete;
    NativeProgramLibrary& operator=(const NativeProgramLibrary&) = delete;

    void addEffect(const EffectAsset *effectAsset) override;
    const ccstd::vector<int> &getBlockSizes(uint32_t phaseID, const ccstd::string &programName) const override;
    gfx::PipelineState *getComputePipelineState(gfx::Device *device, uint32_t phaseID, const ccstd::string &name, MacroRecord &defines, const ccstd::pmr::string *key) override;
    const ccstd::pmr::string &getDescriptorName(uint32_t nameID) override;
    uint32_t getDescriptorNameID(const ccstd::pmr::string &name) override;
    const ccstd::unordered_map<ccstd::string, uint32_t> &getHandleMap(uint32_t phaseID, const ccstd::string &programName) const override;
    ccstd::string getKey(uint32_t phaseID, const ccstd::string &programName, const MacroRecord &defines) const override;
    const gfx::DescriptorSetLayout &getLocalDescriptorSetLayout(gfx::Device *device, uint32_t phaseID, const ccstd::string &programName) override;
    const gfx::DescriptorSetLayout &getMaterialDescriptorSetLayout(gfx::Device *device, uint32_t phaseID, const ccstd::string &programName) override;
    IntrusivePtr<gfx::PipelineLayout> getPipelineLayout(gfx::Device *device, uint32_t phaseID, const ccstd::string &programName) override;
    uint32_t getProgramID(uint32_t phaseID, const ccstd::pmr::string &programName) override;
    const IProgramInfo &getProgramInfo(uint32_t phaseID, const ccstd::string &programName) const override;
    ProgramProxy *getProgramVariant(gfx::Device *device, uint32_t phaseID, const ccstd::string &name, MacroRecord &defines, const ccstd::pmr::string *key) override;
    const gfx::ShaderInfo &getShaderInfo(uint32_t phaseID, const ccstd::string &programName) const override;
    void precompileEffect(gfx::Device *device, EffectAsset *effectAsset) override;
    void init(gfx::Device *deviceIn);
    void setPipeline(PipelineRuntime *pipelineIn);
    void destroy();

    LayoutGraphData layoutGraph;
    PmrFlatMap<uint32_t, ProgramGroup> phases;
    boost::container::pmr::unsynchronized_pool_resource unsycPool;
    bool mergeHighFrequency{false};
    bool fixedLocal{true};
    DescriptorSetLayoutData localLayoutData;
    IntrusivePtr<gfx::DescriptorSetLayout> localDescriptorSetLayout;
    IntrusivePtr<gfx::DescriptorSetLayout> emptyDescriptorSetLayout;
    IntrusivePtr<gfx::PipelineLayout> emptyPipelineLayout;
    PipelineRuntime *pipeline{nullptr};
    gfx::Device *device{nullptr};
};

struct PipelineCustomization {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {contexts.get_allocator().resource()};
    }

    PipelineCustomization(const allocator_type& alloc); // NOLINT
    PipelineCustomization(PipelineCustomization&& rhs, const allocator_type& alloc);
    PipelineCustomization(PipelineCustomization const& rhs, const allocator_type& alloc);

    PipelineCustomization(PipelineCustomization&& rhs) noexcept = default;
    PipelineCustomization(PipelineCustomization const& rhs) = delete;
    PipelineCustomization& operator=(PipelineCustomization&& rhs) noexcept = default;
    PipelineCustomization& operator=(PipelineCustomization const& rhs) = default;

    std::shared_ptr<CustomPipelineContext> currentContext;
    PmrTransparentMap<ccstd::pmr::string, std::shared_ptr<CustomPipelineContext>> contexts;
    PmrTransparentMap<ccstd::pmr::string, std::shared_ptr<CustomRenderPass>> renderPasses;
    PmrTransparentMap<ccstd::pmr::string, std::shared_ptr<CustomRenderSubpass>> renderSubpasses;
    PmrTransparentMap<ccstd::pmr::string, std::shared_ptr<CustomComputeSubpass>> computeSubpasses;
    PmrTransparentMap<ccstd::pmr::string, std::shared_ptr<CustomComputePass>> computePasses;
    PmrTransparentMap<ccstd::pmr::string, std::shared_ptr<CustomRenderQueue>> renderQueues;
    PmrTransparentMap<ccstd::pmr::string, std::shared_ptr<CustomRenderCommand>> renderCommands;
};

struct BuiltinShadowTransform {
    Mat4 shadowView;
    Mat4 shadowProj;
    Mat4 shadowViewProj;
    geometry::Frustum validFrustum;
    geometry::Frustum splitFrustum;
    geometry::Frustum lightViewFrustum;
    geometry::AABB castLightViewBoundingBox;
    float shadowCameraFar{0};
    float splitCameraNear{0};
    float splitCameraFar{0};
    Vec4 csmAtlas;
};

struct BuiltinCascadedShadowMapKey {
    const scene::Camera *camera{nullptr};
    const scene::DirectionalLight *light{nullptr};
};

inline bool operator<(const BuiltinCascadedShadowMapKey& lhs, const BuiltinCascadedShadowMapKey& rhs) noexcept {
    return std::forward_as_tuple(lhs.camera, lhs.light) <
           std::forward_as_tuple(rhs.camera, rhs.light);
}

struct BuiltinCascadedShadowMap {
    std::array<BuiltinShadowTransform, 4> layers;
    BuiltinShadowTransform specialLayer;
    float shadowDistance{0};
};

class NativePipeline final : public Pipeline {
public:
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {name.get_allocator().resource()};
    }

    NativePipeline(const allocator_type& alloc) noexcept; // NOLINT
    NativePipeline(NativePipeline&&) = delete;
    NativePipeline(const NativePipeline&) = delete;
    NativePipeline& operator=(NativePipeline&&) = delete;
    NativePipeline& operator=(const NativePipeline&) = delete;

    bool activate(gfx::Swapchain *swapchain) override;
    uint32_t addBuffer(const ccstd::string &name, uint32_t size, ResourceFlags flags, ResourceResidency residency) override;
    void addBuiltinReflectionProbePass(const scene::Camera *camera) override;
    ComputePassBuilder *addComputePass(const ccstd::string &passName) override;
    void addCopyPass(const ccstd::vector<CopyPair> &copyPairs) override;
    uint32_t addCustomBuffer(const ccstd::string &name, const gfx::BufferInfo &info, const std::string &type) override;
    uint32_t addCustomTexture(const ccstd::string &name, const gfx::TextureInfo &info, const std::string &type) override;
    uint32_t addDepthStencil(const ccstd::string &name, gfx::Format format, uint32_t width, uint32_t height, ResourceResidency residency) override;
    uint32_t addExternalTexture(const ccstd::string &name, gfx::Texture *texture, ResourceFlags flags) override;
    void addMovePass(const ccstd::vector<MovePair> &movePairs) override;
    MultisampleRenderPassBuilder *addMultisampleRenderPass(uint32_t width, uint32_t height, uint32_t count, uint32_t quality, const ccstd::string &passName) override;
    RenderPassBuilder *addRenderPass(uint32_t width, uint32_t height, const ccstd::string &passName) override;
    uint32_t addRenderTarget(const ccstd::string &name, gfx::Format format, uint32_t width, uint32_t height, ResourceResidency residency) override;
    uint32_t addRenderWindow(const ccstd::string &name, gfx::Format format, uint32_t width, uint32_t height, scene::RenderWindow *renderWindow, const ccstd::string &depthStencilName) override;
    void addResolvePass(const ccstd::vector<ResolvePair> &resolvePairs) override;
    uint32_t addResource(const ccstd::string &name, ResourceDimension dimension, gfx::Format format, uint32_t width, uint32_t height, uint32_t depth, uint32_t arraySize, uint32_t mipLevels, gfx::SampleCount sampleCount, ResourceFlags flags, ResourceResidency residency) override;
    uint32_t addShadingRateTexture(const ccstd::string &name, uint32_t width, uint32_t height, ResourceResidency residency) override;
    uint32_t addStorageBuffer(const ccstd::string &name, gfx::Format format, uint32_t size, ResourceResidency residency) override;
    uint32_t addStorageTexture(const ccstd::string &name, gfx::Format format, uint32_t width, uint32_t height, ResourceResidency residency) override;
    uint32_t addTexture(const ccstd::string &name, gfx::TextureType type, gfx::Format format, uint32_t width, uint32_t height, uint32_t depth, uint32_t arraySize, uint32_t mipLevels, gfx::SampleCount sampleCount, ResourceFlags flags, ResourceResidency residency) override;
    void addUploadPass(ccstd::vector<UploadPair> &uploadPairs) override;
    void beginFrame() override;
    void beginSetup() override;
    bool containsResource(const ccstd::string &name) const override;
    bool destroy() noexcept override;
    void endFrame() override;
    void endSetup() override;
    PipelineCapabilities getCapabilities() const override;
    const ccstd::vector<gfx::CommandBuffer *> &getCommandBuffers() const override;
    const ccstd::string &getConstantMacros() const override;
    gfx::DescriptorSet *getDescriptorSet() const override;
    gfx::DescriptorSetLayout *getDescriptorSetLayout() const override;
    gfx::DescriptorSetLayout *getDescriptorSetLayout(const ccstd::string &shaderName, UpdateFrequency freq) override;
    gfx::Device *getDevice() const override;
    bool getEnableCpuLightCulling() const override;
    pipeline::GeometryRenderer *getGeometryRenderer() const override;
    pipeline::GlobalDSManager *getGlobalDSManager() const override;
    bool getMacroBool(const ccstd::string &name) const override;
    int32_t getMacroInt(const ccstd::string &name) const override;
    const ccstd::string &getMacroString(const ccstd::string &name) const override;
    const MacroRecord &getMacros() const override;
    pipeline::PipelineSceneData *getPipelineSceneData() const override;
    scene::Model *getProfiler() const override;
    float getShadingScale() const override;
    PipelineType getType() const override;
    bool isOcclusionQueryEnabled() const override;
    bool isRenderQueueReset() const override;
    void onGlobalPipelineStateChanged() override;
    void render(const ccstd::vector<scene::Camera *> &cameras) override;
    void resetRenderQueue(bool reset) override;
    void setArrayBuffer(const ccstd::string &name, const ArrayBuffer *arrayBuffer) override;
    void setBuffer(const ccstd::string &name, gfx::Buffer *buffer) override;
    void setBuiltinCameraConstants(const scene::Camera *camera) override;
    void setBuiltinDirectionalLightConstants(const scene::DirectionalLight *light, const scene::Camera *camera) override;
    void setBuiltinDirectionalLightFrustumConstants(const scene::Camera *camera, const scene::DirectionalLight *light, uint32_t csmLevel) override;
    void setBuiltinPointLightConstants(const scene::PointLight *light, const scene::Camera *camera) override;
    void setBuiltinRangedDirectionalLightConstants(const scene::RangedDirectionalLight *light, const scene::Camera *camera) override;
    void setBuiltinSphereLightConstants(const scene::SphereLight *light, const scene::Camera *camera) override;
    void setBuiltinSpotLightConstants(const scene::SpotLight *light, const scene::Camera *camera) override;
    void setBuiltinSpotLightFrustumConstants(const scene::SpotLight *light) override;
    void setColor(const ccstd::string &name, const gfx::Color &color) override;
    void setEnableCpuLightCulling(bool enable) override;
    void setFloat(const ccstd::string &name, float v) override;
    void setMacroBool(const ccstd::string &name, bool value) override;
    void setMacroInt(const ccstd::string &name, int32_t value) override;
    void setMacroString(const ccstd::string &name, const ccstd::string &value) override;
    void setMat4(const ccstd::string &name, const Mat4 &mat) override;
    void setProfiler(scene::Model *profiler) override;
    void setQuaternion(const ccstd::string &name, const Quaternion &quat) override;
    void setSampler(const ccstd::string &name, gfx::Sampler *sampler) override;
    void setShadingScale(float scale) override;
    void setTexture(const ccstd::string &name, gfx::Texture *texture) override;
    void setValue(const ccstd::string &name, bool value) override;
    void setValue(const ccstd::string &name, int32_t value) override;
    void setVec2(const ccstd::string &name, const Vec2 &vec) override;
    void setVec4(const ccstd::string &name, const Vec4 &vec) override;
    void update(const scene::Camera *camera) override;
    void updateBuffer(const ccstd::string &name, uint32_t size) override;
    void updateDepthStencil(const ccstd::string &name, uint32_t width, uint32_t height, gfx::Format format) override;
    void updateExternalTexture(const ccstd::string &name, gfx::Texture *texture) override;
    void updateRenderTarget(const ccstd::string &name, uint32_t width, uint32_t height, gfx::Format format) override;
    void updateRenderWindow(const ccstd::string &name, scene::RenderWindow *renderWindow, const ccstd::string &depthStencilName) override;
    void updateResource(const ccstd::string &name, gfx::Format format, uint32_t width, uint32_t height, uint32_t depth, uint32_t arraySize, uint32_t mipLevels, gfx::SampleCount sampleCount) override;
    void updateShadingRateTexture(const ccstd::string &name, uint32_t width, uint32_t height) override;
    void updateStorageBuffer(const ccstd::string &name, uint32_t size, gfx::Format format) override;
    void updateStorageTexture(const ccstd::string &name, uint32_t width, uint32_t height, gfx::Format format) override;
    void updateTexture(const ccstd::string &name, gfx::Format format, uint32_t width, uint32_t height, uint32_t depth, uint32_t arraySize, uint32_t mipLevels, gfx::SampleCount sampleCount) override;
    void executeRenderGraph(const RenderGraph &rg);
    void addCustomContext(std::string_view name, std::shared_ptr<CustomPipelineContext> ptr);
    void addCustomRenderPass(std::string_view name, std::shared_ptr<CustomRenderPass> ptr);
    void addCustomRenderSubpass(std::string_view name, std::shared_ptr<CustomRenderSubpass> ptr);
    void addCustomComputeSubpass(std::string_view name, std::shared_ptr<CustomComputeSubpass> ptr);
    void addCustomComputePass(std::string_view name, std::shared_ptr<CustomComputePass> ptr);
    void addCustomRenderQueue(std::string_view name, std::shared_ptr<CustomRenderQueue> ptr);
    void addCustomRenderCommand(std::string_view name, std::shared_ptr<CustomRenderCommand> ptr);
    void setCustomContext(std::string_view name);
    void prepareDescriptorSets(gfx::CommandBuffer &cmdBuff, const FrameGraphDispatcher &rdg, RenderGraph::vertex_descriptor passID);

private:
    ccstd::vector<gfx::CommandBuffer*> _commandBuffers;
public:
    boost::container::pmr::unsynchronized_pool_resource unsyncPool;
    gfx::Device *device{nullptr};
    gfx::Swapchain *swapchain{nullptr};
    MacroRecord macros;
    ccstd::string constantMacros;
    std::unique_ptr<pipeline::GlobalDSManager> globalDSManager;
    ccstd::pmr::string name;
    NativeProgramLibrary *programLibrary{nullptr};
    scene::Model *profiler{nullptr};
    LightingMode lightingMode{LightingMode::DEFAULT};
    IntrusivePtr<pipeline::PipelineSceneData> pipelineSceneData;
    NativeRenderContext nativeContext;
    ResourceGraph resourceGraph;
    RenderGraph renderGraph;
    mutable PmrFlatMap<BuiltinCascadedShadowMapKey, BuiltinCascadedShadowMap> builtinCSMs;
    PipelineStatistics statistics;
    PipelineCustomization custom;
    bool defaultFramebufferHasDepthStencil{false};
};

class NativeProgramProxy final : public ProgramProxy {
public:
    NativeProgramProxy() = default;
    NativeProgramProxy(IntrusivePtr<gfx::Shader> shaderIn) // NOLINT(google-explicit-constructor)
    : shader(std::move(shaderIn)) {}
    NativeProgramProxy(IntrusivePtr<gfx::Shader> shaderIn, IntrusivePtr<gfx::PipelineState> pipelineStateIn)
    : shader(std::move(shaderIn)),
      pipelineState(std::move(pipelineStateIn)) {}

    const ccstd::string &getName() const noexcept override;
    gfx::Shader *getShader() const noexcept override;
    IntrusivePtr<gfx::Shader> shader;
    IntrusivePtr<gfx::PipelineState> pipelineState;
};

class NativeRenderingModule final : public RenderingModule {
public:
    NativeRenderingModule() = default;
    NativeRenderingModule(std::shared_ptr<NativeProgramLibrary> programLibraryIn) // NOLINT(google-explicit-constructor)
    : programLibrary(std::move(programLibraryIn)) {}

    uint32_t getPassID(const ccstd::string &name) const override;
    uint32_t getPhaseID(uint32_t subpassOrPassID, const ccstd::string &name) const override;
    uint32_t getSubpassID(uint32_t passID, const ccstd::string &name) const override;
    std::shared_ptr<NativeProgramLibrary> programLibrary;
};

} // namespace render

} // namespace cc

namespace ccstd {

inline hash_t hash<cc::render::FrustumCullingKey>::operator()(const cc::render::FrustumCullingKey& val) const noexcept {
    hash_t seed = 0;
    hash_combine(seed, val.camera);
    hash_combine(seed, val.probe);
    hash_combine(seed, val.light);
    hash_combine(seed, val.lightLevel);
    hash_combine(seed, val.castShadow);
    hash_combine(seed, val.probePass);
    return seed;
}

inline hash_t hash<cc::render::FrustumCullingID>::operator()(const cc::render::FrustumCullingID& val) const noexcept {
    hash_t seed = 0;
    hash_combine(seed, val.value);
    return seed;
}

inline hash_t hash<cc::render::LightBoundsCullingID>::operator()(const cc::render::LightBoundsCullingID& val) const noexcept {
    hash_t seed = 0;
    hash_combine(seed, val.value);
    return seed;
}

inline hash_t hash<cc::render::LightBoundsCullingKey>::operator()(const cc::render::LightBoundsCullingKey& val) const noexcept {
    hash_t seed = 0;
    hash_combine(seed, val.frustumCullingID);
    hash_combine(seed, val.camera);
    hash_combine(seed, val.probe);
    hash_combine(seed, val.cullingLight);
    return seed;
}

inline hash_t hash<cc::render::NativeRenderQueueKey>::operator()(const cc::render::NativeRenderQueueKey& val) const noexcept {
    hash_t seed = 0;
    hash_combine(seed, val.frustumCulledResultID);
    hash_combine(seed, val.lightBoundsCulledResultID);
    hash_combine(seed, val.queueLayoutID);
    return seed;
}

inline hash_t hash<cc::render::DescriptorSetKey>::operator()(const cc::render::DescriptorSetKey& val) const noexcept {
    hash_t seed = 0;
    hash_combine(seed, val.nodeID);
    hash_combine(seed, val.frequency);
    return seed;
}

} // namespace ccstd
