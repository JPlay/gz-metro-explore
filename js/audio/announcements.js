/*
 * 报站调度：把 js/data/phrases.js 生成的片段交给音频引擎排队播放。
 * 有 MP3 的片段走 DashScope 预生成语音；没有的自动用 Web Speech 朗读（zh-CN → zh-HK → en-US，rate 0.95），都显示字幕。
 */
import * as Audio from './audio.js';
import * as P from '../data/phrases.js';

export function say(segs, meta = {}) { return Audio.announceIds(segs, meta).catch(e => ({ error: String(e) })); }
export const depart = (line, nextCode, dir, step, withDest) => say(P.departSegs(line, nextCode, dir, step, withDest), { key: 'next', interrupt: true });
export const arrive = code => say(P.arriveSegs(code), { key: 'arrive', interrupt: true });
export const welcome = code => say(P.welcomeSegs(code), { key: 'welcome' });
export const platform = (line, dir, n) => say(P.platformSegs(line, dir, n), { key: 'platform', interrupt: true });
export const doorsClosing = () => say(P.doorsClosingSegs(), { key: 'doorsClosing', interrupt: true });
export const safety = k => say(P.safetySegs(k), { key: 'safety' });
