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

// Runtime-selectable spine instantiation. Used only when both spine-3.8 and spine-4.2 are compiled into
// the engine (editor/preview): cc.config.json's moduleOverrides then replaces spine-instantiate.ts with
// this file. Unlike the fixed-version files (spine-instantiate-3.8.ts / -4.2.ts), both the 3.8 and 4.2
// external references are kept here (so both wasm/asm binaries are bundled), and the matching one is
// executed at runtime according to the selected version.
// The version comes from the preview boot (game-boot.js / engine-bootstrap.ts), which reads it from
// cocos.config.json before engine init and writes globalThis._CC_SPINE_VERSION.

import { ensureWasmModuleReady } from 'pal/wasm';
import { error } from '../../core';
import { shouldUseWasmModule, initWasm, initAsmJS } from './spine-wasm-utils';
// Import setSpineVersion through the overridden './spine-version' (= spine-version-dynamic) so it is the
// same module instance whose SPINE_VERSION live binding is read by the shared spine-define.ts.
import { setSpineVersion } from './spine-version';

function getSelectedSpineVersion (): string {
    const v = (globalThis as any)._CC_SPINE_VERSION;
    return v === '4.2' ? '4.2' : '3.8';
}

export function waitForSpineWasmInstantiation (): Promise<void> {
    const errorReport = (msg: any): void => { error(msg); };
    // The version must be set before wasm instantiation and before spine-define patches prototypes.
    const version = getSelectedSpineVersion();
    setSpineVersion(version);
    return ensureWasmModuleReady().then((): Promise<void> => {
        //We should use static code here, import operation will cause file copy to cache folder.
        if (version === '4.2') {
            if (shouldUseWasmModule()) {
                return Promise.all([
                    import('external:emscripten/spine/4.2/spine.wasm.js'),
                    import('external:emscripten/spine/4.2/spine.wasm'),
                ]).then(([
                    { default: wasmFactory },
                    { default: spineWasmUrl },
                ]) => initWasm(wasmFactory, spineWasmUrl));
            } else {
                return Promise.all([
                    import('external:emscripten/spine/4.2/spine.asm.js'),
                    import('external:emscripten/spine/4.2/spine.js.mem'),
                ]).then(([
                    { default: asmFactory },
                    { default: asmJsMemUrl },
                ]) => initAsmJS(asmFactory, asmJsMemUrl));
            }
        } else {
            if (shouldUseWasmModule()) {
                return Promise.all([
                    import('external:emscripten/spine/3.8/spine.wasm.js'),
                    import('external:emscripten/spine/3.8/spine.wasm'),
                ]).then(([
                    { default: wasmFactory },
                    { default: spineWasmUrl },
                ]) => initWasm(wasmFactory, spineWasmUrl));
            } else {
                return Promise.all([
                    import('external:emscripten/spine/3.8/spine.asm.js'),
                    import('external:emscripten/spine/3.8/spine.js.mem'),
                ]).then(([
                    { default: asmFactory },
                    { default: asmJsMemUrl },
                ]) => initAsmJS(asmFactory, asmJsMemUrl));
            }
        }
    }).catch(errorReport);
}
