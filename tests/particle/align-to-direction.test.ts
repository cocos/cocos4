import { Quat, Vec3 } from '../../cocos/core';
import { Node, Scene } from '../../cocos/scene-graph';
import { ParticleSystem } from '../../cocos/particle/particle-system';
import { Particle } from '../../cocos/particle/particle';
import { ParticleAlignmentSpace, ParticleRenderMode, ParticleShapeType, ParticleSpace } from '../../cocos/particle/enum';
import RotationOvertimeModule from '../../cocos/particle/animator/rotation-overtime';
import ShapeModule from '../../cocos/particle/emitter/shape-module';
import ParticleSystemRendererCPU from '../../cocos/particle/renderer/particle-system-renderer-cpu';
import ParticleSystemRendererGPU from '../../cocos/particle/renderer/particle-system-renderer-gpu';
import ParticleSystemRenderer from '../../cocos/particle/renderer/particle-system-renderer-data';
import { ParticleSystemRendererBase } from '../../cocos/particle/renderer/particle-system-renderer-base';
import { Pass } from '../../cocos/render-scene';

const forward = new Vec3(0, 0, -1);

function rotationOf(p: Particle): Quat {
    return Quat.fromEuler(new Quat(), p.rotation.x * Particle.R2D, p.rotation.y * Particle.R2D, p.rotation.z * Particle.R2D);
}

function expectRotation(actual: Quat, expected: Quat): void {
    // Compare transformed basis vectors: q and -q represent the same rotation.
    for (const axis of [Vec3.UNIT_X, Vec3.UNIT_Y, Vec3.UNIT_Z]) {
        const a = Vec3.transformQuat(new Vec3(), axis, actual);
        const b = Vec3.transformQuat(new Vec3(), axis, expected);
        expect(a.x).toBeCloseTo(b.x, 5);
        expect(a.y).toBeCloseTo(b.y, 5);
        expect(a.z).toBeCloseTo(b.z, 5);
    }
}

function fixture() {
    const ps = new ParticleSystem();
    ps.node = new Node();
    const p = new Particle(ps);
    // Exercise the shared CPU/GPU emission path without allocating render resources.
    ps.processor = {
        getFreeParticle: () => p,
        setNewParticle: jest.fn(),
        getInfo: () => ({ renderMode: ParticleRenderMode.Mesh }),
        updateMaterialParams: () => {},
        updateTrailMaterial: () => {},
    } as unknown as ParticleSystem['processor'];
    const shape = new ShapeModule();
    ps.shapeModule = shape;
    shape.onInit(ps);
    shape.enable = true;
    shape.alignToDirection = true;
    shape.shapeType = ParticleShapeType.Box;
    return { ps, p, shape };
}

describe('AlignToDirection', () => {
    describe.each([ParticleSystemRendererCPU, ParticleSystemRendererGPU])('mesh renderer %p', (Renderer) => {
        test.each([
            [ParticleSpace.Local, ParticleAlignmentSpace.Local],
            [ParticleSpace.Local, ParticleAlignmentSpace.World],
            [ParticleSpace.Local, ParticleAlignmentSpace.View],
            [ParticleSpace.World, ParticleAlignmentSpace.Local],
            [ParticleSpace.World, ParticleAlignmentSpace.World],
            [ParticleSpace.World, ParticleAlignmentSpace.View],
        ])('combines shader rotations in simulation space %s with alignment space %s', (space, alignment) => {
            const { ps, p, shape } = fixture();
            const scene = new Scene();
            const parent = new Node();
            scene.addChild(parent);
            parent.addChild(ps.node);
            Object.defineProperty(ps.node, 'scene', { value: scene });
            parent.setRotationFromEuler(15, 25, 35);
            ps.node.setRotationFromEuler(20, 50, 10);
            // A rotated camera must not change a direction-aligned mesh.
            Object.defineProperty(scene, 'renderScene', { value: { cameras: [{
                visibility: 0xffffffff, name: 'Editor Camera', forward: new Vec3(1, 0, 0),
            }] } });
            ps.simulationSpace = space;
            shape.rotation = new Vec3(30, 40, 0);
            ps.emit(1, 0);
            const info = new ParticleSystemRenderer();
            info.renderMode = ParticleRenderMode.Mesh;
            const renderer = new Renderer(info);
            // Initialize only the system reference; no GPU resources are needed.
            ParticleSystemRendererBase.prototype.onInit.call(renderer, ps);
            renderer.updateAlignSpace(alignment);
            const uniform = new Quat();
            const pass = { setUniform: (_handle: number, value: Quat) => Quat.copy(uniform, value) } as unknown as Pass;
            const check = () => {
                renderer.updateRotation(pass);
                // Match particle-vs-legacy.chunk: rotMat = nodeMat * rotMat.
                const rendered = Quat.multiply(new Quat(), uniform, rotationOf(p));
                const actual = Vec3.transformQuat(new Vec3(), forward, rendered);
                const expected = p.velocity.clone().normalize();
                if (space === ParticleSpace.Local) Vec3.transformQuat(expected, expected, ps.node.worldRotation);
                expect(actual.x).toBeCloseTo(expected.x, 5);
                expect(actual.y).toBeCloseTo(expected.y, 5);
                expect(actual.z).toBeCloseTo(expected.z, 5);
            };
            check();
            // Existing world particles remain fixed; local particles follow their parent.
            parent.setRotationFromEuler(60, -35, 20);
            ps.node.setRotationFromEuler(-10, 80, 30);
            check();

            // Disabling alignment restores the renderer's existing alignment-space behavior.
            shape.alignToDirection = false;
            renderer.updateRotation(pass);
            const expected = alignment === ParticleAlignmentSpace.Local ? ps.node.rotation
                : alignment === ParticleAlignmentSpace.World ? ps.node.worldRotation
                    : Quat.fromViewUp(new Quat(), new Vec3(1, 0, 0));
            expectRotation(uniform, expected);
        });
    });

    test.each([[0, 0, 0], [0, 180, 0], [90, 0, 0], [31, 47, 19]])('aligns with rotated shape (%s, %s, %s)', (x, y, z) => {
        const { ps, p, shape } = fixture();
        shape.rotation = new Vec3(x, y, z);
        ps.emit(1, 0);
        const direction = Vec3.transformQuat(new Vec3(), forward, rotationOf(p));
        const velocity = p.velocity.clone().normalize();
        expect(direction.x).toBeCloseTo(velocity.x, 5);
        expect(direction.y).toBeCloseTo(velocity.y, 5);
        expect(direction.z).toBeCloseTo(velocity.z, 5);
    });

    test.each([ParticleSpace.Local, ParticleSpace.World])('composes start rotation in simulation space %s, even at zero speed', (space) => {
        const { ps, p, shape } = fixture();
        ps.simulationSpace = space;
        ps.node.setRotationFromEuler(20, 50, 10);
        shape.rotation = new Vec3(30, 40, 0);
        ps.startSpeed.constant = 0;
        ps.startRotation3D = true;
        ps.startRotationX.constant = 0.2;
        ps.startRotationY.constant = 0.3;
        ps.startRotationZ.constant = 0.4;
        const direction = Vec3.transformQuat(new Vec3(), forward, Quat.fromEuler(new Quat(), 30, 40, 0));
        if (space === ParticleSpace.World) Vec3.transformQuat(direction, direction, ps.node.worldRotation);
        const expected = Quat.rotationTo(new Quat(), forward, direction.normalize());
        Quat.multiply(expected, expected, Quat.fromEuler(new Quat(), 0.2 * Particle.R2D, 0.3 * Particle.R2D, 0.4 * Particle.R2D));
        ps.emit(1, 0);
        expectRotation(rotationOf(p), expected);
        expect(p.velocity.lengthSqr()).toBe(0);

        const module = new RotationOvertimeModule();
        module.z.constant = 0.6;
        module.animate(p, 0.5);
        Quat.multiply(expected, expected, Quat.fromEuler(new Quat(), 0, 0, 0.3 * Particle.R2D));
        const encoded = p.rotation.clone();
        const sign = encoded.x > Particle.INDENTIFY_NEG_QUAT * 0.5 ? -1 : 1;
        if (sign < 0) encoded.x -= Particle.INDENTIFY_NEG_QUAT;
        expectRotation(new Quat(encoded.x, encoded.y, encoded.z, sign * Math.sqrt(Math.abs(1 - encoded.lengthSqr()))), expected);
    });

    test.each(['alignment', 'shape'])('resets reused particles when %s is disabled', (disabled) => {
        const { ps, p, shape } = fixture();
        shape.rotation = new Vec3(0, 90, 0);
        ps.startRotationZ.constant = 0.4;
        ps.emit(1, 0);
        if (disabled === 'alignment') shape.alignToDirection = false;
        else shape.enable = false;
        ps.emit(1, 0);
        expect(p.rotation).toEqual(new Vec3(0, 0, 0.4));
        expect(p.startRotated).toBe(false);
    });

    test('uses the final spherical direction and handles a degenerate direction', () => {
        const { ps, p, shape } = fixture();
        shape.scale = Vec3.ZERO.clone();
        shape.position = new Vec3(3, 4, 0);
        shape.sphericalDirectionAmount = 1;
        ps.emit(1, 0);
        expectRotation(rotationOf(p), Quat.rotationTo(new Quat(), forward, new Vec3(0.6, 0.8, 0)));
        shape.position = Vec3.ZERO.clone();
        ps.startRotationZ.constant = 0.7;
        ps.emit(1, 0);
        expect(p.rotation).toEqual(new Vec3(0, 0, 0.7));
    });
});
