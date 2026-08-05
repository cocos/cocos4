/*
 Copyright (c) 2023 Xiamen Yaji Software Co., Ltd.

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

import { instantiateWasm, ensureWasmModuleReady } from 'pal/wasm';
import { DEBUG } from 'internal:constants';
import { warn } from '../../../cocos/core/platform/debug';
import type { IAnimatedImageDecoder, IDecodedFrame } from '../type';

// This is the bundled fallback backend. It drives the libwebp `WebPAnimDecoder` compiled to WASM,
// vendored from the MIT-licensed `webpxmux` package (which embeds BSD-licensed libwebp). The glue
// (`webpxmux.js`) and the binary (`webpxmux.wasm`) live under `native/external/emscripten/webp/`
// and are loaded through the engine's `external:` protocol + `pal/wasm`, exactly like the spine /
// box2d / meshopt WASM modules.
//
// `decodeFrames(dataPtr, dataSize)` demuxes + decodes the whole animation in one call and returns a
// pointer to a flattened byte-stream (FBS) laid out as `uint32` cells:
//   [0] frameCount (dup), [1] frameCount, [2] width, [3] height, [4] loopCount, [5] bgColor,
//   then per frame: [duration(ms), isKeyframe, w*h RGBA pixels...].
// Each pixel `uint32` reads as 0xRRGGBBAA (libwebp decodes to MODE_RGBA, then webpxmux byte-swaps so
// the value is intuitive), so we serialize it big-endian into R,G,B,A bytes for RGBA8888 upload.

const FBS_HEADER = 6;         // uint32 cells before the first frame
const FBS_FRAME_HEADER = 2;   // uint32 cells (duration, isKeyframe) before each frame's pixels

interface WebpXMuxModule {
    cwrap (ident: string, returnType: string, argTypes: string[]): (...args: number[]) => number;
    _malloc (size: number): number;
    _free (ptr: number): void;
    // NOTE: HEAPU8/HEAPU32 must be re-read after any allocation — the underlying ArrayBuffer is
    // replaced (detached) when emscripten grows its linear memory.
    HEAPU8: Uint8Array;
    decodeFrames?: (dataPtr: number, dataSize: number) => number;
}

type WebpXMuxFactory = (moduleOptions: {
    instantiateWasm (
        importObject: WebAssembly.Imports,
        receiveInstance: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
    ): void;
}) => Promise<WebpXMuxModule>;

let modulePromise: Promise<WebpXMuxModule> | null = null;

function loadModule (): Promise<WebpXMuxModule> {
    if (!modulePromise) {
        modulePromise = ensureWasmModuleReady().then(() => Promise.all([
            import('external:emscripten/webp/webpxmux.js'),
            import('external:emscripten/webp/webpxmux.wasm'),
        ])).then(([{ default: factory }, { default: wasmUrl }]) => (factory as WebpXMuxFactory)({
            instantiateWasm (importObject, receiveInstance): void {
                // NOTE: the Promise returned by the instantiateWasm hook can't be awaited by emscripten.
                instantiateWasm(wasmUrl as string, importObject).then((result) => {
                    receiveInstance(result.instance, result.module);
                }).catch((e) => {
                    if (DEBUG) {
                        warn(`Failed to instantiate the animated webp wasm module: ${e}`);
                    }
                });
            },
        })).then((mod) => {
            mod.decodeFrames = mod.cwrap('decodeFrames', 'number', ['number', 'number']);
            return mod;
        }).catch((e) => {
            // reset so a later attempt can retry (e.g. after the wasm subpackage is downloaded)
            modulePromise = null;
            throw e;
        });
    }
    return modulePromise;
}

class WebpWasmDecoder implements IAnimatedImageDecoder {
    public readonly width: number;
    public readonly height: number;
    public readonly frameCount: number;
    public readonly loopCount: number;

    private _frames: IDecodedFrame[];

    constructor (width: number, height: number, loopCount: number, frames: IDecodedFrame[]) {
        this.width = width;
        this.height = height;
        this.frameCount = frames.length;
        this.loopCount = loopCount;
        this._frames = frames;
    }

    public decodeFrame (index: number): Promise<IDecodedFrame> {
        // webpxmux decodes the whole animation up front, so this is a cache lookup.
        if (index < 0 || index >= this._frames.length) {
            return Promise.reject(new Error(`frame index ${index} out of range [0, ${this._frames.length})`));
        }
        return Promise.resolve(this._frames[index]);
    }

    public destroy (): void {
        this._frames = [];
    }
}

function decodeAllFrames (mod: WebpXMuxModule, bytes: Uint8Array): WebpWasmDecoder {
    const size = bytes.byteLength;
    const inPtr = mod._malloc(size);
    if (!inPtr) {
        throw new Error('failed to allocate wasm memory for webp bytes');
    }
    // fresh view: HEAPU8 may point at a stale (detached) buffer after the malloc above grew memory.
    new Uint8Array(mod.HEAPU8.buffer, inPtr, size).set(bytes);

    const bsPtr = mod.decodeFrames!(inPtr, size);
    mod._free(inPtr);
    if (bsPtr < 0) {
        throw new Error(`libwebp failed to decode the animated webp (code ${bsPtr})`);
    }

    // Read back the flattened byte-stream. No further allocation happens here, so a single view is safe.
    const heap = mod.HEAPU8.buffer;
    const u32 = new Uint32Array(heap);
    const base = bsPtr >>> 2;
    const frameCount = u32[base + 1];
    const width = u32[base + 2];
    const height = u32[base + 3];
    const loopCount = u32[base + 4];

    const pixelCount = width * height;
    const frameStride = FBS_FRAME_HEADER + pixelCount; // in uint32 cells
    const frames: IDecodedFrame[] = new Array(frameCount);
    for (let i = 0; i < frameCount; ++i) {
        const f = base + FBS_HEADER + i * frameStride;
        const duration = u32[f];
        const pixels = f + FBS_FRAME_HEADER;
        const data = new Uint8Array(pixelCount * 4);
        for (let p = 0; p < pixelCount; ++p) {
            const v = u32[pixels + p]; // 0xRRGGBBAA
            const o = p * 4;
            data[o] = (v >>> 24) & 0xff;      // R
            data[o + 1] = (v >>> 16) & 0xff;  // G
            data[o + 2] = (v >>> 8) & 0xff;   // B
            data[o + 3] = v & 0xff;           // A
        }
        frames[i] = { data, duration };
    }
    mod._free(bsPtr);

    return new WebpWasmDecoder(width, height, loopCount, frames);
}

/**
 * @en Creates an animated image decoder backed by the bundled libwebp WASM module.
 * @zh 使用自带的 libwebp WASM 模块创建动画图片解码器。
 */
export async function createWasmDecoder (bytes: Uint8Array): Promise<IAnimatedImageDecoder> {
    const mod = await loadModule();
    return decodeAllFrames(mod, bytes);
}

/**
 * @en Whether the bundled WASM backend is expected to be usable on this platform.
 * @zh 自带 WASM 后端在当前平台是否预期可用。
 */
export function isWasmDecoderSupported (): boolean {
    try {
        return typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
    } catch (e) {
        if (DEBUG) {
            warn('WebAssembly is not available for the animated webp fallback decoder.');
        }
        return false;
    }
}
