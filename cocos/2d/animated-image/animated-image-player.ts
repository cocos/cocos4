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

import { createAnimatedDecoder, isNativeAnimatedSupported } from 'pal/image-decoder';
import type { IAnimatedImageDecoder, IDecodedFrame } from 'pal/image-decoder/type';
import { DEBUG } from 'internal:constants';
import { Texture2D } from '../../asset/assets/texture-2d';
import { PixelFormat } from '../../asset/assets/asset-enum';
import { SpriteFrame } from '../assets/sprite-frame';
import { warn } from '../../core/platform/debug';

/**
 * @en Playback state of an [[AnimatedImagePlayer]].
 * @zh [[AnimatedImagePlayer]] 的播放状态。
 */
export enum AnimatedImagePlayerState {
    /** @en Not yet loaded. @zh 尚未加载完成。 */
    INIT,
    /** @en Playing. @zh 正在播放。 */
    PLAYING,
    /** @en Paused. @zh 已暂停。 */
    PAUSED,
    /** @en Stopped (reset to frame 0). @zh 已停止（回到第 0 帧）。 */
    STOPPED,
}

/**
 * @en
 * Low-level player for animated images (animated WebP). It owns a decoder (WebCodecs / minigame / WASM,
 * selected per platform), a reusable [[Texture2D]] whose pixels are refreshed in place every frame, and a
 * [[SpriteFrame]] you can bind to any [[Sprite]]. Drive it by calling [[tick]] with the frame delta time.
 *
 * The texture object identity never changes across frames — only its GPU pixels are overwritten via
 * `Texture2D.uploadData`, so no dirty notification to the renderer is required.
 * @zh
 * 动画图片（动画 WebP）的底层播放器。内部持有一个解码器（按平台选择 WebCodecs / 小游戏 / WASM）、
 * 一个每帧原地刷新像素的可复用 [[Texture2D]]，以及一个可绑定到任意 [[Sprite]] 的 [[SpriteFrame]]。
 * 通过每帧调用 [[tick]] 并传入帧间隔时间来驱动播放。
 *
 * 纹理对象在整个播放过程中身份不变——每帧只通过 `Texture2D.uploadData` 覆盖其 GPU 像素，
 * 因此无需向渲染器发送任何脏标记。
 */
export class AnimatedImagePlayer {
    /**
     * @en Creates a player from raw encoded image bytes.
     * @zh 从原始编码图片字节创建播放器。
     * @param bytes @en The raw encoded bytes (e.g. a `.webp` file content). @zh 原始编码字节（如 `.webp` 文件内容）。
     * @param mime @en The mime type, defaults to `image/webp`. @zh mime 类型，默认为 `image/webp`。
     */
    public static async create (bytes: Uint8Array, mime = 'image/webp'): Promise<AnimatedImagePlayer> {
        const decoder = await createAnimatedDecoder(bytes, mime);
        return new AnimatedImagePlayer(decoder);
    }

    /**
     * @en Whether the current platform can decode `mime` natively (informational; the player always works
     * because it falls back to WASM internally).
     * @zh 当前平台能否原生解码 `mime`（仅供参考，播放器始终可用，内部会回退到 WASM）。
     */
    public static isNativeSupported (mime = 'image/webp'): boolean {
        return isNativeAnimatedSupported(mime);
    }

    /**
     * @en
     * Debug/test switch. When `true`, the Web backend bypasses the native WebCodecs `ImageDecoder` and
     * forces the bundled libwebp WASM fallback, so you can smoke-test the fallback chain on platforms that
     * have a native decoder (e.g. Chrome). No effect on platforms that already use WASM. Must be set before
     * a player is created.
     * @zh
     * 调试/测试开关。为 `true` 时，Web 后端会跳过原生 WebCodecs `ImageDecoder`，强制走自带的 libwebp WASM
     * 兜底路径，便于在有原生解码器的平台（如 Chrome）冒烟测试兜底链路。对本就走 WASM 的平台无影响。
     * 需在创建播放器之前设置。
     */
    public static get forceWasmDecoder (): boolean {
        return (globalThis as { __forceWebpWasmDecoder?: boolean }).__forceWebpWasmDecoder === true;
    }
    public static set forceWasmDecoder (value: boolean) {
        (globalThis as { __forceWebpWasmDecoder?: boolean }).__forceWebpWasmDecoder = value;
    }

    private _decoder: IAnimatedImageDecoder;
    private _texture: Texture2D;
    private _spriteFrame: SpriteFrame;
    private _state = AnimatedImagePlayerState.STOPPED;
    private _loop = true;
    private _currentFrame = 0;
    private _accumMs = 0;
    private _duration = 0;
    /** cache of decoded frames, indexed by frame index */
    private _frameCache: (IDecodedFrame | undefined)[];
    /** duration(ms) of each frame; -1 means unknown until decoded */
    private _frameDurations: number[];
    private _pendingDecode = false;
    private _destroyed = false;

    private constructor (decoder: IAnimatedImageDecoder) {
        this._decoder = decoder;
        this._frameCache = new Array<IDecodedFrame | undefined>(decoder.frameCount);
        this._frameDurations = new Array<number>(decoder.frameCount).fill(-1);

        const texture = new Texture2D();
        texture.reset({
            width: decoder.width,
            height: decoder.height,
            format: PixelFormat.RGBA8888,
            mipmapLevel: 1,
        });
        this._texture = texture;

        const spriteFrame = new SpriteFrame();
        spriteFrame.texture = texture;
        // Live textures must never be moved into the dynamic atlas, otherwise only the first frame is copied.
        spriteFrame.packable = false;
        this._spriteFrame = spriteFrame;

        // decode and present frame 0 immediately so the sprite is not blank before the first tick.
        void this._presentFrame(0);
    }

    /**
     * @en The output sprite frame. Bind it to a `Sprite`; it is refreshed in place every frame.
     * @zh 输出的精灵帧。将其绑定到 `Sprite`；它会每帧原地刷新。
     */
    get spriteFrame (): SpriteFrame {
        return this._spriteFrame;
    }

    /**
     * @en The underlying reusable texture.
     * @zh 底层复用的纹理。
     */
    get texture (): Texture2D {
        return this._texture;
    }

    /** @en Total frame count. @zh 总帧数。 */
    get frameCount (): number {
        return this._decoder.frameCount;
    }

    /** @en Index of the currently presented frame. @zh 当前显示帧的索引。 */
    get currentFrame (): number {
        return this._currentFrame;
    }

    /** @en Current playback state. @zh 当前播放状态。 */
    get state (): AnimatedImagePlayerState {
        return this._state;
    }

    /**
     * @en Total duration of the animation in milliseconds. Only known for frames already decoded; grows as
     * frames are visited. It is exact once every frame has been decoded at least once.
     * @zh 动画总时长（毫秒）。仅统计已解码帧，随帧的访问而增长；当所有帧都至少解码过一次后即为精确值。
     */
    get duration (): number {
        return this._duration;
    }

    /** @en Whether the animation loops. @zh 动画是否循环。 */
    get loop (): boolean {
        return this._loop;
    }
    set loop (value: boolean) {
        this._loop = value;
    }

    /**
     * @en Starts playing from the current frame. Restarts from frame 0 if stopped.
     * @zh 从当前帧开始播放。若已停止则从第 0 帧重新开始。
     */
    public play (): void {
        if (this._destroyed) { return; }
        if (this._state === AnimatedImagePlayerState.STOPPED) {
            this._currentFrame = 0;
            this._accumMs = 0;
            void this._presentFrame(0);
        }
        this._state = AnimatedImagePlayerState.PLAYING;
    }

    /** @en Pauses playback on the current frame. @zh 在当前帧暂停播放。 */
    public pause (): void {
        if (this._state === AnimatedImagePlayerState.PLAYING) {
            this._state = AnimatedImagePlayerState.PAUSED;
        }
    }

    /** @en Resumes from a paused state. @zh 从暂停状态继续播放。 */
    public resume (): void {
        if (this._state === AnimatedImagePlayerState.PAUSED) {
            this._state = AnimatedImagePlayerState.PLAYING;
        }
    }

    /** @en Stops and resets to frame 0. @zh 停止并回到第 0 帧。 */
    public stop (): void {
        this._state = AnimatedImagePlayerState.STOPPED;
        this._currentFrame = 0;
        this._accumMs = 0;
        void this._presentFrame(0);
    }

    /**
     * @en Jumps to a specific frame (does not change the playing/paused state).
     * @zh 跳转到指定帧（不改变播放/暂停状态）。
     */
    public seekToFrame (index: number): void {
        if (this._destroyed) { return; }
        const clamped = Math.max(0, Math.min(index, this.frameCount - 1));
        this._currentFrame = clamped;
        this._accumMs = 0;
        void this._presentFrame(clamped);
    }

    /**
     * @en Advances playback by `dt` seconds. Call once per game frame while playing.
     * @zh 按 `dt` 秒推进播放。播放时每游戏帧调用一次。
     * @param dt @en Delta time in seconds. @zh 帧间隔时间，单位为秒。
     */
    public tick (dt: number): void {
        if (this._destroyed || this._state !== AnimatedImagePlayerState.PLAYING || this.frameCount <= 1) {
            return;
        }
        this._accumMs += dt * 1000;
        // advance as many frames as the elapsed time covers (handles low frame rates / long dt).
        let guard = this.frameCount;
        while (guard-- > 0) {
            const frameDur = this._frameDurations[this._currentFrame];
            // duration not known yet (frame still decoding); wait for it rather than spinning.
            if (frameDur < 0) {
                void this._presentFrame(this._currentFrame);
                break;
            }
            if (this._accumMs < frameDur) {
                break;
            }
            this._accumMs -= frameDur;
            const next = this._currentFrame + 1;
            if (next >= this.frameCount) {
                if (this._loop) {
                    this._currentFrame = 0;
                } else {
                    this._currentFrame = this.frameCount - 1;
                    this._state = AnimatedImagePlayerState.STOPPED;
                    break;
                }
            } else {
                this._currentFrame = next;
            }
            void this._presentFrame(this._currentFrame);
        }
    }

    /** @en Releases the decoder, texture and sprite frame. @zh 释放解码器、纹理与精灵帧。 */
    public destroy (): void {
        if (this._destroyed) { return; }
        this._destroyed = true;
        this._state = AnimatedImagePlayerState.STOPPED;
        this._decoder.destroy();
        this._frameCache.length = 0;
        this._spriteFrame.destroy();
        this._texture.destroy();
    }

    private async _presentFrame (index: number): Promise<void> {
        if (this._destroyed) { return; }
        let frame = this._frameCache[index];
        if (!frame) {
            if (this._pendingDecode) { return; }
            this._pendingDecode = true;
            try {
                frame = await this._decoder.decodeFrame(index);
            } catch (e) {
                if (DEBUG) {
                    warn(`AnimatedImagePlayer failed to decode frame ${index}: ${e}`);
                }
                return;
            } finally {
                this._pendingDecode = false;
            }
            if (this._destroyed) { return; }
            this._frameCache[index] = frame;
            if (this._frameDurations[index] < 0) {
                this._frameDurations[index] = frame.duration;
                this._duration += frame.duration;
            }
        }
        // only upload if this is still the frame we want to show.
        if (index === this._currentFrame) {
            this._texture.uploadData(frame.data, 0);
        }
    }
}
