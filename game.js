/* DUSTLINE: EXTRACTION. Original self-contained third-person 3D browser game. */
(()=>{'use strict';
const $=id=>document.getElementById(id),clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),lerp=(a,b,t)=>a+(b-a)*t;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),angle=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
let audioCtx=null,soundEnabled=false,renderer,meshes,playing='menu',then=0,nowSec=0,toastTimer=0,uiTimer=0,frameSamples=[],quality=1,tooSlow=0;
let player,enemies,crates,bullets,effects,elapsed=0,left=300,kills=0,score=0,spawns=0,nextSpawn=0,interactLabel='回収',aimAssist=false;
let cam={yaw:-.10,pitch:0},keys=Object.create(null),touch={movement:null,look:null,fire:null,dx:0,dy:0},fireHeld=false,fireCooldown=0,shotFlash=0,hitFlash=0,view={w:390,h:750},lastMessage='';
const T=DX3D.THREE, worldLimit=28,MAX_BOTS=8;
let renderDirty=true;
let cameraEye=null,cameraTarget=null,lastDt=.016,aiming=false,damageAnim=0,deathAge=0,contextLost=false,perfWindow=[],perfElapsed=0,adaptive=true,adaptAt=0;
const corpses=[];
const random=(a,b)=>a+Math.random()*(b-a);
const isTouch=()=>window.matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
const lootLocations=[{x:-12,z:-2},{x:12,z:9},{x:-6,z:19}],exit={x:0,z:26};
function sound(type){
 if(!soundEnabled)return;
 try{
 if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
 if(audioCtx.state==='suspended')audioCtx.resume();
 const t=audioCtx.currentTime,o=audioCtx.createOscillator(),g=audioCtx.createGain();
 const cfg={gun:[130,47,.095,.065],hit:[425,185,.09,.035],pickup:[640,960,.18,.075],med:[430,580,.19,.055],complete:[420,820,.39,.07],damage:[90,43,.22,.07]};
 const q=cfg[type]||cfg.hit;o.type=type==='gun'?'sawtooth':type==='damage'?'sine':'triangle';o.frequency.setValueAtTime(q[0],t);o.frequency.exponentialRampToValueAtTime(q[1],t+q[2]);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(q[3],t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+q[2]);o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+q[2]+.01);
 }catch(e){}
}
function messages(t,seconds=2.2){lastMessage=t;toastTimer=seconds;$('centerMsg').textContent=t;$('centerMsg').style.opacity='1';}
function collide(x,z,r=.46){if(Math.abs(x)>worldLimit-1||Math.abs(z)>worldLimit-1)return true;for(const b of meshes.obstacles){const dx=Math.max(Math.abs(x-b.x)-b.w*.5,0),dz=Math.max(Math.abs(z-b.z)-b.d*.5,0);if(dx*dx+dz*dz<r*r)return true;}return false;}
function spawnEnemy(x,z,type){const heavy=type==='heavy',drone=type==='drone';return {id:++spawns,x,z,type,hp:heavy?150:drone?62:90,maxhp:heavy?150:drone?62:90,speed:heavy?1.35:drone?2.0:2.2,attack:random(.6,2.1),phase:random(0,7),yaw:angle({x,z},player),flash:0,dead:false};}
function reset(){
 player={x:0,z:-21,hp:100,shield:60,ammo:30,reserve:150,reloading:0,med:2,yaw:0,move:0,shots:0,shotsHit:0,gait:0,sprinting:false,vx:0,vz:0};
 enemies=[];crates=lootLocations.map((p,i)=>({...p,id:i,got:false}));bullets=[];effects=[];
 for(const [x,z,t] of [[-9,-3,'scout'],[10,11,'scout'],[-4,14,'scout'],[-15,15,'heavy'],[3,21,'drone'],[6,-1,'scout']])enemies.push(spawnEnemy(x,z,t));
 corpses.length=0;cameraEye=null;cameraTarget=null;deathAge=0;damageAnim=0;clearInput();left=300;elapsed=0;kills=0;score=0;nextSpawn=14;fireCooldown=0;fireHeld=false;shotFlash=0;hitFlash=0;cam.yaw=0;cam.pitch=-.065;touch.dx=0;touch.dy=0;touch.movement=null;touch.look=null;keys=Object.create(null);
 $('damage').style.opacity='0';updateUI();
}
function openModal(title,msg,buttonText){$('modalWrap').classList.remove('hide');const mod=$('modal');mod.querySelector('h1').innerHTML=title;mod.querySelector('p').textContent=msg;$('start').textContent=buttonText;}
function gameStart(){renderDirty=true;if(contextLost)return;reset();playing='play';$('modalWrap').classList.add('hide');$('pause').textContent='Ⅱ 停止';messages('補給物資を3つ回収し、北側のゲートから脱出せよ',3.4);}
function finish(win,reason){renderDirty=true;
 if(playing!=='play')return;
 playing=win?'win':'loss';clearInput();deathAge=0;
 if(win){sound('complete');score+=Math.round(left)*3+player.hp*10+player.shield*4;try{const best=Number(localStorage.getItem('dustline3d_best')||0);if(score>best)localStorage.setItem('dustline3d_best',String(score));}catch(e){}
 openModal('MISSION<br><em>COMPLETE</em>','脱出成功。獲得物資 '+crates.filter(c=>c.got).length+'/3・撃破 '+kills+'体・スコア '+score+'。','もう一度出撃 →');
 }else openModal('MISSION<br><em>FAILED</em>',reason+'。撃破 '+kills+'体・回収 '+crates.filter(c=>c.got).length+'/3。','再挑戦 →');
}
function clearInput(){keys=Object.create(null);fireHeld=false;touch={movement:null,look:null,fire:null,dx:0,dy:0};$('knob').style.transform='translate(0,0)';for(const prop of ['left','top','bottom'])$('stick').style.removeProperty(prop);}
function pause(){renderDirty=true;if(contextLost)return;if(playing==='play'){playing='pause';clearInput();openModal('MISSION<br><em>PAUSED</em>','ゲームを一時停止しています。','任務を再開 →');$('pause').textContent='▶ 再開';}else if(playing==='pause'){playing='play';$('modalWrap').classList.add('hide');$('pause').textContent='Ⅱ 停止';}updateUI();}
function nearCrate(){let best=null,d=3.1;for(const c of crates)if(!c.got){const q=dist(player,c);if(q<d){d=q;best=c;}}return best;}
function interact(){if(playing!=='play')return;
 const c=nearCrate();if(c){c.got=true;score+=250;sound('pickup');messages('補給物資を確保 +250',2.5);if(crates.every(c=>c.got))messages('全物資を回収！北側の緑色ゲートへ向かえ',3.5);updateUI();return;}
 if(dist(player,exit)<3.7){if(crates.every(c=>c.got)){finish(true);return;}messages('脱出には3つの物資が必要');return;}
 messages('物資ケースに近づいて「回収」を押す');}
function reload(){if(playing!=='play'||player.reloading>0||player.ammo===30||player.reserve===0)return;player.reloading=1.25;player.reloadPending=true;messages('リロード中…',.9);}
function heal(){if(playing!=='play'||player.med<=0||player.hp>=100)return;player.med--;sound('med');player.hp=Math.min(100,player.hp+45);messages('メディキットを使用 +45 HP');updateUI();}
function takeDamage(d){if(playing!=='play')return;const s=Math.min(player.shield,d);player.shield-=s;player.hp=Math.max(0,player.hp-(d-s));hitFlash=.7;damageAnim=.4;sound('damage');$('damage').style.opacity=String(clamp((d-s)*.03+.19,.15,.67));if(player.hp<=0)finish(false,'作戦員が戦闘不能');}
// Camera ray -> visible target, then muzzle ray -> obstruction. Same trajectory drives damage and tracer.
function barrierHit(ray,maxDistance=90,padding=0){let nearest=null;
 for(const o of meshes.obstacles){const box=new T.Box3(new T.Vector3(o.x-o.w/2-padding,-.2,o.z-o.d/2-padding),new T.Vector3(o.x+o.w/2+padding,o.h??3,o.z+o.d/2+padding));const p=ray.intersectBox(box,new T.Vector3());if(p){const d=p.distanceTo(ray.origin);if(d<maxDistance&&(!nearest||d<nearest.distance))nearest={point:p,distance:d};}}
 const ground=ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),new T.Vector3());if(ground){const d=ground.distanceTo(ray.origin);if(d<maxDistance&&(!nearest||d<nearest.distance))nearest={point:ground,distance:d};}return nearest;
}
function enemyCenter(e){return new T.Vector3(e.x,e.type==='drone'?2.55+Math.sin(elapsed*2.8+e.phase)*.16:e.type==='heavy'?1.45:1.14,e.z);}
function enemyHit(ray,maxDistance=90){let best=null;for(const e of enemies){if(e.dead)continue;const sphere=new T.Sphere(enemyCenter(e),e.type==='heavy'?1.0:e.type==='drone'?.60:.72),p=ray.intersectSphere(sphere,new T.Vector3());if(p){const d=p.distanceTo(ray.origin);if(d<maxDistance&&(!best||d<best.distance))best={enemy:e,point:p,distance:d};}}return best;}
function aimSolution(){if(!renderer)return null;const ray=renderer.aimRay(),wall=barrierHit(ray),hit=enemyHit(ray,wall?wall.distance:90);return {ray,hit,point:hit?.point||wall?.point||ray.at(85,new T.Vector3())};}
function findTarget(){return aimSolution()?.hit?.enemy||null;}
function startFire(){if(playing!=='play')return;if(!fireHeld){fireHeld=true;fireCooldown=0;shoot();fireCooldown=.128;}}
function stopFire(){fireHeld=false;}
function shoot(){if(playing!=='play'||player.reloading>0||contextLost)return;if(player.ammo<=0){reload();return;}
 player.ammo--;player.shots++;sound('gun');shotFlash=.09;
 const solution=aimSolution();const yaw=player.yaw;
 const from=new T.Vector3(player.x+Math.sin(yaw)*.86+Math.cos(yaw)*.16,1.40+cam.pitch*.5,player.z+Math.cos(yaw)*.86-Math.sin(yaw)*.16);
 const desired=solution?.point||from.clone().add(new T.Vector3(Math.sin(cam.yaw),cam.pitch,Math.cos(cam.yaw)).multiplyScalar(80));
 const ray=new T.Ray(from,desired.clone().sub(from).normalize()),wall=barrierHit(ray),hit=enemyHit(ray,Math.min(desired.distanceTo(from)+1,wall?wall.distance:90));
 let to=hit?.point||wall?.point||desired;
 if(hit){const target=hit.enemy;sound('hit');target.hp-=target.type==='heavy'?20:27;target.flash=.18;player.shotsHit++;score+=15;hitFlash=.11;
 $('hitflash').style.opacity='1';setTimeout(()=>$('hitflash').style.opacity='0',110);
 burst(to.x,to.y,to.z,quality===0?3:7,.34);
 if(target.hp<=0){target.dead=true;kills++;score+=target.type==='heavy'?180:target.type==='drone'?110:95;corpses.push({...target,age:0});messages('TARGET DOWN · '+kills,1.3);burst(target.x,to.y,target.z,quality===0?10:24,target.type==='heavy'?1.5:1);}
 }else if(wall)burst(to.x,to.y,to.z,quality===0?2:5,.2);
 bullets.push({from:{x:from.x,y:from.y,z:from.z},to:{x:to.x,y:to.y,z:to.z},life:.065,duration:.065,enemy:false});updateUI();
}
function burst(x,y,z,n,size=1){for(let i=0;i<n;i++){if(effects.length>(quality===0?30:70))break;effects.push({x:x+random(-.18,.18),y:y+random(-.18,.18),z:z+random(-.18,.18),vx:random(-3,3)*size,vy:random(0,5)*size,vz:random(-3,3)*size,life:random(.22,.6),initial:.6,size:random(.03,.12)*size});}}
function enemyShoot(e){const c=enemyCenter(e),from={x:c.x,y:c.y+.12,z:c.z},to={x:player.x,y:1.3,z:player.z};e.flash=.19;
 // Telegraph before a burst; strafing reduces incoming damage.
 bullets.push({from,to,life:.14,duration:.14,enemy:true});if(!segmentBlocked(from,to))takeDamage((e.type==='heavy'?13:e.type==='drone'?8:6)*(player.move>.5?.55:1));}
function segmentBlocked(a,b){const av=new T.Vector3(a.x,a.y??1.3,a.z),bv=new T.Vector3(b.x,b.y??1.3,b.z),d=av.distanceTo(bv);return !!barrierHit(new T.Ray(av,bv.sub(av).normalize()),d-.1);}
function tryMove(x,z){if(!collide(x,player.z))player.x=x;if(!collide(player.x,z))player.z=z;}
function update(dt){if(playing!=='play')return;
 lastDt=dt;damageAnim=Math.max(0,damageAnim-dt);elapsed+=dt;left-=dt;if(left<=0){left=0;finish(false,'制限時間を超過');return;}
 fireCooldown-=dt;player.reloading=Math.max(0,player.reloading-dt);
 if(player.reloading===0&&player.ammo<30&&player.reserve>0&&player.reloadPending){const n=Math.min(30-player.ammo,player.reserve);player.ammo+=n;player.reserve-=n;player.reloadPending=false;}
 if(player.reloading>0)player.reloadPending=true;
 let f=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0),side=(keys.d?1:0)-(keys.a?1:0);
 if(touch.movement){side+=touch.dx;f-=touch.dy;}
 const magnitude=Math.hypot(f,side);player.move=lerp(player.move,clamp(magnitude,0,1),1-Math.exp(-dt*14));
 player.sprinting=(keys.shift||(!aiming&&touch.movement&&magnitude>.9))&&!fireHeld;
 f/=Math.max(1,magnitude);side/=Math.max(1,magnitude);
 const speed=aiming?3.1:player.sprinting?7.4:5.4,accel=1-Math.exp(-dt*12);
 const dx=(Math.sin(cam.yaw)*f+Math.cos(cam.yaw)*side)*speed,dz=(Math.cos(cam.yaw)*f-Math.sin(cam.yaw)*side)*speed;
 player.vx=lerp(player.vx,dx,accel);player.vz=lerp(player.vz,dz,accel);
 const oldX=player.x,oldZ=player.z;tryMove(player.x+player.vx*dt,player.z+player.vz*dt);
 player.gait+=Math.hypot(player.x-oldX,player.z-oldZ)*(player.sprinting?4.8:6.5);
 player.yaw+=wrap(cam.yaw-player.yaw)*(1-Math.exp(-dt*16));
 if(keys.arrowleft)cam.yaw-=1.4*dt;if(keys.arrowright)cam.yaw+=1.4*dt;
 if(fireHeld&&fireCooldown<=0){shoot();fireCooldown=.128;}
 // AI: patrol toward player, keep a firing distance, use straightforward wall avoidance
 for(const e of enemies){if(e.dead)continue;e.phase+=dt;e.flash=Math.max(0,e.flash-dt);
 const d=dist(e,player);e.yaw+=wrap(angle(e,player)-e.yaw)*(1-Math.exp(-dt*5));e.alert=d<26&&!segmentBlocked(e,player);
 if(d>(e.type==='heavy'?10:7)&&d<47){const sp=e.speed*dt;
  const nx=e.x+Math.sin(e.yaw)*sp,nz=e.z+Math.cos(e.yaw)*sp;
  if(!collide(nx,e.z,.75))e.x=nx;
  else if(!collide(e.x+sp,e.z,.75))e.x+=sp;
  if(!collide(e.x,nz,.75))e.z=nz;
  else if(!collide(e.x,e.z-sp,.75))e.z-=sp;
 }
 e.attack-=dt;
 if(e.attack<=0&&d<21){if(e.alert)enemyShoot(e);e.attack=(e.type==='heavy'?3.3:e.type==='drone'?2.9:3.2)*random(.8,1.4);}
 }
 enemies=enemies.filter(e=>!e.dead);
 if(elapsed>nextSpawn&&enemies.length<MAX_BOTS){let attempts=0,x,z;do{x=random(-20,20);z=random(-14,28);attempts++;}while(attempts<20&&(collide(x,z,1.2)||dist({x,z},player)<12));
 if(!collide(x,z,1.2))enemies.push(spawnEnemy(x,z,Math.random()<.18?'heavy':Math.random()<.19?'drone':'scout'));
 nextSpawn=elapsed+random(8,14);
 }
 for(const c of corpses)c.age+=dt;while(corpses.length&&corpses[0].age>8)corpses.shift();
 for(const b of bullets)b.life-=dt;bullets=bullets.filter(b=>b.life>0);
 for(const q of effects){q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;q.vy-=7*dt;q.life-=dt;}
 effects=effects.filter(q=>q.life>0);
 shotFlash=Math.max(0,shotFlash-dt);hitFlash=Math.max(0,hitFlash-dt);
 if(hitFlash===0)$('damage').style.opacity='0';
 if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('centerMsg').style.opacity='0';}
 const target=nearCrate();interactLabel=target?'回収':dist(player,exit)<3.7?'脱出':'回収';
 const locked=findTarget();aimAssist=!!locked&&!segmentBlocked(player,locked);uiTimer+=dt;if(uiTimer>.14){uiTimer=0;updateUI();}
}
function render(){if(!renderer||!meshes||!player||contextLost)return;
 const y=cam.yaw,dir=new T.Vector3(Math.sin(y)*Math.cos(cam.pitch),Math.sin(cam.pitch),Math.cos(y)*Math.cos(cam.pitch));
 const shoulder=new T.Vector3(-Math.cos(y),0,Math.sin(y)),anchor=new T.Vector3(player.x,1.53,player.z),distance=aiming?2.25:4.0;
 const desired=anchor.clone().addScaledVector(shoulder,aiming?.53:.63).addScaledVector(dir,-distance).add(new T.Vector3(0,.34,0));
 const delta=desired.clone().sub(anchor),length=delta.length(),wall=barrierHit(new T.Ray(anchor,delta.clone().normalize()),length,.23);
 const safe=wall?anchor.clone().addScaledVector(delta.normalize(),Math.max(.3,wall.distance-.16)):desired;
 if(!cameraEye||cameraEye.distanceTo(safe)>8||wall)cameraEye=safe.clone();else cameraEye.lerp(safe,1-Math.exp(-lastDt*14));
 // Resolve any obstruction along the smoothed camera too.
 const smoothDelta=cameraEye.clone().sub(anchor),smoothHit=barrierHit(new T.Ray(anchor,smoothDelta.clone().normalize()),smoothDelta.length(),.18);
 if(smoothHit)cameraEye.copy(anchor).addScaledVector(smoothDelta.normalize(),Math.max(.25,smoothHit.distance-.12));
 const look=cameraEye.clone().addScaledVector(dir,30);if(shotFlash>0){look.y+=Math.sin(nowSec*180)*shotFlash*.14;}
 renderer.begin(cameraEye.toArray(),look.toArray(),aiming?48:61,elapsed);
 renderer.draw(quality===0?meshes.terrainLow:meshes.terrain);renderer.draw(meshes.shadow,player.x,.027,player.z,0,.9);
 for(const c of crates)if(!c.got){renderer.draw(meshes.loot,c.x,0,c.z);renderer.draw(meshes.shock,c.x,.025,c.z,0,1.05+Math.sin(elapsed*3+c.id)*.07);}
 renderer.draw(meshes.exit,exit.x,0,exit.z);
 const ROBOTS=window.DUSTROBOTS;if(ROBOTS)ROBOTS.update(renderer,enemies,corpses,lastDt,quality,player,53);
 for(const e of enemies){if(dist(player,e)>53||e.dead)continue;const size=e.type==='heavy'?1.28:1;const skinned=ROBOTS&&e.type==='scout';
 if(!skinned){const obj=renderer.draw(meshes[e.type==='scout'?'scout':e.type],e.x,e.type==='drone'?2.55+Math.sin(elapsed*2.8+e.phase)*.16:0,e.z,e.yaw,size);
 DUSTMODELS.poseBot(obj,e,elapsed);}renderer.draw(meshes.shadow,e.x,.027,e.z,0,e.type==='heavy'?2.0:1.5);if(skinned)continue;if(e.alert&&e.attack>0&&e.attack<.5){renderer.draw(meshes.muzzle,e.x+Math.sin(e.yaw)*.8,e.type==='drone'?2.5:1.5,e.z+Math.cos(e.yaw)*.8,0,.16+(.5-e.attack)*.25);}if(e.flash>0){const d=e.type==='drone'?.65:1;renderer.draw(meshes.muzzle,e.x+Math.sin(e.yaw)*d,e.type==='drone'?2.4:1.57,e.z+Math.cos(e.yaw)*d,0,.7);}
 }
 for(const c of corpses){if(ROBOTS&&c.type==='scout')continue;const age=c.age,scale=c.type==='heavy'?1.28:1;const obj=renderer.draw(meshes[c.type==='scout'?'scout':c.type],c.x,c.type==='drone'?Math.max(.15,2.5-age*4):-.12,c.z,c.yaw,scale,Math.min(1.1,age*2));
 if(c.type==='drone')obj.rotation.z=Math.min(1.6,age*2);}
 const dead=playing==='loss'&&player.hp<=0;if(dead)deathAge=Math.min(1,deathAge+lastDt*1.7);
 const SOLDIER=window.DUSTSOLDIER;
 if(SOLDIER){SOLDIER.update(renderer,{x:player.x,z:player.z,yaw:player.yaw,vx:player.vx||0,vz:player.vz||0,dt:lastDt,pitch:cam.pitch,aiming,firing:fireHeld,flash:shotFlash,hit:damageAnim,reloading:player.reloading,dead,quality});}
 else{const actor=renderer.draw(meshes.ranger,player.x,dead?-deathAge*.45:0,player.z,player.yaw,1,dead?deathAge*.5:0);
 DUSTMODELS.poseRanger(actor,player,elapsed,cam.pitch,shotFlash,damageAnim,dead);}
 const muzzleAt=SOLDIER?.muzzleWorld();
 if(shotFlash>0){if(muzzleAt)renderer.draw(meshes.muzzle,muzzleAt.x,muzzleAt.y,muzzleAt.z,nowSec*20,1+shotFlash*4);
 else renderer.draw(meshes.muzzle,player.x+Math.sin(player.yaw)*.89+Math.cos(player.yaw)*.16,1.4+cam.pitch*.5,player.z+Math.cos(player.yaw)*.89-Math.sin(player.yaw)*.16,nowSec*20,1+shotFlash*4);}
 for(const b of bullets){const dx=b.to.x-b.from.x,dy=b.to.y-b.from.y,dz=b.to.z-b.from.z,l=Math.hypot(dx,dy,dz);renderer.draw(b.enemy?meshes.enemyBeam:meshes.beam,b.from.x,b.from.y,b.from.z,Math.atan2(dx,dz),[1,1,l],-Math.asin(dy/Math.max(1e-5,l)));}
 for(const e of effects)renderer.draw(meshes.plume,e.x,e.y,e.z,e.life*10,Math.max(.1,e.life/.6)*e.size*1.6);
 renderer.end();
 const target=crates.every(c=>c.got)?exit:crates.filter(c=>!c.got).sort((a,b)=>dist(a,player)-dist(b,player))[0];
 if(target&&playing==='play'){const p=renderer.project(new T.Vector3(target.x,1.1,target.z));const visible=p.z<1&&p.x>-.86&&p.x<.86&&p.y>-.7&&p.y<.7;const mark=$('waypoint');mark.hidden=!visible;if(visible){mark.style.left=(p.x*.5+.5)*100+'%';mark.style.top=(-p.y*.5+.5)*100+'%';mark.textContent=(crates.every(c=>c.got)?'◇ 脱出':'◇ 物資')+' '+Math.round(dist(player,target))+'m';}}
 else $('waypoint').hidden=true;
}
function updateUI(){if(!player)return;
 $('hp').textContent=Math.ceil(player.hp);$('shield').textContent=Math.ceil(player.shield);
 $('hpfill').style.width=Math.max(0,player.hp)+'%';
 $('clock').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(Math.floor(left%60)).padStart(2,'0');
 $('supply').textContent=crates.filter(c=>c.got).length;
 $('ammo').innerHTML=player.ammo+' <span>/ '+player.reserve+'</span>';
 $('goal').textContent=crates.every(c=>c.got)?'北側のゲートへ移動し脱出':'補給物資 '+crates.filter(c=>c.got).length+' / 3';
 const target=crates.every(c=>c.got)?exit:crates.filter(c=>!c.got).sort((a,b)=>dist(a,player)-dist(b,player))[0];
 if(target){const bearing=wrap(angle(player,target)-cam.yaw),dir=Math.abs(bearing)<.35?'↑':bearing>0?(bearing>1.5?'→':'↗'):(bearing< -1.5?'←':'↖');$('compass').textContent=dir+' '+(crates.every(c=>c.got)?'EXTRACTION':'SUPPLY')+' · '+Math.round(dist(player,target))+'m';}
 $('interact').childNodes[0].nodeValue=interactLabel;
 $('medCount').textContent='×'+player.med;
 $('med').disabled=player.med<=0||player.hp>=100||playing!=='play';
 $('reload').disabled=player.reloading>0||player.ammo===30||player.reserve<=0||playing!=='play';
 $('fire').disabled=playing!=='play';
 $('crosshair').classList.toggle('lock',aimAssist);$('combat').textContent=player.reloading>0?'装填中 '+Math.round((1-player.reloading/1.25)*100)+'%':aiming?'精密照準 / AIM':'CARBINE / AUTO';
 drawRadar();
}
function drawRadar(){const c=$('radar'),g=c.getContext('2d');if(!g||!player)return;g.clearRect(0,0,200,200);
 g.save();g.translate(100,100);g.fillStyle='#0a222cdd';g.beginPath();g.arc(0,0,97,0,6.283);g.fill();g.strokeStyle='#709d9e7e';g.lineWidth=1;for(const r of [28,56,89]){g.beginPath();g.arc(0,0,r,0,6.283);g.stroke();}
 g.rotate(-cam.yaw);
 const mark=(x,z,color,r=4)=>{const dx=(x-player.x)*4,dz=-(z-player.z)*4;if(Math.hypot(dx,dz)>90)return;g.fillStyle=color;g.beginPath();g.arc(dx,dz,r,0,6.283);g.fill();};
 for(const e of enemies)mark(e.x,e.z,'#f1a077',3.6);
 for(const q of crates)if(!q.got)mark(q.x,q.z,'#ffe5a2',5);
 mark(exit.x,exit.z,'#75f9dc',5);
 g.restore();g.fillStyle='#f9fcee';g.beginPath();g.moveTo(100,91);g.lineTo(94,107);g.lineTo(106,107);g.closePath();g.fill();
 g.fillStyle='#a9c8bc';g.font='bold 12px sans-serif';g.textAlign='center';g.fillText('N',100,14);
}
function resize(){renderDirty=true;const el=$('app'),r=el.getBoundingClientRect();view.w=r.width;view.h=r.height;if(renderer)renderer.resize(Math.max(1,view.w),Math.max(1,view.h),quality);}
function frame(t){requestAnimationFrame(frame);if(!renderer||contextLost){then=0;return;}const raw=then?Math.max(0,(t-then)/1000):0;then=t;nowSec=t/1000;lastDt=Math.min(raw,.06);
 if(document.hidden)return;
 if(playing==='play'){let remaining=Math.min(raw,.15);while(remaining>0){const dt=Math.min(remaining,1/30);update(dt);remaining-=dt;}}
 if(playing==='play'||(playing==='loss'&&player.hp<=0&&deathAge<1)||renderDirty){render();renderDirty=false;}
 if(playing==='play'&&raw>0){perfWindow.push(raw);if(perfWindow.length>120)perfWindow.shift();perfElapsed+=raw;
  const fps=perfWindow.length/perfWindow.reduce((a,b)=>a+b,0);$('performance').textContent=Math.round(fps)+' FPS · '+(quality===0?'ECO':quality===1?'STANDARD':'HIGH');
  if(adaptive&&perfElapsed>4&&perfWindow.length>=6&&fps<28&&nowSec-adaptAt>8){if(quality>0){quality--; $('quality').value=quality;}else renderer.scale=Math.max(.65,renderer.scale-.1);resize();adaptAt=nowSec;perfElapsed=0;perfWindow=[];messages('描画負荷に合わせて画質を調整',2);}
 }
}
function init(){
 try{
 renderer=new DX3D.Renderer($('world'));meshes=DUSTMODELS.createAll(renderer);quality=Number($('quality').value);resize();reset();
 $('debug').textContent='WebGL2 / THREE r170';$('aim').addEventListener('click',()=>{aiming=!aiming;$('aim').classList.toggle('active',aiming);});
 $('start').addEventListener('click',()=>{if(playing==='pause')pause();else gameStart();});
 $('pause').addEventListener('click',pause);$('reload').addEventListener('click',reload);$('med').addEventListener('click',heal);$('interact').addEventListener('click',interact);
 $('autoQuality').addEventListener('change',e=>adaptive=e.target.checked);$('showFps').addEventListener('change',e=>$('app').classList.toggle('show-fps',e.target.checked));
 $('quality').addEventListener('change',e=>{quality=Number(e.target.value);renderer.scale=1;perfWindow=[];perfElapsed=0;adaptAt=nowSec;resize();});
 $('sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('sound').textContent=soundEnabled?'♪ ON':'♪ OFF';if(soundEnabled)sound('pickup');});
 $('fire').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(touch.fire!==null)return;touch.fire=e.pointerId;startFire();try{e.currentTarget.setPointerCapture(e.pointerId);}catch(_){};});
 const stop=e=>{if(touch.fire===e.pointerId){touch.fire=null;stopFire();}};$('fire').addEventListener('pointerup',stop);$('fire').addEventListener('pointercancel',stop);$('fire').addEventListener('lostpointercapture',stop);
 // Mobile control regions are independent, allowing movement and shooting simultaneously.
 const mz=$('moveZone'),az=$('aimZone');$('touchLayer').classList.toggle('touch',isTouch());
 function startMovement(e){if(playing!=='play'||touch.movement)return;e.preventDefault();try{mz.setPointerCapture(e.pointerId)}catch(_){}touch.movement={id:e.pointerId,x:e.clientX,y:e.clientY};touch.dx=0;touch.dy=0;const r=$('app').getBoundingClientRect();$('stick').style.left=clamp(e.clientX-r.left-53,12,view.w-118)+'px';$('stick').style.top=clamp(e.clientY-r.top-53,120,view.h-155)+'px';$('stick').style.bottom='auto';}
 function moveMovement(e){if(!touch.movement||e.pointerId!==touch.movement.id)return;e.preventDefault();const dx=e.clientX-touch.movement.x,dy=e.clientY-touch.movement.y,d=Math.max(1,Math.hypot(dx,dy)),v=clamp(d/55,0,1);touch.dx=dx/d*v;touch.dy=dy/d*v;$('knob').style.transform='translate('+touch.dx*28+'px,'+touch.dy*28+'px)';}
 function stopMovement(e){if(touch.movement&&e.pointerId===touch.movement.id){touch.movement=null;touch.dx=0;touch.dy=0;$('knob').style.transform='translate(0,0)';for(const prop of ['left','top','bottom'])$('stick').style.removeProperty(prop);}}
 mz.addEventListener('pointerdown',startMovement);mz.addEventListener('pointermove',moveMovement);mz.addEventListener('pointerup',stopMovement);mz.addEventListener('pointercancel',stopMovement);mz.addEventListener('lostpointercapture',stopMovement);
 function startLook(e){if(playing!=='play'||touch.look)return;e.preventDefault();try{az.setPointerCapture(e.pointerId)}catch(_){}touch.look={id:e.pointerId,x:e.clientX,y:e.clientY};}
 function moveLook(e){if(!touch.look||touch.look.id!==e.pointerId)return;e.preventDefault();const dx=e.clientX-touch.look.x,dy=e.clientY-touch.look.y;cam.yaw-=dx*.006;cam.pitch=clamp(cam.pitch-dy*.004,-.65,.7);touch.look.x=e.clientX;touch.look.y=e.clientY;}
 function stopLook(e){if(touch.look?.id===e.pointerId)touch.look=null;}
 az.addEventListener('pointerdown',startLook);az.addEventListener('pointermove',moveLook);az.addEventListener('pointerup',stopLook);az.addEventListener('pointercancel',stopLook);az.addEventListener('lostpointercapture',stopLook);
 const cv=$('world');let pointer=null;
 cv.addEventListener('pointerdown',e=>{if(playing!=='play'||isTouch())return;e.preventDefault();try{cv.setPointerCapture(e.pointerId)}catch(_){}pointer={id:e.pointerId,x:e.clientX,y:e.clientY};if(e.button===2){aiming=true;$('aim').classList.add('active');}else startFire();});
 cv.addEventListener('pointermove',e=>{if(playing!=='play'||isTouch())return;if(pointer&&pointer.id===e.pointerId){cam.yaw-=(e.clientX-pointer.x)*.005;cam.pitch=clamp(cam.pitch-(e.clientY-pointer.y)*.003,-.65,.7);pointer.x=e.clientX;pointer.y=e.clientY;}});
 cv.addEventListener('pointerup',e=>{pointer=null;stopFire();if(e.button===2){aiming=false;$('aim').classList.remove('active');}});cv.addEventListener('pointercancel',()=>{pointer=null;stopFire();});cv.addEventListener('contextmenu',e=>e.preventDefault());
 window.addEventListener('keydown',e=>{const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();keys[key]=true;if(e.repeat)return;
 if(key==='escape')pause();if(playing==='play'){if(key==='r')reload();if(key==='e'||key===' ')interact();if(key==='h')heal();if(key==='f')startFire();}});
 window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;if(e.key.toLowerCase()==='f')stopFire();});
 window.addEventListener('resize',()=>{clearInput();resize();});window.visualViewport?.addEventListener('resize',resize);window.addEventListener('orientationchange',()=>setTimeout(resize,180));
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(playing==='play')pause();audioCtx?.suspend();}else {then=0;if(soundEnabled)audioCtx?.resume();}});
 window.addEventListener('blur',()=>{clearInput();pointer=null;if(playing==='play')pause();});window.addEventListener('pagehide',()=>{clearInput();if(playing==='play')pause();});
 // Catch WebGL context loss on iPhone resource pressure.
 cv.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;renderer.lost=true;clearInput();playing='pause';openModal('GRAPHICS<br><em>PAUSED</em>','描画の復旧を待っています。進行は保存されています。','復旧待ち…');$('start').disabled=true;});
 cv.addEventListener('webglcontextrestored',()=>{renderer.lost=false;contextLost=false;then=0;resize();$('start').disabled=false;openModal('MISSION<br><em>PAUSED</em>','描画を復旧しました。ボタンを押して再開してください。','任務を再開 →');});
 requestAnimationFrame(frame);
 }catch(err){console.error(err);const box=$('startupError');box.style.display='block';box.textContent='3Dゲームを開始できません：'+(err&&err.message||String(err))+'。iPhoneのSafariで公開URLを開き、描画品質を「省電力」にしてください。';$('start').disabled=true;}
}
// Test-only mutation hooks are available only with ?test=1; diagnostics are always readable.
const diagnostics=()=>({state:playing,x:player?.x,z:player?.z,hp:player?.hp,shield:player?.shield,ammo:player?.ammo,reserve:player?.reserve,med:player?.med,loot:crates?.filter(c=>c.got).length,clock:left,kills,shots:player?.shots,hits:player?.shotsHit,enemies:enemies?.map(e=>({id:e.id,x:e.x,z:e.z,hp:e.hp,type:e.type})),yaw:cam.yaw,pitch:cam.pitch,quality,dpr:renderer?.dpr,scale:renderer?.scale,fps:perfWindow.length/(perfWindow.reduce((a,b)=>a+b,0)||1),drawcalls:renderer?.drawcalls,triangles:renderer?.frameTriangles,contextLost,fireHeld,touchMoving:!!touch.movement,touchLooking:!!touch.look,camera:cameraEye?.toArray()});
window.DUSTLINE={diagnostics};
if(new URLSearchParams(location.search).has('test'))window.DUSTLINE_TEST={get:diagnostics,start:gameStart,interact,fire:shoot,teleport:(x,z)=>{player.x=x;player.z=z;cameraEye=null;},heal,reset,reload,damage:takeDamage,setClock:v=>left=v,setPlayer:p=>Object.assign(player,p),setCamera:(yaw,pitch=0)=>{cam.yaw=yaw;cam.pitch=pitch;player.yaw=yaw;cameraEye=null;},scenario:(type='scout',x=0,z=-10,attack=100)=>{enemies=[spawnEnemy(x,z,type)];enemies[0].attack=attack;nextSpawn=999;},clearEnemies:()=>{enemies=[];nextSpawn=999;},aimAt:(x,y,z)=>{const origin=cameraEye||new T.Vector3(player.x,1.8,player.z-4);const d=new T.Vector3(x,y,z).sub(origin);cam.yaw=Math.atan2(d.x,d.z);cam.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));},pause,barrierHit,adaptive:v=>{adaptive=v;},performanceSample:(dt)=>{perfWindow=Array(120).fill(dt);perfElapsed=5;adaptAt=-100;},assets:()=>meshes};
init();
})();
