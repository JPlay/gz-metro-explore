import * as THREE from 'three';
import { Scene } from './scene.js';
import { box, column, stairMesh, mat, PALETTE as P } from '../world/blocks.js';
import { Rotator, Slider, Crank } from '../world/mechanisms.js';
import { makeTrain, makeTrack, screenDoor, goalMarker, stationSign } from '../world/props.js';
import { Passenger } from '../characters/passenger.js';
import { WanderNpc, QueueNpc } from '../characters/npc.js';
import { tween, wait, Ease } from '../core/tween.js';
import { CONFIG } from '../core/config.js';
import * as Audio from '../audio/audio.js';
import * as Ann from '../audio/announcements.js';
import * as Ambience from '../audio/ambience.js';

/*
 * 车站关卡基类：一站 = 一个小小的视错觉空间。
 * 子类实现 buildLevel()，用这里的积木方法搭场景，并设置：
 *   this.startId / this.goalId            起点与站台门（终点）节点
 *   this.trackSpec = {y, z, door, clip:[xmin,xmax]}   站台后面的轨道（列车从隧道口滑入）
 *   this.queueSpots = [{pos, yaw}]        排队 NPC 的位置
 *   this.wanderers = [{start, allowed}]   闲逛 NPC
 *   levelHint() → 提示目标 {world, kind, dir?, ccw?}（路还没通时用）
 *   solution() → 测试/调试用的解法步骤
 */
export class StationScene extends Scene {
  constructor(game, station) {
    super(game);
    this.station = station; this.kind = 'station';
    this.theme = station.theme;
    this.S = new THREE.Group(); this.S.name = 'static'; this.root.add(this.S);
    this.pickMeshes = []; this.npcs = []; this.queue = []; this.locked = false; this.completed = false;
    this.idle = 0; this.hintShown = false;
    this.mctx = {
      cam: game.cam, owner: this,
      onMoveStart: () => { this.graph.rebuild(); this.game.hints.hide(); this.idle = 0; },
      onMove: () => { this.game.shadowsDirty = true; },
      onSettle: m => { this.graph.rebuild(); Audio.blip('settle'); this.game.shadowsDirty = true; this.afterSettle(m); },
      tick: k => Audio.blip(k)
    };
  }

  /* ---------- 搭建工具 ---------- */
  /** 可站立的格子。col: true=柱子落到底座；数字=柱底高度；false=薄板 */
  floor(x, y, z, o = {}) {
    const parent = o.parent || this.S;
    const bottom = o.col === false ? y - 0.3 : (typeof o.col === 'number' ? o.col : -0.4);
    const m = column(parent, x, z, bottom, y, o.color ?? this.station.palette.floor, { r: 0.07 });
    if (o.top !== false) box(parent, x, y - 0.03, z, 0.9, 0.08, 0.9, o.topColor ?? this.station.palette.tile, { r: 0.03, cast: false });
    const n = this.graph.addFloor(parent, x, y, z, { mech: o.mech, id: o.id });
    m.userData.nodeId = n.id; this.pickMeshes.push(m);
    return n;
  }
  /** 台阶（四级小台阶），在格子 (x,z) 从 yLow 升到 yLow+1，朝 dir 上升 */
  stair(x, yLow, z, dir, o = {}) {
    const parent = o.parent || this.S;
    const g = stairMesh(parent, x, yLow, z, dir, o.color ?? this.station.palette.stair, o.side ?? this.station.palette.floor);
    if (o.support !== false && yLow > -0.4) column(parent, x, z, -0.4, yLow - 0.2, o.supportColor ?? this.station.palette.floor, { r: 0.07 });
    const n = this.graph.addStair(parent, x, yLow, z, dir, { mech: o.mech });
    g.children.forEach(c => { c.userData.nodeId = n.id; this.pickMeshes.push(c); });
    return n;
  }
  deco(x, y, z, w, h, d, color, o = {}) { return box(o.parent || this.S, x, y, z, w, h, d, color, o); }
  rotator(opts) { const m = new Rotator(this.mctx, opts); this.root.add(m.group); this.mechs.push(m); return m; }
  slider(opts) { const m = new Slider(this.mctx, opts); this.root.add(m.group); this.mechs.push(m); return m; }
  crank(opts) { const m = new Crank(this.mctx, opts); this.mechs.push(m); return m; }
  /** 底座浮岛（纪念碑谷式“悬浮的小世界”） */
  plinth(x0, x1, z0, z1, color = this.station.palette.base) {
    box(this.S, (x0 + x1) / 2, -0.75, (z0 + z1) / 2, x1 - x0, 0.7, z1 - z0, color, { r: 0.2 });
    box(this.S, (x0 + x1) / 2, -1.25, (z0 + z1) / 2, x1 - x0 - 0.6, 0.4, z1 - z0 - 0.6, this.station.palette.baseDeep ?? color, { r: 0.18 });
  }

  /* ---------- 生命周期 ---------- */
  build() {
    this.buildLevel();
    this.graph.rebuild();
    this.levelBox = new THREE.Box3().setFromObject(this.root);
    // 站台门 + 终点标记
    const goal = this.graph.get(this.goalId);
    const T = this.trackSpec;
    this.goalMarker = goalMarker(this.S, goal.world.x, goal.world.y, goal.world.z);
    this.psd = screenDoor(this.S, goal.world.x, goal.world.y, (goal.world.z + T.z) / 2 + 0.02, 0.9);
    // 轨道 + 列车（在两个隧道口之间可见：用裁剪平面实现“从隧道里滑出来”）
    makeTrack(this.S, T.clip[0] - 0.4, T.clip[1] + 0.4, T.y, T.z, { pillars: T.y > 0.5 ? 2 : 0, ground: -0.4, pillarColor: this.station.palette.floor });
    this.train = makeTrain(2);
    const planes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -T.clip[0]), new THREE.Plane(new THREE.Vector3(-1, 0, 0), T.clip[1])];
    this.train.group.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.userData.unique = true; o.material.clippingPlanes = planes; o.material.clipShadows = true; o.castShadow = false; } });
    this.trainStopX = goal.world.x - this.train.doorX(T.door ?? 0);
    this.train.group.position.set(T.clip[0] - this.train.length - 2, T.y, T.z);
    this.train.group.visible = false;
    for (const x of T.clip) this.portal(x, T.y, T.z);
    this.root.add(this.train.group);
    stationSign(this.S, T.signX ?? (goal.world.x + 1), goal.world.y, (goal.world.z + T.z) / 2 + 0.05, this.station.color);
    // 角色
    this.passenger = new Passenger(this, this.startId, { onArrive: id => this.onArrive(id), yaw: this.startYaw ?? 0 });
    for (const w of this.wanderers || []) this.npcs.push(new WanderNpc(this, w.start, w.allowed));
    for (const q of this.queueSpots || []) { const n = new QueueNpc(this, q.pos, q.yaw ?? Math.PI); n.door = q.door; n.noBoard = !!q.noBoard; this.queue.push(n); }
  }
  portal(x, y, z) {
    const c = this.station.palette.portal ?? this.station.palette.floor;
    const out = x > this.trainStopX ? 1 : -1;
    box(this.S, x, y + 0.8, z - 0.66, 0.5, 1.6, 0.22, c, { r: 0.06 });
    box(this.S, x, y + 1.62, z - 0.05, 0.5, 0.26, 1.25, c, { r: 0.08 });
    box(this.S, x + out * 0.32, y + 0.75, z - 0.1, 0.16, 1.5, 1.05, 0x7d8aa0, { r: 0.04, cast: false });
  }
  fitBox() { return this.levelBox.clone().expandByScalar(0.3); }
  enter() {
    this.game.hud.setStation(this.station);
    Ambience.setScene('station');
    Ann.prefetchStation(this.station.id);
    // 欢迎广播（普通话 → 粤语 → 英语）
    wait(1.0, this).then(ok => { if (ok && !this.completed) Ann.announce('welcome', { station: this.station.id }); });
    this.idle = 0;
  }
  exit() { super.exit(); this.game.hints.hide(); }

  /* ---------- 输入 ---------- */
  grab(x, y) {
    if (this.locked) return null;
    const r = this.ray(x, y);
    let best = null, bd = Infinity;
    for (const m of this.mechs) {
      const hit = r.intersectObjects(m.handles, true)[0];
      if (hit && hit.distance < bd) { bd = hit.distance; best = m; }
    }
    if (!best) return null;
    const p = this.passenger;
    const driven = best.driven || best;
    if (p.usesMech(driven) || (best.noCarry && p.standingOn(driven))) { Audio.blip('nope'); return null; }
    this.idle = 0; this.game.hints.hide();
    return best.grab(x, y);
  }
  tap(x, y) {
    if (this.locked) return;
    this.idle = 0; this.game.hints.hide();
    const r = this.ray(x, y);
    let node = null;
    for (const h of r.intersectObjects(this.pickMeshes, false)) {
      const n = this.graph.get(h.object.userData.nodeId);
      if (n && n.active) { node = n; break; }
    }
    if (!node) node = this.graph.pick(x, y, this.game.cam);
    if (!node) return;
    const exact = this.passenger.goTo(node.id);
    this.game.tapRipple(node.world, exact);
    Audio.blip(exact ? 'tap' : 'nope');
  }

  /* ---------- 规则 ---------- */
  afterSettle() {}
  onArrive(id) { if (id === this.goalId && !this.completed) this.complete(); }
  pathToGoal() { return this.graph.astar(this.passenger.edge ? this.passenger.edge.to : this.passenger.nodeId, this.goalId); }
  hintTarget() {
    if (this.pathToGoal()) return { world: this.graph.get(this.goalId).world.clone(), kind: 'tap' };
    return this.levelHint();
  }
  showHint() { if (this.locked) return; const h = this.hintTarget(); if (h) { this.game.hints.show(h); this.hintShown = true; } }

  async complete() {
    this.completed = true; this.locked = true; this.game.hints.hide();
    Audio.blip('goal');
    const T = this.trackSpec, tr = this.train, g = tr.group;
    Ambience.setScene('platform');
    Ann.announce('platform', { station: this.station.id, dir: 1 }, { interrupt: true });
    // 站台门灯闪烁
    tween(2.6, k => { this.psd.lamp.material.emissiveIntensity = 0.2 + 0.8 * Math.abs(Math.sin(k * Math.PI * 6)); }, { owner: this });
    // 列车从隧道口缓缓滑入
    g.visible = true;
    const x0 = g.position.x;
    Audio.sfx('train.approach', { volume: 0.5 });
    await tween(4.2, k => { g.position.x = x0 + (this.trainStopX - x0) * k; }, { ease: Ease.outCubic, owner: this });
    if (this.exited) return;
    Audio.sfx('train.airRelease', { volume: 0.6 });
    // 开门：车门 + 屏蔽门
    Audio.sfx('doorOpen', { volume: 0.7 });
    await tween(1.25, k => { tr.setDoors(k); this.psd.open(k); }, { owner: this });
    // 小乘客与排队的人上车
    const p = this.passenger, goal = this.graph.get(this.goalId);
    const door = new THREE.Vector3(goal.world.x, T.y + 0.25, T.z);
    this.queue.forEach((q, i) => { if (!q.noBoard) q.board(new THREE.Vector3(this.trainStopX + tr.doorX(q.door ?? 1), T.y + 0.25, T.z), 0.3 + i * 0.5); });
    this.root.attach(p.root);
    const from = p.root.position.clone();
    p.faceYaw = Math.atan2(door.x - from.x, door.z - from.z);
    await tween(1.2, k => { p.root.position.lerpVectors(from, door, k); p.fig.inner.position.y = Math.abs(Math.sin(k * Math.PI * 4)) * 0.06; if (k > 0.65) p.fig.setOpacity(1 - (k - 0.65) / 0.35); }, { owner: this, ease: Ease.inOutSine });
    p.root.visible = false;
    await wait(0.6, this);
    // 关门提示音 + 三语“车门即将关闭”
    Audio.sfx('doorChime', { volume: 0.55 });
    Ann.announce('doorsClosing', {});
    await wait(2.4, this);
    Audio.sfx('doorClose', { volume: 0.7 });
    await tween(1.25, k => { tr.setDoors(1 - k); this.psd.open(1 - k); }, { owner: this });
    // 出站
    Audio.sfx('train.depart', { volume: 0.45 });
    const xs = g.position.x;
    await tween(3.2, k => { g.position.x = xs + (T.clip[1] + tr.length + 2 - xs) * k; }, { ease: Ease.inCubic, owner: this });
    if (!this.exited) this.game.onStationComplete(this.station.id);
  }

  update(dt, t) {
    for (const m of this.mechs) { m.update(t); if (m.moving) this.game.shadowsDirty = true; }
    this.passenger.update(dt, t);
    for (const n of this.npcs) n.update(dt, t);
    for (const q of this.queue) q.update(dt, t);
    this.goalMarker.update(t);
    if (!this.locked) {
      this.idle += dt;
      if (this.passenger.walking) this.idle = 0;
      if (this.idle > CONFIG.hintIdleSeconds && !this.game.hints.visible) this.showHint();
    }
  }
  exitScene() { this.exited = true; }

  /* ---------- 测试/调试：按解法步骤执行 ---------- */
  async autoSolve(stepDelay = 0.6) {
    for (const step of this.solution()) {
      if (step.mech != null) { const m = this.mechs[step.mech]; m.jump(step.value); }
      if (step.walk) { this.passenger.goTo(step.walk); while (this.passenger.walking) await wait(0.1, this); }
      await wait(stepDelay, this);
    }
  }
}
