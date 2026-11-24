'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {QuickCompiler}=require('@cocos/quick-compiler');
const {StatsQuery}=require('@cocos/ccbuild');
const {selectFeatures}=require('./prepare-editor-profiles.cjs');
async function compileProfile({source,dir,name,platform}) {
    const query=await StatsQuery.create(source);
    const render=JSON.parse(fs.readFileSync(path.join(source,'editor/engine-features/render-config.json'),'utf8'));
    const constants=query.constantManager.genCCEnvConstants({platform,mode:'EDITOR',flags:{DEBUG:true}});
    const features=selectFeatures(query.getFeatures(),render,constants);
    if(name==='editor'&&!features.includes('gfx-webgl'))features.push('gfx-webgl');
    const compiler=new QuickCompiler({rootDir:source,outDir:dir,platform,
        targets:[{dir,format:'systemjs',featureUnitPrefix:'cce:/internal/x/cc-fu/',usedInElectron509:true,
            targets:'Electron 5.0.8',includeEditorExports:true,includeIndex:{features},loader:true,loose:true}]});
    await compiler.build();
    await compiler.buildImportMap(0,features,{});
    fs.writeFileSync(path.join(dir,'profile.json'),JSON.stringify({platform,features},null,2));
}
if(require.main===module)compileProfile(JSON.parse(process.argv[2])).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={compileProfile};
