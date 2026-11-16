import { Sprite } from '../../cocos/2d/components';
import { Graphics } from '../../cocos/2d/components/graphics';
import { MeshRenderData, RenderData } from '../../cocos/2d/renderer/render-data';
import type { NativeUIModelProxy } from '../../cocos/2d/renderer/native-2d';
import type { RenderDrawInfo } from '../../cocos/2d/renderer/render-draw-info';
import { Node } from '../../cocos/scene-graph/node';
import '../../cocos/2d/assembler/graphics';
import { mockEnv } from '../utils/mock-cc-env';

describe('Graphics render-data lifecycle', () => {
    test('disabling an undrawn native fill releases cached geometry without creating a submodel', () => {
        const node = new Node('Degenerate fill');
        const graphics = node.addComponent(Graphics);
        graphics.updateMaterial();
        expect(graphics.getRenderMaterial(0)!.passes.length).toBeGreaterThan(0);
        graphics.moveTo(0, 0);
        graphics.lineTo(20, 0);
        graphics.fill();
        const data = graphics.impl!.getRenderDataList()[0];
        expect([data.vertexStart, data.indexStart]).toEqual([2, 0]);

        // The native proxy and shared draw info are supplied by JSB in a native application.
        const proxy = { activeSubModels: jest.fn(), uploadData: jest.fn() };
        graphics['_graphicsNativeProxy'] = proxy as unknown as NativeUIModelProxy;
        jest.spyOn(graphics.renderEntity, 'enabled', 'set').mockImplementation(() => {});
        const drawInfo = { vertDirty: true, setVertDirty: jest.fn() };
        jest.spyOn(data, 'renderDrawInfo', 'get').mockReturnValue(drawInfo as unknown as RenderDrawInfo);
        jest.spyOn(data, 'setRenderDrawInfoAttributes').mockImplementation(() => {});
        const native = mockEnv('JSB', true);
        try {
            graphics.onDisable();
            expect(proxy.activeSubModels).not.toHaveBeenCalled();
            expect(proxy.uploadData).toHaveBeenCalledTimes(1);
            graphics.fillRect(0, 0, 4, 4);
            graphics.updateRenderer();
            expect(data.indexStart).toBe(6);
            expect(proxy.activeSubModels).toHaveBeenCalledTimes(1);
            expect(proxy.uploadData).toHaveBeenCalledTimes(2);
        } finally {
            native.restore();
            jest.restoreAllMocks();
            node._destroyImmediate();
        }
    });

    test('retains generated geometry while disabled', () => {
        const node = new Node('Graphics');
        const graphics = node.addComponent(Graphics);
        const renderData = MeshRenderData.add();
        renderData.vertexStart = 4;
        // Graphics binds MeshRenderData to UIRenderer only on JSB. Reproduce that
        // ownership boundary explicitly in the platform-independent unit test.
        graphics.setRenderData(renderData as unknown as RenderData);

        graphics.onDisable();

        expect(graphics.renderData).toBe(renderData);
        expect(renderData.vertexStart).toBe(4);

        graphics.setRenderData(null);
        MeshRenderData.remove(renderData);
        node._destroyImmediate();
    });

    test('ordinary UI renderers still release render data while disabled', () => {
        const node = new Node('Sprite');
        const sprite = node.addComponent(Sprite);
        const destroyRenderData = jest.spyOn(sprite, 'destroyRenderData');

        sprite.onDisable();

        expect(destroyRenderData).toHaveBeenCalledTimes(1);
        destroyRenderData.mockRestore();
        node._destroyImmediate();
    });
});
