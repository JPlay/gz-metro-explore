import * as THREE from 'three';
import { damp } from './tween.js';

// 真·等轴测：相机永远沿 (1,1,1) 方向看向目标。方向固定不变，所以“看起来连上的路”
// 在投影里严格重合——这是视错觉通路成立的前提（见 world/pathgraph.js）。
export const ISO_DIR = new THREE.Vector3(1, 1, 1).normalize();
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const UP = new THREE.Vector3().crossVectors(RIGHT, ISO_DIR.clone().negate()).normalize(); // 屏幕上方向

export class IsoCamera {
  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    this.target = new THREE.Vector3();
    this.goal = new THREE.Vector3();
    this.viewHeight = 12;   // zoom=1 时屏幕可见的世界高度
    this.zoom = 1; this.goalZoom = 1;
    this.minZoom = 0.75; this.maxZoom = 2.2;
    this.bounds = null;     // 平移范围（屏幕平面上的世界单位）
    this.aspect = 1; this.width = 1; this.height = 1;
    this.distance = 80;
    this.drift = 0;         // 标题页用的缓慢呼吸
  }
  resize(w, h) { this.width = w; this.height = h; this.aspect = w / h; this.apply(); }
  /** 让一个 Box3 完整进入画面（横竖屏都适配），margin>1 表示留白 */
  fit(box, margin = 1.15, immediate = false, offsetUp = 0) {
    const corners = [];
    for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
    let minR = Infinity, maxR = -Infinity, minU = Infinity, maxU = -Infinity;
    for (const c of corners) { const r = c.dot(RIGHT), u = c.dot(UP); minR = Math.min(minR, r); maxR = Math.max(maxR, r); minU = Math.min(minU, u); maxU = Math.max(maxU, u); }
    const w = maxR - minR, h = maxU - minU;
    // 顶部 HUD 和底部按钮各占一点空间：给垂直方向多留余量
    this.viewHeight = Math.max(h * 1.12, w / this.aspect) * margin;
    const center = box.getCenter(new THREE.Vector3());
    const cr = (minR + maxR) / 2, cu = (minU + maxU) / 2 + offsetUp * this.viewHeight;
    // 把中心放在相机平面上：投影坐标 (cr, cu)，深度沿 ISO_DIR 取盒子中心
    this.goal.copy(RIGHT).multiplyScalar(cr).addScaledVector(UP, cu).addScaledVector(ISO_DIR, center.dot(ISO_DIR));
    this.bounds = { r: [cr - w * 0.35, cr + w * 0.35], u: [cu - h * 0.35, cu + h * 0.35] };
    this.goalZoom = 1;
    if (immediate) { this.target.copy(this.goal); this.zoom = 1; }
    this.apply();
  }
  worldPerPixel() { return (this.viewHeight / this.zoom) / this.height; }
  pan(dx, dy) {
    const k = this.worldPerPixel();
    this.goal.addScaledVector(RIGHT, -dx * k).addScaledVector(UP, dy * k);
    this.clampGoal();
  }
  zoomBy(f) { this.goalZoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.goalZoom * f)); }
  clampGoal() {
    if (!this.bounds) return;
    const r = this.goal.dot(RIGHT), u = this.goal.dot(UP), d = this.goal.dot(ISO_DIR);
    const cr = Math.min(this.bounds.r[1], Math.max(this.bounds.r[0], r));
    const cu = Math.min(this.bounds.u[1], Math.max(this.bounds.u[0], u));
    this.goal.copy(RIGHT).multiplyScalar(cr).addScaledVector(UP, cu).addScaledVector(ISO_DIR, d);
  }
  focusOn(point, zoom) {
    const d = this.goal.dot(ISO_DIR);
    this.goal.copy(RIGHT).multiplyScalar(point.dot(RIGHT)).addScaledVector(UP, point.dot(UP)).addScaledVector(ISO_DIR, d);
    if (zoom) this.goalZoom = zoom;
  }
  update(dt) {
    this.target.x = damp(this.target.x, this.goal.x, 5, dt);
    this.target.y = damp(this.target.y, this.goal.y, 5, dt);
    this.target.z = damp(this.target.z, this.goal.z, 5, dt);
    this.zoom = damp(this.zoom, this.goalZoom, 6, dt);
    this.apply();
  }
  apply() {
    const halfH = this.viewHeight / this.zoom / 2, halfW = halfH * this.aspect;
    const cam = this.camera;
    cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH;
    cam.position.copy(this.target).addScaledVector(ISO_DIR, this.distance);
    cam.up.set(0, 1, 0);
    cam.lookAt(this.target);
    cam.near = 0.1; cam.far = this.distance * 2 + 60;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }
  /** 世界坐标 → CSS 像素 */
  toScreen(v, out = { x: 0, y: 0 }) {
    const p = _v.copy(v).project(this.camera);
    out.x = (p.x + 1) / 2 * this.width; out.y = (1 - p.y) / 2 * this.height;
    return out;
  }
}
const _v = new THREE.Vector3();
export { RIGHT as ISO_RIGHT, UP as ISO_UP };
