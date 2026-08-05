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

/**
 * @en A single decoded frame of an animated image.
 * @zh 动画图片解码出的单帧数据。
 */
export interface IDecodedFrame {
    /**
     * @en Pixel data in RGBA8888 layout, top-down (row 0 is the top of the image).
     * Its length is always `width * height * 4`.
     * @zh RGBA8888 排布的像素数据，自上而下（第 0 行为图像顶部），长度恒为 `width * height * 4`。
     */
    data: Uint8Array;
    /**
     * @en Display duration of this frame, in milliseconds.
     * @zh 该帧的显示时长，单位为毫秒。
     */
    duration: number;
}

/**
 * @en The unified animated image decoder interface. Each platform backend (WebCodecs, minigame, WASM)
 * implements it so the upper player class stays platform agnostic.
 * @zh 统一的动画图片解码器接口。各平台后端（WebCodecs、小游戏、WASM）都实现它，
 * 使上层播放器类与平台无关。
 */
export interface IAnimatedImageDecoder {
    /**
     * @en Pixel width of every frame.
     * @zh 每帧的像素宽度。
     */
    readonly width: number;
    /**
     * @en Pixel height of every frame.
     * @zh 每帧的像素高度。
     */
    readonly height: number;
    /**
     * @en Total frame count of the animation.
     * @zh 动画的总帧数。
     */
    readonly frameCount: number;
    /**
     * @en Loop count declared by the file. `0` means loop forever.
     * @zh 文件声明的循环次数。`0` 表示无限循环。
     */
    readonly loopCount: number;
    /**
     * @en Lazily decodes the frame at `index` and returns its RGBA data. Backends may cache internally.
     * @zh 惰性解码 `index` 处的帧并返回其 RGBA 数据。后端内部可自行缓存。
     * @param index @en Frame index, in range [0, frameCount). @zh 帧索引，取值范围 [0, frameCount)。
     */
    decodeFrame (index: number): Promise<IDecodedFrame>;
    /**
     * @en Releases all resources held by the decoder (WASM handles, VideoFrame caches, etc.).
     * @zh 释放解码器持有的所有资源（WASM 句柄、VideoFrame 缓存等）。
     */
    destroy (): void;
}
