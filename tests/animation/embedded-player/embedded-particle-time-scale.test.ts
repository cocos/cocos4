import { Animation } from '../../../cocos/animation/animation-component';
import { addEmbeddedPlayerTag, AnimationClip } from '../../../cocos/animation/animation-clip';
import { AnimationManager } from '../../../cocos/animation/animation-manager';
import { getGlobalAnimationManager } from '../../../cocos/animation/global-animation-manager';
import { EmbeddedPlayer } from '../../../cocos/animation/embedded-player/embedded-player';
import { EmbeddedAnimationClipPlayable } from '../../../cocos/animation/embedded-player/embedded-animation-clip-player';
import { EmbeddedParticleSystemPlayable } from '../../../cocos/animation/embedded-player/embedded-particle-system-player';
import { CCObject } from '../../../cocos/core';
import { director } from '../../../cocos/game';
import { ParticleSystem } from '../../../cocos/particle';
import { Node, Scene } from '../../../cocos/scene-graph';

describe('Embedded particle component time scale', () => {
    let scene: Scene;

    beforeEach(() => {
        Animation.globalTimeScale = 1;
        ParticleSystem.globalTimeScale = 1;
        scene = new Scene('embedded-particle-time-scale');
        director.runSceneImmediate(scene);
    });

    afterEach(() => {
        scene.destroy();
        CCObject._deferredDestroy();
        Animation.globalTimeScale = 1;
        ParticleSystem.globalTimeScale = 1;
    });

    function createFixture(reconciledSpeed: boolean, componentScale = 1, stateSpeed = 1) {
        const root = new Node('Root');
        root.active = false;
        scene.addChild(root);
        const child = new Node('Particles');
        root.addChild(child);
        const particle = child.addComponent(ParticleSystem);
        particle.duration = 100;
        particle.loop = true;
        particle.startLifetime.constant = 100;
        particle.rateOverTime.constant = 10;
        particle.renderCulling = false;
        const component = root.addComponent(Animation);
        component.timeScale = componentScale;
        const clip = new AnimationClip('Host');
        clip.duration = 100;
        clip.speed = stateSpeed;
        const embedded = new EmbeddedPlayer();
        embedded.begin = 0;
        embedded.end = 100;
        embedded.reconciledSpeed = reconciledSpeed;
        const playable = embedded.playable = new EmbeddedParticleSystemPlayable();
        playable.path = 'Particles';
        clip[addEmbeddedPlayerTag](embedded);
        component.clips = [clip];
        root.active = true;
        component.play('Host');
        const state = component.getState('Host')!;
        const manager = new AnimationManager();
        manager.addAnimation(state);
        manager.update(0); // Enter the embedded interval without advancing the perfect first frame.
        const step = (dt: number) => {
            manager.update(dt);
            // Advance the real particle simulation using the same frame interval.
            // @ts-expect-error Access protected update to control simulation timing deterministically.
            particle.update(dt);
        };
        return { component, state, particle, step };
    }

    test('reconciles runtime component speed changes, zero and resume without changing state speed', () => {
        const { component, state, particle, step } = createFixture(true);
        component.timeScale = 0.5;
        expect(particle.simulationSpeed).toBe(0.5);
        step(1);
        expect(state.time).toBeCloseTo(0.5);
        expect(particle.time).toBeCloseTo(0.5);
        component.timeScale = 0;
        expect(particle.simulationSpeed).toBe(0);
        step(1);
        expect(state.time).toBeCloseTo(0.5);
        expect(particle.time).toBeCloseTo(0.5);
        expect(particle.simulationSpeed).toBe(0);
        expect(state.isPlaying).toBe(true);
        expect(state.speed).toBe(1);
        component.timeScale = 2;
        expect(particle.simulationSpeed).toBe(2);
        expect(state.speed).toBe(1);
        step(1);
        expect(state.time).toBeCloseTo(2.5);
        expect(particle.time).toBeCloseTo(2.5);
        expect(particle.simulationSpeed).toBe(2);
    });

    test('initial and changed state speeds retain the component multiplier', () => {
        const { component, state, particle, step } = createFixture(true, 0.5, 2);
        expect(state.speed).toBe(2);
        expect(particle.simulationSpeed).toBe(1);
        step(1);
        expect(state.time).toBeCloseTo(1);
        expect(particle.time).toBeCloseTo(1);
        state.speed = 3;
        expect(particle.simulationSpeed).toBe(1.5);
        step(1);
        expect(state.time).toBeCloseTo(2.5);
        expect(particle.time).toBeCloseTo(2.5);
        component.timeScale = 0;
        step(1);
        state.speed = 2;
        expect(particle.simulationSpeed).toBe(0);
        component.timeScale = 1;
        expect(particle.simulationSpeed).toBe(2);
        step(1);
        expect(state.time).toBeCloseTo(4.5);
        expect(particle.time).toBeCloseTo(4.5);
    });

    test('players without reconciledSpeed retain their independent simulation speed', () => {
        const { component, state, particle, step } = createFixture(false);
        particle.simulationSpeed = 0.75;
        component.timeScale = 0.5;
        expect(particle.simulationSpeed).toBe(0.75);
        state.speed = 2;
        step(1);
        expect(state.time).toBeCloseTo(1);
        expect(particle.time).toBeCloseTo(0.75);
        component.timeScale = 0;
        step(1);
        expect(state.time).toBeCloseTo(1);
        expect(particle.time).toBeCloseTo(1.5);
        expect(particle.simulationSpeed).toBe(0.75);
    });

    test('inactive clips sharing a particle system do not overwrite the playing clip speed', () => {
        const { component, state, particle, step } = createFixture(true);
        const clip = new AnimationClip('Inactive');
        clip.duration = 100;
        clip.speed = 3;
        const embedded = new EmbeddedPlayer();
        embedded.begin = 0;
        embedded.end = 100;
        embedded.reconciledSpeed = true;
        const playable = embedded.playable = new EmbeddedParticleSystemPlayable();
        playable.path = 'Particles';
        clip[addEmbeddedPlayerTag](embedded);
        component.addClip(clip);
        expect(particle.simulationSpeed).toBe(1);
        step(1);
        expect(particle.simulationSpeed).toBe(1);
        component.timeScale = 0.5;
        expect(particle.simulationSpeed).toBe(0.5);
        expect(state.speed).toBe(1);
        const inactiveState = component.getState('Inactive')!;
        expect(inactiveState.speed).toBe(3);
        inactiveState.speed = 4;
        expect(particle.simulationSpeed).toBe(0.5);
        state.stop();
        inactiveState.play();
        inactiveState.update(0);
        expect(particle.simulationSpeed).toBe(2);
        inactiveState.stop();
        state.play();
        step(0);
        expect(particle.simulationSpeed).toBe(0.5);
        inactiveState.speed = 3;
        expect(particle.simulationSpeed).toBe(0.5);
        step(1);
        expect(particle.simulationSpeed).toBe(0.5);
    });

    test('manually sampled embedded animations forward component scale to nested reconciled particles', () => {
        const root = new Node('Root');
        root.active = false;
        scene.addChild(root);
        const middle = new Node('Middle');
        root.addChild(middle);
        const child = new Node('Particles');
        middle.addChild(child);
        const particle = child.addComponent(ParticleSystem);
        particle.duration = 100;
        particle.startLifetime.constant = 100;
        particle.rateOverTime.constant = 10;
        particle.renderCulling = false;
        const childClip = new AnimationClip('Child');
        childClip.duration = 100;
        const inner = new EmbeddedPlayer();
        inner.begin = 0;
        inner.end = 100;
        inner.reconciledSpeed = true;
        const innerPlayable = inner.playable = new EmbeddedParticleSystemPlayable();
        innerPlayable.path = 'Particles';
        childClip[addEmbeddedPlayerTag](inner);
        const hostClip = new AnimationClip('Host');
        hostClip.duration = 100;
        const outer = new EmbeddedPlayer();
        outer.begin = 0;
        outer.end = 100;
        outer.reconciledSpeed = true;
        const outerPlayable = outer.playable = new EmbeddedAnimationClipPlayable();
        outerPlayable.path = 'Middle';
        outerPlayable.clip = childClip;
        hostClip[addEmbeddedPlayerTag](outer);
        const component = root.addComponent(Animation);
        component.clips = [hostClip];
        root.active = true;
        component.play('Host');
        const state = component.getState('Host')!;
        const manager = getGlobalAnimationManager();
        manager.addAnimation(state);
        manager.update(0);
        component.timeScale = 0.5;
        expect(particle.simulationSpeed).toBe(0.5);
        manager.update(1);
        // @ts-expect-error Advance protected simulation at a deterministic frame interval.
        particle.update(1);
        expect(particle.time).toBeCloseTo(0.5);
        component.timeScale = 0;
        expect(particle.simulationSpeed).toBe(0);
        manager.update(1);
        // @ts-expect-error Advance protected simulation at a deterministic frame interval.
        particle.update(1);
        expect(particle.time).toBeCloseTo(0.5);
        component.timeScale = 2;
        expect(particle.simulationSpeed).toBe(2);
        manager.update(1);
        // @ts-expect-error Advance protected simulation at a deterministic frame interval.
        particle.update(1);
        expect(particle.time).toBeCloseTo(2.5);
        expect(state.time).toBeCloseTo(2.5);
    });

    test('unified animation and particle global clocks are not multiplied twice', () => {
        const { state, particle, step } = createFixture(true, 0.5, 2);
        Animation.globalTimeScale = 0.5;
        ParticleSystem.globalTimeScale = 0.5;
        step(1);
        expect(particle.simulationSpeed).toBe(1);
        expect(state.time).toBeCloseTo(0.5);
        expect(particle.time).toBeCloseTo(0.5);
        Animation.globalTimeScale = 0;
        ParticleSystem.globalTimeScale = 0;
        step(1);
        expect(state.time).toBeCloseTo(0.5);
        expect(particle.time).toBeCloseTo(0.5);
        Animation.globalTimeScale = 1;
        ParticleSystem.globalTimeScale = 1;
        step(1);
        expect(state.time).toBeCloseTo(1.5);
        expect(particle.time).toBeCloseTo(1.5);
    });
});
