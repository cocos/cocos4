import { Animation } from '../../cocos/animation/animation-component';
import { AnimationClip } from '../../cocos/animation/animation-clip';
import { AnimationManager } from '../../cocos/animation/animation-manager';
import { AnimationController } from '../../cocos/animation/marionette/animation-controller';
import { CrossFade } from '../../cocos/animation/cross-fade';
import { SkeletalAnimation } from '../../cocos/3d/skeletal-animation/skeletal-animation';
import { Node } from '../../cocos/scene-graph';

describe('Animation time scale', () => {
    afterEach(() => { Animation.globalTimeScale = 1; });

    function makeState(component: Animation, name: string) {
        const clip = new AnimationClip(name);
        clip.duration = 100;
        return component.createState(clip);
    }

    test.each([Animation, SkeletalAnimation])('%p multiplies clocks and freezes/resumes without changing state speed', (ComponentType) => {
        const component = new Node().addComponent(ComponentType);
        const manager = new AnimationManager();
        const state = makeState(component, 'first');
        state.speed = 3;
        state.play();
        manager.addAnimation(state);
        manager.update(0);
        Animation.globalTimeScale = 0.5;
        component.timeScale = 0.25;
        manager.update(2);
        expect(state.time).toBeCloseTo(0.75);
        component.timeScale = 0;
        manager.update(10);
        expect(state.time).toBeCloseTo(0.75);
        expect(state.isPlaying).toBe(true);
        expect(state.speed).toBe(3);
        component.timeScale = 2;
        manager.update(1);
        expect(state.time).toBeCloseTo(3.75);
        state.stop();
    });

    test('new states inherit the component clock and components remain independent', () => {
        const a = new Node().addComponent(Animation);
        const b = new Node().addComponent(Animation);
        a.timeScale = 0.25;
        const states = [makeState(a, 'a'), makeState(b, 'b')];
        const manager = new AnimationManager();
        for (const state of states) { state.play(); manager.addAnimation(state); }
        manager.update(0);
        manager.update(1);
        expect(states[0].time).toBeCloseTo(0.25);
        expect(states[1].time).toBeCloseTo(1);
        states.forEach((state) => state.stop());
    });

    test('cross fades use global and component clocks but not state speed', () => {
        const component = new Node().addComponent(Animation);
        const manager = new AnimationManager();
        const fade = new CrossFade(manager);
        fade._timeScaleSource = component;
        const a = makeState(component, 'a');
        const b = makeState(component, 'b');
        b.speed = 7;
        fade.play();
        fade.crossFade(a, 0);
        fade.crossFade(b, 2);
        Animation.globalTimeScale = 0.5;
        component.timeScale = 0.5;
        manager.update(2);
        expect(b.weight).toBeCloseTo(0.25);
        Animation.globalTimeScale = 0;
        manager.update(20);
        expect(b.weight).toBeCloseTo(0.25);
        Animation.globalTimeScale = 1;
        manager.update(1);
        expect(b.weight).toBeCloseTo(0.5);
        fade.stop();
    });

    test.each([-1, NaN, Infinity, -Infinity])('rejects invalid scale %s', (value) => {
        expect(() => { Animation.globalTimeScale = value; }).toThrow(RangeError);
        expect(() => { new Animation().timeScale = value; }).toThrow(RangeError);
        expect(() => { new AnimationController().timeScale = value; }).toThrow(RangeError);
    });
});
