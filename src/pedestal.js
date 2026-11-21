import { ShadowMaterial } from './vendor/shadow-material.js';
import * as T from './vendor/studio.js';

// Each horizontal ring is machined from the same radial profile.
// The cap and side use separate vertices so the flat deck retains its normal.
function turnedMesh(rows,material){
  const height=rows.at(-1)[0]-rows[0][0];
  const geometry=new T.CylinderGeometry(1,1,height,112,rows.length-1);
  const pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++){
    const ring=Math.round((pos.getY(i)/height+.5)*(rows.length-1));
    const [y,radius]=rows[ring];
    pos.setXYZ(i,pos.getX(i)*radius,y,pos.getZ(i)*radius);
  }
  geometry.computeVertexNormals();
  const mesh=new T.Mesh(geometry,material);
  mesh.receiveShadow=true;
  mesh.castShadow=true;
  return mesh;
}

// Catch only the light blocked by the meshes. The rest of the floor remains
// transparent so the real shadow can lie across each section's paper color.
function studioFloor(){
  const material=new ShadowMaterial({opacity:.31,depthWrite:false});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 floorPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n floorPoint=position.xy;');
    shader.fragmentShader='varying vec2 floorPoint;\n'+shader.fragmentShader.replace('#include <tonemapping_fragment>',
      'gl_FragColor.a *= 1.0-smoothstep(1.12,2.15,length(floorPoint));\n#include <tonemapping_fragment>');
  };
  const floor=new T.Mesh(new T.PlaneGeometry(4.4,4.4),material);
  floor.rotation.x=-Math.PI/2;
  floor.position.y=-.305;
  floor.receiveShadow=true;
  floor.renderOrder=-1;
  return floor;
}

export async function buildPedestal(scene){
  const loader=new T.TextureLoader();
  const [environment,grain,signature]=await Promise.all(['softboxes.jpg','brushed.png','signature.svg'].map(file=>loader.loadAsync('assets/lighting/'+file)));
  environment.mapping=303; // Three.js EquirectangularReflectionMapping
  environment.colorSpace=T.SRGBColorSpace;
  scene.environment=environment;
  scene.environmentIntensity=.80;
  const graphite=new T.MeshStandardMaterial({color:0x393535,roughness:.52,metalness:.65,roughnessMap:grain});
  const trim=new T.MeshStandardMaterial({color:0x90857d,roughness:.29,metalness:.88});
  const base=new T.MeshStandardMaterial({color:0x292427,roughness:.41,metalness:.57});
  const inlay=new T.MeshStandardMaterial({color:0x901815,emissive:0xec1810,emissiveIntensity:.72,roughness:.28,metalness:.42});
  scene.add(
    studioFloor(),
    turnedMesh([[-.303,1.125],[-.299,1.143],[-.287,1.154],[-.239,1.154],[-.228,1.145],[-.222,1.125]],base),
    turnedMesh([[-.224,1.089],[-.217,1.10],[-.208,1.10],[-.204,1.087]],trim),
    turnedMesh([[-.209,1.086],[-.204,1.096],[-.193,1.096],[-.189,1.088]],inlay),
    turnedMesh([[-.193,1.082],[-.187,1.096],[-.178,1.103],[-.026,1.103],[-.014,1.098],[-.006,1.088],[-.002,1.07]],graphite)
  );
  signature.colorSpace=T.SRGBColorSpace;
  const badge=new T.Mesh(new T.CylinderGeometry(1.104,1.104,.136,44,1,true,-.35,.94),
    new T.MeshStandardMaterial({map:signature,transparent:true,depthWrite:false,roughness:.45,metalness:.3}));
  badge.position.y=-.103;
  scene.add(badge);
  return environment;
}
