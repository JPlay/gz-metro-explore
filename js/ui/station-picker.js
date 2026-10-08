// 城市枢纽底部的车站选择条：颜色 + 地标图标 + 站名，完成的车站会亮起星星。
import { stationName, stationSub, onLang } from './i18n.js';

export class StationPicker {
  constructor(stations, { onPick }) {
    this.el = document.getElementById('picker'); this.stations = stations; this.onPick = onPick;
    this.el.innerHTML = '';
    this.buttons = stations.map((st, i) => {
      const b = document.createElement('button');
      b.className = 'st-btn'; b.style.setProperty('--c', st.cssColor); b.dataset.station = st.id;
      b.innerHTML = `<span class="num">${i + 1}</span><span class="emblem">${st.emblem}</span><b></b><small></small><span class="star">★</span>`;
      b.addEventListener('click', () => this.onPick && this.onPick(st.id));
      this.el.appendChild(b); return b;
    });
    onLang(() => this.refresh()); this.refresh();
  }
  refresh(done) {
    if (done) this.done = done;
    this.buttons.forEach((b, i) => {
      const st = this.stations[i];
      b.querySelector('b').textContent = stationName(st); b.querySelector('small').textContent = stationSub(st);
      b.classList.toggle('done', !!(this.done && this.done[st.id]));
      b.setAttribute('aria-label', st.zh + ' ' + st.en);
    });
  }
  show() { this.el.hidden = false; }
  hide() { this.el.hidden = true; }
}
