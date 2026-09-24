// Compatibility contract for PAL versions predating worker support.
// Keep structurally compatible with cocos-pal/src/worker/type.ts.
export interface IWorker {
    postMessage(message: any, transfer?: Transferable[]): void;
    onMessage(listener: (res: any) => void): void;
    onError(listener: (err: any) => void): void;
    terminate(): void;
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
    createScriptWorker(path: string): IWorker;
    diagnose(path: string): IWorkerDiagnosis;
}

export interface IPlatformWorkerBackend extends IWorkerBackend {
    readonly supportsStandardWorker: boolean;
    readonly scriptFailureHint: string;
    resolveScriptWorker(path: string): IWorkerResolution;
    readonly hardwareConcurrency: number;
    readonly scriptFallback: IPlatformWorkerBackend | null;
    createFunctionWorker(fn: (...args: any[]) => any): IWorker | null;
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
