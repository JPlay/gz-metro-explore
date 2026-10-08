import * as THREE from 'three';
import { Scene } from './scene.js';
import { box, column, cyl, ball, mat, roundedBoxGeo, PALETTE as P } from '../world/blocks.js';
import { makeTrain, tree, kapok, screenDoor, stationSign } from '../world/props.js';
import { tween, wait, Ease } from '../core/tween.js';
import * as Audio from '../audio/audio.js';
import * as Ann from '../audio/announcements.js';
import * as Ambience from '../audio/ambience.js';

/*
 * 站间行车：黄色列车停在画面中央，方块城市从旁边缓缓流过（循环复用的布景池，低开销）。
 * 起步 → 匀速时播“下一站”三语广播 → 广播结束后制动，同时播“即将到达”→ 主题色站台滑入并对齐 → 进站。
 * 最后一程（东山口之后）不报站，安静地开回城市。
 */
const SPAN = 44;
export class RideScene extends Scene {
  constructor(game) {
    super(game); this.kind = 'ride';
    this.theme = { top: '#d9ecf6', bottom: '#fdf3e2', fog: 0xf3efe6 };
    this.pool = []; this.v = 0; this.vMax = 7;
  }
  build() {
    const R = this.root;
    this.train = makeTrain(3);
    this.train.group.position.set(4.5, 0.6, 0); R.add(this.train.group);
    // 高架轨道（静止）与流动的轨枕
    box(R, 0, 0.45, 0, SPAN, 0.3, 1.3, P.stone, { r: 0.08 });
    for (const dz of [-0.3, 0.3]) box(R, 0, 0.63, dz, SPAN, 0.05, 0.07, 0xb8bcc6, { r: 0.02, cast: false });
    for (let i = 0; i < 26; i++) this.pool.push({ m: box(R, 0, 0.6, 0, 0.16, 0.04, 1.0, 0xc9bfae, { r: 0.01, cast: false }), x: -SPAN / 2 + i * (SPAN / 26), kind: 'sleeper' });
    for (let i = 0; i < 12; i++) this.pool.push({ m: column(R, 0, 0, -1.5, 0.3, P.warmGrey, { w: 0.5, d: 0.7, r: 0.1 }), x: -SPAN / 2 + i * (SPAN / 12), kind: 'pillar' });
    // 两侧城市：远侧（z<0）高楼，近侧（z>0）矮块和树，不遮挡列车
    this.buildings = [];
    const cols = [P.peach, P.mint, P.lilac, P.sky, P.pink, P.cream, 0xf9e2a8, P.teal];
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(roundedBoxGeo(1, 1, 1, 0.1), mat(cols[i % cols.length]));
      m.castShadow = false; m.receiveShadow = true; R.add(m);
      this.pool.push({ m, x: -SPAN / 2 + i * (SPAN / 22), kind: 'far', seed: i });
    }
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group(); R.add(g);
      if (i % 3 === 0) tree(g, 0, -1.5, 0, 0.9, i % 2 ? P.green : P.greenDeep);
      else if (i % 3 === 1) box(g, 0, -1.2, 0, 0.9, 0.6, 0.9, cols[(i + 3) % cols.length], { r: 0.1 });
      else kapok(g, 0, -1.5, 0, 0.7);
      this.pool.push({ m: g, x: -SPAN / 2 + i * (SPAN / 14), kind: 'near', seed: i });
    }
    // 偶尔经过的隧道拱门（从列车上方经过）
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group(); R.add(g);
      box(g, 0, 0.6, -1.0, 0.9, 2.4, 0.4, 0xe9e2cf, { r: 0.1 });
      box(g, 0, 2.0, 0, 0.9, 0.4, 2.4, 0xe9e2cf, { r: 0.12 });
      this.pool.push({ m: g, x: i * SPAN / 2, kind: 'arch' });
    }
    // 地面（浮岛条）
    box(R, 0, -1.7, 0, SPAN, 0.4, 9, 0xf3e6cc, { r: 0.2 });
    this.layoutPool();
    // 到站时滑入的站台（主题色），开始时放在远处
    this.platform = new THREE.Group(); R.add(this.platform);
    this.platformParts = null;
    this.levelBox = new THREE.Box3(new THREE.Vector3(-6, -1.5, -3), new THREE.Vector3(9, 3, 3));
  }
  layoutPool() {
    for (const it of this.pool) {
      if (it.kind === 'far') { const h = 1.2 + ((it.seed * 37) % 7) * 0.5; it.m.scale.set(1.1, h, 1.1); it.m.position.set(it.x, -1.5 + h / 2, -2.6 - (it.seed % 3) * 0.9); }
      if (it.kind === 'near') it.m.position.set(it.x, 0, 2.4 + (it.seed % 2) * 0.8);
      if (it.kind === 'sleeper' || it.kind === 'pillar' || it.kind === 'arch') it.m.position.x = it.x;
    }
  }
  buildPlatform(st) {
    this.platform.clear();
    const c = st ? st.color : P.yellow;
    box(this.platform, 0, 0.45, 1.25, 9, 0.3, 1.1, st ? st.palette.floor : P.cream, { r: 0.08 });
    box(this.platform, 0, 0.62, 1.25, 8.8, 0.04, 0.9, st ? st.palette.tile : P.ivory, { r: 0.02, cast: false });
    box(this.platform, 0, 0.62, 0.78, 8.8, 0.045, 0.08, P.yellow, { cast: false });
    for (let i = -3; i <= 3; i++) { const d = screenDoor(this.platform, i * 1.2, 0.6, 0.72, 0.9); }
    box(this.platform, 0, 2.3, 0.4, 9.4, 0.18, 2.4, c, { r: 0.1 });
    for (const x of [-4.3, 4.3]) column(this.platform, x, 1.4, -1.5, 2.2, st ? st.palette.floor : P.cream, { w: 0.4, d: 0.4, r: 0.1 });
    stationSign(this.platform, 2.6, 0.6, 1.5, c);
    if (st && st.id === 'gyq') { tree(this.platform, -3, 0.6, 1.5, 0.8); }
    if (st && st.id === 'njs') { box(this.platform, -3, 1.1, 1.6, 1.6, 1.0, 0.2, P.red, { r: 0.05 }); box(this.platform, -3, 1.66, 1.6, 1.8, 0.12, 0.34, P.roofGreen, { r: 0.04 }); }
    if (st && st.id === 'lsly') { kapok(this.platform, -3, 0.6, 1.5, 0.8); }
    if (st && st.id === 'dsk') { box(this.platform, -3, 1.0, 1.5, 0.9, 0.8, 0.6, P.cream, { r: 0.06 }); }
  }
  fitBox() { return this.levelBox.clone(); }
  /** params: { to: 站 id 或 null（终点回城）, withDestination, onArrive } */
  enter(params) {
    this.params = params; this.v = 0; this.phase = 'accel'; this.t = 0; this.skipped = false;
    this.to = params.to ? this.game.stationById(params.to) : null;
    const st = this.to;
    this.game.setTheme(st ? { top: st.theme.top, bottom: '#fdf3e2', fog: st.theme.fog } : this.theme);
    this.buildPlatform(st);
    this.platform.visible = false;
    this.train.setDoors(0);
    Ambience.setScene('ride');
    this.game.hud.setStation(null);
    this.annDone = !st; // 回城的最后一程没有报站
    if (st) Ann.announceNext(st.id, { withDestination: !!params.withDestination }).then(() => { this.annDone = true; });
    this.minCruise = st ? 6 : 6.5;
  }
  skip() {
    if (this.phase === 'arrived' || this.phase === 'done') return;
    this.skipped = true; Audio.cancelAnnouncements(); this.annDone = true;
    if (this.phase === 'accel' || this.phase === 'cruise') this.startBrake(2.2);
  }
  startBrake(duration = 4.5) {
    this.phase = 'brake';
    const st = this.to;
    if (!st) { this.finish(); return; }
    if (!this.skipped) this.arriveAnn = Ann.announce('arrive', { station: st.id });
    // 匀减速：在 duration 秒内停下，站台刚好滑到列车旁
    const v0 = Math.max(this.v, 2), dist = v0 * duration / 2;
    this.platform.visible = true; this.platform.position.x = (4.5 - 3.02) + dist;
    this.brake = { v0, duration, t: 0, p0: this.platform.position.x };
  }
  async finish() {
    if (this.phase === 'done') return;
    this.phase = 'done';
    if (this.to) {
      Audio.sfx('train.airRelease', { volume: 0.6 });
      tween(1.0, k => this.train.setDoors(k), { owner: this });
      if (this.arriveAnn && !this.skipped) await Promise.race([this.arriveAnn, wait(6, this)]);
      else await wait(1.2, this);
    }
    this.params.onArrive && this.params.onArrive();
  }
  scroll(dx) {
    for (const it of this.pool) {
      it.x -= dx;
      if (it.x < -SPAN / 2) { it.x += SPAN; if (it.seed != null) it.seed += 7; }
    }
    this.layoutPool();
    if (this.platform.visible) this.platform.position.x -= dx;
  }
  update(dt, t) {
    this.t += dt;
    let dx = 0;
    if (this.phase === 'accel') { this.v = Math.min(this.vMax, this.v + dt * 2.6); if (this.v >= this.vMax) this.phase = 'cruise'; }
    if (this.phase === 'cruise' && this.annDone && this.t > this.minCruise) this.startBrake();
    if (this.phase === 'brake' && this.brake) {
      const b = this.brake; b.t = Math.min(b.duration, b.t + dt);
      const k = b.t / b.duration;
      this.v = b.v0 * (1 - k);
      const travelled = b.v0 * b.duration * (k - k * k / 2);
      dx = travelled - (b.p0 - this.platform.position.x);
      this.scroll(dx);
      if (b.t >= b.duration) { this.phase = 'arrived'; this.finish(); }
    } else if (this.phase !== 'arrived' && this.phase !== 'done') {
      this.scroll(this.v * dt);
    }
    // 车身轻微摇晃，速度越快越明显
    const s = this.v / this.vMax;
    this.train.group.position.y = 0.6 + Math.sin(t * 9) * 0.008 * s;
    this.train.group.rotation.x = Math.sin(t * 3.1) * 0.006 * s;
    Ambience.ride(s, this.phase === 'brake');
  }
  exit() { super.exit(); Ambience.ride(0, false); }
}
