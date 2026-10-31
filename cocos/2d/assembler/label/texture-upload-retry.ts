/*
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Licensed under the MIT License.
*/

import type { Label } from '../../components/label';

const pendingRetries = new WeakMap<Label, boolean>();

/** Retry after the renderer manager has finished consuming this frame's dirty queue. */
export function retryLabelTextureUpload (label: Label, reinitialize = false): void {
    if (pendingRetries.has(label)) {
        if (reinitialize) {
            pendingRetries.set(label, true);
        }
        return;
    }
    pendingRetries.set(label, reinitialize);
    label.scheduleOnce(() => {
        const needsInitialization = pendingRetries.get(label);
        pendingRetries.delete(label);
        if (label.isValid && !label.textRenderData.textureReady) {
            if (needsInitialization) {
                label.updateRenderData(true);
            } else {
                label._markForUpdateRenderData();
            }
        }
    }, 0.1);
}
