// 指针事件统一入口：单指点按 = 走路，单指拖机关 = 转/推/摇，单指拖空白 = 平移镜头，双指 = 缩放。
export class Input {
  /**
   * handler: {
   *   grab(x,y) → 返回一个拖动对象 {move(x,y), end(x,y, moved)} 或 null（按下即判定是否抓到机关）
   *   tap(x,y), pan(dx,dy), pinch(scale), anyPointer()
   * }
   */
  constructor(el, handler) {
    this.el = el; this.h = handler; this.pointers = new Map(); this.enabled = true;
    this.mode = null; this.grabbed = null; this.start = null; this.lastPinch = 0;
    el.addEventListener('pointerdown', e => this.down(e));
    window.addEventListener('pointermove', e => this.move(e));
    window.addEventListener('pointerup', e => this.up(e));
    window.addEventListener('pointercancel', e => this.up(e, true));
    el.addEventListener('wheel', e => { e.preventDefault(); this.h.pinch && this.h.pinch(e.deltaY < 0 ? 1.08 : 1 / 1.08); }, { passive: false });
    // iOS Safari：阻止双指手势把整页放大
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(n => document.addEventListener(n, e => e.preventDefault(), { passive: false }));
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  pos(e) { const r = this.el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  down(e) {
    this.h.anyPointer && this.h.anyPointer();
    if (!this.enabled) return;
    try { this.el.setPointerCapture(e.pointerId); } catch (_) {}
    const p = this.pos(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      this.start = { ...p, t: performance.now(), id: e.pointerId };
      this.grabbed = this.h.grab ? this.h.grab(p.x, p.y) : null;
      this.mode = this.grabbed ? 'grab-pending' : 'pending';
    } else if (this.pointers.size === 2) {
      if (this.grabbed && this.mode === 'grab') this.grabbed.end(p.x, p.y, true);
      this.grabbed = null; this.mode = 'pinch'; this.lastPinch = this.pinchDist();
    }
  }
  pinchDist() { const [a, b] = [...this.pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; }
  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.pos(e), prev = this.pointers.get(e.pointerId);
    this.pointers.set(e.pointerId, p);
    if (this.mode === 'pinch' && this.pointers.size >= 2) {
      const d = this.pinchDist();
      this.h.pinch && this.h.pinch(d / this.lastPinch); this.lastPinch = d;
      this.h.pan && this.h.pan((p.x - prev.x) / 2, (p.y - prev.y) / 2);
      return;
    }
    if (e.pointerId !== (this.start && this.start.id)) return;
    const moved = Math.hypot(p.x - this.start.x, p.y - this.start.y);
    if (this.mode === 'grab-pending' && moved > 7) this.mode = 'grab';
    if (this.mode === 'pending' && moved > 12) this.mode = 'pan';
    if (this.mode === 'grab') this.grabbed.move(p.x, p.y);
    else if (this.mode === 'pan') this.h.pan && this.h.pan(p.x - prev.x, p.y - prev.y);
  }
  up(e, cancelled) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.pos(e);
    this.pointers.delete(e.pointerId);
    if (this.mode === 'pinch') { if (this.pointers.size === 0) this.mode = null; return; }
    if (!this.start || e.pointerId !== this.start.id) return;
    const quick = performance.now() - this.start.t < 700;
    if (this.mode === 'grab') this.grabbed.end(p.x, p.y, true);
    else if (this.mode === 'grab-pending') { this.grabbed.end(p.x, p.y, false); if (!cancelled && quick) this.h.tap && this.h.tap(p.x, p.y); }
    else if (this.mode === 'pending' && !cancelled && quick) this.h.tap && this.h.tap(p.x, p.y);
    this.mode = null; this.grabbed = null; this.start = null;
  }
  cancelAll() {
    if (this.grabbed && this.mode === 'grab') this.grabbed.end(0, 0, true);
    this.pointers.clear(); this.mode = null; this.grabbed = null; this.start = null;
  }
}
