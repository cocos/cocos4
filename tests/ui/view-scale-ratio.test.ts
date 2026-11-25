import { screen, Size } from '../../cocos/core';
import { UITransform } from '../../cocos/2d/framework/ui-transform';
import { Canvas } from '../../cocos/2d/framework/canvas';
import { Batcher2D } from '../../cocos/2d/renderer/batcher-2d';
import { Camera } from '../../cocos/misc/camera-component';
import { Node } from '../../cocos/scene-graph/node';
import { Scene } from '../../cocos/scene-graph/scene';
import { director } from '../../cocos/game/director';
import { ResolutionPolicy, toPixelSpace, toUISpace, view } from '../../cocos/ui/view';
import { Widget } from '../../cocos/ui/widget';
import { widgetManager } from '../../cocos/ui/widget-manager';

const DESIGN_W = 1080;
const DESIGN_H = 1920;

function mockWindowSize (width: number, height: number): void {
    jest.spyOn(screen, 'windowSize', 'get').mockReturnValue(new Size(width, height));
}

function initBatcher (): void {
    // @ts-expect-error the batcher is required by Canvas.onEnable in the headless test environment
    director.root!._batcher = new Batcher2D(director.root!);
}

function createSceneCanvas (name: string): { node: Node; canvas: Canvas; camera: Camera } {
    const scene = new Scene(name);
    director.runSceneImmediate(scene);

    const node = new Node('Canvas');
    scene.addChild(node);
    node.addComponent(UITransform);
    const canvas = node.addComponent(Canvas) as Canvas;

    const camNode = new Node('UICamera');
    camNode.parent = node;
    const camera = camNode.addComponent(Camera) as Camera;
    canvas.cameraComponent = camera;
    (canvas as unknown as { _onResizeCamera(): void })._onResizeCamera();

    return { node, canvas, camera };
}

afterEach(() => {
    jest.restoreAllMocks();
});

describe('scale ratio keeps UI lengths exact', () => {
    test('FIXED_HEIGHT: the fitted axis equals the design size instead of 1919.9999999999998', () => {
        mockWindowSize(1532, 1532); // the viewport from the packaged-editor report
        view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_HEIGHT);

        const visible = view.getVisibleSize();
        expect(visible.height).toBe(1920);
        expect(visible.width).toBe(1920); // adapted axis, exactly representable

        const pixel = view.getVisibleSizeInPixel();
        expect(pixel.width).toBe(1532); // the round trip back to pixels stays exact
        expect(pixel.height).toBe(1532);

        // the rounded scale is untouched, it is only no longer used for the conversion
        expect(view.getScaleY()).toBe(1532 / 1920);
    });

    test('FIXED_HEIGHT: the canvas camera keeps 960 instead of 959.9999999999999', () => {
        mockWindowSize(1532, 1532);
        view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_HEIGHT);
        initBatcher();

        const { camera } = createSceneCanvas('ratio-camera-fixed-height');
        expect(camera.orthoHeight).toBe(960);
    });

    test('FIXED_WIDTH: both axes are exact', () => {
        mockWindowSize(1024, 768);
        view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_WIDTH);
        initBatcher();

        const visible = view.getVisibleSize();
        expect(visible.width).toBe(1080);
        expect(visible.height).toBe(810);

        const { camera } = createSceneCanvas('ratio-camera-fixed-width');
        expect(camera.orthoHeight).toBe(405);
    });

    test('SHOW_ALL: the visible size equals the design resolution', () => {
        mockWindowSize(1024, 768);
        view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.SHOW_ALL);

        const visible = view.getVisibleSize();
        expect(visible.width).toBe(1080);
        expect(visible.height).toBe(1920);
    });

    test('EXACT_FIT: the visible size equals the design resolution', () => {
        mockWindowSize(1024, 768);
        view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.EXACT_FIT);

        const visible = view.getVisibleSize();
        expect(visible.width).toBe(1080);
        expect(visible.height).toBe(1920);
    });

    test('NO_BORDER: the visible size equals the design resolution while the content is cropped', () => {
        mockWindowSize(1024, 3840);
        view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.NO_BORDER);

        const visible = view.getVisibleSize();
        expect(visible.width).toBe(1080);
        expect(visible.height).toBe(1920);
    });

    test('the reported ratio converts lengths in both directions without error', () => {
        mockWindowSize(1532, 1532);
        view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_HEIGHT);

        const ratio = view.getRatioY();
        expect(ratio.pixels).toBe(1532);
        expect(ratio.units).toBe(1920);
        expect(toUISpace(1532, ratio)).toBe(1920);
        expect(toPixelSpace(1920, ratio)).toBe(1532);
    });

    test('EXACT_FIT: the derived scale factors stay bit-identical to the policy scale', () => {
        mockWindowSize(1024, 768);
        view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.EXACT_FIT);

        // The scale is no longer stored, it is derived from the exact ratio on demand.
        expect(view.getScaleX()).toBe(1024 / 1080);
        expect(view.getScaleY()).toBe(768 / 1920);
    });

    test('setting the same resolution twice is idempotent', () => {
        mockWindowSize(1532, 1532);
        view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_HEIGHT);
        const first = { visible: view.getVisibleSize(), scale: view.getScaleY() };

        view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_HEIGHT);
        expect(view.getVisibleSize().width).toBe(first.visible.width);
        expect(view.getVisibleSize().height).toBe(first.visible.height);
        expect(view.getScaleY()).toBe(first.scale);
    });

    test('a root widget gets the exact canvas size and position', () => {
        mockWindowSize(1532, 1532);
        view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_HEIGHT);
        initBatcher();

        const scene = new Scene('ratio-widget');
        director.runSceneImmediate(scene);

        const node = new Node('Canvas');
        scene.addChild(node);
        node.addComponent(UITransform);
        node.addComponent(Canvas);

        const widget = node.addComponent(Widget) as Widget;
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.isAlignTop = true;
        widget.isAlignBottom = true;
        widget.left = 0;
        widget.right = 0;
        widget.top = 0;
        widget.bottom = 0;
        widgetManager.updateAlignment(node);

        const trans = node.getComponent(UITransform) as UITransform;
        expect(trans.width).toBe(1920);
        expect(trans.height).toBe(1920);
        expect(node.position.x).toBe(960);
        expect(node.position.y).toBe(960);
    });
});
