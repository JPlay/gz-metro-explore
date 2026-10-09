/*
 * 车厢里的两块“屏”（画在 Canvas 动态贴图上，只在换站时重画）：
 *   ① 门上方的条形线路图（画布坐标 2048×256，贴图 1536×192）：线路色块 + 往哪儿开放在右端大箭头后面；本线全部车站按行进方向从左到右排开（站名竖排），
 *      已经过的站变灰，当前 / 下一站大而亮（呼吸光圈是另一块叠在上面的发光小片，见 train.js），
 *      还没到的线段上有白色小箭头，右端一个大箭头指向终点；换乘站画成双色圆环（本线色 + 换乘线色）。
 *   ② 车厢 LCD（1024×384）：「下一站 / Next」或「到站 / Arriving」+ 大号中文站名 + 英文站名。
 * 站名、站序全部来自 js/data/lines.js；1 号线 #F3D03E，2 号线 #00629B。
 */
import { LINES, STATIONS, OTHER_LINES } from '../data/lines.js';
import { FONT, FONT_EN, roundRect } from './kit.js';

export const STRIP_W = 2048, STRIP_H = 256, LCD_W = 1024, LCD_H = 384;
export const HOT = '#FF5A4E';            // 当前 / 下一站（和 HUD、售票机上的“你在这里”同一种红）
const GREY = '#C3C9D0', GREY_TXT = '#9BA4AF', INK = '#1B1D20';
// 线路色块（“1号线 往 广州东站”）放在右端、紧跟大箭头：左端正对车门中间的立柱，从过道看会被挡住
const X0 = 70, X1 = 1650, LY = 58, BX = 1728;      // 线段从 X0 到 X1，线的高度 LY（画布坐标，y 向下）；BX = 色块左边

/** 换乘环的第二种颜色：1/2 号线互换（公园前），其他已开通线路统一深色 */
export function transferColor(code, line) {
  const s = STATIONS[code], o = s.lines.find(l => l !== line);
  if (o) return LINES[o].color;
  // 能换乘其他线路：和全网图同一种样式（深色内圈），不按换乘线路上色
  return s.x.some(k => OTHER_LINES[k]) ? '#1B2430' : null;
}
/** 行进方向排好的站序（step=+1 原序，-1 倒序）、高亮站的下标、已经过的站数 */
export function stripModel(line, code, step, moving, nextCode) {
  const L = LINES[line], ord = step > 0 ? L.stations.slice() : L.stations.slice().reverse();
  const i = ord.indexOf(code), hot = moving && nextCode ? ord.indexOf(nextCode) : i;
  return { ord, hot, passed: hot };   // 下标 < passed 的都是经过的
}
export const stationX = (k, n) => X0 + (X1 - X0) * (n === 1 ? 0.5 : k / (n - 1));
/** 高亮站在条形图贴图上的位置（u: 0..1 左→右，v: 0..1 下→上） */
export function hotUV(line, code, step, moving, nextCode) {
  const m = stripModel(line, code, step, moving, nextCode);
  return { u: stationX(m.hot, m.ord.length) / STRIP_W, v: 1 - LY / STRIP_H };
}

export function drawStrip(c, line, code, step, moving, nextCode) {
  const L = LINES[line], W = STRIP_W, H = STRIP_H, { ord, hot, passed } = stripModel(line, code, step, moving, nextCode), n = ord.length;
  const dir = Object.values(L.dirs).find(d => d.step === step);
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#2A2E33'; c.fillRect(0, 0, W, H);                       // 黑色边框
  c.fillStyle = '#FBFBF8'; roundRect(c, 8, 8, W - 16, H - 16, 18); c.fill();
  // 左边：线路色块（大号线路号 + 往哪儿开）
  c.fillStyle = L.color; roundRect(c, BX, 20, 300, H - 40, 20); c.fill();
  c.fillStyle = L.ink; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.font = `800 92px ${FONT_EN}`; c.fillText(String(L.id), BX + 72, 112); c.font = `700 46px ${FONT}`; c.fillText('号线', BX + 180, 106);
  const dz = dir.zh, fz = dz.length > 4 ? 40 : 48;
  c.font = `700 ${fz}px ${FONT}`; c.fillText('往 ' + dz, BX + 150, 178);
  let fe = 24; c.font = `600 ${fe}px ${FONT_EN}`; while (c.measureText(dir.en).width > 270 && fe > 14) { fe -= 1; c.font = `600 ${fe}px ${FONT_EN}`; }
  c.fillText(dir.en, BX + 150, 214);
  // 线段：经过的灰，没到的线路色
  const xs = ord.map((_, k) => stationX(k, n));
  c.lineCap = 'round';
  for (let k = 0; k < n - 1; k++) {
    c.strokeStyle = k < passed ? GREY : L.color; c.lineWidth = 16;
    c.beginPath(); c.moveTo(xs[k], LY); c.lineTo(xs[k + 1], LY); c.stroke();
    if (k >= passed) {   // 方向小箭头（白色），线段中间
      const mx = (xs[k] + xs[k + 1]) / 2; c.strokeStyle = line === 1 ? '#8A6D00' : '#FFFFFF'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(mx - 5, LY - 6); c.lineTo(mx + 3, LY); c.lineTo(mx - 5, LY + 6); c.stroke();
    }
  }
  // 右端大箭头（指向终点方向）
  c.fillStyle = L.color; c.beginPath(); c.moveTo(X1 + 46, LY); c.lineTo(X1 + 20, LY - 22); c.lineTo(X1 + 20, LY + 22); c.closePath(); c.fill();
  // 站点 + 竖排站名
  const big = n <= 16 ? 38 : 32, small = n <= 16 ? 32 : 26;
  ord.forEach((cd, k) => {
    const x = xs[k], isHot = k === hot, past = k < passed, tc = transferColor(cd, line), S = STATIONS[cd];
    if (isHot) {
      c.fillStyle = 'rgba(255,90,78,0.22)'; c.beginPath(); c.arc(x, LY, 40, 0, 7); c.fill();
      c.fillStyle = HOT; c.beginPath(); c.arc(x, LY, 27, 0, 7); c.fill(); c.lineWidth = 6; c.strokeStyle = '#fff'; c.stroke();
      if (tc) { c.lineWidth = 6; c.strokeStyle = tc; c.beginPath(); c.arc(x, LY, 33, 0, 7); c.stroke(); }
    } else if (tc) {   // 换乘站：外圈本线色 + 内圈换乘线色
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x, LY, 20, 0, 7); c.fill();
      c.lineWidth = 7; c.strokeStyle = past ? GREY : L.color; c.beginPath(); c.arc(x, LY, 19, 0, 7); c.stroke();
      c.lineWidth = 6; c.strokeStyle = past ? '#AEB5BD' : tc; c.beginPath(); c.arc(x, LY, 10, 0, 7); c.stroke();
    } else {
      c.fillStyle = past ? '#E4E7EA' : '#fff'; c.beginPath(); c.arc(x, LY, 14, 0, 7); c.fill();
      c.lineWidth = 6; c.strokeStyle = past ? GREY : L.color; c.stroke();
    }
    const nm = S.zh, room = H - 30 - (LY + 34), fs = Math.min(isHot ? big : small, Math.floor(room / nm.length));
    const y0 = LY + (isHot ? 46 : 36);
    if (isHot) { c.fillStyle = HOT; roundRect(c, x - fs / 2 - 8, y0 - 6, fs + 16, nm.length * fs + 12, 12); c.fill(); }
    c.fillStyle = isHot ? '#fff' : past ? GREY_TXT : INK; c.font = `${isHot ? 800 : 600} ${fs}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'top';
    [...nm].forEach((ch, j) => c.fillText(ch, x, y0 + j * fs));
  });
}

/** LCD：moving = 已关门开出（显示“下一站”），否则“到站”（本站） */
export function drawLcd(c, line, code, step, moving, nextCode) {
  const L = LINES[line], W = LCD_W, H = LCD_H, show = moving && nextCode ? nextCode : code, S = STATIONS[show];
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#2A2E33'; c.fillRect(0, 0, W, H);
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0E2236'); g.addColorStop(1, '#081420');
  c.fillStyle = g; roundRect(c, 10, 10, W - 20, H - 20, 20); c.fill();
  // 顶部：线路色条 + 标签
  c.fillStyle = L.color; roundRect(c, 30, 30, W - 60, 86, 16); c.fill();
  c.fillStyle = L.ink; c.textBaseline = 'middle'; c.textAlign = 'left';
  const tag = moving && nextCode ? ['下一站', 'Next'] : ['到站', 'Arriving'];
  c.font = `800 58px ${FONT}`; c.fillText(tag[0], 56, 74); const tw = c.measureText(tag[0]).width;
  c.font = `700 36px ${FONT_EN}`; c.fillText(tag[1], 56 + tw + 22, 78);
  c.textAlign = 'right'; c.font = `800 44px ${FONT}`; c.fillText(L.zh, W - 56, 74);
  // 中间：大号中文站名 + 英文
  const fz = S.zh.length >= 5 ? 128 : 150;
  c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.font = `800 ${fz}px ${FONT}`;
  c.fillText(S.zh, W / 2, 268);
  let fe = 50; c.font = `600 ${fe}px ${FONT_EN}`; while (c.measureText(S.en).width > W - 100 && fe > 26) { fe -= 2; c.font = `600 ${fe}px ${FONT_EN}`; }
  c.fillStyle = '#9FD3FF'; c.fillText(S.en, W / 2, 338);
}
