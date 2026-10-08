// 标题页：大大的“出发”按钮（第一次触摸同时解锁 iOS 音频）。
import { setLang, getLang, onLang } from './i18n.js';

export class TitleScreen {
  constructor({ onStart }) {
    this.el = document.getElementById('title');
    document.getElementById('btnStart').addEventListener('click', () => onStart && onStart());
    this.el.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); setLang(b.dataset.lang); }));
    const mark = () => this.el.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === getLang()));
    onLang(mark); mark();
  }
  show() { this.el.hidden = false; }
  hide() { this.el.hidden = true; }
}
