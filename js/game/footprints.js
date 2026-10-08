// 发光脚印：默认关闭，灯泡按钮切换。40 个实例循环使用，6 秒后缩小消失。
import { colorMat } from '../core/mats.js';
const B = window.BABYLON;
export class Footprints {
  constructor(scene) {
    this.on = false; this.pool = []; this.i = 0; this.side = 1; this.acc = 0; this.last = null;
    const src = B.MeshBuilder.CreateCylinder('foot', { height: 0.02, diameter: 1, tessellation: 10 }, scene);
    src.scaling.set(0.15, 1, 0.28); src.material = colorMat(scene, '#7CF7FF', { glow: true }); src.isVisible = false; src.isPickable = false;
    for (let k = 0; k < 40; k++) { const m = src.createInstance('fp' + k); m.setEnabled(false); m.isPickable = false; this.pool.push({ m, life: 0 }); }
  }
  toggle(v) { this.on = v === undefined ? !this.on : v; if (!this.on) this.clear(); return this.on; }
  clear() { this.pool.forEach(p => { p.life = 0; p.m.setEnabled(false); }); this.last = null; }
  update(dt, pos, yaw, grounded, moving) {
    if (this.on && grounded && moving) {
      if (!this.last) this.last = pos.clone();
      const d = Math.hypot(pos.x - this.last.x, pos.z - this.last.z);
      if (d > 0.55) {
        this.last.copyFrom(pos); this.side = -this.side;
        const p = this.pool[this.i++ % this.pool.length], rx = Math.cos(yaw), rz = -Math.sin(yaw);
        p.m.position.set(pos.x + rx * this.side * 0.14, pos.y + 0.015, pos.z + rz * this.side * 0.14); p.m.rotation.y = yaw;
        p.life = 6; p.m.setEnabled(true); p.m.scaling.set(0.15, 1, 0.28);
      }
    }
    for (const p of this.pool) {
      if (p.life <= 0) continue; p.life -= dt;
      if (p.life <= 0) { p.m.setEnabled(false); continue; }
      const s = Math.min(1, p.life / 1.5); p.m.scaling.set(0.15 * s, 1, 0.28 * s);
    }
  }
  count() { return this.pool.filter(p => p.life > 0).length; }
}
