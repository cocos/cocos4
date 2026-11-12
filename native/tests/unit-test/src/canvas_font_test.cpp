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

TEST(CanvasFontTest, RestoresPreviouslyRecognizedAssetAliases) {
    const struct {
        const char *description;
        const char *alias;
    } cases[] = {
        {R"(40px "Example_LABEL")", "Example_LABEL"},
        {R"(40px "AlibabaPuHuiTi-3-105-Heavy_LABEL")", "AlibabaPuHuiTi-3-105-Heavy_LABEL"},
        {R"(40px "\"My Font_LABEL\"")", R"("My Font_LABEL")"},
        {R"(40px "Demo12px")", "Demo12px"},
        {R"(40px 'Example_LABEL')", "Example_LABEL"},
    };
    for (const auto &item : cases) {
        SCOPED_TRACE(item.description);
        const auto font = parseCanvasFont(item.description);
#if CC_PLATFORM == CC_PLATFORM_LINUX
        EXPECT_EQ(font.family, "sans-serif");
#else
        EXPECT_EQ(font.family, item.alias);
#endif
        EXPECT_FLOAT_EQ(font.size, 40.F);
    }
}

TEST(CanvasFontTest, DoesNotExpandNativeFontNameSupport) {
    for (const char *input : {u8R"(48px "中文体")", R"(48px "Family3.0")", R"(48px "A, B")",
                              R"(48px "A\"B")", R"(48px "\\61")", R"(48px "\0 \d800 \110000 ")",
                              R"(48px "\"Family 3.0_LABEL\"")", R"(48px "A\a B")"}) {
        SCOPED_TRACE(input);
        EXPECT_EQ(parseCanvasFont(input).family, fallbackFamily());
    }
}

TEST(CanvasFontTest, ChecksDecodedNamesUsingTheExistingPolicy) {
    for (const char *input : {R"(40px "\52 egular")", R"(40px "\000052egular")", "40px \"Reg\\\r\nular\""}) {
        SCOPED_TRACE(input);
#if CC_PLATFORM == CC_PLATFORM_LINUX
        EXPECT_EQ(parseCanvasFont(input).family, "sans-serif");
#else
        EXPECT_EQ(parseCanvasFont(input).family, "Regular");
#endif
    }
    EXPECT_EQ(parseCanvasFont(R"(40px "\4e2d \6587 ")").family, fallbackFamily());
}

TEST(CanvasFontTest, PreservesLegacyStyleAndFractionalSizeRules) {
    const auto font = parseCanvasFont(R"(12.5px "BoldItalicOblique-small-caps_LABEL")");
#if CC_PLATFORM == CC_PLATFORM_MACOS || CC_PLATFORM == CC_PLATFORM_IOS || CC_PLATFORM == CC_PLATFORM_QNX
    EXPECT_FLOAT_EQ(font.size, 12.5F);
#else
    EXPECT_FLOAT_EQ(font.size, 12.F);
#endif
    EXPECT_TRUE(font.bold);
    EXPECT_TRUE(font.italic);
#if CC_PLATFORM == CC_PLATFORM_ANDROID || CC_PLATFORM == CC_PLATFORM_OHOS || CC_PLATFORM == CC_PLATFORM_OPENHARMONY
    EXPECT_TRUE(font.oblique);
    EXPECT_TRUE(font.smallCaps);
#else
    EXPECT_FALSE(font.oblique);
    EXPECT_FALSE(font.smallCaps);
#endif
}

TEST(CanvasFontTest, KeepsListsAndMalformedQuotesOnTheLegacyPath) {
    for (const char *input : {R"(48px "A, B", Arial)", R"(48px "A" extra)", "48px \"unterminated"}) {
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

TEST(CanvasFontTest, LeavesUnquotedNamesAndExistingDefaultsUnchanged) {
    const auto invalid = parseCanvasFont("bad description");
    EXPECT_EQ(invalid.family, fallbackFamily());
    EXPECT_FLOAT_EQ(invalid.size, 30.F);
    const auto unquoted = parseCanvasFont("40px Times  New Roman");
#if CC_PLATFORM == CC_PLATFORM_MACOS || CC_PLATFORM == CC_PLATFORM_IOS || CC_PLATFORM == CC_PLATFORM_QNX
    EXPECT_EQ(unquoted.family, "Times");
#elif CC_PLATFORM == CC_PLATFORM_LINUX
    EXPECT_EQ(unquoted.family, "sans-serif");
#else
    EXPECT_EQ(unquoted.family, "Times  New Roman");
#endif
}
