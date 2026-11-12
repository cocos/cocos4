import { TextureFilter, WrapMode } from '../../cocos/asset/assets/asset-enum';
import { RenderTexture } from '../../cocos/asset/assets/render-texture';
import { Address, SamplerInfo, Filter as GFXFilter } from '../../cocos/gfx/base/define';
import { deviceManager } from '../../cocos/gfx/device-manager';

describe('render-texture', () => {
    test('sampler', () => {
        const rt = new RenderTexture();
        expect(rt.width).toBe(1);
        expect(rt.height).toBe(1);
        rt.initialize({ width: 256, height: 256 });
        rt.setWrapMode(WrapMode.MIRRORED_REPEAT, WrapMode.CLAMP_TO_EDGE, WrapMode.REPEAT);
        rt.setFilters(TextureFilter.LINEAR, TextureFilter.NEAREST);
        expect(rt.getSamplerInfo()).toStrictEqual(new SamplerInfo(GFXFilter.LINEAR, GFXFilter.POINT, GFXFilter.NONE, Address.MIRROR, Address.CLAMP, Address.WRAP, 0));
        expect(rt.getGFXTexture().width).toBe(256);
        expect(rt.getGFXTexture().height).toBe(256);

        rt.resize(128, 256);
        expect(rt.getGFXTexture().width).toBe(128);

        rt.resize(0, 4096);
        expect(rt.getGFXTexture().width).toBe(1);
        expect(rt.getGFXTexture().height).toBe(2048);
    });

    test('resize follows the device max texture size', () => {
        const capabilities = deviceManager.gfxDevice.capabilities;
        const originalMaxTextureSize = capabilities.maxTextureSize;
        capabilities.maxTextureSize = 4096;
        try {
            const rt = new RenderTexture();
            rt.initialize({ width: 1, height: 1 });

            rt.resize(4096, 4096);
            expect(rt.width).toBe(4096);
            expect(rt.height).toBe(4096);
            expect(rt.getGFXTexture()!.width).toBe(4096);

            rt.resize(4097, 16384);
            expect(rt.width).toBe(4096);
            expect(rt.height).toBe(4096);
            expect(rt.validate()).toBe(true);
        } finally {
            capabilities.maxTextureSize = originalMaxTextureSize;
        }
    });

    test('validate only checks the upper bound when the device limit is known', () => {
        const capabilities = deviceManager.gfxDevice.capabilities;
        const originalMaxTextureSize = capabilities.maxTextureSize;
        try {
            capabilities.maxTextureSize = 0;
            const unknownLimit = new RenderTexture();
            unknownLimit.initialize({ width: 4096, height: 4096 });
            expect(unknownLimit.validate()).toBe(true);

            capabilities.maxTextureSize = 4096;
            const knownLimit = new RenderTexture();
            knownLimit.initialize({ width: 4096, height: 4096 });
            expect(knownLimit.validate()).toBe(true);

            knownLimit.initialize({ width: 4097, height: 4096 });
            expect(knownLimit.validate()).toBe(false);
        } finally {
            capabilities.maxTextureSize = originalMaxTextureSize;
        }
    });

    test('serialize', () => {
        const rt = new RenderTexture();
        const rtData1 = rt._serialize(null);
        expect(rtData1).toStrictEqual({ base: '2,2,0,0,0,0', w: 1, h: 1, n: '' });

        rt.resize(256, 128);
        rt.name = 'test';
        rt.setAnisotropy(16);
        rt.setFilters(TextureFilter.NEAREST, TextureFilter.NEAREST);
        rt.setWrapMode(WrapMode.CLAMP_TO_EDGE, WrapMode.CLAMP_TO_EDGE, WrapMode.CLAMP_TO_EDGE);
        const rtData2 = rt._serialize(null);
        expect(rtData2).toStrictEqual({ base: '1,1,2,2,0,16', w: 256, h: 128, n: 'test' });

        const rt2 = new RenderTexture();
        rt2._deserialize(rtData2, null);
        expect(rt2.getSamplerInfo()).toStrictEqual(rt.getSamplerInfo());
        expect(rt2.getGFXSampler()).toStrictEqual(rt.getGFXSampler());
        expect(rt2.getGFXTexture()).toStrictEqual(rt.getGFXTexture());
    })
});