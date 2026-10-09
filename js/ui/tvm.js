/*
 * 售票机面板（给小朋友用）：
 *   ① 选站：屏幕就是线路图（1 号线 / 2 号线两个大标签），点一个站它就亮起来，下面显示票价（游戏票价）；
 *   ② 投币：点 1 元硬币或 5 元纸币，钱会飞进投币口（叮），够了自动出票；
 *   ③ 出票：圆形单程票从出票口掉进取票槽，弹两下、闪一下光，再飞进右上角的“背包”小标签。
 *   也可以切到「羊城通」：带上一张羊城通，进站出站都刷一下。
 */
import { LINES, STATIONS } from '../data/lines.js';
import { lineSVG, fareFor, stopsBetween } from './netmap.js';
const $ = id => document.getElementById(id);
const ico = (id, cls = 'ico') => `<svg class="${cls}"><use href="#i-${id}"/></svg>`;
export const TOKEN_HTML = '<span class="tok"><i></i></span>';
export const CARD_HTML = '<span class="ycard"><b>羊城通</b><i></i></span>';

export class TvmPanel {
  constructor({ Audio }) {
    this.Audio = Audio; this.el = $('tvm'); this.isOpen = false; this.step = 'pick'; this.timers = [];
    this.el.addEventListener('pointerdown', e => this.onDown(e));
    ['pointermove', 'pointerup', 'click', 'touchstart'].forEach(t => this.el.addEventListener(t, e => e.stopPropagation()));
  }
  info() { return { open: this.isOpen, step: this.step, mode: this.mode, line: this.line, sel: this.sel, fare: this.fare, paid: this.paid }; }
  open(here, line, cb) {
    Object.assign(this, { here, line, cb, sel: null, fare: 0, paid: 0, mode: 'token', step: 'pick' });
    this.el.hidden = false; this.isOpen = true; this.el.classList.remove('out'); this.render();
  }
  close() {
    this.timers.forEach(clearTimeout); this.timers = [];
    this.el.classList.add('out'); this.isOpen = false; this.step = 'closed';
    setTimeout(() => { if (!this.isOpen) this.el.hidden = true; }, 220);
  }
  later(ms, f) { this.timers.push(setTimeout(f, ms)); }
  onDown(e) {
    e.stopPropagation();
    const t = e.target.closest('[data-act], .st'); if (!t) return;
    e.preventDefault();
    if (t.classList.contains('st') && this.step === 'pick') return this.pick(t.dataset.code);
    const act = t.dataset.act, v = t.dataset.v;
    t.classList.add('press'); setTimeout(() => t.classList.remove('press'), 140);
    if (act === 'close') { this.Audio.blip('tap'); this.close(); }
    else if (act === 'mode') { this.Audio.blip('tap'); this.mode = v; this.step = v === 'card' ? 'card' : 'pick'; this.render(); }
    else if (act === 'line') { this.Audio.blip('tap'); this.line = +v; this.render(); }
    else if (act === 'pay' && this.sel) { this.Audio.blip('tap'); this.step = 'pay'; this.paid = 0; this.render(); }
    else if (act === 'back') { this.Audio.blip('tap'); this.step = 'pick'; this.render(); }
    else if (act === 'coin' && this.step === 'pay' && this.paid < this.fare) this.coin(+v, t);
    else if (act === 'takecard') this.takeCard();
    else if (act === 'take') this.flyToken();
  }
  pick(code) {
    if (code === this.here) { this.Audio.blip('oops'); this.say('你就在这一站哦，选别的站吧'); return; }
    this.sel = code; this.fare = fareFor(this.here, code); this.Audio.blip('settle'); this.render();
  }
  say(t) { const a = this.el.querySelector('.ask'); if (a) { a.textContent = t; a.classList.remove('nudge'); void a.offsetWidth; a.classList.add('nudge'); } }
  render() {
    const S = STATIONS, head = `<header><div class="ttl">${ico('tvm')}<b>自动售票机</b></div>
      <div class="seg"><button data-act="mode" data-v="token" class="${this.mode === 'token' ? 'on' : ''}">${TOKEN_HTML}单程票</button><button data-act="mode" data-v="card" class="${this.mode === 'card' ? 'on' : ''}">${CARD_HTML}羊城通</button></div>
      <button class="x" data-act="close" aria-label="关闭">${ico('close')}</button></header>`;
    let body = '';
    if (this.step === 'pick') {
      const tabs = [1, 2].map(l => `<button data-act="line" data-v="${l}" class="ln${this.line === l ? ' on' : ''}" style="--lc:${LINES[l].color};--li:${LINES[l].ink}"><b>${l}</b>号线</button>`).join('');
      const sel = this.sel, n = sel ? stopsBetween(this.here, sel) : 0;
      body = `<div class="pick"><div class="row"><div class="tabs">${tabs}</div><div class="ask">点一点，你要去哪一站？</div></div>
        <div class="mapbox">${lineSVG(this.line, { here: this.here, sel })}</div>
        <div class="bar${sel ? ' ready' : ''}">${sel ? `<div class="dest"><span>去</span><b>${S[sel].zh}</b><small>${n} 站</small></div>
          <div class="fare"><b>${this.fare}</b><span>元</span><small>游戏票价</small></div><button class="go" data-act="pay">${ico('coin')}去投币</button>`
          : `<div class="dest muted">还没选车站</div>`}</div></div>`;
    } else if (this.step === 'pay') {
      const pips = Array.from({ length: this.fare }, (_, i) => `<i class="${i < this.paid ? 'on' : ''}"></i>`).join('');
      body = `<div class="pay"><div class="left"><div class="trip">${TOKEN_HTML}<span>${S[this.here].zh}</span><b>→</b><span class="to">${S[this.sel].zh}</span></div>
          <div class="slotbox"><div class="slot coin-slot"><i></i></div><div class="slot note-slot"><i></i></div></div>
          <div class="pips">${pips}</div><div class="paid">已投 <b>${this.paid}</b> 元 · 票价 ${this.fare} 元</div></div>
        <div class="right"><div class="ask">点硬币或纸币，投进去！</div>
          <div class="money"><button data-act="coin" data-v="1" class="coin1"><span>1</span><small>元</small></button><button data-act="coin" data-v="5" class="note5"><span>5</span><small>元</small></button></div>
          <button class="back" data-act="back">${ico('back')}换车站</button></div></div>`;
    } else if (this.step === 'drop') {
      const ch = this.paid - this.fare;
      body = `<div class="drop"><div class="mach"><div class="scr">出票中…</div><div class="mouth"></div><div class="tray">${ch > 0 ? `<div class="change">${'<i class="c"></i>'.repeat(Math.min(ch, 4))}</div>` : ''}
        <div class="tokwrap" data-act="take">${TOKEN_HTML}<s class="glint"></s></div></div><div class="traylbl">取票 · 找零</div></div>
        <div class="msg"><b>拿好你的单程票！</b><span>去 ${S[this.sel].zh} · <span class="nw">进站时在闸机上刷一下</span></span>${ch > 0 ? `<em>找零 ${ch} 元</em>` : ''}</div></div>`;
    } else if (this.step === 'card') {
      body = `<div class="cardstep"><div class="bigcard">${CARD_HTML}</div><div class="msg"><b>羊城通</b><span>可以一直用，<span class="nw">进站、出站</span>都<span class="nw">在闸机上刷一下</span></span></div>
        <button class="go" data-act="takecard">${ico('card')}带上羊城通</button></div>`;
    }
    this.el.innerHTML = `<div class="sheet glass">${head}<main>${body}</main></div>`;
    if (this.step === 'drop') this.dropAnim();
  }
  coin(v, btn) {
    const from = btn.getBoundingClientRect(), slot = this.el.querySelector(v === 1 ? '.coin-slot' : '.note-slot').getBoundingClientRect();
    const f = document.createElement('div'); f.className = 'flymoney ' + (v === 1 ? 'coin1' : 'note5'); f.innerHTML = `<span>${v}</span>`;
    document.body.appendChild(f);
    const w = v === 1 ? 84 : 120, h = v === 1 ? 84 : 64, x0 = from.left + from.width / 2 - w / 2, y0 = from.top + from.height / 2 - h / 2, x1 = slot.left + slot.width / 2 - w / 2, y1 = slot.top + slot.height / 2 - h / 2;
    f.style.left = x0 + 'px'; f.style.top = y0 + 'px';
    this.Audio.blip('tap');
    const a = f.animate([{ transform: 'translate(0,0) scale(1) rotate(0)' }, { transform: `translate(${(x1 - x0) * 0.55}px,${(y1 - y0) * 0.55 - 60}px) scale(1.05) rotate(${v === 1 ? 200 : 8}deg)`, offset: 0.55 },
      { transform: `translate(${x1 - x0}px,${y1 - y0}px) scale(${v === 1 ? 0.55 : 0.6}, ${v === 1 ? 0.15 : 0.5}) rotate(${v === 1 ? 360 : 0}deg)`, opacity: 0.2 }], { duration: 520, easing: 'cubic-bezier(.4,.1,.5,1)' });
    a.onfinish = () => {
      f.remove(); this.Audio.blip(v === 1 ? 'coin' : 'note');
      this.paid += v;
      const s = this.el.querySelector(v === 1 ? '.coin-slot' : '.note-slot'); if (s) { s.classList.remove('flash'); void s.offsetWidth; s.classList.add('flash'); }
      this.el.querySelectorAll('.pips i').forEach((p, i) => p.classList.toggle('on', i < this.paid));
      const pd = this.el.querySelector('.paid b'); if (pd) pd.textContent = this.paid;
      if (this.paid >= this.fare) { this.say('够啦！正在出票…'); this.later(450, () => { this.step = 'drop'; this.render(); }); }
      else this.say(`还差 ${this.fare - this.paid} 元`);
    };
  }
  dropAnim() {
    // 出票机内部“咔嗒”→ 单程票掉进取票槽（弹两下）→ 闪一下光 → 自动飞进背包
    this.later(250, () => this.Audio.blip('whirr'));
    this.later(700, () => { this.el.querySelector('.drop')?.classList.add('dropping'); });
    this.later(1150, () => this.landed());
    this.later(1550, () => this.Audio.blip('clink'));
    this.later(1950, () => { this.Audio.blip('sparkle'); this.el.querySelector('.drop')?.classList.add('shining'); });
    this.later(3300, () => this.flyToken());
  }
  /** 单程票落进取票槽：屏幕标题从“出票中…”变成“出票成功” */
  landed() {
    this.Audio.blip('drop');
    const t = this.el.querySelector('.drop .scr'); if (t) { t.textContent = '出票成功'; t.classList.add('ok'); }
  }
  flyToken() {
    if (this.step !== 'drop' || this.flown) return; this.flown = true;
    const tk = this.el.querySelector('.tokwrap .tok'), chip = $('inv');
    this.cb.token(this.sel, this.fare);   // 先放进背包（标签出现），再让飞过去的那枚落上去
    const r0 = tk.getBoundingClientRect(); chip.classList.add('wait');
    const r1 = chip.querySelector('.tok, .ycard')?.getBoundingClientRect() || chip.getBoundingClientRect();
    flyEl(TOKEN_HTML, r0, r1, 700, () => { chip.classList.remove('wait'); popChip(); this.Audio.blip('settle'); });
    tk.style.visibility = 'hidden';
    this.later(260, () => { this.flown = false; this.close(); });
  }
  takeCard() {
    const c = this.el.querySelector('.bigcard .ycard'), r0 = c.getBoundingClientRect(), chip = $('inv');
    this.cb.card(); chip.classList.add('wait');
    const r1 = chip.querySelector('.ycard')?.getBoundingClientRect() || chip.getBoundingClientRect();
    this.Audio.blip('sparkle');
    flyEl(CARD_HTML, r0, r1, 650, () => { chip.classList.remove('wait'); popChip(); this.Audio.blip('settle'); });
    c.style.visibility = 'hidden';
    this.later(240, () => this.close());
  }
}
/** 把一个小东西从 r0 飞到 r1（屏幕坐标，弧线 + 缩放） */
export function flyEl(html, r0, r1, ms, done) {
  const f = document.createElement('div'); f.className = 'flyitem'; f.innerHTML = html; document.body.appendChild(f);
  f.style.left = r0.left + 'px'; f.style.top = r0.top + 'px'; f.style.width = r0.width + 'px'; f.style.height = r0.height + 'px';
  const dx = r1.left + r1.width / 2 - (r0.left + r0.width / 2), dy = r1.top + r1.height / 2 - (r0.top + r0.height / 2), s = Math.max(0.2, r1.width / r0.width);
  const a = f.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx * 0.45}px,${dy * 0.45 - 90}px) scale(${(1 + s) / 2 * 1.15}) rotate(-12deg)`, offset: 0.45 }, { transform: `translate(${dx}px,${dy}px) scale(${s})` }],
    { duration: ms, easing: 'cubic-bezier(.45,.05,.4,1)' });
  a.onfinish = () => { f.remove(); done && done(); };
}
export function popChip() { const c = $('inv'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
