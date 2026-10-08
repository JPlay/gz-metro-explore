// 界面文字三语（普通话/粤语/英语）。界面以图标为主，文字只是辅助，孩子不识字也能玩。
import { CONFIG } from '../core/config.js';

const STR = {
  zh: { title: '一号线 · 方块奇境', subtitle: '坐上黄色的一号线，穿过会变形的方块城市', start: '出发', home: '城市', hint: '提示', sound: '声音', lang: '普通话', skip: '快进', allDone: '四个车站都去过啦！', again: '再坐一次', loading: '正在准备方块城市…' },
  yue: { title: '一号线 · 方块奇境', subtitle: '坐上黄色嘅一号线，穿过识变形嘅方块城市', start: '出发喇', home: '城市', hint: '提示', sound: '声音', lang: '粤语', skip: '飞过去', allDone: '四个车站都去过晒喇！', again: '再坐一次', loading: '准备紧方块城市…' },
  en: { title: 'Line 1 · Shape City', subtitle: 'Ride the yellow Line 1 through a city that changes shape', start: 'Go', home: 'City', hint: 'Hint', sound: 'Sound', lang: 'English', skip: 'Skip', allDone: 'You visited all four stations!', again: 'Ride again', loading: 'Building the shape city…' }
};
export const LANG_ICON = { zh: '普', yue: '粤', en: 'EN' };
const ORDER = ['zh', 'yue', 'en'];
let lang = (() => { try { const s = JSON.parse(localStorage.getItem(CONFIG.storageKey) || '{}'); return ORDER.includes(s.lang) ? s.lang : 'zh'; } catch (_) { return 'zh'; } })();
const listeners = [];

export function t(key) { return (STR[lang] && STR[lang][key]) || STR.zh[key] || key; }
export function getLang() { return lang; }
export function setLang(l) {
  if (!ORDER.includes(l)) return; lang = l;
  try { const s = JSON.parse(localStorage.getItem(CONFIG.storageKey) || '{}'); s.lang = l; localStorage.setItem(CONFIG.storageKey, JSON.stringify(s)); } catch (_) {}
  document.documentElement.lang = l === 'en' ? 'en' : (l === 'yue' ? 'zh-HK' : 'zh-CN');
  apply(); listeners.forEach(fn => fn(l));
}
export function cycleLang() { setLang(ORDER[(ORDER.indexOf(lang) + 1) % ORDER.length]); }
export function onLang(fn) { listeners.push(fn); }
export function apply() { document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); }); }
/** 车站名：普通话/粤语显示中文，英语显示英文站名 */
export function stationName(st) { return lang === 'en' ? st.en : st.zh; }
export function stationSub(st) { return lang === 'en' ? st.zh : st.en; }
