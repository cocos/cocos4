import { Sprite } from '../../cocos/2d/components';
import { Graphics } from '../../cocos/2d/components/graphics';
import { MeshRenderData, RenderData } from '../../cocos/2d/renderer/render-data';
import { Node } from '../../cocos/scene-graph/node';

describe('Graphics render-data lifecycle', () => {
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
