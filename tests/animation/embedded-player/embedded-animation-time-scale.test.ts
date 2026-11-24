import { Animation } from '../../../cocos/animation/animation-component';
import { AnimationClip, addEmbeddedPlayerTag } from '../../../cocos/animation/animation-clip';
import { VectorTrack, TrackPath } from '../../../cocos/animation/animation';
import { getGlobalAnimationManager } from '../../../cocos/animation/global-animation-manager';
import { EmbeddedPlayer } from '../../../cocos/animation/embedded-player/embedded-player';
import { EmbeddedAnimationClipPlayable } from '../../../cocos/animation/embedded-player/embedded-animation-clip-player';
import { AnimationController } from '../../../cocos/animation/marionette/animation-controller';
import { AnimationGraph } from '../../../cocos/animation/marionette/animation-graph';
import { AnimationGraphEval } from '../../../cocos/animation/marionette/graph-eval';
import { ClipMotion } from '../../../cocos/animation/marionette/motion';
import { Node, Component } from '../../../cocos/scene-graph';

describe('Embedded animation clocks', () => {
    const cleanups: Array<() => void> = [];

    afterEach(() => {
        cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
        Animation.globalTimeScale = 1;
        jest.restoreAllMocks();
    });

    function makeClip(name: string, duration = 10): AnimationClip {
        const clip = new AnimationClip(name);
        clip.duration = duration;
        return clip;
    }

    function makePositionClip(name: string, duration = 10): AnimationClip {
        const clip = makeClip(name, duration);
        clip.enableTrsBlending = true;
        const track = new VectorTrack();
        track.componentsCount = 3;
        track.path = new TrackPath().toProperty('position');
        track.channels()[0].curve.assignSorted([0, duration], [0, duration]);
        track.channels()[1].curve.assignSorted([0, duration], [0, 0]);
        track.channels()[2].curve.assignSorted([0, duration], [0, 0]);
        clip.addTrack(track);
        return clip;
    }

    function embed(host: AnimationClip, clip: AnimationClip, path: string) {
        const player = new EmbeddedPlayer();
        player.begin = 0;
        player.end = host.duration;
        const playable = new EmbeddedAnimationClipPlayable();
        playable.path = path;
        playable.clip = clip;
        player.playable = playable;
        host[addEmbeddedPlayerTag](player);
        return { playable, instantiate: jest.spyOn(playable, 'instantiate') };
    }

    function legacy(root: Node, clip: AnimationClip) {
        const component = root.addComponent(Animation);
        component.addClip(clip);
        cleanups.push(() => component.onDestroy());
        const manager = getGlobalAnimationManager();
        return { component, manager, step: (dt: number) => manager.update(dt) };
    }

    function graph(root: Node, clip: AnimationClip) {
        const graph = new AnimationGraph();
        const machine = graph.addLayer().stateMachine;
        const state = machine.addMotion();
        const motion = new ClipMotion();
        motion.clip = clip;
        state.motion = motion;
        machine.connect(machine.entryState, state);
        const controller = root.addComponent(AnimationController);
        const embeddedEvaluations = jest.spyOn(clip, 'createEmbeddedPlayerEvaluator');
        const evaluation = new AnimationGraphEval(graph, root, controller, null);
        // Use a real evaluator while retaining the controller's public update path.
        (controller as any)._graphEval = evaluation;
        cleanups.push(() => {
            // Graph disposal currently does not release motion evaluators. Dispose the
            // actual embedded players here so this fixture does not retain pose outputs.
            for (const result of embeddedEvaluations.mock.results) result.value.destroy();
            controller.onDestroy();
            (controller as any)._graphEval = null;
        });
        const manager = getGlobalAnimationManager();
        return { controller, manager, step: (dt: number) => {
            controller.update(dt);
            manager.update(dt);
        } };
    }

    test.each(['legacy', 'graph'] as const)('%s host samples its child at the scaled host time only', (kind) => {
        const root = new Node('Root');
        const target = new Node('Target');
        root.addChild(target);
        const hostClip = makeClip('Host');
        embed(hostClip, makePositionClip('Child'), 'Target');
        const fixture = kind === 'legacy' ? legacy(root, hostClip) : graph(root, hostClip);
        const component = 'component' in fixture ? fixture.component : fixture.controller;
        component.timeScale = 0.5;
        Animation.globalTimeScale = 0.5;
        expect(AnimationController.globalTimeScale).toBe(0.5);
        if (component instanceof Animation) component.play('Host');
        fixture.step(0);
        fixture.step(0.4);
        expect(target.position.x).toBeCloseTo(0.1);
        fixture.step(0.8);
        expect(target.position.x).toBeCloseTo(0.3);
        component.timeScale = 0;
        fixture.step(0.1);
        fixture.step(0.3);
        expect(target.position.x).toBeCloseTo(0.3);
        component.timeScale = 2;
        fixture.step(0.2);
        expect(target.position.x).toBeCloseTo(0.5);
        AnimationController.globalTimeScale = 0;
        expect(Animation.globalTimeScale).toBe(0);
        fixture.step(0.13);
        fixture.step(0.37);
        expect(target.position.x).toBeCloseTo(0.5);
    });

    test('legacy pause, resume, stop and replay retain the embedded lifecycle', () => {
        const root = new Node('Root');
        const target = new Node('Target'); root.addChild(target);
        const hostClip = makeClip('Host');
        const embedded = embed(hostClip, makePositionClip('Child'), 'Target');
        const { component, step } = legacy(root, hostClip);
        const player = embedded.instantiate.mock.results[0].value!;
        const pause = jest.spyOn(player, 'pause');
        const play = jest.spyOn(player, 'play');
        const stop = jest.spyOn(player, 'stop');
        component.play('Host'); step(0); step(0.4);
        expect(target.position.x).toBeCloseTo(0.4);
        component.pause(); step(0.8);
        expect(pause).toHaveBeenCalledTimes(1);
        expect(target.position.x).toBeCloseTo(0.4);
        component.resume(); step(0.2);
        expect(play).toHaveBeenCalledTimes(2);
        expect(target.position.x).toBeCloseTo(0.6);
        component.stop(); step(0.5);
        expect(stop).toHaveBeenCalledTimes(1);
        expect(target.position.x).toBeCloseTo(0.6);
        component.play('Host'); step(0); step(0.2);
        expect(target.position.x).toBeCloseTo(0.2);
    });

    test.each(['legacy', 'graph'] as const)('%s host preserves nested playback and playable destruction', (kind) => {
        const root = new Node('Root');
        const middle = new Node('Middle'); root.addChild(middle);
        const leaf = new Node('Leaf'); middle.addChild(leaf);
        const hostClip = makeClip('Host');
        const middleClip = makeClip('Middle');
        const inner = embed(middleClip, makePositionClip('Leaf'), 'Leaf');
        embed(hostClip, middleClip, 'Middle');
        const fixture = kind === 'legacy' ? legacy(root, hostClip) : graph(root, hostClip);
        const component = 'component' in fixture ? fixture.component : fixture.controller;
        const innerPlayer = inner.instantiate.mock.results[0].value!;
        const innerStop = jest.spyOn(innerPlayer, 'stop');
        const innerDestroy = jest.spyOn(innerPlayer, 'destroy');
        if (component instanceof Animation) component.play('Host');
        fixture.step(0);
        fixture.step(0.45);
        expect(leaf.position.x).toBeCloseTo(0.45);
        if (component instanceof Animation) {
            component.pause();
            fixture.step(0.4);
            expect(leaf.position.x).toBeCloseTo(0.45);
            component.resume();
            fixture.step(0.1);
            expect(leaf.position.x).toBeCloseTo(0.55);
        }
        const beforeFreeze = leaf.position.x;
        component.timeScale = 0;
        fixture.step(0.1); fixture.step(0.3);
        expect(leaf.position.x).toBeCloseTo(beforeFreeze);
        component.timeScale = 0.5;
        fixture.step(0.2);
        expect(leaf.position.x).toBeCloseTo(beforeFreeze + 0.1);
        cleanups.pop()!();
        expect(innerStop).toHaveBeenCalledTimes(1);
        expect(innerDestroy).toHaveBeenCalledTimes(1);
        expect(fixture.manager.animationStates).toHaveLength(0);
    });

    test('embedded frame events fire once at the host time and not while frozen', () => {
        class Listener extends Component { public frameEvent = jest.fn(); }
        const root = new Node('Root');
        const target = new Node('Target'); root.addChild(target);
        const listener = target.addComponent(Listener);
        listener.frameEvent.mockImplementation(() => {
            // Delayed frame events must observe this frame's applied pose.
            expect(target.position.x).toBeCloseTo(0.6);
        });
        const clip = makePositionClip('Child');
        clip.events = [{ frame: 0.5, func: 'frameEvent', params: [] }];
        const hostClip = makeClip('Host');
        embed(hostClip, clip, 'Target');
        const { component, step } = legacy(root, hostClip);
        component.play('Host'); step(0); step(0.1);
        expect(target.position.x).toBeCloseTo(0.1);
        step(0.3);
        expect(target.position.x).toBeCloseTo(0.4);
        expect(listener.frameEvent).not.toHaveBeenCalled();
        component.timeScale = 0;
        step(0.3); step(0.8);
        expect(listener.frameEvent).not.toHaveBeenCalled();
        component.timeScale = 1;
        step(0.2);
        expect(listener.frameEvent).toHaveBeenCalledTimes(1);
        expect(target.position.x).toBeCloseTo(0.6);
        component.timeScale = 0;
        step(0.12); step(0.45);
        expect(listener.frameEvent).toHaveBeenCalledTimes(1);
    });

    test('default playback retains registration order for overlapping non-blended tracks', () => {
        const root = new Node('Root');
        const target = new Node('Target'); root.addChild(target);
        const hostClip = makeClip('Host');
        const childClip = makePositionClip('Child');
        childClip.enableTrsBlending = false;
        embed(hostClip, childClip, 'Target');
        const { component, step } = legacy(root, hostClip);
        component.play('Host'); step(0);

        const otherClip = makePositionClip('Other');
        otherClip.enableTrsBlending = false;
        const track = Array.from(otherClip.tracks)[0] as VectorTrack;
        track.channels()[0].curve.assignSorted([0, 10], [200, 200]);
        const other = legacy(target, otherClip).component;
        other.play('Other');
        step(0.02);
        expect(target.position.x).toBe(200);
        other.stop();
        step(0.02);
        expect(target.position.x).toBeCloseTo(0.04);
    });

    test('repeated host seeks in one frame sample only the last host time', () => {
        const root = new Node('Root');
        const target = new Node('Target'); root.addChild(target);
        const playable = new EmbeddedAnimationClipPlayable();
        playable.path = 'Target';
        playable.clip = makePositionClip('Child');
        const player = playable.instantiate(root)!;
        cleanups.push(() => player.destroy());
        player.play();
        player.setTime(0.2);
        player.setTime(0.6);
        getGlobalAnimationManager().update(0.3);
        expect(target.position.x).toBeCloseTo(0.6);
    });
});
