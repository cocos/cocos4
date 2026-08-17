/*
 Copyright (c) 2025 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

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

// Runtime-selectable spine version. Used only when both spine-3.8 and spine-4.2 are compiled into the
// engine (editor/preview): cc.config.json's moduleOverrides then replaces spine-version.ts with this file.
// Unlike the fixed-version files (spine-version-3.8.ts / -4.2.ts), SPINE_VERSION is a mutable `let`
// (a live ES binding), so the shared layer (spine-define.ts / skeleton.ts) reads the runtime value and
// keeps both `SPINE_VERSION === '3.8' / '4.2'` branches instead of tree-shaking to a single one.
// The version is set by spine-instantiate-dynamic.ts before instantiation, sourced from the host-provided
// globalThis._CC_SPINE_VERSION (injected by the preview boot from cocos.config.json).
import { DataInput, SkeletonBinary } from './spine-binary';
import { BUILD } from 'internal:constants';

// Typed as string so comparisons in the shared layer against the other version literal are not flagged by TS.
export let SPINE_VERSION: string = '3.8';

/**
 * Sets the current spine version. Must be called before spine wasm instantiation and before spine-define runs.
 */
export function setSpineVersion (version: string): void {
    SPINE_VERSION = version === '4.2' ? '4.2' : '3.8';
}

function isVersionCompatible (version: string | null): boolean {
    if (!BUILD) {
        if (SPINE_VERSION === '3.8') {
            if (!version || version === '3.8.75' || !version.startsWith('3.8.')) {
                return false;
            }
        } else {
            if (!version || !version.startsWith('4.2.')) {
                return false;
            }
        }
    }
    return true;
}

/**
 * @internal Used only by editor.
 */
export function isBinaryCompatible (buffer: Uint8Array): boolean {
    if (!BUILD) {
        const input = new DataInput(buffer);
        // The binary hash header differs between versions: 3.8 uses one string, 4.2 uses two ints.
        if (SPINE_VERSION === '3.8') {
            SkeletonBinary.readString(input); // read hash
        } else {
            SkeletonBinary.readInt(input); // read hash
            SkeletonBinary.readInt(input); // read hash
        }
        const version = SkeletonBinary.readString(input);

        return isVersionCompatible(version);
    }
    return false;
}

/**
 * @internal Used only by editor.
 */
export function isJsonCompatible (json: JSON): boolean {
    if (!BUILD) {
        return isVersionCompatible(json['skeleton']['spine']);
    }
    return false;
}
