declare module 'pal/image-decoder' {
    /**
     * @en Whether the current platform backend can decode the given mime type natively (without WASM).
     * When it returns `false`, `createAnimatedDecoder` will fall back to the bundled libwebp WASM backend.
     * @zh 当前平台后端能否原生（不借助 WASM）解码给定 mime 类型。
     * 返回 `false` 时，`createAnimatedDecoder` 会回退到自带的 libwebp WASM 后端。
     *
     * @param mime The image mime type, e.g. `image/webp`.
     */
    export function isNativeAnimatedSupported (mime: string): boolean;

    /**
     * @en Creates an animated image decoder for the given encoded bytes. It prefers the platform native
     * path and transparently falls back to the bundled libwebp WASM backend when native decoding is
     * unavailable or fails.
     * @zh 为给定的编码字节创建动画图片解码器。优先走平台原生路径，当原生解码不可用或失败时，
     * 透明回退到自带的 libwebp WASM 后端。
     *
     * @param bytes The raw encoded image bytes (e.g. the content of a `.webp` file).
     * @param mime The image mime type, e.g. `image/webp`.
     */
    export function createAnimatedDecoder (
        bytes: Uint8Array,
        mime: string,
    ): Promise<import('pal/image-decoder/type').IAnimatedImageDecoder>;
}
