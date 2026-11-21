// Offline Three.js authoring source. Profiles are measured in pixels of the
// approved front plate. Depth is sculpted independently, positive towards camera.
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {execFileSync} from 'node:child_process';
import {readFile, writeFile} from 'node:fs/promises';
const scene=new T.Scene(),scale=.0021, tau=2*Math.PI;
// Keep the original garment UVs while sculpting the vinyl casting in world space.
function world([x,y,z]){
 const t=Math.min(1,Math.max(0,(575-y)/42));
 const head=t*t*(3-2*t);
 const width=1+.25*head;
 const height=(1318-y)*.88+Math.max(0,545-y)*.29;
 return new T.Vector3((x-540)*width*scale,height*scale,z*(1+.19*head)*scale);
}
const bones=[], names={}, anchors=[];
function bone(name,anchor,parent){
 const b=new T.Bone(); b.name=name;
 const i=bones.length;anchors.push(world(anchor));bones.push(b);names[name]=i;
 b.position.copy(anchors[i]);if(parent){b.position.sub(anchors[names[parent]]);bones[names[parent]].add(b);}else scene.add(b);
 return name;
}
bone('Hips',[540,802,0]);bone('Chest',[540,759,0],'Hips');bone('Neck',[537,565,0],'Chest');bone('Head',[536,531,0],'Neck');
for(const s of [-1,1]){
 const side=s<0?'L':'R';
 bone('Thigh'+side,[539+s*72,859,0],'Hips');
 bone('Knee'+side,[539+s*101,1040,2],'Thigh'+side);
 bone('Foot'+side,[539+s*112,1250,10],'Knee'+side);
 bone('Shoulder'+side,[540+s*145,592,0],'Chest');
 bone('Elbow'+side,[540+s*184,694,6],'Shoulder'+side);
 bone('Hand'+side,[540+s*204,804,36],'Elbow'+side);
}
const mats={},batches=new Map();
function material(name,color,roughness,metalness=0,photo=false){
 const m=new T.MeshStandardMaterial({color,roughness,metalness});m.name=name;m.userData.plate=photo;mats[name]=m;return m;
}
const skin=material('Satin apricot vinyl',0xe2a077,.49),mouth=material('Warm lip crease',0x713e31,.74),hair=material('Soft black hair',0x201b1a,.52),ridge=material('Hair ridges',0x302a27,.53);
const cap=material('Cotton twill',0xffffff,.9,0,true),rib=material('Ribbed jersey',0xffffff,.92,0,true),jeans=material('Indigo black denim',0xffffff,.93,0,true),visor=material('Smoke glass',0xc1c3c4,.26,.09,true),leather=material('Black leather',0x211e20,.52),rubber=material('Rubber',0x282426,.84),silver=material('Pewter',0xbfc2c3,.24,.58),stitch=material('Faded thread',0x76695d,.93),black=material('Black binding',0x1b1819,.62),ivory=material('Embroidery',0xf3eee5,.79);
const clothBack=new Map([[cap,material('Twill side panels',0x312c2b,.91)],[jeans,material('Denim reverse',0x302b2a,.94)],[rib,material('Jersey back',0x231f20,.93)]]);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const signed=(v,p)=>Math.sign(v)*Math.pow(Math.abs(v),p);
function weights(joint,y){
 if(typeof joint==='string' && joint.startsWith('Leg')){
  const side=joint.at(-1);
  const thigh=clamp((y-827)/83),knee=clamp((y-985)/105),foot=clamp((y-1194)/74);
  return [[names.Hips,names['Thigh'+side],names['Knee'+side],names['Foot'+side]],
          [1-thigh,thigh-knee,knee-foot,foot]];
 }
 if(Array.isArray(joint)){
  const [shoulder,elbow,wrist]=joint;
  const e=clamp((y-661)/67),w=clamp((y-779)/43);
  return [[names[shoulder],names[elbow],names[wrist],0],[1-e,e*(1-w),w,0]];
 }
 return [[names[joint],0,0,0],[1,0,0,0]];
}
function submit(g,m,joint,uv){
 const pos=g.attributes.position, ids=[],ws=[],tex=[];
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
  const [j,w]=weights(joint,y);ids.push(...j);ws.push(...w);
  const [u,v]=uv?uv(x,y,z,i):[x,y];tex.push(u/1086,v/1448);
  const a=world([x,y,z]);pos.setXYZ(i,a.x,a.y,a.z);
 }
 g.setAttribute('uv',new T.Float32BufferAttribute(tex,2));
 g.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(ws,4));
 g.deleteAttribute('normal');g.computeVertexNormals();
 const triangles=g.index?g.toNonIndexed():g;
 const reverse=clothBack.get(m);
 if (!reverse) {batch(m,triangles);return;}
 // Split on triangle boundaries. No UV interpolation across separate charts.
 const indices=[[],[]],position=triangles.attributes.position;
 for(let i=0;i<position.count;i+=3){
  const z=(position.getZ(i)+position.getZ(i+1)+position.getZ(i+2))/(3*scale);
  indices[z>(m===cap?52:m===rib?35:46)?0:1].push(i,i+1,i+2);
 }
 indices.forEach((list,side)=>{
  if(!list.length)return;
  const part=triangles.clone();part.setIndex(list);
  if(side){
    const uv=part.attributes.uv;
    for(let i=0;i<position.count;i++){
      const x=position.getX(i)/scale,y=position.getY(i)/scale,z=position.getZ(i)/scale;
      uv.setXY(i,(x+z*.72)/80,y/80);
    }
  }
  batch(side?reverse:m,part.toNonIndexed());
 });
}
function batch(m,g){
 if(!batches.has(m))batches.set(m,[]);
 batches.get(m).push(g);
}
// Smooth horizontal profiles, with continuously varying elliptical/squared section.
function rowsAt(rows,h){
 let i=1;while(i<rows.length-1 && rows[i][0]<h)i++;
 const a=rows[i-1],b=rows[i],p=rows[Math.max(0,i-2)],q=rows[Math.min(rows.length-1,i+1)];
 const t=clamp((h-a[0])/(b[0]-a[0])),u=t*t,v=u*t;
 return a.map((n,k)=>k===0?h:(2*v-3*u+1)*n+(v-2*u+t)*(b[k]-p[k])*(b[0]-a[0])/(b[0]-p[0])+(-2*v+3*u)*b[k]+(v-u)*(q[k]-n)*(b[0]-a[0])/(q[0]-a[0]));
}
function grid(m,joint,n,r,fn,uv){
 const v=[],idx=[];for(let j=0;j<=r;j++)for(let i=0;i<=n;i++)v.push(...fn(i/n,j/r));
 for(let j=0;j<r;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i;idx.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(idx);submit(g,m,joint,uv);
}
function form(m,b,rows,{e=.85,n=48,r=26,warp,uv}={}){
 grid(m,b,n,r,(u,v)=>{
 const [y,x,z,a,d]=rowsAt(rows,rows[0][0]+v*(rows.at(-1)[0]-rows[0][0])),t=u*tau;
 const point=[x+Math.max(.1,a)*signed(Math.sin(t),e),y,z+Math.max(.1,d)*signed(Math.cos(t),e)];
 return warp?warp(point,t,v):point;
 },uv);
}
function oval(m,b,x,y,z,a,h,d){
 form(m,b,[-1,-.92,-.7,-.38,0,.38,.7,.92,1].map(t=>[y+t*h,x,z,a*Math.sqrt(1-t*t),d*Math.sqrt(1-t*t)]),{e:1,n:26,r:16});
}
function line(m,b,points,r){
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
 const g=new T.TubeGeometry(curve,Math.max(10,points.length*3),r,8,false);
 // Y inversion in the authoring transform reverses winding of Three primitives.
 const ix=g.index.array;for(let i=0;i<ix.length;i+=3)[ix[i],ix[i+2]]=[ix[i+2],ix[i]];
 submit(g,m,b);
}
function loop(m,b,x,y,z,a,h,r,tilt=0){
 line(m,b,Array.from({length:21},(_,i)=>{const t=tau*i/20;return [x+a*Math.cos(t)*Math.cos(tilt),y+h*Math.sin(t),z+a*Math.cos(t)*Math.sin(tilt)];}),r);
}
const H='Head',C='Chest',P='Hips';
// Rounded chin, long cheek planes and full occiput.
form(skin,H,[[185,538,-5,12,12],[228,538,-6,150,133],[286,537,-3,183,151],[376,536,2,190,156],[453,535,3,183,151],[497,536,8,172,143],[527,536,12,151,126],[541,537,13,112,95],[546,538,5,10,12]],{e:.57,n:72,r:46});
oval(skin,'Neck',535,555,0,61,75,61);
for(const s of [-1,1]){oval(skin,H,536+s*187,416,4,28,48,28);oval(mouth,H,536+s*202,419,11,9,23,10);}
form(skin,H,[[390,529,151,5,5],[408,529,157,15,17],[426,529,170,24,25],[440,529,168,22,20],[450,529,157,10,9]],{e:.85,n:36,r:18});
line(mouth,H,[[488,475,156],[501,481,157],[528,486,157],[551,484,157],[569,478,157],[577,471,156]],2.7);
// Layered hair is swept along curved spines. The width and depth taper separately.
function lock(points,width,depth,azimuth){
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
 grid(hair,H,26,30,(u,v)=>{
 const p=curve.getPoint(v),t=u*tau,tangent=curve.getTangent(v);
 const outward=new T.Vector3(Math.sin(azimuth),0,Math.cos(azimuth));
 const along=new T.Vector3().crossVectors(tangent,outward).normalize();
 const normal=new T.Vector3().crossVectors(along,tangent).normalize();
 const taper=Math.pow(Math.sin(Math.PI*(.09+.91*v)),.92);
 const groove=.93+.07*Math.cos(t*5+.5*v);
 p.addScaledVector(along,width*taper*Math.cos(t));
 p.addScaledVector(normal,depth*taper*Math.sin(t)*groove);
 return p.toArray();
 });hair.side=T.DoubleSide;
}
form(hair,H,[[189,535,-21,100,92],[266,536,-28,206,153],[372,536,-35,206,137],[463,538,-55,175,105],[515,536,-81,120,53],[548,535,-83,30,22]],{e:.71});
// Staggered nape locks follow the skull; separate swept wings break the
// silhouette at the temples. Tips lift away from the cheeks.
for(let i=0;i<19;i++){
 const t=1.30+(tau-2.60)*i/18,sx=Math.sin(t),cz=Math.cos(t);
 const tip=482-48*cz+14*Math.sin(i*1.7);
 lock([[536+sx*167,249,cz*130-20],[536+sx*192,328,cz*148-20],[536+sx*186,tip-42,cz*145-26],[536+sx*(198+11*Math.cos(i)),tip,cz*152-36]],39,18,t);
}
for(const s of [-1,1]){
 for(const [start,end,height,width] of [[142,276,335,36],[163,254,394,35],[165,264,432,33],[154,226,484,29]]){
  lock([[536+s*start,height-106,72],[536+s*(start+23),height-57,90],[536+s*(end-30),height+5,81],[536+s*(end+7),height-17,69]],width,16,s*.82);
 }
 lock([[536+s*158,277,109],[536+s*173,323,121],[536+s*177,390,108],[536+s*168,451,88]],22,14,s*.85);
}
for(const [x,end,y] of [[420,321,324],[466,365,315],[505,405,307],[552,454,333],[615,584,311],[651,603,344],[674,717,320]]){
 lock([[x,224,118],[x+4,258,154],[.62*x+.38*end,296,179],[end,y,184]],32,12,0);
}
// Sewn cap crown and bowed peak. Rear panels use a clean swatch of the same twill.
const capUV=(x,y,z)=>z>12?[clamp(x,368,710),clamp(y,107,229)]:[394+.13*(x-535),168+.17*(y-160)];
form(cap,H,[[68,542,-14,6,5],[77,540,-15,76,66],[98,541,-16,143,110],[136,541,-19,193,146],[192,541,-18,218,158],[247,541,-16,228,164],[275,541,-14,231,167],[283,541,-14,228,163]],{e:.8,uv:capUV});
oval(black,H,545,67,-13,31,12,24);
form(black,H,[[222,525,119,50,33],[229,525,126,158,85],[242,525,141,211,101],[253,524,148,231,106],[262,523,149,232,105],[269,523,145,208,90],[273,523,137,92,48]],{e:.8,n:64,r:20,warp:([x,y,z])=>[x,y+.00062*(x-526)**2,z]});
for(const a of [-2.5,-1.6,1.5,2.5])line(black,H,[[542,73,-13],[541+145*Math.sin(a),104,-15+110*Math.cos(a)],[541+208*Math.sin(a),172,-18+153*Math.cos(a)],[541+229*Math.sin(a),272,-14+166*Math.cos(a)]],1.5);
// Back opening, adjustment band and eyelets follow the dome curvature.
oval(black,H,541,260,-178,59,23,6);
line(leather,H,[[478,272,-171],[506,272,-181],[541,272,-185],[575,271,-181],[605,270,-170]],5);
for(let i=0;i<5;i++)oval(silver,H,514+10*i,272,-188,1.8,1.8,1.4);
// Shield is a curved surface between measured upper and lower contours,
// with a continuous frame, rounded sides and ear stems.
const glassTop=[[0,347,346],[.06,328,341],[.16,324,350],[.5,322,323],[.84,318,326],[.94,322,326],[1,342,342]];
const bottom=[[0,349],[.045,403],[.11,426],[.24,434],[.37,433],[.43,420],[.485,391],[.51,385],[.54,393],[.61,426],[.69,431],[.88,422],[.95,410],[1,347]];
function lerpTable(arr,t){return rowsAt(arr,t)[1];}
function glass(u,v){
 const x=351+365*u,top=lerpTable(glassTop,u),y=top+(lerpTable(bottom,u)-top)*v;
 return [x,y,184-.00120*(x-535)**2+6*Math.sin(Math.PI*v)];
}
grid(visor,H,64,14,glass,(x,y)=>[clamp(x,357,710),clamp(y,329,428)]);visor.side=T.DoubleSide;
const edge=[];for(let i=0;i<=48;i++)edge.push(glass(i/48,0));for(let i=48;i>=0;i--)edge.push(glass(i/48,1));edge.push(edge[0]);line(black,H,edge,6);
for(const s of [-1,1])line(black,H,[[534+s*178,342,120],[534+s*192,345,94],[534+s*195,365,17],[534+s*194,382,-26]],7);
// Torso and tank share a shaped neckline. The shoulders bridge over the back.
form(skin,C,[[551,537,0,49,46],[563,537,0,117,58],[579,537,0,151,60],[605,537,0,145,64],[674,537,0,115,64],[768,537,0,106,62]],{e:.82});
function neckline(t){return 560+61*Math.max(0,Math.cos(t))**6+22*Math.max(0,-Math.cos(t))**5+92*Math.abs(Math.sin(t))**10;}
grid(rib,C,64,30,(u,v)=>{
 const t=tau*u,y=neckline(t)*(1-v)+791*v;
 const rx=118+9*Math.sin(v*Math.PI)+4*Math.cos(v*9),rz=74+6*Math.sin(v*Math.PI)+2*Math.sin(v*18+2*t);
 return [538+rx*signed(Math.sin(t),.73),y,rz*signed(Math.cos(t),.73)];
},(x,y,z)=>z>10?[clamp(x,429,651),clamp(y,624,781)]:[498+(x-538)*.31,699+(y-675)*.45]);
line(black,C,Array.from({length:65},(_,i)=>{const t=tau*i/64;return [538+122*signed(Math.sin(t),.73),neckline(t),74*signed(Math.cos(t),.73)];}),2.3);
for(const s of [-1,1]){
 const side=s<0?'L':'R',arm=['Shoulder'+side,'Elbow'+side,'Hand'+side],hand=arm[2];
 const X=n=>538+s*n;
 form(skin,arm,[[562,X(125),0,14,13],[581,X(147),0,38,40],[612,X(165),0,44,48],[641,X(172),3,44,48],[670,X(179),5,39,39],[689,X(185),10,39,40],[714,X(191),17,44,44],[750,X(200),23,43,43],[790,X(204),38,36,35],[822,X(205),43,34,33]],{e:.93,n:38,r:34});
 form(skin,hand,[[805,X(205),43,29,28],[829,X(204),45,40,34],[857,X(202),49,46,35],[883,X(201),54,44,32],[904,X(196),58,35,26],[921,X(192),58,19,17]],{e:.78});
 for(let j=0;j<4;j++){const dx=176+j*13;form(skin,hand,[[867,X(dx),66,9,12],[886,X(dx+6),76,12,14],[905,X(dx+2),82,12,12],[919-j*2,X(dx-8),85,10,10],[932-j*3,X(dx-16),82,3,4]],{n:20,r:16});}
 form(skin,hand,[[843,X(176),63,14,14],[858,X(163),76,17,17],[877,X(155),83,13,14],[893,X(154),84,7,8]],{n:24,r:16});
 for(const [yy,hh,m] of (s<0?[[760,14,silver],[787,20,leather],[808,5,silver]]:[[779,26,leather]])){
 form(m,arm,[[yy-hh/2,X(204),36,39,38],[yy-hh/2+2,X(204),36,44,42],[yy+hh/2-2,X(204),36,44,42],[yy+hh/2,X(204),36,39,38]],{n:36,r:8});
 }
 if(s>0){oval(silver,arm,X(212),787,78,26,29,9);oval(black,arm,X(212),787,86,21,24,4);
 for(let i=0;i<12;i++){const t=tau*i/12;line(ivory,arm,[[X(212)+17*Math.sin(t),787+19*Math.cos(t),91],[X(212)+15*Math.sin(t),787+16*Math.cos(t),91]],1);}
 line(silver,arm,[[X(202),778,92],[X(212),787,93],[X(222),783,92]],1.5);}
 else for(const dx of [-25,0,25])oval(silver,arm,X(204)+dx,789,72,4,4,4);
 loop(silver,hand,X(203),890,84,12,6,3,.32);
}
// Inset UV boundaries follow the flared outline, keeping studio background
// and the hanging charm out of the garment's colour map at grazing angles.
function denimFront(x,y,s){
 const left=[[822,421],[884,406],[961,373],[1016,340],[1056,329],[1103,330],[1137,305],[1160,295],[1186,305],[1214,309],[1245,302],[1261,305],[1273,313]];
 const outer=rowsAt(left,clamp(y,823,1264))[1]+8;
 const mid=538-8*Math.max(0,(y-973)/300);
 const mirrored=s<0?x:1077-x;
 const sample=clamp(mirrored,outer,mid-5);
 const u=s<0?sample:1077-sample;
 return u>597 && u<674 && y>845 && y<976 ? [572+(u-597)*.18,905+(y-845)*.32] : [u,clamp(y,832,1245)];
}
// Wide legs with compressed ankle folds. Hem heights follow the shoe vamp.
form(jeans,P,[[790,539,0,106,73],[810,538,0,129,81],[863,539,0,142,88],[906,539,-6,138,78],[948,539,-13,94,61]],{uv:(x,y,z)=>z>20?[x,y]:[478+.18*(x-539),920+.2*(y-840)]});
for(const s of [-1,1]){
 const cx=539+s*112;
 const leg=s<0?'LegL':'LegR',foot=s<0?'FootL':'FootR';
 const rows=[[822,539+s*62,0,60,66],[884,539+s*77,2,78,78],[961,539+s*90,0,90,84],[1016,539+s*99,7,103,90],[1056,539+s*103,6,105,87],[1103,539+s*104,-2,99,76],[1137,539+s*115,1,116,86],[1160,539+s*113,6,118,91],[1186,539+s*113,0,104,77],[1214,cx,-4,106,87],[1245,cx,1,116,94],[1261,cx,1,111,91],[1273,cx,2,101,86]];
 form(jeans,leg,rows,{n:60,r:61,e:.76,warp:([x,y,z],t,v)=>{
 const lower=clamp((y-1050)/120),dx=(x-cx)/115;
 return [x+3*Math.sin(t*3+v*10),y+lower*(14*Math.sin(2*t+v*15)+12*dx*s),z+lower*8*Math.sin(2*t+v*21)];
 },uv:(x,y,z)=>z>20?denimFront(x,y,s):[468+18*Math.sin((x-cx)/80),947+16*Math.sin(y/50)]});
 // Stitched, five-sided rear pockets lie against the seat.
 const px=539+s*77;
 line(stitch,leg,[[px-43,852,-67],[px-37,917,-78],[px,935,-81],[px+41,914,-74],[px+43,850,-66]],1.5);
 for(let j=0;j<5;j++){const y=1027+j*5+(s>0?7:0);const pts=[];
 for(let i=0;i<9;i++){const u=i/8,x=cx+(u-.5)*(91-7*j);pts.push([x,y+4*Math.sin(Math.PI*u),6+91*Math.sqrt(1-((x-cx)/110)**2)]);}
 line(j%2?stitch:ivory,leg,pts,1.1);}
 form(rubber,foot,[[1266,cx,27,96,109],[1284,cx,34,102,126],[1308,cx,34,103,126],[1316,cx,34,94,120]],{e:.55});
 line(black,foot,Array.from({length:45},(_,i)=>{
 const a=tau*i/44;return [cx+101*signed(Math.sin(a),.6),1290,34+124*signed(Math.cos(a),.6)];
 }),1.8);
 // A low welt separates the rubber outsole from the domed leather toe.
 form(rubber,foot,[[1286,cx,35,99,124],[1289,cx,35,104,128],[1294,cx,35,104,128],[1298,cx,35,101,126]],{e:.59,r:8});
 form(leather,foot,[[1202,cx,22,48,54],[1221,cx,27,79,86],[1247,cx,33,94,110],[1278,cx,35,99,121],[1290,cx,35,99,122]],{e:.65});
}
form(leather,P,[[785,538,0,116,76],[793,538,0,126,84],[819,538,0,129,84],[826,538,0,125,81]],{e:.63,n:56});
line(silver,P,[[513,793,86],[556,793,86],[560,796,86],[558,826,86],[553,829,86],[510,827,86],[508,822,86],[509,798,86],[513,793,86]],3.5);
line(silver,P,[[502,810,89],[522,810,90]],2.5);
for(const x of [462,603])form(jeans,P,[[784,x,70,6,7],[792,x,73,9,8],[827,x,73,9,8],[837,x,73,7,6]],{uv:(x,y)=>[464,y]});
for(let i=0;i<13;i++){const t=i/12;loop(silver,P,610+40*t,839+91*t,77+10*t,5.4,8.3,2.1,.3+(i%2)*.8);}
oval(silver,P,650,943,91,15,16,11);oval(silver,P,650,956,92,9,8,7);
for(const s of [-1,1])oval(black,P,650+s*6,944,101,4,4.5,2.3);

for(const s of [-1,1]){
 const x=542+s*88;oval(black,H,x,107,99,7,3,4);
}
// Every primitive is skinned to the same bind pose; elbow and wrist bands blend.
scene.updateMatrixWorld(true);const skeleton=new T.Skeleton(bones);skeleton.calculateInverses();
for(const [m,parts] of batches){
 const geo=mergeVertices(mergeGeometries(parts),.000001);
 const mesh=new T.SkinnedMesh(geo,m);mesh.name=m.name;scene.add(mesh);mesh.bind(skeleton);
}
const tracks=[],duration=12,steps=96;
function animate(name,angles){
 const times=[],values=[];for(let i=0;i<=steps;i++){
 const t=i/steps*tau;times.push(duration*i/steps);
 values.push(...new T.Quaternion().setFromEuler(new T.Euler(...angles(t))).toArray());
 }
 tracks.push(new T.QuaternionKeyframeTrack(name+'.quaternion',times,values));
}
animate('Chest',t=>[.012*Math.sin(t*2),.018*Math.sin(t+.4),.013*Math.sin(t)]);
animate('Neck',t=>[.016*Math.sin(t*2),.021*Math.sin(t),-.015*Math.sin(t+.6)]);
animate('Head',t=>[.025*Math.sin(2*t+.4),.095*Math.sin(t)+.039*Math.sin(2*t-.3),.035*Math.cos(t+.6)]);
for(const [i,s] of ['L','R'].entries()){
 const a=i?1:-1;animate('Shoulder'+s,t=>[-.034+.024*Math.sin(2*t+.8*a),0,a*.022*Math.cos(t)]);
 animate('Elbow'+s,t=>[-.065+.033*Math.cos(t+.8*a),a*.02*Math.sin(2*t),0]);
 // Thigh and shin counter-rotate to settle the stance; the soles stay nearly level.
 const settle=t=>(1-Math.cos(t+.85*a))*.5;
 animate('Thigh'+s,t=>[-.032*settle(t),0,a*.013*settle(t)]);
 animate('Knee'+s,t=>[.070*settle(t),0,0]);
 animate('Foot'+s,t=>[-.038*settle(t),0,-a*.013*settle(t)]);
 animate('Hand'+s,t=>[.029*Math.sin(2*t+a),a*.037*Math.cos(t),a*.023*Math.sin(t)]);
}
const times=[],values=[];for(let i=0;i<=steps;i++){const t=i*tau/steps,p=bones[names.Chest].position;
 times.push(i*duration/steps);values.push(p.x+.009*Math.sin(t),p.y+.007*Math.sin(2*t),p.z);}
tracks.push(new T.VectorKeyframeTrack('Chest.position',times,values));
globalThis.FileReader=class{async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer();this.onloadend?.();}};
const binary=Buffer.from(await new GLTFExporter().parseAsync(scene,{binary:true,animations:[new T.AnimationClip('Idle',duration,tracks)]}));
// Embed the approved front plate once; UVs on back panels use clean fabric swatches.
const jsonSize=binary.readUInt32LE(12),doc=JSON.parse(binary.subarray(20,20+jsonSize));
// Extend denim colour beneath the cut edge. A grazing-angle UV must not
// pick up the pale photographic background between the cuffs and around knees.
const front=await readFile('assets/source/character-front.jpg');
const raw=execFileSync('magick',['jpg:-','-depth','8','rgb:-'],{input:front,maxBuffer:8e6});
for(let y=832;y<1275;y++)for(let x=290;x<789;x++){
 const i=(y*1086+x)*3;
 if(raw[i]<154 || raw[i+1]<135 || raw[i+2]<125)continue;
 if(y>1011 && y<1075 && (Math.abs(x-424)<72 || Math.abs(x-650)<69))continue;
 const centre=x<538?428:649;
 if(Math.abs(x-centre)<60)continue;
 for(let d=1;d<=125;d++){
  const j=i+3*d*Math.sign(centre-x);
  if(raw[j]<105 && raw[j+1]<100 && raw[j+2]<99){
   raw[i]=raw[j];raw[i+1]=raw[j+1];raw[i+2]=raw[j+2];break;
  }
 }
}
const jpeg=execFileSync('magick',['-size','1086x1448','-depth','8','rgb:-','-quality','92','jpg:-'],{input:raw,maxBuffer:8e6}),bin=binary.subarray(28+jsonSize);
const fabric=await readFile('assets/source/weave.jpg');
const imageData=[jpeg,fabric],buffers=[bin];let offset=bin.length;
doc.images=[];doc.textures=[];
for(const image of imageData){
 doc.images.push({mimeType:'image/jpeg',bufferView:doc.bufferViews.length});
 doc.textures.push({source:doc.images.length-1});
 doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:image.length});
 const padding=Buffer.alloc((4-image.length%4)%4);buffers.push(image,padding);offset+=image.length+padding.length;
}
for(const m of doc.materials){
 if(m.extras?.plate)m.pbrMetallicRoughness.baseColorTexture={index:0};
 if([...clothBack.values()].some(back=>back.name===m.name))m.pbrMetallicRoughness.baseColorTexture={index:1};
 delete m.extras;
}
const payload=Buffer.concat(buffers);
doc.buffers[0].byteLength=payload.length;
let json=JSON.stringify(doc);json+=' '.repeat((4-Buffer.byteLength(json)%4)%4);
const header=Buffer.alloc(20),chunk=Buffer.alloc(8);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+Buffer.byteLength(json)+payload.length,8);header.writeUInt32LE(Buffer.byteLength(json),12);header.write('JSON',16);chunk.writeUInt32LE(payload.length);chunk.write('BIN',4);
await writeFile(process.argv[2],Buffer.concat([header,Buffer.from(json),chunk,payload]));
