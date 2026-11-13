import * as fs from 'fs';
import * as path from 'path';
import * as mappings from '../../editor/exports/offline-mappings';
import { UpdateFrequency } from '../../cocos/rendering/custom/types';
import { MemoryAccessBit, ShaderStageFlagBit } from '../../cocos/gfx';

// 指向 Creator 配套的 effect-compiler，使用实际导入器验证反射和 GLSL 生成。
const compilerPath = process.env.COCOS_EFFECT_COMPILER;
const run = compilerPath ? test : test.skip;

run('cluster effect 通过 Creator 编译且计算/片元资源反射与管线契约一致', () => {
    // 本测试覆盖导入/反射；GPU GLSL 语法验证由 validate-cluster-glsl.cjs 执行。
    const canvas = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    jest.doMock('cc/editor/offline-mappings', () => mappings, { virtual: true });
    const compiler = require(compilerPath!);
    compiler.options.throwOnWarning = true;
    compiler.options.skipParserTest = true;
    compiler.options.chunkSearchFn = (names: string[]) => {
        for (const name of names) {
            const file = path.join(__dirname, '../../editor/assets/chunks', `${name}.chunk`);
            if (fs.existsSync(file)) return { name, content: fs.readFileSync(file, 'utf8') };
        }
        return {};
    };
    for (const name of ['build', 'reset', 'clulling', 'standard']) {
        const file = path.join(__dirname, '../../editor/assets/effects/pipeline/custom/cluster', `${name}.effect`);
        const effect = compiler.buildEffect(`pipeline/custom/cluster/${name}`, fs.readFileSync(file, 'utf8'));
        expect(effect.shaders.length).toBeGreaterThan(0);
        const descriptors = effect.shaders[0].descriptors.find(d => d.rate === UpdateFrequency.PER_PASS);
        if (name === 'clulling' || name === 'standard') {
            const constants = descriptors.blocks.find(block => block.name === 'CCClusterConstants');
            expect(constants.members.map(member => member.name)).toEqual([
                'cc_clusterCamera', 'cc_clusterView', 'cc_clusterProj', 'cc_clusterProjInv',
            ]);
            const expectedNames = name === 'clulling'
                ? ['b_ccLights', 'b_clusters', 'b_clusterLightGrid', 'b_clusterLightIndices', 'b_globalIndex']
                : ['b_ccLights', 'b_clusterLightGrid', 'b_clusterLightIndices'];
            expect(descriptors.buffers.map(buffer => buffer.name)).toEqual(expectedNames);
            for (const buffer of descriptors.buffers) {
                expect(buffer.stageFlags).toBe(name === 'clulling' ? ShaderStageFlagBit.COMPUTE : ShaderStageFlagBit.FRAGMENT);
                if (name === 'standard') expect(buffer.memoryAccess).toBe(MemoryAccessBit.READ_ONLY);
            }
            if (name === 'clulling') {
                expect(descriptors.buffers.find(buffer => buffer.name === 'b_globalIndex').memoryAccess).toBe(MemoryAccessBit.READ_WRITE);
            }
        }
        if (process.env.CLUSTER_EFFECT_OUTPUT) {
            fs.mkdirSync(process.env.CLUSTER_EFFECT_OUTPUT, { recursive: true });
            fs.writeFileSync(path.join(process.env.CLUSTER_EFFECT_OUTPUT, `${name}.json`), JSON.stringify(effect));
        }
    }
    canvas.mockRestore();
});
