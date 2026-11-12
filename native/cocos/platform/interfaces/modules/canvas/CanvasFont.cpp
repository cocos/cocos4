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

#include "platform/interfaces/modules/canvas/CanvasFont.h"

#include <cmath>
#include <cstdlib>
#include <limits>
#include <regex>
#include <string_view>

namespace cc::detail {
namespace {

bool isSpace(char c) {
    return c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\f';
}

bool isNewline(char c) {
    return c == '\n' || c == '\r' || c == '\f';
}

void skipSpace(std::string_view input, size_t &pos) {
    while (pos < input.size() && isSpace(input[pos])) ++pos;
}

int hexValue(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

void appendCodePoint(std::string &output, uint32_t code) {
    if (code == 0 || code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF)) code = 0xFFFD;
    if (code < 0x80) {
        output += static_cast<char>(code);
    } else if (code < 0x800) {
        output += static_cast<char>(0xC0 | (code >> 6));
        output += static_cast<char>(0x80 | (code & 0x3F));
    } else if (code < 0x10000) {
        output += static_cast<char>(0xE0 | (code >> 12));
        output += static_cast<char>(0x80 | ((code >> 6) & 0x3F));
        output += static_cast<char>(0x80 | (code & 0x3F));
    } else {
        output += static_cast<char>(0xF0 | (code >> 18));
        output += static_cast<char>(0x80 | ((code >> 12) & 0x3F));
        output += static_cast<char>(0x80 | ((code >> 6) & 0x3F));
        output += static_cast<char>(0x80 | (code & 0x3F));
    }
}

// https://www.w3.org/TR/css-syntax-3/#consume-an-escaped-code-point
bool readEscape(std::string_view input, size_t &pos, bool quoted, std::string &output) {
    if (++pos == input.size()) return false;
    if (isNewline(input[pos])) {
        if (!quoted) return false;
        if (input[pos++] == '\r' && pos < input.size() && input[pos] == '\n') ++pos;
        return true;
    }
    if (hexValue(input[pos]) >= 0) {
        uint32_t code = 0;
        for (int digits = 0; digits < 6 && pos < input.size() && hexValue(input[pos]) >= 0; ++digits) {
            code = code * 16 + static_cast<uint32_t>(hexValue(input[pos++]));
        }
        if (pos < input.size() && isSpace(input[pos])) {
            if (input[pos++] == '\r' && pos < input.size() && input[pos] == '\n') ++pos;
        }
        appendCodePoint(output, code);
    } else if (input[pos] == '\0') {
        appendCodePoint(output, 0);
        ++pos;
    } else {
        output += input[pos++];
    }
    return true;
}

bool decodeQuotedFamily(std::string_view input, std::string &family) {
    size_t pos = 0;
    skipSpace(input, pos);
    if (pos == input.size() || (input[pos] != '"' && input[pos] != '\'')) return false;
    const char quote = input[pos++];
    while (pos < input.size()) {
        const char c = input[pos];
        if (c == quote) {
            ++pos;
            skipSpace(input, pos);
            return pos == input.size() && !family.empty();
        }
        if (isNewline(c)) return false;
        if (c == '\\') {
            if (!readEscape(input, pos, true, family)) return false;
        } else if (c == '\0') {
            appendCodePoint(family, 0);
            ++pos;
        } else {
            family += c;
            ++pos;
        }
    }
    return false;
}

} // namespace

static CanvasFont parseLegacyCanvasFont(const std::string &font) {
#if CC_PLATFORM == CC_PLATFORM_WINDOWS

    std::string boldStr;
    std::string fontName = "Arial";
    std::string fontSizeStr = "30";

    std::regex re(R"(\s*((\d+)([\.]\d+)?)px\s+([^\r\n]*))");
    std::match_results<std::string::const_iterator> results;
    if (std::regex_search(font.cbegin(), font.cend(), results, re)) {
        fontSizeStr = results[2].str();
        // support get font name from `60px American` or `60px "American abc-abc_abc"`
        // support get font name contain space,example `times new roman`
        // if regex rule that does not conform to the rules,such as Chinese,it defaults to Arial
        std::match_results<std::string::const_iterator> fontResults;
        std::regex fontRe(R"(([\w\s-]+|"[\w\s-]+"$))");
        std::string tmp(results[4].str());
        if (std::regex_match(tmp, fontResults, fontRe)) {
            fontName = results[4].str();
        }
    }

    auto fontSize = static_cast<float>(atof(fontSizeStr.c_str()));
    bool isBold = !boldStr.empty() || font.find("bold", 0) != std::string::npos || font.find("Bold", 0) != std::string::npos;
    bool isItalic = font.find("italic", 0) != std::string::npos || font.find("Italic", 0) != std::string::npos;
    return {fontName, static_cast<float>(fontSize), isBold, isItalic, false, false};
#elif CC_PLATFORM == CC_PLATFORM_QNX

    std::string boldStr;
    std::string fontName = "Arial";
    std::string fontSizeStr = "30";

    // support get font name from `60px American` or `60px "American abc-abc_abc"`
    std::regex re("(bold)?\\s*((\\d+)([\\.]\\d+)?)px\\s+([\\w-]+|\"[\\w -]+\"$)");
    std::match_results<std::string::const_iterator> results;
    if (std::regex_search(font.cbegin(), font.cend(), results, re)) {
        boldStr = results[1].str();
        fontSizeStr = results[2].str();
        fontName = results[5].str();
    }
    bool isItalic = font.find("italic", 0) != std::string::npos || font.find("Italic", 0) != std::string::npos;
    auto fontSize = static_cast<float>(atof(fontSizeStr.c_str()));
    bool isBold = !boldStr.empty() || font.find("bold", 0) != std::string::npos || font.find("Bold", 0) != std::string::npos;
    // SE_LOGD("CanvasRenderingContext2D::setfont: %s, Size: %f, isBold: %b\n", fontName.c_str(), fontSize, isBold);
    return {fontName, fontSize, isBold, isItalic, false, false};
#elif CC_PLATFORM == CC_PLATFORM_LINUX

    std::string fontName = "sans-serif";
    std::string fontSizeStr = "30";
    std::regex re(R"(\s*((\d+)([\.]\d+)?)px\s+([^\r\n]*))");
    std::match_results<std::string::const_iterator> results;
    if (std::regex_search(font.cbegin(), font.cend(), results, re)) {
        fontSizeStr = results[2].str();
        // support get font name from `60px American` or `60px "American abc-abc_abc"`
        // support get font name contain space,example `times new roman`
        // if regex rule that does not conform to the rules,such as Chinese,it defaults to sans-serif
        std::match_results<std::string::const_iterator> fontResults;
        std::regex fontRe(R"(([\w\s-]+|"[\w\s-]+"$))");
        std::string tmp(results[4].str());
        if (std::regex_match(tmp, fontResults, fontRe)) {
            // fontName = results[4].str();
        }
    }

    bool isBold = font.find("bold", 0) != std::string::npos || font.find("Bold", 0) != std::string::npos;
    bool isItalic = font.find("italic", 0) != std::string::npos || font.find("Italic", 0) != std::string::npos;
    float fontSize = static_cast<float>(atof(fontSizeStr.c_str()));
    // SE_LOGD("CanvasRenderingContext2D::setfont: %s, Size: %f, isBold: %b\n", fontName.c_str(), fontSize, isBold);
    return {fontName, fontSize, isBold, isItalic, false, false};
#elif CC_PLATFORM == CC_PLATFORM_ANDROID || CC_PLATFORM == CC_PLATFORM_OHOS || CC_PLATFORM == CC_PLATFORM_OPENHARMONY
    std::string fontName = "sans-serif";
    std::string fontSizeStr = "30";
    std::regex re(R"(\s*((\d+)([\.]\d+)?)px\s+([^\r\n]*))");
    std::match_results<std::string::const_iterator> results;
    if (std::regex_search(font.cbegin(), font.cend(), results, re)) {
        fontSizeStr = results[2].str();
        // support get font name from `60px American` or `60px "American abc-abc_abc"`
        // support get font name contain space,example `times new roman`
        // if regex rule that does not conform to the rules,such as Chinese,it defaults to sans-serif
        std::match_results<std::string::const_iterator> fontResults;
        std::regex fontRe(R"(([\w\s-]+|"[\w\s-]+"$))");
        std::string tmp(results[4].str());
        if (std::regex_match(tmp, fontResults, fontRe)) {
            fontName = results[4].str();
        }
    }

    double fontSize = atof(fontSizeStr.c_str());
    bool isBold = font.find("bold", 0) != std::string::npos || font.find("Bold", 0) != std::string::npos;
    bool isItalic = font.find("italic", 0) != std::string::npos || font.find("Italic", 0) != std::string::npos;
    bool isSmallCaps = font.find("small-caps", 0) != std::string::npos || font.find("Small-Caps") != std::string::npos;
    bool isOblique = font.find("oblique", 0) != std::string::npos || font.find("Oblique", 0) != std::string::npos;
    // font-style: italic, oblique, normal
    // font-weight: normal, bold
    // font-variant: normal, small-caps
    return {fontName, static_cast<float>(fontSize), isBold, isItalic, isOblique, isSmallCaps};
#elif CC_PLATFORM == CC_PLATFORM_MACOS || CC_PLATFORM == CC_PLATFORM_IOS

    std::string boldStr;
    std::string fontName = "Arial";
    std::string fontSizeStr = "30";
    bool isItalic = font.find("italic", 0) != std::string::npos || font.find("Italic", 0) != std::string::npos;

    // support get font name from `60px American` or `60px "American abc-abc_abc"`
    std::regex re("(bold)?\\s*((\\d+)([\\.]\\d+)?)px\\s+([\\w-]+|\"[\\w -]+\"$)");
    std::match_results<std::string::const_iterator> results;
    if (std::regex_search(font.cbegin(), font.cend(), results, re)) {
        boldStr = results[1].str();
        fontSizeStr = results[2].str();
        fontName = results[5].str();
    }
    float fontSize = atof(fontSizeStr.c_str());
    bool isBold = !boldStr.empty() || font.find("bold", 0) != std::string::npos || font.find("Bold", 0) != std::string::npos;
    return {fontName, static_cast<float>(fontSize), isBold, isItalic, false, false};
#endif
    return {};
}

CanvasFont parseCanvasFont(const std::string &font) {
    static const std::regex DESCRIPTION(R"(\s*((\d+)([\.]\d+)?)px\s+([\s\S]*))");
    std::smatch match;
    std::string family;
    if (!std::regex_search(font, match, DESCRIPTION) || !decodeQuotedFamily(match[4].str(), family)) {
        return parseLegacyCanvasFont(font);
    }

    // Recover the descriptor used before TS serialized the asset's registered alias.
    // Use it only when the old platform parser recognizes that complete alias;
    // partial matches and unsupported names keep the original fallback behavior.
    const auto legacyDescription = font.substr(0, static_cast<size_t>(match.position(4))) + family;
    auto compatible = parseLegacyCanvasFont(legacyDescription);
    if (compatible.family == family) {
        return compatible;
    }
    auto fallback = parseLegacyCanvasFont(font);
#if CC_PLATFORM == CC_PLATFORM_MACOS || CC_PLATFORM == CC_PLATFORM_IOS || CC_PLATFORM == CC_PLATFORM_QNX
    // These platforms used to lose the size when the family was rejected.
    // Recover it only for complete quoted families with an engine-supported
    // style prefix. Keep the fallback family and existing style flags intact.
    static const std::regex STYLE_PREFIX(R"(\s*(?:(?:normal|bold|italic|oblique|small-caps)\s+)*)", std::regex::icase);
    if (std::regex_match(font.cbegin(), font.cbegin() + match.position(1), STYLE_PREFIX)) {
        const auto size = static_cast<float>(atof(match[1].str().c_str()));
        // Native backends may narrow sizes to int. Do not recover unsafe values.
        if (std::isfinite(size) && size >= 0.F && static_cast<double>(size) <= std::numeric_limits<int>::max()) {
            fallback.size = size;
        }
    }
#endif
    return fallback;
}

} // namespace cc::detail
