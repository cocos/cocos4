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

#include <unordered_map>
#include "gtest/gtest.h"
#include "platform/interfaces/modules/canvas/CanvasFont.h"

namespace {

std::string expectedFamily(const std::string &family) {
#if CC_PLATFORM == CC_PLATFORM_LINUX
    return "sans-serif";
#else
    return family;
#endif
}

} // namespace

using cc::detail::parseCanvasFont;

TEST(CanvasFontCompatibilityTest, ExplicitSerializationKeepsCollidingAliasesDistinct) {
    // Quotes in a registered key are data; quotes in the descriptor are CSS syntax.
    const std::unordered_map<std::string, std::string> registry = {
        {"Example_LABEL", "plain.ttf"},
        {R"("Example_LABEL")", "literal-quotes.ttf"},
        {"sans-serif", "system"},
    };
    const char *plain = R"(40px "Example_LABEL")";
    const char *literalQuotes = R"(40px "\"Example_LABEL\"")";
    const auto plainFont = parseCanvasFont(plain);
    const auto quotedFont = parseCanvasFont(literalQuotes);
    EXPECT_EQ(plainFont.family, expectedFamily("Example_LABEL"));
    EXPECT_EQ(quotedFont.family, expectedFamily(R"("Example_LABEL")"));
#if CC_PLATFORM == CC_PLATFORM_LINUX
    EXPECT_EQ(registry.at(plainFont.family), "system");
    EXPECT_EQ(registry.at(quotedFont.family), "system");
#else
    EXPECT_EQ(registry.at(plainFont.family), "plain.ttf");
    EXPECT_EQ(registry.at(quotedFont.family), "literal-quotes.ttf");
#endif
}

TEST(CanvasFontCompatibilityTest, MigratedAliasesKeepLegacySizeAndStyles) {
    const char *description = R"(italic bold 12.5px "\"My Font_LABEL\"")";
    const auto font = parseCanvasFont(description);
    EXPECT_EQ(font.family, expectedFamily(R"("My Font_LABEL")"));
#if CC_PLATFORM == CC_PLATFORM_MACOS || CC_PLATFORM == CC_PLATFORM_IOS || CC_PLATFORM == CC_PLATFORM_QNX
    EXPECT_FLOAT_EQ(font.size, 12.5F);
#else
    EXPECT_FLOAT_EQ(font.size, 12.F);
#endif
    EXPECT_TRUE(font.bold);
    EXPECT_TRUE(font.italic);
}

TEST(CanvasFontCompatibilityTest, DoesNotDecodeLiteralQuotesTwice) {
    const char *escaped = R"(40px "\"Example_LABEL\"")";
    const char *hexEscaped = R"(40px "\22 Example_LABEL\22 ")";
    const auto expected = expectedFamily(R"("Example_LABEL")");
    EXPECT_EQ(parseCanvasFont(escaped).family, expected);
    EXPECT_EQ(parseCanvasFont(hexEscaped).family, expected);
}
