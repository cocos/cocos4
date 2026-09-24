// Tests switch target at runtime; production selects the same PAL entries via cc.config.json.
// Only target selection is mocked. All worker behaviour runs the actual distributed PAL code.
const { minigame } = require('pal/minigame');
const web = require('../../pal/worker/web/index');
const mini = require('../../pal/worker/minigame/index');
const native = require('../../pal/worker/native/index');

exports.createWorkerBackend = () => {
    if (['getSystemInfoSync', 'createWorker', 'getFileSystemManager']
        .some((key) => typeof minigame[key] === 'function')) {
        return mini.createWorkerBackend();
    }
    return typeof Worker !== 'undefined' ? web.createWorkerBackend() : native.createWorkerBackend();
};
