/*
 * 街道与车站里的小摆设：树（榕树 / 木棉 / 棕榈）、路灯、长椅、垃圾桶、摄像头、售票机、楼房（立面贴图 + 底商）……
 * 全部写进 Kit 的材质桶（静态合批），每样都带一点烘焙暗影。
 */
import { hex, mix, mul } from '../core/geo.js';
const B = window.BABYLON;
let seed = 7;
export function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
export function reseed(s) { seed = 1 + (Math.abs(s) % 2147483000); }
const STEEL = hex('#B9C0C8'), DARK = hex('#2F3338'), POLE = hex('#4A5058');

/** 树：kind 0 榕树（宽冠深绿），1 木棉（红花），2 棕榈 */
export function tree(k, x, y, z, s = 1, kind = 0) {
  const P = k.solid, bark = hex(kind === 2 ? '#8A7860' : '#6E5640');
  k.shade.shadeBlob(x, z, 2.2 * s, 2.2 * s, y + 0.02, 0.32);
  if (kind === 2) { // 棕榈
    P.cyl(x, y + 3.2 * s, z, 0.32 * s, 6.4 * s, bark, 10, 0, 0, 0, 0.24 * s);
    for (let r = 0; r < 8; r++) for (let j = 0; j < 4; j++) {
      const a = r / 8 * Math.PI * 2 + j * 0.05, d = (0.5 + j * 0.55) * s, yy = y + 6.4 * s + 0.25 * s - j * j * 0.12 * s;
      P.ellipsoid(x + Math.cos(a) * d, yy, z + Math.sin(a) * d, 0.75 * s, 0.07 * s, 0.32 * s, hex(j % 2 ? '#4E9A48' : '#5DAE55'), 1, -a, 0, -0.25 - j * 0.15);
    }
    return;
  }
  P.cyl(x, y + 1.3 * s, z, 0.42 * s, 2.6 * s, bark, 10, 0, 0, 0, 0.3 * s);
  for (let b = 0; b < 3; b++) { const a = b * 2.1 + rnd(); P.tubeTaper([x, y + 2.2 * s, z], [x + Math.cos(a) * 0.9 * s, y + 3.2 * s, z + Math.sin(a) * 0.9 * s], 0.2 * s, 0.1 * s, bark, 6); }
  const greens = kind === 1 ? ['#6FA65A', '#7DB466', '#5E9A4E'] : ['#3F8A45', '#4C9A4E', '#367C3D', '#58A657'];
  const n = kind === 1 ? 6 : 9, R = (kind === 1 ? 1.5 : 2.1) * s, cy = y + (kind === 1 ? 3.6 : 3.7) * s;
  const prevTint = P.tint; P.tint = (px, py) => 0.72 + 0.34 * Math.max(0, Math.min(1, (py - (cy - R)) / (2 * R)));
  P.ellipsoid(x, cy, z, R * 1.9, R * 1.3, R * 1.9, hex(greens[0]), 2);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + rnd() * 0.6, d = R * (0.55 + rnd() * 0.35), sz = R * (0.75 + rnd() * 0.4);
    P.ellipsoid(x + Math.cos(a) * d, cy + (rnd() - 0.3) * R * 0.6, z + Math.sin(a) * d, sz * 1.15, sz * 0.85, sz * 1.15, hex(greens[i % greens.length]), 2);
  }
  P.ellipsoid(x, cy + R * 0.55, z, R * 1.2, R * 0.8, R * 1.2, hex(greens[1]), 2);
  if (kind === 1) for (let i = 0; i < 16; i++) { const a = rnd() * 6.28, d = R * (0.4 + rnd() * 0.7); P.sphere(x + Math.cos(a) * d, cy + R * (0.2 + rnd() * 0.7), z + Math.sin(a) * d, 0.32 * s, hex(rnd() < 0.5 ? '#E8443A' : '#F05A3C'), 1); }
  P.tint = prevTint;
}
/** 绿篱（圆角矮灌木） */
export function hedge(k, x0, x1, z0, z1, y = 0, h = 0.8) {
  const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  k.solid.rbox(cx, y, cz, w, h * 0.7, d, hex('#3E7F3E'), 0.25, 0, { ao: true });
  k.solid.ellipsoid(cx, y + h * 0.7, cz, w, h * 0.55, d, hex('#4C9448'), 2);
  k.shade.shadeBlob(cx, cz, w * 0.6 + 0.3, d * 0.6 + 0.3, y + 0.015, 0.25);
}
/** 路灯：广州街道常见的弯臂路灯 */
export function lamp(k, x, y, z, face = 0) {
  const M = k.solid, dx = Math.sin(face), dz = Math.cos(face);
  M.cyl(x, y + 0.25, z, 0.34, 0.5, POLE, 12, 0, 0, 0, 0.26);
  M.cyl(x, y + 3.5, z, 0.16, 6.5, POLE, 10, 0, 0, 0, 0.1);
  const pts = [[x, y + 6.6, z], [x + dx * 0.4, y + 7.1, z + dz * 0.4], [x + dx * 1.1, y + 7.3, z + dz * 1.1], [x + dx * 1.6, y + 7.25, z + dz * 1.6]];
  M.path(pts, 0.09, POLE, 8);
  M.rbox(x + dx * 1.75, y + 7.1, z + dz * 1.75, 0.38, 0.16, 0.75, POLE, 0.12, face, { ao: false, bevel: 0.04 });
  k.glow.box(x + dx * 1.75, y + 7.095, z + dz * 1.75, 0.28, 0.01, 0.6, hex('#FFF4D8'), face);
  k.shade.shadeBlob(x, z, 0.5, 0.5, y + 0.015, 0.3);
}
/** 街边长椅（木条 + 铸铁腿） */
export function bench(k, x, y, z, ry = 0) {
  const c = Math.cos(ry), s = Math.sin(ry), P = k.solid, wood = hex('#B07A4A');
  for (let i = 0; i < 4; i++) P.rbox(x - s * (i * 0.12 - 0.18), y + 0.44, z - c * (i * 0.12 - 0.18), 1.8, 0.04, 0.09, wood, 0.02, ry, { ao: false });
  for (let i = 0; i < 3; i++) P.box(x + s * 0.27, y + 0.62 + i * 0.12, z + c * 0.27, 1.8, 0.08, 0.035, wood, ry, -0.15);
  for (const kk of [-0.75, 0.75]) P.box(x + c * kk, y + 0.3, z - s * kk, 0.06, 0.6, 0.55, DARK, ry);
  k.shade.shadeBlob(x, z, 1.1, 0.45, y + 0.012, 0.3, ry);
}
/** 站台不锈钢座椅（一排 n 个座） */
export function seats(k, x, y, z, ry = 0, n = 4) {
  const c = Math.cos(ry), s = Math.sin(ry), w = n * 0.55;
  k.metal.box(x, y + 0.42, z, w, 0.04, 0.45, STEEL, ry, 0, 0, 1, { ao: false });
  k.metal.box(x + s * 0.21, y + 0.72, z + c * 0.21, w, 0.5, 0.03, STEEL, ry, -0.12);
  for (let i = 1; i < n; i++) { const o = -w / 2 + i * 0.55; k.solid.box(x + c * o, y + 0.47, z - s * o, 0.04, 0.08, 0.42, DARK, ry); }
  for (const o of [-w / 2 + 0.2, w / 2 - 0.2]) { k.solid.box(x + c * o, y + 0.2, z - s * o, 0.06, 0.4, 0.4, DARK, ry); }
  k.shade.shadeBlob(x, z, w * 0.55, 0.42, y + 0.01, 0.3, ry);
}
/** 垃圾桶（不锈钢，分类两格） */
export function bin(k, x, y, z, ry = 0) {
  k.metal.rbox(x, y, z, 0.6, 0.85, 0.36, STEEL, 0.06, ry, { bevel: 0.02 });
  k.solid.rbox(x, y + 0.85, z, 0.62, 0.05, 0.38, DARK, 0.07, ry, { ao: false });
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const [o, col] of [[-0.15, '#2E6FB5'], [0.15, '#5A6068']]) k.solid.box(x + c * o + s * 0.181, y + 0.6, z - s * o + c * 0.181, 0.22, 0.14, 0.005, hex(col), ry, 0, 0, 1, { ao: false });
  k.shade.shadeBlob(x, z, 0.5, 0.35, y + 0.01, 0.3, ry);
}
/** 天花摄像头（半球 + 支架） */
export function cctv(k, x, y, z, ry = 0) {
  k.solid.cyl(x, y - 0.12, z, 0.06, 0.24, hex('#E6E8EA'), 8, 0, 0, 0, undefined, { ao: false });
  k.solid.rbox(x + Math.sin(ry) * 0.1, y - 0.32, z + Math.cos(ry) * 0.1, 0.13, 0.12, 0.32, hex('#EEF0F2'), 0.04, ry, { ao: false, bottom: true });
  k.solid.box(x + Math.sin(ry) * 0.27, y - 0.26, z + Math.cos(ry) * 0.27, 0.11, 0.07, 0.03, DARK, ry, 0, 0, 1, { ao: false });
}
/**
 * 自动售票机（参照广州地铁站厅的售票机）：浅灰机身 + 深色面板，左上大触摸屏（屏幕是单独的贴图网格，见 Station.tvmScreens），
 * 右侧投币口（黄灯框）、纸币口（绿灯框）、羊城通读卡区（蓝灯），下方出票 / 找零口（暖白灯 + 标签）。
 * 正面朝 -z（面向从安检走过来的乘客）。返回屏幕中心（世界坐标），供贴图网格使用。
 */
export function ticketMachine(k, x, y, z) {
  const P = k.solid, zf = z - 0.3, FAS = hex('#2B3138'), SLOT = hex('#0E1114');
  P.rbox(x, y, z, 0.92, 1.86, 0.6, hex('#DCE1E6'), 0.05, 0, { bevel: 0.025 });
  P.rbox(x, y + 1.86, z, 0.96, 0.07, 0.64, hex('#2F353C'), 0.035, 0, { ao: false });
  P.box(x, y + 1.33, zf - 0.006, 0.86, 0.94, 0.02, FAS, 0, 0, 0, 1, { ao: false });          // 上部深色面板
  k.metal.box(x, y + 0.5, zf - 0.006, 0.86, 0.66, 0.02, STEEL, 0, 0, 0, 1, { ao: false });   // 下部不锈钢面板
  P.box(x, y + 0.08, zf - 0.01, 0.88, 0.16, 0.02, hex('#3A4048'), 0, 0, 0, 1, { ao: false });   // 踢脚
  // 屏幕边框（屏幕贴图另做）
  P.box(x - 0.1, y + 1.3, zf - 0.018, 0.6, 0.48, 0.012, hex('#15191E'), 0, 0, 0, 1, { ao: false });
  // 投币口：黑色竖缝 + 黄色灯框
  k.glow.box(x + 0.31, y + 1.44, zf - 0.019, 0.1, 0.17, 0.004, hex('#FFC72C'));
  P.box(x + 0.31, y + 1.44, zf - 0.024, 0.035, 0.12, 0.006, SLOT, 0, 0, 0, 1, { ao: false });
  // 纸币口：横缝 + 绿色灯框
  k.glow.box(x + 0.31, y + 1.22, zf - 0.019, 0.17, 0.07, 0.004, hex('#3DDC84'));
  P.box(x + 0.31, y + 1.22, zf - 0.024, 0.13, 0.025, 0.006, SLOT, 0, 0, 0, 1, { ao: false });
  // 羊城通读卡区
  k.glow.box(x + 0.31, y + 1.03, zf - 0.019, 0.14, 0.11, 0.004, hex('#5AB0FF'));
  P.box(x + 0.31, y + 1.03, zf - 0.023, 0.1, 0.07, 0.005, hex('#1E3A5A'), 0, 0, 0, 1, { ao: false });
  // 出票 / 找零口：凹槽 + 暖白灯条
  P.box(x, y + 0.48, zf - 0.03, 0.4, 0.17, 0.03, SLOT, 0, 0, 0, 1, { ao: false });
  k.glow.box(x, y + 0.575, zf - 0.04, 0.4, 0.018, 0.012, hex('#FFF1D0'));
  P.box(x, y + 0.4, zf - 0.07, 0.42, 0.02, 0.1, hex('#3A4048'), 0, 0, 0, 1, { ao: false });
  k.sign(x, y + 0.7, zf - 0.02, { kind: 'plain', w: 0.4, h: 0.07, bg: '#2B3138', fg: '#FFFFFF', zh: '取票 · 找零', face: Math.PI, align: 'center', box: false });
  k.sign(x, y + 1.705, zf - 0.02, { kind: 'plain', w: 0.84, h: 0.12, bg: '#1E6FB8', fg: '#FFFFFF', zh: '自动售票', en: 'Tickets', face: Math.PI, align: 'center', box: false });
  k.shade.shadeStrip(x - 0.5, zf, x + 0.5, zf, y + 0.01, 0, -1, 0.5, 0.3);
  k.shade.shadeBlob(x, z, 0.6, 0.42, y + 0.008, 0.28);
  return { x: x - 0.1, y: y + 1.3, z: zf - 0.026, w: 0.56, h: 0.42 };
}
/** 楼房：立面贴图 + 底商（玻璃橱窗 + 店招）+ 屋顶女儿墙、空调外机 */
export function building(k, x, z, w, d, h, col, shop) {
  const c = hex(col), F = k.g('facade');
  F.box(x, 4 + (h - 4) / 2, z, w, h - 4, d, c, 0, 0, 0, 1, { ao: false });
  // 底层（4m）：石材墙基 + 橱窗
  k.solid.box(x, 2, z, w, 4, d, mix(c, hex('#8A8F96'), 0.55), 0, 0, 0, 1, { ao: true });
  for (const [nx, nz, len] of [[0, -1, w], [0, 1, w], [-1, 0, d], [1, 0, d]]) {
    const ox = x + nx * (w / 2 + 0.02), oz = z + nz * (d / 2 + 0.02), ry = Math.atan2(nx, nz);
    k.glass.box(ox, 1.7, oz, nx ? 0.02 : len * 0.86, 2.6, nz ? 0.02 : len * 0.86, hex('#5C7A8F'), 0, 0, 0);
    k.solid.box(x + nx * (w / 2 + 0.01), 1.7, z + nz * (d / 2 + 0.01), nx ? 0.01 : len * 0.88, 2.7, nz ? 0.01 : len * 0.88, hex('#2C3E4C'), 0, 0, 0, 1, { ao: false });
    if (shop && nx === shop.n[0] && nz === shop.n[1]) {
      k.sign(x + nx * (w / 2 + 0.06), 3.45, z + nz * (d / 2 + 0.06), { kind: 'plain', w: Math.min(len * 0.8, 9), h: 0.75, bg: shop.bg, fg: shop.fg || '#fff', zh: shop.zh, en: shop.en, face: ry, align: 'center' });
    }
    // 雨篷
    k.solid.box(x + nx * (w / 2 + 0.6), 4.05, z + nz * (d / 2 + 0.6), nx ? 1.2 : len, 0.12, nz ? 1.2 : len, hex('#D9DCDF'), 0, 0, 0, 1, { ao: false });
  }
  // 屋顶
  k.solid.box(x, h + 0.35, z, w + 0.3, 0.7, d + 0.3, mix(c, [1, 1, 1], 0.35), 0, 0, 0, 1, { ao: false });
  k.solid.box(x, h + 0.36, z, w - 0.4, 0.71, d - 0.4, hex('#9AA0A6'), 0, 0, 0, 1, { ao: false });
  for (let i = 0; i < Math.max(1, Math.floor(w / 6)); i++) k.solid.rbox(x - w / 2 + 2 + i * 5, h + 0.7, z + (i % 2 ? 1 : -1) * d * 0.2, 1.1, 0.7, 0.6, hex('#E8EAEC'), 0.05, 0);
  if (w > 10) { k.solid.cyl(x + w * 0.3, h + 1.6, z, 1.6, 1.8, hex('#D8DCE0'), 12); }
  k.shade.shadeRoom(x - w / 2, x + w / 2, z - d / 2, z + d / 2, 0.012, 0.01, 0);
  k.shade.shadeStrip(x - w / 2, z - d / 2, x + w / 2, z - d / 2, 0.014, 0, -1, 1.2, 0.3);
  k.shade.shadeStrip(x - w / 2, z + d / 2, x + w / 2, z + d / 2, 0.014, 0, 1, 1.2, 0.3);
  k.shade.shadeStrip(x - w / 2, z - d / 2, x - w / 2, z + d / 2, 0.014, -1, 0, 1.2, 0.3);
  k.shade.shadeStrip(x + w / 2, z - d / 2, x + w / 2, z + d / 2, 0.014, 1, 0, 1.2, 0.3);
}
export { mix, mul };
