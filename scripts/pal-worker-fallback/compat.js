// Compatibility only: real platform implementations remain in cocos-pal.
const reason = 'Installed PAL package has no worker module; using single-thread execution. '
    + 'Upgrade @cocos/engine-pal to enable platform workers.';

export function createWorkerBackend() {
    return {
        supportsStandardWorker: false,
        scriptFailureHint: '',
        resolveScriptWorker() {
            return { backend: null, diagnosis: { ready: false, version: 0, reason }, warnOnFailure: false };
        },
        concurrencyLimit: 0,
        hardwareConcurrency: 1,
        supportsTransfer: false,
        supportsSharedArrayBuffer: false,
        supportsFunctionWorker: false,
        capabilityReason: reason,
        scriptFallback: null,
        createFunctionWorker() { return null; },
        createScriptWorker(path) {
            throw new Error(`Cannot create worker "${path}": ${reason}`);
        },
        diagnose() { return { ready: false, version: 0, reason }; },
    };
}
