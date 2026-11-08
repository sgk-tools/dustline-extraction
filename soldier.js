/* v0.5 skinned soldier. Built in Blender from soldier_study_02 (see DUSTLINE/soldier_game).
   Replaces the procedural ranger for drawing only; movement, aiming and hit rules stay in game.js.
   If the model fails to load, window.DUSTSOLDIER stays undefined and game.js keeps the v0.4 ranger. */
import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

const ADDITIVE = ['Aim', 'Fire', 'Hit', 'Reload'];
const GAIT_STRIDE = {Walk: 1.55, Run: 2.35, Sprint: 2.85};   // metres per full cycle (Blender clips)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ramp = (v, a, b) => clamp((v - a) / (b - a), 0, 1);

class Soldier {
  constructor(gltf) {
    this.root = gltf.scene;
    this.root.name = 'SoldierGLB';
    this.root.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        if (o.material) { this.material = o.material; this.normalMap = o.material.normalMap; }
      }
    });
    this.mixer = new T.AnimationMixer(this.root);
    this.actions = {};
    for (const clip of gltf.animations) {
      // The exporter shares identical keyframe buffers between clips; GLTFLoader keeps them shared.
      // makeClipAdditive edits values in place, so give every track its own copy first.
      for (const t of clip.tracks) { t.times = t.times.slice(); t.values = t.values.slice(); }
      if (ADDITIVE.includes(clip.name)) T.AnimationUtils.makeClipAdditive(clip, 0, clip, 30);
      const a = this.mixer.clipAction(clip);
      this.actions[clip.name] = a;
    }
    for (const [name, a] of Object.entries(this.actions)) {
      if (/^(Walk|Run|Sprint)_/.test(name) || name === 'Idle' || name === 'Aim') {
        a.play(); a.setEffectiveWeight(0);
        if (name !== 'Idle') a.timeScale = 0;
      }
    }
    for (const n of ['Fire', 'Hit', 'Reload', 'Death']) { const a = this.actions[n]; a.setLoop(T.LoopOnce, 1); a.clampWhenFinished = n === 'Death'; }
    this.bone = name => this.root.getObjectByName(name);
    this.spine = this.bone('spine'); this.chest = this.bone('chest'); this.muzzle = this.bone('muzzle');
    this.phase = 0; this.aim = 0; this.prev = {flash: 0, hit: 0, reload: 0, dead: false};
    this.tmpQ = new T.Quaternion(); this.tmpQ2 = new T.Quaternion(); this.axis = new T.Vector3();
    this.added = null;
  }

  attach(scene, quality) {
    if (this.added !== scene) { scene.add(this.root); this.added = scene; }
    if (this.material && this.quality !== quality) {
      this.quality = quality;
      this.material.normalMap = quality === 0 ? null : this.normalMap;
      this.material.needsUpdate = true;
    }
  }

  setLoco(weights) {
    for (const [name, a] of Object.entries(this.actions)) {
      if (!/^(Walk|Run|Sprint)_/.test(name)) continue;
      const w = weights[name] || 0;
      a.setEffectiveWeight(w);
      a.time = this.phase * a.getClip().duration;
    }
  }

  rotateWorld(bone, axis, angle) {
    if (!bone || !angle) return;
    bone.parent.getWorldQuaternion(this.tmpQ);
    bone.getWorldQuaternion(this.tmpQ2);
    const q = new T.Quaternion().setFromAxisAngle(axis, angle).multiply(this.tmpQ2);
    bone.quaternion.copy(this.tmpQ.invert().multiply(q));
  }

  /** s: {x,z,yaw,vx,vz,dt,pitch,aiming,firing,flash,hit,reloading,dead,quality} */
  update(renderer, s) {
    this.attach(renderer.scene, s.quality);
    const r = this.root;
    r.visible = true;
    r.position.set(s.x, 0, s.z);
    r.rotation.set(0, s.yaw, 0);
    const dt = Math.min(.1, s.dt);

    // --- death / retry ---
    const death = this.actions.Death;
    if (s.dead && !this.prev.dead) { death.reset(); death.setEffectiveWeight(1); death.play(); }
    if (!s.dead && this.prev.dead) { death.stop(); }
    this.prev.dead = s.dead;

    // --- locomotion: distance-driven phase, so the feet do not slide ---
    const speed = s.dead ? 0 : Math.hypot(s.vx, s.vz);
    const fwd = speed > .05 ? (s.vx * Math.sin(s.yaw) + s.vz * Math.cos(s.yaw)) / speed : 1;
    const lat = speed > .05 ? (s.vx * Math.cos(s.yaw) - s.vz * Math.sin(s.yaw)) / speed : 0;  // + = soldier's left
    const dirs = {F: Math.max(0, fwd), B: Math.max(0, -fwd), L: Math.max(0, lat), R: Math.max(0, -lat)};
    const dsum = dirs.F + dirs.B + dirs.L + dirs.R || 1;
    const g = {
      Idle: 1 - ramp(speed, .15, 1.3),
      Walk: ramp(speed, .15, 1.3) * (1 - ramp(speed, 3.6, 5.0)),
      Run: ramp(speed, 3.6, 5.0) * (1 - ramp(speed, 6.0, 7.2)),
      Sprint: ramp(speed, 6.0, 7.2) * dirs.F / dsum,
    };
    g.Run += ramp(speed, 6.0, 7.2) * (1 - dirs.F / dsum);
    const moving = g.Walk + g.Run + g.Sprint;
    if (moving > 0) {
      const stride = (g.Walk * GAIT_STRIDE.Walk + g.Run * GAIT_STRIDE.Run + g.Sprint * GAIT_STRIDE.Sprint) / moving;
      this.phase = (this.phase + speed * dt / stride) % 1;
    }
    const deathFade = s.dead ? 0 : 1;
    const w = {};
    for (const d of ['F', 'B', 'L', 'R']) {
      w['Walk_' + d] = g.Walk * dirs[d] / dsum * deathFade;
      w['Run_' + d] = g.Run * dirs[d] / dsum * deathFade;
    }
    w.Sprint_F = g.Sprint * deathFade;
    this.setLoco(w);
    this.actions.Idle.setEffectiveWeight(g.Idle * deathFade);

    // --- upper body overlays ---
    const reloading = s.reloading > 0;
    const wantAim = !s.dead && !reloading && (s.aiming || s.firing || s.flash > 0) ? 1 : 0;
    this.aim += (wantAim - this.aim) * (1 - Math.exp(-dt * (wantAim ? 16 : 6)));
    const aimA = this.actions.Aim;
    aimA.setEffectiveWeight(this.aim);
    aimA.time = aimA.getClip().duration;
    if (s.flash > this.prev.flash + .01) { const a = this.actions.Fire; a.reset(); a.setEffectiveWeight(1); a.play(); }
    if (s.hit > this.prev.hit + .05 && !s.dead) { const a = this.actions.Hit; a.reset(); a.setEffectiveWeight(1); a.play(); }
    if (reloading && !(this.prev.reload > 0)) {
      const a = this.actions.Reload; a.reset(); a.setEffectiveWeight(1);
      a.timeScale = a.getClip().duration / Math.max(.2, s.reloading); a.play();
    }
    if (!reloading) this.actions.Reload.stop();
    this.prev.flash = s.flash; this.prev.hit = s.hit; this.prev.reload = s.reloading;

    this.mixer.update(dt);
    // --- camera pitch bends the spine/chest so the rifle follows the reticle ---
    if (!s.dead) {
      r.updateMatrixWorld(true);
      this.axis.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));   // soldier's left in world space
      const k = .35 + .65 * this.aim;
      this.rotateWorld(this.spine, this.axis, -s.pitch * .35 * k);
      r.updateMatrixWorld(true);
      this.rotateWorld(this.chest, this.axis, -s.pitch * .65 * k);
    }
    r.updateMatrixWorld(true);
  }

  muzzleWorld(out = new T.Vector3()) { return this.muzzle ? this.muzzle.getWorldPosition(out) : null; }
  hide() { this.root.visible = false; }
}

try {
  const gltf = await new GLTFLoader().loadAsync(new URL('./models/soldier_game.glb?v=05', import.meta.url).href);
  window.DUSTSOLDIER = new Soldier(gltf);
} catch (error) {
  console.warn('soldier_game.glb could not be loaded; using the v0.4 ranger', error);
}
