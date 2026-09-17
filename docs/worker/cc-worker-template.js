/**
 * Cocos universal worker entry template (Web + WeChat mini-game).
 *
 * This is a READY-MADE worker file you copy into your own project. It implements the exact message
 * protocol expected by the engine's `cc.WorkerPool` (script mode) and `cc.createWorker(path)`, and it
 * runs on BOTH Web (`self.onmessage`) and WeChat (`worker.onMessage`) with no further changes.
 *
 * WHY A PHYSICAL FILE IS REQUIRED ON WECHAT
 * -----------------------------------------
 * WeChat mini-games have no global `Worker` constructor and FORBID dynamically executing JS code
 * (`eval` / `new Function` are banned). So the engine cannot ship a function's source string and
 * rebuild it inside a WeChat worker. The only way to get real parallelism on WeChat is to write the
 * task into a physical JS file like this one, package it, and declare it in `game.json`.
 *
 * HOW TO USE
 * ----------
 * 1. Copy this file into your project's worker directory, e.g. `workers/heavy-compute/index.js`.
 * 2. Implement your pure computation in `runTask(args)` below. It MUST be self-contained: it runs in
 *    a separate thread and CANNOT access `cc`, the scene, the DOM, or any closure variable from the
 *    main thread. Only `args` (structured-cloned) is available as input, and the return value must be
 *    structured-cloneable (or a Transferable such as ArrayBuffer / TypedArray).
 * 3. Package & configure:
 *    - WeChat: declare the worker root in the built `game.json` -> { "workers": "workers" }, and make
 *      sure this file lives inside that directory. WeChat V1 allows only ONE worker at a time; V2
 *      (standard worker, gray release / Android) allows multiple. The engine pool auto-caps to the
 *      platform limit, so you do not need to branch on this yourself.
 *    - Web: make sure this file is served at the same path you pass to the pool.
 * 4. Drive it from the main thread:
 *      // Pool size defaults to a CPU-based count and is auto-capped per platform (WeChat V1 => 1).
 *      // On WeChat V2 pass an explicit maxWorkers to scale beyond 1 (core count is not detectable there).
 *      const pool = new cc.WorkerPool('workers/heavy-compute/index.js', { maxWorkers: 4 });
 *      const result = await pool.run([1000000]);   // args array -> runTask(args)
 *      pool.terminate();
 *
 * MESSAGE PROTOCOL (must match the engine; do not change the plumbing below)
 * --------------------------------------------------------------------------
 *   main  -> worker : { id: number, args: any[] }
 *   worker -> main  : { id: number, ok: true,  value: any }
 *                   | { id: number, ok: false, error: string }
 */

// ==== YOUR TASK: put your pure, self-contained computation here ==================
function runTask (args) {
    // `args` is exactly the array you passed to `pool.run([...])`.
    // Example below: a heavy numeric loop. Replace it with your own logic.
    var n = (args && args[0]) || 0;
    var acc = 0;
    for (var i = 0; i < n; i++) {
        acc += Math.sqrt(i);
    }
    return acc;

    // ---- Multi-task variant (optional) -------------------------------------------
    // If one worker file should handle several kinds of work, dispatch on an argument:
    //   switch (args && args[0]) {
    //       case 'normals': return computeNormals(args[1]);
    //       case 'lod':     return computeLod(args[1]);
    //       default:        throw new Error('unknown task: ' + (args && args[0]));
    //   }
    // Remember: every helper you call (computeNormals, ...) must also be defined in THIS file
    // (or required from another file inside the same worker directory).
}
// =================================================================================

// ---- Message plumbing (works on Web and WeChat; normally no need to edit) --------

function handleMessage (msg) {
    var id = msg && msg.id;
    try {
        var value = runTask(msg && msg.args);
        reply({ id: id, ok: true, value: value });
    } catch (e) {
        reply({ id: id, ok: false, error: String((e && e.message) || e) });
    }
}

function reply (msg) {
    // WeChat mini-game: the global `worker` object.
    if (typeof worker !== 'undefined' && worker && typeof worker.postMessage === 'function') {
        worker.postMessage(msg);
        return;
    }
    // Web Worker: the global `self`.
    if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
        self.postMessage(msg);
    }
}

// Register the message handler for the current platform (mutually exclusive).
if (typeof worker !== 'undefined' && worker && typeof worker.onMessage === 'function') {
    // WeChat mini-game worker.
    worker.onMessage(handleMessage);
} else if (typeof self !== 'undefined') {
    // Web Worker.
    self.onmessage = function (e) {
        handleMessage(e && e.data);
    };
}
