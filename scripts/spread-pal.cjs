// postinstall 相当：把 @cocos/engine-pal 的产物【复制】到 engineRoot/pal。
//
// 为什么必须挂到 engineRoot/pal（而非直接用 node_modules）：见 docs/pal-platforms-privatization.md §8.2——
//   引擎 cocos/* 通过相对路径深度 import pal（如 ../../pal/audio/type，23 处），由 rollup 基于
//   importer 文件位置解析成 <engineRoot>/pal/...，不经任何 alias；第二条链路(quick-compiler)与
//   tsc 类型检查同样依赖 pal 物理位于 engineRoot/pal。
//
// 为什么用【复制】而非软链(junction/symlink)：实测软链不可行（2026-07-03）。
//   rollup 的 nodeResolve(jail=realPath(engineRoot)) 与 tsc 都会对软链做 realpath，pal 文件的
//   真实路径落回 node_modules/@cocos/engine-pal/dist，导致 tsconfig 的 `@cocos/engine/*` paths
//   别名对其失效(tsc 不对 node_modules 内文件应用 paths) → 产物残留未解析的 `@cocos/engine/*`
//   import(运行时会坏)。tsconfig 单加 preserveSymlinks 也无效(nodeResolve 已先 realpath)。
//   要用软链得改 ccbuild 传 rollup preserveSymlinks，代价与副作用不划算。故用复制：pal 真实
//   物理位于 engineRoot/pal，paths 别名才生效。
const fs = require('fs');
const path = require('path');
const ensurePal = require('./ensure-pal.cjs');

const engineRoot = path.join(__dirname, '..');
const dst = path.join(engineRoot, 'pal');
// Local PAL development: node scripts/spread-pal.cjs --source ../cocos-pal/dist
const sourceIndex = process.argv.indexOf('--source');
if (sourceIndex >= 0 && !process.argv[sourceIndex + 1]) {
    throw new Error('--source requires a PAL dist directory');
}
const fromPackage = sourceIndex < 0;
const src = fromPackage
    ? ensurePal.packageDist(dst)
    : path.resolve(process.argv[sourceIndex + 1]);

if (src === dst || src.startsWith(dst + path.sep)) {
    throw new Error('PAL source must be outside the destination directory');
}

if (!fs.existsSync(src)) {
    console.error(`[spread-pal] 找不到 pal 产物: ${src}\n请先安装 @cocos/engine-pal。`);
    process.exit(1);
}

// 复制并记录来源(pal/.pal-source.json)。之后各构建入口的 ensure-pal 据此判断 pal/ 是否落后于
// 已安装的 npm 包(例如 npm install --ignore-scripts 后未重新 spread),落后则自动重新同步。
const count = ensurePal.spread(src, dst, fromPackage);
ensurePal(dst);
console.log(`[spread-pal] 已复制 ${count} 个文件: ${src} -> ${dst}`);
