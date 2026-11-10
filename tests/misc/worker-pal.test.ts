import { createWorkerBackend as createWebBackend } from '../../pal/worker/web/index';
import { createWorkerBackend as createNativeBackend } from '../../pal/worker/native/index';
import { createWorkerBackend as createNodeBackend } from '../../pal/worker/nodejs/index';
import { createWorkerBackend as createMinigameBackend } from '../../pal/worker/minigame/index';
import { minigame } from 'pal/minigame';

describe('distributed PAL worker platform entries', () => {
    const saved = new Map<string, PropertyDescriptor | undefined>();
    let savedMinigame: PropertyDescriptorMap;

    beforeEach(() => {
        for (const key of ['Worker', 'Blob', 'URL']) {
            saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        }
        savedMinigame = Object.getOwnPropertyDescriptors(minigame);
        for (const key of Object.keys(minigame)) delete minigame[key];
    });

    afterEach(() => {
        for (const [key, descriptor] of saved) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete (globalThis as any)[key];
        }
        for (const key of Object.keys(minigame)) delete minigame[key];
        Object.defineProperties(minigame, savedMinigame);
    });

    test.each([createNativeBackend, createNodeBackend])('unsupported targets ignore browser globals', (createBackend) => {
        (globalThis as any).Worker = jest.fn();
        const backend = createBackend();
        expect(backend.concurrencyLimit).toBe(0);
        expect(backend.scriptFallback).toBeNull();
        expect(backend.createFunctionWorker(() => 1)).toBeNull();
        expect(() => backend.createScriptWorker('task.js')).toThrow();
        expect(Worker).not.toHaveBeenCalled();
    });

    test('Web function capability checks Blob and URL, with no stale support cache', () => {
        (globalThis as any).Worker = jest.fn();
        (globalThis as any).Blob = undefined;
        const backend = createWebBackend();
        expect(backend.supportsFunctionWorker).toBe(false);
        (globalThis as any).Blob = class {};
        (globalThis as any).URL = { createObjectURL: jest.fn() };
        expect(backend.supportsFunctionWorker).toBe(true);
    });

    test('a failed Web constructor still releases its Blob URL', () => {
        (globalThis as any).Worker = jest.fn(() => { throw new Error('blocked'); });
        (globalThis as any).Blob = class {};
        (globalThis as any).URL = {
            createObjectURL: jest.fn(() => 'blob:test'),
            revokeObjectURL: jest.fn(),
        };
        expect(() => createWebBackend().createFunctionWorker(() => 1)).toThrow('blocked');
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    });

    test('minigame remains a minigame with no createWorker; PAL supplies devtools fallback', () => {
        (globalThis as any).Worker = jest.fn(() => ({ terminate: jest.fn() }));
        const backend = createMinigameBackend();
        expect(backend.concurrencyLimit).toBe(0);
        expect(backend.supportsFunctionWorker).toBe(false);
        expect(backend.scriptFallback!.diagnose('task.js').ready).toBe(true);
        const resolved = backend.resolveScriptWorker('task.js');
        expect(resolved.backend).not.toBe(backend);
        expect(resolved.backend!.concurrencyLimit).toBe(Infinity);
        expect(resolved.warnOnFailure).toBe(false);
        backend.createScriptWorker('task.js');
        expect(Worker).toHaveBeenCalledWith('task.js');
    });

    test('PAL resolves unavailable targets and suppresses expected fallback warnings', () => {
        const resolution = createNativeBackend().resolveScriptWorker('task.js');
        expect(resolution.backend).toBeNull();
        expect(resolution.diagnosis.ready).toBe(false);
        expect(resolution.warnOnFailure).toBe(false);
        expect(createNativeBackend().supportsStandardWorker).toBe(false);
    });
    test('minigame API calls retain their host receiver', () => {
        minigame.createWorker = jest.fn(function (this: any) {
            expect(this).toBe(minigame);
            return { terminate: jest.fn(), onMessage: jest.fn(), postMessage: jest.fn() };
        });
        createMinigameBackend().createScriptWorker('workers/task.js').terminate();
        expect(minigame.createWorker).toHaveBeenCalled();
    });

    test('rechecking a single-worker host without a filesystem does not consume its occupied slot', () => {
        let active = 0;
        minigame.createWorker = jest.fn(() => {
            if (active) throw new Error('only one worker allowed');
            active++;
            return { terminate: () => { active--; }, onMessage: jest.fn(), postMessage: jest.fn() };
        });
        const first = createMinigameBackend();
        expect(first.resolveScriptWorker('workers/task.js').backend).toBe(first);
        const worker = first.createScriptWorker('workers/task.js');
        expect(active).toBe(1);
        const refreshed = createMinigameBackend();
        expect(refreshed.resolveScriptWorker('workers/task.js').backend).toBe(refreshed);
        expect(minigame.createWorker).toHaveBeenCalledTimes(2); // one probe + one real worker
        worker.terminate();
        expect(active).toBe(0);
    });

});
