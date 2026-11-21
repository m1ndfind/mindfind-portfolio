import {chromium} from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const before=process.argv.includes('--before');
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--enable-gpu','--use-angle=gl','--ignore-gpu-blocklist']});
try{
 const page=await b.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/avatar.js', async r=>{
 const src=before?execFileSync('git',['show','7ef2436:src/avatar.js'],{encoding:'utf8'}):fs.readFileSync('src/avatar.js','utf8');
 await r.fulfill({contentType:'text/javascript',body:src.replace('renderer.render(scene,camera);',`
 const azimuth=Math.atan2(camera.position.x,camera.position.z);
 camera.position.set(.57,1.67,5.95);camera.lookAt(0,1.23,0);
 renderer.render(scene,camera);
 window.frame={azimuth,root:asset.scene.matrixWorld.toArray(),bones:Object.fromEntries(asset.scene.getObjectsByProperty('isBone',true).map(b=>[b.name,b.quaternion.toArray()])),render:{...renderer.info.render},memory:{...renderer.info.memory}};
 `)});
 });
 if(before)await page.route('**/models/mindfind-avatar.glb',r=>r.fulfill({path:'assets/source/backup/mindfind-avatar-original.glb'}));
 await page.goto('http://127.0.0.1:8079/demos/mono.html');
 await page.evaluate(async()=>{document.head.innerHTML='<base href="/">';document.body.innerHTML='<figure data-bake data-model="models/mindfind-avatar.glb"><canvas style="width:500px;height:540px"></canvas></figure>';window.draw=await(await import('/avatar.js')).mountAvatar(document.querySelector('figure'));});
 const frames=[];
 for(const [i,[p,dt]] of [[0,0],[0,1.5],[.14,0],[.49,1],[.89,0],[.89,2],[1,2]].entries()){
 const sample=await page.evaluate(([p,dt])=>{draw(p,dt);const c=document.querySelector('canvas');return {...window.frame,p,dt,url:c.toDataURL('image/webp',.95),error:c.getContext('webgl2').getError()};},[p,dt]);
 const prefix='visual-qa/vinyl/'+(before?'before':'after');
 fs.writeFileSync(prefix+'-'+i+'.webp',Buffer.from(sample.url.split(',')[1],'base64'));delete sample.url;frames.push(sample);assert.equal(sample.error,0);
 }
 if(!before){
 for(const key of Object.keys(frames[0].bones).filter(k=>k!=='Hips'))assert(frames.some(f=>JSON.stringify(f.bones[key])!==JSON.stringify(frames[0].bones[key])),key);
 for(const f of frames){assert.deepEqual(f.root,frames[0].root);assert.deepEqual(f.bones.Hips,frames[0].bones.Hips);assert(Math.abs(f.azimuth-frames[0].azimuth)<1e-6);}
 }
 assert.deepEqual(errors,[]);console.log(frames[0].memory,frames[0].render,Object.keys(frames[0].bones));
 fs.writeFileSync('visual-qa/vinyl/'+(before?'before':'after')+'-measurements.json',JSON.stringify(frames,null,2));
}finally{await b.close();}
