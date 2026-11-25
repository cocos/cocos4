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
#pragma once
// clang-format off
#include "cocos/renderer/pipeline/custom/RenderCommonFwd.h"
#include "cocos/base/std/hash/hash.h"

namespace cc {

namespace render {

struct ClearValue;
struct RasterView;
struct ComputeView;
struct ResourceDesc;
struct ResourceTraits;
struct RenderSwapchain;
struct ResourceStates;
struct ManagedBuffer;
struct PersistentBuffer;
struct ManagedTexture;
struct PersistentTexture;
struct ManagedResource;
struct Subpass;
struct Subpass_;
struct SubpassGraph;
struct RasterSubpass;
struct ComputeSubpass;
struct RasterPass;
struct PersistentRenderPassAndFramebuffer;
struct Managed_;
struct ManagedBuffer_;
struct ManagedTexture_;
struct PersistentBuffer_;
struct PersistentTexture_;
struct Framebuffer_;
struct Swapchain_;
struct Sampler_;
struct FormatView_;
struct SubresourceView_;
struct FormatView;
struct SubresourceView;
struct Desc_;
struct Traits_;
struct States_;
struct ResourceGraph;
struct ComputePass;
struct ResolvePass;
struct CopyPass;
struct MovePass;
struct RaytracePass;
struct Queue_;
struct Scene_;
struct Dispatch_;
struct Blit_;
struct Clear_;
struct Viewport_;
struct ClearView;
struct RenderQueue;

enum class CullingFlags : uint32_t;

struct SceneData;
struct Dispatch;

enum class BlitType : uint8_t;

struct Blit;
struct RenderData;
struct Data_;
struct Valid_;
struct RenderGraph;

} // namespace render

} // namespace cc

namespace ccstd {

template <>
struct hash<cc::render::ClearValue> {
    hash_t operator()(const cc::render::ClearValue& val) const noexcept;
};

template <>
struct hash<cc::render::RasterView> {
    hash_t operator()(const cc::render::RasterView& val) const noexcept;
};

template <>
struct hash<cc::render::ComputeView> {
    hash_t operator()(const cc::render::ComputeView& val) const noexcept;
};

template <>
struct hash<cc::render::Subpass> {
    hash_t operator()(const cc::render::Subpass& val) const noexcept;
};

template <>
struct hash<cc::render::SubpassGraph> {
    hash_t operator()(const cc::render::SubpassGraph& val) const noexcept;
};

template <>
struct hash<cc::render::RasterPass> {
    hash_t operator()(const cc::render::RasterPass& val) const noexcept;
};

} // namespace ccstd

// clang-format on
