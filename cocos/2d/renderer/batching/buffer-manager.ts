/*
 Copyright (c) 2022-2023 Xiamen Yaji Software Co., Ltd.

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

import { Attribute, Device } from '../../../gfx';
import { StaticVBAccessor } from '../static-vb-accessor';
import { getAttributeStride, vfmtPosUvColor } from '../vertex-format';

const DEFAULT_STRIDE_BYTES = 36; // 9 floats × 4 bytes = vfmtPosUvColor stride

/**
 * @en
 * Manages the creation, caching and switching of vertex buffer accessors (StaticVBAccessor).
 * Encapsulates the logic of selecting the correct VB pool based on vertex format stride.
 *
 * @zh
 * 管理顶点缓冲访问器（StaticVBAccessor）的创建、缓存和切换。
 * 封装了根据顶点格式 stride 选择正确 VB 池的逻辑。
 */
export class BufferManager {
    private _accessors: Map<number, StaticVBAccessor> = new Map();
    private _activeAccessor: StaticVBAccessor | null = null;

    /** The currently active buffer ID within the active accessor. */
    private _currentBufferId = -1;

    /** The current index start position for batched IA in the active mesh buffer. */
    private _indexStart = 0;

    constructor (private _device: Device) {}

    // ── Accessors ────────────────────────────────────────────────

    get activeAccessor (): StaticVBAccessor {
        if (this._activeAccessor) return this._activeAccessor;
        this._activeAccessor = this.switchAccessor();
        return this._activeAccessor;
    }

    /**
     * @en
     * Forces assignment of a specific accessor as active (used by UIStaticBatch).
     * @zh
     * 强制指定某个 accessor 为当前活跃的（UIStaticBatch 使用）。
     */
    public setActiveAccessor (accessor: StaticVBAccessor | null): void {
        this._activeAccessor = accessor;
    }

    get currentBufferId (): number { return this._currentBufferId; }

    get indexStart (): number { return this._indexStart; }

    // ── Buffer switching ─────────────────────────────────────────

    /**
     * @en
     * Switch to the appropriate mesh buffer accessor for the given vertex attributes.
     * Creates a new accessor if necessary for the required stride.
     * @zh
     * 为给定的顶点属性切换到合适的网格缓冲访问器。必要时创建新的访问器。
     *
     * @param attributes Vertex format attributes, defaults to vfmtPosUvColor.
     * @returns The active StaticVBAccessor for the requested vertex format.
     */
    public switchAccessor (attributes: Attribute[] = vfmtPosUvColor): StaticVBAccessor {
        const strideBytes = attributes === vfmtPosUvColor
            ? DEFAULT_STRIDE_BYTES
            : getAttributeStride(attributes);

        // If current accessor not compatible with the requested attributes, switch.
        if (!this._activeAccessor || this._activeAccessor.vertexFormatBytes !== strideBytes) {
            let accessor = this._accessors.get(strideBytes);
            if (!accessor) {
                accessor = new StaticVBAccessor(this._device, attributes);
                this._accessors.set(strideBytes, accessor);
            }
            this._activeAccessor = accessor;
            this._currentBufferId = -1; // Force buffer-slots recalculation on first use.
        }
        return this._activeAccessor;
    }

    /**
     * @en
     * Registers an externally created accessor (e.g. custom vertex format).
     * @zh
     * 注册一个外部创建的访问器（例如自定义顶点格式）。
     */
    public registerAccessor (key: number, accessor: StaticVBAccessor): void {
        this._accessors.set(key, accessor);
    }

    // ── Buffer ID tracking ──────────────────────────────────────

    /**
     * @en
     * Ensures the correct accessor is active and updates the running buffer-id / index-start
     * so consecutive draw-calls can be batched into the same mesh buffer.
     * @zh
     * 确保正确的访问器处于活跃状态并更新当前的 buffer-id/index-start，
     * 使连续的 draw-call 能合并到同一个 mesh buffer。
     *
     * @param attributes The requested vertex format.
     * @param bid        The buffer ID that will be written to.
     */
    public trackBuffer (attributes: Attribute[], bid: number): void {
        const accessor = this.switchAccessor(attributes);
        if (this._currentBufferId !== bid) {
            this._currentBufferId = bid;
            this._indexStart = accessor.getMeshBuffer(bid).indexOffset;
        }
    }

    // ── Lifecycle ────────────────────────────────────────────────

    /**
     * @en
     * Upload all dirty buffers to GPU.
     * @zh
     * 将所有脏缓冲区上传到 GPU。
     */
    public uploadBuffers (): void {
        for (const accessor of this._accessors.values()) {
            accessor.uploadBuffers();
            accessor.reset();
        }
    }

    /**
     * @en
     * Reset all accessor states. Called at end of every frame.
     * @zh
     * 重置所有访问器状态。每帧结束时调用。
     */
    public reset (): void {
        for (const accessor of this._accessors.values()) {
            accessor.reset();
        }
        this._activeAccessor = null;
        this._currentBufferId = -1;
        this._indexStart = 0;
    }

    /**
     * @en
     * Destroy all accessors and release GPU resources.
     * @zh
     * 销毁所有访问器并释放 GPU 资源。
     */
    public destroy (): void {
        for (const accessor of this._accessors.values()) {
            accessor.destroy();
        }
        this._accessors.clear();
        this._activeAccessor = null;
        this._currentBufferId = -1;
        this._indexStart = 0;
    }
}
