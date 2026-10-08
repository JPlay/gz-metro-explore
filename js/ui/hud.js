// HUD：左上角站名牌（线路色）、下一站提示、居中小提示（toast）。
import { LINES, STATIONS } from '../data/lines.js';
const $ = id => document.getElementById(id);
export class Hud {
  constructor() { this.toastT = null; this.key = ''; }
  where(code, line, nextCode) {
    const s = STATIONS[code], L = LINES[line] || LINES[s.lines[0]], key = code + line + (nextCode || '');
    if (key === this.key) return; this.key = key;
    const ln = $('whereLine'); ln.textContent = L.zh; ln.style.background = L.color; ln.style.color = L.ink;
    $('whereName').textContent = s.zh; $('whereEn').textContent = s.en;
    const n = $('next');
    if (nextCode) { n.hidden = false; n.textContent = `下一站：${STATIONS[nextCode].zh}  Next: ${STATIONS[nextCode].en}`; } else n.hidden = true;
  }
  toast(text, ms = 1800) {
    const t = $('toast'); t.textContent = text; t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(this.toastT); this.toastT = setTimeout(() => { t.hidden = true; }, ms);
  }
  setBtn(id, on, ico, lbl) { const b = $(id); b.classList.toggle('on', !!on); if (ico) b.querySelector('.ico').textContent = ico; if (lbl) b.querySelector('.lbl').textContent = lbl; }
}
