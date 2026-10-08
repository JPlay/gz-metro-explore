/*
 * 广州地铁 1 号线、2 号线车站数据（游戏里列车真正停靠的全部车站）。
 *
 * 数据来源（2026-10-08 核对，三处一致）：
 *   [1] 英文维基百科 Line 1 (Guangzhou Metro)  https://en.wikipedia.org/wiki/Line_1_(Guangzhou_Metro)
 *       —— 16 站顺序、英文站名、线路色 Yellow #f3d03e、各站已开通换乘线路
 *   [2] 英文维基百科 Line 2 (Guangzhou Metro)  https://en.wikipedia.org/wiki/Line_2_(Guangzhou_Metro)
 *       —— 24 站顺序（2-01 广州南站 … 2-24 嘉禾望岗）、英文站名、线路色 Blue #00629b、换乘
 *   [3] 中文维基百科 广州地铁1号线 / 广州地铁2号线
 *       https://zh.wikipedia.org/zh-cn/广州地铁1号线 ；https://zh.wikipedia.org/zh-cn/广州地铁2号线
 *       —— 中文站名、车站编号、“1号线代表色为黄色”“2号线标识色为蓝色”、已投入使用 / 未来换乘站区分
 *   [4] 百度百科 广州地铁1号线（站名与换乘线路交叉核对）
 *   [5] 其他线路颜色（只用于换乘标识）：英文维基 Module:Adjacent stations/Guangzhou Metro
 *   广州地铁官网 gzmtr.com 在核对时从本机网络访问超时（504），未能直接引用，详见 README。
 *
 * 结论：1 号线是黄色（不是黄绿色），2 号线是蓝色（#00629b）。
 * 换乘只列“已开通”的线路；未开通的（如烈士陵园 12 号线、纪念堂 13/24 号线、市二宫 28 号线）不显示。
 * 方向约定：数组顺序 = 站号递增方向。1 号线递增 = 往广州东站（dir 'up'），递减 = 往西塱（'down'）；
 *           2 号线递增 = 往嘉禾望岗（'l2n'），递减 = 往广州南站（'l2s'）。
 * code 用于语音片段 id：沿用旧项目的 gyq/njs/lsly/dsk，其余为站名拼音缩写。
 */
export const LINES = {
  1: {
    id: 1, zh: '1号线', en: 'Line 1', color: '#F3D03E', ink: '#3A3000', soft: '#FFF3C4',
    dirs: { up: { zh: '广州东站', en: 'Guangzhou East Railway Station', step: 1 }, down: { zh: '西塱', en: 'Xilang', step: -1 } },
    stations: ['xl', 'kk', 'hdw', 'fc', 'hs', 'csl', 'cjc', 'xmk', 'gyq', 'njs', 'lsly', 'dsk', 'yj', 'tyxl', 'tyzx', 'gzdz']
  },
  2: {
    id: 2, zh: '2号线', en: 'Line 2', color: '#00629B', ink: '#FFFFFF', soft: '#CFE6F5',
    dirs: { l2n: { zh: '嘉禾望岗', en: 'Jiahewanggang', step: 1 }, l2s: { zh: '广州南站', en: 'Guangzhou South Railway Station', step: -1 } },
    stations: ['gznz', 'sb', 'hj', 'np', 'lx', 'nz', 'dxn', 'jtl', 'cg', 'jnx', 'seg', 'hzgc', 'gyq', 'jnt', 'yxgy', 'gzhcz', 'syl', 'fxgy', 'bygy', 'bywhgc', 'xg', 'jx', 'hb', 'jhwg']
  }
};

/** 其他线路：只用于换乘标识（颜色来源 [5]） */
export const OTHER_LINES = {
  3: { zh: '3号线', en: 'Line 3', color: '#ECA154', num: '三', enNum: 'Three' },
  5: { zh: '5号线', en: 'Line 5', color: '#C5003E', num: '五', enNum: 'Five' },
  6: { zh: '6号线', en: 'Line 6', color: '#80225F', num: '六', enNum: 'Six' },
  7: { zh: '7号线', en: 'Line 7', color: '#97D700', num: '七', enNum: 'Seven' },
  8: { zh: '8号线', en: 'Line 8', color: '#008C95', num: '八', enNum: 'Eight' },
  10: { zh: '10号线', en: 'Line 10', color: '#7389B2', num: '十', enNum: 'Ten' },
  11: { zh: '11号线', en: 'Line 11', color: '#FFB40C', num: '十一', enNum: 'Eleven' },
  12: { zh: '12号线', en: 'Line 12', color: '#505D12', num: '十二', enNum: 'Twelve' },
  14: { zh: '14号线', en: 'Line 14', color: '#81312F', num: '十四', enNum: 'Fourteen' },
  22: { zh: '22号线', en: 'Line 22', color: '#CD5228', num: '二十二', enNum: 'Twenty-two' },
  GF: { zh: '广佛线', en: 'Guangfo Line', color: '#C4D600', short: '广佛', name: '广佛线', enName: 'the Guangfo Line' },
  F2: { zh: '佛山2号线', en: 'Foshan Metro Line 2', color: '#E4007F', short: '佛2', name: '佛山地铁二号线', enName: 'Foshan Metro Line Two' },
  1: { zh: '1号线', en: 'Line 1', color: '#F3D03E', num: '一', enNum: 'One' },
  2: { zh: '2号线', en: 'Line 2', color: '#00629B', num: '二', enNum: 'Two' }
};

/** 车站：zh 官方中文名，en 官方英文名，lines 所在线路（1/2），x 已开通的其他换乘线路 */
export const STATIONS = {
  // —— 1 号线（1-01 … 1-16）
  xl: { zh: '西塱', en: 'Xilang', x: [10, 22, 'GF'] },
  kk: { zh: '坑口', en: 'Kengkou', x: [] },
  hdw: { zh: '花地湾', en: 'Huadiwan', x: [] },
  fc: { zh: '芳村', en: 'Fangcun', x: [11, 22] },
  hs: { zh: '黄沙', en: 'Huangsha', x: [6] },
  csl: { zh: '长寿路', en: 'Changshou Lu', x: [] },
  cjc: { zh: '陈家祠', en: 'Chen Clan Academy', x: [8] },
  xmk: { zh: '西门口', en: 'Ximenkou', x: [] },
  gyq: { zh: '公园前', en: 'Gongyuanqian', x: [], signature: 'park' },
  njs: { zh: '农讲所', en: 'Peasant Movement Institute', x: [], signature: 'redwall' },
  lsly: { zh: '烈士陵园', en: "Martyrs' Park", x: [], signature: 'memorial' },
  dsk: { zh: '东山口', en: 'Dongshankou', x: [6], signature: 'villa' },
  yj: { zh: '杨箕', en: 'Yangji', x: [5] },
  tyxl: { zh: '体育西路', en: 'Tiyu Xilu', x: [3] },
  tyzx: { zh: '体育中心', en: 'Tianhe Sports Center', x: [] },
  gzdz: { zh: '广州东站', en: 'Guangzhou East Railway Station', x: [3, 11] },
  // —— 2 号线（2-01 … 2-24）
  gznz: { zh: '广州南站', en: 'Guangzhou South Railway Station', x: [7, 22, 'F2'] },
  sb: { zh: '石壁', en: 'Shibi', x: [7] },
  hj: { zh: '会江', en: 'Huijiang', x: [] },
  np: { zh: '南浦', en: 'Nanpu', x: [] },
  lx: { zh: '洛溪', en: 'Luoxi', x: [] },
  nz: { zh: '南洲', en: 'Nanzhou', x: ['GF'] },
  dxn: { zh: '东晓南', en: 'Dongxiao South', x: [10] },
  jtl: { zh: '江泰路', en: 'Jiangtai Road', x: [11] },
  cg: { zh: '昌岗', en: 'Changgang', x: [8] },
  jnx: { zh: '江南西', en: 'Jiangnanxi', x: [] },
  seg: { zh: '市二宫', en: "The 2nd Workers' Cultural Palace", x: [] },
  hzgc: { zh: '海珠广场', en: 'Haizhu Square', x: [6] },
  jnt: { zh: '纪念堂', en: 'Sun Yat-sen Memorial Hall', x: [] },
  yxgy: { zh: '越秀公园', en: 'Yuexiu Park', x: [], signature: 'rams' },
  gzhcz: { zh: '广州火车站', en: 'Guangzhou Railway Station', x: [5], signature: 'railway' },
  syl: { zh: '三元里', en: 'Sanyuanli', x: [] },
  fxgy: { zh: '飞翔公园', en: 'Feixiang Park', x: [] },
  bygy: { zh: '白云公园', en: 'Baiyun Park', x: [] },
  bywhgc: { zh: '白云文化广场', en: 'Baiyun Culture Square', x: [12] },
  xg: { zh: '萧岗', en: 'Xiaogang', x: [] },
  jx: { zh: '江夏', en: 'Jiangxia', x: [] },
  hb: { zh: '黄边', en: 'Huangbian', x: [] },
  jhwg: { zh: '嘉禾望岗', en: 'Jiahewanggang', x: [3, 14] }
};
// 推导：每站所在的线路（1、2 号线），以及包含本线在内的全部换乘信息
for (const [id, l] of Object.entries(LINES)) l.stations.forEach(c => { const s = STATIONS[c]; s.code = c; (s.lines = s.lines || []).push(+id); });

export function stationIndex(line, code) { return LINES[line].stations.indexOf(code); }
/** 方向 key → 步进（+1 / -1） */
export function dirStep(line, dir) { return LINES[line].dirs[dir].step; }
export function dirFor(line, step) { return Object.keys(LINES[line].dirs).find(k => LINES[line].dirs[k].step === step); }
/** 某线某方向的下一站 code；到头返回 null */
export function nextStation(line, code, step) { const L = LINES[line].stations, i = L.indexOf(code) + step; return i >= 0 && i < L.length ? L[i] : null; }
export function isTerminal(line, code, step) { return nextStation(line, code, step) === null; }
/** 换乘线路（不含当前线）：本网络内另一条线 + 其他已开通线路 */
export function transfersAt(code, exceptLine) {
  const s = STATIONS[code];
  return [...s.lines.filter(l => l !== exceptLine), ...s.x];
}
