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
  scene.add(new T.AmbientLight(0xfff7ef,1.72));
  const key = new T.DirectionalLight(0xfff4de,3);
  key.position.set(-3,5,5);
  key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-2,right:2,top:3,bottom:-1,near:.1,far:13});
  key.shadow.intensity=.38;
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
  asset.scene.traverse(node=>{
    if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}
  });
  const mixer = new T.AnimationMixer(asset.scene);
  mixer.clipAction(asset.animations.find(clip => clip.name==='Idle')).play();
  const neck=asset.scene.getObjectByName('Head');
  const elbow=asset.scene.getObjectByName('ElbowL');
  const hand=asset.scene.getObjectByName('HandL');
  const controls=[neck,elbow,hand];
  const poses=controls.map(node=>node.quaternion.clone());
  function platform(radius,height,y,color,roughness) {
    const geometry = new T.CylinderGeometry(radius,radius,height,96);
    const mesh = new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness,metalness:.17}));
    mesh.position.y = y;
    scene.add(mesh);
  }
  platform(1.15,.12,-.07,0xc9c3b7,.68);
  platform(1.13,.018,-.139,0xa52317,.45);
  platform(1.11,.045,-.166,0x69665e,.7);
  // Soft contact at the feet supplements the figure’s self-shadowing.
  const shadow = new T.Mesh(new T.PlaneGeometry(1.8,.94),new T.MeshBasicMaterial({transparent:true,map:await new T.TextureLoader().loadAsync('assets/studio-shadow.png'),depthWrite:false}));
  shadow.rotation.x = -Math.PI/2; shadow.position.y = -.006; scene.add(shadow);
  let width=0,height=0,quality=1,slow=0;
  return (p,dt) => {
    if (renderer.getContext().isContextLost()) return;
    slow=dt>.035?slow+1:Math.max(0,slow-1);
    if (slow>=12 && quality>.65) {quality-=.15;width=0;slow=0;}
    if (canvas.clientWidth!==width || canvas.clientHeight!==height) {
      width=canvas.clientWidth; height=canvas.clientHeight;
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.5,Math.sqrt(1000000/(width*height)))*quality);
      renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    }

    const arc=Math.sin(Math.PI*p);
    const turn=p*p*(3-2*p);
    const angle=.16+Math.PI*2*(turn-.21*Math.sin(Math.PI*turn));
    const distance=Math.max(4.7,3.7/camera.aspect)+1.05*p-.14*arc;
    camera.position.set(Math.sin(angle)*distance,1.77+.23*arc,Math.cos(angle)*distance);
    camera.lookAt(0,1.44-.23*p,0);

    mixer.update(dt);
    // Mix absolute local poses without accumulating rotations between frames.
    controls.forEach((node,i)=>poses[i].copy(node.quaternion));
    const gesture=Math.sin(Math.PI*Math.max(0,(p-.75)/.25));
    neck.rotation.y+=.085*Math.sin(angle);
    elbow.rotation.x-=.21*gesture;
    hand.rotation.z-=.13*gesture;
    key.intensity=3-.55*arc;
    renderer.render(scene,camera);
    controls.forEach((node,i)=>node.quaternion.copy(poses[i]));
    figure.classList.add('live');
  };
}
