import { Animation } from '../../cocos/animation/animation-component';
import { AnimationClip } from '../../cocos/animation/animation-clip';
import { VectorTrack, QuatTrack, TrackPath } from '../../cocos/animation/animation';
import { getGlobalAnimationManager } from '../../cocos/animation/global-animation-manager';
import { LegacyBlendStateBuffer } from '../../cocos/3d/skeletal-animation/skeletal-animation-blending';
import { Quat, Vec3 } from '../../cocos/core';
import { Node } from '../../cocos/scene-graph';

describe('Frozen animation poses', () => {
    afterEach(() => { Animation.globalTimeScale = 1; });

    function createClip(name: string, path: string, property: string, linear = false) {
        const clip = new AnimationClip(name);
        clip.duration = 10;
        clip.enableTrsBlending = true;
        const binding = new TrackPath().toHierarchy(path).toProperty(property);
        if (property === 'rotation') {
            const track = new QuatTrack();
            track.path = binding;
            const value = Quat.fromEuler(new Quat(), 0, 0, 90);
            track.channel.curve.assignSorted([0, 10], [{ value }, { value }]);
            clip.addTrack(track);
        } else {
            const track = new VectorTrack();
            track.componentsCount = 3;
            track.path = binding;
            const values = property === 'scale' ? [3, 3, 3] : [100, 0, 0];
            values.forEach((value, index) => track.channels()[index].curve.assignSorted([0, 10], [linear ? 0 : value, value]));
            clip.addTrack(track);
        }
        return clip;
    }

    test.each(['position', 'scale', 'eulerAngles', 'rotation'])('component/global zero preserve partially blended %s', (property) => {
        for (const global of [false, true]) {
            const root = new Node();
            const a = new Node('a'); root.addChild(a);
            const b = new Node('b'); root.addChild(b);
            const component = root.addComponent(Animation);
            const manager = getGlobalAnimationManager();
            try {
                component.addClip(createClip('A', 'a', property));
                component.addClip(createClip('B', 'b', property));
                component.play('A');
                manager.update(0);
                component.crossFade('B', 2);
                manager.update(0.5);
                const before = property === 'rotation' ? b.rotation.clone() : (b[property] as Vec3).clone();
                const state = component.getState('B')!;
                const time = state.time;
                const weight = state.weight;
                if (global) Animation.globalTimeScale = 0;
                else component.timeScale = 0;
                for (const dt of [0.1, 1, 0.3, 2]) manager.update(dt);
                expect(state.time).toBe(time);
                expect(state.weight).toBe(weight);
                if (property === 'rotation') expect(Quat.equals(b.rotation, before as Quat)).toBe(true);
                else expect(Vec3.equals(b[property], before as Vec3)).toBe(true);
                Animation.globalTimeScale = 1;
                component.timeScale = 1;
                manager.update(0.2);
                expect(state.time).toBeGreaterThan(time);
                expect(state.weight).toBeGreaterThan(weight);
            } finally {
                component.onDestroy();
                Animation.globalTimeScale = 1;
            }
        }
    });

    test('explicit seeking while frozen samples once and preserves the new pose', () => {
        const root = new Node();
        const a = new Node('a'); root.addChild(a);
        const b = new Node('b'); root.addChild(b);
        const component = root.addComponent(Animation);
        const manager = getGlobalAnimationManager();
        try {
            component.addClip(createClip('A', 'a', 'position'));
            component.addClip(createClip('B', 'b', 'position', true));
            component.play('A'); manager.update(0);
            component.crossFade('B', 2); manager.update(0.5);
            component.timeScale = 0;
            component.getState('B')!.setTime(2);
            manager.update(1);
            expect(b.position.x).toBeCloseTo(5);
            manager.update(0.1); manager.update(2);
            expect(b.position.x).toBeCloseTo(5);
        } finally { component.onDestroy(); }
    });

    test('a frozen contribution does not freeze other active writers on the same property', () => {
        const node = new Node();
        const buffer = new LegacyBlendStateBuffer();
        const frozen = { weight: 0.25, isFrozen: false };
        const active = { weight: 0.25 };
        const writer = buffer.createWriter(node, 'position', frozen, false);
        const other = buffer.createWriter(node, 'position', active, false);
        writer.setValue(new Vec3(100, 0, 0)); buffer.apply();
        expect(node.position.x).toBeCloseTo(25);
        frozen.isFrozen = true;
        writer.setValue(new Vec3(100, 0, 0)); buffer.apply();
        expect(node.position.x).toBeCloseTo(25);
        writer.setValue(new Vec3(100, 0, 0)); other.setValue(new Vec3(200, 0, 0)); buffer.apply();
        expect(node.position.x).toBeCloseTo(87.5);
        writer.setValue(new Vec3(100, 0, 0)); other.setValue(new Vec3(300, 0, 0)); buffer.apply();
        expect(node.position.x).toBeCloseTo(143.75);
        buffer.destroyWriter(writer); buffer.destroyWriter(other);
    });
});
