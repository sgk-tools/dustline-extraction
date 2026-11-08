/* DUSTLINE v0.4: original gear and mechanisms, CC0 anatomical head and PBR surfaces. */
import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {surfaces,rigMaps,sectorSign,anatomicalHead} from './materials.js';
const mat={};let seed=903,worldAuthoring=false;
const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
function surface(kind){
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
 const base=kind==='road'?[77,78,73]:kind==='concrete'?[139,133,116]:[116,119,101];
 const im=g.createImageData(256,256);for(let i=0;i<im.data.length;i+=4){const n=(rand()-.5)*(kind==='road'?48:32);for(let k=0;k<3;k++)im.data[i+k]=base[k]+n;im.data[i+3]=255;}g.putImageData(im,0,0);
 g.strokeStyle=kind==='road'?'#252b2aa0':'#333a303c';g.lineWidth=kind==='road'?1.5:.7;
 for(let i=0;i<18;i++){let x=rand()*256,y=rand()*256;g.beginPath();g.moveTo(x,y);for(let j=0;j<5;j++){x+=(rand()-.5)*25;y+=rand()*18;g.lineTo(x,y);}g.stroke();}
 if(kind==='cloth'){g.strokeStyle='#d2cfaf18';for(let i=0;i<256;i+=3){g.beginPath();g.moveTo(i,0);g.lineTo(i,256);g.stroke();}}
 const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=2;return tex;
}
function material(name,color,metalness=0,roughness=.8,texture=null,emissive=null){mat[name]=new T.MeshStandardMaterial({color,metalness,roughness,map:texture,emissive:emissive||0,emissiveIntensity:emissive?2:0});return mat[name];}
const roadTex=surface('road'),concreteTex=surface('concrete'),clothTex=surface('cloth');
material('suit','#9d9279',0,.95,clothTex);material('dark','#222e30',.15,.8);material('rubber','#1b2424',0,.94);
material('armor','#596b62',.12,.78);material('edge','#a6a792',.65,.37);material('orange','#bf6b36',.25,.6);
material('steel','#6a797b',.78,.4);material('rust','#7c4d37',.3,.9);material('glass','#122f38',.7,.19);
material('cyan','#65cec8',.2,.28,null,'#2d8e89');material('red','#dd603e',.3,.45,null,'#b53114');
material('road','#9b9b92',.08,.86,roadTex);material('concrete','#b3ad98',.02,.94,concreteTex);
material('wall','#838e88',.04,.87,concreteTex);material('black','#29383a',.2,.8);material('stripe','#d3b777',0,.95);
material('ground','#646c57',0,1,concreteTex);material('grass','#787952',0,1);material('light','#fff5bc',0,.3,null,'#ffae40');
function bevelGeometry(){const sh=new T.Shape();sh.moveTo(-.46,-.5);sh.lineTo(.46,-.5);sh.quadraticCurveTo(.5,-.5,.5,-.46);sh.lineTo(.5,.46);sh.quadraticCurveTo(.5,.5,.46,.5);sh.lineTo(-.46,.5);sh.quadraticCurveTo(-.5,.5,-.5,.46);sh.lineTo(-.5,-.46);sh.quadraticCurveTo(-.5,-.5,-.46,-.5);const geo=new T.ExtrudeGeometry(sh,{depth:.92,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.025,bevelThickness:.04,curveSegments:2});geo.translate(0,0,-.46);return geo;}
for(const [name,bank] of Object.entries({road:'asphalt_03',concrete:'concrete_floor',wall:'gravel_embedded_concrete',ground:'gravel_embedded_concrete',rust:'rusty_painted_metal'})){Object.assign(mat[name],surfaces[bank]);mat[name].color.set(name==='road'?'#8f9391':name==='ground'?'#777e6d':'#d8d4c9');mat[name].normalScale.set(name==='road'?.9:.65,name==='road'?.9:.65);mat[name].roughness=1;}
mat.corrugated=new T.MeshStandardMaterial({...surfaces.corrugated_iron,color:'#b2b7b2',roughness:.9,metalness:.65});mat.corrugated.normalScale.set(.55,.55);
const bevelGeo=bevelGeometry();
function tailoredGeometry(){const pos=[],uv=[],indices=[],rings=16,segs=16;
 for(let i=0;i<=rings;i++){const v=i/rings,t=v*2-1,profile=Math.pow(Math.max(.001,1-t*t),.34);for(let j=0;j<=segs;j++){const a=j/segs*Math.PI*2,fold=1+.022*Math.sin(v*30+Math.sin(a*3)*1.8)*Math.sin(v*Math.PI);pos.push(Math.cos(a)*profile*fold,t,Math.sin(a)*profile*(1+.013*Math.cos(v*32+a*4)));uv.push(j/segs,v);}}
 for(let i=0;i<rings;i++)for(let j=0;j<segs;j++){const k=i*(segs+1)+j;indices.push(k,k+segs+1,k+1,k+1,k+segs+1,k+segs+2);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;}
const tailoredGeo=tailoredGeometry();
const boxGeo=new T.BoxGeometry(1,1,1),sphereGeo=new T.SphereGeometry(1,16,12),cylGeo=new T.CylinderGeometry(1,1,1,12);
function add(parent,geo,ma,p,s,rot){const o=new T.Mesh(geo,typeof ma==='string'?mat[ma]:ma);o.position.set(...p);o.scale.set(...s);if(rot)o.rotation.set(...rot);o.castShadow=true;o.receiveShadow=true;o.userData.smallDetail=worldAuthoring&&s.filter(v=>Math.abs(v)<.09).length>=2;parent.add(o);return o;}
const box=(g,m,p,s,r)=>{const o=add(g,!worldAuthoring&&['armor','edge','suit','steel'].includes(m)?bevelGeo:boxGeo,m,p,s,r);if(['road','concrete','wall','ground','corrugated'].includes(m)){o.geometry=boxGeo.clone();const uv=o.geometry.attributes.uv;for(let i=0;i<uv.count;i++){const face=Math.floor(i/4),a=face<2?s[2]:s[0],b=face===2||face===3?s[2]:s[1];uv.setXY(i,uv.getX(i)*a*.55,uv.getY(i)*b*.55);}uv.needsUpdate=true;}return o;},ell=(g,m,p,s)=>add(g,m==='suit'?tailoredGeo:sphereGeo,m,p,s),cyl=(g,m,p,s,r)=>add(g,cylGeo,m,p,s,r);
function rod(g,m,a,b,r=.03){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);const o=cyl(g,m,av.add(bv).multiplyScalar(.5).toArray(),[r,d.length(),r]);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
function joint(parent,name,p){const g=new T.Group();g.name=name;g.position.set(...p);parent.add(g);return g;}
function batch(root,low=false){root.updateMatrixWorld(true);const groups=new Map();root.traverse(o=>{if(o.isMesh&&!(low&&(o.userData.smallDetail||o.material.transparent))){const key=o.material;const geo=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(geo);}});const out=new T.Group();for(const [m,gs] of groups){const geo=mergeGeometries(gs,false);out.add(new T.Mesh(geo,m));for(const g of gs)g.dispose();}out.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return out;}
// One PBR draw per rigid joint: surface attributes preserve metal/cloth/emissive differences.
const rigMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.8,metalness:.2,...rigMaps});
rigMaterial.onBeforeCompile=shader=>{
 shader.vertexShader='attribute vec3 surface;attribute vec3 glow;varying vec3 vSurface;varying vec3 vGlow;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurface=surface;vGlow=glow;');
 shader.fragmentShader='varying vec3 vSurface;varying vec3 vGlow;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=vSurface.x;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=vSurface.y;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance=vGlow;');
};
function rigidBatch(root){root.updateMatrixWorld(true);const geos=[];root.traverse(o=>{if(!o.isMesh)return;const geo=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld),count=geo.attributes.position.count,c=new Float32Array(count*3),surf=new Float32Array(count*3),glow=new Float32Array(count*3);for(let i=0;i<count;i++){const py=geo.attributes.position.getY(i),px=geo.attributes.position.getX(i),pz=geo.attributes.position.getZ(i);const shade=.93+.07*Math.sin(py*83+px*41)*Math.sin(pz*67+py*32);c.set(o.material.color.clone().multiplyScalar(shade).toArray(),i*3);surf.set([o.material.roughness,o.material.metalness,0],i*3);glow.set(o.material.emissive.clone().multiplyScalar(o.material.emissiveIntensity).toArray(),i*3);}const tile=['suit'].some(k=>mat[k]===o.material)?0:['rubber','dark','black'].some(k=>mat[k]===o.material)?2:['glass','cyan','red','light'].some(k=>mat[k]===o.material)?3:1;
 const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,(tile%2)*.5+.008+uv.getX(i)*.484,(tile<2?.5:0)+.008+uv.getY(i)*.484);
 geo.setAttribute('color',new T.BufferAttribute(c,3));geo.setAttribute('surface',new T.BufferAttribute(surf,3));geo.setAttribute('glow',new T.BufferAttribute(glow,3));geos.push(geo);});
 const result=new T.Mesh(mergeGeometries(geos,false),rigMaterial);result.castShadow=true;result.receiveShadow=true;for(const geo of geos)geo.dispose();return result;}
function compactRigid(root){for(const child of [...root.children]){if(child.isGroup)compactRigid(child);}const rigid=root.children.filter(o=>o.isMesh&&!o.userData.keepMaterial);if(!rigid.length)return;const g=new T.Group();for(const o of rigid)g.add(o);const b=rigidBatch(g);root.add(b);}
// Tailored garment sections and shaped armour are authored as continuous surfaces.
function garment(parent,material,sections,folds=.012){const verts=[],uv=[],ix=[],segments=24;
 for(let i=0;i<sections.length;i++){const [y,rx,rz,cx=0,cz=0]=sections[i];for(let j=0;j<=segments;j++){const a=j/segments*Math.PI*2,wrinkle=1+folds*Math.sin(a*5+i*1.7);verts.push(cx+Math.cos(a)*rx*wrinkle,y,cz+Math.sin(a)*rz*wrinkle);uv.push(j/segments,i/(sections.length-1));}}
 for(let i=0;i<sections.length-1;i++)for(let j=0;j<segments;j++){const k=i*(segments+1)+j;ix.push(k,k+segments+1,k+1,k+1,k+segments+1,k+segments+2);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(ix);geo.computeVertexNormals();const obj=new T.Mesh(geo,mat[material]);parent.add(obj);obj.castShadow=true;obj.receiveShadow=true;return obj;}
function bolt(g,p,r=.012){const o=cyl(g,'edge',p,[r,.012,r]);o.rotateX(Math.PI/2);}
function strap(g,a,b,width=.026){rod(g,'dark',a,b,width);rod(g,'suit',[a[0],a[1],a[2]+.006],[b[0],b[1],b[2]+.006],width*.55);}
function ranger(){const root=new T.Group();root.name='Ranger';const body=joint(root,'spine',[0,1.06,0]);
 garment(body,'suit',[[-.15,.17,.13],[-.08,.205,.145],[.04,.215,.155],[.17,.24,.16],[.32,.25,.155],[.44,.235,.135],[.50,.175,.105],[.54,.09,.085]],.025);
 // Ballistic carrier: shaped plate, textile straps, individual MOLLE loops and buckles.
 box(body,'dark',[0,.26,.157],[.405,.35,.048]);box(body,'armor',[0,.28,.19],[.34,.29,.055],[.055,0,0]);
 for(const sg of [-1,1]){strap(body,[sg*.18,.51,.075],[sg*.155,.05,.195],.026);box(body,'edge',[sg*.155,.42,.159],[.055,.068,.015]);
  box(body,'suit',[sg*.09,.06,.215],[.14,.13,.065]);box(body,'dark',[sg*.09,.10,.254],[.125,.022,.015]);box(body,'edge',[sg*.09,.047,.253],[.024,.035,.012]);}
 for(let row=0;row<3;row++)for(let col=0;col<5;col++)box(body,'suit',[-.135+col*.067,.20+row*.052,.224],[.047,.014,.011]);
 box(body,'orange',[-.12,.36,.224],[.063,.045,.012]);for(const x of [-.025,.0,.025])box(body,'dark',[x,.36,.226],[.012,.028,.008]);
 const pelvis=joint(root,'pelvis',[0,.92,0]);garment(pelvis,'suit',[[-.10,.17,.13],[-.045,.225,.155],[.035,.225,.15],[.085,.205,.135]],.017);
 box(pelvis,'dark',[0,.09,.0],[.43,.055,.29]);box(pelvis,'edge',[0,.09,.153],[.061,.045,.014]);
 for(const sg of [-1,1]){box(pelvis,'suit',[sg*.235,.015,-.01],[.09,.17,.13]);box(pelvis,'dark',[sg*.23,.06,.055],[.075,.021,.025]);}
 // Padded field pack: rounded shell, separate fabric pockets, rolled blanket and compression straps.
 box(body,'dark',[0,.26,-.18],[.34,.47,.12]);box(body,'suit',[0,.25,-.265],[.33,.43,.135]);box(body,'suit',[0,.49,-.245],[.35,.12,.15]);
 box(body,'suit',[0,.16,-.352],[.29,.19,.065]);box(body,'dark',[0,.235,-.391],[.26,.015,.008]);
 for(const sg of [-1,1]){box(body,'suit',[sg*.21,.24,-.247],[.09,.27,.14]);strap(body,[sg*.115,.49,-.325],[sg*.115,.02,-.39],.015);box(body,'edge',[sg*.115,.13,-.397],[.037,.047,.014]);
  cyl(body,'steel',[sg*.21,.30,-.265],[.033,.22,.033]);}
 box(body,'orange',[.06,.18,-.391],[.059,.047,.009]);box(body,'dark',[0,.37,-.34],[.16,.065,.022]);
 for(let i=0;i<4;i++)box(body,'suit',[-.064+i*.04,.37,-.355],[.022,.008,.006]);
 cyl(body,'suit',[0,.57,-.205],[.073,.31,.073],[0,0,Math.PI/2]);for(const x of [-.1,.1])box(body,'dark',[x,.57,-.275],[.024,.11,.018]);
 rod(body,'dark',[-.18,.37,-.21],[-.2,.84,-.23],.005);rod(body,'dark',[.22,.34,-.18],[.25,.09,-.15],.012);
 // CC0 anatomical head, fitted under an original open-front helmet and respirator.
 const head=joint(body,'head',[0,.59,.008]);cyl(head,'suit',[0,-.035,-.01],[.066,.12,.071]);
 const faceGeo=new T.BufferGeometry();faceGeo.setAttribute('position',new T.Float32BufferAttribute(anatomicalHead.positions,3));faceGeo.setAttribute('uv',new T.Float32BufferAttribute(anatomicalHead.uvs,2));faceGeo.setIndex(anatomicalHead.indices);faceGeo.computeVertexNormals();
 const skin=new T.MeshStandardMaterial({color:'#b98e73',roughness:.82,metalness:0});const face=new T.Mesh(faceGeo,skin);face.userData.keepMaterial=true;face.castShadow=true;head.add(face);
 for(const center of Object.values(anatomicalHead.eyes)){const eye=ell(head,'edge',center,[.012,.010,.010]);eye.material=new T.MeshStandardMaterial({color:'#a5a79b',roughness:.33,metalness:0});eye.userData.keepMaterial=true;const iris=ell(head,'glass',[center[0],center[1],center[2]+.009],[.0054,.0054,.0016]);iris.userData.keepMaterial=true;}
 const shell=garment(head,'armor',[[.105,.132,.125],[.16,.145,.139],[.23,.133,.132],[.29,.09,.088],[.315,.015,.015]],0);
 const pos=shell.geometry.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),y=pos.getY(i);if(z>0&&y<.218){const weight=Math.pow(Math.max(0,z/Math.max(.01,Math.hypot(x,z))),4);pos.setY(i,y+(.218-y)*weight);}}shell.geometry.computeVertexNormals();
 for(const sg of [-1,1]){box(head,'dark',[sg*.137,.155,-.005],[.018,.09,.095]);
  rod(head,'dark',[sg*.13,.16,-.02],[sg*.09,.04,.105],.009);box(head,'armor',[sg*.141,.18,-.015],[.014,.035,.06]);
  cyl(head,'rubber',[sg*.080,.016,.125],[.029,.044,.029],[Math.PI/2,0,0]);cyl(head,'steel',[sg*.080,.016,.152],[.022,.012,.022],[Math.PI/2,0,0]);
  for(let i=0;i<4;i++)box(head,'dark',[sg*.08-.015+i*.010,.016,.160],[.003,.028,.003]);
 }
 box(head,'rubber',[0,.035,.132],[.103,.085,.040],[.15,0,0]);ell(head,'rubber',[0,.075,.137],[.028,.029,.034]);
 for(const sg of [-1,1]){box(head,'dark',[sg*.043,.143,.107],[.089,.050,.020],[0,-sg*.08,0]);box(head,'glass',[sg*.043,.143,.120],[.074,.036,.008],[0,-sg*.08,0]);}box(head,'dark',[0,.143,.113],[.015,.015,.014]);
 box(head,'armor',[0,.255,.118],[.067,.026,.023]);rod(head,'dark',[-.10,.26,-.065],[.10,.26,-.065],.007);
 // Continuous clothing sections around the joints; elbow and knee pads sit over cloth.
 for(const sg of [-1,1]){const side=sg<0?'L':'R',arm=joint(body,'arm'+side,[sg*.265,.49,.008]);
  garment(arm,'suit',[[-.30,.064,.067],[-.24,.071,.078],[-.15,.087,.092],[-.06,.095,.10],[.0,.073,.078]],.028);
  box(arm,'armor',[sg*.04,-.055,-.06],[.135,.125,.052],[0,0,-sg*.15]);box(arm,'orange',[sg*.099,-.056,.013],[.009,.045,.066]);
  const fore=joint(arm,'fore'+side,[0,-.29,0]);garment(fore,'suit',[[-.285,.049,.054],[-.23,.056,.060],[-.13,.068,.071],[-.05,.075,.076],[.025,.063,.066]],.025);
  box(fore,'dark',[0,-.025,-.059],[.105,.088,.037]);box(fore,'armor',[0,-.14,-.055],[.10,.13,.036]);
  const hand=joint(fore,'hand'+sg,[0,-.28,0]);ell(hand,'rubber',[0,-.025,.005],[.047,.054,.031]);
  for(let f=0;f<4;f++){const x=-.031+f*.021;rod(hand,'rubber',[x,-.03,.024],[x,-.072,.043],.010);rod(hand,'rubber',[x,-.072,.043],[x,-.089,.022],.009);ell(hand,'armor',[x,-.046,.023],[.009,.012,.009]);}
  rod(hand,'rubber',[sg*.039,-.012,.018],[sg*.061,-.038,.046],.012);
  const thigh=joint(root,'thigh'+side,[sg*.119,.9,0]);garment(thigh,'suit',[[-.43,.077,.080],[-.36,.089,.091],[-.25,.103,.106],[-.12,.115,.118],[-.02,.103,.11],[.04,.085,.09]],.034);
  box(thigh,'suit',[sg*.09,-.19,.015],[.07,.17,.145]);box(thigh,'dark',[sg*.12,-.12,.015],[.009,.024,.13]);
  const shin=joint(thigh,'shin'+side,[0,-.42,0]);garment(shin,'suit',[[-.37,.054,.060],[-.29,.064,.071],[-.17,.080,.083],[-.06,.084,.091],[.025,.075,.077]],.035);
  box(shin,'dark',[0,-.02,.081],[.127,.14,.036]);box(shin,'armor',[0,-.025,.107],[.10,.12,.037],[.08,0,0]);
  for(const y of [-.095,.045])box(shin,'dark',[0,y,-.006],[.142,.022,.17]);
  const boot=joint(shin,'boot'+sg,[0,-.37,.025]);ell(boot,'rubber',[0,-.035,.035],[.083,.09,.145]);box(boot,'dark',[0,-.10,.04],[.175,.037,.28]);box(boot,'rubber',[0,-.04,.129],[.159,.073,.075]);
  for(let i=0;i<5;i++){rod(boot,'suit',[-.041,.02-i*.012,.028+i*.016],[.041,.013-i*.012,.028+i*.016],.004);}
 }
 const gun=joint(body,'weapon',[.16,.29,.25]);box(gun,'dark',[0,0,.1],[.083,.105,.40]);box(gun,'steel',[0,.012,.15],[.09,.075,.27]);
 box(gun,'dark',[0,-.075,.02],[.052,.13,.058],[.16,0,0]);box(gun,'armor',[0,-.10,.16],[.057,.16,.075],[-.17,0,0]);box(gun,'dark',[0,0,-.17],[.07,.105,.16]);
 rod(gun,'steel',[0,.018,.28],[0,.018,.57],.018);const barrel=cyl(gun,'dark',[0,.018,.59],[.026,.08,.026],[Math.PI/2,0,0]);
 for(let i=0;i<7;i++)box(gun,'dark',[0,.062,.16+i*.023],[.083,.018,.010]);
 box(gun,'dark',[0,.093,.055],[.047,.064,.10]);box(gun,'glass',[0,.108,.099],[.030,.03,.018]);
 for(const sg of [-1,1]){box(gun,'armor',[sg*.048,0,.24],[.014,.056,.17]);for(let i=0;i<5;i++)box(gun,'dark',[sg*.057,.01,.19+i*.026],[.007,.014,.013]);}
 compactRigid(root);return root;
}
function bot(heavy=false){const root=new T.Group();root.name=heavy?'Bastion':'Strider';
 const shell=joint(root,'carapace',[0,1.03,0]);box(shell,'dark',[0,.01,0],[1.10,.30,1.04]);box(shell,'armor',[0,.16,-.04],[.98,.22,.94],[.06,0,0]);
 box(shell,heavy?'armor':'steel',[0,.16,0],[1.12,.25,1.02]);box(shell,'dark',[0,.29,0],[1.05,.035,.96]);
 for(const s of [-1,1]){box(shell,heavy?'edge':'armor',[s*.49,.03,0],[.16,.32,.93],[0,0,s*.17]);
 box(shell,'orange',[s*.585,.07,.22],[.015,.15,.26]);for(let i=0;i<5;i++)box(shell,'dark',[s*.51,.32,-.31+i*.12],[.18,.025,.045]);}
 const turret=joint(shell,'turret',[0,.36,.04]);box(turret,'armor',[0,.06,-.04],[.53,.26,.54],[.08,0,0]);box(turret,'dark',[0,.07,.31],[.48,.18,.12]);
 box(turret,'rubber',[0,.07,.39],[.28,.115,.04]);ell(turret,'glass',[0,.07,.418],[.107,.049,.016]);cyl(turret,'red',[0,.07,.45],[.028,.025,.028],[Math.PI/2,0,0]);
 for(const s of [-1,1]){const gun=joint(turret,'cannon'+s,[s*(heavy?.41:.28),-.05,.12]);box(gun,'dark',[0,0,.08],[.15,.14,.32]);rod(gun,'steel',[0,0,.16],[0,0,heavy?.8:.57],heavy?.055:.035);box(gun,'orange',[0,.04,.1],[.1,.015,.14]);}
 cyl(shell,'steel',[0,-.29,-.42],[.13,.2,.13]);cyl(shell,'red',[0,-.38,-.42],[.08,.04,.08]);
 for(const s of [-1,1])for(const f of [-1,1]){
  const leg=joint(root,`hip${s}${f}`,[s*.49,.95,f*.39]);cyl(leg,'dark',[0,0,0],[.12,.22,.12],[0,0,Math.PI/2]);cyl(leg,'steel',[s*.118,0,0],[.095,.018,.095],[0,0,Math.PI/2]);
  rod(leg,'steel',[0,0,0],[s*.4,-.22,f*.23],.075);box(leg,'armor',[s*.23,-.12,f*.12],[.35,.13,.18],[0,-s*f*.35,s*.3]);
  const knee=joint(leg,`knee${s}${f}`,[s*.4,-.22,f*.23]);cyl(knee,'dark',[0,0,0],[.095,.19,.095],[0,0,Math.PI/2]);cyl(knee,'edge',[s*.102,0,0],[.067,.02,.067],[0,0,Math.PI/2]);
  rod(knee,'edge',[0,0,0],[s*.23,-.61,f*.2],.06);rod(knee,'orange',[s*.08,-.04,0],[s*.28,-.5,f*.1],.022);
  box(knee,'dark',[s*.23,-.59,f*.2],[.25,.1,.34]);box(knee,'armor',[s*.23,-.53,f*.2],[.19,.035,.25]);
 }
 // Layered panels, fasteners, exposed braided cables and hydraulic assemblies.
 for(const side of [-1,1]){box(shell,'dark',[side*.57,.05,-.05],[.12,.21,.73]);
  for(let i=0;i<6;i++){box(shell,'steel',[side*.51,.305,-.31+i*.105],[.17,.025,.05]);bolt(shell,[side*.58,.12,-.39+i*.14],.018);}
  box(shell,'orange',[side*.59,.03,.29],[.014,.09,.18]);
  const hose=new T.CatmullRomCurve3([new T.Vector3(side*.45,-.1,-.35),new T.Vector3(side*.68,-.25,-.20),new T.Vector3(side*.50,-.29,.2)]);add(shell,new T.TubeGeometry(hose,12,.019,6,false),'rubber',[0,0,0],[1,1,1]);
 }
 for(const side of [-1,1])for(const front of [-1,1]){const leg=root.getObjectByName(`hip${side}${front}`),knee=root.getObjectByName(`knee${side}${front}`);
  rod(leg,'dark',[side*.12,-.10,front*.08],[side*.33,-.19,front*.18],.055);rod(leg,'edge',[side*.18,-.12,front*.10],[side*.42,-.24,front*.25],.026);
  box(knee,'armor',[side*.11,-.29,front*.10],[.14,.40,.16],[0,0,-side*.26]);
  for(let j=0;j<3;j++)bolt(knee,[side*.11,-.13-j*.105,front*.2],.014);
  rod(knee,'dark',[0,-.03,0],[side*.12,-.35,front*.08],.043);rod(knee,'edge',[side*.12,-.35,front*.08],[side*.23,-.57,front*.18],.026);
 }
 if(heavy){for(const s of [-1,1]){box(shell,'armor',[s*.55,.4,-.24],[.36,.30,.52]);for(let i=0;i<3;i++)cyl(shell,'dark',[s*.55,.4,-.52+i*.13],[.07,.23,.07],[Math.PI/2,0,0]);}box(shell,'edge',[0,-.03,.57],[.68,.26,.14]);}
 compactRigid(root);return root;
}
function drone(){const root=new T.Group();root.name='Kestrel';box(root,'armor',[0,0,0],[.65,.18,.71],[.05,0,0]);box(root,'dark',[0,-.1,0],[.48,.1,.51]);box(root,'armor',[0,.11,-.02],[.49,.12,.47]);
 const sensor=joint(root,'turret',[0,-.13,.3]);ell(sensor,'dark',[0,0,0],[.16,.12,.15]);ell(sensor,'red',[0,0,.12],[.09,.04,.025]);rod(sensor,'dark',[0,-.08,.07],[0,-.08,.35],.03);
 for(const s of [-1,1])for(const f of [-1,1]){const x=s*.65,z=f*.45;rod(root,'dark',[s*.25,0,f*.23],[x,0,z],.045);
 const ring=new T.Mesh(new T.TorusGeometry(.24,.035,6,24),mat.armor);ring.rotation.x=Math.PI/2;ring.position.set(x,.03,z);root.add(ring);
 const rotor=joint(root,`rotor${s}${f}`,[x,.025,z]);for(let i=0;i<8;i++)box(rotor,'steel',[Math.sin(i*Math.PI/4)*.12,0,Math.cos(i*Math.PI/4)*.12],[.065,.014,.21],[.12,i*Math.PI/4,.07]);cyl(rotor,'orange',[0,.015,0],[.042,.04,.042]);
 box(root,'cyan',[x,.04,z+f*.25],[.08,.02,.03]);}
 compactRigid(root);return root;
}
function loot(){const g=new T.Group();box(g,'dark',[0,.25,0],[.85,.43,.54]);box(g,'suit',[0,.27,0],[.77,.36,.56]);box(g,'steel',[0,.49,0],[.86,.07,.58]);
 for(const s of [-1,1]){box(g,'orange',[s*.3,.28,.29],[.06,.34,.03]);box(g,'dark',[s*.3,.5,0],[.07,.025,.59]);}
 box(g,'cyan',[0,.3,.3],[.26,.08,.025]);rod(g,'steel',[-.14,.55,0],[.14,.55,0],.025);return batch(g);}
function gate(){const g=new T.Group();cyl(g,'dark',[0,.03,0],[2.8,.06,2.8]);
 const ring=new T.Mesh(new T.TorusGeometry(2.6,.035,6,60),mat.cyan);ring.rotation.x=-Math.PI/2;ring.position.y=.075;g.add(ring);
 for(const s of [-1,1]){box(g,'steel',[s*2.5,1.5,0],[.23,3,.27]);box(g,'cyan',[s*2.5,1.5,-.15],[.05,2.4,.05]);box(g,'orange',[s*2.5,.25,0],[.4,.5,.45]);}box(g,'steel',[0,3.05,0],[5.2,.22,.27]);box(g,'cyan',[0,3.05,-.15],[1.3,.06,.03]);return batch(g);}
const facadeVariants=['#afb8b1','#aaa18e','#8d9a98'].map(c=>{const m=mat.wall.clone();m.color.set(c);return m});
function world(){const g=new T.Group(),obstacles=[];seed=3456534;worldAuthoring=true;
 box(g,'ground',[0,-.17,0],[180,.28,180]);box(g,'road',[0,-.008,1],[15,.045,71]);box(g,'road',[0,-.01,-3],[53,.04,10]);
 for(let z=-31;z<33;z+=4){box(g,'stripe',[0,.018,z],[.09,.006,1.55]);}
 for(const s of [-1,1]){box(g,'concrete',[s*8,.04,0],[.7,.14,65]);box(g,'stripe',[s*6.9,.017,0],[.10,.008,65]);for(let z=-31;z<32;z+=2){box(g,'dark',[s*7.35,.025,z],[.2,.01,.38]);}}
 function building(x,z,w,d,h,i){mat.wall=facadeVariants[i%facadeVariants.length];
  // Recessed interior core and real facade bays give windows physical reveals.
  box(g,'black',[x,h/2,z],[w-.62,h-.22,d-.62]);
  for(const side of [-1,1]){
   const zz=z+side*d/2;
   for(let floor=0;floor<h;floor+=2.2){const y=Math.min(h-.22,floor+.55);
    box(g,'wall',[x,y,zz],[w,.84,.27]);box(g,'concrete',[x,floor+.94,zz+side*.03],[w,.12,.35]);
    if(floor+2.15<h){for(let xx=x-w/2+.42;xx<x+w/2;xx+=1.5){
     box(g,'wall',[xx-.6,floor+1.63,zz],[.42,1.43,.30]);
     box(g,'dark',[xx,floor+1.61,zz-side*.14],[.90,1.10,.035]);
     for(const sg of [-1,1])box(g,'steel',[xx+sg*.45,floor+1.61,zz+side*.02],[.036,1.15,.035]);
     box(g,'steel',[xx,floor+1.60,zz+side*.045],[.88,.035,.035]);
     if(rand()>.25)box(g,'glass',[xx,floor+1.61,zz-side*.08],[.85,1.04,.018]);
     if(rand()>.65)box(g,'rust',[xx+.07,floor+1.6,zz+side*.04],[.045,1.07,.025],[0,0,.5]);
     box(g,'concrete',[xx,floor+1.02,zz+side*.10],[.98,.10,.43]);
    }}
   }
   const sign=new T.Mesh(new T.PlaneGeometry(3.1,1.55),new T.MeshStandardMaterial({map:sectorSign,transparent:true,roughness:1,metalness:0,polygonOffset:true,polygonOffsetFactor:-1}));sign.position.set(x,h*.29,zz+side*.17);sign.rotation.y=side<0?Math.PI:0;g.add(sign);
  }
  for(const side of [-1,1]){const xx=x+side*w/2;
   for(let floor=0;floor<h;floor+=2.2){box(g,'wall',[xx,Math.min(h-.2,floor+.55),z],[.27,.84,d]);box(g,'concrete',[xx+side*.03,floor+.96,z],[.35,.12,d]);
    if(floor+2.15<h)for(let zz=z-d/2+.8;zz<z+d/2;zz+=1.7){box(g,'wall',[xx,floor+1.63,zz-.64],[.29,1.43,.48]);box(g,'dark',[xx-side*.15,floor+1.6,zz],[.035,1.12,.97]);
     box(g,'steel',[xx+side*.025,floor+1.6,zz],[.035,.032,.95]);for(const sg of [-1,1])box(g,'steel',[xx+side*.025,floor+1.6,zz+sg*.48],[.035,1.15,.032]);
     if(rand()>.26)box(g,'glass',[xx-side*.08,floor+1.6,zz],[.018,1.04,.91]);box(g,'concrete',[xx+side*.09,floor+1.02,zz],[.41,.1,1.02]);
    }
   }
   rod(g,'rust',[xx+side*.2,.12,z-d*.34],[xx+side*.2,h+.15,z-d*.34],.055);
   for(const yy of [1.3,4.4,7.2])box(g,'steel',[xx+side*.19,yy,z-d*.34],[.14,.09,.14]);
  }
  box(g,'concrete',[x,h+.1,z],[w+.38,.22,d+.38]);
  for(const side of [-1,1]){for(let j=0;j<4;j++){const width=w*.19,xx=x-w*.38+j*w*.25;box(g,'wall',[xx,h+.45+rand()*.13,z+side*d*.49],[width,.65,.3]);rod(g,'rust',[xx+width*.32,h+.55,z+side*d*.49],[xx+width*.32,h+1.05,z+side*d*.49],.013);}}
  box(g,'steel',[x,h+.52,z],[1.8,.72,1.45]);for(let j=0;j<8;j++)box(g,'dark',[x-.75+j*.21,h+.53,z-d*.02-.735],[.10,.43,.015]);
  for(const zz of [-d*.25,d*.25]){box(g,'corrugated',[x-w*.25,h+.30,z+zz],[1.0,.42,1.0]);rod(g,'dark',[x-w*.25,h+.50,z+zz],[x-w*.1,h+.5,z+zz],.035);}
  obstacles.push({x,z,w:w+.45,d:d+.45,h});
 }

 [[-20,-17,10,10,10],[20,-17,9,11,13],[-21,6,10,15,15],[22,9,9,13,12],[-22,27,11,10,9],[22,26,10,10,17],[2,38,23,9,20]].forEach((b,i)=>building(...b,i));
 // Distant skyline, industrial stacks and collapsed roof ribs.
 for(let i=0;i<22;i++){const x=(rand()-.5)*150,z=58+rand()*21,h=8+rand()*24;box(g,'wall',[x,h/2,z],[5+rand()*8,h,6+rand()*8]);}
 for(const x of [-38,36]){cyl(g,'concrete',[x,11,31],[1,22,1]);for(const y of [8,15,20])cyl(g,'rust',[x,y,31],[1.04,.5,1.04]);}
 const cover=[[-9,-11,3.2,2.5],[8,-8,3.6,2.2],[-7,5,3,2.5],[7,15,4,2.5],[0,9,2.7,1.8],[-12,18,2.7,2.8]];
 cover.forEach(([x,z,w,d],i)=>{const h=i%3===0?2.4:1.45;if(i%2){const shape=new T.Shape();shape.moveTo(-d/2,0);shape.lineTo(d/2,0);shape.lineTo(d*.27,h*.39);shape.lineTo(d*.17,h*.66);shape.lineTo(d*.17,h);shape.lineTo(-d*.17,h);shape.lineTo(-d*.17,h*.66);shape.lineTo(-d*.27,h*.39);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:w,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:1,steps:1});geo.translate(0,0,-w/2);geo.rotateY(Math.PI/2);add(g,geo,'concrete',[x,0,z],[1,1,1]);}
  else{box(g,'corrugated',[x,h/2,z],[w,h,d]);for(const sg of [-1,1]){box(g,'dark',[x+sg*w*.235,h*.5,z-d/2-.03],[w*.45,h*.91,.045]);box(g,'corrugated',[x+sg*w*.235,h*.5,z-d/2-.065],[w*.43,h*.88,.04]);rod(g,'steel',[x+sg*w*.12,.2,z-d/2-.12],[x+sg*w*.12,h-.18,z-d/2-.12],.025);for(const yy of [.22,h-.22])box(g,'edge',[x+sg*w*.12,yy,z-d/2-.13],[.12,.07,.035]);}}
  box(g,'edge',[x,h,z],[w+.08,.08,d+.08]);for(let a=-w/2+.15;a<w/2;a+=.3){box(g,'dark',[x+a,h*.5,z-d/2-.015],[.035,h*.8,.03]);box(g,'dark',[x+a,h*.5,z+d/2+.015],[.035,h*.8,.03]);}
  box(g,'orange',[x,h*.6,z-d/2-.04],[w*.65,.08,.03]);for(let s=-1;s<=1;s+=2)box(g,'steel',[x+s*w*.42,h/2,z-d/2-.055],[.06,h*.8,.05]);
  obstacles.push({x,z,w:w+.2,d:d+.2,h:h+.08});});
 // Skeletal loading gantry and collapsed concrete slabs beside the supply routes.
 for(const side of [-1,1]){const x=side*12.9;for(const z of [-9,4,18]){box(g,'concrete',[x,1.6,z],[.34,3.2,.4]);rod(g,'rust',[x,3.25,z],[x+.14,4.1,z],.016);}box(g,'rust',[x,3.2,4.5],[.22,.24,28]);
  for(const z of [-7,6,19]){box(g,'concrete',[x-side*.8,.35,z],[1.6,.28,.85],[0,.14,.24*side]);}
 }
 for(let i=0;i<9;i++){const x=-12+i*.34;box(g,'stripe',[x,.025,-24],[.16,.012,.65],[0,.5,0]);}
 // Original scene dressing built to physical scale, batched with the static architecture.
 for(const side of [-1,1]){for(const zz of [-19,-1,12,24]){const x=side*(9.8+rand()*.6),z=zz;
  const drum=new T.Group();drum.position.set(x,0,z);garment(drum,'rust',[[.01,.28,.28],[.04,.30,.30],[.1,.30,.30],[.35,.305,.305],[.38,.32,.32],[.41,.305,.305],[.68,.30,.30],[.72,.32,.32],[.76,.30,.30],[.87,.29,.29]],0);
  cyl(drum,'steel',[0,.875,0],[.29,.015,.29]);for(const yy of [.04,.38,.72,.87]){const ring=new T.Mesh(new T.TorusGeometry(.303,.012,5,32),mat.dark);ring.rotation.x=Math.PI/2;ring.position.y=yy;drum.add(ring);}cyl(drum,'dark',[.14,.89,.05],[.034,.018,.034]);g.add(drum);obstacles.push({x,z,w:.64,d:.64,h:.9});
 }
 for(const z of [-15,14]){const x=side*13.6;box(g,'armor',[x,.85,z],[.61,1.7,.48]);box(g,'dark',[x+side*.315,.85,z],[.025,1.48,.41]);box(g,'edge',[x+side*.34,.82,z+.12],[.03,.16,.045]);
  for(let j=0;j<7;j++)box(g,'black',[x+side*.33,.3+j*.07,z],[.014,.023,.31]);obstacles.push({x,z,w:.67,d:.5,h:1.7});}
 }
 // Shallow water uses a reflective physical material and an irregular shoreline.
 const water=new T.MeshPhysicalMaterial({color:'#303d3e',metalness:0,roughness:.55,clearcoat:.3,clearcoatRoughness:.08,ior:1.33,transparent:true,opacity:.18,depthWrite:false});
 for(let i=0;i<13;i++){const x=(i%2?-1:1)*(4.9+rand()*1.5),z=-27+rand()*55,shape=new T.Shape();
  for(let j=0;j<=20;j++){const a=j/20*Math.PI*2,r=.55+rand()*.28,xx=Math.cos(a)*r,zz=Math.sin(a)*r*(1.1+rand());if(j===0)shape.moveTo(xx,zz);else shape.lineTo(xx,zz);}
  const puddle=new T.Mesh(new T.ShapeGeometry(shape),water);puddle.rotation.x=-Math.PI/2;puddle.position.set(x,.025,z);g.add(puddle);
 }
 for(const z of [-17,1,22]){cyl(g,'dark',[1.3,.028,z],[.39,.018,.39]);for(let j=0;j<9;j++)box(g,'steel',[1.3-.29+j*.07,.045,z],[.017,.009,.49]);}
 // Sagging service cables and diagonal bracing break the sterile skyline.
 for(const side of [-1,1]){const x=side*13.1,curve=new T.CatmullRomCurve3([new T.Vector3(x,5.1,-25),new T.Vector3(x,4.1,-7),new T.Vector3(x,5.1,12),new T.Vector3(x,4.5,29)]);add(g,new T.TubeGeometry(curve,32,.012,4,false),'black',[0,0,0],[1,1,1]);}
 // Rubble sits beside traversal corridors; fine details are merged by material.
 for(let i=0;i<230;i++){const x=(rand()-.5)*80,z=(rand()-.5)*80;if(Math.abs(x)<9&&Math.abs(z)<33)continue;const size=.08+rand()*.55;
 const geo=new T.IcosahedronGeometry(1,0);const uv=geo.attributes.uv;for(let q=0;q<uv.count;q++)uv.setXY(q,uv.getX(q)*size,uv.getY(q)*size);add(g,geo,rand()>.15?'concrete':'rust',[x,size*.23,z],[size*.6,size*.35,size*.7],[rand()*.5,rand()*6,rand()*.3]);}
 for(let i=0;i<330;i++){const x=(rand()-.5)*82,z=(rand()-.5)*82;if(Math.abs(x)<9&&Math.abs(z)<34)continue;rod(g,'grass',[x,0,z],[x+.12,.15+rand()*.5,z+.08],.012);}
 for(const [x,z] of [[-8,-27],[8,-25],[-8,25],[8,26]]){rod(g,'dark',[x,0,z],[x,5.5,z],.065);rod(g,'dark',[x,5.5,z],[x+1.5,5.5,z],.06);box(g,'light',[x+1.5,5.42,z],[.55,.06,.28]);}
 for(let i=0;i<20;i++){const x=(i%2?-1:1)*(11+rand()*3),z=-30+rand()*61;box(g,'dark',[x,.13,z],[.45,.25,.65],[0,rand()*3,0]);}
 worldAuthoring=false;return {geometry:batch(g),lowGeometry:batch(g,true),obstacles};
}
function primitive(geo,m){return new T.Mesh(geo,mat[m]);}
function contactShadow(){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),grad=g.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(8,17,18,.48)');grad.addColorStop(.4,'rgba(8,17,18,.28)');grad.addColorStop(1,'rgba(8,17,18,0)');g.fillStyle=grad;g.fillRect(0,0,64,64);const mesh=new T.Mesh(new T.PlaneGeometry(1.5,1.5),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false}));mesh.rotation.x=-Math.PI/2;const root=new T.Group();root.add(mesh);return root;}
function createAll(renderer){const w=world();return {terrain:w.geometry,terrainLow:w.lowGeometry,obstacles:w.obstacles,shadow:contactShadow(),ranger:ranger(),scout:bot(),heavy:bot(true),drone:drone(),loot:loot(),exit:gate(),
 muzzle:primitive(new T.IcosahedronGeometry(.1,0),'light'),sphere:primitive(new T.IcosahedronGeometry(.06,0),'orange'),
 shock:(()=>{const m=primitive(new T.TorusGeometry(1,.014,5,40),'cyan');m.rotation.x=-Math.PI/2;const g=new T.Group();g.add(m);return g;})(),
 beam:primitive(new T.BoxGeometry(.012,.012,1).translate(0,0,.5),'light'),enemyBeam:primitive(new T.BoxGeometry(.025,.025,1).translate(0,0,.5),'red'),
 plume:primitive(new T.IcosahedronGeometry(1,0),'orange')};}
function poseRanger(obj,p,time,aimPitch,flash,hit,dead=false){
 const n=name=>obj.getObjectByName(name),speed=p.move,walk=p.gait||0,swing=Math.sin(walk)*speed,run=p.sprinting?1:0;
 const spine=n('spine');spine.rotation.set((dead?1.3:0)+run*.10+Math.sin(time*1.8)*.008-hit*.13,Math.sin(walk)*.035*speed,dead?-.7:Math.sin(walk)*.025*speed);
 spine.position.y=1.06+Math.abs(Math.sin(walk))*.025*speed;
 n('head').rotation.y=Math.sin(time*.6)*.025;n('head').rotation.x=-aimPitch*.35;
 // Foot targets move backward during stance, lift during swing; two-bone IK plants soles.
 const vx=p.vx||0,vz=p.vz||0,yaw=p.yaw||0,vel=Math.hypot(vx,vz),lx=vel>.1?(vx*Math.cos(yaw)-vz*Math.sin(yaw))/vel:0,lz=vel>.1?(vx*Math.sin(yaw)+vz*Math.cos(yaw))/vel:1;
 const movement=dead?0:speed;
 for(const sg of [-1,1]){const sign=sg<0?'L':'R',thigh=n('thigh'+sign),shin=n('shin'+sign),boot=n('boot'+sg);const cycle=((walk+(sg<0?0:Math.PI))%(Math.PI*2)+Math.PI*2)%(Math.PI*2)/(Math.PI*2);
  const stance=cycle<.5,stride=run?.66:.48,travel=(stance?.5-cycle*2:-.5+(cycle-.5)*2)*stride*movement,raise=stance?0:Math.sin((cycle-.5)*Math.PI*2)*(run?.18:.10)*movement;
  thigh.position.y=.9-movement*(run?.09:.045);
  const start=thigh.position.clone(),target=new T.Vector3(sg*.119+lx*travel,.119+raise,lz*travel),delta=target.clone().sub(start),distance=Math.min(.789,delta.length()),direction=delta.normalize();
  const pole=new T.Vector3(0,0,1);pole.addScaledVector(direction,-pole.dot(direction)).normalize();const along=(.42*.42-.37*.37+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,.42*.42-along*along));
  const knee=start.clone().addScaledVector(direction,along).addScaledVector(pole,height),down=new T.Vector3(0,-1,0);thigh.quaternion.setFromUnitVectors(down,knee.clone().sub(start).normalize());
  shin.quaternion.setFromUnitVectors(down,target.clone().sub(knee).normalize().applyQuaternion(thigh.quaternion.clone().invert()));
  boot.quaternion.copy(thigh.quaternion).multiply(shin.quaternion).invert();
 }

 const reloading=p.reloading>0,rt=(1.25-p.reloading)/1.25;
 const gun=n('weapon');gun.rotation.set(-aimPitch-flash*.6,reloading?-.3*Math.sin(rt*Math.PI):0,reloading?-.35:0);gun.position.z=.25-flash*.18;gun.updateMatrix();
 // Analytic two-bone IK keeps both gloves on the trigger and foregrip through recoil and reload.
 const down=new T.Vector3(0,-1,0);
 for(const side of [-1,1]){const arm=n(side<0?'armL':'armR'),fore=n(side<0?'foreL':'foreR');
 let target=new T.Vector3(side<0?-.07:0,side<0?-.045:-.07,side<0?.12:.02).applyMatrix4(gun.matrix);
 if(side<0&&reloading){const reach=Math.sin(rt*Math.PI);target.lerp(new T.Vector3(.12,.035,.2),reach);}
 if(dead)target.set(side*.3,-.05,.05);
 const shoulder=arm.position.clone(),delta=target.clone().sub(shoulder),distance=Math.min(.569,Math.max(.03,delta.length())),direction=delta.normalize();
 const pole=new T.Vector3(side*.65,-.3,-.25);pole.addScaledVector(direction,-pole.dot(direction)).normalize();
 const along=(.29*.29-.28*.28+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,.29*.29-along*along));
 const elbow=shoulder.clone().addScaledVector(direction,along).addScaledVector(pole,height);
 arm.quaternion.setFromUnitVectors(down,elbow.clone().sub(shoulder).normalize());
 const localDir=target.clone().sub(elbow).normalize().applyQuaternion(arm.quaternion.clone().invert());fore.quaternion.setFromUnitVectors(down,localDir);
 }

}
function poseBot(obj,e,time){if(e.type==='drone'){for(const s of [-1,1])for(const f of [-1,1])obj.getObjectByName(`rotor${s}${f}`).rotation.y=time*65*s;
 obj.rotation.z=Math.sin(time*2+e.phase)*.045;return;}
 const shell=obj.getObjectByName('carapace');shell.position.y=1.03+Math.sin(time*6+e.phase)*.025;const turret=obj.getObjectByName('turret');turret.rotation.y=Math.sin(time*.8+e.phase)*.12;turret.rotation.x=-e.flash*.8;
 for(const s of [-1,1])for(const f of [-1,1]){const a=Math.sin(time*5+e.phase+(s*f>0?0:Math.PI));obj.getObjectByName(`hip${s}${f}`).rotation.x=a*.18;obj.getObjectByName(`knee${s}${f}`).rotation.z=s*Math.max(0,a)*.18;}
}
window.DUSTMODELS={createAll,poseRanger,poseBot,materials:mat};
