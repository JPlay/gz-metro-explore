/*
 * 三语报站（普通话 → 粤语 → 英语），片段与组合规则完全沿用旧项目 manifest.json：
 *   next     = 终点方向三语 → 下一站三语 → 下车侧/换乘三语（公园前：右门下车、中部楼梯换乘 2 号线；其余：左门下车）
 *   arrive   = 列车即将到达 XX 站，请小心空隙
 *   welcome  = 欢迎光临 XX 站，请排队候车，先下后上
 *   platform = X 站台，广州东站/西塱方向列车即将进站（站台编号为场景约定：上行 1、下行 2）
 *   doorsClosing / gap / transfer / terminal / destination
 * 本游戏沿上行方向（往广州东站）依次经过 公园前 → 农讲所 → 烈士陵园 → 东山口。
 */
import * as Audio from './audio.js';

export const LANGS = ['zh', 'yue', 'en'];
const seq = prefix => LANGS.map(l => `voice.${prefix}.${l}`);
const ALIASES = { arrival: 'arrive', arrived: 'arrive', nextStation: 'next', approach: 'platform', doorClose: 'doorsClosing', closeDoors: 'doorsClosing' };

function dirOf(p) {
  const d = p.dir ?? p.direction ?? p.destination;
  return d === -1 || d === 'down' || d === '西塱' || d === 'Xilang' ? 'down' : 'up';
}
/** 与旧版 announcement() 相同的取片段逻辑 */
export function idsFor(key, p = {}) {
  const m = Audio.getManifest();
  if (!m) throw new Error('音频清单尚未加载');
  key = ALIASES[key] || key;
  const sid = p.station || 'gyq', d = dirOf(p);
  if (m.announcements[key]) return m.announcements[key].slice();
  if (key === 'platform') return seq(`platform.${d}.${p.platform === 1 || p.platform === 2 ? p.platform : (d === 'up' ? 1 : 2)}`);
  if (key === 'destination' || key === 'terminal') return seq(`${key}.${d}`);
  if (key === 'transfer') return sid === 'gyq' || sid === 'dsk' ? seq(`transfer.${sid}`) : [];
  const route = m.routes[`${sid}_${d}`];
  if (route && route.announcements[key]) return route.announcements[key].slice();
  throw new Error(`未知广播或车站：${key}/${sid}`);
}
export async function announce(key, params = {}, meta = {}) {
  await Audio.loadManifest();
  return Audio.announceIds(idsFor(key, params), { key, ...meta });
}
/** 行车途中的“下一站”广播：第一程带终点方向；之后只报下一站 + 下车侧/换乘（节奏更适合孩子） */
export async function announceNext(stationId, { withDestination = false } = {}) {
  await Audio.loadManifest();
  const full = idsFor('next', { station: stationId, dir: 1 });
  const ids = withDestination ? full : full.slice(3);
  return Audio.announceIds(ids, { key: 'next' });
}
/** 某组广播的总时长（秒，来自清单），用于在静音时安排节奏 */
export function durationOf(ids) {
  return ids.reduce((s, id) => { const a = Audio.getAsset(id); return s + (a ? a.duration || 2 : 2) + 0.22; }, 0);
}
/** 进站前预取该站会用到的语音 */
export async function prefetchStation(stationId) {
  try {
    await Audio.loadManifest();
    Audio.prefetch([...idsFor('welcome', { station: stationId }), ...idsFor('platform', { station: stationId, dir: 1 }), ...idsFor('doorsClosing')]);
  } catch (_) {}
}
