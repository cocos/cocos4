/**
 * Engine-side contract of the `pal/worker` module.
 *
 * Self-contained on purpose: type checking, IDE services and declaration builds must not depend on
 * whether the installed PAL package ships a worker module. When `pal/worker` is absent (an older
 * PAL, or the single-thread compatibility module which is JS only), TypeScript resolves the import to
 * this ambient declaration. `tests/scripts/pal-worker-types.test.cjs` checks that a real PAL
 * `worker/type.d.ts` stays structurally identical to these interfaces.
 */
declare module 'pal/worker' {
    export interface IWorker {
        postMessage (message: any, transfer?: Transferable[]): void;
        onMessage (listener: (res: any) => void): void;
        onError (listener: (err: any) => void): void;
        terminate (): void;
    }

    export interface IWorkerDiagnosis {
        ready: boolean;
        version: 0 | 1 | 2;
        reason: string;
    }

    export interface IWorkerBackend {
        readonly concurrencyLimit: number;
        readonly supportsTransfer: boolean;
        readonly supportsSharedArrayBuffer: boolean;
        readonly supportsFunctionWorker: boolean;
        readonly capabilityReason: string;
        createScriptWorker (path: string): IWorker;
        diagnose (path: string): IWorkerDiagnosis;
    }

    export interface IPlatformWorkerBackend extends IWorkerBackend {
        readonly supportsStandardWorker: boolean;
        readonly scriptFailureHint: string;
        resolveScriptWorker (path: string): IWorkerResolution;
        readonly hardwareConcurrency: number;
        readonly scriptFallback: IPlatformWorkerBackend | null;
        createFunctionWorker (fn: (...args: any[]) => any): IWorker | null;
    }

    export interface IWorkerResolution {
        backend: IPlatformWorkerBackend | null;
        diagnosis: IWorkerDiagnosis;
        warnOnFailure: boolean;
    }

    export interface IWorkerCapabilities {
        supportsStandardWorker: boolean;
        available: boolean;
        parallel: boolean;
        concurrencyLimit: number;
        supportsTransfer: boolean;
        supportsSharedArrayBuffer: boolean;
        supportsFunctionWorker: boolean;
        reason: string;
    }

    export function createWorkerBackend (): IPlatformWorkerBackend;
}
