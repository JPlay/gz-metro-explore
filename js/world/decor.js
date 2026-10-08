// 小摆设：方块小人、树、楼、长椅、路灯。全部写进 Geo（静态合批）。
import { hex, mix } from '../core/geo.js';
const B = window.BABYLON;

const SKIN = ['#F2C9A0', '#E8B48A', '#C98F65', '#F5D5B5'].map(hex);
const SHIRT = ['#F28C8C', '#7FC8F8', '#FFD166', '#9BDE7E', '#C3A6F2', '#FF9F68', '#5EC4B6', '#F7A1C4'].map(hex);
const PANTS = ['#3D5A99', '#4A4E69', '#6B705C', '#2E4057', '#8D6A9F'].map(hex);
const HAIR = ['#3B2A20', '#1F1A17', '#6B4226', '#A0522D'].map(hex);
let seed = 7;
export function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
export function reseed(s) { seed = 1 + (Math.abs(s) % 2147483000); }
const pick = a => a[Math.floor(rnd() * a.length)];

/** 方块小人（约 1.6m），pose: 'stand' | 'sit' | 'wave' */
export function person(g, x, y, z, ry = 0, pose = 'stand', o = {}) {
  const skin = o.skin || pick(SKIN), shirt = o.shirt || pick(SHIRT), pants = o.pants || pick(PANTS), hair = o.hair || pick(HAIR);
  const s = o.scale || (0.85 + rnd() * 0.25);
  const c = Math.cos(ry), sn = Math.sin(ry);
  // 局部 (lx, ly, lz) → 世界；人物正面朝 +z（局部）
  const P = (lx, ly, lz) => [x + (lx * c + lz * sn) * s, y + ly * s, z + (-lx * sn + lz * c) * s];
  const box = (lx, ly, lz, w, h, d, col, rx = 0) => { const p = P(lx, ly, lz); g.box(p[0], p[1], p[2], w * s, h * s, d * s, col, ry, rx); };
  const sit = pose === 'sit';
  if (sit) { box(-0.13, 0.5, 0.18, 0.22, 0.2, 0.55, pants); box(0.13, 0.5, 0.18, 0.22, 0.2, 0.55, pants); box(-0.13, 0.22, 0.42, 0.2, 0.46, 0.22, pants); box(0.13, 0.22, 0.42, 0.2, 0.46, 0.22, pants); }
  else { box(-0.13, 0.4, 0, 0.22, 0.8, 0.24, pants); box(0.13, 0.4, 0, 0.22, 0.8, 0.24, pants); }
  const ty = sit ? 0.6 : 0.8;
  box(0, ty + 0.35, 0, 0.52, 0.7, 0.3, shirt);
  box(-0.36, ty + 0.36, 0, 0.18, 0.66, 0.2, shirt);
  if (pose === 'wave') box(0.36, ty + 0.85, 0, 0.18, 0.66, 0.2, shirt); else box(0.36, ty + 0.36, 0, 0.18, 0.66, 0.2, shirt);
  box(0, ty + 0.98, 0, 0.46, 0.46, 0.46, skin);
  box(0, ty + 1.24, -0.03, 0.5, 0.12, 0.52, hair);
  box(-0.1, ty + 1.0, 0.235, 0.07, 0.08, 0.02, hex('#222'));
  box(0.1, ty + 1.0, 0.235, 0.07, 0.08, 0.02, hex('#222'));
}
export function tree(g, x, y, z, s = 1, kind = 0) {
  g.cyl(x, y + 1.0 * s, z, 0.35 * s, 2.0 * s, hex('#8B5E3C'), 6);
  if (kind === 1) { // 木棉（红花）
    g.sphere(x, y + 2.9 * s, z, 2.6 * s, hex('#7DBE6A'), 1, 0.8);
    for (let k = 0; k < 7; k++) { const a = k * 0.9; g.sphere(x + Math.cos(a) * 1.0 * s, y + 3.2 * s + (k % 2) * 0.4 * s, z + Math.sin(a) * 1.0 * s, 0.55 * s, hex('#E8443A'), 0); }
  } else if (kind === 2) { // 尖顶树
    g.cyl(x, y + 3.0 * s, z, 2.4 * s, 2.8 * s, hex('#5DAE6B'), 7, 0, 0, 0, 0.05);
  } else {
    g.sphere(x, y + 2.8 * s, z, 2.8 * s, hex(['#7BC47F', '#6DB86F', '#8ACB79'][Math.floor(rnd() * 3)]), 1, 0.85);
    g.sphere(x + 0.6 * s, y + 3.4 * s, z - 0.3 * s, 1.6 * s, hex('#93D18A'), 1);
  }
}
export function building(g, x, z, w, d, h, col, roof = '#E9E2D6') {
  const c = hex(col);
  g.box(x, h / 2, z, w, h, d, c);
  g.box(x, h + 0.25, z, w + 0.4, 0.5, d + 0.4, hex(roof));
  // 窗户条（浅蓝）
  const win = hex('#BFE3F5'), rows = Math.floor((h - 1.5) / 3);
  for (let r = 0; r < rows; r++) {
    const yy = 2.2 + r * 3;
    g.box(x, yy, z - d / 2 - 0.03, w * 0.82, 1.2, 0.06, win); g.box(x, yy, z + d / 2 + 0.03, w * 0.82, 1.2, 0.06, win);
    g.box(x - w / 2 - 0.03, yy, z, 0.06, 1.2, d * 0.82, win); g.box(x + w / 2 + 0.03, yy, z, 0.06, 1.2, d * 0.82, win);
  }
}
export function bench(g, x, y, z, ry = 0, col = '#E8A65D') {
  const c = Math.cos(ry), s = Math.sin(ry);
  g.box(x, y + 0.42, z, 1.8, 0.1, 0.5, hex(col), ry);
  g.box(x - s * 0.22, y + 0.72, z - c * 0.22, 1.8, 0.5, 0.08, hex(col), ry);
  for (const k of [-0.75, 0.75]) g.box(x + c * k, y + 0.2, z - s * k, 0.08, 0.4, 0.45, hex('#6C7A89'), ry);
}
export function lamp(g, glow, x, y, z) {
  g.cyl(x, y + 2.2, z, 0.14, 4.4, hex('#6C7A89'), 6);
  g.box(x, y + 4.45, z, 0.5, 0.18, 0.5, hex('#6C7A89'));
  glow.box(x, y + 4.32, z, 0.42, 0.08, 0.42, hex('#FFF6D5'));
}
export function planter(g, x, y, z, s = 1) {
  g.box(x, y + 0.3 * s, z, 1.0 * s, 0.6 * s, 1.0 * s, hex('#D9CBB5'));
  g.sphere(x, y + 0.9 * s, z, 0.95 * s, hex('#79C072'), 1);
}
export { mix };
