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

/** A CSS family expression, distinct from an asset's raw font name. */
export type CssFontFamily = string & { readonly __cssFontFamily: unique symbol };

export const DEFAULT_FONT_FAMILY = 'Arial' as CssFontFamily;

/** Serialize one raw family name as a CSS string, preserving literal quotes and commas. */
export function quoteFontFamily (name: string): CssFontFamily {
    let result = '"';
    for (const character of name) {
        const code = character.codePointAt(0)!;
        if (code === 0 || (code >= 0xD800 && code <= 0xDFFF)) {
            result += '\uFFFD';
        } else if (code <= 0x1F || code === 0x7F) {
            result += `\\${code.toString(16)} `;
        } else if (character === '"' || character === '\\') {
            result += `\\${character}`;
        } else {
            result += character;
        }
    }
    return `${result}"` as CssFontFamily;
}

interface FontFamilySource {
    readonly useSystemFont: boolean;
    readonly fontFamily: string;
    readonly font: { readonly _nativeAsset: unknown } | null;
}

/** Resolve at the component boundary, before measurement, drawing or CSS assignment. */
export function getCanvasFontFamily (source: FontFamilySource): CssFontFamily {
    const system = source.useSystemFont;
    const value = system ? source.fontFamily : source.font?._nativeAsset;
    const name = typeof value === 'string' && value ? value : DEFAULT_FONT_FAMILY;
    return system ? name as CssFontFamily : quoteFontFamily(name);
}

/** Family is already serialized: changing size or style must never quote it again. */
export function buildFontDesc (size: number, family: CssFontFamily, bold = false, italic = false): string {
    return `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px ${family}`;
}
