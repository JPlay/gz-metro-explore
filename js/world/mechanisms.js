import * as THREE from 'three';
import { tween, Ease } from '../core/tween.js';
import { ISO_DIR } from '../core/camera.js';
import { torusGeo, glowMaterial } from './blocks.js';

/*
 * 机关：旋转台（Rotator）、滑块（Slider）、摇柄（Crank，驱动一个不可直接拖动的滑块，如升降台）。
 * 共同约定：
 *   - group 是机关的 Object3D，其上的可行走节点挂在它下面（pathgraph 以它为局部坐标系）；
 *   - handles 是可以被手指抓住的网格（含透明的放大触控代理）；
 *   - 拖动中 moving=true → 其上节点失效；松手后缓动吸附到整格/整角度，再重建连接。
 * ctx（由场景提供）：{ cam: IsoCamera, onMoveStart(m), onMove(m), onSettle(m), tick(kind) }
 */
const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
function screenAngle(x, y, c) { return Math.atan2(-(y - c.y), x - c.x); }
function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
const _v = new THREE.Vector3();

class Mechanism {
  constructor(ctx, opts) {
    this.ctx = ctx; this.name = opts.name || 'mech';
    this.group = new THREE.Group(); this.group.name = this.name;
    this.handles = []; this.moving = false; this.locked = false; this.dragging = false;
    this.ring = null; this.settleTween = null; this.lastTick = 0;
  }
  addHandle(mesh) { this.handles.push(mesh); return mesh; }
  /** 透明的放大触控代理（孩子的手指比鼠标粗） */
  addProxy(parent, w, h, d, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.set(x, y, z); parent.add(m); this.handles.push(m); return m;
  }
  /** 发光圈：提示孩子“这里可以动” */
  addRing(parent, x, y, z, r = 0.7, axis = 'y') {
    const m = new THREE.Mesh(torusGeo(r, 0.06), glowMaterial());
    m.position.set(x, y, z);
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    m.renderOrder = 2; parent.add(m); this.ring = m; return m;
  }
  begin() {
    if (this.settleTween) { this.settleTween.cancel(); this.settleTween = null; }
    if (!this.moving) { this.moving = true; this.ctx.onMoveStart && this.ctx.onMoveStart(this); }
    this.dragging = true;
  }
  settle(target, duration = 0.45) {
    this.dragging = false;
    const from = this.value, to = target;
    if (Math.abs(to - from) < 1e-4) { this.setValue(to); this.finish(); return; }
    this.settleTween = tween(duration, k => this.setValue(from + (to - from) * k), { ease: Ease.outBack, owner: this.ctx.owner });
    this.settleTween.then(ok => { if (ok) { this.setValue(to); this.finish(); } });
  }
  finish() { this.settleTween = null; this.moving = false; this.ctx.onSettle && this.ctx.onSettle(this); }
  tickFeedback(step) {
    const s = Math.round(this.value / step);
    if (s !== this.lastTick) { this.lastTick = s; this.ctx.tick && this.ctx.tick('tick'); }
  }
  update(t) { if (this.ring) this.ring.material.userData.pulse(t); }
  /** 直接设到某个值并重建（调试/测试用） */
  jump(v) { this.setValue(v); this.moving = false; this.ctx.onSettle && this.ctx.onSettle(this); }
}

export class Rotator extends Mechanism {
  /** opts: pivot(Vector3, 父坐标), axis 'x'|'y'|'z', value(度), snaps([度]) 或 step, min/max（度，可选限幅）, center(拖动参考点，世界坐标，可选) */
  constructor(ctx, opts) {
    super(ctx, opts);
    this.axis = AXES[opts.axis || 'y'].clone();
    this.group.position.copy(opts.pivot);
    this.snaps = opts.snaps || null; this.step = opts.step || 90;
    this.min = opts.min ?? -Infinity; this.max = opts.max ?? Infinity;
    this.center = opts.center || null;
    // 屏幕上逆时针为正：若旋转轴朝向观察者，正角度在屏幕上就是逆时针
    this.sign = Math.sign(this.axis.dot(ISO_DIR)) || 1;
    this.value = opts.value || 0; this.setValue(this.value);
  }
  setValue(deg) { this.value = deg; this.group.quaternion.setFromAxisAngle(this.axis, deg * Math.PI / 180); this.ctx.onMove && this.ctx.onMove(this); }
  centerScreen() { const w = this.center ? this.center : this.group.getWorldPosition(_v); return this.ctx.cam.toScreen(w); }
  grab(x, y) {
    if (this.locked) return null;
    const c = this.centerScreen();
    let lastA = screenAngle(x, y, c), started = false;
    return {
      move: (px, py) => {
        if (!started) { started = true; this.begin(); }
        const a = screenAngle(px, py, c), da = wrap(a - lastA); lastA = a;
        if (Math.hypot(px - c.x, py - c.y) < 14) return; // 太靠近圆心时角度不稳定
        const v = Math.min(this.max, Math.max(this.min, this.value + da * 180 / Math.PI * this.sign));
        this.setValue(v); this.tickFeedback(15);
      },
      end: (px, py, moved) => { if (started) this.settle(this.snapTarget()); }
    };
  }
  snapTarget() {
    if (this.snaps) return this.snaps.reduce((b, s) => Math.abs(s - this.value) < Math.abs(b - this.value) ? s : b, this.snaps[0]);
    return Math.round(this.value / this.step) * this.step;
  }
  normalized() { return ((Math.round(this.value) % 360) + 360) % 360; }
  hint() { return { world: this.center || this.group.getWorldPosition(new THREE.Vector3()), kind: 'arc' }; }
}

export class Slider extends Mechanism {
  /** opts: base(Vector3), axis(Vector3 单位向量), min, max, value, step */
  constructor(ctx, opts) {
    super(ctx, opts);
    this.base = opts.base.clone(); this.axis = opts.axis.clone().normalize();
    this.min = opts.min ?? 0; this.max = opts.max ?? 1; this.step = opts.step ?? 1;
    this.value = opts.value ?? 0; this.setValue(this.value);
  }
  setValue(v) { this.value = v; this.group.position.copy(this.base).addScaledVector(this.axis, v); this.ctx.onMove && this.ctx.onMove(this); }
  axisScreen() {
    const p0 = this.group.getWorldPosition(new THREE.Vector3());
    const a = this.ctx.cam.toScreen(p0), b = this.ctx.cam.toScreen(p0.clone().add(this.axis));
    return { x: b.x - a.x, y: b.y - a.y };
  }
  grab(x, y) {
    if (this.locked) return null;
    const ax = this.axisScreen(), len2 = ax.x * ax.x + ax.y * ax.y || 1;
    const v0 = this.value, x0 = x, y0 = y; let started = false;
    return {
      move: (px, py) => {
        if (!started) { started = true; this.begin(); }
        const t = ((px - x0) * ax.x + (py - y0) * ax.y) / len2;
        this.setValue(Math.min(this.max, Math.max(this.min, v0 + t))); this.tickFeedback(this.step);
      },
      end: () => { if (started) this.settle(Math.round(this.value / this.step) * this.step, 0.5); }
    };
  }
  hint(toward) {
    const ax = this.axisScreen(); const s = toward == null ? 1 : Math.sign(toward - this.value) || 1;
    return { world: this.handleWorld ? this.handleWorld() : this.group.getWorldPosition(new THREE.Vector3()), kind: 'line', dir: { x: ax.x * s, y: ax.y * s } };
  }
}

/** 摇柄：转一圈 = perTurn 个单位，驱动 driven（Slider）的数值；轮子跟着手指转 */
export class Crank extends Mechanism {
  constructor(ctx, opts) {
    super(ctx, opts);
    this.wheel = opts.wheel; this.wheelAxis = opts.wheelAxis || 'z';
    this.driven = opts.driven; this.perTurn = opts.perTurn || 3;
    this.centerWorld = opts.center;
    this.sign = Math.sign(AXES[this.wheelAxis].dot(ISO_DIR)) || 1;
    this.value = this.driven.value; this.syncWheel();
  }
  setValue(v) { this.value = v; this.driven.setValue(v); this.syncWheel(); }
  syncWheel() { this.wheel.rotation[this.wheelAxis] = -this.sign * this.value / this.perTurn * Math.PI * 2; }
  begin() { super.begin(); if (!this.driven.moving) { this.driven.moving = true; this.ctx.onMoveStart && this.ctx.onMoveStart(this.driven); } }
  finish() { this.settleTween = null; this.moving = false; this.driven.moving = false; this.ctx.onSettle && this.ctx.onSettle(this); }
  grab(x, y) {
    if (this.locked) return null;
    const c = this.ctx.cam.toScreen(this.centerWorld);
    let lastA = screenAngle(x, y, c), started = false;
    return {
      move: (px, py) => {
        if (!started) { started = true; this.begin(); }
        if (Math.hypot(px - c.x, py - c.y) < 12) return;
        const a = screenAngle(px, py, c), da = wrap(a - lastA); lastA = a;
        // 顺时针摇 = 升高
        const v = Math.min(this.driven.max, Math.max(this.driven.min, this.value - da / (2 * Math.PI) * this.perTurn));
        this.setValue(v); this.tickFeedback(0.25);
      },
      end: () => { if (started) this.settle(Math.round(this.value), 0.6); }
    };
  }
  jump(v) { this.setValue(v); this.moving = false; this.driven.moving = false; this.ctx.onSettle && this.ctx.onSettle(this); }
  hint(toward) { return { world: this.centerWorld, kind: 'arc', ccw: toward != null && toward < this.value }; }
}
