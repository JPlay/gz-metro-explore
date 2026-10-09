/*
 * 说话气泡（DOM，跟着 3D 里说话的人走）：白底圆角、小尾巴指向说话的人、大字。
 *   第一行粤语（大），第二行普通话（小）；也可以传 html（问路的回答：线路色块）。
 *   2.6 秒后淡出（问路回答 7 秒，内容多，小朋友要慢慢看）；同时最多 2 个，再来新的就把最老的收掉。
 *   永远不压住摇杆和按钮：位置限制在安全区里（顶上按钮一排以下、底部大按钮 / 摇杆以上），压到摇杆就往上挪。
 */
const B = window.BABYLON;
const MAX = 2;
export class Bubbles {
  constructor(scene, cam) {
    this.scene = scene; this.cam = cam; this.list = [];
    this.layer = document.createElement('div'); this.layer.id = 'bubbles'; document.getElementById('hud').appendChild(this.layer);
  }
  /** who: { pos() → BABYLON.Vector3（头顶上方一点） }；yue = 粤语，zh = 普通话 */
  say(who, { yue, zh, html, ms = 2600, kind = '' }) {
    while (this.list.length >= MAX) this.drop(this.list[0]);
    const el = document.createElement('div'); el.className = 'bubble ' + kind;
    el.innerHTML = html || `<b class="yue">${yue}</b>${zh ? `<span class="zh">${zh}</span>` : ''}`;
    el.insertAdjacentHTML('beforeend', '<i class="tail"></i>');
    this.layer.appendChild(el);
    const b = { who, el, t: ms / 1000, ms, kind }; this.list.push(b); this.place(b);
    return b;
  }
  drop(b) { const i = this.list.indexOf(b); if (i >= 0) this.list.splice(i, 1); b.el.classList.add('out'); setTimeout(() => b.el.remove(), 320); }
  clear() { [...this.list].forEach(b => this.drop(b)); }
  /** 安全区：上面避开 HUD 顶栏，下面避开大按钮 / 摇杆提示（底部 ~210px） */
  safe() {
    const W = innerWidth, H = innerHeight;
    // 顶上：左上角站名牌、右上角按钮一排的下沿再留一点
    const top = ['where', 'btns'].map(id => document.getElementById(id)).filter(e => e && !e.hidden && e.getClientRects().length).reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom + 16), 112);
    return { l: 12, r: W - 12, t: top, b: H - 214 };
  }
  place(b) {
    const W = innerWidth, H = innerHeight, p = b.who.pos();
    const v = B.Vector3.Project(p, B.Matrix.IdentityReadOnly, this.scene.getTransformMatrix(), this.cam.viewport.toGlobal(W, H));
    const behind = v.z < 0 || v.z > 1, off = v.x < 0 || v.x > W || v.y < 0 || v.y > H;
    const w = b.el.offsetWidth, h = b.el.offsetHeight, S = this.safe();
    let x = v.x - w / 2, y = v.y - h - 18;
    x = Math.max(S.l, Math.min(S.r - w, x)); y = Math.max(S.t, Math.min(S.b - h, y));
    // 摇杆正在用（手指下面那个）：气泡压到它就挪到它上面
    const st = document.getElementById('stick');
    if (st && !st.hidden) { const r = st.getBoundingClientRect(); if (x < r.right + 8 && x + w > r.left - 8 && y + h > r.top - 8) y = Math.max(S.t, r.top - 8 - h); }
    b.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    // 尾巴：指向说话的人（水平方向贴着人，夹在气泡里）；人在气泡上方（被安全区往下推）时尾巴放到顶上
    const tx = Math.max(22, Math.min(w - 22, v.x - x)), up = !behind && v.y < y;
    b.el.classList.toggle('up', up); b.el.querySelector('.tail').style.left = tx.toFixed(1) + 'px';
    b.el.classList.toggle('hide', behind); b.el.classList.toggle('notail', off); // 人在画面外：气泡留着，但不指错方向
    b.sx = x; b.sy = y; b.vx = v.x; b.vy = v.y;
  }
  update(dt) { for (const b of [...this.list]) { b.t -= dt; if (b.t <= 0) this.drop(b); else this.place(b); } }
  info() { return this.list.map(b => ({ text: b.el.textContent, kind: b.kind, rect: (r => [r.left, r.top, r.right, r.bottom].map(Math.round))(b.el.getBoundingClientRect()), speaker: [Math.round(b.vx), Math.round(b.vy)] })); }
}
