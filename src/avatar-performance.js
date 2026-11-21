// Angles are local to each joint, in radians, layered over the authored breathing clip.
const poses = {
  relaxed: {},
  look: {Head:[.02,-.25,-.045],Neck:[0,-.05,0]},
  glance:{Head:[-.04,.16,.08]},
  shift:{Chest:[.025,0,-.045],ThighR:[-.10,0,.025],KneeR:[.17,0,0],FootR:[-.07,0,-.025],ShoulderL:[-.05,0,-.11]},
  attitude:{Head:[-.045,.05,.10],ShoulderR:[-.13,0,.20],ElbowR:[-.34,0,0],HandR:[0,.08,-.11]},
  welcome:{Head:[-.06,.12,-.045],ShoulderR:[-.54,0,.78],ElbowR:[-1.05,0,.16],HandR:[-.12,.15,.26]},
  listen:{Head:[.07,.18,-.11],Neck:[0,.04,0]},
  turn:{Head:[.02,.14,.04],ShoulderR:[-.12,0,.16],HandR:[-.08,.14,0]},
  present:{ShoulderL:[-.24,0,-.56],ShoulderR:[-.19,0,.52],ElbowL:[-.52,0,0],ElbowR:[-.47,0,0]},
  point:{Head:[.035,.21,-.05],ShoulderR:[-.22,0,.68],ElbowR:[-.82,0,0],HandR:[0,-.13,.12]},
  approve:{Head:[.18,.06,0],ShoulderL:[-.24,0,-.32],ElbowL:[-.76,0,0],HandL:[-.12,0,-.12]},
  seated:{ThighL:[-1.28,0,-.08],KneeL:[1.32,0,0],FootL:[-.075,0,0],ThighR:[-1.12,0,.09],KneeR:[1.02,0,0],FootR:[.08,0,0],Chest:[.06,0,-.035],ShoulderL:[-.19,0,-.09],ElbowL:[-.68,0,0],HandL:[.13,0,-.07]}
};
const idlePhrases = [['relaxed',4],['look',3],['glance',2],['relaxed',3],['shift',4],['attitude',3],['relaxed',5],['glance',3],['shift',3]];
export function createPerformance(root){
  const names=Array.from(new Set(Object.values(poses).flatMap(Object.keys)));
  const bones=names.map(n=>root.getObjectByName(n));
  const base=bones.map(b=>b.quaternion.clone());
  const values=new Float32Array(bones.length*3);
  let clock=0,idle=0,action='',elapsed=0,duration=0,seat=0;
  function react(name){
    if(!poses[name] || (action==='approve' && elapsed<duration && name!=='approve'))return;
    action=name;elapsed=0;duration=name==='welcome'?2.1:name==='approve'?1.55:1.35;
  }
  function apply(dt,finale){
    clock+=dt;
    if(clock>=idlePhrases[idle][1]){clock=0;idle=(idle+1)%idlePhrases.length;}
    const [idleName,span]=idlePhrases[idle];
    const idleWeight=Math.sin(Math.PI*clock/span)**2;
    elapsed+=dt;
    const phase=Math.min(1,elapsed/(duration||1));
    const envelope=Math.sin(Math.PI*phase)**2;
    const damp=1-Math.exp(-9*dt);
    seat+=(Number(finale)-seat)*(1-Math.exp(-6*dt));
    for(let i=0;i<bones.length;i++){
      const bone=bones[i],name=names[i];
      base[i].copy(bone.quaternion);
      for(let k=0;k<3;k++){
        const rest=(poses[idleName][name]?.[k]||0)*idleWeight;
        let gesture=poses[action]?.[name]?.[k]||0;
        if(action==='welcome' && name==='HandR' && k===2)gesture+=.27*Math.sin(phase*Math.PI*4);
        if(action==='approve' && name==='Head' && k===0)gesture*=Math.sin(phase*Math.PI*2);
        const target=rest*(1-envelope)+gesture*envelope+(poses.seated[name]?.[k]||0)*seat;
        const j=i*3+k;
        values[j]+=(target-values[j])*damp;
      }
      bone.rotation.set(bone.rotation.x+values[i*3],bone.rotation.y+values[i*3+1],bone.rotation.z+values[i*3+2]);
    }
    return seat;
  }
  function restore(){for(let i=0;i<bones.length;i++)bones[i].quaternion.copy(base[i]);}
  return {apply,restore,react};
}
