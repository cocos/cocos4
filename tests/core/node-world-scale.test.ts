import { Mat4, Quat, Vec3 } from '../../cocos/core/math';
import { Node, TransformBit } from '../../cocos/scene-graph';
import type { UISkew } from '../../cocos/2d/framework/ui-skew';
import { captureWarnIDs } from '../utils/log-capture';

function expectVec3 (actual: Readonly<Vec3>, expected: Readonly<Vec3>): void {
    expect(actual.x).toBeCloseTo(expected.x, 8);
    expect(actual.y).toBeCloseTo(expected.y, 8);
    expect(actual.z).toBeCloseTo(expected.z, 8);
}

function signedScale (signs: number, x: number, y: number, z: number): Vec3 {
    return new Vec3(signs & 1 ? -x : x, signs & 2 ? -y : y, signs & 4 ? -z : z);
}

describe('Node.setWorldScale signed scale', () => {
    test('accepts negative input on every axis and preserves the requested mirror in the matrix', () => {
        const parent = new Node();
        const child = new Node();
        child.parent = parent;
        const warnings = captureWarnIDs();
        for (let signs = 0; signs < 8; ++signs) {
            const target = signedScale(signs, 2, 3, 4);
            child.setWorldScale(target);
            expectVec3(child.scale, target);
            expectVec3(new Vec3(child.worldMatrix.m00, child.worldMatrix.m05, child.worldMatrix.m10), target);
            const expectedWorld = new Vec3(target.x * target.y * target.z < 0 ? -2 : 2, 3, 4);
            expectVec3(child.worldScale, expectedWorld);
            const matrix = child.worldMatrix.clone();
            child.setWorldScale(target.x, target.y, target.z);
            expect(child.worldMatrix.equals(matrix)).toBe(true);
        }
        expect(warnings.captured).toEqual([]);
    });

    test('preserves a negative X sign even when its magnitude is below the native equality tolerance', () => {
        const parent = new Node();
        const child = new Node();
        child.parent = parent;
        child.setScale(1e-7, 1, 1);
        child.getWorldScale();
        child.setWorldScale(-1e-7, 1, 1);
        expect(child.scale.x).toBeLessThan(0);
        expect(child.worldMatrix.m00).toBeLessThan(0);
    });

    test('changes the requested mirror axis even when canonical world-scale readback is identical', () => {
        const parent = new Node();
        const child = new Node();
        child.parent = parent;
        child.setWorldScale(2, -3, 4);
        expectVec3(child.worldScale, new Vec3(-2, 3, 4));
        child.setWorldScale(-2, 3, 4);
        expectVec3(child.worldScale, new Vec3(-2, 3, 4));
        expectVec3(new Vec3(child.worldMatrix.m00, child.worldMatrix.m05, child.worldMatrix.m10), new Vec3(-2, 3, 4));
        child.setScale(2, -3, -4);
        child.getWorldScale();
        child.setWorldScale(2, 3, 4);
        expectVec3(child.scale, new Vec3(2, 3, 4));
    });

    test('restores requested signs independently of old local signs with orientation-preserving parents', () => {
        for (const parentSigns of [0, 3, 5, 6]) {
            for (let localSigns = 0; localSigns < 8; ++localSigns) {
                for (let targetSigns = 0; targetSigns < 8; ++targetSigns) {
                    const parent = new Node();
                    parent.setScale(signedScale(parentSigns, 2, 3, 4));
                    parent.setRotationFromEuler(10, 25, 40);
                    const child = new Node();
                    child.parent = parent;
                    child.setRotationFromEuler(20, 35, 15);
                    child.setScale(signedScale(localSigns, 1, 2, 3));
                    const rotation = child.rotation.clone();
                    const target = signedScale(targetSigns, 2, 3, 4);
                    child.setWorldScale(target);
                    const expectedWorld = new Vec3(target.x * target.y * target.z < 0 ? -2 : 2, 3, 4);
                    expectVec3(child.worldScale, expectedWorld);
                    expect(child.rotation.equals(rotation)).toBe(true);
                    expect(child.scale.y < 0).toBe(target.y < 0);
                    expect(child.scale.z < 0).toBe(target.z < 0);
                    expect(child.scale.x < 0).toBe(target.x < 0);
                    const matrix = child.worldMatrix.clone();
                    child.setWorldScale(target);
                    expect(child.worldMatrix.equals(matrix)).toBe(true);
                    expectVec3(child.worldScale, expectedWorld);
                }
            }
        }
    });

    test('preserves inherited reflections for positive scale and for an already negative world X', () => {
        const cases = [
            { parentScale: new Vec3(-1, 1, 1), expected: new Vec3(-2, 3, 4) },
            { parentScale: new Vec3(1, -1, 1), expected: new Vec3(2, -3, 4) },
            { parentScale: new Vec3(1, 1, -1), expected: new Vec3(2, 3, -4) },
        ];
        for (const { parentScale, expected } of cases) {
            const parent = new Node();
            parent.setScale(parentScale);
            const child = new Node();
            child.parent = parent;
            child.setWorldScale(2, 3, 4);
            expectVec3(new Vec3(child.worldMatrix.m00, child.worldMatrix.m05, child.worldMatrix.m10), expected);
            expectVec3(child.worldScale, new Vec3(-2, 3, 4));
            const matrix = child.worldMatrix.clone();
            child.setWorldScale(-2, 3, 4);
            expect(child.worldMatrix.equals(matrix)).toBe(true);
        }
    });

    test('applies negative Y and Z independently while inheriting the parent X reflection', () => {
        const parent = new Node();
        parent.setScale(-1, 1, 1);
        const child = new Node();
        child.parent = parent;
        child.setWorldScale(2, -3, -4);
        expectVec3(child.scale, new Vec3(2, -3, -4));
        expectVec3(new Vec3(child.worldMatrix.m00, child.worldMatrix.m05, child.worldMatrix.m10), new Vec3(-2, -3, -4));
        const matrix = child.worldMatrix.clone();
        child.setWorldScale(2, -3, -4);
        expect(child.worldMatrix.equals(matrix)).toBe(true);
    });

    test('recomputes world rotation caches when the local mirror signs change', () => {
        const parent = new Node();
        const child = new Node();
        child.parent = parent;
        const grandchild = new Node();
        grandchild.parent = child;
        grandchild.setRotationFromEuler(20, 35, 15);
        child.getWorldRotation();
        grandchild.getWorldRotation();
        child.setWorldScale(2, -3, 4);
        const expected = new Quat();
        Mat4.toSRT(child.worldMatrix, expected, null, null);
        expect(child.worldRotation.equals(expected)).toBe(true);
        Mat4.toSRT(grandchild.worldMatrix, expected, null, null);
        expect(grandchild.worldRotation.equals(expected)).toBe(true);
    });

    test('keeps the existing zero-scale recovery path while restoring negative signs', () => {
        const parent = new Node();
        parent.setScale(2, 2, 2);
        const child = new Node();
        child.parent = parent;
        child.setRotationFromEuler(10, 20, 30);
        const rotation = child.rotation.clone();
        child.setWorldScale(0, 0, 0);
        child.getWorldMatrix();
        child.setWorldScale(-2, -3, 4);
        expectVec3(child.scale, new Vec3(-1, -1.5, 2));
        expectVec3(child.worldScale, new Vec3(2, 3, 4));
        expect(child.rotation.equals(rotation)).toBe(true);
        const matrix = child.worldMatrix.clone();
        child.setWorldScale(-2, -3, 4);
        expect(child.worldMatrix.equals(matrix)).toBe(true);
    });

    test('uses parent reflection signs without counting the UISkew component reflection', () => {
        const root = new Node();
        const parent = new Node();
        parent.parent = root;
        parent.setScale(2, 3, 4);
        const child = new Node();
        child.parent = parent;
        // The UISkew lifecycle is stubbed; matrix composition and decomposition run normally.
        parent._uiProps._uiSkewComp = { x: 180, y: 0, rotational: true, isSkewEnabled: () => true } as UISkew;
        Node._incSkewCompCount();
        try {
            parent.invalidateChildren(TransformBit.SKEW);
            child.setWorldScale(-2, 3, 4);
            expectVec3(child.scale, new Vec3(-1, 1, 1));
            expectVec3(child.worldScale, new Vec3(-2, 3, 4));
        } finally {
            parent._uiProps._uiSkewComp = null;
            Node._decSkewCompCount();
        }
    });
});
