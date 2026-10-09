/*
 * 问路：从 here 到 to 怎么坐（只用 lines.js 里的 1、2 号线；两线只在公园前换乘）。
 * 返回 legs：[{ line, dir: { zh, en }, from, to }]，一段 = 直达，两段 = 在公园前换乘。
 */
import { LINES, STATIONS } from './lines.js';
export const HUB = 'gyq';
function leg(line, from, to) {
  const st = LINES[line].stations, step = Math.sign(st.indexOf(to) - st.indexOf(from));
  const dir = Object.values(LINES[line].dirs).find(d => d.step === step);
  return { line, dir, from, to, stops: Math.abs(st.indexOf(to) - st.indexOf(from)) };
}
export function routeTo(here, to) {
  if (here === to) return { same: true, legs: [] };
  const a = STATIONS[here].lines, b = STATIONS[to].lines, common = a.find(l => b.includes(l));
  if (common) return { legs: [leg(common, here, to)] };
  const la = a[0], lb = b[0];
  return { legs: [leg(la, here, HUB), leg(lb, HUB, to)], transfer: HUB };
}
