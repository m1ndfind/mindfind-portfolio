import {chromium} from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
try{
 const page=await browser.newPage();
 // Capture rendered local rotations immediately before the actual draw call.
 await page.route('**/avatar.js',async route=>{
  const code=fs.readFileSync('src/avatar.js','utf8').replace('renderer.render(scene,camera);',`camera.position.set(0,1.65,5.5);camera.lookAt(0,1.33,0);
  window.sample={camera:camera.position.toArray(),bones:Object.fromEntries(asset.scene.getObjectsByProperty('isBone',true).map(b=>[b.name,b.quaternion.toArray()]))}; renderer.render(scene,camera);`);
  await route.fulfill({contentType:'text/javascript',body:code});
 });
 await page.goto((process.env.QA_ORIGIN || 'http://127.0.0.1:8079')+'/demos/mono.html');
 await page.evaluate(async()=>{document.head.innerHTML='<base href="/">';document.body.innerHTML='<figure data-bake data-model="models/mindfind-avatar.glb"><canvas style="width:400px;height:460px"></canvas></figure>';window.draw=await(await import('/avatar.js')).mountAvatar(document.querySelector('figure'));});
 const samples=[];
 for(const [i,[chapter,dt]] of [[0,0],[0,2],[0,2],[.49,0],[.89,0],[1,0]].entries()){
 const {sample,url,error}=await page.evaluate(([p,dt])=>{draw(p,dt);const canvas=document.querySelector('canvas');return {sample:window.sample,url:canvas.toDataURL('image/webp',.91),error:canvas.getContext('webgl2').getError()};},[chapter,dt]);
 assert.equal(error,0);samples.push({...sample,chapter,dt});fs.writeFileSync('visual-qa/videos/pose-'+i+'.webp',Buffer.from(url.split(',')[1],'base64'));
 }
 for(const n of ['Head','Chest','ShoulderL','ShoulderR','ElbowL','ElbowR','HandL','HandR'])assert.notDeepEqual(samples[0].bones[n],samples[1].bones[n]);
 assert.notDeepEqual(samples[3].bones.ElbowL,samples[4].bones.ElbowL);
 fs.writeFileSync('visual-qa/videos/bone-transforms.json',JSON.stringify(samples,null,2));console.log('Eight independently changing local bone rotations, fixed camera, WebGL error 0');
}finally{await browser.close()}
