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

import { DEBUG } from 'internal:constants';
import { checkPalIntegrity, withImpl } from '../../integrity-check';
import { warn } from '../../../cocos/core/platform/debug';
import type { IAnimatedImageDecoder, IDecodedFrame } from '../type';
import { createWasmDecoder, isWasmDecoderSupported } from '../wasm/webp-wasm-decoder';

// Minimal ambient shape of the WebCodecs `ImageDecoder`/`VideoFrame` APIs. They are not yet part of
// the TS lib the engine builds against, so we describe just what we use here and access them dynamically.
interface WebImageDecoderTrack {
    frameCount: number;
    repetitionCount: number;
}
interface WebImageDecoderResult {
    image: {
        displayWidth: number;
        displayHeight: number;
        duration: number | null;   // microseconds
        close (): void;
    };
    complete: boolean;
}
interface WebImageDecoder {
    tracks: { ready: Promise<void>; selectedTrack: WebImageDecoderTrack | null };
    decode (options: { frameIndex: number }): Promise<WebImageDecoderResult>;
    close (): void;
}
interface WebImageDecoderCtor {
    new (init: { data: BufferSource; type: string }): WebImageDecoder;
    isTypeSupported (type: string): Promise<boolean>;
}

function getImageDecoderCtor (): WebImageDecoderCtor | undefined {
    return (globalThis as { ImageDecoder?: WebImageDecoderCtor }).ImageDecoder;
}

class WebCodecsDecoder implements IAnimatedImageDecoder {
    public readonly width: number;
    public readonly height: number;
    public readonly frameCount: number;
    public readonly loopCount: number;

    private _decoder: WebImageDecoder | null;
    private _canvas: OffscreenCanvas | HTMLCanvasElement;
    private _ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

    constructor (decoder: WebImageDecoder, width: number, height: number, frameCount: number, loopCount: number) {
        this._decoder = decoder;
        this.width = width;
        this.height = height;
        this.frameCount = frameCount;
        this.loopCount = loopCount;
        if (typeof OffscreenCanvas !== 'undefined') {
            this._canvas = new OffscreenCanvas(width, height);
        } else {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            this._canvas = canvas;
        }
        this._ctx = this._canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    }

    public async decodeFrame (index: number): Promise<IDecodedFrame> {
        if (!this._decoder) {
            throw new Error('animated webp decoder has been destroyed');
        }
        const result = await this._decoder.decode({ frameIndex: index });
        const videoFrame = result.image;
        try {
            // VideoFrame is drawable; read back its pixels as RGBA8888.
            this._ctx.drawImage(videoFrame as unknown as CanvasImageSource, 0, 0);
            const imageData = this._ctx.getImageData(0, 0, this.width, this.height);
            const data = new Uint8Array(imageData.data.buffer.slice(0));
            // VideoFrame.duration is in microseconds; convert to milliseconds.
            const duration = videoFrame.duration != null ? videoFrame.duration / 1000 : 0;
            return { data, duration };
        } finally {
            videoFrame.close();
        }
    }

    public destroy (): void {
        if (this._decoder) {
            this._decoder.close();
            this._decoder = null;
        }
    }
}

export function isNativeAnimatedSupported (mime: string): boolean {
    return typeof getImageDecoderCtor() !== 'undefined';
}

// Debug/test switch: set `globalThis.__forceWebpWasmDecoder = true` (or `AnimatedImagePlayer.forceWasmDecoder = true`)
// to bypass the native WebCodecs path and exercise the bundled WASM fallback chain on platforms that
// do have a native decoder (e.g. Chrome). Reading an unset global is free, so this stays zero-cost in production.
function shouldForceWasm (): boolean {
    return (globalThis as { __forceWebpWasmDecoder?: boolean }).__forceWebpWasmDecoder === true;
}

async function tryCreateNative (bytes: Uint8Array, mime: string): Promise<IAnimatedImageDecoder | null> {
    const Ctor = getImageDecoderCtor();
    if (!Ctor) {
        return null;
    }
    try {
        if (typeof Ctor.isTypeSupported === 'function' && !(await Ctor.isTypeSupported(mime))) {
            return null;
        }
        const decoder = new Ctor({ data: bytes, type: mime });
        await decoder.tracks.ready;
        const track = decoder.tracks.selectedTrack;
        if (!track || !track.frameCount) {
            decoder.close();
            return null;
        }
        // decode frame 0 to learn the display size.
        const first = await decoder.decode({ frameIndex: 0 });
        const width = first.image.displayWidth;
        const height = first.image.displayHeight;
        first.image.close();
        const repetition = track.repetitionCount;
        const loopCount = (repetition === Infinity || repetition < 0) ? 0 : repetition;
        return new WebCodecsDecoder(decoder, width, height, track.frameCount, loopCount);
    } catch (e) {
        if (DEBUG) {
            warn(`WebCodecs ImageDecoder failed, falling back to WASM: ${e}`);
        }
        return null;
    }
}

export async function createAnimatedDecoder (bytes: Uint8Array, mime: string): Promise<IAnimatedImageDecoder> {
    if (shouldForceWasm()) {
        if (DEBUG) {
            warn('[animated-image] __forceWebpWasmDecoder is on: skipping native WebCodecs and using the WASM fallback.');
        }
        if (isWasmDecoderSupported()) {
            return createWasmDecoder(bytes);
        }
        if (DEBUG) {
            warn('[animated-image] WASM fallback is unavailable; reverting to the native decoder.');
        }
    }
    const native = await tryCreateNative(bytes, mime);
    if (native) {
        return native;
    }
    if (isWasmDecoderSupported()) {
        return createWasmDecoder(bytes);
    }
    throw new Error(`No animated image decoder available for ${mime} on this platform.`);
}

checkPalIntegrity<typeof import('pal/image-decoder')>(withImpl<typeof import('./image-decoder-web')>());
