// HUD：左上角站名牌（广州地铁风格：线路色标 + 中文站名 + 英文站名 + 线路色底边）、下一站提示、居中提示（toast）。
import { LINES, STATIONS } from '../data/lines.js';
import { TOKEN_HTML, CARD_HTML, flyEl, popChip } from './tvm.js';
const $ = id => document.getElementById(id);
export class Hud {
  constructor() { this.toastT = null; this.key = ''; }
  where(code, line, nextCode) {
    const s = STATIONS[code], L = LINES[line] || LINES[s.lines[0]], key = code + line + (nextCode || '');
    if (key === this.key) return; const changed = this.key && this.key.slice(0, code.length) !== code; this.key = key;
    const w = $('where'); w.style.setProperty('--line', L.color); w.style.setProperty('--ink', L.ink);
    const ln = $('whereLine'); ln.innerHTML = `<b>${L.id}</b><small>号线</small>`; ln.setAttribute('aria-label', L.zh);
    $('whereName').textContent = s.zh; $('whereEn').textContent = s.en;
    if (changed) { w.classList.remove('swap'); void w.offsetWidth; w.classList.add('swap'); }
    const n = $('next');
    if (nextCode) { n.hidden = false; n.innerHTML = `<span class="tag">下一站<small>Next</small></span><span class="nm">${STATIONS[nextCode].zh}<small>${STATIONS[nextCode].en}</small></span>`; n.style.setProperty('--line', L.color); } else n.hidden = true;
  }
  toast(text, ms = 1800) {
    const t = $('toast'); t.textContent = text; t.hidden = false; t.classList.remove('out'); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(this.toastT); clearTimeout(this.toastT2);
    this.toastT = setTimeout(() => { t.classList.add('out'); this.toastT2 = setTimeout(() => { t.hidden = true; }, 260); }, ms);
  }
  /** 右下角动作大按钮（买票 / 刷卡 / 坐下 / 起身…）；act = null 时隐藏 */
  action(act) {
    this.act = act; const key = act ? act.id + act.label : '';
    if (key === this.actKey) return; this.actKey = key;
    const b = $('bAct'); if (!act) { b.hidden = true; return; }
    b.hidden = false; b.dataset.kind = act.id; b.querySelector('.ico use').setAttribute('href', '#i-' + act.icon); b.querySelector('.lbl').textContent = act.label;
    b.classList.remove('appear'); void b.offsetWidth; b.classList.add('appear');
  }
  /** 背包小标签：单程票（圆形 IC 票 + 目的地）或羊城通 */
  inv(v) {
    const c = $('inv');
    if (!v) { c.hidden = true; c.innerHTML = ''; return; }
    c.hidden = false;
    c.innerHTML = v.kind === 'token' ? `${TOKEN_HTML}<span class="t"><b>单程票</b><small>去 ${STATIONS[v.to].zh}</small></span>` : `${CARD_HTML}<span class="t"><b>羊城通</b><small>刷卡进出站</small></span>`;
  }
  chipPulse() { if (!$('inv').hidden) popChip(); }
  /** 单程票从背包标签飞到屏幕上的某一点（闸机回收口） */
  flyChipTo(pt) {
    const t = $('inv').querySelector('.tok'); if (!t) return;
    const r0 = t.getBoundingClientRect(), x = Math.max(20, Math.min(innerWidth - 20, pt.x)), y = Math.max(20, Math.min(innerHeight - 20, pt.y));
    flyEl(TOKEN_HTML, r0, { left: x - 6, top: y - 6, width: 12, height: 12 }, 650);
    t.style.visibility = 'hidden';
  }
  /** 没票提示气泡：h = { angle }（弧度，0 = 正前方，正 = 右边）；null 隐藏 */
  hint(h) {
    const el = $('hint');
    if (!h) { if (!el.hidden && !el.classList.contains('out')) { el.classList.add('out'); clearTimeout(this.hintT); this.hintT = setTimeout(() => { el.hidden = true; }, 250); } return; }
    if (el.hidden || el.classList.contains('out')) { clearTimeout(this.hintT); el.classList.remove('out'); el.hidden = false; }
    const a = Math.atan2(Math.sin(h.angle), Math.cos(h.angle)); // 归一到 (-π, π]
    el.querySelector('.arr').style.transform = `rotate(${a.toFixed(3)}rad)`;
    const t = Math.abs(a) > 2.2 ? '售票机在你身后' : a > 0.5 ? '售票机在右边' : a < -0.5 ? '售票机在左边' : '售票机在前面';
    const d = el.querySelector('.dir'); if (d.textContent !== t) d.textContent = t; this.hintAngle = a;
  }
  /** ico = 图标符号名（eye1 / eye3 / sound / mute） */
  setBtn(id, on, ico, lbl) {
    const b = $(id); b.classList.toggle('on', !!on);
    if (ico) b.querySelector('.ico use').setAttribute('href', '#i-' + ico);
    if (lbl) b.querySelector('.lbl').textContent = lbl;
  }
}
