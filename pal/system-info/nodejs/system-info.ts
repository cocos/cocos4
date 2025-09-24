/*
 Copyright (c) 2022-2023 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

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

import { DEBUG } from 'internal:constants';
import { EventTarget } from '../../../cocos/core/event';
import { checkPalIntegrity, withImpl } from '../../integrity-check';
import { BrowserType, NetworkType, OS, Platform, Language, Feature } from '../enum-type';
import { warn } from '../../../cocos/core/platform/debug';

class SystemInfo extends EventTarget {
    public declare readonly networkType: NetworkType;
    public declare readonly isNative: boolean;
    public declare readonly isBrowser: boolean;
    public declare readonly isMobile: boolean;
    public declare readonly isLittleEndian: boolean;
    public declare readonly platform: Platform;
    public declare readonly language: Language;
    public declare readonly nativeLanguage: string;
    public declare readonly os: OS;
    public declare readonly osVersion: string;
    public declare readonly osMainVersion: number;
    public declare readonly browserType: BrowserType;
    public declare readonly browserVersion: string;
    public declare readonly isXR: boolean;

    constructor () {
        super();

        this.networkType = NetworkType.LAN;  // TODO
        this.isNative = false;
        this.isBrowser = true;

        this.isMobile = false;
        this.platform = Platform.EDITOR_PAGE;  // TODO


        // init isLittleEndian
        this.isLittleEndian = ((): boolean => {
            const buffer = new ArrayBuffer(2);
            new DataView(buffer).setInt16(0, 256, true);
            // Int16Array uses the platform's endianness.
            return new Int16Array(buffer)[0] === 256;
        })();

        this.language = Language.CHINESE;

        this.os = OS.UNKNOWN;
        this.osVersion = "";
        this.osMainVersion = 10;

        // TODO: use dack-type to determine the browserType
        // init browserType and browserVersion
        this.browserType = BrowserType.UNKNOWN;
        // init browserVersion
        this.browserVersion = '';

        this.isXR = false;
    }

    public init (): Promise<void[]> {
        warn("init is not supported.");
        return Promise.resolve([]);
    }

    public hasFeature (feature: Feature): boolean {
        // warn("hasFeature is not supported.");
        return false;
    }

    public getBatteryLevel (): number {
        warn("getBatteryLevel is not supported.");
        return 1;
    }
    public triggerGC (): void {
        if (DEBUG) {
            warn('triggerGC is not supported.');
        }
    }
    public openURL (url: string): void {
        warn("openURL is not supported.");
    }
    public now (): number {
        if (Date.now) {
            return Date.now();
        }

        return +(new Date());
    }
    public restartJSVM (): void {
        warn("restartJSVM is not supported.");
    }

    public exit (): void {
        warn("exit is not supported.");
    }

    public close (): void {
        this.emit('close');
    }
}

export const systemInfo = new SystemInfo();

checkPalIntegrity<typeof import('pal/system-info')>(withImpl<typeof import('./system-info')>());
