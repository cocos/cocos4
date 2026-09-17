/*
 Copyright (c) 2020 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
 worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
 not use Cocos Creator software for developing other software or tools that's
 used for developing games. You are not granted to publish, distribute,
 sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 */

/**
 * Entry of the optional `worker` feature.
 *
 * The worker subsystem lives in `cocos/misc/worker*.ts` but is intentionally NOT re-exported from
 * `cocos/misc/index.ts`: that file belongs to the always-on `base` feature, so anything exported
 * there ships in every build's main bundle. Routing the subsystem through this dedicated entry keeps
 * ~17 KB (minified) / ~5 KB (gzipped) out of projects that never use it.
 *
 * Only the public surface is re-exported here. Internal plumbing (`WorkerAdapter`, `getWorkerBackend`,
 * `getWebWorkerCtor`, `resetWorkerBackendCache`) stays off the `cc` namespace and remains reachable
 * via a direct module import when a test or an advanced integration needs it.
 */

export {
    createWorker,
    isWorkerSupported,
    isSupportStandardWorker,
    checkWorkerScript,
    getWorkerConcurrencyLimit,
    getOptimalWorkerCount,
} from '../cocos/misc/worker';
export type { WorkerTask, IWorkerScriptStatus } from '../cocos/misc/worker';

export { WorkerPool } from '../cocos/misc/worker-pool';
export type { WorkerPoolOptions } from '../cocos/misc/worker-pool';

export { getWorkerCapabilities } from '../cocos/misc/worker-backend';
export type {
    IWorker,
    IWorkerBackend,
    IWorkerDiagnosis,
    IWorkerCapabilities,
    WorkerBackendKind,
} from '../cocos/misc/worker-backend';
