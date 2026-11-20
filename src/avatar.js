// Optional local GLB in metres, front facing +Z. Normalise its bounds so
// camera paths, contact point and chapter timing also fit replacement models.
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
  scene.add(new T.AmbientLight(0xfff8ee,1.8));
  const key = new T.DirectionalLight(0xfff4de,3);
  key.position.set(-3,6,4);
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
  const mixer = new T.AnimationMixer(asset.scene);
  mixer.clipAction(asset.animations.find(clip => clip.name==='Idle')).play();
  const neck=asset.scene.getObjectByName('Head');
  const wrist=asset.scene.getObjectByName('LeftSleeve');
  function platform(radius,height,y,color,roughness) {
    const geometry = new T.CylinderGeometry(radius,radius,height,96);
    const mesh = new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness,metalness:.17}));
    mesh.position.y = y;
    scene.add(mesh);
  }
  platform(1.15,.12,-.07,0xc9c3b7,.68);
  platform(1.13,.018,-.139,0xa52317,.45);
  platform(1.11,.045,-.166,0x69665e,.7);
  // Baked contact occlusion avoids a shadow-map pass for the figure.
  const shadow = new T.Mesh(new T.PlaneGeometry(1.8,.94),new T.MeshBasicMaterial({transparent:true,map:await new T.TextureLoader().loadAsync('assets/studio-shadow.png'),depthWrite:false}));
  shadow.rotation.x = -Math.PI/2; shadow.position.y = -.006; scene.add(shadow);
  let width=0,height=0,idleTime=0,quality=1,slow=0;
  return (p,dt) => {
    if (renderer.getContext().isContextLost()) return;
    slow=dt>.035?slow+1:Math.max(0,slow-1);
    if (slow>=12 && quality>.65) {quality-=.15;width=0;slow=0;}
    if (canvas.clientWidth!==width || canvas.clientHeight!==height) {
      width=canvas.clientWidth; height=canvas.clientHeight;
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.5,Math.sqrt(1000000/(width*height)))*quality);
      renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    }
    idleTime+=dt;
    const arc=Math.sin(Math.PI*p);
    const turn=p*p*(3-2*p);
    const angle=.16+Math.PI*2*(turn-.21*Math.sin(Math.PI*turn));
    const distance=Math.max(4.7,3.7/camera.aspect)+1.05*p-.14*arc;
    camera.position.set(Math.sin(angle)*distance,2.35+.25*arc,Math.cos(angle)*distance);
    camera.lookAt(0,1.44-.23*p,0);
    subject.rotation.z=.009*Math.sin(idleTime*1.35);
    subject.scale.y=1+.006*Math.sin(idleTime*1.65);
    mixer.update(dt);
    // Mix absolute local poses without accumulating rotations between frames.
    neck.rotation.y=.028*Math.sin(idleTime*.98)+.17*Math.sin(angle);
    wrist.rotation.x=-.32*Math.sin(Math.PI*Math.max(0,(p-.75)/.25));
    wrist.rotation.z=.022*Math.sin(idleTime*.98)-.19*Math.sin(Math.PI*Math.max(0,(p-.75)/.25));
    key.intensity=3-.55*arc;
    renderer.render(scene,camera);
    figure.classList.add('live');
  };
}
