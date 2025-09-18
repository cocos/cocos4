/****************************************************************************
 Copyright (c) 2017-2020 Xiamen Yaji Software Co., Ltd.
 https://www.cocos.com/
 Permission is hereby granted, free of charge, to any person obtaining a copy
 of fsUtils software and associated engine source code (the "Software"), a limited,
  worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
  not use Cocos Creator software for developing other software or tools that's
  used for developing games. You are not granted to publish, distribute,
  sublicense, and/or sell copies of Cocos Creator.
 The software or tools in fsUtils License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.
 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

const path = require("path");

const fs = window.fs;
let jsb_downloader = null;
const downloading = new cc.AssetManager.Cache();
let tempDir = '';

// jsb.Downloader.prototype._ctor = function () {
//     this.__nativeRefs = {};
// };

const fsUtils = {

    fs,

    initJsbDownloader(jsbDownloaderMaxTasks, jsbDownloaderTimeout) {
        console.log("initJsbDownloader: nodejs does not support")
    },
    getUserDataPath() {
        console.log("getUserDataPath: nodejs does not support");
        return path.join('./', "writablePath");
    },
    checkFsValid() {
        if (!fs) {
            cc.warn('can not get the file system!');
            return false;
        }
        return true;
    },

    deleteFile(filePath, onComplete) {
        fs.unlink(filePath, (e) => {
            if (e) {
                const err = new Error(`Delete file failed: path: ${filePath} errno: ${e.errno} message: ${e.message}`);
                console.warn(err.message);
                onComplete && onComplete(err);
            } else {
                onComplete && onComplete(null);
            }
        });
    },
    
    fullPathForFilename(filename) {
        const path = globalThis.window.path;
        if(filename.length <= 0){ 
            return "";
        }
        if(path.isAbsolute(filename)) {
            return filename;
        }
        const newFilename = path.normalize(filename);
        const projectPath = globalThis.window.projectResourcePath;
        const fullpath = path.join(projectPath, newFilename);
        if(fs.pathExistsSync(fullpath)) {
            return fullpath;
        }
        return "";
    },

    downloadFile(remoteUrl, filePath, header, onProgress, onComplete) {
        cc.warn('can not downloadFile the file system!');
        // downloading.add(remoteUrl, { onProgress, onComplete });
        // let storagePath = filePath;
        // if (!storagePath) storagePath = `${tempDir}/${performance.now()}${cc.path.extname(remoteUrl)}`;
        // jsb_downloader.createDownloadTask(remoteUrl, storagePath, header);
    },

    saveFile(srcPath, destPath, onComplete) {
        srcPath = fsUtils.fullPathForFilename(srcPath);
        destPath = fsUtils.fullPathForFilename(destPath);
        fs.copyFile(srcPath, destPath, (e) => {
            if (e) {
                const err = new Error(`Save file failed: path: ${srcPath} errno: ${e.errno} message: ${e.message}`);
                console.warn(err.message);
                onComplete && onComplete(err);
            } else {
                fs.remove(srcPath);
                onComplete && onComplete(null);
            }
        });
    },

    copyFile(srcPath, destPath, onComplete) {
        fs.copyFile(srcPath, destPath, (e) => {
            if (e) {
                const err = new Error(`Copy file failed: path: ${srcPath} errno: ${e.errno} message: ${e.message}`);
                cc.warn(err.message);
                onComplete && onComplete(err);
            } else {
                onComplete && onComplete(null);
            }
        });
    },

    writeFile(filePath, data, encoding, onComplete) {
        fs.writeFile(filePath, data, encoding, (e) => {
            if (e) {
                const err = new Error(`Write file failed: path: ${filePath} errno: ${e.errno} message: ${e.message}`);
                cc.warn(err.message);
                onComplete && onComplete(err);
            } else {
                onComplete && onComplete(null);
            }
        })
    },

    writeFileSync(filePath, data, encoding) {
        try {
            fs.writeFile(filePath, data, encoding);
            return null;
        } catch (e) {
            const err = new Error(`Write file sync failed: path: ${filePath} errno: ${e.errno} message: ${e.message}`);
            cc.warn(err.message);
            return err;
        }
    },

    readFile(filePath, encoding, onComplete) {
        fs.readFile(filePath, encoding, (e, data) => {
            if (e) {
                const err = new Error(`Read file failed: path: ${filePath} errno: ${e.errno} message: ${e.message}`);
                cc.warn(err.message);
                onComplete && onComplete(err, null);
            } else {
                onComplete && onComplete(null, data);
            }
        })
    },

    readDir(filePath, onComplete) {
        fs.readdir(filePath, (e, files) => {
            if (e) {
                const err = new Error(`Read directory failed: path: ${filePath} errno: ${e.errno} message: ${e.message}`);
                cc.warn(err.message);
                onComplete && onComplete(err, null);
            } else {
                onComplete && onComplete(null, files);
            }
        })
    },

    readText(filePath, onComplete) {
        fsUtils.readFile(filePath, 'utf8', onComplete);
    },

    readArrayBuffer(filePath, onComplete) {
        fsUtils.readFile(filePath, '', onComplete);
    },

    readJson(filePath, onComplete) {
        filePath = fsUtils.fullPathForFilename(filePath);
        fs.readJson(filePath, (e, jsonObj) => {
            if (e) {
                const err = new Error(`Read json failed: path: ${filePath} errno: ${e.errno} message: ${e.message}`);
                cc.warn(err.message);
                onComplete && onComplete(err, null);
            } else {
                onComplete && onComplete(null, jsonObj);
            }
        })
    },

    readJsonSync(filePath) {
        try {
            return fs.readJsonSync(filePath);
        } catch (e) {
            const err = new Error(`Read json sync failed: path: ${filePath} errno: ${e.errno} message: ${e.message}`);
            cc.warn(err.message);
            return err;
        }
    },

    makeDirSync(filePath, recursive) {
        try {
            fs.mkdirSync(filePath, { recursive: recursive });
            return null;
        } catch (r) {
            const err = new Error(`Make directory failed: path: ${filePath} errno: ${e.errno} message: ${e.message}`);
            cc.warn(err.message);
            return err;
        }
    },

    rmdirSync(dirPath, recursive) {
        try {
            fs.rmSync(dirPath, { recursive: recursive });
            return null;
        } catch (e) {
            const err = new Error(`Remove directory failed: path: ${dirPath} errno: ${e.errno} message: ${e.message}`);
            cc.warn(err.message);
            return err;
        }
    },

    exists(filePath, onComplete) {
        fs.pathExists(filePath, function (e, exists) {
            if(e) {
                const err = new Error(`Path existence check failed: ${filePath} errno: ${e.errno} message: ${e.message}`);
                cc.warn(err.message);
                return err;
            }
            onComplete && onComplete(exists);
        });
    },
    loadSubpackage(name, onProgress, onComplete) {
        throw new Error('not implement');
    },
};

globalThis.fsUtils = module.exports = fsUtils;
