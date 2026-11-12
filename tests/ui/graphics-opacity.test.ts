import { Canvas, UIOpacity } from '../../cocos/2d';
import { Batcher2D } from '../../cocos/2d/renderer/batcher-2d';
import { Material } from '../../cocos/asset/assets';
import { Color } from '../../cocos/core';
import { Camera, Node, Scene, director, game } from '../../exports/base';
import { Graphics } from '../../exports/graphics';
import { Mask } from '../../exports/mask';

test('Graphics fades retained paints through its own material instance', () => {
    const scene = new Scene('Graphics opacity');
    director.runSceneImmediate(scene);
    const root = director.root!;
    const access = root as unknown as { _batcher: Batcher2D | null };
    const previousBatcher = access._batcher;
    const batcher = new Batcher2D(root);
    access._batcher = batcher;
    batcher.initialize();
    const custom = new Material();
    try {
        const canvasNode = new Node('Canvas');
        scene.addChild(canvasNode);
        const canvas = canvasNode.addComponent(Canvas);
        const camera = new Node('Camera');
        canvasNode.addChild(camera);
        canvas.cameraComponent = camera.addComponent(Camera);

        function paint (parent: Node): Graphics {
            const node = new Node('Paint');
            parent.addChild(node);
            const graphics = node.addComponent(Graphics);
            graphics.fillColor = new Color(255, 0, 0, 64);
            graphics.rect(0, 0, 16, 16);
            graphics.fill();
            graphics.strokeColor = new Color(0, 255, 0, 192);
            graphics.moveTo(20, 0);
            graphics.lineTo(20, 16);
            graphics.stroke();
            return graphics;
        }

        function factor (graphics: Graphics): number {
            const pass = graphics.model!.subModels[0].passes[0];
            const handle = pass.getHandle('uiCascadeOpacity');
            expect(handle).not.toBe(0);
            return pass.getUniform(handle, 0);
        }

        const group = new Node('Fade group');
        canvasNode.addChild(group);
        const parentOpacity = group.addComponent(UIOpacity);
        const faded = paint(group);
        // Use another real geometry block to exercise material rebinding without filling a 64K mesh.
        faded.impl!.requestRenderData();
        faded.impl!.dataOffset = 1;
        faded.rect(32, 0, 8, 8);
        faded.fill();
        const sibling = paint(canvasNode);
        faded.node.addComponent(UIOpacity).opacity = 192;
        faded.color = new Color(255, 255, 255, 128);
        game.step();

        expect(faded.getSharedMaterial(0)).toBe(sibling.getSharedMaterial(0));
        expect(faded.getMaterialInstance(0)).not.toBe(sibling.getMaterialInstance(0));
        const subModel = faded.model!.subModels[0];
        expect(faded.model!.subModels).toHaveLength(2);
        const input = subModel.inputAssembler;
        const updateVB = jest.spyOn(input.vertexBuffers[0], 'update');
        const updateIB = jest.spyOn(input.indexBuffer!, 'update');
        const pass = subModel.passes[0];
        const writeUniform = jest.spyOn(pass, 'setUniform');
        const data = faded.impl!.getRenderDataList()[0];
        const vertices = data.vData.slice(0, data.vertexStart * 8);
        const alphas = vertices.filter((_, i) => i % 8 === 6);
        expect(alphas).toContain(Math.fround(64 / 255));
        expect(alphas).toContain(Math.fround(192 / 255));

        parentOpacity.opacity = 128;
        game.step();
        const half = (128 / 255) * (192 / 255) * (128 / 255);
        expect(factor(faded)).toBeCloseTo(half, 6);
        expect(factor(sibling)).toBe(1);
        expect(writeUniform).toHaveBeenCalled();
        writeUniform.mockClear();
        game.step();
        expect(writeUniform).not.toHaveBeenCalled();

        parentOpacity.opacity = 0;
        game.step();
        parentOpacity.opacity = 255;
        game.step();
        expect(factor(faded)).toBeCloseTo((192 / 255) * (128 / 255), 6);
        expect(data.vData.slice(0, vertices.length)).toEqual(vertices);
        expect(updateVB).not.toHaveBeenCalled();
        expect(updateIB).not.toHaveBeenCalled();

        // Swap to an effect without the property, then restore the built-in at the same F.
        custom.initialize({ effectName: 'builtin-sprite' });
        faded.customMaterial = custom;
        game.step();
        expect(subModel.passes[0].getHandle('uiCascadeOpacity')).toBe(0);
        expect(faded.model!.subModels[1].passes[0]).toBe(subModel.passes[0]);
        faded.customMaterial = null;
        game.step();
        expect(factor(faded)).toBeCloseTo((192 / 255) * (128 / 255), 6);
        expect(faded.model!.subModels[1].passes[0]).toBe(subModel.passes[0]);
        expect(subModel.inputAssembler).toBe(input);
        expect(updateVB).not.toHaveBeenCalled();
        expect(updateIB).not.toHaveBeenCalled();

        const tint = faded.color;
        tint.a = 0;
        faded.color = tint;
        game.step();
        expect(faded.node._uiProps.opacity).toBe(0);
        tint.a = 255;
        faded.color = tint;
        game.step();
        expect(factor(faded)).toBeCloseTo(192 / 255, 6);

        const maskNode = new Node('Mask');
        group.addChild(maskNode);
        const mask = maskNode.addComponent(Mask);
        const masked = paint(maskNode);
        parentOpacity.opacity = 128;
        game.step();
        expect(factor(masked)).toBeCloseTo(128 / 255, 6);
        mask.inverted = true;
        game.step();
        expect(factor(masked)).toBeCloseTo(128 / 255, 6);
        expect(maskNode.getComponent(Graphics)!.fillColor.a).toBe(0);
    } finally {
        jest.restoreAllMocks();
        director.runSceneImmediate(new Scene('Cleanup'));
        custom.destroy();
        batcher.destroy();
        access._batcher = previousBatcher;
    }
});
