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

#include "core/assets/RenderTexture.h"
#include "base/std/optional.h"
#include "core/Root.h"
#include "core/platform/Debug.h"
#include "core/utils/IDGenerator.h"
#include "renderer/gfx-base/GFXDef-common.h"
#include "renderer/gfx-base/GFXDevice.h"
#include "scene/RenderWindow.h"

namespace cc {

namespace {
// The legacy limit used only when the GPU capability is unavailable,
// e.g. when assets are loaded before the renderer is initialized.
constexpr uint32_t FALLBACK_MAX_RENDER_TEXTURE_SIZE = 2048;

// Returns ccstd::nullopt when the device or its max texture size is unavailable.
ccstd::optional<uint32_t> getMaxRenderTextureSize() {
    auto *device = gfx::Device::getInstance();
    if (device == nullptr) {
        return ccstd::nullopt;
    }
    const uint32_t maxTextureSize = device->getCapabilities().maxTextureSize;
    if (maxTextureSize == 0) {
        return ccstd::nullopt;
    }
    return maxTextureSize;
}

gfx::RenderPassInfo getDefaultRenderPassInfo(gfx::Device *device) {
    gfx::RenderPassInfo info;
    info.colorAttachments.push_back({
        gfx::Format::RGBA8,
        gfx::SampleCount::X1,
        gfx::LoadOp::CLEAR,
        gfx::StoreOp::STORE,
        device->getGeneralBarrier({
            gfx::AccessFlagBit::FRAGMENT_SHADER_READ_TEXTURE,
            gfx::AccessFlagBit::FRAGMENT_SHADER_READ_TEXTURE,
        }),
    });
    info.depthStencilAttachment.format = gfx::Format::DEPTH_STENCIL;
    return info;
}
} // namespace

RenderTexture::RenderTexture() = default;
RenderTexture::~RenderTexture() = default;

void RenderTexture::initialize(const IRenderTextureCreateInfo &info) {
    _name = info.name.has_value() ? info.name.value() : "";
    _width = info.width;
    _height = info.height;
    initWindow(info);
}

void RenderTexture::reset(const IRenderTextureCreateInfo &info) {
    initialize(info);
}

bool RenderTexture::destroy() {
    if (_window != nullptr) {
        Root::getInstance()->destroyWindow(_window);
        _window = nullptr;
    }
    return Super::destroy();
}

void RenderTexture::resize(uint32_t width, uint32_t height) {
    const auto maxTextureSize = getMaxRenderTextureSize();
    const auto maxSize = static_cast<float>(
        maxTextureSize.has_value() ? maxTextureSize.value() : FALLBACK_MAX_RENDER_TEXTURE_SIZE);
    _width = static_cast<uint32_t>(std::floor(clampf(static_cast<float>(width), 1.F, maxSize)));
    _height = static_cast<uint32_t>(std::floor(clampf(static_cast<float>(height), 1.F, maxSize)));
    if (_window != nullptr) {
        _window->resize(_width, _height);
    }
    // emit(ccstd::string("resize"), _window); //TODO(xwx): not inherit form Eventify in Asset base class
}

gfx::Texture *RenderTexture::getGFXTexture() const {
    return _window ? _window->getFramebuffer()->getColorTextures()[0] : nullptr;
}

void RenderTexture::onLoaded() {
    initWindow();
}

void RenderTexture::initWindow() {
    auto *device{Root::getInstance()->getDevice()};

    cc::scene::IRenderWindowInfo windowInfo;
    windowInfo.title = _name;
    windowInfo.width = _width;
    windowInfo.height = _height;
    windowInfo.renderPassInfo = getDefaultRenderPassInfo(device);

    if (_window != nullptr) {
        _window->destroy();
        _window->initialize(device, windowInfo);
    } else {
        _window = Root::getInstance()->createWindow(windowInfo);
    }
}

void RenderTexture::initWindow(const IRenderTextureCreateInfo &info) {
    auto *device{Root::getInstance()->getDevice()};

    cc::scene::IRenderWindowInfo windowInfo;
    windowInfo.title = _name;
    windowInfo.width = _width;
    windowInfo.height = _height;
    if (info.passInfo.has_value()) {
        windowInfo.renderPassInfo = info.passInfo.value();
    } else {
        windowInfo.renderPassInfo = getDefaultRenderPassInfo(device);
    }

    if (info.externalResLow.has_value()) {
        windowInfo.externalResLow = info.externalResLow.value();
    }

    if (info.externalResHigh.has_value()) {
        windowInfo.externalResHigh = info.externalResHigh.value();
    }

    if (info.externalFlag.has_value()) {
        windowInfo.externalFlag = info.externalFlag.value();
    }

    if (_window != nullptr) {
        _window->destroy();
        _window->initialize(device, windowInfo);
    } else {
        _window = Root::getInstance()->createWindow(windowInfo);
    }
}

void RenderTexture::initDefault(const ccstd::optional<ccstd::string> &uuid) {
    Super::initDefault(uuid);
    _width = 1;
    _height = 1;
    initWindow();
}

bool RenderTexture::validate() const {
    if (_width == 0 || _height == 0) {
        return false;
    }
    const auto maxTextureSize = getMaxRenderTextureSize();
    if (!maxTextureSize.has_value()) {
        return true;
    }
    const uint32_t maxSize = maxTextureSize.value();
    return _width <= maxSize && _height <= maxSize;
}

ccstd::vector<uint8_t> RenderTexture::readPixels(uint32_t x, uint32_t y, uint32_t width, uint32_t height) const {
    auto *gfxTexture = getGFXTexture();
    if (!gfxTexture) {
        debug::errorID(7606);
        return {};
    }

    auto *gfxDevice = getGFXDevice();

    gfx::BufferTextureCopy region0{};
    region0.texOffset.x = static_cast<int32_t>(x);
    region0.texOffset.y = static_cast<int32_t>(y);
    region0.texExtent.width = width;
    region0.texExtent.height = height;

    ccstd::vector<uint8_t> buffer;
    buffer.resize(width * height * 4);
    uint8_t *pBuffer = buffer.data();
    gfxDevice->copyTextureToBuffers(gfxTexture, &pBuffer, &region0, 1);

    return buffer;
}

} // namespace cc
