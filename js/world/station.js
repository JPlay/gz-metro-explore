/*
 * 车站模板（所有车站同一套布局，换站名、配色、装饰；招牌站有专属细节）：
 *   街面 y=0（站口雨棚）→ 楼梯通道 → 站厅 y=-6（安检 z=-12、闸机 z=-2、楼梯+扶梯口）→ 岛式站台 y=-12（屏蔽门、两侧轨道、隧道口）。
 *   公园前额外有 2 号线站台（y=-22，z=44）和换乘通道（含会自己拼起来的桥）。
 * 所有站台都沿 x 轴：+x = 站号递增方向（1 号线往广州东站，2 号线往嘉禾望岗）。
 */
import { Kit } from './kit.js';
import { hex, mix } from '../core/geo.js';
import { Geo } from '../core/geo.js';
import { colorMat } from '../core/mats.js';
import { LINES, STATIONS, OTHER_LINES, transfersAt, nextStation } from '../data/lines.js';
import { DOOR_XS } from './train.js';
import * as D from './decor.js';
import * as MV from './mv.js';
const B = window.BABYLON;

export const YC = -6, HALL_X = 46, TUNNEL_X = 140, TRACK_OFF = 7.6, PSD_OFF = 6, WALL_OFF = 10.6;
export const MAIN = { y: -12, zc: 14 }, GYQ2 = { y: -22, zc: 44 };
export const SPAWN = { x: 0, y: 0, z: -48, yaw: 0 };
const THEMES = ['#F4E4D4', '#DDEFE3', '#E1EAF6', '#F6E1E8', '#ECE4F6', '#FFF0CF', '#DAF0EF', '#F3E9DC'];
const FLOOR = '#E3E6EA', DARKF = '#4A5260', TUNNEL = '#596170';

export function framesFor(code) {
  const s = STATIONS[code];
  return s.lines.length > 1 ? [{ line: 1, ...MAIN }, { line: 2, ...GYQ2 }] : [{ line: s.lines[0], ...MAIN }];
}
export function badge(k) {
  if (k === 1 || k === 2) return { t: String(k), bg: LINES[k].color, fg: LINES[k].ink };
  const o = OTHER_LINES[k]; return { t: o.short || String(k), bg: o.color, fg: '#FFFFFF' };
}
function hashCode(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }

export class Station {
  constructor(scene, code, events) {
    this.scene = scene; this.code = code; this.s = STATIONS[code]; this.events = events;
    this.theme = THEMES[hashCode(code) % THEMES.length];
    if (this.s.signature === 'redwall') this.theme = '#F6DCCF';
    D.reseed(hashCode(code));
    const k = this.kit = new Kit(scene, 'st-' + code);
    this.platforms = framesFor(code).map(f => ({ ...f, sides: {
      A: { key: 'A', step: 1, trackZ: f.zc - TRACK_OFF, psdZ: f.zc - PSD_OFF, doorSg: 1, n: 1 },
      B: { key: 'B', step: -1, trackZ: f.zc + TRACK_OFF, psdZ: f.zc + PSD_OFF, doorSg: -1, n: 2 } } }));
    this.gates = []; this.mv = []; this.escalators = []; this.psd = [];
    this.street(); this.passage(); this.concourse();
    this.platforms.forEach(p => this.platform(p));
    if (this.platforms.length > 1) this.transfer();
    k.finish();
    this.root = k.root;
  }
  /* ---------------- 街面 ---------------- */
  street() {
    const k = this.kit, s = this.s, sig = s.signature, L1 = s.lines[0];
    k.floorWithHoles(-60, 60, -90, 40, -0.8, 0, '#E9E3D7', [[-3.6, 3.6, -36, -26]]);
    // 草地与马路
    for (const sx of [-1, 1]) { k.solid.slab(sx * 12, sx * 52, 0, 0.04, -62, -16, hex('#A8D88E')); k.solid.slab(sx * 12, sx * 52, 0, 0.04, -12, 32, hex('#A8D88E')); }
    k.solid.slab(-60, 60, 0, 0.03, -78, -64, hex('#7E8794'));
    for (let x = -56; x < 60; x += 8) k.solid.slab(x, x + 4, 0.03, 0.05, -71.2, -70.8, hex('#F4F4F4'));
    for (let x = -10; x <= 10; x += 2) k.solid.slab(x - 0.5, x + 0.5, 0.03, 0.05, -64, -62.2, hex('#F4F4F4'));
    // 边界
    k.colSlab(-61, -60, 0, 8, -90, 40); k.colSlab(60, 61, 0, 8, -90, 40); k.colSlab(-60, 60, 0, 8, -91, -90); k.colSlab(-60, 60, 0, 8, 40, 41);
    // 站口雨棚
    const lc = LINES[L1].color;
    k.block(-4.7, -3.6, 0, 3.6, -37.5, -26, '#F7F7F2'); k.block(3.6, 4.7, 0, 3.6, -37.5, -26, '#F7F7F2');
    k.block(-4.7, 4.7, 0, 3.6, -26.2, -25.8, '#F7F7F2');
    k.solid.slab(-5.2, 5.2, 3.6, 4.0, -38.2, -25.4, hex('#FFFFFF'));
    k.solid.slab(-5.25, 5.25, 3.3, 3.6, -38.25, -38.0, hex(lc));
    for (const sx of [-1, 1]) k.glass.slab(sx * 4.71, sx * 4.75, 0.8, 3.2, -36.5, -27, hex('#CFE8F7'));
    const bad = this.s.lines.map(badge);
    k.sign(0, 4.65, -38.3, { w: 9.4, h: 1.25, bg: '#FFFFFF', fg: '#24324A', zh: s.zh + '站', en: s.en + ' Station', badges: [{ t: '地铁', bg: '#24324A', fg: '#fff' }, ...bad], face: Math.PI, stripe: lc });
    k.sign(0, 2.95, -37.6, { w: 4.2, h: 0.55, bg: lc, fg: LINES[L1].ink, zh: '进站 入口', en: 'Entrance', arrow: 'down', face: Math.PI });
    // 路灯、长椅、树
    for (const x of [-9, 9]) for (const z of [-58, -44, -30, -16]) D.lamp(k.solid, k.glow, x, 0, z);
    D.bench(k.solid, -8, 0, -50, Math.PI / 2); D.bench(k.solid, 8, 0, -54, -Math.PI / 2);
    const treeSpots = [];
    for (let i = 0; i < 26; i++) { const sx = D.rnd() < 0.5 ? -1 : 1; treeSpots.push([sx * (15 + D.rnd() * 34), -60 + D.rnd() * 88]); }
    // 四周的楼
    const bcol = ['#F3D9C6', '#D9E8F5', '#F7EBC8', '#DCEFD9', '#EAD9F2', '#F2D5D5'];
    const bld = (x, z, w, d, h, c) => { D.building(k.solid, x, z, w, d, h, c); k.col(x, h / 2, z, w, h, d); };
    for (let i = 0; i < 6; i++) bld(-56 + i * 22.4, 34, 16, 8, 10 + (i * 7) % 12, bcol[i]);
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) { const z = -80 + i * 28; bld(sx * 56, z, 6, 18, 9 + ((i + (sx > 0 ? 2 : 0)) * 5) % 11, bcol[(i + (sx > 0 ? 3 : 0)) % 6]); }
    for (let i = 0; i < 5; i++) bld(-48 + i * 24, -86, 18, 6, 8 + (i * 4) % 9, bcol[(i + 2) % 6]);
    // 行人
    for (let i = 0; i < 6; i++) D.person(k.solid, -10 + D.rnd() * 20, 0, -60 + D.rnd() * 14, D.rnd() * 6.28, i === 0 ? 'wave' : 'stand');
    // 招牌站：地面地标
    const avoid = (x, z) => sig === 'park' && x > 6 && x < 26 && z > -52 && z < -30;
    if (sig === 'park') {
      // 人民公园：大树林 + 喷泉 + Penrose 不可能三角
      for (let i = 0; i < 14; i++) treeSpots.push([(D.rnd() < 0.5 ? -1 : 1) * (14 + D.rnd() * 10), -24 + D.rnd() * 50]);
      k.solid.cyl(-24, 0.4, -40, 7, 0.8, hex('#D8CCB8'), 16); k.glow.cyl(-24, 0.82, -40, 6.2, 0.05, hex('#8FD3F4'), 16);
      k.solid.cyl(-24, 1.4, -40, 0.8, 2, hex('#E7DCCB'), 8); k.glow.sphere(-24, 2.6, -40, 1.2, hex('#BFE9FF'), 1);
      k.col(-24, 0.4, -40, 7, 0.8, 7);
      this.mv.push(MV.penrose(k, new B.Vector3(6, 1.35, -50), 0.95, 15));
    } else if (sig === 'redwall') {
      // 农讲所：红墙黄瓦的庭院
      for (const sx of [-1, 1]) {
        k.block(sx * 14, sx * 40, 0, 4.2, -40, -39, '#B8432F'); k.solid.slab(sx * 13.6, sx * 40.4, 4.2, 4.7, -40.4, -38.6, hex('#E2A93B'));
        k.block(sx * 39, sx * 40, 0, 4.2, -40, -16, '#B8432F'); k.solid.slab(sx * 38.6, sx * 40.4, 4.2, 4.7, -40.4, -15.6, hex('#E2A93B'));
        for (let i = 0; i < 4; i++) { k.glow.sphere(sx * (17 + i * 6), 3.4, -40.7, 0.7, hex('#FF5C4D'), 1, 1.2); k.solid.box(sx * (17 + i * 6), 3.95, -40.7, 0.06, 0.4, 0.06, hex('#333')); }
      }
      k.block(-10, 10, 0, 6, -12, 2, '#C24A36', true); k.solid.slab(-11.5, 11.5, 6, 6.6, -13.5, 3.5, hex('#E2A93B')); k.solid.slab(-9, 9, 6.6, 7.4, -11, 1, hex('#E2A93B'));
      k.sign(0, 4.4, -12.06, { w: 6, h: 1.1, bg: '#7A1E14', fg: '#FFE7A8', zh: '农民运动讲习所', en: 'Peasant Movement Institute', face: Math.PI });
    } else if (sig === 'memorial') {
      // 烈士陵园：纪念碑 + 木棉
      k.block(-6, 6, 0, 1.2, -6, 6, '#E9E4DA'); k.block(-3, 3, 1.2, 2.4, -3, 3, '#E2DCD0');
      k.solid.cyl(0, 10, 0, 2.2, 15.2, hex('#F2EEE6'), 8, 0, 0, 0, 1.3); k.col(0, 9, 0, 2.2, 16, 2.2);
      k.solid.box(0, 18, 0, 1.3, 1.6, 1.3, hex('#E9E4DA')); k.glow.sphere(0, 19.2, 0, 0.9, hex('#FFD36B'), 1);
      for (let i = 0; i < 10; i++) treeSpots.push([(i % 2 ? -1 : 1) * (12 + (i % 5) * 7), -50 + Math.floor(i / 2) * 9, 1]);
    } else if (sig === 'villa') {
      // 东山口：红砖洋楼
      for (const [x, z, r] of [[-22, -44, 0.2], [24, -46, -0.25], [-26, -20, 0.1], [26, -22, -0.1]]) {
        k.block(x - 6, x + 6, 0, 8, z - 5, z + 5, '#B9563F');
        for (let fl = 0; fl < 2; fl++) for (let w = -1; w <= 1; w++) { k.solid.box(x + w * 3.4, 2.4 + fl * 3.6, z + 5.03, 1.5, 2.0, 0.08, hex('#F5F0E6')); k.solid.box(x + w * 3.4, 2.3 + fl * 3.6, z + 5.06, 1.1, 1.6, 0.08, hex('#8FB8D4')); }
        k.solid.box(x, 9.0, z - 2.3, 13, 0.4, 6.4, hex('#A33F2C'), 0, 0.5, 0); k.solid.box(x, 9.0, z + 2.3, 13, 0.4, 6.4, hex('#A33F2C'), 0, -0.5, 0);
        k.solid.slab(x - 6.3, x + 6.3, 8, 8.3, z - 5.3, z + 5.3, hex('#F5F0E6'));
      }
    } else if (sig === 'railway') {
      k.block(-30, 30, 0, 9, 4, 14, '#E8E1D3'); k.solid.slab(-31, 31, 9, 9.6, 3, 15, hex('#C9D6E3'));
      k.block(-4, 4, 9.6, 22, 6, 12, '#E8E1D3'); k.glow.cyl(0, 17.5, 5.95, 4.6, 0.1, hex('#FFFFFF'), 24, 0, Math.PI / 2, 0);
      k.solid.box(0, 18.3, 5.85, 0.25, 1.8, 0.1, hex('#24324A')); k.solid.box(0.6, 17.5, 5.85, 1.3, 0.22, 0.1, hex('#24324A'));
      k.sign(0, 7.2, 3.94, { w: 10, h: 1.6, bg: '#B3261E', fg: '#FFFFFF', zh: '广州站', en: 'Guangzhou Railway Station', face: Math.PI });
    } else if (sig === 'rams') {
      k.solid.sphere(-26, -2, -36, 22, hex('#8FCB7A'), 2, 0.45); k.col(-26, 1.5, -36, 14, 5, 14);
      for (let i = 0; i < 5; i++) { const a = i * 1.256, x = -26 + Math.cos(a) * 2.2, z = -36 + Math.sin(a) * 2.2; goat(k.solid, x, 5.1 + (i === 0 ? 1 : 0), z, a + Math.PI / 2, i === 0 ? 1.4 : 1); }
      k.solid.cyl(-26, 5.4, -36, 1.4, 2, hex('#E2D3B8'), 8);
    }
    for (const [x, z, kind] of treeSpots) if (!avoid(x, z) && !(Math.abs(x) < 12 && z > -40 && z < -20)) { D.tree(k.solid, x, 0, z, 0.9 + D.rnd() * 0.5, kind ?? (D.rnd() < 0.25 ? 2 : 0)); k.col(x, 1, z, 0.45, 2, 0.45); }
    // 路面箭头：街口 → 站口
    for (const z of [-46, -43, -40]) arrow(k, 0, 0.06, z, 0, '#FFFFFF');
  }
  /* ---------------- 通道楼梯 ---------------- */
  passage() {
    const k = this.kit;
    k.stairs('z', -36, 0, -20, YC, -3.5, 3.5, YC - 0.5, '#D9DEE4', { rails: false });
    for (const sx of [-1, 1]) { k.block(sx * 3.5, sx * 3.75, YC - 0.4, 3.6, -37, -26, '#EEF1F4'); k.block(sx * 3.5, sx * 3.75, YC - 0.4, -0.8, -26, -20, '#EEF1F4'); }
    for (const z of [-24, -21.5]) k.glow.slab(-2, 2, -0.86, -0.82, z, z + 0.6, hex('#FFFBEA'));
    // 扶手
    for (const sx of [-1, 1]) k.solid.box(sx * 3.4, -2.0, -28, 0.08, 0.08, 17.1, hex('#9AA7B5'), 0, Math.atan2(6, 16), 0);
  }
  /* ---------------- 站厅 ---------------- */
  concourse() {
    const k = this.kit, s = this.s, y = YC, L = this.s.lines, lc = LINES[L[0]].color, th = hex(this.theme), sig = s.signature;
    k.floorWithHoles(-18, 18, -20, 26, y - 1.2, y, FLOOR, [[-1, 15, 10, 18]]);
    // 地面拼花（视觉）
    for (let z = -18; z < 26; z += 4) k.solid.slab(-17.9, 17.9, y, y + 0.005, z, z + 0.08, hex('#D3D8DE'));
    k.block(-18.3, -18, y, -0.8, -20, 26, this.theme); k.block(18, 18.3, y, -0.8, -20, 26, this.theme);
    k.block(-18, 18, y, -0.8, 26, 26.3, this.theme);
    k.block(-18, -3.75, y, -0.8, -20.3, -20, this.theme); k.block(3.75, 18, y, -0.8, -20.3, -20, this.theme);
    // 墙面色带
    for (const sx of [-1, 1]) k.solid.slab(sx * 17.98, sx * 17.94, y + 2.6, y + 2.9, -20, 26, hex(lc));
    k.solid.slab(-18, 18, y + 2.6, y + 2.9, 25.95, 25.99, hex(lc));
    // 天花灯
    for (let z = -16; z < 24; z += 6) for (const x of [-11, -3, 5, 13]) k.glow.slab(x - 1.6, x + 1.6, -0.88, -0.84, z, z + 0.8, hex('#FFFBEA'));
    // 柱子
    for (const [x, z] of [[-10, -16], [10, -16], [-10, -7], [-12, 5], [12, 5], [-12, 20], [8, 22], [-6, 22]]) { k.solid.cyl(x, y + 2.6, z, 0.9, 5.2, th.map(v => v * 0.96), 10); k.col(x, y + 2.6, z, 0.9, 5.2, 0.9); }
    // 售票机 + 客服中心
    for (let i = 0; i < 4; i++) { const z = -17 + i * 1.6; k.block(-17.9, -17.2, y, y + 1.8, z - 0.6, z + 0.6, '#5C6B7E'); k.glow.slab(-17.18, -17.16, y + 1.0, y + 1.6, z - 0.4, z + 0.4, hex('#8FD3F4')); }
    k.sign(-17.6, y + 2.25, -14.6, { w: 4.8, h: 0.6, bg: '#24324A', zh: '自动售票', en: 'Ticket Machines', face: Math.PI / 2 });
    k.block(12, 17.9, y, y + 1.1, -9, -5, '#F7F7F2'); k.glass.slab(12, 17.9, y + 1.1, y + 2.4, -5.05, -4.95, hex('#CFE8F7'));
    k.solid.slab(12, 17.9, y + 2.4, y + 2.8, -9, -4.9, hex(lc)); D.person(k.solid, 15, y, -7, Math.PI, 'stand', { shirt: hex('#2E5B9A') });
    k.sign(15, y + 3.2, -4.95, { w: 5.2, h: 0.6, bg: '#FFFFFF', fg: '#24324A', zh: '客服中心', en: 'Customer Service', face: 0 });
    // —— 安检（z=-12）
    const zs = -12;
    k.rail(-18, zs, -4.7, zs, y); k.rail(-1.5, zs, -1.25, zs, y); k.rail(1.25, zs, 9, zs, y); k.rail(12, zs, 18, zs, y);
    // X 光机
    k.block(-4.6, -1.6, y, y + 0.75, zs - 2.6, zs + 2.6, '#C9D1DA');
    k.block(-4.4, -1.8, y + 0.75, y + 2.0, zs - 1.1, zs + 1.1, '#E9EDF2');
    k.solid.slab(-4.5, -1.7, y + 0.75, y + 0.8, zs - 2.6, zs + 2.6, hex('#3A3F46'));
    k.solid.slab(-4.42, -1.78, y + 0.8, y + 1.5, zs - 1.12, zs - 1.1, hex('#2F343B')); k.solid.slab(-4.42, -1.78, y + 0.8, y + 1.5, zs + 1.1, zs + 1.12, hex('#2F343B'));
    k.block(-6.6, -5.0, y, y + 0.85, zs + 1.2, zs + 2.6, '#8E99A6'); k.glow.slab(-6.4, -5.2, y + 0.86, y + 1.4, zs + 1.5, zs + 1.55, hex('#3D7BD9'));
    D.person(k.solid, -5.8, y, zs + 3.3, Math.PI, 'stand', { shirt: hex('#24456E'), pants: hex('#1F2A3A') });
    // 安检门
    k.block(-1.25, -0.9, y, y + 2.3, zs - 0.35, zs + 0.35, '#E9EDF2'); k.block(0.9, 1.25, y, y + 2.3, zs - 0.35, zs + 0.35, '#E9EDF2');
    k.solid.slab(-1.25, 1.25, y + 2.3, y + 2.6, zs - 0.35, zs + 0.35, hex('#E9EDF2'));
    const archLightMat = colorMat(this.scene, '#88A0B8', { glow: true }).clone('archLight');
    const archLight = B.MeshBuilder.CreateBox('archLight', { width: 1.6, height: 0.12, depth: 0.72 }, this.scene); archLight.material = archLightMat; archLight.parent = k.root; archLight.position.set(0, y + 2.62, zs);
    D.person(k.solid, 2.4, y, zs + 1.4, -Math.PI / 2 - 0.4, 'wave', { shirt: hex('#24456E'), pants: hex('#1F2A3A') });
    k.sign(0, y + 3.5, zs - 0.4, { w: 6, h: 0.75, bg: '#24324A', zh: '安全检查', en: 'Security Check', face: Math.PI, double: true, backUv: { w: 6, h: 0.75, bg: '#24324A', zh: '出站', en: 'Way Out' } });
    k.sign(10.5, y + 2.6, zs - 0.1, { w: 2.6, h: 0.6, bg: '#2E8B57', zh: '出口', en: 'Exit', arrow: 'up', face: 0 });
    for (const z of [-17, -15]) arrow(k, 0, y + 0.02, z, 0, '#FFD23F');
    // 行李（X 光机传送带）
    const bags = [0, 1, 2].map(i => { const b = B.MeshBuilder.CreateBox('bag', { width: 0.7, height: 0.35, depth: 0.5 }, this.scene); b.material = colorMat(this.scene, ['#E76F51', '#2A9D8F', '#F4A261'][i]); b.parent = k.root; b.position.set(-3.1, y + 0.98, zs - 2.4 + i * 1.7); return b; });
    this.security = { z: zs, y, light: archLightMat, bags, cool: 0, flash: 0, belt: 0 };
    // —— 闸机（z=-2）
    const zg = -2, lanes = [-4, -2, 0, 2, 4];
    k.rail(-18, zg, -5.45, zg, y); k.rail(5.45, zg, 18, zg, y);
    for (const cx of [-5, -3, -1, 1, 3, 5]) {
      k.block(cx - 0.45, cx + 0.45, y, y + 1.0, zg - 0.9, zg + 0.9, '#D8DEE6');
      k.solid.slab(cx - 0.47, cx + 0.47, y + 1.0, y + 1.08, zg - 0.92, zg + 0.92, hex('#3B4658'));
      k.glow.slab(cx - 0.2, cx + 0.2, y + 1.08, y + 1.1, zg - 0.8, zg - 0.5, hex('#3DDC84')); k.glow.slab(cx - 0.2, cx + 0.2, y + 1.08, y + 1.1, zg + 0.5, zg + 0.8, hex('#3DDC84'));
      k.glow.slab(cx - 0.12, cx + 0.12, y + 1.09, y + 1.11, zg - 0.15, zg + 0.15, hex('#FFD23F'));
    }
    const flapMat = colorMat(this.scene, '#E8F4FF', { emissive: 0.25 });
    const flapSrc = B.MeshBuilder.CreateBox('flap', { width: 0.5, height: 0.6, depth: 0.05 }, this.scene); flapSrc.material = flapMat; flapSrc.parent = k.root; flapSrc.isVisible = false;
    for (const lx of lanes) {
      const flaps = [-1, 1].map(sd => { const pv = new B.TransformNode('fp', this.scene); pv.parent = k.root; pv.position.set(lx + sd * 0.55, y + 0.75, zg); const f = flapSrc.createInstance('flap'); f.parent = pv; f.position.x = -sd * 0.25; return { pv, sd }; });
      const col = k.col(lx, y + 0.8, zg, 1.1, 1.6, 0.25, { dynamic: false });
      this.gates.push({ x: lx, z: zg, y, f: 0, open: false, flaps, col, t: 0 });
    }
    k.sign(0, y + 3.6, zg - 0.5, { w: 7, h: 0.75, bg: lc, fg: LINES[L[0]].ink, zh: '进站闸机', en: 'Entry Gates', badges: L.map(badge), face: Math.PI, double: true, backUv: { w: 7, h: 0.75, bg: '#2E8B57', zh: '出站闸机', en: 'Exit Gates' } });
    for (const z of [-8.5, -5.5]) arrow(k, 0, y + 0.02, z, 0, '#FFD23F');
    // —— 去站台的楼梯 + 两部扶梯（洞 x∈[-1,15], z∈[10,18]）
    k.stairs('x', -1, y, 15, MAIN.y, 10, 18, MAIN.y, '#D9DEE4');
    const ang = Math.atan2(MAIN.y - y, 16), len = Math.hypot(16, y - MAIN.y);
    for (const [z0, z1, dir] of [[10.15, 11.65, -1], [16.35, 17.85, 1]]) {
      const zc = (z0 + z1) / 2;
      k.solid.box(7, (y + MAIN.y) / 2 + 0.02, zc, len, 0.1, z1 - z0, hex('#4B5563'), 0, 0, ang);
      for (const ze of [z0 - 0.08, z1 + 0.08]) { k.glass.box(7, (y + MAIN.y) / 2 + 0.55, ze, len, 0.9, 0.04, hex('#DFF1FF'), 0, 0, ang); k.solid.box(7, (y + MAIN.y) / 2 + 1.02, ze, len, 0.08, 0.1, hex('#1F2937'), 0, 0, ang); }
      this.escalators.push({ x0: -1, y0: y, x1: 15, y1: MAIN.y, z0, z1, dir, steps: this.escSteps(zc, z1 - z0, ang, len, -1, y), off: 0 });
    }
    k.rail(-1, 10, 15, 10, y); k.rail(-1, 18, 15, 18, y); k.rail(15, 10, 15, 18, y);
    const destTxt = L.map(l => LINES[l].zh).join(' · ');
    k.sign(-1.2, y + 3.4, 14, { w: 7.6, h: 0.8, bg: '#24324A', zh: '往站台 ' + destTxt, en: 'To Platforms', badges: L.slice(0, 1).map(badge), arrow: 'down', face: -Math.PI / 2, double: true, backUv: { w: 7.6, h: 0.8, bg: '#2E8B57', zh: '出口 · 出站', en: 'Way Out', arrow: 'up' } });
    for (const [x, z, a] of [[-4, 2], [-4, 5.5], [-4, 9], [-3, 13.2, Math.PI / 2]]) arrow(k, x, y + 0.02, z, a || 0, '#FFD23F');
    // 站厅里的乘客
    for (let i = 0; i < 5; i++) D.person(k.solid, -14 + D.rnd() * 10, y, 2 + D.rnd() * 20, D.rnd() * 6.28);
    D.planter(k.solid, -16.5, y, 24.5); D.planter(k.solid, 16.5, y, 24.5); D.planter(k.solid, 16.5, y, -18.5);
    // 招牌站：站厅装饰
    if (sig === 'memorial') MV.perspectiveArches(k, -9, 2, 1, y, '#F2E6D8', '#E07A5F', 6);
    if (sig === 'redwall') for (const z of [-16, -7, 5, 20]) for (const sx of [-1, 1]) k.glow.sphere(sx * 10, y + 4.1, z, 0.8, hex('#FF5C4D'), 1, 1.25);
    if (sig === 'villa') for (let z = -18; z < 25; z += 3) k.solid.slab(-17.99, -17.9, y + 0.3, y + 2.4, z, z + 2.6, hex('#C0634A'));
    if (sig === 'park') k.sign(17.95, y + 1.9, 18, { w: 9, h: 2.6, bg: '#8FCB7A', fg: '#1F4D2B', zh: '公园前 · 人民公园', en: 'People\'s Park', face: -Math.PI / 2 });
    // 墙上大站名
    k.sign(-17.95, y + 4.0, 10, { w: 12, h: 1.3, bg: '#FFFFFF', fg: '#24324A', zh: s.zh, en: s.en, badges: L.map(badge), face: Math.PI / 2, stripe: lc });
  }
  escSteps(zc, w, ang, len, _dir, y) {
    const src = B.MeshBuilder.CreateBox('step', { width: 0.42, height: 0.08, depth: w - 0.1 }, this.scene);
    src.material = colorMat(this.scene, '#9AA5B1'); src.parent = this.kit.root; src.isVisible = false;
    const out = [];
    for (let i = 0; i < 34; i++) { const st = src.createInstance('st'); st.parent = this.kit.root; st.rotation.z = ang; st.position.z = zc; out.push(st); }
    return out;
  }
  /* ---------------- 站台 ---------------- */
  platform(P) {
    const k = this.kit, y = P.y, zc = P.zc, L = LINES[P.line], lc = L.color, th = hex(this.theme), s = this.s, isMain = P.zc === MAIN.zc;
    const holes = [];
    if (this.platforms.length > 1 && P.line === 1) holes.push([-20, -6, 12, 16]);
    k.floorWithHoles(-HALL_X, HALL_X, zc - PSD_OFF, zc + PSD_OFF, y - 1.3, y, FLOOR, holes);
    k.colSlab(-HALL_X, HALL_X, y - 0.3, y, zc - PSD_OFF - 0.25, zc - PSD_OFF); k.colSlab(-HALL_X, HALL_X, y - 0.3, y, zc + PSD_OFF, zc + PSD_OFF + 0.25);
    for (const sz of [-1, 1]) {
      k.solid.slab(-HALL_X, HALL_X, y, y + 0.012, zc + sz * 5.15, zc + sz * 5.55, hex('#FFD23F'));
      // 轨道
      const tz = zc + sz * TRACK_OFF;
      k.solid.slab(-TUNNEL_X, TUNNEL_X, y - 1.75, y - 1.35, tz - 2.3, tz + 2.3, hex(DARKF));
      for (const rz of [-0.72, 0.72]) k.solid.slab(-TUNNEL_X, TUNNEL_X, y - 1.35, y - 1.2, tz + rz - 0.05, tz + rz + 0.05, hex('#B8C0C8'));
      for (let x = -TUNNEL_X; x < TUNNEL_X; x += 1.2) k.solid.slab(x, x + 0.25, y - 1.36, y - 1.3, tz - 1.1, tz + 1.1, hex('#6B6F76'));
      // 墙
      const wz = zc + sz * WALL_OFF;
      k.solid.slab(-HALL_X, HALL_X, y - 1.75, y + 4.8, wz, wz + sz * 0.3, th); k.colSlab(-HALL_X, HALL_X, y - 1.75, y + 4.8, wz, wz + sz * 0.3);
      k.solid.slab(-HALL_X, HALL_X, y + 0.2, y + 0.5, wz - sz * 0.01, wz, hex(lc));
      for (let x = -40; x <= 40; x += 16) {
        k.sign(x - 4, y + 2.1, wz - sz * 0.02, { w: 4.6, h: 1.05, bg: '#FFFFFF', fg: '#24324A', zh: s.zh, en: s.en, badges: s.lines.map(badge), face: sz > 0 ? Math.PI : 0, stripe: lc, box: false });
        const ad = ['#FFB4A2', '#B5E2FA', '#C7F9CC', '#FDE2A7', '#D8C3F5'][(Math.round((x + 40) / 16) + (sz > 0 ? 2 : 0)) % 5];
        k.solid.slab(x + 2, x + 6.5, y + 1.2, y + 3.4, wz - sz * 0.04, wz - sz * 0.01, hex(ad));
        k.solid.slab(x + 2.6, x + 4.2, y + 1.6, y + 3.0, wz - sz * 0.06, wz - sz * 0.04, mix(hex(ad), [1, 1, 1], 0.6));
      }
      // 隧道（两端）
      for (const e of [-1, 1]) {
        const xa = e * HALL_X, xb = e * TUNNEL_X, x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
        for (const wsd of [-1, 1]) k.solid.slab(x0, x1, y - 1.75, y + 3.6, tz + wsd * 2.3, tz + wsd * 2.6, hex(TUNNEL));
        k.solid.slab(x0, x1, y + 3.6, y + 3.9, tz - 2.6, tz + 2.6, hex(TUNNEL));
        k.solid.slab(xb - e * 0.3, xb, y - 1.75, y + 3.9, tz - 2.6, tz + 2.6, hex('#15181D'));
        for (let x = x0 + 5; x < x1; x += 10) k.glow.box(x, y + 2.6, tz - sz * 2.28, 0.6, 0.12, 0.05, hex('#FFE9A8'));
      }
    }
    // 端墙（带隧道口）
    for (const e of [-1, 1]) {
      const x = e * HALL_X, a = zc - TRACK_OFF, b = zc + TRACK_OFF, segs = [[zc - WALL_OFF, a - 2.3], [a + 2.3, b - 2.3], [b + 2.3, zc + WALL_OFF]];
      for (const [z0, z1] of segs) k.block(x - 0.15, x + 0.15, y - 1.75, y + 4.8, z0, z1, this.theme);
      for (const t of [a, b]) k.solid.slab(x - 0.15, x + 0.15, y + 3.6, y + 4.8, t - 2.3, t + 2.3, th);
    }
    // 顶棚（主站台中间被站厅地板盖住）
    const ceilHoles = isMain ? [[-18, 18, -100, 100]] : [[-19, -5.6, 41, 45]];
    k.floorWithHoles(-HALL_X, HALL_X, zc - WALL_OFF, zc + WALL_OFF, y + 4.8, y + 5.2, this.theme, ceilHoles, true);
    for (const sz of [-1, 1]) for (let x = -44; x < 44; x += 4) {
      const inHole = (isMain && x > -2 && x < 16) || (!isMain && x > -20 && x < -4);
      if (!inHole) k.glow.slab(x, x + 3, y + 4.72, y + 4.78, zc + sz * 2.6 - 0.2, zc + sz * 2.6 + 0.2, hex('#FFFBEA'));
    }
    // 柱子、长椅、候车乘客
    for (let x = -40; x <= 40; x += 8) {
      if ((isMain && x > -3 && x < 17) || (holes.length && x > -22 && x < -4) || (!isMain && x > -21 && x < -4)) continue;
      k.solid.cyl(x, y + 2.4, zc, 0.8, 4.8, th.map(v => v * 0.95), 10); k.solid.cyl(x, y + 4.5, zc, 1.2, 0.6, th.map(v => v * 0.9), 10, 0, 0, 0, 0.8); k.col(x, y + 2.4, zc, 0.8, 4.8, 0.8);
      if (Math.abs(x) % 16 === 8) { D.bench(k.solid, x + 2.5, y, zc, 0, '#7FB3D5'); k.col(x + 2.5, y + 0.4, zc, 1.8, 0.8, 0.5); }
    }
    for (let i = 0; i < 6; i++) { const sz = i % 2 ? 1 : -1, x = -36 + i * 13 + D.rnd() * 3; if (Math.abs(x - 7) < 10 && isMain) continue; D.person(k.solid, x, y, zc + sz * 4.6, sz > 0 ? 0 : Math.PI); }
    // 方向牌（悬挂，双面）：每一侧开往哪里
    for (const side of [P.sides.A, P.sides.B]) {
      const dirKey = Object.keys(L.dirs).find(d => L.dirs[d].step === side.step), dest = L.dirs[dirKey], nx = nextStation(P.line, this.code, side.step);
      const zz = side.psdZ + (side.key === 'A' ? 0.6 : -0.6), face = side.key === 'A' ? 0 : Math.PI;
      // 观看者面朝牌子时，+x 在左边（A 侧）或右边（B 侧）
      const arrowDir = (side.step > 0) === (side.key === 'B') ? 'right' : 'left';
      for (const x of [-22, 22]) {
        k.sign(x, y + 3.15, zz, { w: 6.2, h: 0.8, bg: '#24324A', zh: nx ? `往 ${dest.zh} 方向` : '终点站 · 不载客', en: nx ? 'To ' + dest.en : 'Terminus', badges: [badge(P.line)], arrow: nx ? arrowDir : undefined, face });
        if (nx) k.sign(x, y + 2.55, zz, { w: 6.2, h: 0.36, bg: '#FFFFFF', fg: '#24324A', zh: `下一站：${STATIONS[nx].zh}   Next: ${STATIONS[nx].en}`, face });
      }
      this.psdBuild(P, side);
    }
    // 楼梯口牌子
    if (isMain) k.sign(16.4, y + 3.2, 14, { w: 5, h: 0.7, bg: '#2E8B57', zh: '出口 · 站厅', en: 'Exit · Concourse', arrow: 'up', face: Math.PI / 2, double: true });
    k.sign(isMain ? -30 : 30, y + 3.4, zc, { w: 5.6, h: 0.75, bg: lc, fg: L.ink, zh: s.zh + ' · ' + L.zh, en: s.en, badges: [badge(P.line)], face: isMain ? Math.PI / 2 : -Math.PI / 2, double: true });
    if (isMain) for (const x of [24, 20]) arrow(k, x, y + 0.02, zc - 4.2, Math.PI / 2, '#FFFFFF'), arrow(k, x, y + 0.02, zc + 4.2, Math.PI / 2, '#FFFFFF');
  }
  psdBuild(P, side) {
    const k = this.kit, y = P.y, z = side.psdZ, sgn = side.key === 'A' ? -1 : 1, lc = LINES[P.line].color, th = hex(this.theme);
    let x = -HALL_X; const ops = DOOR_XS.map(d => [d - 0.8, d + 0.8]);
    const seg = (a, b) => {
      if (b - a < 0.05) return;
      k.glass.slab(a, b, y, y + 2.3, z - 0.03, z + 0.03, hex('#CFE8F7'));
      k.solid.slab(a, a + 0.1, y, y + 2.3, z - 0.06, z + 0.06, hex('#5B6676')); k.solid.slab(b - 0.1, b, y, y + 2.3, z - 0.06, z + 0.06, hex('#5B6676'));
      k.colSlab(a, b, y, y + 3.2, z - 0.08, z + 0.08);
    };
    for (const [a, b] of ops) { seg(x, a); x = b; } seg(x, HALL_X);
    k.solid.slab(-HALL_X, HALL_X, y + 2.3, y + 2.8, z - 0.1, z + 0.1, hex('#3B4658'));
    k.glow.slab(-HALL_X, HALL_X, y + 2.62, y + 2.7, z - sgn * 0.11, z - sgn * 0.1, hex(lc));
    k.solid.slab(-HALL_X, HALL_X, y + 2.8, y + 4.8, z - 0.08, z + 0.08, th.map(v => v * 0.97));
    for (const d of DOOR_XS) k.glow.slab(d - 0.3, d + 0.3, y + 2.42, y + 2.55, z - sgn * 0.11, z - sgn * 0.1, hex('#3DDC84'));
    // 门扇
    const src = new Geo(); src.box(0, 1.14, 0, 0.8, 2.28, 0.05, hex('#5B6676')); src.box(0, 1.2, 0, 0.66, 1.9, 0.06, hex('#BFDDF2'));
    const sm = src.toMesh('psdLeaf', this.scene, k.M.solid, k.root); sm.isVisible = false;
    const leaves = [], cols = [];
    for (const d of DOOR_XS) {
      for (const lr of [-1, 1]) { const inst = sm.createInstance('pl'); inst.parent = k.root; inst.metadata = { d, lr }; leaves.push(inst); }
      cols.push(k.col(d, y + 1.2, z, 1.6, 2.4, 0.16, { dynamic: false, name: 'psdDoor' }));
    }
    const st = { P, side, leaves, cols, z, y, f: -1 };
    this.psd.push(st); side.psd = st; this.setPSD(st, 0);
  }
  setPSD(st, f) {
    if (st.f === f) return; st.f = f;
    for (const l of st.leaves) l.position.set(l.metadata.d + l.metadata.lr * (0.4 + f * 0.76), st.y, st.z);
    for (const c of st.cols) c.checkCollisions = f < 0.7;
  }
  /* ---------------- 公园前换乘（1 号线站台 → 2 号线站台） ---------------- */
  transfer() {
    const k = this.kit, y1 = MAIN.y, yc = -17, y2 = GYQ2.y, c2 = LINES[2].color, c1 = LINES[1].color;
    // 1 号线站台中部楼梯（向西下行）
    k.stairs('x', -6, y1, -19.33, yc, 12, 16, yc - 0.2, '#D9DEE4');
    k.rail(-20, 12, -6, 12, y1); k.rail(-20, 16, -6, 16, y1); k.rail(-20, 12, -20, 16, y1);
    k.solid.slab(-24.2, -6, yc - 0.2, y1 - 0.4, 11.7, 11.9, hex('#EEF1F4')); k.solid.slab(-19.0, -6, yc - 0.2, y1 - 0.4, 16.1, 16.3, hex('#EEF1F4'));
    // 通道 x∈[-24,-19], z∈[12,45]
    k.floorWithHoles(-24, -19, 12, 45, yc - 0.2, yc, '#E6EAEE', [[-24, -19, 26, 33]]);
    k.floorWithHoles(-24.2, -19, 16.3, 45.2, -14, -13.7, '#F4F6F8', [], true);
    k.block(-24.3, -24, yc, -14, 11.7, 45.2, '#E1EAF6'); k.block(-19, -18.7, yc, -14, 16.3, 41, '#E1EAF6'); k.block(-24.3, -18.7, yc, -14, 45, 45.3, '#E1EAF6');
    k.block(-24.3, -19.3, yc, y1 - 0.4, 11.6, 11.9, '#E1EAF6', true);
    k.solid.slab(-24, -23.97, yc + 0.9, yc + 1.2, 16.3, 45, hex(c2)); k.solid.slab(-19.03, -19, yc + 0.9, yc + 1.2, 16.3, 41, hex(c1));
    for (let z = 18; z < 44; z += 3.2) k.glow.slab(-22.2, -20.8, -14.06, -14.02, z, z + 1.4, hex('#FFFBEA'));
    // 2 号线站台楼梯（向东下行）+ 竖井
    k.stairs('x', -19, yc, -5.67, y2, 41, 45, y2, '#D9DEE4');
    k.block(-19, -5.6, GYQ2.y + 4.8, -14, 40.7, 41, '#E1EAF6', false); k.block(-19, -5.6, GYQ2.y + 4.8, -14, 45, 45.3, '#E1EAF6', false);
    k.block(-19, -5.6, -14, -13.7, 40.7, 45.3, '#F4F6F8');
    // 会自己拼起来的桥 + 通道里的路标
    this.mv.push(MV.foldingBridge(k, -24, -19, 26, 33, yc));
    for (const z of [18, 22, 36, 39]) arrow(k, -21.5, yc + 0.02, z, 0, c2);
    for (const [x, z] of [[12, 19], [6, 19], [0, 19], [-3.5, 14]]) arrow(k, x, y1 + 0.02, z, -Math.PI / 2, c2);
    for (const [x, z] of [[4, 43], [0, 43]]) arrow(k, x, y2 + 0.02, z, -Math.PI / 2, c1);
    k.sign(-5.2, y1 + 3.3, 14, { w: 6, h: 0.8, bg: c2, fg: '#FFFFFF', zh: '换乘 2号线', en: 'Transfer to Line 2', badges: [badge(2)], arrow: 'down', face: Math.PI / 2, double: true });
    k.sign(-21.5, -15.0, 16.35, { w: 4.6, h: 0.6, bg: c2, fg: '#fff', zh: '换乘 2号线 ↓', en: 'Line 2 Platforms', face: 0 });
    k.sign(-21.5, -15.0, 44.94, { w: 4.6, h: 0.6, bg: c1, fg: LINES[1].ink, zh: '换乘 1号线', en: 'Transfer to Line 1', face: Math.PI });
    k.sign(-4.6, y2 + 3.3, 43, { w: 6, h: 0.8, bg: c1, fg: LINES[1].ink, zh: '换乘 1号线 · 出口', en: 'Transfer to Line 1 · Exit', badges: [badge(1)], arrow: 'up', face: Math.PI / 2, double: true });
  }
  /* ---------------- 每帧 ---------------- */
  update(dt, player, cam, Audio) {
    const p = player.position;
    // 闸机：走近就开
    for (const g of this.gates) {
      const near = Math.abs(p.x - g.x) < 0.75 && Math.abs(p.z - g.z) < 2.0 && Math.abs(p.y - g.y) < 1.5;
      if (near) g.t = 0.8; else g.t -= dt;
      const want = g.t > 0;
      if (want && !g.open) { g.open = true; Audio.sfx('gateBeep'); setTimeout(() => Audio.sfx('gateOpen', { volume: 0.7 }), 120); this.events.emit('gate', { x: g.x }); }
      if (!want && g.open) g.open = false;
      g.f += ((g.open ? 1 : 0) - g.f) * Math.min(1, dt * 9);
      g.flaps.forEach(fl => { fl.pv.rotation.y = fl.sd * g.f * Math.PI / 2; });
      g.col.checkCollisions = g.f < 0.6;
    }
    // 安检门：穿过时“嘀”一声、亮绿灯、传送带转
    const sc = this.security; sc.cool -= dt; sc.flash -= dt;
    if (Math.abs(p.x) < 0.95 && Math.abs(p.z - sc.z) < 0.45 && Math.abs(p.y - sc.y) < 1.5 && sc.cool <= 0) {
      sc.cool = 2.5; sc.flash = 1.6; sc.belt = 4; Audio.sfx('securityBeep'); this.events.emit('security', {});
    }
    const lit = sc.flash > 0 && Math.sin(sc.flash * 18) > -0.3;
    sc.light.emissiveColor.copyFrom(lit ? new B.Color3(0.24, 0.86, 0.52) : new B.Color3(0.53, 0.63, 0.72));
    sc.belt -= dt; const bs = sc.belt > 0 ? 1.2 : 0.25;
    sc.bags.forEach(b => { b.position.z += bs * dt; if (b.position.z > sc.z + 2.4) b.position.z -= 5.1; });
    // 扶梯台阶
    for (const e of this.escalators) {
      e.off += dt * 0.55; const L = Math.hypot(e.x1 - e.x0, e.y1 - e.y0), n = e.steps.length;
      e.steps.forEach((st, i) => { let u = ((i / n) * L + e.off * e.dir) % L; if (u < 0) u += L; const f = u / L; st.position.x = e.x0 + (e.x1 - e.x0) * f; st.position.y = e.y0 + (e.y1 - e.y0) * f + 0.08; });
    }
    for (const m of this.mv) m.update(dt, cam, this.events, player);
  }
  /** 扶梯：站在扶梯上时额外的水平速度（米/秒） */
  conveyor(p) {
    for (const e of this.escalators) {
      if (p.z < e.z0 || p.z > e.z1 || p.x < e.x0 || p.x > e.x1) continue;
      const yr = e.y0 + (e.y1 - e.y0) * (p.x - e.x0) / (e.x1 - e.x0);
      if (Math.abs(p.y - yr) < 0.6) return e.dir * 0.75;
    }
    return 0;
  }
  /** 位置所在区域 */
  zoneOf(p) {
    if (p.y > -3) return { kind: 'street' };
    for (const P of this.platforms) if (Math.abs(p.y - P.y) < 2.2 && p.x > -HALL_X && p.x < HALL_X && p.z > P.zc - WALL_OFF && p.z < P.zc + WALL_OFF) return { kind: 'platform', P };
    if (p.y > YC - 1.5 && p.y < YC + 4 && p.x > -18.5 && p.x < 18.5 && p.z > -20.5 && p.z < 26.5) return { kind: 'concourse', paid: p.z > -2 };
    if (p.y < -12.5 && p.y > -21) return { kind: 'transfer' };
    return { kind: 'passage' };
  }
  platformFor(line) { return this.platforms.find(p => p.line === line); }
  dispose() { this.kit.dispose(); }
}

export function arrow(k, x, y, z, a, col) {
  const c = hex(col);
  for (const sd of [-1, 1]) { const ang = a + Math.PI + sd * Math.PI / 4.2; k.glow.box(x + Math.sin(ang) * 0.36, y, z + Math.cos(ang) * 0.36, 0.22, 0.02, 0.85, c, ang); }
}
function goat(g, x, y, z, ry, s) {
  const c = hex('#F1ECE2'), P = (lx, lz) => [x + (lx * Math.cos(ry) + lz * Math.sin(ry)) * s, z + (-lx * Math.sin(ry) + lz * Math.cos(ry)) * s];
  let p = P(0, 0); g.box(p[0], y + 0.9 * s, p[1], 0.7 * s, 0.6 * s, 1.3 * s, c, ry);
  p = P(0, 0.75); g.box(p[0], y + 1.35 * s, p[1], 0.45 * s, 0.45 * s, 0.5 * s, c, ry);
  for (const [lx, lz] of [[-0.25, -0.45], [0.25, -0.45], [-0.25, 0.45], [0.25, 0.45]]) { p = P(lx, lz); g.box(p[0], y + 0.3 * s, p[1], 0.16 * s, 0.6 * s, 0.16 * s, c, ry); }
  for (const lx of [-0.15, 0.15]) { p = P(lx, 0.7); g.box(p[0], y + 1.65 * s, p[1], 0.1 * s, 0.35 * s, 0.1 * s, hex('#C8B68E'), ry, -0.5); }
}
