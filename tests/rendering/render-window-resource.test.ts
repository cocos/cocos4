import { RenderTexture } from '../../cocos/asset/assets/render-texture';
import { director } from '../../cocos/game/director';
import { Format } from '../../cocos/gfx';
import { LayoutGraphData } from '../../cocos/rendering/custom/layout-graph';
import { ResourceGraphValue } from '../../cocos/rendering/custom/render-graph';
import { ResourceResidency } from '../../cocos/rendering/custom/types';
import { WebPipeline } from '../../cocos/rendering/custom/web-pipeline';

test('updating a render window keeps the vertex and uses the current framebuffer', () => {
    const pipeline = new WebPipeline(new LayoutGraphData());
    const graph = pipeline.resourceGraph;
    const screen = director.root!.mainWindow!;
    const first = new RenderTexture();
    const second = new RenderTexture();
    try {
        first.initialize({ width: 32, height: 32 });
        second.initialize({ width: 32, height: 32 });
        const id = pipeline.addRenderWindow('color', Format.RGBA8, 32, 32, first.window!);
        const resource = graph.value(ResourceGraphValue.Swapchain, id);
        expect(resource.renderWindow!.framebuffer).toBe(first.window!.framebuffer);

        expect(pipeline.addRenderWindow('color', Format.RGBA8, 32, 32, second.window!)).toBe(id);
        expect(resource.renderWindow!.framebuffer).toBe(second.window!.framebuffer);
        expect(graph.getTraits(id).residency).toBe(ResourceResidency.EXTERNAL);

        pipeline.updateRenderWindow('color', screen);
        expect(graph.w(id)).toBe(ResourceGraphValue.Swapchain);
        expect(graph.object(id)).toBe(resource);
        expect(resource.swapchain).toBe(screen.swapchain);
        expect(resource.renderWindow!.framebuffer).toBe(screen.framebuffer);
        expect(graph.getTraits(id).residency).toBe(ResourceResidency.BACKBUFFER);
    } finally {
        first.destroy();
        second.destroy();
    }
});
