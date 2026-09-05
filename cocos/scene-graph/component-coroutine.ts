/*
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

/**
 * Frame data passed to a coroutine when it resumes.
 */
export interface CoroutineFrame {
    /**
     * Time elapsed since the previous coroutine update, in seconds.
     */
    readonly deltaTime: number;

    /**
     * Time elapsed since this coroutine started running, in seconds.
     */
    readonly elapsedTime: number;

    /**
     * Number of coroutine update frames since the owner component started running coroutines.
     */
    readonly frame: number;
}

declare const CoroutineBrand: unique symbol;

/**
 * Handle returned by `Component.startCoroutine`.
 */
export interface Coroutine {
    readonly [CoroutineBrand]: never;
}

declare const CoroutineInstructionBrand: unique symbol;

/**
 * Yield instruction returned by coroutine wait helpers.
 */
export interface CoroutineInstruction {
    readonly [CoroutineInstructionBrand]: never;
}

/**
 * Iterator shape accepted by `Component.startCoroutine`.
 */
export type CoroutineIterator = Generator<CoroutineYield, void, CoroutineFrame>;

/**
 * Predicate evaluated with the current coroutine frame.
 */
export type CoroutinePredicate = (frame: CoroutineFrame) => boolean;

interface CoroutineAbortSignal {
    readonly aborted: boolean;
    addEventListener?: (type: 'abort', listener: () => void) => void;
    removeEventListener?: (type: 'abort', listener: () => void) => void;
}

/**
 * Options used when starting a component coroutine.
 */
export interface StartCoroutineOptions {
    /**
     * Abort signal that stops the coroutine when aborted.
     */
    readonly signal?: CoroutineAbortSignal;
}

type CoroutineYield = CoroutineInstruction | null | undefined;

type InternalCoroutineInstruction =
    | NextFrameInstruction
    | WaitForInstruction
    | WaitUntilInstruction
    | WaitWhileInstruction;

enum CoroutineInstructionType {
    NEXT_FRAME = 0,
    WAIT_FOR = 1,
    WAIT_UNTIL = 2,
    WAIT_WHILE = 3,
}

interface NextFrameInstruction extends CoroutineInstruction {
    readonly type: CoroutineInstructionType.NEXT_FRAME;
}

interface WaitForInstruction extends CoroutineInstruction {
    readonly type: CoroutineInstructionType.WAIT_FOR;
    readonly seconds: number;
}

interface WaitUntilInstruction extends CoroutineInstruction {
    readonly type: CoroutineInstructionType.WAIT_UNTIL;
    readonly predicate: CoroutinePredicate;
}

interface WaitWhileInstruction extends CoroutineInstruction {
    readonly type: CoroutineInstructionType.WAIT_WHILE;
    readonly predicate: CoroutinePredicate;
}

const NEXT_FRAME_INSTRUCTION = {
    type: CoroutineInstructionType.NEXT_FRAME,
} as NextFrameInstruction;

/**
 * Resume the coroutine on the next coroutine update.
 */
export function nextFrame (): CoroutineInstruction {
    return NEXT_FRAME_INSTRUCTION;
}

/**
 * Resume the coroutine after at least the given duration.
 */
export function waitFor (seconds: number): CoroutineInstruction {
    if (!Number.isFinite(seconds) || seconds < 0) {
        throw new Error('seconds must be a non-negative finite number.');
    }

    return {
        type: CoroutineInstructionType.WAIT_FOR,
        seconds,
    } as WaitForInstruction;
}

/**
 * Resume the coroutine when the predicate becomes true.
 */
export function waitUntil (predicate: CoroutinePredicate): CoroutineInstruction {
    return {
        type: CoroutineInstructionType.WAIT_UNTIL,
        predicate,
    } as WaitUntilInstruction;
}

/**
 * Resume the coroutine when the predicate becomes false.
 */
export function waitWhile (predicate: CoroutinePredicate): CoroutineInstruction {
    return {
        type: CoroutineInstructionType.WAIT_WHILE,
        predicate,
    } as WaitWhileInstruction;
}

export class CoroutineRunner {
    public start (coroutine: CoroutineIterator, firstResumeFrame: number, opts?: StartCoroutineOptions): Coroutine {
        const record = new CoroutineRecord(this, coroutine, opts);
        this._records.push(record);
        try {
            record.start(firstResumeFrame);
        } finally {
            this._pruneIfNotDeferred();
        }
        return record;
    }

    public update (deltaTime: number, directorFrame: number): void {
        this._frame++;
        this._deltaTime = deltaTime;
        this._directorFrame = directorFrame;

        this._beginPruneDeferral();
        try {
            const count = this._records.length;
            for (let i = 0; i < count; i++) {
                this._records[i].update();
            }
        } finally {
            this._endPruneDeferral();
        }
    }

    public stop (handle: Coroutine): void {
        stopCoroutine(handle);
        this._pruneIfNotDeferred();
    }

    public stopAll (): void {
        this._beginPruneDeferral();
        try {
            const count = this._records.length;
            for (let i = 0; i < count; i++) {
                this._records[i].stop();
            }
        } finally {
            this._endPruneDeferral();
        }
    }

    public get frame (): number {
        return this._frame;
    }

    public get deltaTime (): number {
        return this._deltaTime;
    }

    public get directorFrame (): number {
        return this._directorFrame;
    }

    public get empty (): boolean {
        return this._records.length === 0;
    }

    private _records: CoroutineRecord[] = [];
    private _frame = 0;
    private _deltaTime = 0;
    private _directorFrame = 0;
    private _pruneDeferralDepth = 0;

    private _beginPruneDeferral (): void {
        this._pruneDeferralDepth++;
    }

    private _endPruneDeferral (): void {
        this._pruneDeferralDepth--;
        if (this._pruneDeferralDepth === 0) {
            this._prune();
        }
    }

    private _pruneIfNotDeferred (): void {
        if (this._pruneDeferralDepth === 0) {
            this._prune();
        }
    }

    private _prune (): void {
        this._records = this._records.filter((record): boolean => !record.done);
    }
}

export function stopCoroutine (coroutine: Coroutine): void {
    if (coroutine instanceof CoroutineRecord) {
        coroutine.stop();
        return;
    }

    throw new Error('Invalid coroutine handle.');
}

class CoroutineRecord implements Coroutine {
    public declare readonly [CoroutineBrand]: never;

    constructor (runner: CoroutineRunner, coroutine: CoroutineIterator, opts?: StartCoroutineOptions) {
        this._runner = runner;
        this._coroutine = coroutine;
        this._signal = opts?.signal;
    }

    public get running (): boolean {
        return !this._done && !this._stopping;
    }

    public get done (): boolean {
        return this._done;
    }

    public start (firstResumeFrame: number): void {
        if (this._signal?.aborted) {
            this.stop();
            return;
        }

        this._addAbortListener();
        this._advance(undefined, firstResumeFrame);
    }

    public update (): void {
        if (!this.running || this._runner.directorFrame < this._resumeAfterDirectorFrame || this._yieldedAtFrame >= this._runner.frame) {
            return;
        }

        this._elapsedTime += this._runner.deltaTime;
        const frame: CoroutineFrame = {
            deltaTime: this._runner.deltaTime,
            elapsedTime: this._elapsedTime,
            frame: this._runner.frame,
        };
        if (this._canResume(frame)) {
            this._advance(frame, this._runner.directorFrame);
        }
    }

    public stop (): void {
        if (this._done) {
            return;
        }

        this._done = true;
        this._removeAbortListener();
        if (this._executing) {
            return;
        }

        this._stopping = true;
        try {
            this._coroutine.return?.(undefined);
        } finally {
            this._stopping = false;
        }
    }

    private readonly _runner: CoroutineRunner;
    private readonly _coroutine: CoroutineIterator;
    private readonly _signal: CoroutineAbortSignal | undefined;

    private _instruction: InternalCoroutineInstruction = NEXT_FRAME_INSTRUCTION;
    private _yieldedAtFrame = 0;
    private _resumeAfterDirectorFrame = 0;
    private _remainingSeconds = 0;
    private _elapsedTime = 0;
    private _done = false;
    private _executing = false;
    private _stopping = false;
    private _onAbort: (() => void) | undefined = undefined;

    private _advance (frame: CoroutineFrame | undefined, resumeAfterDirectorFrame: number): void {
        let result: IteratorResult<CoroutineYield, void>;
        this._executing = true;
        try {
            result = frame === undefined ? this._coroutine.next() : this._coroutine.next(frame);
        } catch (error) {
            this._done = true;
            this._removeAbortListener();
            throw error;
        } finally {
            this._executing = false;
        }

        if (this._done) {
            return;
        }

        if (result.done === true) {
            this._done = true;
            this._removeAbortListener();
            return;
        }

        try {
            this._setInstruction(result.value, resumeAfterDirectorFrame);
        } catch (error) {
            this._done = true;
            this._removeAbortListener();
            throw error;
        }
    }

    private _setInstruction (instruction: CoroutineYield, resumeAfterDirectorFrame: number): void {
        if (instruction === null || instruction === undefined) {
            this._instruction = NEXT_FRAME_INSTRUCTION;
        } else {
            switch ((instruction as { readonly type?: unknown }).type) {
            case CoroutineInstructionType.NEXT_FRAME:
                this._instruction = instruction as NextFrameInstruction;
                break;
            case CoroutineInstructionType.WAIT_FOR:
                this._instruction = instruction as WaitForInstruction;
                break;
            case CoroutineInstructionType.WAIT_UNTIL:
            case CoroutineInstructionType.WAIT_WHILE:
                this._instruction = instruction as WaitUntilInstruction | WaitWhileInstruction;
                break;
            default:
                throw new Error('Invalid coroutine instruction.');
            }
        }

        this._yieldedAtFrame = this._runner.frame;
        this._resumeAfterDirectorFrame = resumeAfterDirectorFrame;

        if (this._instruction.type === CoroutineInstructionType.WAIT_FOR) {
            this._remainingSeconds = this._instruction.seconds;
        }
    }

    private _canResume (frame: CoroutineFrame): boolean {
        switch (this._instruction.type) {
        case CoroutineInstructionType.NEXT_FRAME:
            return true;
        case CoroutineInstructionType.WAIT_FOR:
            this._remainingSeconds -= frame.deltaTime;
            return this._remainingSeconds <= 0;
        case CoroutineInstructionType.WAIT_UNTIL:
            return this._instruction.predicate(frame);
        case CoroutineInstructionType.WAIT_WHILE:
            return !this._instruction.predicate(frame);
        default:
            return false;
        }
    }

    private _addAbortListener (): void {
        if (!this._signal || this._onAbort || !this._signal.addEventListener) {
            return;
        }

        this._onAbort = (): void => {
            this.stop();
        };
        this._signal.addEventListener('abort', this._onAbort);
    }

    private _removeAbortListener (): void {
        if (!this._signal || !this._onAbort || !this._signal.removeEventListener) {
            return;
        }

        this._signal.removeEventListener('abort', this._onAbort);
        this._onAbort = undefined;
    }
}
