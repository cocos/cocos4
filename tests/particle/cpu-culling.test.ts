import { director } from '../../cocos/game';
import { legacyCC } from '../../cocos/core/global-exports';
import { ForceFieldModule, ParticleSystem, SubEmitter } from '../../exports/particle';
import { geometry, Vec3 } from '../../cocos/core';
import { ParticleSpace } from '../../cocos/particle/enum';
import { Node, Scene } from '../../cocos/scene-graph';

test('particle system cpu culling test', () => {
    const scene = new Scene('test');
    director.runSceneImmediate(scene);

    const temp0 = new Node();
    scene.addChild(temp0);

    const particle = temp0.addComponent(ParticleSystem);

    particle.renderCulling = true;
    particle.loop = false;
    particle.playOnAwake = true;
    particle.renderer.useGPU = false;

    legacyCC.game.step();

    expect(particle.aabbHalfX > 0 && particle.aabbHalfY > 0 && particle.aabbHalfZ > 0).toBeTruthy(); // ensure bounding box size > 0

    expect(particle).toHaveProperty('_isSimulating', false); // open culling, particle should be culled

    particle.renderCulling = false;

    legacyCC.game.step();

    expect(particle).toHaveProperty('_isSimulating', true); // close culling, particle should continue simulating
});

test.each([ParticleSpace.Local, ParticleSpace.World])('sub-emitter bounds in simulation space %i', (space) => {
    const scene = new Scene('sub-emitter culling');
    director.runSceneImmediate(scene);
    const parentNode = new Node();
    const targetNode = new Node();
    scene.addChild(parentNode);
    scene.addChild(targetNode);
    targetNode.setPosition(100, 0, 0);
    const parent = parentNode.addComponent(ParticleSystem);
    const target = targetNode.addComponent(ParticleSystem);
    parent.startSpeed.constant = target.startSpeed.constant = 0;
    target.startSizeX.constant = 4;
    target.simulationSpace = space;
    const entry = new SubEmitter();
    entry.emitter = targetNode;
    parent.subEmitters.push(entry);
    parent.renderCulling = true;
    expect(parent.aabbHalfX).toBeCloseTo(5);

    parent.emit(1, 0);
    targetNode.setPosition(110, 0, 0);
    const base = new geometry.AABB(110, 0, 0, 4, 4, 4);
    const bounds = target.processor.getCullingBounds(base);
    const min = new Vec3();
    const max = new Vec3();
    bounds.getBoundary(min, max);
    expect(min.x).toBeCloseTo(space === ParticleSpace.Local ? 6 : -4);
    expect(max.x).toBeCloseTo(114);
    target.processor.updateParticles(10);
    expect(target.processor.getCullingBounds(base)).toBe(base);
});

test.each([ParticleSpace.World, ParticleSpace.Local])('offset sub-emitter remains in force-field culling bounds (space %i)', (space) => {
    const scene = new Scene('offset force field');
    director.runSceneImmediate(scene);
    const launcher = new Node();
    const sparks = new Node();
    scene.addChild(launcher);
    scene.addChild(sparks);
    sparks.setPosition(100, 0, 0);
    const parent = launcher.addComponent(ParticleSystem);
    const child = sparks.addComponent(ParticleSystem);
    child.simulationSpace = space;
    parent.startSpeed.constant = child.startSpeed.constant = 0;
    child.startLifetime.constant = 1;
    const field = new ForceFieldModule();
    field.space = ParticleSpace.World;
    field.center.set(1, 0, 0);
    field.radius = 10;
    field.strength = 20;
    child.forceFieldModule = field;
    field.enable = true;
    const entry = new SubEmitter();
    entry.emitter = sparks;
    parent.subEmitters.push(entry);
    parent.renderCulling = child.renderCulling = true;

    // The child node is outside the field. A particle born at the launcher
    // experiences acceleration -18 and moves -4.5 on its first 0.5s step.
    parent.emit(1, 0);
    const base = new geometry.AABB(100, 0, 0, 1, 1, 1);
    const min = new Vec3();
    child.processor.getCullingBounds(base).getBoundary(min, new Vec3());
    expect(min.x).toBeLessThanOrEqual(-5.5);
    expect(parent.aabbHalfX).toBeGreaterThanOrEqual(5.5);
    child.processor.updateParticles(0.5);
    child.processor.updateParticles(0.6);
    expect(child.processor.getCullingBounds(base)).toBe(base);
});
