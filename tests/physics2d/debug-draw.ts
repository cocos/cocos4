import * as physics2d from "../../exports/physics-2d-framework";

/**
 * 验证 Box2D 后端关闭调试绘制时保留调试节点，避免再次开启时父节点为空。
 */
export default function DebugDrawTest (): void {
    if (physics2d.selector.id === 'builtin') {
        return;
    }

    const parent = {};
    const clear = jest.fn();
    const debugGraphics = {
        clear,
        node: {
            parent,
        },
    };
    const physicsWorld = physics2d.PhysicsSystem2D.instance.physicsWorld as unknown as {
        _debugGraphics: typeof debugGraphics | null;
    };

    physicsWorld._debugGraphics = debugGraphics;

    try {
        physics2d.PhysicsSystem2D.instance.debugDrawFlags = physics2d.EPhysics2DDrawFlags.Shape;
        physics2d.PhysicsSystem2D.instance.debugDrawFlags = physics2d.EPhysics2DDrawFlags.None;
        expect(clear).toHaveBeenCalledTimes(1);
        expect(debugGraphics.node.parent).toBe(parent);

        physics2d.PhysicsSystem2D.instance.debugDrawFlags = physics2d.EPhysics2DDrawFlags.Shape;
        expect(debugGraphics.node.parent).toBe(parent);
    } finally {
        physics2d.PhysicsSystem2D.instance.debugDrawFlags = physics2d.EPhysics2DDrawFlags.None;
        physicsWorld._debugGraphics = null;
    }
}
