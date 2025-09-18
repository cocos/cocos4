globalThis.__EDITOR__ = globalThis.process && ('electron' in globalThis.process.versions);

require('./wasm');
const nodeWindow = globalThis.window;

const { btoa, atob } = require('./base64/base64.min');

nodeWindow.btoa = btoa;
nodeWindow.atob = atob;
const { Blob, URL } = require('./Blob');

nodeWindow.Blob = Blob;
nodeWindow.URL = URL;
nodeWindow.DOMParser = require('./xmldom/dom-parser').DOMParser;

// nodeWindow.XMLHttpRequest = jsb.XMLHttpRequest;
// nodeWindow.SocketIO = jsb.SocketIO;
// nodeWindow.WebSocket = jsb.WebSocket;

//require('./jsb_prepare');
require('./jsb-adapter');
//require('./jsb_audioengine');
//require('./jsb_input');

let _oldRequestFrameCallback = null;
let _requestAnimationFrameID = 0;
const _requestAnimationFrameCallbacks = {};
let _firstTick = true;

nodeWindow.requestAnimationFrame = function (cb) {
    const id = ++_requestAnimationFrameID;
    _requestAnimationFrameCallbacks[id] = cb;
    return id;
};

nodeWindow.cancelAnimationFrame = function (id) {
    delete _requestAnimationFrameCallbacks[id];
};

function tick (nowMilliSeconds) {
    if (_firstTick) {
        _firstTick = false;
        if (nodeWindow.onload) {
            const event = new Event('load');
            event._target = globalThis;
            nodeWindow.onload(event);
        }
    }
    fireTimeout(nowMilliSeconds);

    for (const id in _requestAnimationFrameCallbacks) {
        _oldRequestFrameCallback = _requestAnimationFrameCallbacks[id];
        if (_oldRequestFrameCallback) {
            delete _requestAnimationFrameCallbacks[id];
            _oldRequestFrameCallback(nowMilliSeconds);
        }
    }
}

let _timeoutIDIndex = 0;

class TimeoutInfo {
    constructor (cb, delay, isRepeat, target, args) {
        this.cb = cb;
        this.id = ++_timeoutIDIndex;
        this.start = performance.now();
        this.delay = delay;
        this.isRepeat = isRepeat;
        this.target = target;
        this.args = args;
    }
}

const _timeoutInfos = {};

function fireTimeout (nowMilliSeconds) {
    let info;
    for (const id in _timeoutInfos) {
        info = _timeoutInfos[id];
        if (info && info.cb) {
            if ((nowMilliSeconds - info.start) >= info.delay) {
                // console.log(`fireTimeout: id ${id}, start: ${info.start}, delay: ${info.delay}, now: ${nowMilliSeconds}`);
                if (info.isRepeat) {
                    info.start = nowMilliSeconds;
                } else {
                    // The delete operation should be performed before the timeout callback.
                    // This is because if an error occurs during the timeout callback,
                    // it could be triggered indefinitely, leading to a game freeze.
                    delete _timeoutInfos[id];
                }

                if (typeof info.cb === 'string') {
                    Function(info.cb)();
                } else if (typeof info.cb === 'function') {
                    info.cb.apply(info.target, info.args);
                }
            }
        }
    }
}

nodeWindow.alert = console.error.bind(console);

// // File utils (Temporary, won't be accessible)
// if (typeof jsb.FileUtils !== 'undefined') {
//     jsb.fileUtils = jsb.FileUtils.getInstance();
//     delete jsb.FileUtils;
// }

// nodeWindow.XMLHttpRequest.prototype.addEventListener = function (eventName, listener, options) {
//     this[`on${eventName}`] = listener;
// };

// nodeWindow.XMLHttpRequest.prototype.removeEventListener = function (eventName, listener, options) {
//     this[`on${eventName}`] = null;
// };

// SocketIO
if (nodeWindow.SocketIO) {
    nodeWindow.io = nodeWindow.SocketIO;
    nodeWindow.SocketIO.prototype._Emit = nodeWindow.SocketIO.prototype.emit;
    nodeWindow.SocketIO.prototype.emit = function (uri, delegate) {
        if (typeof delegate === 'object') {
            delegate = JSON.stringify(delegate);
        }
        this._Emit(uri, delegate);
    };
}

nodeWindow.gameTick = tick;

// // generate get set function
// jsb.generateGetSet = function (moduleObj) {
//     for (const classKey in moduleObj) {
//         const classProto = moduleObj[classKey] && moduleObj[classKey].prototype;
//         if (!classProto) continue;
//         for (const getName in classProto) {
//             const getPos = getName.search(/^get/);
//             if (getPos == -1) continue;
//             let propName = getName.replace(/^get/, '');
//             const nameArr = propName.split('');
//             const lowerFirst = nameArr[0].toLowerCase();
//             const upperFirst = nameArr[0].toUpperCase();
//             nameArr.splice(0, 1);
//             const left = nameArr.join('');
//             propName = lowerFirst + left;
//             const setName = `set${upperFirst}${left}`;
//             if (classProto.hasOwnProperty(propName)) continue;
//             const setFunc = classProto[setName];
//             const hasSetFunc = typeof setFunc === 'function';
//             if (hasSetFunc) {
//                 Object.defineProperty(classProto, propName, {
//                     get () {
//                         return this[getName]();
//                     },
//                     set (val) {
//                         this[setName](val);
//                     },
//                     configurable: true,
//                 });
//             } else {
//                 Object.defineProperty(classProto, propName, {
//                     get () {
//                         return this[getName]();
//                     },
//                     configurable: true,
//                 });
//             }
//         }
//     }
// };

for (const key in nodeWindow) {
    if (globalThis[key] === undefined) {
        globalThis[key] = nodeWindow[key];
    }
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = globalThis;
}

// promise polyfill relies on setTimeout implementation
require('./promise.min');
