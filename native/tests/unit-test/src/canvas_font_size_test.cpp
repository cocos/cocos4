/*
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

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

#include "gtest/gtest.h"
#include "platform/interfaces/modules/canvas/CanvasFont.h"

using cc::detail::parseCanvasFont;

namespace {
const char *fallbackFamily() {
#if CC_PLATFORM == CC_PLATFORM_ANDROID || CC_PLATFORM == CC_PLATFORM_OHOS || CC_PLATFORM == CC_PLATFORM_OPENHARMONY || CC_PLATFORM == CC_PLATFORM_LINUX
    return "sans-serif";
#else
    return "Arial";
#endif
}
} // namespace

TEST(CanvasFontSizeTest, KeepsTheRequestedSizeWhenAQuotedNameIsRejected) {
    for (const char *input : {u8R"(48px "中文体")", R"(48px "Family3.0")", R"(48px "A, B")", R"(48px "A\a B")"}) {
        SCOPED_TRACE(input);
        const auto font = parseCanvasFont(input);
        EXPECT_EQ(font.family, fallbackFamily());
        EXPECT_FLOAT_EQ(font.size, 48.F);
    }
}

TEST(CanvasFontSizeTest, KeepsPlatformSizeConversionAndFallbackStyles) {
    const auto font = parseCanvasFont(u8R"(italic bold 48.5px "中文体")");
    EXPECT_EQ(font.family, fallbackFamily());
    EXPECT_TRUE(font.bold);
    EXPECT_TRUE(font.italic);
#if CC_PLATFORM == CC_PLATFORM_MACOS || CC_PLATFORM == CC_PLATFORM_IOS || CC_PLATFORM == CC_PLATFORM_QNX
    EXPECT_FLOAT_EQ(font.size, 48.5F);
#else
    EXPECT_FLOAT_EQ(font.size, 48.F);
#endif
}

TEST(CanvasFontSizeTest, DoesNotRelaxMalformedDescriptions) {
    for (const char *input : {u8R"(bad 48px "中文体")", "48px \"unterminated", u8R"(48px "中文体", Arial)"}) {
        SCOPED_TRACE(input);
        const auto font = parseCanvasFont(input);
        EXPECT_EQ(font.family, fallbackFamily());
#if CC_PLATFORM == CC_PLATFORM_MACOS || CC_PLATFORM == CC_PLATFORM_IOS || CC_PLATFORM == CC_PLATFORM_QNX
        EXPECT_FLOAT_EQ(font.size, 30.F);
#else
        EXPECT_FLOAT_EQ(font.size, 48.F);
#endif
    }
}

TEST(CanvasFontSizeTest, RejectsUnsafeSizesOnTheRecoveredFallbackPath) {
#if CC_PLATFORM == CC_PLATFORM_MACOS || CC_PLATFORM == CC_PLATFORM_IOS || CC_PLATFORM == CC_PLATFORM_QNX
    for (const auto &number : {std::string("-1"), std::string(".5"), std::string("2147483648"), std::string(400, '9')}) {
        SCOPED_TRACE(number);
        const auto font = parseCanvasFont(number + u8R"(px "中文体")");
        EXPECT_EQ(font.family, fallbackFamily());
        EXPECT_FLOAT_EQ(font.size, 30.F);
    }
#endif
}
