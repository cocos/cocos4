/*
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is furnished
 to do so, subject to the following conditions:

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

import { instantiateWasm, fetchBuffer, fetchUrl, ensureWasmModuleReady } from 'pal/wasm';

/**
 * @en
 * The engine's packaged cross-platform WebAssembly interface (pal/wasm).
 *
 * Re-exported under the public `cc.wasm` namespace so extension/game code can
 * load its own `.wasm` files through the same platform-adaptive path the engine
 * uses internally for box2d / physx / spine / webgpu:
 *
 *   - web:      fetch the `.wasm` bytes, then `WebAssembly.instantiate`;
 *   - mini-game: resolve the path into `cocos-js/` and delegate to the platform's
 *               `CCWebAssembly.instantiate` (which accepts a file path, never
 *               raw bytes — this is why embedded-base64 wasm fails there);
 *   - native:   read the file from `src/cocos-js/` via `fileUtils`.
 *
 * The `wasmUrl` argument is a bare file name (e.g. `'foo.wasm'`) whose file is
 * expected to land in the build output's `cocos-js/` directory.
 * @zh
 * 引擎封装好的跨平台 WebAssembly 接口（pal/wasm），通过 `cc.wasm` 命名空间公开，
 * 供扩展/游戏代码用与引擎内部一致的路径加载自己的 `.wasm`。
 */
export const wasm = {
    instantiateWasm,
    fetchBuffer,
    fetchUrl,
    ensureWasmModuleReady,
};
