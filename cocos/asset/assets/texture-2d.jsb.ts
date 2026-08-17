/*
 Copyright (c) 2021-2023 Xiamen Yaji Software Co., Ltd.

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

import { EDITOR, NODEJS, TEST } from 'internal:constants'
import { ImageAsset } from './image-asset';
import { SimpleTexture } from './simple-texture';
import { TextureBase } from './texture-base.jsb';
import { js, cclegacy, macro } from '../../core';
import { TextureFilter, PixelFormat, WrapMode } from './asset-enum';
import './simple-texture';
import { patch_cc_Texture2D } from '../../native-binding/decorators';
import type { Texture2D as JsbTexture2D } from './texture-2d';
import dependUtil from '../asset-manager/depend-util';

declare const jsb: any;
const texture2DProto: any = jsb.Texture2D.prototype;

texture2DProto.createNode = null!;

export type Texture2D = JsbTexture2D;
export const Texture2D: typeof JsbTexture2D = jsb.Texture2D;

Texture2D.Filter = TextureFilter;
Texture2D.PixelFormat = PixelFormat;
Texture2D.WrapMode = WrapMode;

export interface ITexture2DSerializeData {
    base: string;
    mipmaps: string[];
}

texture2DProto._ctor = function () {
    // TODO: Property '_ctor' does not exist on type 'SimpleTexture'.
    // issue: https://github.com/cocos/cocos-engine/issues/14644
    (SimpleTexture.prototype as any)._ctor.apply(this, arguments);
    this._mipmaps = [];
    this._pendingTextureSources = [];
};

Object.defineProperty(texture2DProto, '_textureSource', {
    configurable: true,
    set (value) {
        if (macro.CLEANUP_IMAGE_CACHE && value) {
            this._pendingTextureSources.push(value);
        }
    },
});

texture2DProto._cleanupTextureSourceRefs = function () {
    if (!macro.CLEANUP_IMAGE_CACHE || this._pendingTextureSources.length === 0) {
        this._pendingTextureSources.length = 0;
        return;
    }

    const availableSources = new Map();
    const realDependencyCounts = new Map();
    for (const source of this._mipmaps) {
        if (!source) {
            continue;
        }
        availableSources.set(source, (availableSources.get(source) ?? 0) + 1);
        if (source._uuid) {
            realDependencyCounts.set(source._uuid, (realDependencyCounts.get(source._uuid) ?? 0) + 1);
        }
    }

    const deps = dependUtil.getDeps(this._uuid);
    const dependencyCounts = new Map();
    for (const uuid of deps) {
        dependencyCounts.set(uuid, (dependencyCounts.get(uuid) ?? 0) + 1);
    }

    for (const source of this._pendingTextureSources) {
        const availableCount = availableSources.get(source) ?? 0;
        const uuid = source._uuid;
        const dependencyCount = dependencyCounts.get(uuid) ?? 0;
        const realDependencyCount = realDependencyCounts.get(uuid) ?? 0;
        if (availableCount === 0 || !uuid || dependencyCount <= realDependencyCount) {
            continue;
        }

        const index = deps.indexOf(uuid);
        if (index !== -1) {
            js.array.fastRemoveAt(deps, index);
            source.decRef(false);
            availableSources.set(source, availableCount - 1);
            dependencyCounts.set(uuid, dependencyCount - 1);
        }
    }
    this._pendingTextureSources.length = 0;
};

const oldInitDefault = texture2DProto.initDefault;
texture2DProto.initDefault = function (uuid: string) {
    oldInitDefault.call(this, uuid);
    this._mipmaps = this.getMipmaps();
}

texture2DProto._serialize = function (ctxForExporting: any) {
    if (EDITOR || NODEJS || TEST) {
        return {
            base: TextureBase.prototype._serialize(ctxForExporting),
            mipmaps: this._mipmaps.map((mipmap) => {
                if (!mipmap || !mipmap._uuid) {
                    return null;
                }
                let uuid = mipmap._uuid;
                if (ctxForExporting) {
                    if (ctxForExporting._compressUuid) {
                        uuid = EditorExtends.UuidUtils.compressUuid(mipmap._uuid, true);
                    }
                    if (uuid) {
                        ctxForExporting.dependsOn('_textureSource', uuid);
                    }
                }
                return uuid;
            }),
        };
    }
    return null;
}


texture2DProto._deserialize = function (serializedData: any, handle: any) {
    const data = serializedData as ITexture2DSerializeData;
    // NOTE: _deserialize expect 3 arguments
    TextureBase.prototype._deserialize.call(this, data.base, undefined);

    this._mipmaps = new Array(data.mipmaps.length);
    for (let i = 0; i < data.mipmaps.length; ++i) {
        // Prevent resource load failed
        this._mipmaps[i] = new ImageAsset();
        if (!data.mipmaps[i]) {
            continue;
        }
        const mipmapUUID = data.mipmaps[i];
        handle.result.push(this._mipmaps, `${i}`, mipmapUUID, js.getClassId(ImageAsset));
    }
};

const oldOnLoaded = texture2DProto.onLoaded;
texture2DProto.onLoaded = function () {
    this.syncMipmapsForJS(this._mipmaps);
    this._cleanupTextureSourceRefs();
    oldOnLoaded.call(this);
};

Object.defineProperty(texture2DProto, 'image', {
    configurable: true,
    enumerable: true,
    get () {
        return this._mipmaps.length === 0 ? null : this._mipmaps[0];
    },
    set (value) {
        this.mipmaps = value ? [value] : [];
    }
});

Object.defineProperty(texture2DProto, 'mipmaps', {
    configurable: true,
    enumerable: true,
    get () {
        return this._mipmaps;
    },
    set (arr) {
        for (let i = 0, len = arr.length; i < len; ++i) {
            arr[i]._syncDataToNative();
        }
        this._mipmaps = arr;
        this.setMipmaps(arr);
    }
});

cclegacy.Texture2D = jsb.Texture2D;

// handle meta data, it is generated automatically
patch_cc_Texture2D({Texture2D, ImageAsset});
