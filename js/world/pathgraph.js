import * as THREE from 'three';

/*
 * 可行走节点图 + 视错觉连接 + A* 寻路。
 *
 * 每个节点是一块“可以站的面”（地砖顶面或台阶中点），带若干“端口”：
 * 端口 = 节点边缘中点 + 朝外的水平方向。两个节点相连的条件：
 *   某个端口 A 与某个端口 B 方向相反，并且它们在等轴测投影里落在同一个屏幕点。
 * 投影沿 (1,1,1)：世界坐标差为 k·(1,1,1) 的两个点在屏幕上完全重合。
 *   - k = 0：真实相接（普通连接）；
 *   - k ≠ 0：只是“看起来”相接——纪念碑谷式的视错觉通路，同样允许行走。
 * 机关移动时其上的节点暂时失效；机关停稳（且节点顶面朝上）后重新计算全部连接。
 */
const S2 = Math.SQRT2, S6 = Math.sqrt(6);
const Q = 40; // 屏幕坐标量化精度（1/40 格）
export function screenOf(p) { return { s1: (p.x - p.z) / S2, s2: (2 * p.y - p.x - p.z) / S6 }; }
function screenKey(p) { const s = screenOf(p); return Math.round(s.s1 * Q) + ',' + Math.round(s.s2 * Q); }
function dirKey(d) { return Math.round(d.x) + ',' + Math.round(d.z); }
const DIRS = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];

export class PathGraph {
  constructor() {
    this.nodes = new Map();
    this.links = new Map();
    this.version = 0;
    this._q = new THREE.Quaternion();
  }
  /** 平地格：object 为其所属 Object3D（静态根或机关 group），坐标为该对象局部坐标，y 为顶面高度 */
  addFloor(object, x, y, z, opts = {}) {
    const id = opts.id || `f:${object.name || 'o'}:${x},${y},${z}`;
    const centre = new THREE.Vector3(x, y, z);
    const ports = (opts.dirs || DIRS).map(d => ({ local: centre.clone().addScaledVector(d, 0.5), dir: d.clone() }));
    return this._add({ id, object, local: centre, ports, kind: 'floor', mech: opts.mech || null, tags: opts.tags || {}, cost: 1 });
  }
  /** 台阶：格子 (x,z)，从 yLow 升到 yLow+1，朝 dir 方向上升 */
  addStair(object, x, yLow, z, dir, opts = {}) {
    const id = opts.id || `s:${object.name || 'o'}:${x},${yLow},${z}`;
    const d = new THREE.Vector3(dir.x, 0, dir.z);
    const centre = new THREE.Vector3(x, yLow + 0.5, z);
    const ports = [
      { local: new THREE.Vector3(x - d.x / 2, yLow, z - d.z / 2), dir: d.clone().negate() },
      { local: new THREE.Vector3(x + d.x / 2, yLow + 1, z + d.z / 2), dir: d.clone() }
    ];
    return this._add({ id, object, local: centre, ports, kind: 'stair', mech: opts.mech || null, tags: opts.tags || {}, cost: 1.15 });
  }
  _add(n) {
    n.world = new THREE.Vector3(); n.up = new THREE.Vector3(0, 1, 0); n.active = true;
    n.worldPorts = n.ports.map(() => ({ pos: new THREE.Vector3(), dir: new THREE.Vector3() }));
    this.nodes.set(n.id, n); return n;
  }
  get(id) { return this.nodes.get(id); }

  /** 重新计算所有节点世界坐标与连接（机关停稳、开始移动时调用） */
  rebuild() {
    const table = new Map();
    for (const n of this.nodes.values()) {
      n.object.updateWorldMatrix(true, false);
      n.world.copy(n.local).applyMatrix4(n.object.matrixWorld);
      n.object.getWorldQuaternion(this._q);
      n.up.set(0, 1, 0).applyQuaternion(this._q);
      n.active = n.up.y > 0.99 && !(n.mech && n.mech.moving) && n.enabled !== false;
      n.ports.forEach((p, i) => {
        const wp = n.worldPorts[i];
        wp.pos.copy(p.local).applyMatrix4(n.object.matrixWorld);
        wp.dir.copy(p.dir).applyQuaternion(this._q);
        if (!n.active) return;
        const key = screenKey(wp.pos) + '|' + dirKey(wp.dir);
        if (!table.has(key)) table.set(key, []);
        table.get(key).push({ node: n, port: wp });
      });
    }
    this.links = new Map();
    for (const n of this.nodes.values()) this.links.set(n.id, []);
    for (const n of this.nodes.values()) {
      if (!n.active) continue;
      for (const wp of n.worldPorts) {
        const opp = screenKey(wp.pos) + '|' + dirKey({ x: -wp.dir.x, z: -wp.dir.z });
        const hits = table.get(opp);
        if (!hits) continue;
        for (const h of hits) {
          if (h.node === n) continue;
          const illusion = h.port.pos.distanceTo(wp.pos) > 0.02;
          this.links.get(n.id).push({ to: h.node.id, from: wp.pos.clone(), toPort: h.port.pos.clone(), illusion, cost: (n.cost + h.node.cost) / 2 });
        }
      }
    }
    this.version++;
  }
  neighbors(id) { return this.links.get(id) || []; }
  linkBetween(a, b) { return this.neighbors(a).find(l => l.to === b) || null; }

  /** A*：启发函数用屏幕距离（视错觉连接在屏幕上依然是“一步”，所以可采纳） */
  astar(startId, goalId) {
    if (!this.nodes.has(startId) || !this.nodes.has(goalId)) return null;
    if (startId === goalId) return [startId];
    const goal = this.nodes.get(goalId), gs = screenOf(goal.world);
    const h = id => { const s = screenOf(this.nodes.get(id).world); return Math.hypot(s.s1 - gs.s1, s.s2 - gs.s2) / 1.5; };
    const open = new Map([[startId, h(startId)]]), g = new Map([[startId, 0]]), came = new Map();
    while (open.size) {
      let cur = null, best = Infinity;
      for (const [id, f] of open) if (f < best) { best = f; cur = id; }
      if (cur === goalId) { const path = [cur]; while (came.has(cur)) { cur = came.get(cur); path.unshift(cur); } return path; }
      open.delete(cur);
      for (const l of this.neighbors(cur)) {
        const ng = g.get(cur) + l.cost;
        if (ng < (g.get(l.to) ?? Infinity)) { g.set(l.to, ng); came.set(l.to, cur); open.set(l.to, ng + h(l.to)); }
      }
    }
    return null;
  }
  reachable(startId) {
    const seen = new Set([startId]), q = [startId];
    while (q.length) { const c = q.shift(); for (const l of this.neighbors(c)) if (!seen.has(l.to)) { seen.add(l.to); q.push(l.to); } }
    return seen;
  }
  /** 目标不可达时，走到可达节点里屏幕上离目标最近的那个（孩子点哪里都会有回应） */
  pathTowards(startId, targetId) {
    const direct = this.astar(startId, targetId);
    if (direct) return { path: direct, exact: true };
    const t = screenOf(this.nodes.get(targetId).world);
    let best = startId, bd = Infinity;
    for (const id of this.reachable(startId)) {
      const s = screenOf(this.nodes.get(id).world), d = Math.hypot(s.s1 - t.s1, s.s2 - t.s2);
      if (d < bd - 1e-6) { bd = d; best = id; }
    }
    return { path: this.astar(startId, best) || [startId], exact: false };
  }
  /** 屏幕拾取：投影后距离最近的活动节点（半径内），重合时取离相机更近者 */
  pick(sx, sy, isoCam, radiusPx = 46, filter = null) {
    let best = null, bd = Infinity;
    const tmp = { x: 0, y: 0 };
    for (const n of this.nodes.values()) {
      if (!n.active || (filter && !filter(n))) continue;
      isoCam.toScreen(n.world, tmp);
      const d = Math.hypot(tmp.x - sx, tmp.y - (sy + 6));
      const depth = n.world.x + n.world.y + n.world.z;
      const score = d - depth * 0.6;
      if (d < radiusPx && score < bd) { bd = score; best = n; }
    }
    return best;
  }
}
