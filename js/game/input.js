/*
 * 触屏 + 键鼠输入（我的世界 PE 风格）：
 *   左边 45% 区域：按下的位置出现摇杆（鼠标和触摸一样），推得越远走得越快，推到边 = 跑；
 *   右边：单指/鼠标拖动转视角，双指捏合缩放（第三人称）；
 *   从摇杆开始的指针绝不会转视角（pointerId 只进 stick，不进 looks）；
 *   键盘：WASD/方向键 走，Shift 跑，空格 跳，V 切视角，M 静音；在右侧按下后可指针锁定转头。
 */
export class Input {
  constructor({ surface, stick, hint, onView, onMute, onJump }) {
    this.move = { x: 0, y: 0 }; this.run = false; this.look = { x: 0, y: 0 }; this.pinch = 0; this.jumpQueued = false;
    this.keys = {}; this.stickId = null; this.looks = new Map(); this.pinchDist = 0; this.virtual = null; this.used = false;
    this.stickEl = stick; this.hintEl = hint; this.R = 70;
    const s = surface;
    s.addEventListener('pointerdown', e => this.down(e));
    window.addEventListener('pointermove', e => this.moveEv(e), { passive: false });
    window.addEventListener('pointerup', e => this.up(e)); window.addEventListener('pointercancel', e => this.up(e));
    s.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('gesturestart', e => e.preventDefault());
    window.addEventListener('keydown', e => {
      if (e.repeat) return; this.keys[e.code] = true; this.used = true;
      if (e.code === 'Space') { this.jumpQueued = true; e.preventDefault(); }
      if (e.code === 'KeyV') onView(); if (e.code === 'KeyM') onMute();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
    this.surface = s; this.onJump = onJump;
    document.addEventListener('mousemove', e => { if (document.pointerLockElement === s) { this.look.x += e.movementX; this.look.y += e.movementY; } });
  }
  down(e) {
    e.preventDefault(); this.used = true;
    // 左半边：摇杆（鼠标 / 触摸统一）。该 pointerId 只驱动移动，绝不进 looks。
    if (e.clientX < innerWidth * 0.45 && this.stickId === null) {
      this.stickId = e.pointerId; this.base = { x: e.clientX, y: e.clientY };
      this.stickEl.hidden = false; this.stickEl.style.left = e.clientX + 'px'; this.stickEl.style.top = e.clientY + 'px';
      this.stickEl.querySelector('.knob').style.transform = ''; this.hintEl.classList.add('off');
      try { this.surface.setPointerCapture(e.pointerId); } catch (_) {}
      return;
    }
    // 右半边：转视角。仅在这里请求指针锁定（摇杆按下不会锁）。
    if (e.pointerType === 'mouse' && document.pointerLockElement !== this.surface && this.surface.requestPointerLock) {
      try { const p = this.surface.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) {}
    }
    this.looks.set(e.pointerId, { x: e.clientX, y: e.clientY, mouse: e.pointerType === 'mouse' });
    if (this.looks.size === 2) this.pinchDist = this.dist();
    try { this.surface.setPointerCapture(e.pointerId); } catch (_) {}
  }
  dist() { const a = [...this.looks.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
  moveEv(e) {
    if (e.pointerId === this.stickId) {
      let dx = e.clientX - this.base.x, dy = e.clientY - this.base.y; const d = Math.hypot(dx, dy), R = this.R;
      if (d > R) { dx *= R / d; dy *= R / d; }
      this.move.x = dx / R; this.move.y = -dy / R; this.run = d > R * 0.92;
      this.stickEl.querySelector('.knob').style.transform = `translate(${dx}px, ${dy}px)`;
      this.stickEl.classList.toggle('run', this.run);
      e.preventDefault(); return;
    }
    const p = this.looks.get(e.pointerId); if (!p) return;
    if (p.mouse && document.pointerLockElement === this.surface) return;
    if (p.mouse && !(e.buttons & 1)) return;
    if (this.looks.size >= 2) { const before = this.pinchDist; p.x = e.clientX; p.y = e.clientY; const now = this.dist(); this.pinch += now - before; this.pinchDist = now; }
    else { this.look.x += e.clientX - p.x; this.look.y += e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; }
    e.preventDefault();
  }
  up(e) {
    if (e.pointerId === this.stickId) { this.stickId = null; this.move.x = this.move.y = 0; this.run = false; this.stickEl.hidden = true; this.stickEl.classList.remove('run'); }
    if (this.looks.delete(e.pointerId) && this.looks.size === 2) this.pinchDist = this.dist();
  }
  /** 每帧读一次：移动向量（含键盘），视角增量，捏合增量，跳 */
  read() {
    let mx = this.move.x, my = this.move.y, run = this.run;
    const k = this.keys;
    const kx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), ky = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    if (kx || ky) { const l = Math.hypot(kx, ky); mx = kx / l * 0.75; my = ky / l * 0.75; if (k.ShiftLeft || k.ShiftRight) { mx /= 0.75; my /= 0.75; run = true; } }
    if (this.virtual) { mx = this.virtual.x; my = this.virtual.y; run = !!this.virtual.run; }
    const out = { mx, my, run, lx: this.look.x, ly: this.look.y, pinch: this.pinch, jump: this.jumpQueued };
    this.look.x = this.look.y = 0; this.pinch = 0; this.jumpQueued = false;
    return out;
  }
}
/** 按钮：按下立即变色缩放（不等 click） */
export function pressable(el, fn) {
  const on = e => { e.preventDefault(); e.stopPropagation(); el.classList.add('press'); fn(e); };
  const off = () => el.classList.remove('press');
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
  el.addEventListener('click', e => e.preventDefault());
}
