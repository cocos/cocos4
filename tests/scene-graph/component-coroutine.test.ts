import {
    Component,
    director,
    nextFrame,
    Node,
    Scene,
    System,
    waitFor,
    waitUntil,
    waitWhile,
    type Coroutine,
    type CoroutineIterator,
    type StartCoroutineOptions,
} from '../../exports/base';

class CoroutineProbe extends Component {
    public onUpdate: ((dt: number) => void) | undefined;
    public onLateUpdate: ((dt: number) => void) | undefined;

    public runCoroutine (coroutine: CoroutineIterator, opts?: StartCoroutineOptions): Coroutine {
        return this.startCoroutine(coroutine, opts);
    }

    public stopCoroutineHandle (coroutine: Coroutine): void {
        this.stopCoroutine(coroutine);
    }

    public stopAllCoroutineHandles (): void {
        this.stopAllCoroutines();
    }

    protected update (dt: number): void {
        this.onUpdate?.(dt);
    }

    protected lateUpdate (dt: number): void {
        this.onLateUpdate?.(dt);
    }
}

class RecordingSystem extends System {
    constructor (private readonly _events: string[]) {
        super();
    }

    public update (): void {
        this._events.push('system');
    }
}

let scene: Scene | undefined;
let systems: System[] = [];

afterEach(() => {
    for (const system of systems) {
        director.unregisterSystem(system);
    }
    systems = [];

    scene?.destroy();
    scene = undefined;
});

describe('Component coroutine', () => {
    it('starts synchronously and resumes after component update with frame context', () => {
        /// @case
        /// 1. A component starts a coroutine outside the director tick.
        /// 2. The coroutine yields until the next frame.
        /// @expect
        /// The coroutine runs to its first yield immediately, then resumes with frame data on the next tick.
        const { component } = createProbe();
        const events: string[] = [];
        const frames: unknown[] = [];

        component.runCoroutine((function* (): CoroutineIterator {
            events.push('start');
            frames.push(yield null);
            events.push('resume');
        })());

        expect(events).toEqual(['start']);

        director.tick(0.125);

        expect(events).toEqual(['start', 'resume']);
        expect(frames).toEqual([{
            deltaTime: 0.125,
            elapsedTime: 0.125,
            frame: 1,
        }]);
    });

    it('waits with frame, time, until, and while instructions', () => {
        /// @case
        /// 1. A coroutine yields next-frame, timed, wait-until, and wait-while instructions.
        /// 2. The waited predicates change across later director ticks.
        /// @expect
        /// Each instruction resumes only after its own wait condition is satisfied.
        const { component } = createProbe();
        const events: string[] = [];
        const frames: unknown[] = [];
        let ready = false;
        let blocking = true;

        component.runCoroutine((function* (): CoroutineIterator {
            events.push('start');
            frames.push(yield nextFrame());
            events.push('after-frame');
            frames.push(yield waitFor(0.25));
            events.push('after-time');
            frames.push(yield waitUntil((): boolean => ready));
            events.push('after-until');
            frames.push(yield waitWhile((): boolean => blocking));
            events.push('after-while');
        })());

        director.tick(0.1);
        expect(events).toEqual(['start', 'after-frame']);
        expect(frames).toEqual([expect.objectContaining({ frame: 1 })]);

        director.tick(0.1);
        expect(events).toEqual(['start', 'after-frame']);

        director.tick(0.15);
        expect(events).toEqual(['start', 'after-frame', 'after-time']);
        expect(frames).toEqual([
            expect.objectContaining({ frame: 1 }),
            expect.objectContaining({ elapsedTime: expect.closeTo(0.35) }),
        ]);

        director.tick(0.1);
        expect(events).toEqual(['start', 'after-frame', 'after-time']);

        ready = true;
        director.tick(0.1);
        expect(events).toEqual(['start', 'after-frame', 'after-time', 'after-until']);

        director.tick(0.1);
        expect(events).toEqual(['start', 'after-frame', 'after-time', 'after-until']);

        blocking = false;
        director.tick(0.1);
        expect(events).toEqual(['start', 'after-frame', 'after-time', 'after-until', 'after-while']);
    });

    it('orders coroutine continuations after update and before systems and lateUpdate', () => {
        /// @case
        /// 1. A component has update, a resumed coroutine, and lateUpdate.
        /// 2. A director system is registered for the same tick.
        /// @expect
        /// The frame order is component update, coroutine continuation, system update, then component lateUpdate.
        const { component } = createProbe();
        const events: string[] = [];
        const system = new RecordingSystem(events);
        systems.push(system);
        director.registerSystem('component-coroutine-order-test', system, System.Priority.MEDIUM);

        component.onUpdate = (): void => {
            events.push('update');
        };
        component.onLateUpdate = (): void => {
            events.push('lateUpdate');
        };
        component.runCoroutine((function* (): CoroutineIterator {
            yield nextFrame();
            events.push('coroutine');
        })());

        director.tick(0.1);

        expect(events).toEqual(['update', 'coroutine', 'system', 'lateUpdate']);
    });

    it('resumes synchronously started coroutines in start order', () => {
        /// @case
        /// 1. A component starts two coroutines synchronously.
        /// 2. Both coroutines yield to later frames.
        /// @expect
        /// The coroutines start and resume in their start order on every coroutine update.
        const { component } = createProbe();
        const events: string[] = [];

        component.runCoroutine((function* (): CoroutineIterator {
            events.push('first-start');
            yield nextFrame();
            events.push('first-resume');
            yield nextFrame();
            events.push('first-resume-again');
        })());
        component.runCoroutine((function* (): CoroutineIterator {
            events.push('second-start');
            yield nextFrame();
            events.push('second-resume');
            yield nextFrame();
            events.push('second-resume-again');
        })());

        expect(events).toEqual(['first-start', 'second-start']);

        director.tick(0.1);
        expect(events).toEqual(['first-start', 'second-start', 'first-resume', 'second-resume']);

        director.tick(0.1);
        expect(events).toEqual([
            'first-start',
            'second-start',
            'first-resume',
            'second-resume',
            'first-resume-again',
            'second-resume-again',
        ]);
    });

    it('stops a component coroutine when its signal is aborted', () => {
        /// @case
        /// 1. A component starts a coroutine with an abort signal.
        /// 2. The signal is aborted while the coroutine is waiting.
        /// @expect
        /// Aborting the signal stops the coroutine immediately and runs cleanup once.
        const { component } = createProbe();
        const controller = new AbortController();
        const events: string[] = [];

        component.runCoroutine((function* (): CoroutineIterator {
            try {
                events.push('start');
                yield waitUntil((): boolean => false);
            } finally {
                events.push('cleanup');
            }
        })(), {
            signal: controller.signal,
        });

        director.tick(0.1);
        expect(events).toEqual(['start']);

        controller.abort();
        expect(events).toEqual(['start', 'cleanup']);

        director.tick(0.1);
        expect(events).toEqual(['start', 'cleanup']);
    });
    it('defers coroutines started during update to the next frame', () => {
        /// @case
        /// 1. A component starts a coroutine from its update callback.
        /// 2. The coroutine yields until the next frame.
        /// @expect
        /// The coroutine starts immediately, but does not resume in the same frame's coroutine phase.
        const { component } = createProbe();
        const events: string[] = [];
        let started = false;

        component.onUpdate = (): void => {
            events.push('update');
            if (!started) {
                started = true;
                component.runCoroutine((function* (): CoroutineIterator {
                    events.push('coroutine-start');
                    yield nextFrame();
                    events.push('coroutine-resume');
                })());
            }
        };

        director.tick(0.1);
        expect(events).toEqual(['update', 'coroutine-start']);

        events.length = 0;
        director.tick(0.1);
        expect(events).toEqual(['update', 'coroutine-resume']);
    });

    it('defers coroutines started during coroutine update to the next frame', () => {
        /// @case
        /// 1. A resumed coroutine starts another coroutine during the coroutine phase.
        /// 2. The child coroutine yields until the next frame.
        /// @expect
        /// The child coroutine starts immediately and resumes on the following frame, not the current one.
        const { component } = createProbe();
        const events: string[] = [];

        component.runCoroutine((function* (): CoroutineIterator {
            yield nextFrame();
            events.push('parent-resume');
            component.runCoroutine((function* (): CoroutineIterator {
                events.push('child-start');
                yield nextFrame();
                events.push('child-resume');
            })());
            events.push('parent-after-start');
        })());

        director.tick(0.1);
        expect(events).toEqual(['parent-resume', 'child-start', 'parent-after-start']);

        events.length = 0;
        director.tick(0.1);
        expect(events).toEqual(['child-resume']);
    });

    it('stops a coroutine from another coroutine', () => {
        /// @case
        /// 1. A component starts a child coroutine and a stopper coroutine.
        /// 2. The stopper coroutine stops the child during a coroutine update.
        /// @expect
        /// The child cleanup runs immediately and the stopped child never resumes later.
        const { component } = createProbe();
        const events: string[] = [];
        let childHandle: Coroutine | undefined;

        childHandle = component.runCoroutine((function* (): CoroutineIterator {
            try {
                events.push('child-start');
                yield waitUntil((): boolean => false);
                events.push('child-unreachable');
            } finally {
                events.push('child-cleanup');
            }
        })());
        component.runCoroutine((function* (): CoroutineIterator {
            events.push('stopper-start');
            yield nextFrame();
            if (!childHandle) {
                throw new Error('Expected child coroutine handle.');
            }
            component.stopCoroutineHandle(childHandle);
            events.push('stopper-after-stop');
        })());

        expect(events).toEqual(['child-start', 'stopper-start']);

        director.tick(0.1);
        expect(events).toEqual(['child-start', 'stopper-start', 'child-cleanup', 'stopper-after-stop']);

        director.tick(0.1);
        expect(events).toEqual(['child-start', 'stopper-start', 'child-cleanup', 'stopper-after-stop']);
    });

    it('skips a later coroutine stopped during coroutine update', () => {
        /// @case
        /// 1. A component starts a stopper coroutine before a target coroutine.
        /// 2. The stopper stops the target during the coroutine phase before the target's turn.
        /// @expect
        /// The target cleanup runs immediately and the target body is skipped in the same frame.
        const { component } = createProbe();
        const events: string[] = [];
        let targetHandle: Coroutine | undefined;

        component.runCoroutine((function* (): CoroutineIterator {
            events.push('stopper-start');
            yield nextFrame();
            events.push('stopper-before-stop');
            if (!targetHandle) {
                throw new Error('Expected target coroutine handle.');
            }
            component.stopCoroutineHandle(targetHandle);
            events.push('stopper-after-stop');
        })());
        targetHandle = component.runCoroutine((function* (): CoroutineIterator {
            try {
                events.push('target-start');
                yield nextFrame();
                events.push('target-resume');
            } finally {
                events.push('target-cleanup');
            }
        })());

        expect(events).toEqual(['stopper-start', 'target-start']);

        director.tick(0.1);
        expect(events).toEqual([
            'stopper-start',
            'target-start',
            'stopper-before-stop',
            'target-cleanup',
            'stopper-after-stop',
        ]);

        director.tick(0.1);
        expect(events).toEqual([
            'stopper-start',
            'target-start',
            'stopper-before-stop',
            'target-cleanup',
            'stopper-after-stop',
        ]);
    });

    it('skips later coroutines after stop all during coroutine update', () => {
        /// @case
        /// 1. A component starts a stopper coroutine before a target coroutine.
        /// 2. The stopper calls stopAllCoroutines during the coroutine phase.
        /// @expect
        /// Later coroutines are cleaned up and skipped, including the stopper's own later continuation.
        const { component } = createProbe();
        const events: string[] = [];

        component.runCoroutine((function* (): CoroutineIterator {
            events.push('stopper-start');
            yield nextFrame();
            events.push('stopper-before-stop-all');
            component.stopAllCoroutineHandles();
            events.push('stopper-after-stop-all');
            yield nextFrame();
            events.push('stopper-unreachable');
        })());
        component.runCoroutine((function* (): CoroutineIterator {
            try {
                events.push('target-start');
                yield nextFrame();
                events.push('target-resume');
            } finally {
                events.push('target-cleanup');
            }
        })());

        expect(events).toEqual(['stopper-start', 'target-start']);

        director.tick(0.1);
        expect(events).toEqual([
            'stopper-start',
            'target-start',
            'stopper-before-stop-all',
            'target-cleanup',
            'stopper-after-stop-all',
        ]);

        director.tick(0.1);
        expect(events).toEqual([
            'stopper-start',
            'target-start',
            'stopper-before-stop-all',
            'target-cleanup',
            'stopper-after-stop-all',
        ]);
    });

    it('stops all coroutines from a coroutine', () => {
        /// @case
        /// 1. A component has multiple waiting coroutines and one stopper coroutine.
        /// 2. The stopper calls stopAllCoroutines during a coroutine update.
        /// @expect
        /// Every waiting coroutine is cleaned up, and no stopped coroutine resumes later.
        const { component } = createProbe();
        const events: string[] = [];

        component.runCoroutine((function* (): CoroutineIterator {
            try {
                events.push('first-start');
                yield waitUntil((): boolean => false);
                events.push('first-unreachable');
            } finally {
                events.push('first-cleanup');
            }
        })());
        component.runCoroutine((function* (): CoroutineIterator {
            try {
                events.push('second-start');
                yield waitUntil((): boolean => false);
                events.push('second-unreachable');
            } finally {
                events.push('second-cleanup');
            }
        })());
        component.runCoroutine((function* (): CoroutineIterator {
            events.push('stopper-start');
            yield nextFrame();
            events.push('stopper-before-stop-all');
            component.stopAllCoroutineHandles();
            events.push('stopper-after-stop-all');
            yield nextFrame();
            events.push('stopper-unreachable');
        })());

        expect(events).toEqual(['first-start', 'second-start', 'stopper-start']);

        director.tick(0.1);
        expect(events).toEqual([
            'first-start',
            'second-start',
            'stopper-start',
            'stopper-before-stop-all',
            'first-cleanup',
            'second-cleanup',
            'stopper-after-stop-all',
        ]);

        director.tick(0.1);
        expect(events).toEqual([
            'first-start',
            'second-start',
            'stopper-start',
            'stopper-before-stop-all',
            'first-cleanup',
            'second-cleanup',
            'stopper-after-stop-all',
        ]);
    });
    it('keeps component coroutines running when the component is disabled', () => {
        /// @case
        /// 1. A component starts a coroutine and then the component is disabled.
        /// 2. The owner node remains active in the hierarchy.
        /// @expect
        /// Disabling the component stops update callbacks but does not stop or pause its coroutine.
        const { component } = createProbe();
        const events: string[] = [];

        component.runCoroutine((function* (): CoroutineIterator {
            events.push('start');
            yield nextFrame();
            events.push('first');
            yield nextFrame();
            events.push('after-disabled');
        })());

        director.tick(0.1);
        component.enabled = false;
        director.tick(0.1);

        expect(events).toEqual(['start', 'first', 'after-disabled']);
    });

    it('stops component coroutines when the node becomes inactive', () => {
        /// @case
        /// 1. A disabled component owns a pending coroutine.
        /// 2. The owner node becomes inactive.
        /// @expect
        /// Node inactivity immediately stops the coroutine and runs cleanup even though the component was already disabled.
        const { component, node } = createProbe();
        const events: string[] = [];

        component.runCoroutine((function* (): CoroutineIterator {
            try {
                events.push('start');
                yield waitUntil((): boolean => false);
            } finally {
                events.push('cleanup');
            }
        })());

        component.enabled = false;
        node.active = false;

        expect(events).toEqual(['start', 'cleanup']);
    });

    it('stops component coroutines when the component is destroyed', () => {
        /// @case
        /// 1. A component owns a pending coroutine.
        /// 2. The component is destroyed.
        /// @expect
        /// Destroying the component immediately stops the coroutine and runs cleanup.
        const { component } = createProbe();
        const events: string[] = [];

        component.runCoroutine((function* (): CoroutineIterator {
            try {
                events.push('start');
                yield waitUntil((): boolean => false);
            } finally {
                events.push('cleanup');
            }
        })());

        component.destroy();

        expect(events).toEqual(['start', 'cleanup']);
    });

    it('stops every coroutine when a cleanup stops another coroutine during stop all', () => {
        /// @case
        /// 1. A component starts several waiting coroutines.
        /// 2. stopAllCoroutines runs cleanup, and one cleanup stops another coroutine handle.
        /// @expect
        /// Stop-all remains stable, no error is thrown, and every original coroutine is cleaned up once.
        const { component } = createProbe();
        const events: string[] = [];
        let secondHandle: Coroutine | undefined;

        component.runCoroutine((function* (): CoroutineIterator {
            try {
                events.push('first-start');
                yield waitUntil((): boolean => false);
            } finally {
                events.push('first-cleanup');
                if (secondHandle) {
                    component.stopCoroutineHandle(secondHandle);
                }
                events.push('first-after-stop-second');
            }
        })());
        secondHandle = component.runCoroutine((function* (): CoroutineIterator {
            try {
                events.push('second-start');
                yield waitUntil((): boolean => false);
            } finally {
                events.push('second-cleanup');
            }
        })());
        component.runCoroutine((function* (): CoroutineIterator {
            try {
                events.push('third-start');
                yield waitUntil((): boolean => false);
            } finally {
                events.push('third-cleanup');
            }
        })());

        expect(events).toEqual(['first-start', 'second-start', 'third-start']);

        expect(() => {
            component.stopAllCoroutineHandles();
        }).not.toThrow();
        expect(events).toEqual([
            'first-start',
            'second-start',
            'third-start',
            'first-cleanup',
            'second-cleanup',
            'first-after-stop-second',
            'third-cleanup',
        ]);
    });
    it('stops an explicit coroutine handle without resuming it later', () => {
        /// @case
        /// 1. A component starts a pending coroutine and stores its handle.
        /// 2. The component stops that handle before the next tick.
        /// @expect
        /// The coroutine cleanup runs immediately and no later frame resumes the stopped coroutine.
        const { component } = createProbe();
        const events: string[] = [];

        const handle = component.runCoroutine((function* (): CoroutineIterator {
            try {
                events.push('start');
                yield nextFrame();
                events.push('unreachable');
            } finally {
                events.push('cleanup');
            }
        })());

        component.stopCoroutineHandle(handle);
        director.tick(0.1);

        expect(events).toEqual(['start', 'cleanup']);
    });

    it('keeps replacement coroutines started during stop-all cleanup scheduled for the next frame', () => {
        /// @case
        /// 1. A component stops all coroutines while a coroutine cleanup starts a replacement coroutine.
        /// 2. The replacement coroutine yields until the next frame.
        /// @expect
        /// The original coroutine is stopped, the replacement starts immediately, and the replacement resumes on the next tick.
        const { component } = createProbe();
        const events: string[] = [];

        component.runCoroutine((function* (): CoroutineIterator {
            try {
                events.push('original-start');
                yield waitUntil((): boolean => false);
            } finally {
                events.push('original-cleanup');
                component.runCoroutine((function* (): CoroutineIterator {
                    events.push('replacement-start');
                    yield nextFrame();
                    events.push('replacement-resume');
                })());
            }
        })());

        component.stopAllCoroutineHandles();
        expect(events).toEqual(['original-start', 'original-cleanup', 'replacement-start']);

        director.tick(0.1);
        expect(events).toEqual(['original-start', 'original-cleanup', 'replacement-start', 'replacement-resume']);
    });
});

function createProbe (name = 'component-coroutine-probe'): { component: CoroutineProbe; node: Node } {
    if (!scene) {
        scene = new Scene('component-coroutine-test');
        director.runSceneImmediate(scene);
    }

    const node = new Node(name);
    const component = node.addComponent(CoroutineProbe)!;
    scene.addChild(node);

    return {
        component,
        node,
    };
}
