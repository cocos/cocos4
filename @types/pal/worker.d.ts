declare module 'pal/worker' {
    export type { IWorker, IWorkerBackend, IPlatformWorkerBackend, IWorkerDiagnosis, IWorkerCapabilities } from 'pal/worker/type';
    export function createWorkerBackend (): import('pal/worker/type').IPlatformWorkerBackend;
}
