import { Format, TextureInfo, TextureType, TextureUsageBit, TextureViewInfo } from '../../cocos/gfx/base/define';
import { WebGLDevice } from '../../cocos/gfx/webgl/webgl-device';
import { WebGLDeviceManager } from '../../cocos/gfx/webgl/webgl-define';
import { WebGLTexture } from '../../cocos/gfx/webgl/webgl-texture';
import { WebGL2Device } from '../../cocos/gfx/webgl2/webgl2-device';
import { WebGL2DeviceManager } from '../../cocos/gfx/webgl2/webgl2-define';
import { WebGL2Texture } from '../../cocos/gfx/webgl2/webgl2-texture';

// Only the native GL calls are mocked: factories, wrappers and command functions
// execute their real creation, resize, cache cleanup and accounting paths.
describe.each([
    ['WebGL', WebGLDevice, WebGLTexture, WebGLDeviceManager],
    ['WebGL2', WebGL2Device, WebGL2Texture, WebGL2DeviceManager],
] as const)('%s partial texture allocation', (_name, DeviceConstructor, TextureConstructor, manager) => {
    let savedDevice: typeof manager.instance;
    let device: WebGLDevice | WebGL2Device;
    let allocation: jest.Mock;
    let failures: number;
    let handles: object[];
    let deleteTexture: jest.Mock;
    let stateCache: { texUnit: number; glTexUnits: { glTexture: object | null }[] };

    beforeEach(() => {
        savedDevice = manager.instance;
        device = new DeviceConstructor();
        handles = [];
        failures = 0;
        allocation = jest.fn(() => {
            if (failures > 0) {
                failures--;
                throw new Error('native texture allocation failed');
            }
        });
        deleteTexture = jest.fn();
        const gl = {
            createTexture: jest.fn(() => {
                const handle = { id: handles.length };
                handles.push(handle);
                return handle;
            }),
            bindTexture: jest.fn(),
            texImage2D: allocation,
            texStorage2D: allocation,
            texParameteri: jest.fn(),
            activeTexture: jest.fn(),
            deleteTexture,
        };
        stateCache = { texUnit: 0, glTexUnits: [{ glTexture: null }] };
        (device as any)._context = gl;
        (device as any)._swapchain = { stateCache, extensions: { WEBGL_depth_texture: {} } };
        device.capabilities.maxTextureSize = 4096;
        manager.setInstance(device as any);
    });

    afterEach(() => manager.setInstance(savedDevice as any));

    function info (): TextureInfo {
        return new TextureInfo(TextureType.TEX2D, TextureUsageBit.SAMPLED, Format.RGBA8, 64, 64);
    }

    function expectEveryHandleDeletedOnce (): void {
        expect(deleteTexture).toHaveBeenCalledTimes(handles.length);
        for (const handle of handles) {
            expect(deleteTexture.mock.calls.filter(([deleted]) => deleted === handle)).toHaveLength(1);
        }
        expect(stateCache.glTexUnits[0].glTexture).toBeNull();
    }

    test('factory cleans failed native allocations before returning a later successful texture', () => {
        failures = 3;
        for (let attempt = 0; attempt < 3; ++attempt) {
            expect(() => device.createTexture(info())).toThrow('native texture allocation failed');
            expectEveryHandleDeletedOnce();
            expect(device.memoryStatus.textureSize).toBe(0);
        }
        const texture = device.createTexture(info());
        expect(texture.getTextureHandle()).not.toBe(0);
        expect(device.memoryStatus.textureSize).toBe(64 * 64 * 4);
        texture.destroy();
        texture.destroy();
        expectEveryHandleDeletedOnce();
        expect(device.memoryStatus.textureSize).toBe(0);
    });

    test('destroying a wrapper after initialization throws does not subtract unrecorded memory', () => {
        const texture = new TextureConstructor();
        failures = 1;
        expect(() => texture.initialize(info())).toThrow('native texture allocation failed');
        expect(texture.getTextureHandle()).toBe(0);
        texture.destroy();
        expectEveryHandleDeletedOnce();
        expect(device.memoryStatus.textureSize).toBe(0);
    });

    test('repeated resize failures can retry at the same dimensions and remain reclaimable', () => {
        const texture = device.createTexture(info());
        failures = 3;
        for (let attempt = 0; attempt < 3; ++attempt) {
            expect(() => texture.resize(128, 128)).toThrow('native texture allocation failed');
            expect(texture.width).toBe(128);
            expect(texture.height).toBe(128);
            expect(texture.getTextureHandle()).toBe(0);
            expect(device.memoryStatus.textureSize).toBe(texture.size);
            expectEveryHandleDeletedOnce();
        }
        expect(() => texture.resize(128, 128)).not.toThrow();
        expect(texture.getTextureHandle()).not.toBe(0);
        expect(device.memoryStatus.textureSize).toBe(128 * 128 * 4);
        texture.destroy();
        texture.destroy();
        expectEveryHandleDeletedOnce();
        expect(device.memoryStatus.textureSize).toBe(0);
    });

    test('destroy immediately after a failed resize clears logical accounting once', () => {
        const texture = device.createTexture(info());
        failures = 1;
        expect(() => texture.resize(128, 128)).toThrow('native texture allocation failed');
        expect(device.memoryStatus.textureSize).toBe(texture.size);
        texture.destroy();
        texture.destroy();
        expectEveryHandleDeletedOnce();
        expect(device.memoryStatus.textureSize).toBe(0);
    });

    test('texture view resize and destruction never clean up the shared owner handle', () => {
        const texture = device.createTexture(info());
        const handle = texture.getTextureHandle();
        const view = device.createTexture(new TextureViewInfo(texture, TextureType.TEX2D, Format.RGBA8));
        failures = 1;
        view.resize(128, 128);
        view.destroy();
        expect(texture.getTextureHandle()).toBe(handle);
        expect(deleteTexture).not.toHaveBeenCalled();
        expect(device.memoryStatus.textureSize).toBe(64 * 64 * 4);
        texture.destroy();
        expectEveryHandleDeletedOnce();
        expect(device.memoryStatus.textureSize).toBe(0);
    });
});
