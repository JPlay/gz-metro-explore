// 提示层：发光圈 + 会动的小手，跟随 3D 世界里的目标点。无需阅读。
// kind: 'tap'（点一下）| 'arc'（绕圈转）| 'line'（沿方向推），dir 为屏幕方向。
export class Hints {
  constructor() {
    this.layer = document.getElementById('hintLayer');
    this.hand = document.getElementById('hintHand');
    this.ring = document.getElementById('hintRing');
    this.target = null; this.t = 0;
  }
  show(target) { this.target = target; this.t = 0; this.layer.classList.add('on'); }
  hide() { this.target = null; this.layer.classList.remove('on'); }
  get visible() { return !!this.target; }
  update(dt, cam) {
    if (!this.target) return;
    this.t += dt;
    const p = cam.toScreen(this.target.world);
    let hx = p.x, hy = p.y;
    const k = this.target.kind;
    if (k === 'arc') {
      const r = 70, a = this.t * 1.6 * (this.target.ccw ? 1 : -1);
      hx = p.x + Math.cos(a) * r; hy = p.y - Math.sin(a) * r * 0.75;
    } else if (k === 'line' && this.target.dir) {
      const d = this.target.dir, len = Math.hypot(d.x, d.y) || 1, s = ((this.t * 0.7) % 1);
      const ease = s < 0.8 ? Math.sin(s / 0.8 * Math.PI / 2) : 1;
      hx = p.x + d.x / len * 120 * ease; hy = p.y + d.y / len * 120 * ease;
    } else {
      hy = p.y + Math.abs(Math.sin(this.t * 3)) * -18;
    }
    this.ring.style.transform = `translate(${p.x}px, ${p.y}px)`;
    this.hand.style.transform = `translate(${hx - 18}px, ${hy - 6}px)`;
  }
}
