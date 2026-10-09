/*
 * 线路图（共用）：售票机屏幕上的单线“蛇形”线路图（SVG，可点选；Canvas 版画在 3D 售票机屏幕上）、游戏票价。
 * 全网图（networkSVG）：HUD 地图按钮全屏打开，站厅墙上也挂一张。
 * 站名和站序全部来自 js/data/lines.js；线路色 1 号线 #F3D03E、2 号线 #00629B。
 * 换乘站：公园前（1↔2）画成 1 号线黄 + 2 号线蓝的双色圆环；能换乘其他线路的站统一画白心粗深色圈（图例“可以换乘其他线路”）；“你在这里”大而亮，带呼吸光圈。
 */
import { LINES, STATIONS, OTHER_LINES } from '../data/lines.js';

export const GYQ = 'gyq';
/** 两站之间的站数（同线直接数；跨线经 1/2 号线的换乘站） */
export function stopsBetween(a, b) {
  if (a === b) return 0;
  let best = Infinity;
  for (const la of STATIONS[a].lines) for (const lb of STATIONS[b].lines) {
    const A = LINES[la].stations, Bs = LINES[lb].stations;
    if (la === lb) best = Math.min(best, Math.abs(A.indexOf(a) - A.indexOf(b)));
    else for (const x of A.filter(c => Bs.includes(c))) best = Math.min(best, Math.abs(A.indexOf(a) - A.indexOf(x)) + Math.abs(Bs.indexOf(x) - Bs.indexOf(b)));
  }
  return best;
}
/** 游戏票价（元）：按站数分段，起步 2 元。只是游戏里的价格，不是广州地铁的官方票价。 */
export function fareFor(a, b) {
  const n = stopsBetween(a, b);
  return n <= 3 ? 2 : n <= 6 ? 3 : n <= 9 ? 4 : n <= 13 ? 5 : n <= 18 ? 6 : 7;
}
export const isTransfer = c => STATIONS[c].lines.length > 1;
/** 售票机上选中的目的地颜色：单程票的青绿色（“你的票去这里”），和线路色、红色的“你在这里”都不一样 */
export const SEL = '#1AA39B';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** 名字太长（5 个字以上）就拆两行 */
export function wrapName(zh) { if (zh.length <= 4) return [zh]; const h = Math.ceil(zh.length / 2); return [zh.slice(0, h), zh.slice(h)]; }

/* ---------- 单线蛇形图（售票机屏幕 / 选目的地） ---------- */
const PER_ROW = 8, X0 = 72, DX = 122, ROW_H = 176, Y0 = 92;
export function snakeLayout(line) {
  const st = LINES[line].stations, rows = Math.ceil(st.length / PER_ROW);
  const pts = st.map((c, i) => { const r = Math.floor(i / PER_ROW), k = i % PER_ROW, kk = r % 2 ? PER_ROW - 1 - k : k; return { code: c, x: X0 + kk * DX, y: Y0 + r * ROW_H, r }; });
  return { pts, w: X0 * 2 + DX * (PER_ROW - 1), h: Y0 + (rows - 1) * ROW_H + 92, rows };
}
/** 单线图 SVG：here = 当前站，sel = 选中的目的地；每个站带 data-code，可点 */
export function lineSVG(line, { here, sel } = {}) {
  const L = LINES[line], { pts, w, h } = snakeLayout(line);
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (a.r !== b.r) { const ex = a.x + (a.r % 2 === 0 ? 70 : -70); d += ` C${ex} ${a.y} ${ex} ${b.y} ${b.x} ${b.y}`; }
    else d += ` L${b.x} ${b.y}`;
  }
  let s = `<svg class="linemap" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="--lc:${L.color}">`;
  s += `<path d="${d}" fill="none" stroke="${L.color}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`;
  pts.forEach(p => {
    const isHere = p.code === here, isSel = p.code === sel, tr = isTransfer(p.code), nm = wrapName(STATIONS[p.code].zh);
    s += `<g class="st${isHere ? ' here' : ''}${isSel ? ' sel' : ''}" data-code="${p.code}">`;
    s += `<rect class="hit" x="${p.x - DX / 2}" y="${p.y - 46}" width="${DX}" height="${ROW_H - 18}" rx="18"/>`;
    if (isSel) s += `<circle class="glow" cx="${p.x}" cy="${p.y}" r="36"/>`;
    if (isHere) s += `<circle class="pulse" cx="${p.x}" cy="${p.y}" r="26"/>`;
    // 选中的目的地：白心 + 粗的单程票青绿圈（SEL）+ 名字青绿底白字，和红色实心的“你在这里”区分开
    if (isSel) s += `<circle class="dot" cx="${p.x}" cy="${p.y}" r="24" fill="#fff" stroke="${SEL}" stroke-width="10"/>` + (tr ? `<circle cx="${p.x}" cy="${p.y}" r="9" fill="#fff" stroke="${LINES[2].color}" stroke-width="5"/>` : '');
    else if (tr) s += `<circle cx="${p.x}" cy="${p.y}" r="${isHere ? 25 : 21}" fill="#fff" stroke="${LINES[1].color}" stroke-width="9"/><circle cx="${p.x}" cy="${p.y}" r="${isHere ? 14 : 11}" fill="#fff" stroke="${LINES[2].color}" stroke-width="6"/>`;
    else s += `<circle class="dot" cx="${p.x}" cy="${p.y}" r="${isHere ? 22 : 15}" fill="${isHere ? '#FF5A4E' : '#fff'}" stroke="${isHere ? '#fff' : L.color}" stroke-width="${isHere ? 6 : 7}"/>`;
    const fy = p.y + 58, fs = isHere || isSel ? 31 : 27;
    if (isSel) { const lw = Math.max(...nm.map(t => t.length)) * fs + 22; s += `<rect class="selbg" x="${p.x - lw / 2}" y="${fy - fs - 4}" width="${lw}" height="${nm.length * (fs + 3) + 14}" rx="14" fill="${SEL}"/>`; }
    nm.forEach((t, j) => { s += `<text class="nm" x="${p.x}" y="${fy + j * (fs + 3)}" font-size="${fs}" text-anchor="middle">${esc(t)}</text>`; });
    if (isHere) s += `<g class="youare"><rect x="${p.x - 62}" y="${p.y - 78}" width="124" height="38" rx="19"/><text x="${p.x}" y="${p.y - 51}" text-anchor="middle">你在这里</text></g>`;
    if (tr && !isHere) s += `<text class="xfer" x="${p.x}" y="${p.y - 32}" text-anchor="middle">换乘</text>`;
    s += '</g>';
  });
  return s + '</svg>';
}

/* ---------- Canvas 小线路图（售票机 3D 屏幕贴图） ---------- */
export function drawLineCanvas(c, line, here, x, y, w, h) {
  const L = LINES[line], { pts, w: W, h: H } = snakeLayout(line), k = Math.min(w / W, h / H), ox = x + (w - W * k) / 2, oy = y + (h - H * k) / 2;
  const P = p => [ox + p.x * k, oy + p.y * k];
  c.lineWidth = 16 * k; c.strokeStyle = L.color; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
  pts.forEach((p, i) => { const [px, py] = P(p); if (i === 0) c.moveTo(px, py); else if (pts[i - 1].r !== p.r) { const [ax, ay] = P(pts[i - 1]), right = pts[i - 1].r % 2 === 0, ex = ax + (right ? 70 : -70) * k; c.bezierCurveTo(ex, ay, ex, py, px, py); } else c.lineTo(px, py); });
  c.stroke();
  pts.forEach(p => {
    const [px, py] = P(p), me = p.code === here;
    c.beginPath(); c.arc(px, py, (me ? 22 : 15) * k, 0, 7); c.fillStyle = me ? '#FF5A4E' : '#fff'; c.fill(); c.lineWidth = 6 * k; c.strokeStyle = me ? '#fff' : L.color; c.stroke();
    c.fillStyle = '#1B2430'; c.font = `600 ${Math.round((me ? 31 : 26) * k)}px "PingFang SC","Noto Sans CJK SC","Noto Sans SC",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    wrapName(STATIONS[p.code].zh).forEach((t, j) => c.fillText(t, px, py + (56 + j * 30) * k));
  });
}

/* ---------- 全网图（1 号线 + 2 号线；HUD 地图按钮全屏打开，站厅墙上也挂一张） ----------
 * 示意图，不按真实比例：2 号线南北竖直穿过公园前，1 号线东西向（西段在黄沙拐向南到西塱，东段在体育中心拐向北到广州东站）。
 * 站序全部来自 lines.js；换乘站（公园前 1↔2）画大双色环，有其他已开通换乘线路的站统一画白心粗深色圈。
 */
const NW = 1240, NH = 1010, GX = 600, GY = 520;
const L1_POS = {   // 1 号线：[x, y, 标签位置 a=上 b=下 l=左 r=右]
  xl: [280, 820, 'l'], kk: [280, 745, 'l'], hdw: [280, 670, 'l'], fc: [280, 595, 'l'], hs: [280, GY, 'a'],
  csl: [360, GY, 'a'], cjc: [440, GY, 'a'], xmk: [520, GY, 'a'], gyq: [GX, GY, 'x'],
  njs: [680, GY, 'b'], lsly: [760, GY, 'a'], dsk: [840, GY, 'b'], yj: [920, GY, 'a'], tyxl: [1000, GY, 'b'], tyzx: [1080, GY, 'r'], gzdz: [1080, 420, 'r']
};
/** portrait = 竖屏版：同一张示意图横向收窄、纵向拉长（2 号线南北向更舒展），铺满竖屏宽度；图例挪到右下空白处 */
export function networkLayout(portrait = false) {
  const pos = {};
  LINES[1].stations.forEach(c => { pos[c] = L1_POS[c].slice(); });
  const s2 = LINES[2].stations, g = s2.indexOf('gyq');
  s2.forEach((c, i) => { if (c === 'gyq') return; pos[c] = i > g ? [GX, 440 - (i - g - 1) * 38, 'l'] : [GX, 600 + (g - 1 - i) * 34, 'r']; });
  if (!portrait) return { pos, w: NW, h: NH, legend: [40, 40] };
  for (const p of Object.values(pos)) { p[0] = p[0] - 100; p[1] = 760 + (p[1] - GY) * 1.45; }
  return { pos, w: 1140, h: 1500, legend: [790, 1060] };
}
const YOU_AT = { hs: 'L', tyzx: 'B', gzdz: 'L' };
/** 换乘其他线路的站：统一一种样式（白心 + 粗深色圈），不再按换乘线路上色 */
export const XRING = '#1B2430', XR = 14, XW = 7;
const OTHER = c => STATIONS[c].x.map(k => OTHER_LINES[k]).filter(Boolean);
/** 全网图 SVG；here = 当前站（脉动的“你在这里”），opts.wall = 墙上版（不要动画，字更粗） */
export function networkSVG(here, opts = {}) {
  const { pos, w, h, legend: [gx, gy] } = networkLayout(!!opts.portrait), F = 'font-family="PingFang SC,Hiragino Sans GB,Noto Sans CJK SC,Noto Sans SC,Microsoft YaHei,sans-serif"';
  let s = `<svg class="netmap" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" ${F}>`;
  s += `<rect width="${w}" height="${h}" rx="28" fill="#FFFFFF"/>`;
  // 标题 + 图例（换乘站只有两种样式：公园前 1↔2 双色环；其他站能换乘别的线路 = 白心粗深色圈）
  s += `<text x="${gx}" y="${gy + 26}" font-size="40" font-weight="800" fill="#1B2430">广州地铁</text><text x="${gx}" y="${gy + 60}" font-size="20" font-weight="600" fill="#6B7787" font-family="Helvetica Neue,Arial,sans-serif">Guangzhou Metro</text>`;
  [1, 2].forEach((l, i) => { const L = LINES[l], y = gy + 100 + i * 56; s += `<rect x="${gx}" y="${y}" width="74" height="40" rx="12" fill="${L.color}"/><text x="${gx + 37}" y="${y + 30}" font-size="28" font-weight="800" fill="${L.ink}" text-anchor="middle">${l}</text><text x="${gx + 86}" y="${y + 30}" font-size="26" font-weight="700" fill="#1B2430">${L.zh}</text>`; });
  s += `<circle cx="${gx + 22}" cy="${gy + 240}" r="18" fill="#fff" stroke="${LINES[1].color}" stroke-width="8"/><circle cx="${gx + 22}" cy="${gy + 240}" r="8" fill="#fff" stroke="${LINES[2].color}" stroke-width="6"/><text x="${gx + 52}" y="${gy + 249}" font-size="23" font-weight="700" fill="#34404F">1号线和2号线在这里换乘</text>`;
  s += `<circle cx="${gx + 22}" cy="${gy + 290}" r="${XR}" fill="#fff" stroke="${XRING}" stroke-width="${XW}"/><text x="${gx + 52}" y="${gy + 299}" font-size="23" font-weight="700" fill="#34404F">可以换乘其他线路</text>`;
  // 线
  for (const l of [1, 2]) {
    const pts = LINES[l].stations.map(c => pos[c]);
    s += `<polyline points="${pts.map(p => p[0] + ',' + p[1]).join(' ')}" fill="none" stroke="${LINES[l].color}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  // 站点 + 站名
  for (const [c, [x, y, side]] of Object.entries(pos)) {
    const S = STATIONS[c], both = S.lines.length > 1, oth = OTHER(c), me = c === here, l = S.lines[0];
    if (both) s += `<circle cx="${x}" cy="${y}" r="27" fill="#fff" stroke="${LINES[1].color}" stroke-width="11"/><circle cx="${x}" cy="${y}" r="13" fill="#fff" stroke="${LINES[2].color}" stroke-width="8"/>`;
    else if (oth.length) s += `<circle cx="${x}" cy="${y}" r="${XR}" fill="#fff" stroke="${XRING}" stroke-width="${XW}"/>`;
    else s += `<circle cx="${x}" cy="${y}" r="10" fill="#fff" stroke="${LINES[l].color}" stroke-width="6"/>`;
    const fs = me ? 30 : both ? 30 : 25, fw = me || both ? 800 : 600, col = me ? '#E2312A' : '#1B2430';
    let tx = x, ty = y + 9, anc = 'middle';
    if (side === 'a') ty = y - 26; else if (side === 'b') ty = y + 44; else if (side === 'l') { tx = x - 24; anc = 'end'; } else if (side === 'r') { tx = x + 24; anc = 'start'; } else { tx = x - 30; ty = y + 54; anc = 'end'; }
    s += `<text x="${tx}" y="${ty}" font-size="${fs}" font-weight="${fw}" fill="${col}" text-anchor="${anc}" paint-order="stroke" stroke="#fff" stroke-width="6" stroke-linejoin="round">${esc(S.zh)}</text>`;
  }
  // 你在这里：红点 + 脉动圈 + 标签
  if (here && pos[here]) {
    const [x, y] = pos[here];
    if (!opts.wall) s += `<circle class="pulse" cx="${x}" cy="${y}" r="30" fill="none" stroke="#FF5A4E" stroke-width="8"/>`;
    // 标签放在站名的另一侧（不盖住站名）；几个拐角站单独指定
    const side = YOU_AT[here] || { l: 'R', r: 'L', a: 'B', b: 'U', x: 'UR' }[pos[here][2]];
    const [dx, dy] = { R: [128, 0], L: [-128, 0], B: [0, 74], U: [0, -70], UR: [140, -96] }[side], lx = x + dx, ly = y + dy;
    s += `<g class="youare"><line x1="${x}" y1="${y}" x2="${lx}" y2="${ly}" stroke="#FF5A4E" stroke-width="5"/><rect x="${lx - 78}" y="${ly - 25}" width="156" height="50" rx="25" fill="#FF5A4E" stroke="#fff" stroke-width="4"/><text x="${lx}" y="${ly + 10}" font-size="28" font-weight="800" fill="#fff" text-anchor="middle">你在这里</text></g>`;
    s += `<circle class="here" cx="${x}" cy="${y}" r="${opts.wall ? 20 : 16}" fill="#FF5A4E" stroke="#fff" stroke-width="5"/>`;
  }
  return s + '</svg>';
}
/** 屏幕坐标 ↔ svg 坐标（viewBox + 默认 xMidYMid meet；不用 getScreenCTM，某些浏览器在缩放 / 弹窗里会算错） */
export function svgMap(svg) {
  const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, k = Math.min(r.width / vb.width, r.height / vb.height);
  const ox = r.left + (r.width - vb.width * k) / 2, oy = r.top + (r.height - vb.height * k) / 2;
  return { toSvg: (x, y) => [(x - ox) / k, (y - oy) / k], toClient: (x, y) => [ox + x * k, oy + y * k] };
}
/** 全网图上离 (x, y)（svg 坐标）最近的车站；超过 r 返回 null（问路的选站面板用：点站名或圆点附近都算） */
export function nearestStation(x, y, portrait, r = 80) {
  const { pos } = networkLayout(portrait); let best = null, bd = r;
  for (const [c, [px, py, side]] of Object.entries(pos)) {
    // 站名在哪边就往哪边多算一点，点字也行
    const lx = side === 'l' ? px - 60 : side === 'r' ? px + 60 : px, ly = side === 'a' ? py - 30 : side === 'b' ? py + 30 : py;
    const d = Math.min(Math.hypot(x - px, y - py), Math.hypot(x - lx, y - ly)); if (d < bd) { bd = d; best = c; }
  }
  return best;
}

/** 地图里双指捏合缩放 + 单指拖动平移（1–4 倍），双击还原。box = 包着 svg 的容器；返回 reset() */
export function panZoom(box) {
  const pts = new Map(); let k = 1, tx = 0, ty = 0, start = null, lastTap = 0, tap = null;
  const el = () => box.firstElementChild;
  const apply = () => { const r = box.getBoundingClientRect(), mx = r.width * (k - 1) / 2, my = r.height * (k - 1) / 2; tx = Math.max(-mx, Math.min(mx, tx)); ty = Math.max(-my, Math.min(my, ty)); const e = el(); if (e) { e.style.transform = `translate(${tx}px,${ty}px) scale(${k})`; e.style.transformOrigin = 'center center'; } box.classList.toggle('zoomed', k > 1.01); };
  const snap = () => { const a = [...pts.values()]; if (!a.length) return null; const cx = a.reduce((s, p) => s + p.x, 0) / a.length, cy = a.reduce((s, p) => s + p.y, 0) / a.length; const d = a.length > 1 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0; return { cx, cy, d, k, tx, ty }; };
  box.addEventListener('pointerdown', e => {
    e.preventDefault(); try { box.setPointerCapture(e.pointerId); } catch (_) {} pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); start = snap();
    if (pts.size === 1) { tap = { t: performance.now(), x: e.clientX, y: e.clientY }; } else tap = null;
  });
  box.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); const c = snap(); if (!c || !start) return;
    if (pts.size > 1 && start.d > 10) {
      const r = box.getBoundingClientRect(), ox = start.cx - (r.left + r.width / 2), oy = start.cy - (r.top + r.height / 2);
      const nk = Math.max(1, Math.min(4, start.k * c.d / start.d)), f = nk / start.k;
      k = nk; tx = ox - (ox - start.tx) * f + (c.cx - start.cx); ty = oy - (oy - start.ty) * f + (c.cy - start.cy);
    } else { tx = start.tx + c.cx - start.cx; ty = start.ty + c.cy - start.cy; }
    apply();
  });
  // 双击还原：两次干脆的单指轻点（没拖动、没捏合）
  const up = e => {
    if (tap && pts.size === 1 && performance.now() - tap.t < 280 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 12) { const now = performance.now(); if (now - lastTap < 350) { k = 1; tx = ty = 0; apply(); lastTap = 0; } else lastTap = now; }
    tap = null; pts.delete(e.pointerId); start = snap();
  };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  return { reset() { k = 1; tx = ty = 0; pts.clear(); apply(); }, set(nk, x = 0, y = 0) { k = nk; tx = x; ty = y; apply(); }, get scale() { return k; } };
}
