import { Vec2, Vec3 } from "../../cocos/core";
import { director } from "../../cocos/game";
import { Node } from "../../cocos/scene-graph";
import * as physics2d from "../../exports/physics-2d-framework";

const ANCHOR_A = new Vec2(3, 4);
const ANCHOR_B = new Vec2(-2, 5);
const SCALE_A = new Vec3(2, 3, 1);
const SCALE_B = new Vec3(4, 5, 1);
const POSITION_A = new Vec3(10, 20, 0);
const POSITION_B = new Vec3(50, -30, 0);
const ANCHOR_EPSILON = 1e-3;

const JOINT_TYPES = [
    physics2d.DistanceJoint2D,
    physics2d.SpringJoint2D,
    physics2d.FixedJoint2D,
    physics2d.SliderJoint2D,
    physics2d.WheelJoint2D,
    physics2d.HingeJoint2D,
];

function expectVec2Close (actual: Vec2, expected: Vec2): void {
    expect(Math.abs(actual.x - expected.x)).toBeLessThan(ANCHOR_EPSILON);
    expect(Math.abs(actual.y - expected.y)).toBeLessThan(ANCHOR_EPSILON);
}

function readJointAnchor (joint: physics2d.Joint2D, method: 'GetAnchorA' | 'GetAnchorB'): Vec2 {
    const impl = joint.impl!.impl;
    const out = { x: 0, y: 0 };
    const methodFunc = impl[method];
    const result = methodFunc.length === 0 ? methodFunc.call(impl) : methodFunc.call(impl, out) || out;
    return new Vec2(
        result.x * physics2d.PHYSICS_2D_PTM_RATIO,
        result.y * physics2d.PHYSICS_2D_PTM_RATIO,
    );
}

function createJoint<Joint extends physics2d.Joint2D> (
    parent: Node,
    jointCtor: new () => Joint,
    scaleA = SCALE_A,
    scaleB = SCALE_B,
): { nodeA: Node, nodeB: Node, joint: Joint } {
    const nodeA = new Node('JointBodyA');
    const nodeB = new Node('JointBodyB');
    parent.addChild(nodeA);
    parent.addChild(nodeB);

    nodeA.worldPosition = POSITION_A;
    nodeB.worldPosition = POSITION_B;
    nodeA.setScale(scaleA);
    nodeB.setScale(scaleB);

    const bodyA = nodeA.addComponent(physics2d.RigidBody2D);
    const bodyB = nodeB.addComponent(physics2d.RigidBody2D);
    bodyA.type = physics2d.ERigidBody2DType.Kinematic;
    bodyB.type = physics2d.ERigidBody2DType.Kinematic;

    const joint = nodeA.addComponent(jointCtor);
    joint.connectedBody = bodyB;
    joint.anchor.set(ANCHOR_A);
    joint.connectedAnchor.set(ANCHOR_B);
    joint.apply();

    return { nodeA, nodeB, joint };
}

function getExpectedAnchorA (node: Node): Vec2 {
    const scale = node.worldScale;
    const position = node.worldPosition;
    return new Vec2(position.x + ANCHOR_A.x * scale.x, position.y + ANCHOR_A.y * scale.y);
}

function getExpectedAnchorB (node: Node): Vec2 {
    const scale = node.worldScale;
    const position = node.worldPosition;
    return new Vec2(position.x + ANCHOR_B.x * scale.x, position.y + ANCHOR_B.y * scale.y);
}

/**
 * This function is used to test the api of the Joint2D.
 */
export default function (parent: Node, _steps = 0): void {
    //skip builtin for now
    if (physics2d.selector.id === 'builtin') {
        return;
    }

    // 各类关节创建时应使用缩放后的本地锚点。
    for (let i = 0; i < JOINT_TYPES.length; i++) {
        const { nodeA, nodeB, joint } = createJoint(parent, JOINT_TYPES[i]);
        expectVec2Close(readJointAnchor(joint, 'GetAnchorA'), getExpectedAnchorA(nodeA));
        expectVec2Close(readJointAnchor(joint, 'GetAnchorB'), getExpectedAnchorB(nodeB));

        parent.destroyAllChildren();
        parent.removeAllChildren();
    }

    // 运行时缩放自身或连接刚体后，应重建关节并刷新锚点。
    {
        const { nodeA, nodeB, joint } = createJoint(parent, physics2d.HingeJoint2D, Vec3.ONE, Vec3.ONE);
        expectVec2Close(readJointAnchor(joint, 'GetAnchorA'), getExpectedAnchorA(nodeA));
        expectVec2Close(readJointAnchor(joint, 'GetAnchorB'), getExpectedAnchorB(nodeB));

        nodeA.setScale(SCALE_A);
        director.tick(physics2d.PhysicsSystem2D.instance.fixedTimeStep);
        expectVec2Close(readJointAnchor(joint, 'GetAnchorA'), getExpectedAnchorA(nodeA));

        nodeB.setScale(SCALE_B);
        director.tick(physics2d.PhysicsSystem2D.instance.fixedTimeStep);
        expectVec2Close(readJointAnchor(joint, 'GetAnchorB'), getExpectedAnchorB(nodeB));

        parent.destroyAllChildren();
        parent.removeAllChildren();
    }
}
