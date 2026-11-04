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

#include "platform/interfaces/modules/canvas/CanvasRenderingContext2D.h"

#include <cstdint>
#include "base/csscolorparser.h"
#include "cocos/bindings/jswrapper/SeApi.h"
#include "cocos/bindings/manual/jsb_platform.h"
#include "math/Math.h"
#include "platform/FileUtils.h"
#include "platform/interfaces/modules/canvas/CanvasFont.h"

#if defined(CC_SERVER_MODE)
    #include "platform/empty/modules/CanvasRenderingContext2DDelegate.h"
#elif (CC_PLATFORM == CC_PLATFORM_WINDOWS)
    #include "platform/win32/modules/CanvasRenderingContext2DDelegate.h"
#elif (CC_PLATFORM == CC_PLATFORM_ANDROID || CC_PLATFORM == CC_PLATFORM_OHOS)
    #include "platform/java/modules/CanvasRenderingContext2DDelegate.h"
#elif (CC_PLATFORM == CC_PLATFORM_MACOS || CC_PLATFORM == CC_PLATFORM_IOS)
    #include "platform/apple/modules/CanvasRenderingContext2DDelegate.h"
#elif (CC_PLATFORM == CC_PLATFORM_LINUX)
    #include "platform/linux/modules/CanvasRenderingContext2DDelegate.h"
#elif (CC_PLATFORM == CC_PLATFORM_QNX)
    #include "platform/qnx/modules/CanvasRenderingContext2DDelegate.h"
#elif (CC_PLATFORM == CC_PLATFORM_OPENHARMONY)
    #include "platform/openharmony/modules/CanvasRenderingContext2DDelegate.h"
#endif

using Vec2 = ccstd::array<float, 2>;
using Color4F = ccstd::array<float, 4>;

namespace cc {
//using Size    = ccstd::array<float, 2>;
CanvasGradient::CanvasGradient() = default;

CanvasGradient::~CanvasGradient() = default;

void CanvasGradient::addColorStop(float offset, const ccstd::string &color) {
    //SE_LOGD("CanvasGradient::addColorStop: %p\n", this);
}

// CanvasRenderingContext2D

CanvasRenderingContext2D::CanvasRenderingContext2D(float width, float height)
: _width(width),
  _height(height) {
    _delegate = ccnew CanvasRenderingContext2DDelegate();
    //SE_LOGD("CanvasRenderingContext2D constructor: %p, width: %f, height: %f\n", this, width, height);
}

CanvasRenderingContext2D::~CanvasRenderingContext2D() {
    delete _delegate;
}

void CanvasRenderingContext2D::clearRect(float x, float y, float width, float height) {
    //SE_LOGD("CanvasRenderingContext2D::clearRect: %p, %f, %f, %f, %f\n", this, x, y, width, height);
    recreateBufferIfNeeded();
    _delegate->clearRect(x, y, width, height);
}

void CanvasRenderingContext2D::fillRect(float x, float y, float width, float height) {
    recreateBufferIfNeeded();
    _delegate->fillRect(x, y, width, height);
}

void CanvasRenderingContext2D::fillText(const ccstd::string &text, float x, float y, float maxWidth) {
    //SE_LOGD("CanvasRenderingContext2D::fillText: %s, offset: (%f, %f), %f\n", text.c_str(), x, y, maxWidth);
    if (text.empty()) {
        return;
    }
    recreateBufferIfNeeded();
    _delegate->fillText(text, x, y, maxWidth);
}

void CanvasRenderingContext2D::strokeText(const ccstd::string &text, float x, float y, float maxWidth) {
    //SE_LOGD("CanvasRenderingContext2D::strokeText: %s, %f, %f, %f\n", text.c_str(), x, y, maxWidth);
    if (text.empty()) {
        return;
    }
    recreateBufferIfNeeded();
    _delegate->strokeText(text, x, y, maxWidth);
}

cc::Size CanvasRenderingContext2D::measureText(const ccstd::string &text) {
    //SE_LOGD("CanvasRenderingContext2D::measureText: %s\n", text.c_str());
    auto s = _delegate->measureText(text);
    return cc::Size(s[0], s[1]);
}

ICanvasGradient *CanvasRenderingContext2D::createLinearGradient(float /*x0*/, float /*y0*/, float /*x1*/, float /*y1*/) {
    return nullptr;
}

void CanvasRenderingContext2D::save() {
    //SE_LOGD("CanvasRenderingContext2D::save\n");
    _delegate->saveContext();
}

void CanvasRenderingContext2D::beginPath() {
    //SE_LOGD("\n-----------begin------------------\nCanvasRenderingContext2D::beginPath\n");
    recreateBufferIfNeeded();
    _delegate->beginPath();
}

void CanvasRenderingContext2D::closePath() {
    //SE_LOGD("CanvasRenderingContext2D::closePath\n");
    _delegate->closePath();
}

void CanvasRenderingContext2D::moveTo(float x, float y) {
    //SE_LOGD("CanvasRenderingContext2D::moveTo\n");
    _delegate->moveTo(x, y);
}

void CanvasRenderingContext2D::lineTo(float x, float y) {
    //SE_LOGD("CanvasRenderingContext2D::lineTo\n");
    _delegate->lineTo(x, y);
}

void CanvasRenderingContext2D::stroke() {
    //SE_LOGD("CanvasRenderingContext2D::stroke\n");
    recreateBufferIfNeeded();
    _delegate->stroke();
}

void CanvasRenderingContext2D::restore() {
    //SE_LOGD("CanvasRenderingContext2D::restore\n");
    _delegate->restoreContext();
}

void CanvasRenderingContext2D::setCanvasBufferUpdatedCallback(const CanvasBufferUpdatedCallback &cb) {
    _canvasBufferUpdatedCB = cb;
}

void CanvasRenderingContext2D::fetchData() {
    recreateBufferIfNeeded();
    _delegate->updateData();
    if (_canvasBufferUpdatedCB != nullptr) {
        _canvasBufferUpdatedCB(_delegate->getDataRef());
    }
}

void CanvasRenderingContext2D::setWidth(float width) {
    //SE_LOGD("CanvasRenderingContext2D::set__width: %f\n", width);
    if (math::isEqualF(width, _width)) return;
    _width = width;
    _isBufferSizeDirty = true;
}

void CanvasRenderingContext2D::setHeight(float height) {
    //SE_LOGD("CanvasRenderingContext2D::set__height: %f\n", height);
    if (math::isEqualF(height, _height)) return;
    _height = height;
    _isBufferSizeDirty = true;
}

void CanvasRenderingContext2D::setLineWidth(float lineWidth) {
    //SE_LOGD("CanvasRenderingContext2D::set_lineWidth %d\n", lineWidth);
    _lineWidth = lineWidth;
    _delegate->setLineWidth(lineWidth);
}

void CanvasRenderingContext2D::setLineCap(const ccstd::string &lineCap) {
    //SE_LOGE("%s isn't implemented!\n", __FUNCTION__);
#if CC_PLATFORM == CC_PLATFORM_WINDOWS

#elif CC_PLATFORM == CC_PLATFORM_ANDROID
    if (lineCap.empty()) return;
    _delegate->setLineCap(lineCap);
#endif
}

void CanvasRenderingContext2D::setLineJoin(const ccstd::string &lineJoin) {
    //SE_LOGE("%s isn't implemented!\n", __FUNCTION__);
    _delegate->setLineJoin(lineJoin);
}

void CanvasRenderingContext2D::fill() {
    // SE_LOGE("%s isn't implemented!\n", __FUNCTION__);
#if CC_PLATFORM == CC_PLATFORM_WINDOWS

#elif CC_PLATFORM == CC_PLATFORM_ANDROID
    _delegate->fill();
#endif
}

void CanvasRenderingContext2D::rect(float x, float y, float w, float h) {
    recreateBufferIfNeeded();
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
    // SE_LOGE("%s isn't implemented!\n", __FUNCTION__);
#elif CC_PLATFORM == CC_PLATFORM_ANDROID
    // SE_LOGD("CanvasRenderingContext2D::rect: %p, %f, %f, %f, %f\n", this, x, y, width, height);
    _delegate->rect(x, y, w, h);
#endif
}

void CanvasRenderingContext2D::setFont(const ccstd::string &font) {
    recreateBufferIfNeeded();
#if CC_PLATFORM == CC_PLATFORM_WINDOWS || CC_PLATFORM == CC_PLATFORM_QNX || CC_PLATFORM == CC_PLATFORM_LINUX || CC_PLATFORM == CC_PLATFORM_ANDROID || CC_PLATFORM == CC_PLATFORM_OHOS || CC_PLATFORM == CC_PLATFORM_OPENHARMONY || CC_PLATFORM == CC_PLATFORM_MACOS || CC_PLATFORM == CC_PLATFORM_IOS
    if (_font != font) {
        _font = font;
        const auto parsed = detail::parseCanvasFont(font);
        _delegate->updateFont(parsed.family, parsed.size, parsed.bold, parsed.italic, parsed.oblique, parsed.smallCaps);
    }
#endif
}

void CanvasRenderingContext2D::setTextAlign(const ccstd::string &textAlign) {
    //SE_LOGD("CanvasRenderingContext2D::set_textAlign: %s\n", textAlign.c_str());
    if (textAlign == "left") {
        _delegate->setTextAlign(TextAlign::LEFT);
    } else if (textAlign == "center" || textAlign == "middle") {
        _delegate->setTextAlign(TextAlign::CENTER);
    } else if (textAlign == "right") {
        _delegate->setTextAlign(TextAlign::RIGHT);
    } else {
        CC_ABORT();
    }
}

void CanvasRenderingContext2D::setTextBaseline(const ccstd::string &textBaseline) {
    //SE_LOGD("CanvasRenderingContext2D::set_textBaseline: %s\n", textBaseline.c_str());
    if (textBaseline == "top") {
        _delegate->setTextBaseline(TextBaseline::TOP);
    } else if (textBaseline == "middle") {
        _delegate->setTextBaseline(TextBaseline::MIDDLE);
    } else if (textBaseline == "bottom") //REFINE:, how to deal with alphabetic, currently we handle it as bottom mode.
    {
        _delegate->setTextBaseline(TextBaseline::BOTTOM);
    } else if (textBaseline == "alphabetic") {
        _delegate->setTextBaseline(TextBaseline::ALPHABETIC);
    } else {
        CC_ABORT();
    }
}

void CanvasRenderingContext2D::setFillStyle(const ccstd::string &fillStyle) {
    CSSColorParser::Color color = CSSColorParser::parse(fillStyle);
    _delegate->setFillStyle(color.r, color.g, color.b, static_cast<uint8_t>(color.a * 255));
    //SE_LOGD("CanvasRenderingContext2D::set_fillStyle: %s, (%d, %d, %d, %f)\n", fillStyle.c_str(), color.r, color.g, color.b, color.a);
}

void CanvasRenderingContext2D::setStrokeStyle(const ccstd::string &strokeStyle) {
    CSSColorParser::Color color = CSSColorParser::parse(strokeStyle);
    _delegate->setStrokeStyle(color.r, color.g, color.b, static_cast<uint8_t>(color.a * 255));
}

void CanvasRenderingContext2D::setShadowBlur(float blur) {
    _delegate->setShadowBlur(blur);
}

void CanvasRenderingContext2D::setShadowColor(const ccstd::string &shadowColor) {
    CSSColorParser::Color color = CSSColorParser::parse(shadowColor);
    _delegate->setShadowColor(color.r, color.g, color.b, static_cast<uint8_t>(color.a * 255));
}

void CanvasRenderingContext2D::setShadowOffsetX(float offsetX) {
    _delegate->setShadowOffsetX(offsetX);
}

void CanvasRenderingContext2D::setShadowOffsetY(float offsetY) {
    _delegate->setShadowOffsetY(offsetY);
}

void CanvasRenderingContext2D::setGlobalCompositeOperation(const ccstd::string &globalCompositeOperation) {
    //SE_LOGE("%s isn't implemented!\n", __FUNCTION__);
}

void CanvasRenderingContext2D::fillImageData(const Data &imageData, float imageWidth, float imageHeight, float offsetX, float offsetY) {
    recreateBufferIfNeeded();
    //SE_LOGE("%s isn't implemented!\n", __FUNCTION__);
#if CC_PLATFORM == CC_PLATFORM_WINDOWS
#elif CC_PLATFORM == CC_PLATFORM_ANDROID
    _delegate->fillImageData(imageData, imageWidth, imageHeight, offsetX, offsetY);
#endif
}
// transform
//REFINE:

void CanvasRenderingContext2D::translate(float x, float y) {
    //SE_LOGE("%s isn't implemented!\n", __FUNCTION__);
}

void CanvasRenderingContext2D::scale(float x, float y) {
    //SE_LOGE("%s isn't implemented!\n", __FUNCTION__);
}

void CanvasRenderingContext2D::rotate(float angle) {
    //SE_LOGE("%s isn't implemented!\n", __FUNCTION__);
}

void CanvasRenderingContext2D::transform(float a, float b, float c, float d, float e, float f) {
    //SE_LOGE("%s isn't implemented!\n", __FUNCTION__);
}

void CanvasRenderingContext2D::setTransform(float a, float b, float c, float d, float e, float f) {
    //SE_LOGE("%s isn't implemented!\n", __FUNCTION__);
}

void CanvasRenderingContext2D::recreateBufferIfNeeded() {
    if (_isBufferSizeDirty) {
        _isBufferSizeDirty = false;
        //SE_LOGD("Recreate buffer %p, w: %f, h:%f\n", this, __width, __height);
        _delegate->recreateBuffer(_width, _height);
    }
}

} // namespace cc
