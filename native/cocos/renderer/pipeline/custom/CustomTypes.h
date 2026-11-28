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
#include <memory>
#include <string_view>
#include "CustomFwd.h"
#include "cocos/base/Ptr.h"
#include "cocos/renderer/gfx-base/GFXBuffer.h"
#include "cocos/renderer/gfx-base/GFXTexture.h"
#include "cocos/renderer/pipeline/custom/RenderGraphTypes.h"

namespace cc::gfx {
struct BufferInfo;
class CommandBuffer;
class RenderPass;
struct TextureInfo;
} // namespace cc::gfx

namespace cc {

namespace render {

class Customization {
public:
    Customization() noexcept = default;
    Customization(Customization &&rhs) = delete;
    Customization(Customization const &rhs) = delete;
    Customization &operator=(Customization &&rhs) = delete;
    Customization &operator=(Customization const &rhs) = delete;
    virtual ~Customization() noexcept = default;

    virtual std::string_view getName() const noexcept = 0;
};

class CustomPipelineContext : public Customization {
public:
    virtual IntrusivePtr<gfx::Buffer> createCustomBuffer(std::string_view type, const gfx::BufferInfo &info) = 0;
    virtual IntrusivePtr<gfx::Texture> createCustomTexture(std::string_view type, const gfx::TextureInfo &info) = 0;
    virtual void destroy() noexcept = 0;
};

struct CustomRenderGraphContext {
    std::shared_ptr<CustomPipelineContext> pipelineContext;
    const RenderGraph *renderGraph{nullptr};
    const ResourceGraph *resourceGraph{nullptr};
    gfx::CommandBuffer *primaryCommandBuffer{nullptr};
    gfx::RenderPass *currentRenderPass{nullptr};
};

class CustomRenderPass : public Customization {
public:
    virtual void beginRenderPass(const CustomRenderGraphContext &rg, RenderGraphVertex passID) = 0;
    virtual void endRenderPass(const CustomRenderGraphContext &rg, RenderGraphVertex passID) = 0;
};

class CustomRenderSubpass : public Customization {
public:
    virtual void beginRenderSubpass(const CustomRenderGraphContext &rg, RenderGraphVertex passID) = 0;
    virtual void endRenderSubpass(const CustomRenderGraphContext &rg, RenderGraphVertex passID) = 0;
};

class CustomComputeSubpass : public Customization {
public:
    virtual void beginComputeSubpass(const CustomRenderGraphContext &rg, RenderGraphVertex passID) = 0;
    virtual void endComputeSubpass(const CustomRenderGraphContext &rg, RenderGraphVertex passID) = 0;
};

class CustomComputePass : public Customization {
public:
    virtual void beginComputePass(const CustomRenderGraphContext &rg, RenderGraphVertex passID) = 0;
    virtual void endComputePass(const CustomRenderGraphContext &rg, RenderGraphVertex passID) = 0;
};

class CustomRenderQueue {
public:
    CustomRenderQueue() noexcept = default;
    CustomRenderQueue(CustomRenderQueue &&rhs) = delete;
    CustomRenderQueue(CustomRenderQueue const &rhs) = delete;
    CustomRenderQueue &operator=(CustomRenderQueue &&rhs) = delete;
    CustomRenderQueue &operator=(CustomRenderQueue const &rhs) = delete;
    virtual ~CustomRenderQueue() noexcept = default;

    virtual void beginRenderQueue(const CustomRenderGraphContext &rg, RenderGraphVertex passID) = 0;
    virtual void endRenderQueue(const CustomRenderGraphContext &rg, RenderGraphVertex passID) = 0;
};

class CustomRenderCommand {
public:
    CustomRenderCommand() noexcept = default;
    CustomRenderCommand(CustomRenderCommand &&rhs) = delete;
    CustomRenderCommand(CustomRenderCommand const &rhs) = delete;
    CustomRenderCommand &operator=(CustomRenderCommand &&rhs) = delete;
    CustomRenderCommand &operator=(CustomRenderCommand const &rhs) = delete;
    virtual ~CustomRenderCommand() noexcept = default;

    virtual void beginRenderCommand(const CustomRenderGraphContext &rg, RenderGraphVertex passID) = 0;
    virtual void endRenderCommand(const CustomRenderGraphContext &rg, RenderGraphVertex passID) = 0;
};

} // namespace render

} // namespace cc
