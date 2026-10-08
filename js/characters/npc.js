import * as THREE from 'three';
import { makeFigure } from './figure.js';
import { Walker } from './walker.js';
import { tween, Ease } from '../core/tween.js';
import { PALETTE as P } from '../world/blocks.js';

// NPC 乘客：闲逛（idle/walk，只在静态节点间走）、排队候车（queue，在站台门前排成一列，列车来了一起上车）。
const LOOKS = [
  { body: P.lilac, hat: P.mint }, { body: P.pink, hat: P.white }, { body: P.mint, hat: P.peach },
  { body: P.peach, hat: P.sky }, { body: P.teal, hat: P.pink }, { body: P.sky, hat: P.lilac }
];
let lookIndex = 0;
function nextLook() { return LOOKS[(lookIndex++) % LOOKS.length]; }

/** 闲逛 NPC：在给定的节点集合中随机走走停停 */
export class WanderNpc extends Walker {
  constructor(scene, nodeId, allowed, opts = {}) {
    const fig = makeFigure({ ...nextLook(), scale: 0.95 });
    super(scene, fig, nodeId, { speed: 1.1, replan: false, yaw: Math.random() * 6 });
    this.lastPhase = this.phase;
    this.allowed = allowed; this.wait = 1 + Math.random() * 3; this.state = 'idle';
  }
  update(dt, t) {
    super.update(dt, t);
    if (this.walking) return;
    this.wait -= dt;
    if (this.wait <= 0) {
      const options = this.allowed.filter(id => id !== this.nodeId && this.graph.get(id).active);
      const pick = options[Math.floor(Math.random() * options.length)];
      if (pick && this.graph.astar(this.nodeId, pick)) this.goTo(pick);
      this.wait = 2.5 + Math.random() * 4;
    }
    // 站着时偶尔左右看看
    if (!this.walking) this.faceYaw = (this.faceYaw ?? this.yaw) + Math.sin(t * 0.7 + this.idleT) * dt * 0.4;
  }
}

/** 排队 NPC：站在固定位置（不占用可行走节点），面向列车；上车时走进车门并淡出 */
export class QueueNpc {
  constructor(scene, pos, yaw) {
    this.scene = scene; this.fig = makeFigure({ ...nextLook(), scale: 0.95, bagColor: Math.random() < .5 ? P.blue : null });
    this.root = this.fig.root; this.root.position.copy(pos); this.root.rotation.y = yaw; this.t0 = Math.random() * 5;
    scene.root.add(this.root); this.boarded = false;
  }
  update(dt, t) {
    if (this.boarded) return;
    this.fig.inner.scale.set(1, 1 + Math.sin(t * 2 + this.t0) * 0.015, 1);
    this.fig.inner.rotation.y = Math.sin(t * 0.5 + this.t0) * 0.25;
  }
  /** 走到车门位置并消失 */
  board(door, delay = 0) {
    const from = this.root.position.clone();
    return tween(1.1, k => {
      this.root.position.lerpVectors(from, door, k);
      this.fig.inner.position.y = Math.abs(Math.sin(k * Math.PI * 4)) * 0.05;
      if (k > 0.7) this.fig.setOpacity(1 - (k - 0.7) / 0.3);
    }, { delay, ease: Ease.inOutSine, owner: this.scene }).then(() => { this.boarded = true; this.root.visible = false; });
  }
}

/** 枢纽城市里的小行人：沿一圈固定路点慢慢走（不需要路径图） */
export class StrollNpc {
  constructor(parent, points, speed = 0.5) {
    this.fig = makeFigure({ ...nextLook(), scale: 0.7 }); this.root = this.fig.root; parent.add(this.root);
    this.pts = points.map(p => new THREE.Vector3(...p)); this.speed = speed; this.i = 0; this.t = Math.random(); this.phase = Math.random() * 6;
  }
  update(dt) {
    const a = this.pts[this.i], b = this.pts[(this.i + 1) % this.pts.length];
    const len = a.distanceTo(b) || 1; this.t += dt * this.speed / len;
    if (this.t >= 1) { this.t = 0; this.i = (this.i + 1) % this.pts.length; }
    this.root.position.lerpVectors(a, b, this.t);
    this.root.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    this.phase += dt * 9; this.fig.inner.position.y = Math.abs(Math.sin(this.phase)) * 0.04;
  }
}
