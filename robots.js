/* v0.5 skinned Sentry Walker (Blender: DUSTLINE/assets/sentry_walker) for the light "scout" enemy.
   Drawing only: AI, hit spheres and damage stay in game.js. Each enemy gets its own skeleton clone.
   If the model fails to load, window.DUSTROBOTS stays undefined and game.js keeps the v0.4 quadruped. */
import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone as cloneSkinned} from './vendor/SkeletonUtils.js';

const WALK_SPEED = .833;          // m/s at which the Walk clip's feet do not slide (Blender report)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

class SentryPool {
  constructor(gltf) {
    this.template = gltf.scene;
    this.clips = Object.fromEntries(gltf.animations.map(c => [c.name, c]));
    this.byId = new Map();
    this.free = [];
    this.scene = null;
    this.materials = new Map();
    this.template.traverse(o => {
      if (!o.isMesh || !o.material) return;
      if (o.material.normalMap) this.materials.set(o.material, o.material.normalMap);
      // the baked atlas was graded for the Blender studio; under the game's sky light it read too pale
      if (o.material.map) o.material.color.setScalar(.72);
    });
  }

  make() {
    const root = cloneSkinned(this.template);
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    const mixer = new T.AnimationMixer(root);
    const actions = {};
    for (const [name, clip] of Object.entries(this.clips)) actions[name] = mixer.clipAction(clip);
    for (const n of ['Attack', 'Hit', 'Destroy']) { actions[n].setLoop(T.LoopOnce, 1); actions[n].clampWhenFinished = true; }
    actions.Idle.play(); actions.Walk.play();
    this.scene.add(root);
    return {root, mixer, actions, prev: null, overlay: null, used: false, dying: false};
  }

  get(id) {
    let inst = this.byId.get(id);
    if (!inst) {
      inst = this.free.pop() || this.make();
      this.byId.set(id, inst);
      inst.prev = null; inst.overlay = null; inst.dying = false; inst.root.visible = true;
      for (const a of Object.values(inst.actions)) { a.stop(); }
      inst.actions.Idle.play(); inst.actions.Walk.play();
    }
    inst.used = true;
    return inst;
  }

  playOverlay(inst, name) {
    const a = inst.actions[name];
    a.reset(); a.play();
    inst.overlay = name;
  }

  /** enemies/corpses: game.js objects. Only type 'scout' is drawn here. */
  update(renderer, enemies, corpses, dt, quality, player, range) {
    if (this.scene !== renderer.scene) this.scene = renderer.scene;
    if (this.quality !== quality) {
      this.quality = quality;
      for (const [m, n] of this.materials) { m.normalMap = quality === 0 ? null : n; m.needsUpdate = true; }
    }
    dt = Math.min(.1, dt);
    for (const inst of this.byId.values()) inst.used = false;

    for (const e of enemies) {
      if (e.type !== 'scout' || e.dead) continue;
      if (Math.hypot(e.x - player.x, e.z - player.z) > range) continue;
      const inst = this.get(e.id);
      const p = inst.prev || {x: e.x, z: e.z, hp: e.hp, flash: e.flash};
      const speed = Math.hypot(e.x - p.x, e.z - p.z) / Math.max(1e-3, dt);
      inst.speedS = (inst.speedS ?? speed) + (speed - (inst.speedS ?? speed)) * (1 - Math.exp(-dt * 8));
      // hit (hp dropped) vs. own shot (flash rose without damage)
      if (e.hp < p.hp - .1) this.playOverlay(inst, 'Hit');
      else if (e.flash > p.flash + .05 && inst.overlay !== 'Hit') this.playOverlay(inst, 'Attack');
      inst.prev = {x: e.x, z: e.z, hp: e.hp, flash: e.flash};

      const walk = clamp((inst.speedS - .15) / .5, 0, 1);
      const a = inst.actions;
      a.Walk.timeScale = clamp(inst.speedS / WALK_SPEED, .6, 3.2);
      let over = 0;
      if (inst.overlay) {
        const o = a[inst.overlay], dur = o.getClip().duration, t = o.time;
        over = Math.min(1, t / .12, (dur - t) / .2);
        if (!o.isRunning() || t >= dur - 1e-3) { o.stop(); inst.overlay = null; over = 0; }
        else o.setEffectiveWeight(Math.max(0, over));
      }
      a.Walk.setEffectiveWeight(walk * (1 - over));
      a.Idle.setEffectiveWeight((1 - walk) * (1 - over));
      inst.root.position.set(e.x, 0, e.z);
      inst.root.rotation.set(0, e.yaw, 0);
      inst.root.visible = true;
      inst.mixer.update(dt);
    }

    for (const c of corpses) {
      if (c.type !== 'scout') continue;
      const inst = this.get(c.id);
      if (!inst.dying) {
        inst.dying = true;
        for (const [n, act] of Object.entries(inst.actions)) if (n !== 'Destroy') act.stop();
        const d = inst.actions.Destroy; d.reset(); d.setEffectiveWeight(1); d.play();
        inst.root.position.set(c.x, 0, c.z);
        inst.root.rotation.set(0, c.yaw, 0);
      }
      inst.root.visible = true;
      inst.mixer.update(dt);
    }

    for (const [id, inst] of this.byId) {
      if (!inst.used) { inst.root.visible = false; this.byId.delete(id); this.free.push(inst); }
    }
  }

  count() { return this.byId.size; }
}

try {
  const gltf = await new GLTFLoader().loadAsync(new URL('./models/sentry_walker_skinned.glb?v=05', import.meta.url).href);
  window.DUSTROBOTS = new SentryPool(gltf);
} catch (error) {
  console.warn('sentry_walker_skinned.glb could not be loaded; using the v0.4 scout', error);
}
