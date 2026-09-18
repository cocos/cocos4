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

import { JSB } from 'internal:constants';
import { Buffer, BufferInfo, BufferUsageBit, DescriptorSet, DescriptorSetInfo, Device, MemoryUsageBit, deviceManager } from '../../../gfx';
import { Mat4, Pool } from '../../../core';
import { Node } from '../../../scene-graph';
import { ModelLocalBindings, UBOLocalEnum } from '../../../rendering/define';
import type { DrawBatch2D } from '../draw-batch';
import type { Sampler } from '../../../gfx';

const _dsInfo = new DescriptorSetInfo(null!);
const m4_1 = new Mat4();

// ──────────────────────────────────────────────────────────────────
// LocalDescriptorSet — per-transform DescriptorSet with UBO
// ──────────────────────────────────────────────────────────────────

/** @mangle */
export class LocalDescriptorSet {
    private _descriptorSet: DescriptorSet | null = null;
    private _transform: Node | null = null;
    private _textureHash = 0;
    private _samplerHash = 0;
    private _localBuffer: Buffer | null = null;
    private _transformUpdate = true;
    private declare _localData: Float32Array | null;

    // NOTE: Internal modules should avoid using getter/setter accessors since we're using babel to convert TS to JS
    // and terser minifier could not handle the getter/setter generated JS code correctly.
    // See the issue: https://github.com/terser/terser/issues/322
    // Changed get descriptorSet() to getDescriptorSet() in v3.8.6.
    public getDescriptorSet (): DescriptorSet | null {
        return this._descriptorSet;
    }

    constructor () {
        const device = deviceManager.gfxDevice;
        this._localData = new Float32Array(UBOLocalEnum.COUNT);
        this._localBuffer = device.createBuffer(new BufferInfo(
            BufferUsageBit.UNIFORM | BufferUsageBit.TRANSFER_DST,
            MemoryUsageBit.HOST | MemoryUsageBit.DEVICE,
            UBOLocalEnum.SIZE,
            UBOLocalEnum.SIZE,
        ));
    }

    public initialize (batch: DrawBatch2D): void {
        const device = deviceManager.gfxDevice;
        this._transform = batch.useLocalData;
        this._textureHash = batch.textureHash;
        this._samplerHash = batch.samplerHash;
        _dsInfo.layout = batch.passes[0].localSetLayout;
        this._descriptorSet = device.createDescriptorSet(_dsInfo);
        this._descriptorSet.bindBuffer(UBOLocalEnum.BINDING, this._localBuffer!);
        const binding = ModelLocalBindings.SAMPLER_SPRITE;
        this._descriptorSet.bindTexture(binding, batch.texture!);
        this._descriptorSet.bindSampler(binding, batch.sampler!);
        this._descriptorSet.update();
        this._transformUpdate = true;
    }

    public updateTransform (transform: Node): void {
        if (transform === this._transform) return;
        this._transform = transform;
        this._transformUpdate = true;
        this.uploadLocalData();
    }

    public equals (transform: Node | null, textureHash: number, samplerHash: number): boolean {
        return this._transform === transform && this._textureHash === textureHash && this._samplerHash === samplerHash;
    }

    public reset (): void {
        this._transform = null;
        this._textureHash = 0;
        this._samplerHash = 0;
    }

    public destroy (): void {
        if (this._localBuffer) {
            this._localBuffer.destroy();
            this._localBuffer = null;
        }

        if (this._descriptorSet) {
            this._descriptorSet.destroy();
            this._descriptorSet = null;
        }

        this._localData = null;
    }

    public isValid (): boolean | null {
        return this._transform && this._transform.isValid;
    }

    public uploadLocalData (): void {
        const node = this._transform!;
        if (node.hasChangedFlags || node.isTransformDirty()) {
            node.updateWorldTransform();
            this._transformUpdate = true;
        }
        if (this._transformUpdate) {
            const worldMatrix = node.worldMatrix;
            Mat4.toArray(this._localData!, worldMatrix, UBOLocalEnum.MAT_WORLD_OFFSET);

            Mat4.invert(m4_1, worldMatrix);
            Mat4.transpose(m4_1, m4_1);

            if (!JSB) {
                // fix precision lost of webGL on android device
                // scale worldIT mat to around 1.0 by product its sqrt of determinant.
                const det = Mat4.determinant(m4_1);
                const factor = 1.0 / Math.sqrt(det);
                Mat4.multiplyScalar(m4_1, m4_1, factor);
            }
            Mat4.toArray(this._localData!, m4_1, UBOLocalEnum.MAT_WORLD_IT_OFFSET);
            this._localBuffer!.update(this._localData!);
            this._transformUpdate = false;
        }
    }
}

// ──────────────────────────────────────────────────────────────────
// DescriptorCache — global DescriptorSet cache + LocalDescriptorSet pool
// ──────────────────────────────────────────────────────────────────

/** @mangle */
export class DescriptorCache {
    private _descriptorSetCache = new Map<number, DescriptorSet>();
    private _dsCacheHashByTexture = new Map<number, number>();
    private _localDescriptorSetCache: LocalDescriptorSet[] = [];
    private declare _localCachePool: Pool<LocalDescriptorSet>;

    constructor () {
        this._localCachePool = new Pool(() => new LocalDescriptorSet(), 16, (obj) => obj.destroy());
    }

    /**
     * @en
     * Get or create a DescriptorSet for the given batch.
     * If `batch.useLocalData` is set, a LocalDescriptorSet with a per-transform UBO is used.
     * @zh
     * 获取或创建指定批次的 DescriptorSet。
     * 如果设置了 useLocalData，则使用带独立 transform UBO 的 LocalDescriptorSet。
     */
    public getDescriptorSet (batch: DrawBatch2D): DescriptorSet {
        if (batch.useLocalData) {
            const caches = this._localDescriptorSetCache;
            for (let i = 0, len = caches.length; i < len; i++) {
                const cache: LocalDescriptorSet = caches[i];
                if (cache.equals(batch.useLocalData, batch.textureHash, batch.samplerHash)) {
                    return cache.getDescriptorSet()!;
                }
            }
            const localDs = this._localCachePool.alloc();
            localDs.initialize(batch);
            this._localDescriptorSetCache.push(localDs);
            return localDs.getDescriptorSet()!;
        } else {
            const hash = batch.textureHash ^ batch.samplerHash;
            if (this._descriptorSetCache.has(hash)) {
                return this._descriptorSetCache.get(hash)!;
            } else {
                _dsInfo.layout = batch.passes[0].localSetLayout;
                const descriptorSet = deviceManager.gfxDevice.createDescriptorSet(_dsInfo);
                const binding = ModelLocalBindings.SAMPLER_SPRITE;
                descriptorSet.bindTexture(binding, batch.texture!);
                descriptorSet.bindSampler(binding, batch.sampler!);
                descriptorSet.update();

                this._descriptorSetCache.set(hash, descriptorSet);
                this._dsCacheHashByTexture.set(batch.textureHash, hash);

                return descriptorSet;
            }
        }
    }

    /**
     * @en
     * Update UBO data for local DescriptorSets whose transform is dirty.
     * Remove entries whose associated Node is no longer valid.
     * @zh
     * 更新 transform 脏的 LocalDescriptorSet 的 UBO 数据，移除无效的条目。
     */
    public update (): void {
        const caches = this._localDescriptorSetCache;
        const length = caches.length;
        if (length === 0) { return; }
        const uselessArray: number[] = [];
        for (let i = 0; i < length; i++) {
            const value = caches[i];
            if (value.isValid()) {
                value.uploadLocalData();
            } else {
                value.reset();
                const pos = caches.indexOf(value);
                uselessArray.push(pos);
            }
        }
        // Remove in reverse order to maintain correct indices.
        for (let i = uselessArray.length - 1; i >= 0; i--) {
            const index = uselessArray[i];
            const localDs = caches[index];
            caches.splice(index, 1);
            this._localCachePool.free(localDs);
        }
    }

    /**
     * @en
     * Reset all LocalDescriptorSets (return to pool). Called at frame end.
     * @zh
     * 重置所有 LocalDescriptorSet（归还到池）。帧末调用。
     */
    public reset (): void {
        const caches = this._localDescriptorSetCache;
        const length = caches.length;
        for (let i = 0; i < length; i++) {
            const value = caches[i];
            this._localCachePool.free(value);
        }
        this._localDescriptorSetCache.length = 0;
    }

    /**
     * @en
     * Release the DescriptorSet associated with the given texture hash.
     * Called when a texture is being released.
     * @zh
     * 释放与给定纹理哈希关联的 DescriptorSet。当纹理被释放时调用。
     */
    public releaseByTexture (textureHash: number): void {
        const key = this._dsCacheHashByTexture.get(textureHash);
        if (key && this._descriptorSetCache.has(key)) {
            this._descriptorSetCache.get(key)!.destroy();
            this._descriptorSetCache.delete(key);
            this._dsCacheHashByTexture.delete(textureHash);
        }
    }

    /**
     * @en
     * Destroy all caches and release GPU resources.
     * @zh
     * 销毁所有缓存并释放 GPU 资源。
     */
    public destroy (): void {
        for (const value of this._descriptorSetCache.values()) {
            value.destroy();
        }
        this._descriptorSetCache.clear();
        this._dsCacheHashByTexture.clear();
        this._localDescriptorSetCache.length = 0;
        this._localCachePool.destroy();
    }
}
