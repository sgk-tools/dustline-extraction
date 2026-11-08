/* v0.4 material bank. Poly Haven assets: CC0. Runtime fetches are all same-origin. */
import * as T from './vendor/three.module.js';
import {RGBELoader} from './vendor/RGBELoader.js';
const loader=new T.TextureLoader();
async function texture(name,color=false){const tex=await loader.loadAsync(new URL('./assets/materials/'+name,import.meta.url).href);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;tex.anisotropy=4;return tex;}
const kinds=['asphalt_03','concrete_floor','rusty_painted_metal','corrugated_iron','gravel_embedded_concrete'];
export const surfaces={};
await Promise.all(kinds.map(async name=>{const [map,normalMap,roughnessMap]=await Promise.all([texture(name+'_diff_1k.jpg',true),texture(name+'_normal_1k.jpg'),texture(name+'_rough_1k.jpg')]);surfaces[name]={map,normalMap,roughnessMap};}));
const [map,normalMap,roughnessMap]=await Promise.all([texture('rig_albedo.jpg',true),texture('rig_normal.jpg'),texture('rig_rough.jpg')]);
export const rigMaps={map,normalMap,roughnessMap};
export const sectorSign=await texture('sector_sign.png',true);
export const environment=await new RGBELoader().loadAsync(new URL('./assets/environment/kloppenheim_06_puresky_1k.hdr',import.meta.url).href);
environment.mapping=T.EquirectangularReflectionMapping;

export const anatomicalHead=await fetch(new URL('./assets/models/anatomical_head.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('人物データの読み込みに失敗');return r.json()});
