import { Device } from '../../cocos/gfx/base/device';
import { BufferTextureCopy } from '../../cocos/gfx/base/define';
import { Texture } from '../../cocos/gfx/base/texture';
import { WebGLConstants } from '../../cocos/gfx/gl-constants';
import { WebGLDevice } from '../../cocos/gfx/webgl/webgl-device';
import { WebGL2Device } from '../../cocos/gfx/webgl2/webgl2-device';

const texture = {} as Texture;
const images = [{} as HTMLCanvasElement];
const regions = [new BufferTextureCopy()];

describe.each([
    ['WebGL', WebGLDevice.prototype],
    ['WebGL2', WebGL2Device.prototype],
] as const)('%s checked canvas upload', (_name, prototype) => {
    function createDevice () {
        const errors: number[] = [];
        const getError = jest.fn(() => errors.shift() ?? WebGLConstants.NO_ERROR);
        const isContextLost = jest.fn(() => false);
        const copyTexImagesToTexture = jest.fn();
        const device = { gl: { getError, isContextLost }, copyTexImagesToTexture };
        const upload = (): boolean => prototype.copyTexImagesToTextureChecked.call(device as unknown as WebGLDevice & WebGL2Device, images, texture, regions);
        return { errors, getError, isContextLost, copyTexImagesToTexture, upload };
    }

    test('reports a successful upload', () => {
        const mock = createDevice();
        expect(mock.upload()).toBe(true);
        expect(mock.copyTexImagesToTexture).toHaveBeenCalledWith(images, texture, regions);
        expect(mock.getError).toHaveBeenCalledTimes(2);
    });

    test('does not report success when GL only sets OUT_OF_MEMORY', () => {
        const mock = createDevice();
        mock.copyTexImagesToTexture.mockImplementation(() => mock.errors.push(WebGLConstants.OUT_OF_MEMORY));
        expect(mock.upload()).toBe(false);
        expect(mock.copyTexImagesToTexture).toHaveBeenCalledTimes(1);
        expect(mock.errors).toHaveLength(0);
    });

    test('rejects and drains prior errors without attributing them to an upload', () => {
        const mock = createDevice();
        mock.errors.push(WebGLConstants.OUT_OF_MEMORY, WebGLConstants.INVALID_OPERATION);
        expect(mock.upload()).toBe(false);
        expect(mock.copyTexImagesToTexture).not.toHaveBeenCalled();
        expect(mock.errors).toHaveLength(0);
        // The caller may now rebuild invalid initial storage and retry.
        expect(mock.upload()).toBe(true);
        expect(mock.copyTexImagesToTexture).toHaveBeenCalledTimes(1);
    });

    test('reports synchronous upload exceptions as failure', () => {
        const mock = createDevice();
        mock.copyTexImagesToTexture.mockImplementation(() => { throw new Error('native upload failed'); });
        expect(mock.upload()).toBe(false);
    });

    test('bounds error reads when the runtime never clears its error', () => {
        const mock = createDevice();
        mock.getError.mockImplementation(() => WebGLConstants.CONTEXT_LOST_WEBGL);
        expect(mock.upload()).toBe(false);
        expect(mock.getError).toHaveBeenCalledTimes(16);
        expect(mock.copyTexImagesToTexture).not.toHaveBeenCalled();
    });

    test('rejects a lost context even after its GL error has been consumed', () => {
        const mock = createDevice();
        mock.isContextLost.mockReturnValue(true);
        expect(mock.upload()).toBe(false);
        expect(mock.copyTexImagesToTexture).not.toHaveBeenCalled();
    });
});

test('the base fallback detects exceptions without requiring GL methods', () => {
    const copyTexImagesToTexture = jest.fn();
    const device = { copyTexImagesToTexture } as unknown as Device;
    expect(Device.prototype.copyTexImagesToTextureChecked.call(device, images, texture, regions)).toBe(true);
    copyTexImagesToTexture.mockImplementation(() => { throw new Error('upload failed'); });
    expect(Device.prototype.copyTexImagesToTextureChecked.call(device, images, texture, regions)).toBe(false);
});

test.each([
    ['WebGL', WebGLDevice.prototype],
    ['WebGL2', WebGL2Device.prototype],
] as const)('%s ordinary uploads do not add GL error queries', (_name, prototype) => {
    const getError = jest.fn();
    const gl = { getError, bindTexture: jest.fn(), texSubImage2D: jest.fn() };
    const stateCache = { texUnit: 0, glTexUnits: [{ glTexture: null }] };
    const gpuTexture = {
        glTarget: WebGLConstants.TEXTURE_2D,
        glTexture: {},
        glFormat: WebGLConstants.RGBA,
        glType: WebGLConstants.UNSIGNED_BYTE,
        flags: 0,
    };
    const device = { gl, stateCache, getStateCache: () => stateCache };
    prototype.copyTexImagesToTexture.call(device as unknown as WebGLDevice & WebGL2Device, images, { gpuTexture } as unknown as Texture, regions);
    expect(gl.texSubImage2D).toHaveBeenCalledTimes(1);
    expect(getError).not.toHaveBeenCalled();
});
