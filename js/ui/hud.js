// 顶部按钮：回城市、提示、声音、语言；中间是当前车站徽章。
import { t, cycleLang, getLang, LANG_ICON, onLang, stationName, stationSub } from './i18n.js';
import * as Audio from '../audio/audio.js';

export class Hud {
  constructor({ onHome, onHint }) {
    this.el = document.getElementById('hud');
    this.badge = document.getElementById('stationBadge');
    this.station = null;
    document.getElementById('btnHome').addEventListener('click', () => onHome && onHome());
    document.getElementById('btnHint').addEventListener('click', () => onHint && onHint());
    const snd = document.getElementById('btnSound'), sIco = document.getElementById('soundIco');
    snd.addEventListener('click', () => { Audio.setMuted(!Audio.isMuted()); sIco.textContent = Audio.isMuted() ? '×' : '♪'; snd.classList.toggle('on', Audio.isMuted()); });
    const langBtn = document.getElementById('btnLang');
    langBtn.addEventListener('click', () => cycleLang());
    onLang(() => this.refresh());
    this.refresh();
  }
  show(opts = {}) {
    this.el.hidden = false;
    document.getElementById('btnHome').hidden = !opts.home;
    document.getElementById('btnHint').hidden = !opts.hint;
  }
  hide() { this.el.hidden = true; }
  setStation(st) { this.station = st; this.badge.hidden = !st; this.refresh(); }
  refresh() {
    document.getElementById('langIco').textContent = LANG_ICON[getLang()];
    if (this.station) {
      document.getElementById('stationName').textContent = stationName(this.station);
      document.getElementById('stationSub').textContent = stationSub(this.station);
      this.badge.querySelector('.dot').style.background = this.station.cssColor;
    }
  }
}
