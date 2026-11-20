// Offline authoring tool. Run with three@0.187.0 available to Node.
// Coordinates use metres, Y up and +Z forward. Ring profiles run bottom to top.
import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {writeFile} from 'node:fs/promises';
const scene=new T.Scene(), groups=[], buckets=new Map(), tau=2*Math.PI;
function pivot(name,x,y,z,parent=scene){
  const group=new T.Group();group.name=name;parent.add(group);group.position.set(x,y,z);groups.push(group);return group;
}
const body=pivot('Waist',0,1.06,0),head=pivot('Head',0,.91,0,body);
const arms=[-1,1].map(s=>pivot(s<0?'LeftSleeve':'RightSleeve',s*.39,.68,0,body));
const mat=(name,color,roughness,metalness=0)=>Object.assign(new T.MeshStandardMaterial({color,roughness,metalness}),{name});
const skin=mat('Warm sandstone skin',0xd69b73,.79),lip=mat('Lips and ear folds',0x935e4d,.8),hair=mat('Ink hair',0x16151a,.55),hairLight=mat('Hair facets',0x252229,.54);
const jersey=mat('Carbon rib knit',0x222124,.96),binding=mat('Charcoal binding',0x333135,.92),denim=mat('Washed black denim',0x39383b,.97),seam=mat('Denim seams',0x515054,.92),fray=mat('Worn warp threads',0x99918a,.96),black=mat('Leather',0x1a191b,.63);
const silver=mat('Brushed silver',0xacb2b7,.28,.55),lens=mat('Smoked visor',0x222b36,.21,.28),glint=mat('Lens reflection',0x52616a,.24,.3),ivory=mat('Bone embroidery',0xe9e5db,.9);
function put(parent,m,g){g=g.index?g.toNonIndexed():g;g.deleteAttribute('uv');const key=groups.indexOf(parent)+':'+m.uuid;if(!buckets.has(key))buckets.set(key,{parent,m,gs:[]});buckets.get(key).gs.push(g);}
function ell(parent,m,x,y,z,a,b,c,rot=0){const g=new T.SphereGeometry(1,16,12);g.scale(a,b,c);g.rotateZ(rot);g.translate(x,y,z);put(parent,m,g);}
const sp=(n,e)=>Math.sign(n)*Math.pow(Math.abs(n),e);
function loft(parent,m,rows,{n=28,e=.8,warp}={}){
 const v=[],idx=[];
 for(const [j,[y,x,z,a,b]] of rows.entries())for(let i=0;i<n;i++){
  const t=i*tau/n;let q=[x+a*sp(Math.sin(t),e),y,z+b*sp(Math.cos(t),e)];if(warp)q=warp(q,t,j);v.push(...q);
 }
 for(let j=1;j<rows.length;j++)for(let i=0;i<n;i++){const a=(j-1)*n+i,b=(j-1)*n+(i+1)%n;idx.push(a,b,a+n,b,b+n,a+n);}
 const k=(rows.length-1)*n;
 for(let i=1;i<n-1;i++)idx.push(0,i+1,i,k,k+i,k+i+1);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();put(parent,m,g);
}
function pipe(parent,m,pts,r=.008){const path=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p)));put(parent,m,new T.TubeGeometry(path,Math.max(6,pts.length*3),r,6,false));}
function ring(parent,m,x,y,z,a,b,r,rotation=0){let g=new T.TorusGeometry(1,r,6,20);g.scale(a,b,a);g.rotateY(rotation);g.translate(x,y,z);put(parent,m,g);}
function patch(parent,m,outline,z,depth,bevel=.012,bend=0){
 const shape=new T.Shape();outline.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
 const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:3,steps:1,bevelThickness:bevel,bevelSize:bevel});const pos=g.attributes.position;
 for(let i=0;i<pos.count;i++)pos.setZ(i,pos.getZ(i)+z-bend*pos.getX(i)**2);g.computeVertexNormals();put(parent,m,g);
}
// A tapered mandible and a broad brow make a square silhouette without box corners.
loft(head,skin,[[0,0,.02,.22,.22],[.05,0,.035,.32,.275],[.17,0,.025,.415,.325],[.32,0,0,.46,.35],[.61,0,-.01,.47,.36],[.73,0,-.015,.43,.34],[.81,0,-.03,.33,.29]],{e:.54});
ell(head,skin,0,.295,.352,.081,.094,.083);ell(head,skin,0,.259,.393,.077,.041,.050);
pipe(head,lip,[[-.112,.165,.348],[-.055,.152,.361],[.021,.15,.364],[.085,.161,.354]],.009);
for(const s of [-1,1]){ell(head,skin,s*.452,.33,-.005,.075,.115,.065);ell(head,lip,s*.503,.336,.016,.023,.063,.037);ring(head,silver,s*.499,.233,.022,.030,.036,.17);}
loft(head,hair,[[.29,0,-.10,.425,.245],[.50,0,-.08,.477,.31],[.71,0,-.045,.485,.345],[.85,0,-.04,.36,.30]]);
// Layer individually swept locks around temples and nape. Faces stay clear.
for(let i=0;i<29;i++){
 const t=.87+(tau-1.74)*i/28,x=Math.sin(t),z=Math.cos(t),f=Math.sin(i*7.3);
 const low=.19+.15*z+.105*f, r=.475;
 loft(head,i%4===0?hairLight:hair,[[low,x*(r+.018)+(.094+.055*f)*Math.cos(t),z*.37-.046-.070*Math.sin(t),.005,.006],[low+.10,x*(r+.025)+.035*Math.cos(t),z*.39-.032,.060,.050],[.48+.04*f,x*.45,z*.36-.03,.092,.079],[.66,x*.437,z*.32-.035,.093,.068]],{n:9});
}
for(let i=0;i<5;i++){const x=(i-2)*.16;loft(head,hair,[[.54+.055*Math.cos(i),x-.06,.343,.004,.008],[.62,x-.027,.342,.065,.04],[.684,x,.298,.085,.040]],{n:9});}
// Six-panel cap, bowed peak, piping and embroidered leaf mark.
loft(head,jersey,[[.64,0,-.015,.49,.385],[.68,0,-.024,.51,.401],[.78,0,-.036,.498,.396],[.91,0,-.046,.437,.354],[1.015,0,-.052,.30,.24],[1.071,0,-.05,.075,.07]],{e:.76});
for(let i=0;i<6;i++){const t=(i+.5)*tau/6;pipe(head,binding,[[.50*Math.sin(t),.70,.39*Math.cos(t)-.025],[.455*Math.sin(t),.88,.36*Math.cos(t)-.04],[.30*Math.sin(t),1,.24*Math.cos(t)-.05],[0,1.066,-.05]],.006);}
ell(head,black,0,1.076,-.05,.044,.021,.045);
const brim=new T.SphereGeometry(1,36,12);brim.scale(.516,.032,.33);brim.translate(0,.668,.337);
for(let i=0;i<brim.attributes.position.count;i++){const a=brim.attributes.position;a.setY(i,a.getY(i)-.18*a.getX(i)**2-.035*a.getZ(i));}brim.computeVertexNormals();put(head,black,brim);
for(let i=-1;i<=1;i++)patch(head,ivory,[[i*.036,.78],[i*.062-.016,.811],[i*.085,.854+(i===0?.027:0)],[i*.063+.017,.814]],.362,.008,.002);
pipe(head,ivory,[[-.069,.766,.367],[0,.764,.378],[.069,.766,.367]],.007);
// Rear adjuster and top-stitched visor edge.
patch(head,black,[[-.175,.658],[-.175,.70],[-.12,.742],[0,.755],[.12,.742],[.175,.70],[.175,.658]],-.415,.013,.006);
pipe(head,binding,[[-.18,.667,-.395],[0,.67,-.425],[.18,.667,-.395]],.019);
for(const x of [-.091,-.043,.005,.053])ell(head,silver,x,.67,-.434,.006,.006,.004);
pipe(head,binding,Array.from({length:19},(_,i)=>{const a=(i-9)*.144;const x=.505*Math.sin(a),z=.337+.313*Math.cos(a);return [x,.672-.18*x*x-.035*z,z]}),.004);
// Continuous wraparound sports frame, inset smoked lenses, temple arms.
patch(head,black,[[-.446,.568],[-.35,.595],[0,.581],[.35,.595],[.446,.568],[.427,.427],[.354,.351],[.14,.34],[.061,.392],[0,.436],[-.061,.392],[-.14,.34],[-.354,.351],[-.427,.427]],.365,.038,.021,.77);
for(const s of [-1,1]){
 const points=[[.032,.552],[.326,.568],[.416,.547],[.391,.438],[.337,.379],[.159,.369],[.092,.423],[.042,.45]];
 patch(head,lens,points.map(([x,y])=>[s*x,y]),.412,.007,.009,.80);
 pipe(head,glint,[[s*.13,.545,.413],[s*.27,.548,.37],[s*.347,.541,.328]],.006);
 pipe(head,black,[[s*.42,.531,.264],[s*.465,.525,.16],[s*.474,.49,-.09],[s*.46,.419,-.17]],.029);
}
// Tank neck and armholes come from separate shaped hems over a single upper body.
// Continuous garment/skin boundary: each vertical slice shares the seam vertex.
const chest=[[.025,.307,.185],[.09,.334,.198],[.26,.323,.197],[.45,.36,.208],[.59,.394,.215],[.67,.402,.192],[.732,.337,.166],[.767,.248,.144],[.79,.161,.126],[.96,.14,.13]];
function profile(y,t){
 const k=chest.findIndex(row=>row[0]>=y-.000001), hi=chest[Math.max(0,k)],lo=chest[Math.max(0,k-1)];
 const u=hi===lo?0:(y-lo[0])/(hi[0]-lo[0]);
 const rx=lo[1]+u*(hi[1]-lo[1]),rz=lo[2]+u*(hi[2]-lo[2]);
 return [rx*sp(Math.sin(t),.80),y,rz*sp(Math.cos(t),.80)];
}
function hem(t){return .768-.216*Math.max(0,Math.cos(t))**8-.092*Math.max(0,-Math.cos(t))**8-.224*Math.abs(Math.sin(t))**10;}
function surfaceBand(material,levels){
 const points=[],indices=[],n=64;
 levels.forEach((level,j)=>{for(let i=0;i<n;i++){
   const t=i*tau/n;points.push(...profile(level(t),t));
   if(j){const a=(j-1)*n+i,b=(j-1)*n+(i+1)%n;indices.push(a,b,a+n,b,b+n,a+n);}
 }});
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();put(body,material,g);
}
surfaceBand(jersey,[()=>.025,()=>.09,()=>.26,()=>.45,...[.25,.50,.75,1].map(f=>t=>.45+f*(hem(t)-.45))]);
surfaceBand(skin,[hem,...[.15,.35,.55,.75,1].map(f=>t=>hem(t)+f*(.79-hem(t))),()=>.96]);
pipe(body,binding,Array.from({length:65},(_,i)=>{const t=i*tau/64;return profile(hem(t),t);}),.009);
for(const [i,s] of [-1,1].entries()){
 const arm=arms[i];
 loft(arm,skin,[[-.636,s*.108,.084,.068,.085],[-.49,s*.147,.034,.088,.091],[-.38,s*.166,-.007,.11,.105],[-.29,s*.146,-.028,.092,.091],[-.15,s*.121,-.006,.124,.123],[.002,s*.066,.003,.145,.14],[.086,s*.031,-.003,.108,.108],[.114,s*.006,0,.046,.061]],{e:.91});
 ell(arm,skin,s*.101,-.694,.089,.088,.112,.073,s*.08);
 for(let j=0;j<4;j++)ell(arm,skin,s*(.050+j*.029),-.753+.014*Math.abs(1-j),.123-.008*j,.020,.049,.027);
 ell(arm,skin,s*.043,-.692,.148,.034,.067,.032,-s*.36);
 loft(arm,black,[[-.612,s*.113,.077,.082,.096],[-.55,s*.129,.063,.089,.101]]);
 if(s===1){ell(arm,silver,s*.135,-.582,.16,.062,.061,.023);ell(arm,lens,s*.135,-.582,.182,.047,.046,.009);pipe(arm,ivory,[[.11,-.563,.193],[.135,-.582,.194],[.149,-.59,.194]],.004);}
 else for(const y of [-.619,-.55,-.52])loft(arm,silver,[[y,s*.13,.06,.089,.099],[y+.014,s*.13,.06,.09,.099]]);
 ring(arm,silver,s*.105,-.738,.142,.016,.013,.29);
}
// Dropped crotch, twisted denim folds, contrasting seams and torn knee panels.
const legs=pivot('Denim',0,0,0);
loft(legs,denim,[[.77,0,-.005,.295,.168],[.89,0,0,.354,.194],[1.08,0,0,.326,.201],[1.13,0,0,.30,.18]]);
loft(legs,black,[[1.044,0,0,.33,.207],[1.13,0,0,.318,.201]],{e:.72});
patch(legs,silver,[[-.065,1.056],[.065,1.056],[.065,1.12],[-.065,1.12]],.211,.011,.006);
patch(legs,black,[[-.046,1.07],[.044,1.07],[.044,1.108],[-.046,1.108]],.23,.003,.002);
for(const s of [-1,1]){
 const rows=[[.085,.22,.209],[.122,.259,.235],[.20,.244,.224],[.238,.223,.211],[.29,.251,.229],[.39,.232,.215],[.48,.244,.226],[.58,.215,.20],[.65,.233,.207],[.79,.21,.20],[.94,.178,.186],[1.032,.15,.16]];
 loft(legs,denim,rows.map(([y,a,b])=>[y,s*(.245-.074*y),.012*Math.cos(y*8),a,b]),{n:28,e:.73,warp:(q,t,j)=>[q[0]+.009*Math.sin(t*5+j),q[1]+(j===0?.007:.027)*Math.sin(t*2+j*.8+s),q[2]+.011*Math.sin(3*t+j*.42)]});
 pipe(legs,seam,[[s*.466,.13,.065],[s*.464,.25,.041],[s*.458,.43,.048],[s*.427,.64,.026],[s*.385,.83,.017],[s*.323,1.01,.019]],.006);
 // Angular folds catch the key light; raised seams run around the cuffs.
 for(const [y,tilt] of [[.176,.047],[.275,-.047],[.626,.043]]){
   const x=s*(.245-.074*y);
   pipe(legs,seam,[[x-s*.182,y-tilt,.150],[x-s*.11,y-tilt*.55,.209],[x+s*.045,y+.005,.225],[x+s*.145,y+tilt,.186]],.006);
 }
 for(const [y,w] of [[.53,.117],[.485,.067]]){
  const x=s*.246;const z=.229;
  patch(legs,lip,[[x-w,y],[x-w*.5,y+.013],[x+w,y+.016],[x+w*.65,y-.014],[x-w*.38,y-.018]],z,.005,.003);
  for(let k=0;k<3;k++)pipe(legs,fray,[[x-w+k*.009,y+.011-k*.01,z+.009],[x+.025,y+.008-k*.012,z+.015],[x+w-k*.018,y+.014-k*.008,z+.009]],.0035);
 }
 // Rear patch pocket with folded top and inset stitching.
 pipe(legs,seam,[[s*.06,1.006,-.198],[s*.09,.848,-.211],[s*.178,.809,-.224],[s*.263,.865,-.208],[s*.277,1.004,-.188],[s*.06,1.006,-.198]],.009);
 loft(legs,black,[[.005,s*.25,.09,.203,.286],[.045,s*.25,.091,.22,.287],[.101,s*.246,.063,.205,.25],[.155,s*.243,0,.16,.18]],{e:.58});
}
for(const side of [-1,1]) {
 const x=side*.23;
 pipe(legs,binding,[[x,1.036,.188],[x,1.082,.196],[x,1.139,.182]],.018);
 pipe(legs,seam,[[side*.19,1.028,.178],[side*.238,.973,.183],[side*.328,.93,.154]],.008);
}
for(let i=0;i<17;i++){const t=i/16;ring(legs,silver,.217+.183*t+.064*Math.sin(t*Math.PI),1.07-.245*Math.sin(t*Math.PI)-.07*t,.174-.221*t,.019,.026,.22,i%2?.9:.12);}
for(const {parent,m,gs} of buckets.values()){
 const geometry=mergeVertices(mergeGeometries(gs),.00001);
 if(m===denim || m===lens){
   const position=geometry.attributes.position,colors=[];
   for(let i=0;i<position.count;i++){
     const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
     if(m===denim){
       const wash=.78+.13*Math.sin(19*y+3*x)+.09*Math.sin(33*y-12*x+7*z);
       colors.push(wash*.95,wash*.97,wash);
     }else{
       const sky=.38+.62*Math.max(0,Math.min(1,(y-.36)/.20));
       colors.push(sky*.86,sky*.97,sky);
     }
   }
   geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));m.vertexColors=true;
 }
 const mesh=new T.Mesh(geometry,m);mesh.name=m.name;parent.add(mesh);
}
// glTF stores rotations as unit quaternions.
const idle=new T.AnimationClip('Idle',6.4,[body,head,...arms].map((node,i)=>{
 const axis=new T.Vector3(...(i===1?[0,1,0]:[0,0,1]));const amp=[.012,.032,.027,-.023][i];
 return new T.QuaternionKeyframeTrack(node.name+'.quaternion',[0,1.6,3.2,4.8,6.4],[0,amp,0,-amp,0].flatMap(a=>new T.Quaternion().setFromAxisAngle(axis,a).toArray()));
}));
globalThis.FileReader=class{async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer();this.onloadend?.();}};
const bytes=await new GLTFExporter().parseAsync(scene,{binary:true,animations:[idle]});
await writeFile(process.argv[2],Buffer.from(bytes));
