/*
 * 列车运营：当前车站每个站台每一侧一个“班次槽”，4 列车循环使用。
 * 状态：away → arriving（减速进站）→ opening → dwell → closing → departing（加速出站）。
 * 乘车：玩家在车里时，列车开进隧道深处（|x|≥80）后，整列车连同玩家平移到 y≈-300 的“行驶隧道”
 *       （灯光往后流动），这时重建下一站；广播结束后再平移到下一站的隧道口，继续减速进站。
 *       所以 40 个车站都能真的坐到，而且用同一套车站模板。
 */
import { Train, HALF } from '../world/train.js';
import { Geo, hex } from '../core/geo.js';
import { mats } from '../core/mats.js';
import { LINES, STATIONS, nextStation, dirFor } from '../data/lines.js';
import * as Ann from '../audio/announcements.js';
const B = window.BABYLON;
const TUN_Y = -300, ACC_T = 8, ARR_T = 9, D0 = 100, VMAX = 22;
const dirKey = (line, step) => Object.keys(LINES[line].dirs).find(d => LINES[line].dirs[d].step === step);

export class Metro {
  constructor(scene, ctx) {
    this.scene = scene; this.ctx = ctx; // ctx: { player, Audio, events, buildStation(code) }
    this.trains = [0, 1, 2, 3].map(i => { const t = new Train(scene, i); t.setVisible(false); return t; });
    this.slots = []; this.ride = null; this.legs = 0; this.buildTunnel();
  }
  buildTunnel() {
    const M = mats(this.scene), g = new Geo(), gl = new Geo(), root = this.tunnel = new B.TransformNode('rideTunnel', this.scene);
    g.slab(-90, 90, -1.75, -1.35, -2.6, 2.6, hex('#4A5260'));
    for (const z of [-0.72, 0.72]) g.slab(-90, 90, -1.35, -1.2, z - 0.05, z + 0.05, hex('#B8C0C8'));
    for (const s of [-1, 1]) g.slab(-90, 90, -1.75, 3.6, s * 2.3, s * 2.6, hex('#596170'));
    g.slab(-90, 90, 3.6, 3.9, -2.6, 2.6, hex('#596170'));
    for (const e of [-1, 1]) g.slab(e * 90 - 0.3, e * 90 + 0.3, -1.75, 3.9, -2.6, 2.6, hex('#15181D'));
    for (const s of [-1, 1]) g.slab(-90, 90, 0.9, 1.1, s * 2.25, s * 2.3, hex('#30353D'));
    const m1 = g.toMesh('tunWalls', this.scene, M.solid, root);
    gl.box(0, 2.6, 0, 0.9, 0.14, 0.05, hex('#FFE9A8'));
    const lamp = gl.toMesh('tunLamp', this.scene, M.glow, root); lamp.isVisible = false;
    this.lamps = [];
    for (let i = 0; i < 24; i++) for (const s of [-1, 1]) { const l = lamp.createInstance('tl'); l.parent = root; l.position.set(-90 + i * 7.5 + (s > 0 ? 3.7 : 0), 0, s * 2.27); this.lamps.push(l); }
    root.position.y = TUN_Y; root.setEnabled(false); m1.isPickable = false;
  }
  /** 新车站建好后调用（riding 列车会被分配到对应槽位） */
  attach(station) {
    this.station = station; this.slots = [];
    const free = this.trains.filter(t => !this.ride || t !== this.ride.train);
    free.forEach(t => t.setVisible(false));
    for (const P of station.platforms) for (const side of [P.sides.A, P.sides.B]) {
      const slot = { P, side, line: P.line, step: side.step, state: 'away', t: 2 + Math.random() * 8, train: null, u: 0, f: 0, ann: false };
      if (this.ride && this.ride.line === P.line && this.ride.step === side.step) { slot.train = this.ride.train; this.ride.slot = slot; }
      else slot.train = free.shift();
      this.slots.push(slot);
    }
    // 起步更快：每个站台先来一班
    this.slots.forEach((s, i) => { if (s.state === 'away') s.t = 3 + i * 3 + Math.random() * 2; });
  }
  playerOn(train) { return train.contains(this.ctx.player.position); }
  setX(slot, x) { const t = slot.train; t.setPos(x, slot.P.y, slot.side.trackZ); }
  doors(slot, f) { slot.f = f; slot.train.setDoors(slot.side.doorSg, f); this.station.setPSD(slot.side.psd, f); }
  update(dt) {
    const p = this.ctx.player.position, A = this.ctx.Audio, seated = !!this.ctx.player.seat;
    if (this.ride && this.ride.phase === 'cruise') return this.cruise(dt);
    let sound = null;
    for (const s of this.slots) {
      const tr = s.train, nx = nextStation(s.line, this.station.code, s.step);
      const aboard = this.playerOn(tr), onPlat = this.ctx.zone && this.ctx.zone.kind === 'platform' && this.ctx.zone.P === s.P;
      s.t -= dt;
      switch (s.state) {
        case 'away':
          if (s.t <= 0) {
            s.state = 'arriving'; s.u = 0; tr.setLine(s.line); tr.setMap(s.line, this.station.code, s.step, nx); tr.setDoors(1, 0); tr.setDoors(-1, 0);
            tr.setVisible(true); this.setX(s, -D0 * s.step); this.carryReset(tr);
            if (onPlat) { Ann.platform(s.line, dirKey(s.line, s.step), s.side.n); A.sfx('train.approach', { volume: 0.8 }); }
          }
          break;
        case 'arriving': {
          s.u = Math.min(1, s.u + dt / ARR_T); const x = -D0 * s.step * (1 - s.u) ** 2;
          this.move(s, x); sound = { speed: (1 - s.u) * 0.9, inside: aboard, braking: true };
          if (s.u >= 1) { s.state = 'opening'; s.t = 1.2; A.sfx('doorChime'); A.sfx('psdOpen', { volume: 0.7 }); A.sfx('doorOpen'); if (aboard) A.sfx('train.airRelease', { volume: 0.6 }); }
          break;
        }
        case 'opening': this.doors(s, 1 - Math.max(0, s.t) / 1.2); if (s.t <= 0) { s.state = 'dwell'; s.t = 10; s.ann = false; } break;
        case 'dwell': {
          const terminalHold = !nx && aboard, hold = terminalHold || (!seated && tr.inDoorway(p));
          if (hold && s.t < 3.2) s.t = 3.2;
          if (!s.ann && s.t < 3.1 && (aboard || onPlat) && !terminalHold) { s.ann = true; Ann.doorsClosing(); A.sfx('doorChime'); }
          if (s.t <= 0) { s.state = 'closing'; s.t = 1.6; A.sfx('doorClose'); A.sfx('psdClose', { volume: 0.7 }); }
          break;
        }
        case 'closing':
          if (!seated && tr.inDoorway(p)) { s.state = 'opening'; s.t = 1.2 * (1 - s.f); s.ann = true; break; }
          this.doors(s, Math.max(0, s.t) / 1.6);
          if (s.t <= 0) {
            this.doors(s, 0); s.state = 'departing'; s.u = 0;
            if (nx) tr.setMap(s.line, this.station.code, s.step, nx, true); // 关门开出：线路图高亮下一站，LCD“下一站”
            if (aboard && nx) { this.legs++; Ann.depart(s.line, nx, dirKey(s.line, s.step), s.step, this.legs === 1 || this.ride?.line !== s.line); A.sfx('train.tractionStart', { volume: 0.7 }); this.ride = { train: tr, line: s.line, step: s.step, phase: 'out', slot: s, next: nx }; }
          }
          break;
        case 'departing': {
          s.u = Math.min(1, s.u + dt / ACC_T); const x = D0 * s.step * s.u * s.u;
          this.move(s, x); sound = { speed: s.u * 0.9, inside: aboard, braking: false };
          if (aboard && nx && Math.abs(x) >= 80) { this.enterTunnel(s, nx); return; }
          if (s.u >= 1) { s.state = 'away'; s.t = 8 + Math.random() * 10; tr.setVisible(false); if (this.ride && this.ride.train === tr && !aboard) this.ride = null; }
          break;
        }
      }
      if (this.ride && this.ride.train === tr && !aboard && s.state !== 'departing' && s.state !== 'arriving') this.ride = null;
    }
    if (sound) A.trainSound(sound); else A.trainSound({ speed: 0 });
  }
  carryReset(tr) { tr.prev.copyFrom(tr.root.position); }
  /** 移动列车；玩家在车上则一起刚性移动 */
  move(s, x) {
    const tr = s.train, pl = this.ctx.player, aboard = this.playerOn(tr);
    const dx = x - tr.root.position.x;
    tr.setPos(x, s.P.y, s.side.trackZ); this.refresh(tr);
    if (aboard) pl.position.x += dx;
  }
  refresh(tr) { tr.root.computeWorldMatrix(true); tr.kit.colliders.forEach(c => c.computeWorldMatrix(true)); }
  enterTunnel(s, nx) {
    const tr = s.train, pl = this.ctx.player, off = pl.position.subtract(tr.root.position);
    this.ride.phase = 'cruise'; this.ride.t = 0; this.ride.off = off; this.ride.from = this.station.code;
    tr.setPos(0, TUN_Y, 0); this.refresh(tr); pl.position.copyFrom(tr.root.position.add(off)); pl.collider.computeWorldMatrix(true);
    this.tunnel.setEnabled(true);
    this.slots.forEach(o => { if (o.train !== tr) o.train.setVisible(false); });
    this.ctx.onTunnel(true);
    // 在隧道里重建下一站（看不见，卡顿也被藏起来）
    this.ctx.buildStation(nx);
    this.ctx.events.emit('ride', { phase: 'cruise', from: this.ride.from, to: nx, line: s.line });
  }
  cruise(dt) {
    const r = this.ride, A = this.ctx.Audio; r.t += dt;
    const step = r.step;
    for (const l of this.lamps) { l.position.x -= step * VMAX * dt; if (l.position.x < -90) l.position.x += 180; if (l.position.x > 90) l.position.x -= 180; }
    A.trainSound({ speed: 1, inside: true, braking: false });
    if ((r.t > 5 && !A.isAnnouncing()) || r.t > 14) this.exitTunnel();
  }
  exitTunnel() {
    const r = this.ride, tr = r.train, pl = this.ctx.player, s = r.slot; // attach() 已把列车分到新站对应槽位
    const off = pl.position.subtract(tr.root.position);
    s.state = 'arriving'; s.u = 1 - Math.sqrt(0.8);
    tr.setLine(r.line); tr.setMap(r.line, this.station.code, r.step, nextStation(r.line, this.station.code, r.step));
    tr.setPos(-D0 * r.step * (1 - s.u) ** 2, s.P.y, s.side.trackZ); this.refresh(tr);
    pl.position.copyFrom(tr.root.position.add(off)); pl.collider.computeWorldMatrix(true);
    this.tunnel.setEnabled(false); r.phase = 'in';
    this.ctx.onTunnel(false);
    Ann.arrive(this.station.code); this.ctx.Audio.sfx('train.brake', { volume: 0.5 });
    this.ctx.events.emit('ride', { phase: 'arrive', to: this.station.code, line: r.line });
  }
  info() {
    return { ride: this.ride ? { phase: this.ride.phase, line: this.ride.line, step: this.ride.step, next: this.ride.next } : null,
      slots: this.slots.map(s => ({ line: s.line, side: s.side.key, step: s.step, state: s.state, t: +s.t.toFixed(1), x: +s.train.root.position.x.toFixed(1), doors: +s.f.toFixed(2) })) };
  }
  /** 测试：让某一侧马上来车 */
  call(line, step) { const s = this.slots.find(o => o.line === line && o.step === step); if (s && s.state === 'away') s.t = 0; return !!s; }
}
