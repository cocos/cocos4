// 先设置 CLUSTER_EFFECT_OUTPUT 并运行 cluster-effects.test.ts。
// node tests/rendering/validate-cluster-glsl.cjs <编译输出目录> [glslang模块目录]
// 省略第二参数时使用引擎自带的 glslang WASM，无需额外安装依赖。
const fs = require('fs');
const path = require('path');
const directory = path.resolve(process.argv[2]);
async function main() {
let glslang;
if (process.argv[3]) {
 glslang = require(path.resolve(process.argv[3]))();
} else {
 const base = path.resolve(__dirname, '../../native/external/emscripten/webgpu');
 const source = fs.readFileSync(path.join(base, 'glslang.js'), 'utf8');
 const factory = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
 const wasm = new WebAssembly.Module(fs.readFileSync(path.join(base, 'glslang.wasm')));
 glslang = await factory.default({ instantiateWasm(imports, receive) {
  const instance = new WebAssembly.Instance(wasm, imports);
  receive(instance, wasm);
  return instance.exports;
 } });
}
for (const name of ['build', 'reset', 'clulling', 'standard']) {
 const effect = JSON.parse(fs.readFileSync(directory + '/' + name + '.json', 'utf8'));
 const shader = effect.shaders[0];
 for (const stage of name === 'standard' ? ['vert', 'frag'] : ['compute']) {
  const values = Object.fromEntries(shader.defines.map(d => [d.name, d.default ?? (d.type === 'number' ? d.range[0] : d.type === 'string' ? d.options[0] : 0)]));
  Object.assign(values, { CC_FORWARD_CLUSTER: 1, CC_USE_FLOAT_OUTPUT: 1, CC_JOINT_UNIFORM_CAPACITY: 30, CC_DEVICE_MAX_VERTEX_UNIFORM_VECTORS: 256, CC_DEVICE_MAX_FRAGMENT_UNIFORM_VECTORS: 256 });
  let prefix = '#version 450\n' + Object.entries(values).map(([k,v]) => '#define ' + k + ' ' + Number(v) + '\n').join('');
  let binding = 0;
  let source = shader.glsl4[stage].replace(/layout\([^)]*(?:binding|set)[^)]*\)/g, '');
  source = source.replace(/\buniform\b/g, () => 'layout(set=0,binding=' + binding++ + ') uniform');
  source = source.replace(/\b((?:readonly\s+|writeonly\s+)?)buffer\b/g, (_, q) => 'layout(std430,set=0,binding=' + binding++ + ') ' + q + 'buffer');
  const full = prefix + source;
  fs.writeFileSync(directory + '/' + name + '.' + stage, full);
  const result = glslang.compileGLSL(full, stage === 'vert' ? 'vertex' : stage === 'frag' ? 'fragment' : 'compute');
  console.log(name + '.' + stage, 'SPIR-V words:', result.length);
 }
}
}
main().catch(error => { console.error(error); process.exitCode = 1; });
