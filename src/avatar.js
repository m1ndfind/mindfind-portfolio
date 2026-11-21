// Bind the studio camera to the collectible’s physical height and foot plane.
import * as T from './vendor/studio.js';

export async function mountAvatar(figure) {
  const canvas = figure.querySelector('canvas');
  const renderer = new T.WebGLRenderer({canvas, alpha:true, antialias:true, powerPreference:'low-power'});
  const gl=renderer.getContext();
  const debug=gl.getExtension('WEBGL_debug_renderer_info');
  if (!figure.hasAttribute('data-bake') && debug && /swiftshader|llvmpipe|software rasterizer/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))) {
    renderer.dispose();
    throw new Error('Use baked studio on a software renderer');
  }
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(31,1,.1,40);
  const subject = new T.Group();
  scene.add(subject);
  const ambient=new T.AmbientLight(0xfff5e9,1.15);
  const fill=new T.DirectionalLight(0xe5ebff,1.0);
  fill.position.set(3,2,4);
  scene.add(ambient,fill);
  const key = new T.DirectionalLight(0xfff4de,3);
  key.position.set(-3.3,5.6,4.1);
  key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-2,right:2,top:3,bottom:-1,near:.1,far:13});
  key.shadow.intensity=.46;
  key.shadow.radius=7;
  key.shadow.normalBias=.009;
  key.shadow.bias=-.00035;
  renderer.shadowMap.enabled=true;
  scene.add(key);
  const rim = new T.DirectionalLight(0xd5dcff,1.7);
  rim.position.set(4,2,-2);
  scene.add(rim);
  const {GLTFLoader} = await import('./vendor/glb.js');
  const asset = await new GLTFLoader().loadAsync(figure.dataset.model);
  const bounds = new T.Box3().setFromObject(asset.scene);
  const center = bounds.getCenter(new T.Vector3());
  const scale = 2.65 / (bounds.max.y - bounds.min.y);
  asset.scene.scale.setScalar(scale);
  asset.scene.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
  subject.add(asset.scene);
  // Material batches can share a single GPU bone palette when their bind poses match.
  let paletteOwner;
  asset.scene.traverse(node=>{
    if(!node.isMesh)return;
    node.castShadow=true;
    node.receiveShadow=true;
    const rig=node.skeleton;
    if(!rig)return;
    if(!paletteOwner)paletteOwner=rig;
    else if(rig!==paletteOwner && rig.bones.length===paletteOwner.bones.length &&
      rig.bones.every((b,i)=>b===paletteOwner.bones[i] && rig.boneInverses[i].equals(paletteOwner.boneInverses[i]))){
      node.skeleton=paletteOwner;
      rig.dispose();
    }
  });
  const mixer = new T.AnimationMixer(asset.scene);
  mixer.clipAction(asset.animations.find(clip => clip.name==='Idle')).play();
  const neck=asset.scene.getObjectByName('Head');
  const elbow=asset.scene.getObjectByName('ElbowL');
  const hand=asset.scene.getObjectByName('HandL');
  const chest=asset.scene.getObjectByName('Chest');
  const shoulder=asset.scene.getObjectByName('ShoulderL');
  const otherElbow=asset.scene.getObjectByName('ElbowR');
  const otherShoulder=asset.scene.getObjectByName('ShoulderR');
  const otherHand=asset.scene.getObjectByName('HandR');
  const controls=[neck,elbow,hand,chest,shoulder,otherElbow,otherShoulder,otherHand];
  // Light colors interpolate in working (linear) space between the three sets.
  const palette=(light,values)=>values.map(value=>light.color.clone().setHex(value));
  const keys=palette(key,[0xffe6ce,0xffe1d3,0xfff3e7]);
  const rims=palette(rim,[0xd8e6ff,0xffb78e,0xffc0a1]);
  const fills=palette(fill,[0xe2eaff,0xf0b6c7,0xffd0ca]);
  const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
  const poses=controls.map(node=>node.quaternion.clone());
  function platform(radius,height,y,color,roughness) {
    const geometry = new T.CylinderGeometry(radius,radius,height,96);
    const mesh = new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness,metalness:.17}));
    mesh.position.y = y;
    mesh.receiveShadow=true;
    scene.add(mesh);
  }
  platform(1.15,.12,-.07,0xc9c3b7,.68);
  platform(1.13,.018,-.139,0xa52317,.45);
  platform(1.11,.045,-.166,0x69665e,.7);
  // Soft contact at the feet supplements the figure’s self-shadowing.
  const shadow = new T.Mesh(new T.PlaneGeometry(1.8,.94),new T.MeshBasicMaterial({transparent:true,map:await new T.TextureLoader().loadAsync('assets/studio-shadow.png'),depthWrite:false}));
  shadow.rotation.x = -Math.PI/2; shadow.position.y = -.006; scene.add(shadow);
  let width=0,height=0,quality=1,slow=0;
  let disposed=false;
  addEventListener('pagehide',event=>{
    if(event.persisted || disposed)return;
    disposed=true;
    mixer.stopAllAction();
    mixer.uncacheRoot(asset.scene);
    const resources=new Set();
    scene.traverse(node=>{
      if(!node.isMesh)return;
      resources.add(node.geometry);
      if(node.skeleton) resources.add(node.skeleton);
      for(const material of [].concat(node.material)){
        resources.add(material);
        for(const value of Object.values(material))if(value?.isTexture)resources.add(value);
      }
    });
    for(const resource of resources)resource.dispose();
    key.shadow.dispose();
    renderer.dispose();
  });
  let lastProgress=NaN,settledSeconds=0;
  return (p,dt) => {
    if (disposed || renderer.getContext().isContextLost()) return;
    slow=dt>.035?slow+1:Math.max(0,slow-1);
    if (slow>=12 && quality>.65) {quality-=.15;width=0;slow=0;}
    if (canvas.clientWidth!==width || canvas.clientHeight!==height) {
      width=canvas.clientWidth; height=canvas.clientHeight;
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.5,Math.sqrt(1000000/(width*height)))*quality);
      renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    }

    const arc=Math.sin(Math.PI*p);
    const angle=.12; // Fixed three-quarter axis. Scroll only changes framing.
    const distance=Math.max(5.55,4.0/camera.aspect)+.48*p-.14*arc;
    camera.position.set(Math.sin(angle)*distance,1.77+.23*arc,Math.cos(angle)*distance);
    camera.lookAt(0,1.26-.06*p,0);

    mixer.update(dt);
    // Mix absolute local poses without accumulating rotations between frames.
    controls.forEach((node,i)=>poses[i].copy(node.quaternion));
    const present=Math.exp(-((p-.14)**2)/.016);
    const invite=Math.exp(-((p-.89)**2)/.007);
    // Offset the two arm phrases. A held chapter resolves back to idle.
    if(Math.abs(p-lastProgress)<.0003)settledSeconds+=dt;
    else settledSeconds=Math.max(0,settledSeconds-4*dt);
    lastProgress=p;
    const phrase=1-smooth(1.4,3.2,settledSeconds);
    const offer=present*phrase;
    const point=invite*phrase;
    neck.rotation.y+=-.10*present+.075*arc-.15*invite;
    neck.rotation.z+=.043*arc;
    chest.rotation.y+=.040*arc;
    otherShoulder.rotation.z+=.22*arc;
    otherShoulder.rotation.x-=.13*arc;
    otherElbow.rotation.x-=.45*arc;
    otherHand.rotation.z+=.14*arc;
    shoulder.rotation.z-=.49*offer+.65*point;
    shoulder.rotation.x-=.34*offer+.22*point;
    elbow.rotation.x-=.60*offer+.72*point;
    hand.rotation.z-=.22*offer+.21*point;
    const wine=smooth(.24,.42,p),red=smooth(.62,.78,p);
    key.color.lerpColors(keys[0],keys[1],wine).lerp(keys[2],red);
    rim.color.lerpColors(rims[0],rims[1],wine).lerp(rims[2],red);
    fill.color.lerpColors(fills[0],fills[1],wine).lerp(fills[2],red);
    key.intensity=2.65+.48*wine-.20*red;
    rim.intensity=1.9+.7*wine;
    ambient.intensity=1.26-.24*wine+.14*red;
    renderer.render(scene,camera);
    controls.forEach((node,i)=>node.quaternion.copy(poses[i]));
    figure.classList.add('live');
  };
}
