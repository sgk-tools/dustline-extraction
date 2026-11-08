/* DUSTLINE v0.3 — local Three.js renderer. No runtime CDN or network dependency. */
import * as THREE from './vendor/three.module.js';
import {environment} from './materials.js';
import {FXAAShader} from './vendor/FXAAShader.js';
class Renderer {
 constructor(canvas) {
  this.canvas=canvas;
  this.three=new THREE.WebGLRenderer({canvas,alpha:false,antialias:false,powerPreference:'high-performance'});
  this.three.outputColorSpace=THREE.SRGBColorSpace;
  this.three.toneMapping=THREE.ACESFilmicToneMapping;this.three.toneMappingExposure=.95;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#8c9a9b');
  this.scene.fog=new THREE.FogExp2('#b2b7af',.012);this.scene.environment=environment;this.scene.environmentIntensity=.85;this.scene.environmentRotation.y=.7;this.scene.background=environment;this.scene.backgroundBlurriness=.12;this.scene.backgroundIntensity=.75;this.scene.backgroundRotation.y=.7;
  this.camera=new THREE.PerspectiveCamera(60,1,.08,220);
  this.scene.add(new THREE.HemisphereLight('#b9d9ec','#4e483b',.7));
  this.sun=new THREE.DirectionalLight('#ffdfba',2.8);this.sun.position.set(-25,38,-18);
  this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);
  Object.assign(this.sun.shadow.camera,{left:-20,right:20,top:22,bottom:-22,near:1,far:110});
  this.sun.shadow.bias=-.0006;this.sun.shadow.normalBias=.04;
  this.scene.add(this.sun);this.scene.add(this.sun.target);
  const fill=new THREE.DirectionalLight('#c8dce7',.3);fill.position.set(9,9,-30);this.scene.add(fill);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(150,24,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vDir;void main(){vec3 d=normalize(vDir);float h=max(d.y,0.);vec3 c=mix(vec3(.65,.68,.65),vec3(.28,.43,.53),pow(h,.55));float sun=pow(max(dot(d,normalize(vec3(-.52,.6,-.48))),0.),180.);c+=vec3(1.,.65,.28)*sun*.8;gl_FragColor=vec4(c,1.);}'}));sky.name='sky';sky.visible=false;this.scene.add(sky);

  this.three.shadowMap.enabled=true;this.three.shadowMap.type=THREE.PCFSoftShadowMap;
  this.fullNormals=new Map();this.pool=new Map();this.drawcalls=0;this.lost=false;this.scale=1;this.quality=-1;
  this.postTarget=new THREE.WebGLRenderTarget(2,2,{type:THREE.HalfFloatType,depthBuffer:true});
  this.postScene=new THREE.Scene();this.postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  this.postMaterial=new THREE.ShaderMaterial({uniforms:THREE.UniformsUtils.clone(FXAAShader.uniforms),vertexShader:FXAAShader.vertexShader,fragmentShader:FXAAShader.fragmentShader.replace(/}\s*$/, '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'),depthTest:false,depthWrite:false,toneMapped:true});
  this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.postMaterial));this.postSupported=this.three.extensions.has('EXT_color_buffer_float');
  this.raycaster=new THREE.Raycaster();this.lastEye=new THREE.Vector3();
 }
 create(object){return object;}
 resize(w,h,quality=1){
  this.w=w;this.h=h;this.dpr=Math.min(devicePixelRatio||1,quality===0?.85:quality===1?1.3:1.7)*this.scale;
  this.three.setPixelRatio(this.dpr);this.three.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();const bw=Math.round(w*this.dpr),bh=Math.round(h*this.dpr);this.postTarget.setSize(bw,bh);this.postMaterial.uniforms.resolution.value.set(1/bw,1/bh);
  if(this.quality!==quality){this.quality=quality;this.three.shadowMap.enabled=quality>0;this.sun.shadow.needsUpdate=true;for(const [material,normal] of this.fullNormals){material.normalMap=quality===0?null:normal;material.needsUpdate=true;}}
 }
 begin(eye,target,fov=60,time=0){
  this.eye=eye;this.camera.position.fromArray(eye);this.camera.lookAt(...target);
  if(Math.abs(this.camera.fov-fov)>.02){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
  this.camera.updateMatrixWorld();const focus=this.camera.position.clone().addScaledVector(this.camera.getWorldDirection(new THREE.Vector3()),4);focus.y=0;this.sun.target.position.copy(focus);this.sun.position.copy(focus).add(new THREE.Vector3(-25,38,-18));this.sun.target.updateMatrixWorld();for(const p of this.pool.values()){p.used=0;for(const obj of p.items)obj.visible=false;}
 }
 draw(template,x=0,y=0,z=0,yaw=0,scale=1,pitch=0){
  if(!template)return null;let p=this.pool.get(template);
  if(!p){p={items:[],used:0};this.pool.set(template,p);}
  let obj=p.items[p.used++];if(!obj){obj=template.clone(true);p.items.push(obj);obj.traverse(node=>{const material=node.material;if(material&&'normalMap' in material&&!this.fullNormals.has(material)){this.fullNormals.set(material,material.normalMap);if(this.quality===0&&material.normalMap){material.normalMap=null;material.needsUpdate=true;}}});this.scene.add(obj);}
  obj.visible=true;obj.position.set(x,y,z);obj.rotation.set(0,yaw,0,'YXZ');obj.rotateX(pitch);
  if(Array.isArray(scale))obj.scale.fromArray(scale);else obj.scale.setScalar(scale);
  return obj;
 }
 end(){if(this.lost)return;const usePost=this.quality>0&&this.postSupported;
  if(usePost){this.three.setRenderTarget(this.postTarget);this.three.render(this.scene,this.camera);const info=this.three.info.render;const calls=info.calls,triangles=info.triangles;this.three.setRenderTarget(null);this.postMaterial.uniforms.tDiffuse.value=this.postTarget.texture;this.three.render(this.postScene,this.postCamera);this.drawcalls=calls+1;this.frameTriangles=triangles+2;}
  else{this.three.setRenderTarget(null);this.three.render(this.scene,this.camera);this.drawcalls=this.three.info.render.calls;this.frameTriangles=this.three.info.render.triangles;}}

 aimRay(){this.raycaster.setFromCamera(new THREE.Vector2(0,0),this.camera);return this.raycaster.ray.clone();}
 project(p){return p.clone().project(this.camera);}
 dispose(mesh){mesh.traverse?.(o=>{o.geometry?.dispose();});}
}
window.DX3D={Renderer,THREE};
