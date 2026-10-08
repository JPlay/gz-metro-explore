import * as THREE from 'three';
import { CONFIG } from '../core/config.js';

/*
 * 沿路径图行走的通用角色控制：
 *   - 路径由 PathGraph.astar 求出；每走一条边之前都重新确认这条连接还在（机关可能刚被转走）；
 *   - 视错觉连接：先走到本侧端口，在屏幕不动的前提下瞬移到对侧端口（深度不同、投影相同），再继续走；
 *   - 站定时挂到所站节点的 Object3D 下面（站在旋转台/滑块/升降台上会被一起带走）。
 */
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _w = new THREE.Vector3();
function shortest(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

export class Walker {
  constructor(scene, figure, nodeId, opts = {}) {
    this.scene = scene; this.graph = scene.graph; this.fig = figure; this.root = figure.root;
    this.nodeId = nodeId; this.path = []; this.edge = null; this.target = null;
    this.speed = opts.speed || CONFIG.walkSpeed; this.vel = 0; this.phase = Math.random() * 6; this.yaw = opts.yaw || 0;
    this.onArrive = opts.onArrive || null; this.onStep = opts.onStep || null; this.replan = opts.replan !== false;
    this.idleT = Math.random() * 10;
    this.placeAt(nodeId);
  }
  get walking() { return !!this.edge || this.path.length > 0; }
  node() { return this.graph.get(this.nodeId); }
  placeAt(id) {
    const n = this.graph.get(id); this.nodeId = id;
    n.object.add(this.root); this.root.position.copy(n.local); this.root.quaternion.identity();
    this.root.rotation.y = this.yaw - this.parentYaw();
  }
  parentYaw() { const q = new THREE.Quaternion(); this.root.parent.getWorldQuaternion(q); return new THREE.Euler().setFromQuaternion(q, 'YXZ').y; }
  /** 前往目标节点；返回是否能完全到达 */
  goTo(targetId) {
    if (!this.graph.get(targetId)) return false;
    this.target = targetId;
    const from = this.edge ? this.edge.to : this.nodeId;
    const res = this.replan ? this.graph.pathTowards(from, targetId) : { path: this.graph.astar(from, targetId), exact: true };
    if (!res.path) { this.path = []; return false; }
    this.path = res.path.slice(1);
    return res.exact;
  }
  stop() { this.path = []; }
  /** 当前正在走的边是否涉及某个机关 */
  usesMech(mech) {
    if (!this.edge) return false;
    const a = this.graph.get(this.edge.from), b = this.graph.get(this.edge.to);
    return (a && a.mech === mech) || (b && b.mech === mech);
  }
  standingOn(mech) { const n = this.node(); return !this.edge && n && n.mech === mech; }
  startEdge() {
    const next = this.path[0];
    const link = this.graph.linkBetween(this.nodeId, next);
    if (!link) { // 连接断了：停下，必要时重新规划
      this.path = [];
      if (this.replan && this.target && this.target !== this.nodeId) { const ok = this.goTo(this.target); if (this.path.length && this.graph.linkBetween(this.nodeId, this.path[0])) return this.startEdge(); }
      return false;
    }
    this.path.shift();
    const a = this.graph.get(this.nodeId), b = this.graph.get(next);
    // 走路时挂在场景根节点下（世界坐标）
    this.scene.root.attach(this.root);
    const pts = [a.world.clone(), link.from.clone()];
    const legs = [];
    legs.push([a.world.clone(), link.from.clone()]);
    if (link.illusion) legs.push(null); // null = 瞬移
    legs.push([link.toPort.clone(), b.world.clone()]);
    this.edge = { from: a.id, to: b.id, legs, leg: 0, t: 0, illusion: link.illusion };
    return true;
  }
  update(dt, time) {
    // 起步/停步缓动
    const moving = !!this.edge || this.path.length > 0;
    if (!this.edge && this.path.length) this.startEdge();
    const want = this.edge ? this.speed : 0;
    this.vel += (want - this.vel) * Math.min(1, dt * (want ? 7 : 12));
    if (this.edge) {
      let dist = this.vel * dt;
      while (dist > 0 && this.edge) {
        const e = this.edge, leg = e.legs[e.leg];
        if (leg === null) { // 视错觉瞬移：屏幕位置不变
          this.fig.setOnTop(true); this.onTopUntil = time + 0.4;
          e.leg++; e.t = 0; this.root.position.copy(e.legs[e.leg][0]); continue;
        }
        const len = leg[0].distanceTo(leg[1]) || 1e-4;
        const remain = (1 - e.t) * len;
        if (dist >= remain) { dist -= remain; e.leg++; e.t = 0; this.root.position.copy(leg[1]); if (e.leg >= e.legs.length) this.arrive(); }
        else { e.t += dist / len; dist = 0; this.root.position.lerpVectors(leg[0], leg[1], e.t); }
        if (this.edge && leg) { _a.subVectors(leg[1], leg[0]); if (Math.abs(_a.x) + Math.abs(_a.z) > 1e-3) this.faceYaw = Math.atan2(_a.x, _a.z); }
      }
    }
    if (this.onTopUntil && time > this.onTopUntil) { this.fig.setOnTop(false); this.onTopUntil = 0; }
    // 朝向（世界 yaw → 局部）
    if (this.faceYaw != null) this.yaw += shortest(this.faceYaw - this.yaw) * Math.min(1, dt * 10);
    this.root.rotation.y = this.yaw - (this.root.parent === this.scene.root ? 0 : this.parentYaw());
    // 走路轻轻弹跳，站着慢慢呼吸
    const k = Math.min(1, this.vel / this.speed);
    this.phase += dt * (6 + 6 * k);
    const prevStep = Math.floor(this.lastPhase / Math.PI);
    this.lastPhase = this.phase;
    this.fig.inner.position.y = k * Math.abs(Math.sin(this.phase)) * 0.06;
    this.fig.inner.rotation.z = k * Math.sin(this.phase) * 0.08;
    const breathe = 1 + (1 - k) * Math.sin(time * 2 + this.idleT) * 0.015;
    this.fig.inner.scale.set(1, breathe, 1);
    if (k > 0.5 && Math.floor(this.phase / Math.PI) !== prevStep && this.onStep) this.onStep();
  }
  arrive() {
    const id = this.edge.to; this.edge = null; this.nodeId = id;
    const n = this.graph.get(id);
    n.object.attach(this.root);
    if (!this.path.length) { this.target = null; this.onArrive && this.onArrive(id); }
  }
  worldPosition(out = new THREE.Vector3()) { return this.root.getWorldPosition(out); }
}
