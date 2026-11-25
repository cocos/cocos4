/****************************************************************************
 Copyright (c) 2021-2023 Xiamen Yaji Software Co., Ltd.

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

#include "NativePipelineTypes.h"
#include "RenderGraphTypes.h"
#include "cocos/renderer/gfx-base/GFXDevice.h"
#include "cocos/renderer/pipeline/custom/details/GslUtils.h"
#include "cocos/scene/RenderWindow.h"
#include "gfx-base/GFXDef-common.h"

namespace cc {

namespace render {

gfx::Texture* RenderSwapchain::getColorTexture(gfx::Swapchain* swapchain) noexcept {
    CC_EXPECTS(swapchain);
    auto* const texture = swapchain->getColorTexture();
    CC_ENSURES(texture);
    return texture;
}

gfx::Texture* RenderSwapchain::getColorTexture(scene::RenderWindow* renderWindow) noexcept {
    const auto& fb = renderWindow->getFramebuffer();
    CC_EXPECTS(fb);
    CC_EXPECTS(fb->getColorTextures().size() == 1);
    auto* const texture = fb->getColorTextures()[0];
    CC_ENSURES(texture);
    return texture;
}

gfx::Texture* RenderSwapchain::getDepthStencilTexture(gfx::Swapchain* swapchain) noexcept {
    CC_EXPECTS(swapchain);
    auto* const texture = swapchain->getDepthStencilTexture();
    CC_ENSURES(texture);
    return texture;
}

ResourceGroup::~ResourceGroup() noexcept {
    for (const auto& buffer : instancingBuffers) {
        buffer->clear();
    }
}

void ProgramResource::syncResources() noexcept {
    for (auto&& [nameID, buffer] : uniformBuffers) {
        buffer.bufferPool.syncResources();
    }
    descriptorSetPool.syncDescriptorSets();
}

void LayoutGraphNodeResource::syncResources() noexcept {
    for (auto&& [nameID, buffer] : uniformBuffers) {
        buffer.bufferPool.syncResources();
    }
    descriptorSetPool.syncDescriptorSets();
    for (auto&& [programName, programResource] : programResources) {
        programResource.syncResources();
    }
}

void NativeRenderContext::clearPreviousResources(uint64_t finishedFenceValue) noexcept {
    for (auto iter = resourceGroups.begin(); iter != resourceGroups.end();) {
        if (iter->first <= finishedFenceValue) {
            iter = resourceGroups.erase(iter);
        } else {
            break;
        }
    }
    for (auto& node : layoutGraphResources) {
        node.syncResources();
    }
}

namespace {

gfx::BufferInfo getBufferInfo(const ResourceDesc& desc) {
    using namespace gfx; // NOLINT(google-build-using-namespace)

    BufferUsage usage = BufferUsage::TRANSFER_SRC | BufferUsage::TRANSFER_DST;
    if (any(desc.flags & ResourceFlags::UNIFORM)) {
        usage |= BufferUsage::UNIFORM;
    }
    if (any(desc.flags & ResourceFlags::STORAGE)) {
        usage |= BufferUsage::STORAGE;
    }
    if (any(desc.flags & ResourceFlags::INDIRECT)) {
        usage |= BufferUsage::INDIRECT;
    }

    return {
        usage,
        MemoryUsage::DEVICE,
        desc.width,
        1U, // stride should not be used
        BufferFlagBit::NONE,
    };
}

gfx::TextureInfo getTextureInfo(const ResourceDesc& desc) {
    using namespace gfx; // NOLINT(google-build-using-namespace)

    // usage
    TextureUsage usage = TextureUsage::NONE;
    if (any(desc.flags & ResourceFlags::COLOR_ATTACHMENT)) {
        usage |= TextureUsage::COLOR_ATTACHMENT;
    }
    if (any(desc.flags & ResourceFlags::DEPTH_STENCIL_ATTACHMENT)) {
        CC_EXPECTS(!any(desc.flags & ResourceFlags::COLOR_ATTACHMENT));
        usage |= TextureUsage::DEPTH_STENCIL_ATTACHMENT;
    }
    if (any(desc.flags & ResourceFlags::INPUT_ATTACHMENT)) {
        usage |= TextureUsage::INPUT_ATTACHMENT;
    }
    if (any(desc.flags & ResourceFlags::STORAGE)) {
        usage |= TextureUsage::STORAGE;
    }
    if (any(desc.flags & ResourceFlags::SHADING_RATE)) {
        usage |= TextureUsage::SHADING_RATE;
    }
    if (any(desc.flags & ResourceFlags::SAMPLED)) {
        usage |= TextureUsage::SAMPLED;
    }
    if (any(desc.flags & ResourceFlags::TRANSFER_SRC)) {
        usage |= TextureUsage::TRANSFER_SRC;
    }
    if (any(desc.flags & ResourceFlags::TRANSFER_DST)) {
        usage |= TextureUsage::TRANSFER_DST;
    }

    return {
        desc.viewType,
        usage,
        desc.format,
        desc.width,
        desc.height,
        desc.textureFlags,
        desc.viewType == TextureType::TEX3D ? 1U : desc.depthOrArraySize,
        desc.mipLevels,
        desc.sampleCount,
        desc.viewType == TextureType::TEX3D ? desc.depthOrArraySize : 1U,
        nullptr,
    };
}

gfx::TextureViewInfo getTextureViewInfo(const SubresourceView& subresView, gfx::TextureType viewType) {
    using namespace gfx; // NOLINT(google-build-using-namespace)

    return {
        nullptr,
        viewType,
        subresView.format,
        subresView.indexOrFirstMipLevel,
        subresView.numMipLevels,
        subresView.firstArraySlice,
        subresView.numArraySlices,
        subresView.firstPlane,
        subresView.numPlanes,
    };
}

bool isTextureEqual(const gfx::Texture* texture, const ResourceDesc& desc) {
    if (!texture) {
        return false;
    }
    const auto& info = texture->getInfo();
    return desc.width == info.width && desc.height == info.height && desc.format == info.format;
}

} // namespace

bool ManagedTexture::checkResource(const ResourceDesc& desc) const {
    return isTextureEqual(texture.get(), desc);
}

void ResourceGraph::validateSwapchains() {
    bool swapchainInvalidated = false;
    for (auto& sc : swapchains) {
        if (!sc.swapchain) {
            continue;
        }
        if (sc.generation != sc.swapchain->getGeneration()) {
            swapchainInvalidated = true;
            sc.generation = sc.swapchain->getGeneration();
        }
    }
    if (swapchainInvalidated) {
        renderPasses.clear();
    }
}

namespace {

std::pair<SubresourceView, ResourceGraph::vertex_descriptor>
getOriginView(const ResourceGraph& resg, ResourceGraph::vertex_descriptor vertID) {
    // copy origin view
    SubresourceView originView = resg.value(SubresourceView_{}, vertID);
    auto parentID = resg.get_parent(vertID);
    CC_EXPECTS(parentID != ResourceGraph::null_vertex());
    while (resg.isTextureView(parentID)) {
        if (resg.holds<SubresourceView_>(parentID)) {
            const auto& parentView = resg.value(SubresourceView_{}, parentID);
            originView.firstPlane += parentView.firstPlane;
            originView.firstArraySlice += parentView.firstArraySlice;
            originView.indexOrFirstMipLevel += parentView.indexOrFirstMipLevel;
        }
        parentID = resg.get_parent(parentID);
    }
    CC_EXPECTS(parentID != ResourceGraph::null_vertex());
    CC_EXPECTS(resg.isTexture(parentID));
    CC_ENSURES(!resg.isTextureView(parentID));
    return {originView, parentID};
}

void recreateTextureView(
    gfx::Device* device,
    ResourceGraph& resg,
    const SubresourceView& originView,
    ResourceGraph::vertex_descriptor parentID,
    SubresourceView& view) {
    const auto& desc = resg.getDesc(parentID);
    auto textureViewInfo = getTextureViewInfo(originView, desc.viewType);
    const auto& parentTexture = resg.getTexture(parentID);
    CC_EXPECTS(parentTexture);
    textureViewInfo.texture = parentTexture;
    view.textureView = device->createTexture(textureViewInfo);
}

} // namespace

// NOLINTNEXTLINE(misc-no-recursion)
void ResourceGraph::mount(gfx::Device* device, vertex_descriptor vertID) {
    visit_object(
        vertID,
        [&](const ManagedResource& resource) {
            // to be removed
        },
        [&](ManagedBuffer& buffer) {
            if (!buffer.buffer) {
                const auto& desc = getDesc(vertID);
                auto info = getBufferInfo(desc);
                buffer.buffer = device->createBuffer(info);
            }
            CC_ENSURES(buffer.buffer);
            buffer.fenceValue = nextFenceValue;
        },
        [&](ManagedTexture& texture) {
            const auto& desc = getDesc(vertID);
            if (!texture.checkResource(desc)) {
                auto info = getTextureInfo(desc);
                texture.texture = device->createTexture(info);
                // recreate depth stencil views, currently is not recursive
                for (const auto e : child_links(vertID)) {
                    const auto childID = child(e);
                    if (holds<SubresourceView_>(childID)) {
                        const auto [originView, parentID] = getOriginView(*this, childID);
                        CC_ENSURES(parentID == vertID);
                        recreateTextureView(device, *this, originView, parentID, value(SubresourceView_{}, childID));
                    }
                }
            }
            CC_ENSURES(texture.texture);
            texture.fenceValue = nextFenceValue;
        },
        [&](const PersistentBuffer& buffer) {
            CC_EXPECTS(buffer.buffer);
            std::ignore = buffer;
        },
        [&](const PersistentTexture& texture) {
            CC_EXPECTS(texture.texture);
            std::ignore = texture;
        },
        [&](const IntrusivePtr<gfx::Framebuffer>& fb) {
            // deprecated
            CC_EXPECTS(false);
            CC_EXPECTS(fb);
            std::ignore = fb;
        },
        [&](const RenderSwapchain& window) {
            CC_EXPECTS(window.swapchain || window.renderWindow);
            std::ignore = window;
        },
        [&](const FormatView& view) { // NOLINT(misc-no-recursion)
            std::ignore = view;
            auto parentID = get_parent(vertID);
            CC_EXPECTS(parentID != ResourceGraph::null_vertex());
            while (isTextureView(parentID)) {
                parentID = get_parent(parentID);
            }
            CC_EXPECTS(parentID != ResourceGraph::null_vertex());
            CC_EXPECTS(isTexture(parentID));
            CC_ENSURES(!isTextureView(parentID));
            mount(device, parentID);
        },
        [&](SubresourceView& view) { // NOLINT(misc-no-recursion)
            const auto [originView, parentID] = getOriginView(*this, vertID);
            mount(device, parentID); // NOLINT(misc-no-recursion)
            const auto& desc = getDesc(vertID);
            if (!isTextureEqual(view.textureView, desc)) {
                recreateTextureView(device, *this, originView, parentID, view);
            }
        });
}

void ResourceGraph::unmount(uint64_t completedFenceValue) {
    for (const auto vertID : vertices()) {
        if (holds<ManagedBuffer_>(vertID)) {
            auto& buffer = value(ManagedBuffer_{}, vertID);
            if (buffer.buffer && buffer.fenceValue <= completedFenceValue) {
                buffer.buffer.reset();
            }
        } else if (holds<ManagedTexture_>(vertID)) {
            auto& texture = value(ManagedTexture_{}, vertID);
            if (texture.texture && texture.fenceValue <= completedFenceValue) {
                invalidatePersistentRenderPassAndFramebuffer(texture.texture.get());
                texture.texture.reset();
                const auto& traits = getTraits(vertID);
                if (traits.hasSideEffects()) {
                    auto& states = getStates(vertID);
                    states.states = cc::gfx::AccessFlagBit::NONE;
                }
            }
        }
    }
}

bool ResourceGraph::isTexture(vertex_descriptor resID) const noexcept {
    const auto resourceKind = handles[resID].kind;
    return resourceKind != Kind::ManagedBuffer && resourceKind != Kind::PersistentBuffer;
}

bool ResourceGraph::isTextureView(vertex_descriptor resID) const noexcept {
    const auto resourceKind = handles[resID].kind;
    return resourceKind == Kind::FormatView || resourceKind == Kind::SubresourceView;
}

gfx::Buffer* ResourceGraph::getBuffer(vertex_descriptor resID) {
    gfx::Buffer* buffer = nullptr;
    visit_object(
        resID,
        [&](const ManagedBuffer& res) {
            buffer = res.buffer.get();
        },
        [&](const PersistentBuffer& res) {
            buffer = res.buffer.get();
        },
        [&](const auto& buffer) {
            std::ignore = buffer;
            CC_EXPECTS(false);
        });
    CC_ENSURES(buffer);

    return buffer;
}

gfx::Texture* ResourceGraph::getTexture(vertex_descriptor resID) {
    auto* const texture = visit_object(
        resID,
        [](const ManagedTexture& res) -> gfx::Texture* {
            return res.texture.get();
        },
        [](const PersistentTexture& res) -> gfx::Texture* {
            return res.texture.get();
        },
        [](const IntrusivePtr<gfx::Framebuffer>& fb) -> gfx::Texture* {
            // deprecated
            CC_EXPECTS(false);
            CC_EXPECTS(fb->getColorTextures().size() == 1);
            CC_EXPECTS(fb->getColorTextures().at(0));
            return fb->getColorTextures()[0];
        },
        [](const RenderSwapchain& sc) -> gfx::Texture* {
            return sc.texture;
        },
        [](const FormatView& view) -> gfx::Texture* {
            // TODO(zhouzhenglong): add ImageView support
            std::ignore = view;
            CC_EXPECTS(false);
            return nullptr;
        },
        [](const SubresourceView& view) -> gfx::Texture* {
            // TODO(zhouzhenglong): add ImageView support
            return view.textureView;
        },
        [](const auto& buffer) -> gfx::Texture* {
            std::ignore = buffer;
            CC_EXPECTS(false);
            return nullptr;
        });
    CC_ENSURES(texture);

    return texture;
}

void ResourceGraph::invalidatePersistentRenderPassAndFramebuffer(gfx::Texture* pTexture) {
    if (!pTexture) {
        return;
    }
    for (auto iter = renderPasses.begin(); iter != renderPasses.end();) {
        const auto& pass = iter->second;
        bool bErase = false;
        for (const auto& color : pass.framebuffer->getColorTextures()) {
            if (color == pTexture) {
                bErase = true;
                break;
            }
        }
        if (pass.framebuffer->getDepthStencilTexture() == pTexture) {
            bErase = true;
        }
        if (bErase) {
            iter = renderPasses.erase(iter);
        } else {
            ++iter;
        }
    }
}

} // namespace render

} // namespace cc
