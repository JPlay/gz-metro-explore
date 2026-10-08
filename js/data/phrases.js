/*
 * 报站文案与语音片段 id（普通话 → 粤语 → 英语）。浏览器和 Node（tools/audio/export_jobs.mjs）共用。
 * 旧项目已有 90 条 MP3（公园前/农讲所/烈士陵园/东山口 + 1 号线方向等），这里的 id 与文字与之完全一致；
 * 新增车站 / 2 号线方向沿用同一句式，暂无 MP3 时由 Web Speech 按 text 朗读（见 js/audio/audio.js）。
 */
import { LINES, STATIONS, OTHER_LINES, isTerminal, transfersAt } from './lines.js';

export const LANGS = ['zh', 'yue', 'en'];
const LEGACY = new Set(['gyq', 'njs', 'lsly', 'dsk']);
const seg = (key, texts) => LANGS.map((l, i) => ({ id: `voice.${key}.${l}`, lang: l, text: texts[i] })).filter(s => s.text);

function xZh(list) { return list.map(k => { const o = OTHER_LINES[k]; return o.name || o.num + '号线'; }).join('、'); }
function xEn(list) {
  const n = list.map(k => { const o = OTHER_LINES[k]; return o.enName || 'Line ' + o.enNum; });
  return n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n[0];
}
function stationTexts(code, line) {
  const s = STATIONS[code], xs = transfersAt(code, line).filter(k => k !== line);
  return { zh: s.zh, en: s.en, xs };
}
/** 下一站（不含终点方向） */
export function nextSegs(line, code) {
  if (code === 'gyq') return [...seg('next.gyq', ['下一站，公园前。', '下一站，公园前。', 'The next station is Gongyuanqian.']),
    ...(line === 1 ? seg('transfer.gyq', ['请从列车前进方向的右门下车，中部楼梯换乘二号线。', '请由列车前进方向嘅右门落车，中部楼梯换乘二号线。', 'Please exit the train to the right. To transfer to Line Two, please take the stairs in the middle of the platform.'])
      : seg('transfer.gyq2', ['可换乘一号线。', '可换乘一号线。', 'The interchange with Line One.']))];
  if (code === 'dsk') return seg('next.dsk', ['下一站，东山口，可换乘六号线。', '下一站，东山口，可换乘六号线。', 'The next station is Dongshankou, the interchange with Line Six.']);
  const t = stationTexts(code, line);
  const zx = t.xs.length ? '，可换乘' + xZh(t.xs) : '', ex = t.xs.length ? ', the interchange with ' + xEn(t.xs) : '';
  return seg('next.' + code, [`下一站，${t.zh}${zx}。`, `下一站，${t.zh}${zx}。`, `The next station is ${t.en}${ex}.`]);
}
export function destinationSegs(line, dir) {
  const d = LINES[line].dirs[dir];
  return seg('destination.' + dir, [`本次列车终点站为，${d.zh}。`, `本次列车终点站为，${d.zh}。`, `The destination of this train is ${d.en}.`]);
}
export function terminalSegs(line, dir) {
  const d = LINES[line].dirs[dir];
  return seg('terminal.' + dir, [`下一站是本次列车的终点站，${d.zh}。请全部乘客带齐行李物品在此站下车，欢迎再次乘坐广州地铁。`,
    `下一站系本次列车嘅终点站，${d.zh}。请全部乘客带齐行李物品喺呢一站落车，欢迎再次乘坐广州地铁。`,
    `The next station is ${d.en}, the terminal of this journey. Please take all your belongings and leave the train. Thank you for travelling on Guangzhou Metro.`]);
}
/** 列车开出后：（首程带终点方向）+ 下一站 / 终点站 */
export function departSegs(line, nextCode, dir, step, withDestination) {
  const head = withDestination ? destinationSegs(line, dir) : [];
  return isTerminal(line, nextCode, step) ? [...head, ...terminalSegs(line, dir)] : [...head, ...nextSegs(line, nextCode)];
}
export function arriveSegs(code) {
  const s = STATIONS[code];
  return seg('arrive.' + code, [`列车即将到达${s.zh}站，请小心列车与站台之间的空隙。`, `列车即将到达${s.zh}站，请小心列车同站台之间嘅空隙。`, `The train is arriving at ${s.en}. Please mind the gap between the train and the platform.`]);
}
export function welcomeSegs(code) {
  const s = STATIONS[code];
  return seg('welcome.' + code, [`欢迎光临${s.zh}站。请排队候车，先下后上。`, `欢迎光临${s.zh}站。请排队候车，先落后上。`, `Welcome to ${s.en} station. Please line up for the train. Let the passengers get off first before you get on.`]);
}
export function platformSegs(line, dir, n) {
  const d = LINES[line].dirs[dir], num = ['一', '二'][n - 1];
  return seg(`platform.${dir}.${n}`, [`${num}站台，${d.zh}方向列车即将进站。`, `${num}站台，${d.zh}方向列车即将进站。`, `The train bound for ${d.en} is approaching at Platform ${n}.`]);
}
export const doorsClosingSegs = () => seg('doorsClosing', ['车门即将关闭，请注意安全，谨防被夹。', '车门即将关闭，请注意安全，谨防被夹。', 'The doors are closing. Please stand clear of the doors.']);
export const gapSegs = () => seg('gap', ['请小心列车与站台之间的空隙。', '请小心列车同站台之间嘅空隙。', 'Please mind the gap between the train and the platform.']);
const SAFETY = {
  queue: ['请不要越出黄色安全线，请按地面标识排队候车。', '请唔好行出黄色安全线，请按地面标识排队候车。'],
  psd: ['手或身体请勿扶靠屏蔽门、安全门。', '请唔好用手或者身体挨住屏蔽门、安全门。'],
  escalator: ['请站稳，并握紧黑色扶手带，请勿在扶梯口处停留。', '请企稳，握紧黑色扶手带，唔好喺扶梯口停留。'],
  walk: ['站内通行时请注意地面状况，严禁奔跑、追逐。', '喺车站行路请留意地面情况，唔好奔跑同追逐。']
};
export const safetySegs = k => seg('safety.' + k, [SAFETY[k][0], SAFETY[k][1], null]);

/** 全网需要的全部片段（用于生成缺失清单 / 语音生成任务） */
export function allJobs() {
  const out = new Map(), add = list => list.forEach(s => out.set(s.id, s));
  for (const [id, L] of Object.entries(LINES)) {
    const line = +id;
    for (const dir of Object.keys(L.dirs)) { add(destinationSegs(line, dir)); add(terminalSegs(line, dir)); add(platformSegs(line, dir, 1)); add(platformSegs(line, dir, 2)); }
    L.stations.forEach((c, i) => { if (i > 0 && i < L.stations.length - 1) add(nextSegs(line, c)); add(arriveSegs(c)); add(welcomeSegs(c)); });
  }
  add(doorsClosingSegs()); add(gapSegs()); Object.keys(SAFETY).forEach(k => add(safetySegs(k)));
  return [...out.values()].map(s => ({ ...s, file: 'voice/' + s.id.slice(6).replace(/\./g, '-') + '.mp3' }));
}
export { LEGACY };
