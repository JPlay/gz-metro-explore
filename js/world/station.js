/*
 * 车站模板（所有车站同一套布局，换站名、配色、装饰；招牌站有专属细节）：
 *   街面 y=0（站口雨棚）→ 楼梯通道 → 站厅 y=-6（安检 z=-12、闸机 z=-2、楼梯+扶梯口）→ 岛式站台 y=-12（屏蔽门、两侧轨道、隧道口）。
 *   公园前额外有 2 号线站台（y=-22，z=44）和换乘通道（含会自己拼起来的桥）。
 * 所有站台都沿 x 轴：+x = 站号递增方向（1 号线往广州东站，2 号线往嘉禾望岗）。
 * 视觉参照广州地铁 1/2 号线：米白搪瓷钢板墙面、铝扣板吊顶 + 长条灯带、芝麻白花岗岩地面 + 黄色盲道、
 * 3m 全高屏蔽门（门头线路色灯带 + 线路色门号）、深灰底白字导向牌（出口信息黄色）、架空接触网。
 */
import { Kit, SIGN } from './kit.js';
import { hex, mix, mul, Geo } from '../core/geo.js';
import { colorMat } from '../core/mats.js';
import { LINES, STATIONS, OTHER_LINES, transfersAt, nextStation } from '../data/lines.js';
import { DOOR_XS } from './train.js';
import * as D from './decor.js';
import * as MV from './mv.js';
import { flatBand, stairBand, bridgeStripe } from './wayfind.js';
import { Crowd, randomLook, preseed, archetypeLook } from './people.js';
import { FONT, FONT_EN, roundRect } from './kit.js';
import { drawLineCanvas, networkSVG } from '../ui/netmap.js';
const B = window.BABYLON;

export const YC = -6, HALL_X = 46, TUNNEL_X = 140, TRACK_OFF = 7.6, PSD_OFF = 6, WALL_OFF = 10.6;
export const MAIN = { y: -12, zc: 14 }, GYQ2 = { y: -22, zc: 44 };
export const SPAWN = { x: 0, y: 0, z: -48, yaw: 0 };
/** 售票机位置（站厅，安检和闸机之间） */
export const TVM_XS = [-8.6, -7.4, -6.2], TVM_Z = -6.4;
/** 街面要留空的点：默认出生点、东山口截图取景点（tests/e2e/polish_shots.py 的 10b），半径 1.5 米内不放道具和行人 */
/** 换乘站站口 / 闸机前的提示牌（2 号线没有单独的入口） */
const TRANSFER_HINT = { kind: 'way', zh: '换乘 2号线 请先进站，到 1号线站台换乘', en: 'Line 2: enter here, change at the Line 1 platform', badges: [{ line: 2 }], bar: '#00629B' };
export const STREET_CLEAR = [{ x: SPAWN.x, z: SPAWN.z, r: 1.5 }, { x: -6, z: -56, r: 1.5 }];
// 每站一个很淡的主题色（柱子 / 墙面点缀），整体保持 1 号线车站的米白基调
const THEMES = ['#F1E6D8', '#E3EEE6', '#E4EAF2', '#F2E4E8', '#EAE6F2', '#F5EDD6', '#E0EEEE', '#EFE8DE'];
const FLOOR = hex('#E6E4DF'), WALLC = hex('#F4F2EE'), CEIL = hex('#F2F3F4'), STEEL = hex('#B9C0C8'), DARK = hex('#2F3338'), REVEAL = hex('#585E66');
const LIGHT = hex('#FFF8EC');
const ADS = [
  { zh: '花城广州 · 欢迎你', en: 'Welcome to Guangzhou', c1: '#E8505B', c2: '#F5B841' },
  { zh: '早茶时间到啦', en: 'Morning Dim Sum', c1: '#F28C38', c2: '#F5D76E' },
  { zh: '珠江夜游', en: 'Pearl River Night Cruise', c1: '#1F3B63', c2: '#3E8EDE' },
  { zh: '文明乘车 先下后上', en: 'Let passengers off first', c1: '#2BB3B1', c2: '#42B883' },
  { zh: '广州塔 · 小蛮腰', en: 'Canton Tower', c1: '#8E6CCF', c2: '#EF7AA8' }
];

export function framesFor(code) {
  const s = STATIONS[code];
  return s.lines.length > 1 ? [{ line: 1, ...MAIN }, { line: 2, ...GYQ2 }] : [{ line: s.lines[0], ...MAIN }];
}
export function badge(k) { return { line: k }; }
/** 导向牌上的终点方向：本站往两头开的终点（终点站只剩一头） */
export function termini(line, code) { return Object.values(LINES[line].dirs).filter(d => nextStation(line, code, d.step)).map(d => ({ zh: d.zh, en: d.en })); }
function hashCode(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }

export class Station {
  constructor(scene, code, events, M) {
    this.scene = scene; this.code = code; this.s = STATIONS[code]; this.events = events;
    this.theme = THEMES[hashCode(code) % THEMES.length];
    if (this.s.signature === 'redwall') this.theme = '#F3DCD2';
    D.reseed(hashCode(code)); preseed(hashCode(code) + 3);
    const k = this.kit = new Kit(scene, 'st-' + code);
    this.crowd = new Crowd(scene, k.M, k.root);
    this.platforms = framesFor(code).map(f => ({ ...f, sides: {
      A: { key: 'A', step: 1, trackZ: f.zc - TRACK_OFF, psdZ: f.zc - PSD_OFF, doorSg: 1, n: 1 },
      B: { key: 'B', step: -1, trackZ: f.zc + TRACK_OFF, psdZ: f.zc + PSD_OFF, doorSg: -1, n: 2 } } }));
    this.gates = []; this.mv = []; this.escalators = []; this.psd = []; this.pids = []; this.greeters = [];
    this.street(); this.passage(); this.concourse();
    this.platforms.forEach(p => this.platform(p));
    if (this.platforms.length > 1) this.transfer();
    k.finish();
    this.root = k.root;
  }
  get th() { return hex(this.theme); }
  /** 吊顶灯带：沿 axis 方向的连续灯带 + 两侧暗缝 + 天花上的柔光晕（烘焙） */
  lightStrip(axis, a0, a1, c, y, w = 0.14, haloW = 0.9, haloA = 0.32) {
    const k = this.kit, G = k.glow, P = k.solid, H = k.g('halo'), L = LIGHT;
    if (axis === 'x') {
      G.slab(a0, a1, y - 0.03, y - 0.01, c - w / 2, c + w / 2, L, { ao: false });
      for (const s of [-1, 1]) P.slab(a0, a1, y - 0.025, y - 0.005, c + s * (w / 2 + 0.03) - 0.02, c + s * (w / 2 + 0.03) + 0.02, REVEAL, { ao: false });
      for (const s of [-1, 1]) H.quad([a0, y - 0.006, c + s * w / 2], [a1, y - 0.006, c + s * w / 2], [a1, y - 0.006, c + s * haloW], [a0, y - 0.006, c + s * haloW], null,
        [[1, 0.95, 0.85, haloA], [1, 0.95, 0.85, haloA], [1, 0.95, 0.85, 0], [1, 0.95, 0.85, 0]]);
    } else {
      G.slab(c - w / 2, c + w / 2, y - 0.03, y - 0.01, a0, a1, L, { ao: false });
      for (const s of [-1, 1]) P.slab(c + s * (w / 2 + 0.03) - 0.02, c + s * (w / 2 + 0.03) + 0.02, y - 0.025, y - 0.005, a0, a1, REVEAL, { ao: false });
      for (const s of [-1, 1]) H.quad([c + s * w / 2, y - 0.006, a0], [c + s * w / 2, y - 0.006, a1], [c + s * haloW, y - 0.006, a1], [c + s * haloW, y - 0.006, a0], null,
        [[1, 0.95, 0.85, haloA], [1, 0.95, 0.85, haloA], [1, 0.95, 0.85, 0], [1, 0.95, 0.85, 0]]);
    }
  }
  /** 地面上的“灯带倒影”柔光（反射探针关掉时也有一点亮面感） */
  floorSheen(axis, a0, a1, c, y, w = 0.5, a = 0.06) {
    const H = this.kit.g('halo');
    for (const s of [-1, 1]) {
      if (axis === 'x') H.quad([a0, y + 0.004, c], [a1, y + 0.004, c], [a1, y + 0.004, c + s * w], [a0, y + 0.004, c + s * w], null, [[1, 1, 1, a], [1, 1, 1, a], [1, 1, 1, 0], [1, 1, 1, 0]]);
      else H.quad([c, y + 0.004, a0], [c, y + 0.004, a1], [c + s * w, y + 0.004, a1], [c + s * w, y + 0.004, a0], null, [[1, 1, 1, a], [1, 1, 1, a], [1, 1, 1, 0], [1, 1, 1, 0]]);
    }
  }
  /* ---------------- 街面 ---------------- */
  street() {
    const k = this.kit, s = this.s, sig = s.signature, L1 = s.lines[0], P = k.solid, S = k.shade;
    // 地面：人行道花岗岩铺装（站口楼梯处开洞）
    k.floorWithHoles(-60, 60, -90, 40, -0.8, 0, hex('#D9D6D0'), [[-3.6, 3.6, -36, -26]], true, 'pave');
    // 马路（沥青 + 标线 + 斑马线 + 路缘石）
    k.g('asphalt').slab(-60, 60, 0, 0.012, -78, -64, hex('#9A9CA0'), { ao: false });
    for (let x = -58; x < 60; x += 9) if (Math.abs(x + 2) > 6) P.slab(x, x + 4.5, 0.012, 0.016, -74.6, -74.45, hex('#F2F2F2'), { ao: false }), P.slab(x, x + 4.5, 0.012, 0.016, -67.55, -67.4, hex('#F2F2F2'), { ao: false });
    for (const z of [-71.12, -70.88]) P.slab(-60, 60, 0.012, 0.016, z - 0.06, z + 0.06, hex('#F2C230'), { ao: false });
    for (let z = -77.2; z < -64.5; z += 0.9) P.slab(-3.5, 3.5, 0.013, 0.017, z, z + 0.45, hex('#F4F4F2'), { ao: false });
    for (const zk of [-64, -78]) { P.slab(-60, 60, 0, 0.14, zk - 0.11, zk + 0.11, hex('#BFC2C4'), { ao: false }); }
    // 绿化带（草地 + 路缘）
    const G = k.g('grass');
    for (const sx of [-1, 1]) for (const [z0, z1] of [[-61, -40], [-14, 32]]) {
      const x0 = Math.min(sx * 13, sx * 52), x1 = Math.max(sx * 13, sx * 52);
      G.slab(x0, x1, 0, 0.1, z0, z1, hex('#FFFFFF'), { ao: false });
      P.slab(x0 - 0.12, x1 + 0.12, 0, 0.16, z0 - 0.12, z0, hex('#C9CBCC'), { ao: false }); P.slab(x0 - 0.12, x1 + 0.12, 0, 0.16, z1, z1 + 0.12, hex('#C9CBCC'), { ao: false });
      P.slab(x0 - 0.12, x0, 0, 0.16, z0, z1, hex('#C9CBCC'), { ao: false }); P.slab(x1, x1 + 0.12, 0, 0.16, z0, z1, hex('#C9CBCC'), { ao: false });
    }
    for (const sx of [-1, 1]) D.hedge(k, sx * 13.6, sx * 22, -60.4, -59.4, 0.1, 0.8);
    // 边界
    k.colSlab(-61, -60, 0, 8, -90, 40); k.colSlab(60, 61, 0, 8, -90, 40); k.colSlab(-60, 60, 0, 8, -91, -90); k.colSlab(-60, 60, 0, 8, 40, 41);
    this.entrance();
    // 盲道：街口 → 站口
    k.g('tactile').slab(-0.15 + 2.2, 0.15 + 2.2, 0, 0.012, -62, -38.6, hex('#F2C230'), { ao: false });
    // 路灯、长椅、树、垃圾桶
    for (const x of [-9, 9]) for (const z of [-60, -46, -32, -18]) D.lamp(k, x, 0, z, x < 0 ? Math.PI / 2 : -Math.PI / 2);
    for (let x = -50; x <= 50; x += 14) if (Math.abs(x) > 6) D.lamp(k, x + 3, 0, -62.6, Math.PI);
    // 长椅、垃圾桶：避开出生点和东山口取景点（STREET_CLEAR），左侧长椅从 z=-52 挪到 -44（原位置正对东山口取景视线，和行人穿插）
    const benches = [[-8, -44, Math.PI / 2], [8, -54, -Math.PI / 2]], bins = [[-7.6, -49, Math.PI / 2], [7.6, -57, -Math.PI / 2]];
    for (const [x, z, r] of benches) D.bench(k, x, 0, z, r);
    for (const [x, z, r] of bins) D.bin(k, x, 0, z, r);
    const treeSpots = [];
    for (let x = -52; x <= 52; x += 8) if (Math.abs(x) > 8) treeSpots.push([x + 1.5, -61.8, D.rnd() < 0.2 ? 1 : 0, 0.9]);
    for (let i = 0; i < 18; i++) { const sx = D.rnd() < 0.5 ? -1 : 1; treeSpots.push([sx * (16 + D.rnd() * 32), -10 + D.rnd() * 38]); }
    for (let i = 0; i < 8; i++) { const sx = D.rnd() < 0.5 ? -1 : 1; treeSpots.push([sx * (24 + D.rnd() * 26), -58 + D.rnd() * 16]); }
    // 四周的楼（立面贴图 + 底商）
    const bcol = ['#F1E3D3', '#DCE6EF', '#F3EBD2', '#E2EDDF', '#ECE2F0', '#F0DCDA', '#E9E6E1'];
    const SHOPS = [{ zh: '便利店', en: 'Convenience Store', bg: '#2E8B57' }, { zh: '茶餐厅', en: 'Cha Chaan Teng', bg: '#C0392B' }, { zh: '面包店', en: 'Bakery', bg: '#D98E2B' },
      { zh: '药房', en: 'Pharmacy', bg: '#1F7A8C' }, { zh: '书店', en: 'Bookstore', bg: '#5B4B8A' }, { zh: '肠粉 · 云吞面', en: 'Rice Rolls & Wonton', bg: '#B5651D' }, { zh: '花店', en: 'Florist', bg: '#C74B7A' }];
    const bld = (x, z, w, d, h, c, shop) => { D.building(k, x, z, w, d, h, c, shop); k.col(x, h / 2, z, w, h, d); };
    for (let i = 0; i < 6; i++) bld(-56 + i * 22.4, 34, 18, 9, 12 + (i * 7) % 15, bcol[i], { ...SHOPS[i % SHOPS.length], n: [0, -1] });
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) { const z = -80 + i * 28; if (z > -66 && z < -60) continue; bld(sx * 56, z, 6, 18, 12 + ((i + (sx > 0 ? 2 : 0)) * 5) % 13, bcol[(i + (sx > 0 ? 3 : 0)) % 7], { ...SHOPS[(i + 2 + (sx > 0 ? 3 : 0)) % SHOPS.length], n: [-sx, 0] }); }
    for (let i = 0; i < 5; i++) bld(-48 + i * 24, -86, 18, 6, 15 + (i * 4) % 12, bcol[(i + 2) % 7], { ...SHOPS[(i + 4) % SHOPS.length], n: [0, 1] });
    // 行人
    const C = this.crowd;
    // 站着的行人不与出生点 / 取景点（各留 1.5 米）、长椅、垃圾桶、路灯和彼此穿插：随机位置被占就按固定顺序就近挪开（不额外消耗随机数）
    const blocked = [...STREET_CLEAR.map(c => [c.x, c.z, c.r]), ...benches.map(([x, z]) => [x, z, 1.0]), ...bins.map(([x, z]) => [x, z, 0.45]),
      ...[-60, -46].flatMap(z => [[-9, z, 0.3], [9, z, 0.3]])];
    const free = (x, z) => blocked.every(([bx, bz, r]) => Math.hypot(x - bx, z - bz) >= r + 0.45);
    const NUDGE = [[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2], [1.2, 1.2], [-1.2, 1.2], [1.2, -1.2], [-1.2, -1.2], [2.4, 0], [-2.4, 0], [0, 2.4], [0, -2.4]];
    const stand = (x, z, ry, look, mode) => {
      const [dx, dz] = NUDGE.find(([dx, dz]) => free(x + dx, z + dz)) || [0, 0];
      blocked.push([x + dx, z + dz, 0.7]); return C.add(x + dx, 0, z + dz, ry, look, mode);
    };
    stand(-2.6, -44.5, Math.PI * 0.9, randomLook({}), 'wave');
    for (let i = 0; i < 4; i++) { const x = -11 + D.rnd() * 6 + (i % 2) * 16, z = -58 + D.rnd() * 10, ry = D.rnd() * 6.28; stand(x, z, ry, randomLook({ phone: i % 2 === 0 }), i % 2 === 0 ? 'phone' : 'idle'); }
    C.walker([[-30, -62.7], [30, -62.7]], 0, randomLook({}), 1.3);
    C.walker([[28, -61.4], [-28, -61.4]], 0, randomLook({ bag: 'backpack' }), 1.15);
    // 左侧人行道绕圈的行人：原路线 x=-7.2/-5.5 正好穿过东山口取景点，外移到路灯和草地之间
    C.walker([[-10.3, -40], [-10.3, -58], [-11.7, -58], [-11.7, -40]], 0, randomLook({}), 1.0);
    // 招牌站：地面地标
    const avoid = (x, z) => (sig === 'park' && x > 4 && x < 26 && z > -54 && z < -30) || (sig === 'park' && Math.hypot(x + 24, z + 40) < 7);
    if (sig === 'park') {
      for (let i = 0; i < 14; i++) treeSpots.push([(D.rnd() < 0.5 ? -1 : 1) * (15 + D.rnd() * 10), -24 + D.rnd() * 50]);
      k.g('pave').cyl(-24, 0.3, -40, 7.4, 0.6, hex('#CFC8BC'), 32); P.cyl(-24, 0.55, -40, 6.6, 0.12, hex('#BDB6A8'), 32, 0, 0, 0, undefined, { ao: false });
      k.glass.cyl(-24, 0.62, -40, 6.5, 0.04, hex('#5FB4DA'), 32);
      P.cyl(-24, 0.62, -40, 6.4, 0.02, hex('#3F8FB8'), 32, 0, 0, 0, undefined, { ao: false });
      k.g('pave').cyl(-24, 1.4, -40, 0.9, 1.8, hex('#E3DCCF'), 16); k.g('pave').cyl(-24, 2.35, -40, 2.2, 0.2, hex('#E3DCCF'), 20);
      k.glow.sphere(-24, 2.9, -40, 0.7, hex('#CFEFFF'), 2); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; k.glow.sphere(-24 + Math.cos(a) * 1.4, 1.2 + (i % 2) * 0.3, -40 + Math.sin(a) * 1.4, 0.18, hex('#DFF6FF'), 1); }
      k.col(-24, 0.4, -40, 7, 0.8, 7);
      this.mv.push(MV.penrose(k, new B.Vector3(6, 1.35, -50), 0.95, 15));
    } else if (sig === 'redwall') {
      // 农讲所：红墙黄琉璃瓦的庭院 + 大殿
      const red = '#B4412E', gold = hex('#E0A63A'), gold2 = hex('#C98B26');
      for (const sx of [-1, 1]) {
        k.block(sx * 14, sx * 40, 0, 4.2, -40, -39, red); k.block(sx * 39, sx * 40, 0, 4.2, -40, -16, red);
        for (const [x0, x1, z0, z1] of [[sx * 13.6, sx * 40.4, -40.5, -38.5], [sx * 38.5, sx * 40.5, -40.4, -15.6]]) {
          P.slab(Math.min(x0, x1), Math.max(x0, x1), 4.2, 4.45, z0, z1, gold2, { ao: false });
          const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
          P.box(cx, 4.7, cz, w, 0.12, d * 0.6, gold, 0, 0, 0, 1, { ao: false });
          if (w > d) for (const s2 of [-1, 1]) P.box(cx, 4.55, cz + s2 * d * 0.3, w, 0.1, d * 0.55, gold, 0, s2 * 0.45, 0, 1, { ao: false });
          else for (const s2 of [-1, 1]) P.box(cx + s2 * w * 0.3, 4.55, cz, w * 0.55, 0.1, d, gold, 0, 0, -s2 * 0.45, 1, { ao: false });
        }
        for (let i = 0; i < 4; i++) { const lx = sx * (17 + i * 6); k.glow.ellipsoid(lx, 3.3, -40.75, 0.6, 0.75, 0.6, hex('#FF5C4D'), 2); P.cyl(lx, 3.72, -40.75, 0.3, 0.08, gold, 10); P.cyl(lx, 2.88, -40.75, 0.3, 0.08, gold, 10); P.box(lx, 3.95, -40.75, 0.03, 0.4, 0.03, DARK); }
      }
      k.block(-10, 10, 0, 0.6, -12.5, 2.5, '#D8D2C4', true, 'pave');
      k.block(-9, 9, 0.6, 5.6, -11, 1, red, true);
      for (let i = 0; i < 8; i++) P.cyl(-8.4 + i * 2.4, 3.1, -11.4, 0.42, 5, hex('#9E2E20'), 12);
      P.slab(-11.5, 11.5, 5.6, 5.9, -13.5, 3.5, gold2, { ao: false });
      for (const s2 of [-1, 1]) P.box(0, 6.6, -5 + s2 * 4.3, 23.4, 0.25, 9.6, gold, 0, s2 * 0.42, 0, 1, { ao: false });
      P.box(0, 7.55, -5, 20, 0.35, 0.5, gold2); for (const s2 of [-1, 1]) P.box(s2 * 10, 7.9, -5, 0.6, 0.7, 0.5, gold2);
      k.sign(0, 4.6, -11.47, { kind: 'plain', w: 5.4, h: 1.0, bg: '#5A1810', fg: '#F6D58A', zh: '农民运动讲习所', en: 'Peasant Movement Institute', face: Math.PI, align: 'center' });
    } else if (sig === 'memorial') {
      const Pv = k.g('pave');
      k.block(-6, 6, 0, 1.2, -6, 6, '#E3DED2', true, 'pave'); k.block(-3, 3, 1.2, 2.4, -3, 3, '#DAD4C6', true, 'pave');
      Pv.cyl(0, 10, 0, 2.2, 15.2, hex('#F0ECE4'), 4, Math.PI / 4, 0, 0, 1.2); k.col(0, 9, 0, 2.2, 16, 2.2);
      Pv.cyl(0, 18.2, 0, 1.25, 1.4, hex('#E9E4DA'), 4, Math.PI / 4, 0, 0, 0.05);
      for (let i = 0; i < 10; i++) treeSpots.push([(i % 2 ? -1 : 1) * (12 + (i % 5) * 7), -50 + Math.floor(i / 2) * 9, 1]);
    } else if (sig === 'villa') {
      // 东山口：红砖洋楼（白色窗套、拱窗、阳台、坡屋顶）
      const Br = k.g('brick');
      for (const [x, z] of [[-22, -44], [24, -46], [-26, -20], [26, -22]]) {
        Br.box(x, 4, z, 12, 8, 10, hex('#FFFFFF'), 0, 0, 0, 1, { ao: true }); k.col(x, 4, z, 12, 8, 10);
        P.slab(x - 6.15, x + 6.15, 0, 0.6, z - 5.15, z + 5.15, hex('#D8D2C8'));
        P.slab(x - 6.2, x + 6.2, 3.85, 4.05, z - 5.2, z + 5.2, hex('#F2EEE6'), { ao: false });
        for (let fl = 0; fl < 2; fl++) for (let w = -1; w <= 1; w++) for (const [nz, ox] of [[1, 0], [-1, 0]]) {
          const wx = x + w * 3.6, wy = 2.3 + fl * 3.8, wz = z + nz * 5.02;
          P.box(wx, wy, wz, 1.7, 2.2, 0.1, hex('#F5F1E8'), 0, 0, 0, 1, { ao: false });
          k.glass.box(wx, wy - 0.05, wz + nz * 0.03, 1.2, 1.7, 0.04, hex('#6E90A8'));
          P.box(wx, wy - 0.05, wz + nz * 0.02, 1.2, 1.7, 0.02, hex('#3C4E5C'), 0, 0, 0, 1, { ao: false });
          P.box(wx, wy, wz + nz * 0.05, 0.06, 1.7, 0.03, hex('#F5F1E8'), 0, 0, 0, 1, { ao: false });
          P.cyl(wx, wy + 1.05, wz, 1.7, 0.1, hex('#F5F1E8'), 12, 0, Math.PI / 2, 0, undefined, { ao: false });
          if (fl === 1 && w === 0 && nz === -1) { P.slab(wx - 1.6, wx + 1.6, wy - 1.25, wy - 1.1, wz - 1.1, wz, hex('#F2EEE6'), { ao: false }); for (let b = 0; b < 9; b++) P.cyl(wx - 1.5 + b * 0.375, wy - 0.8, wz - 1.0, 0.08, 0.6, hex('#F5F1E8'), 6); P.slab(wx - 1.6, wx + 1.6, wy - 0.5, wy - 0.42, wz - 1.1, wz - 0.95, hex('#F2EEE6'), { ao: false }); }
        }
        const rf = hex('#9C3B28');
        for (const s2 of [-1, 1]) P.box(x, 9.3, z + s2 * 2.75, 13.2, 0.22, 6.4, rf, 0, s2 * 0.5, 0, 1, { ao: false });
        P.box(x, 10.55, z, 13.3, 0.25, 0.4, hex('#7E2E1E'), 0, 0, 0, 1, { ao: false });
        for (const sx of [-1, 1]) Br.box(x + sx * 6, 9.2, z, 0.25, 2.4, 9.4, hex('#FFFFFF'), 0, 0, 0, 1, { ao: false });
        P.slab(x - 6.3, x + 6.3, 7.9, 8.15, z - 5.3, z + 5.3, hex('#F2EEE6'), { ao: false });
        P.box(x + 3.8, 11.0, z - 1.5, 0.9, 1.6, 0.9, hex('#A8452F'));
      }
    } else if (sig === 'railway') {
      const F = k.g('facade');
      k.block(-30, 30, 0, 9, 4, 14, '#E8E1D3', true, 'facade'); P.slab(-31, 31, 9, 9.6, 3, 15, hex('#C9D6E3'));
      k.block(-4, 4, 9.6, 22, 6, 12, '#E8E1D3', true, 'facade'); void F;
      P.cyl(0, 17.5, 5.92, 4.8, 0.14, hex('#2A2D31'), 32, 0, Math.PI / 2, 0); k.glow.cyl(0, 17.5, 5.86, 4.4, 0.04, hex('#FFFFFF'), 32, 0, Math.PI / 2, 0);
      P.box(0, 18.3, 5.82, 0.22, 1.7, 0.06, hex('#24324A'), 0, 0, 0, 1, { ao: false }); P.box(0.6, 17.5, 5.82, 1.3, 0.2, 0.06, hex('#24324A'), 0, 0, 0, 1, { ao: false });
      k.sign(0, 7.2, 3.94, { kind: 'plain', w: 10, h: 1.6, bg: '#B3261E', fg: '#FFFFFF', zh: '广州站', en: 'Guangzhou Railway Station', face: Math.PI, align: 'center' });
    } else if (sig === 'rams') {
      k.g('grass').sphere(-26, -2, -36, 22, hex('#FFFFFF'), 3, 0.45); k.col(-26, 1.5, -36, 14, 5, 14);
      for (let i = 0; i < 5; i++) { const a = i * 1.256, x = -26 + Math.cos(a) * 2.2, z = -36 + Math.sin(a) * 2.2; goat(P, x, 5.1 + (i === 0 ? 1 : 0), z, a + Math.PI / 2, i === 0 ? 1.4 : 1); }
      k.g('pave').cyl(-26, 5.4, -36, 1.6, 2, hex('#E2D3B8'), 16);
    }
    for (const [x, z, kind, sc] of treeSpots) if (!avoid(x, z) && !(Math.abs(x) < 12 && z > -42 && z < -20)) { D.tree(k, x, 0, z, (sc || 0.85) + D.rnd() * 0.35, kind ?? (D.rnd() < 0.2 ? 2 : D.rnd() < 0.3 ? 1 : 0)); k.col(x, 1, z, 0.45, 2, 0.45); }
  }
  /** 站口：钢结构玻璃雨棚 + 深灰门楣站名牌 + 立柱式站名标 */
  entrance() {
    const k = this.kit, s = this.s, P = k.solid, L1 = s.lines[0], frame = hex('#3A3F45');
    // 碰撞（与旧版一致）
    k.colSlab(-4.7, -3.6, 0, 3.6, -37.5, -26); k.colSlab(3.6, 4.7, 0, 3.6, -37.5, -26); k.colSlab(-4.7, 4.7, 0, 3.6, -26.2, -25.8);
    for (const sx of [-1, 1]) {
      const x0 = Math.min(sx * 3.6, sx * 4.7), x1 = Math.max(sx * 3.6, sx * 4.7);
      k.g('wall').slab(x0, x1, 0, 0.95, -37.5, -26, hex('#D9DADB'));       // 石材矮墙
      P.slab(x0 - 0.02, x1 + 0.02, 0.95, 1.02, -37.52, -25.98, frame, { ao: false });
      k.glass.slab((x0 + x1) / 2 - 0.02, (x0 + x1) / 2 + 0.02, 1.02, 3.55, -37.5, -26, hex('#CFE6F2'));
      for (let z = -37.5; z <= -25.9; z += 1.45) P.slab((x0 + x1) / 2 - 0.05, (x0 + x1) / 2 + 0.05, 1.0, 3.6, z - 0.05, z + 0.05, frame, { ao: false });
      P.slab((x0 + x1) / 2 - 0.08, (x0 + x1) / 2 + 0.08, 0, 3.7, -37.6, -37.4, frame);
    }
    k.g('wall').slab(-4.7, 4.7, 0, 3.6, -26.2, -25.8, hex('#E7E6E3'));
    // 顶棚：深色铝板檐口 + 玻璃顶
    P.slab(-5.3, 5.3, 3.6, 3.75, -38.4, -25.4, frame, { ao: false });
    P.slab(-5.3, 5.3, 3.75, 4.25, -38.5, -38.3, frame, { ao: false });
    k.glass.slab(-5.0, 5.0, 3.78, 3.82, -38.2, -25.6, hex('#BFDCEB'));
    for (let x = -4.5; x <= 4.6; x += 1.5) P.slab(x - 0.04, x + 0.04, 3.75, 3.9, -38.3, -25.5, frame, { ao: false });
    P.slab(-5.3, 5.3, 3.4, 3.6, -38.5, -38.2, hex(LINES[L1].color), { ao: false });          // 线路色檐口条
    k.glow.slab(-3.4, 3.4, 3.38, 3.4, -37.9, -26.5, LIGHT, { ao: false });
    const lines = s.lines.map(badge), exits = ['D'];
    k.sign(0, 4.85, -38.52, { kind: 'entrance', w: 9.4, h: 1.15, zh: s.zh + '站', en: s.en + ' Station', badges: lines, exits, face: Math.PI });
    // 站口导向牌（升级：大箭头 + 线路色块 + 大字，走到站口就看得到）
    k.sign(0, 2.95, -37.6, { kind: 'way', w: 4.6, h: 0.85, zh: '进站', en: 'Entrance', arrow: 'down', badges: lines, face: Math.PI, hang: 3.6 });
    // 换乘站：2 号线没有单独的站口——挂在“进站”牌下面，免得在街上找 2 号线的入口
    // 字号接近上面“进站”牌（h 0.8 → 中文约 0.37m，“进站”0.39m）：不画箭头（上面的“进站”已有向下箭头），省出宽度给大字；宽 7.6m 刚好在雨棚两根立柱之间
    if (this.platforms.length > 1) k.sign(0, 2.07, -37.62, { ...TRANSFER_HINT, w: 7.6, h: 0.8, face: Math.PI, hang: 3.6 });
    // 立柱式站名标（站口旁）
    const tx = 6.4, tz = -39.5;
    P.rbox(tx, 0, tz, 0.9, 4.4, 0.32, hex('#2A2D31'), 0.06, 0, { bevel: 0.02 });
    P.rbox(tx, 3.55, tz, 0.92, 0.85, 0.34, hex('#D52B1E'), 0.06, 0, { ao: false });
    k.sign(tx, 3.97, tz - 0.172, { kind: 'plain', w: 0.84, h: 0.8, bg: '#D52B1E', fg: '#FFFFFF', zh: '地铁', en: 'METRO', face: Math.PI, align: 'center', box: false });
    k.sign(tx, 2.25, tz - 0.165, { kind: 'plain', w: 0.82, h: 2.2, bg: '#2A2D31', fg: '#FFFFFF', zh: s.zh.length > 4 ? s.zh.slice(0, 4) : s.zh, face: Math.PI, align: 'center', box: false, vert: true });
    for (let i = 0; i < s.lines.length; i++) k.sign(tx - 0.2 + i * 0.4, 0.95, tz - 0.165, { kind: 'plain', w: 0.34, h: 0.34, bg: LINES[s.lines[i]].color, fg: LINES[s.lines[i]].ink, zh: String(s.lines[i]), face: Math.PI, align: 'center', box: false });
    k.col(tx, 2.2, tz, 0.9, 4.4, 0.32);
    k.shade.shadeBlob(tx, tz, 0.9, 0.5, 0.01, 0.3);
    k.shade.shadeStrip(-4.7, -37.5, -4.7, -26, 0.01, -1, 0, 0.7, 0.25); k.shade.shadeStrip(4.7, -37.5, 4.7, -26, 0.01, 1, 0, 0.7, 0.25);
    // 招牌站的站口点缀
    const sig = s.signature;
    if (sig === 'redwall') {
      // 农讲所：岭南风格——朱红立柱、黄琉璃瓦小坡顶、檐下彩绘梁
      const red = hex('#A8321F'), gold = hex('#E0A63A'), gold2 = hex('#C98B26');
      for (const sx of [-1, 1]) for (const z of [-38.2, -32, -26]) { k.col(sx * 5.0, 2.1, z, 0.36, 4.2, 0.36); P.cyl(sx * 5.0, 2.1, z, 0.34, 4.2, red, 12); P.cyl(sx * 5.0, 0.12, z, 0.5, 0.24, hex('#CFC6B4'), 12); }
      // 小坡顶放在站名牌之上（不遮挡站名）
      for (const sx of [-1, 1]) for (const z of [-38.2, -26]) P.cyl(sx * 5.0, 4.95, z, 0.3, 1.3, red, 12);
      P.slab(-5.6, 5.6, 5.6, 5.8, -38.9, -25.2, gold2, { ao: false });
      for (const s2 of [-1, 1]) P.box(0, 6.25, -32 + s2 * 3.6, 12.2, 0.16, 7.8, gold, 0, s2 * 0.32, 0, 1, { ao: false });
      P.box(0, 6.85, -32, 11, 0.3, 0.4, gold2, 0, 0, 0, 1, { ao: false }); for (const sx of [-1, 1]) P.box(sx * 5.5, 7.1, -32, 0.4, 0.55, 0.4, gold2, 0, 0, sx * 0.3, 1, { ao: false });
      P.slab(-5.6, 5.6, 3.96, 4.25, -38.85, -38.55, hex('#1F5C4A'), { ao: false }); // 檐下青绿彩绘梁
      for (let i = 0; i < 7; i++) P.slab(-4.8 + i * 1.6 - 0.25, -4.8 + i * 1.6 + 0.25, 4.02, 4.2, -38.87, -38.85, gold, { ao: false });
    } else if (sig === 'villa') {
      // 东山口：红砖矮墙 + 白色窗套式门框 + 拱形门楣
      const Br = k.g('brick');
      for (const sx of [-1, 1]) Br.slab(Math.min(sx * 3.58, sx * 4.72), Math.max(sx * 3.58, sx * 4.72), 0, 0.97, -37.52, -25.98, hex('#FFFFFF'));
      Br.slab(-5.3, 5.3, 4.25, 5.6, -38.7, -38.5, hex('#FFFFFF'));
      P.cyl(0, 5.6, -38.62, 4.2, 0.24, hex('#F5F1E8'), 24, 0, Math.PI / 2, 0, undefined, { ao: false });
      P.slab(-5.4, 5.4, 5.55, 5.7, -38.8, -38.4, hex('#F5F1E8'), { ao: false });
      for (const sx of [-1, 1]) { Br.box(sx * 5.6, 2.4, -38.4, 0.6, 4.8, 0.6, hex('#FFFFFF')); P.box(sx * 5.6, 4.9, -38.4, 0.75, 0.2, 0.75, hex('#F5F1E8'), 0, 0, 0, 1, { ao: false }); }
    }
  }
  /* ---------------- 通道楼梯 ---------------- */
  passage() {
    const k = this.kit, W = k.g('wall');
    k.stairs('z', -36, 0, -20, YC, -3.5, 3.5, YC - 0.5, hex('#DCDAD5'), { rails: false });
    for (const sx of [-1, 1]) {
      W.slab(Math.min(sx * 3.5, sx * 3.75), Math.max(sx * 3.5, sx * 3.75), YC - 0.4, 3.6, -37, -26, WALLC); k.colSlab(Math.min(sx * 3.5, sx * 3.75), Math.max(sx * 3.5, sx * 3.75), YC - 0.4, 3.6, -37, -26);
      W.slab(Math.min(sx * 3.5, sx * 3.75), Math.max(sx * 3.5, sx * 3.75), YC - 0.4, -0.8, -26, -20, WALLC); k.colSlab(Math.min(sx * 3.5, sx * 3.75), Math.max(sx * 3.5, sx * 3.75), YC - 0.4, -0.8, -26, -20);
      // 墙上扶手（不锈钢）
      k.metal.tube([sx * 3.4, 0.9, -36], [sx * 3.4, YC + 0.9, -20], 0.05, STEEL);
      k.solid.box(sx * 3.49, (YC) / 2 + 0.25, -28, 0.02, 0.1, 17.1, hex(LINES[this.s.lines[0]].color), 0, Math.atan2(6, 16), 0, 1, { ao: false });
    }
    k.g('ceiling').slab(-3.5, 3.5, -1.05, -0.95, -26, -20, CEIL, { ao: false });
    this.lightStrip('z', -25.8, -20.2, 0, -0.95, 0.14, 0.8, 0.28);
    k.sign(0, -1.55, -25.6, { kind: 'dir', w: 3.6, h: 0.5, zh: '往站厅 · 乘车', en: 'To Concourse', arrow: 'down', badges: this.s.lines.map(badge), face: Math.PI, hang: -1.0 });
  }
  /* ---------------- 站厅 ---------------- */
  concourse() {
    const k = this.kit, s = this.s, y = YC, L = this.s.lines, lc = LINES[L[0]].color, th = this.th, sig = s.signature, P = k.solid, W = k.g('wall'), S = k.shade;
    const CY = y + 4.4; // 吊顶高度
    k.floorWithHoles(-18, 18, -20, 26, y - 1.2, y, FLOOR, [[-1, 15, 10, 18]], true, 'floor');
    // 墙：搪瓷钢板 + 不锈钢踢脚 + 线路色腰线
    const wall = (x0, x1, z0, z1) => { k.block(x0, x1, y, CY, z0, z1, mix(WALLC, th, 0.35), true, 'wall', { aoTop: true }); };
    wall(-18.3, -18, -20, 26); wall(18, 18.3, -20, 26); wall(-18, 18, 26, 26.3); wall(-18, -3.75, -20.3, -20); wall(3.75, 18, -20.3, -20);
    k.colSlab(-18.3, -18, CY, -0.8, -20, 26); k.colSlab(18, 18.3, CY, -0.8, -20, 26);
    for (const sx of [-1, 1]) { k.metal.slab(sx * 17.99, sx * 17.95, y, y + 0.15, -20, 26, STEEL, { ao: false }); P.slab(sx * 17.99, sx * 17.95, y + 2.5, y + 2.62, -20, 26, hex(lc), { ao: false }); P.slab(sx * 17.99, sx * 17.94, y + 3.75, y + 4.2, -20, 26, hex(lc), { ao: false }); }
    k.metal.slab(-18, 18, y, y + 0.15, 25.95, 25.99, STEEL, { ao: false }); P.slab(-18, 18, y + 2.5, y + 2.62, 25.95, 25.99, hex(lc), { ao: false }); P.slab(-18, 18, y + 3.75, y + 4.2, 25.94, 25.99, hex(lc), { ao: false });
    S.shadeRoom(-18, 18, -20, 26, y + 0.004, 0.8, 0.26);
    // 吊顶（铝扣板）+ 长条灯带（沿 z 方向，间距 4.5m）
    k.g('ceiling').slab(-18, 18, CY, CY + 0.08, -20, 26, CEIL, { ao: false });
    k.colSlab(-18, 18, CY, CY + 0.3, -20, 26);
    for (const x of [-13.5, -9, -4.5, 0, 4.5, 9, 13.5]) { this.lightStrip('z', -19.6, 25.6, x, CY, 0.14, 0.9, 0.3); this.floorSheen('z', -19.6, 25.6, x, y, 0.35, 0.05); }
    // 吊顶与墙交接处的暗缝 + 墙顶洗墙灯
    for (const sx of [-1, 1]) k.glow.slab(sx * 17.9, sx * 17.86, CY - 0.06, CY - 0.02, -19.8, 25.8, mul(LIGHT, 0.85), { ao: false });
    // 柱子：圆柱搪瓷板包覆 + 不锈钢柱脚
    for (const [x, z] of [[-10, -16], [10, -16], [-10, -7], [-12, 5], [12, 5], [-12, 20], [8, 22], [-6, 22]]) {
      W.cyl(x, (y + CY) / 2, z, 0.9, CY - y, mix(WALLC, th, 0.6), 24, 0, 0, 0, undefined, { aoTop: true });
      k.metal.cyl(x, y + 0.08, z, 0.96, 0.16, STEEL, 24, 0, 0, 0, undefined, { ao: false });
      P.cyl(x, y + 2.56, z, 0.92, 0.34, hex(lc), 24, 0, 0, 0, undefined, { ao: false });
      S.shadeRing(x, z, 0.48, 1.1, y + 0.004, 0.3);
      k.col(x, y + 2.6, z, 0.9, 5.2, 0.9);
    }
    D.cctv(k, -9.6, CY, -15.6, 0.8); D.cctv(k, 9.6, CY, -15.6, -0.8); D.cctv(k, 0, CY, 9.4, Math.PI); D.cctv(k, -11.6, CY, 5.4, 2.5);
    // 售票机 + 客服中心
    // 自动售票机：安检之后、闸机之前一排 3 台，正面朝安检方向（走过来就能看到屏幕）
    this.tvms = TVM_XS.map(x => { const scr = D.ticketMachine(k, x, y, TVM_Z); k.col(x, y + 0.95, TVM_Z, 0.92, 1.9, 0.6); return { x, z: TVM_Z, y, front: { x, z: TVM_Z - 0.95 }, scr }; });
    k.sign((TVM_XS[0] + TVM_XS[2]) / 2, y + 3.2, TVM_Z - 0.1, { kind: 'dir', w: 3.8, h: 0.55, zh: '自动售票', en: 'Ticket Machines', face: Math.PI, hang: CY });
    this.tvmScreensBuild();
    k.block(12, 17.9, y, y + 1.05, -9, -5, '#ECEAE6', true, 'wall'); k.metal.slab(12, 17.9, y + 1.05, y + 1.1, -9.05, -4.9, STEEL, { ao: false });
    k.glass.slab(12, 17.9, y + 1.1, y + 2.5, -5.03, -4.97, hex('#D6ECF7'));
    for (let x = 12; x <= 17.95; x += 1.45) k.metal.slab(x - 0.03, x + 0.03, y + 1.1, y + 2.5, -5.06, -4.94, STEEL, { ao: false });
    P.slab(12, 17.9, y + 2.5, y + 2.95, -9, -4.9, hex('#2A2D31'), { ao: false });
    k.glow.slab(12, 17.9, y + 2.5, y + 2.53, -9, -4.88, hex(lc), { ao: false });
    // 客服中心的工作人员（问路）：站在柜台后面，玩家站到柜台前（askPoint）出现「问路」
    this.staff = this.crowd.add(15, y, -7, 0, randomLook({ uniform: { top: '#2A4F8A', bottom: '#1F2A3A', stripe: '#D52B1E' } }), 'idle');
    this.askPoint = { x: 15, y, z: -4.2 }; this.gatePoint = { x: 0, z: -2 }; this.stairPoint = { x: 0, z: 14 }; this.gateZ = -2;
    k.sign(15, y + 2.72, -4.86, { kind: 'dir', w: 4.6, h: 0.4, zh: '客服中心', en: 'Customer Service', face: 0, box: false });
    // 客服中心前排队的乘客（让出柜台正中给玩家问路）
    this.crowd.add(13.0, y, -4.25, Math.PI - 0.3, randomLook({ bag: 'shoulder' }), 'idle'); this.crowd.add(17.0, y, -3.9, Math.PI + 0.2, randomLook({ kid: true, scale: 0.95 }), 'idle'); this.crowd.add(12.0, y, -3.0, Math.PI - 0.5, randomLook({ phone: true }), 'phone');
    // —— 安检（z=-12）
    const zs = -12;
    k.rail(-18, zs, -4.7, zs, y); k.rail(-1.5, zs, -1.25, zs, y); k.rail(1.25, zs, 9, zs, y); k.rail(12, zs, 18, zs, y);
    // X 光机：机身 + 通道 + 铅帘 + 滚筒传送带
    const xr0 = -4.6, xr1 = -1.6, xc = (xr0 + xr1) / 2;
    k.col(xc, y + 0.375, zs, 3, 0.75, 5.2); k.col(xc, y + 1.375, zs, 2.6, 1.25, 2.2);
    P.rbox(xc, y, zs - 1.85, 2.9, 0.78, 1.5, hex('#C3CBD3'), 0.05, 0, { bevel: 0.02 }); P.rbox(xc, y, zs + 1.85, 2.9, 0.78, 1.5, hex('#C3CBD3'), 0.05, 0, { bevel: 0.02 });
    P.rbox(xc, y, zs, 2.7, 2.05, 2.2, hex('#E3E8EC'), 0.18, 0, { bevel: 0.06 });
    P.slab(xc - 0.75, xc + 0.75, y + 0.78, y + 1.5, zs - 1.12, zs + 1.12, hex('#30353B'), { ao: false });
    for (let i = 0; i < 9; i++) for (const zz of [zs - 1.13, zs + 1.13]) P.slab(xc - 0.72 + i * 0.16, xc - 0.58 + i * 0.16, y + 0.8, y + 1.48, zz - 0.01, zz + 0.01, hex('#4A3E36'), { ao: false });
    P.slab(xc - 0.75, xc + 0.75, y + 0.78, y + 0.8, zs - 2.6, zs + 2.6, hex('#2B2E33'), { ao: false });
    for (let z = zs - 2.5; z < zs + 2.6; z += 0.3) k.metal.cyl(xc, y + 0.79, z, 0.05, 1.45, STEEL, 6, 0, 0, Math.PI / 2, undefined, { ao: false });
    P.slab(xc - 1.38, xc + 1.38, y + 1.6, y + 1.75, zs - 1.0, zs + 1.0, hex(lc), { ao: false });
    k.glow.slab(xc - 0.4, xc + 0.4, y + 1.85, y + 1.9, zs - 1.12, zs - 1.1, hex('#3DDC84'), { ao: false });
    S.shadeBlob(xc, zs, 2.0, 3.1, y + 0.004, 0.3);
    // 判图台
    P.rbox(-5.8, y, zs + 1.9, 1.5, 0.8, 1.3, hex('#8E99A6'), 0.05, 0, { bevel: 0.02 });
    P.box(-5.8, y + 1.15, zs + 1.75, 0.7, 0.45, 0.06, hex('#1E2328'), 0, -0.25, 0, 1, { ao: false });
    k.glow.box(-5.8, y + 1.15, zs + 1.71, 0.6, 0.36, 0.01, hex('#7FB8E8'), 0, -0.25, 0);
    k.col(-5.8, y + 0.42, zs + 1.9, 1.5, 0.85, 1.4);
    this.crowd.add(-5.8, y, zs + 3.1, Math.PI, randomLook({ uniform: { top: '#24456E', bottom: '#1F2A3A', cap: '#24456E', stripe: '#E8C547' } }), 'idle');
    // 安检门（金属探测门）
    for (const sx of [-1, 1]) { P.rbox(sx * 1.07, y, zs, 0.34, 2.3, 0.7, hex('#E6EAEE'), 0.06, 0, { bevel: 0.02 }); k.glow.slab(sx * 1.07 - 0.02 - (sx > 0 ? 0.15 : -0.13), sx * 1.07 + 0.02 - (sx > 0 ? 0.15 : -0.13), y + 0.4, y + 2.0, zs - 0.3, zs - 0.26, hex('#9FD3FF'), { ao: false }); }
    k.col(-1.07, y + 1.15, zs, 0.35, 2.3, 0.7); k.col(1.07, y + 1.15, zs, 0.35, 2.3, 0.7);
    P.rbox(0, y + 2.3, zs, 2.5, 0.32, 0.72, hex('#E6EAEE'), 0.06, 0, { ao: false, bevel: 0.03 });
    const archLightMat = colorMat(this.scene, '#88A0B8', { glow: true }).clone('archLight');
    const archLight = B.MeshBuilder.CreateBox('archLight', { width: 1.6, height: 0.1, depth: 0.04 }, this.scene); archLight.material = archLightMat; archLight.parent = k.root; archLight.position.set(0, y + 2.46, zs - 0.37);
    this.crowd.add(2.4, y, zs + 1.4, -Math.PI / 2 - 0.4, randomLook({ uniform: { top: '#24456E', bottom: '#1F2A3A', cap: '#24456E', stripe: '#E8C547' } }), 'wave');
    k.sign(0, y + 3.5, zs - 0.4, { kind: 'dir', w: 5.2, h: 0.6, zh: '安全检查', en: 'Security Check', face: Math.PI, double: true, back: { kind: 'exit', exits: ['A', 'D'] }, hang: CY });
    k.sign(10.5, y + 3.3, zs - 0.1, { kind: 'exit', w: 3.4, h: 0.55, arrow: 'up', exits: ['D'], face: 0, hang: CY });
    for (const z of [-17, -15]) arrow(k, 0, y + 0.006, z, 0, '#F2C230');
    // 行李（X 光机传送带）
    const bags = [0, 1, 2].map(i => {
      const g = new Geo(); g.rbox(0, -0.17, 0, 0.62, 0.34, 0.44, ['#E76F51', '#2A9D8F', '#F4A261'][i], 0.08, 0, { ao: false, bevel: 0.04, bottom: true }); g.tube([-0.15, 0.17, 0], [0.15, 0.17, 0], 0.04, '#2B2D31', 6);
      const b = g.toMesh('bag', this.scene, k.M.paint, k.root); b.position.set(xc, y + 0.98, zs - 2.4 + i * 1.7); return b;
    });
    this.security = { z: zs, y, light: archLightMat, bags, cool: 0, flash: 0, belt: 0 };
    // —— 闸机（z=-2）：不锈钢机柜 + 深色顶板 + 读卡区 + 通行指示
    const zg = -2, lanes = [-4, -2, 0, 2, 4];
    k.rail(-18, zg, -5.45, zg, y); k.rail(5.45, zg, 18, zg, y);
    for (const cx of [-5, -3, -1, 1, 3, 5]) {
      k.metal.rbox(cx, y, zg, 0.3, 1.0, 1.85, STEEL, 0.08, 0, { bevel: 0.02 }); k.colSlab(cx - 0.45, cx + 0.45, y, y + 1.0, zg - 0.9, zg + 0.9);
      P.rbox(cx, y + 1.0, zg, 0.34, 0.05, 1.9, hex('#2A2D31'), 0.09, 0, { ao: false });
      k.glow.slab(cx - 0.09, cx + 0.09, y + 1.05, y + 1.056, zg - 0.75, zg - 0.45, hex('#4FA3FF'), { ao: false });
      k.glow.slab(cx - 0.05, cx + 0.05, y + 1.05, y + 1.056, zg - 0.3, zg - 0.18, hex('#FFC72C'), { ao: false });
      for (const e of [-1, 1]) { P.box(cx, y + 0.85, zg + e * 0.93, 0.22, 0.18, 0.02, hex('#1E2328'), 0, 0, 0, 1, { ao: false }); k.glow.box(cx, y + 0.85, zg + e * 0.942, 0.12, 0.1, 0.005, hex(e < 0 ? '#3DDC84' : '#FF5A4E')); }
      S.shadeBlob(cx, zg, 0.45, 1.2, y + 0.004, 0.28);
    }
    const flapG = new Geo(); flapG.rbox(0, -0.3, 0, 0.5, 0.6, 0.03, hex('#E9EEF2'), 0.12, 0, { ao: false, bottom: true }); flapG.box(-0.03, 0.0, 0, 0.44, 0.04, 0.035, hex('#D52B1E'), 0, 0, 0, 1, { ao: false });
    const flapSrc = flapG.toMesh('flap', this.scene, k.M.paint, k.root); flapSrc.isVisible = false;
    for (const lx of lanes) {
      const flaps = [-1, 1].map(sd => { const pv = new B.TransformNode('fp', this.scene); pv.parent = k.root; pv.position.set(lx + sd * 0.55, y + 0.75, zg); const f = flapSrc.createInstance('flap'); f.parent = pv; f.position.x = -sd * 0.25; f.rotation.y = 0; return { pv, sd }; });
      const col = k.col(lx, y + 0.8, zg, 1.1, 1.6, 0.25, { dynamic: false });
      this.gates.push({ x: lx, z: zg, y, f: 0, open: false, flaps, col, t: 0 });
    }
    this.gateScreensBuild(zg, y);
    k.sign(0, y + 3.55, zg - 0.5, { kind: 'dir', w: 6, h: 0.62, zh: '进站', en: 'Entrance', badges: L.map(badge), face: Math.PI, double: true, back: { kind: 'exit', zh: '出站', en: 'Exit' }, hang: CY });
    // 换乘站：闸机正上方“进站”牌下面再挂一块——2 号线也从这里进，到 1 号线站台换乘
    if (this.platforms.length > 1) k.sign(0, y + 2.76, zg - 0.56, { ...TRANSFER_HINT, w: 7.8, h: 0.72, arrow: 'up', face: Math.PI, hang: CY });
    for (const z of [-8.5, -5.5]) arrow(k, 0, y + 0.006, z, 0, '#F2C230');
    // 刚过闸机：往站台（线路色块 + 两头终点），背面是出站
    k.sign(0, y + 3.35, 2.6, { kind: 'way', w: 8.2, h: 0.9, zh: '站台', en: 'Platforms', arrow: 'up', badges: L.map(badge), dirs: termini(L[0], this.code), face: Math.PI, double: true, back: { kind: 'exit', arrow: 'up', zh: '出站', en: 'Exit', exits: ['A', 'D'] }, hang: CY });
    // 盲道：通道口 → 闸机 → 楼梯口
    const T = k.g('tactile'), ty = y + 0.003, tc = hex('#F2C230');
    T.slab(5.85, 6.15, ty, ty + 0.006, -19.8, -12.6, tc, { ao: false }); T.slab(5.85, 6.15, ty, ty + 0.006, -11.4, -3.2, tc, { ao: false });
    T.slab(5.85, 6.15, ty, ty + 0.006, -0.8, 8.6, tc, { ao: false }); T.slab(-2.4, 6.15, ty, ty + 0.006, 8.3, 8.6, tc, { ao: false });
    // —— 去站台的楼梯 + 两部扶梯（洞 x∈[-1,15], z∈[10,18]）
    k.stairs('x', -1, y, 15, MAIN.y, 10, 18, MAIN.y, FLOOR, { rails: false, visual: [12.2, 15.8] });
    this.stairVisual(-1, y, 15, MAIN.y, 12.2, 15.8);
    const ang = Math.atan2(MAIN.y - y, 16), len = Math.hypot(16, y - MAIN.y);
    for (const [z0, z1, dir] of [[10.15, 11.65, -1], [16.35, 17.85, 1]]) {
      const zc = (z0 + z1) / 2;
      this.escalatorBody(-1, y, 15, MAIN.y, z0, z1);
      this.escalators.push({ x0: -1, y0: y, x1: 15, y1: MAIN.y, z0, z1, dir, steps: this.escSteps(zc, z1 - z0, ang, len, -1, y), off: 0 });
    }
    k.rail(-1, 9.85, 15, 9.85, y); k.rail(-1, 18.15, 15, 18.15, y); k.rail(15, 9.85, 15, 18.15, y);
    const destTxt = L.map(l => LINES[l].zh).join(' · ');
    // 下站台的楼梯 / 扶梯口：箭头往下 + 本线色块 + 两头终点
    k.sign(-1.6, y + 3.35, 14, { kind: 'way', w: 7.6, h: 0.9, zh: '站台', en: 'Platforms', badges: [badge(L[0])], arrow: 'down', dirs: termini(L[0], this.code), face: -Math.PI / 2, double: true, back: { kind: 'exit', arrow: 'up', exits: ['A', 'D'] }, hang: CY });
    void destTxt;
    for (const [x, z, a] of [[-4, 2], [-4, 5.5], [-4, 9], [-3, 13.2, Math.PI / 2]]) arrow(k, x, y + 0.006, z, a || 0, '#F2C230');
    // 乘客（站着 / 看手机 / 走动）
    for (let i = 0; i < 3; i++) this.crowd.add(-15 + i * 3.4, y, 6 + D.rnd() * 12, D.rnd() * 6.28, randomLook({ phone: i === 1 }), i === 1 ? 'phone' : 'idle');
    this.crowd.walker([[-14, -19], [-6, -19], [-6, -14.5], [-14, -14.5]], y, randomLook({ bag: 'shoulder' }), 1.2);
    this.crowd.walker([[5, -10.5], [10, -10.5], [10, -4], [5, -4]], y, randomLook({}), 1.1);
    this.crowd.walker([[-15, 3], [-15, 22], [-8, 22], [-8, 3]], y, randomLook({ bag: 'backpack' }), 1.3);
    D.bin(k, 16.8, y, 24.6, Math.PI); D.bin(k, -16.8, y, -10, Math.PI / 2);
    // 四种可以打招呼的路人：非付费区（阿婆、上班族）+ 付费区（学生、游客）
    for (const [kind, x, z, ry, mode] of [['granny', -13, -7.5, Math.PI / 2 + 0.3, 'idle'], ['office', 4.6, -7.2, -Math.PI * 0.8, 'idle'], ['student', -7.5, 4, Math.PI / 2 + 0.4, 'idle'], ['tourist', 7.5, 4.5, -Math.PI / 2 - 0.3, 'idle']])
      this.greeters.push({ kind, n: this.crowd.add(x, y, z, ry, archetypeLook(kind), mode) });
    // 广告灯箱（墙面）
    for (const [i, z] of [[0, 4], [1, 18]]) this.poster(17.97, y + 1.6, z, -Math.PI / 2, i);
    // 站厅西墙：大幅全网线路图（1 号线 + 2 号线，本站“你在这里”）
    this.wallMapBuild(-17.9, y, 1.2);
    // 招牌站：站厅装饰
    if (sig === 'memorial') MV.perspectiveArches(k, -9, 2, 1, y, '#F2E6D8', '#E07A5F', 6);
    if (sig === 'redwall') for (const z of [-16, -7, 5, 20]) for (const sx of [-1, 1]) { k.glow.ellipsoid(sx * 10, CY - 0.7, z, 0.7, 0.85, 0.7, hex('#FF5C4D'), 2); P.cyl(sx * 10, CY - 0.22, z, 0.36, 0.1, hex('#E0A63A'), 10); P.cyl(sx * 10, CY - 0.11, z, 0.02, 0.22, DARK, 4); }
    if (sig === 'villa') { const Br = k.g('brick'); for (let z = -18; z < 25; z += 3) Br.slab(-17.99, -17.9, y + 0.3, y + 2.4, z, z + 2.6, hex('#FFFFFF'), { ao: false }); }
    if (sig === 'park') k.sign(17.95, y + 1.6, 11, { kind: 'poster', w: 6, h: 2.2, zh: '公园前 · 人民公园', en: "People's Park", c1: '#3E8F4E', c2: '#8FCB7A', face: -Math.PI / 2 });
    // 墙上大站名
    k.sign(-17.95, y + 3.5, 12, { kind: 'name', w: 9, h: 1.45, zh: s.zh, en: s.en, badges: L.map(badge), lineColor: lc, face: Math.PI / 2 });
  }
  /** 墙上的全网线路图：和 HUD 地图同一张 SVG（墙上版，不带动画），画进 1536×1251 动态贴图；外面一圈不锈钢框 */
  wallMapBuild(x, y, zc) {
    // 贴图 1536×1251（原 2048×1668）：4.4m 宽的图在 3m 外约占 1500px，再大屏幕也显示不出来；带 mipmap，远看不闪
    const W = 1536, H = 1251, w = 4.4, h = w * 1668 / 2048, y0 = y + 0.55, z0 = zc - w / 2, z1 = zc + w / 2;
    this.kit.metal.box(x - 0.05, y0 + h / 2, zc, 0.06, h + 0.14, w + 0.14, STEEL, 0, 0, 0, 1, { ao: false });
    const tex = new B.DynamicTexture('wallMap', { width: W, height: H }, this.scene, true), c = tex.getContext();
    tex.anisotropicFilteringLevel = 8; c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H); tex.update(true);
    const mat = new B.StandardMaterial('wallMapMat', this.scene); mat.diffuseColor = new B.Color3(0, 0, 0); mat.specularColor = new B.Color3(0, 0, 0); mat.emissiveTexture = tex; mat.disableLighting = true; mat.backFaceCulling = false;
    const g = new Geo(); g.quad([x, y0, z0], [x, y0, z1], [x, y0 + h, z1], [x, y0 + h, z0], [1, 1, 1]); g.u = [0, 0, 1, 0, 1, 1, 0, 1];
    const m = g.toMesh('wallMap', this.scene, mat, this.kit.root); m.isPickable = false;
    this.wallMap = { tex, mat, mesh: m, ready: false };
    const img = new Image();
    img.onload = () => { if (this.wallMap?.tex !== tex) return; c.drawImage(img, 0, 0, W, H); tex.update(true); this.wallMap.ready = true; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(networkSVG(this.code, { wall: true }).replace('<svg ', `<svg width="${W}" height="${H}" `));
  }
  /** 售票机屏幕：一张共享贴图（本站所在线路的小线路图 + “请选择目的地”），每台一块 */
  tvmScreensBuild() {
    const tex = new B.DynamicTexture('tvmScr', { width: 512, height: 384 }, this.scene, true), c = tex.getContext(), line = this.s.lines[0];
    c.fillStyle = '#F4F7FA'; c.fillRect(0, 0, 512, 384);
    c.fillStyle = '#1E6FB8'; c.fillRect(0, 0, 512, 60); c.fillStyle = '#fff'; c.font = `600 30px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('请选择目的地', 20, 31);
    c.font = `500 18px ${FONT_EN}`; c.textAlign = 'right'; c.fillText('Select destination', 494, 32);
    drawLineCanvas(c, line, this.code, 12, 70, 488, 236);
    [['单程票', '#1E9E8F'], ['羊城通', '#E2725B']].forEach(([t, col], i) => { c.fillStyle = col; roundRect(c, 28 + i * 236, 314, 220, 56, 14); c.fill(); c.fillStyle = '#fff'; c.font = `600 28px ${FONT}`; c.textAlign = 'center'; c.fillText(t, 138 + i * 236, 343); });
    tex.update(true);
    const mat = new B.StandardMaterial('tvmScrMat', this.scene); mat.diffuseColor = new B.Color3(0, 0, 0); mat.specularColor = new B.Color3(0, 0, 0); mat.emissiveTexture = tex; mat.disableLighting = true;
    const g = new Geo();
    for (const t of this.tvms) { const r = t.scr; g.quad([r.x - r.w / 2, r.y - r.h / 2, r.z], [r.x + r.w / 2, r.y - r.h / 2, r.z], [r.x + r.w / 2, r.y + r.h / 2, r.z], [r.x - r.w / 2, r.y + r.h / 2, r.z], [1, 1, 1]); }
    g.u = []; for (let i = 0; i < g.p.length / 3; i++) { const q = i % 4; g.u.push(q === 0 || q === 3 ? 0 : 1, q < 2 ? 0 : 1); }
    const m = g.toMesh('tvmScreens', this.scene, mat, this.kit.root); m.isPickable = false;
    this.tvmScr = { tex, mat, mesh: m };
  }
  /** 闸机通行屏：每条通道两块（进站面在右侧机柜、出站面在另一侧机柜），共用一张 5 格贴图；状态 idle / ok（绿箭头）/ no（柔和红叉） */
  gateScreensBuild(zg, y) {
    const k = this.kit, n = this.gates.length, tex = new B.DynamicTexture('gateScr', { width: 128 * n, height: 128 }, this.scene, false);
    const mat = new B.StandardMaterial('gateScrMat', this.scene); mat.diffuseColor = new B.Color3(0, 0, 0); mat.specularColor = new B.Color3(0, 0, 0); mat.emissiveTexture = tex; mat.disableLighting = true; mat.backFaceCulling = false;
    const g = new Geo(), H = hex('#1E2328'), y0 = y + 1.12, y1 = y + 1.38, lean = 0.1, hw = 0.16;
    this.gates.forEach((gt, i) => {
      for (const sd of [-1, 1]) {
        const cx = gt.x - sd * 1 + sd * 0.02, z0 = zg + sd * 0.3, z1 = z0 - sd * lean;
        // sd=-1：进站面（在通道右侧机柜上，朝 -z）；sd=+1：出站面（朝 +z）
        const q = sd < 0 ? [[cx - hw, y0, z0], [cx + hw, y0, z0], [cx + hw, y1, z1], [cx - hw, y1, z1]] : [[cx + hw, y0, z0], [cx - hw, y0, z0], [cx - hw, y1, z1], [cx + hw, y1, z1]];
        g.quad(...q, [1, 1, 1]);
        k.solid.box(cx, (y0 + y1) / 2, (z0 + z1) / 2 - sd * 0.03, hw * 2 + 0.05, y1 - y0 + 0.05, 0.04, H, 0, -sd * Math.atan2(lean, y1 - y0), 0, 1, { ao: false });
        k.metal.box(cx, y + 1.08, z0 - sd * 0.03, 0.05, 0.1, 0.05, STEEL, 0, 0, 0, 1, { ao: false });
      }
    });
    g.u = []; for (let i = 0; i < g.p.length / 3; i++) { const q = i % 4, cell = Math.floor(i / 8); g.u.push((cell + (q === 0 || q === 3 ? 0.02 : 0.98)) / n, q < 2 ? 0 : 1); }
    const m = g.toMesh('gateScreens', this.scene, mat, k.root); m.isPickable = false;
    this.gateScr = { tex, mat, mesh: m, state: [] };
    for (let i = 0; i < n; i++) this.setGateScreen(i, 'idle');
  }
  setGateScreen(i, state) {
    const S = this.gateScr; if (!S || S.state[i] === state) return; S.state[i] = state;
    const c = S.tex.getContext(), x = i * 128;
    c.fillStyle = '#0D1520'; c.fillRect(x, 0, 128, 128);
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (state === 'ok') {
      c.fillStyle = '#3DDC84'; c.beginPath(); c.moveTo(x + 64, 14); c.lineTo(x + 108, 62); c.lineTo(x + 80, 62); c.lineTo(x + 80, 114); c.lineTo(x + 48, 114); c.lineTo(x + 48, 62); c.lineTo(x + 20, 62); c.closePath(); c.fill();
    } else if (state === 'no') {
      c.strokeStyle = '#FF7A7A'; c.lineWidth = 20; c.beginPath(); c.moveTo(x + 34, 34); c.lineTo(x + 94, 94); c.moveTo(x + 94, 34); c.lineTo(x + 34, 94); c.stroke();
    } else {
      c.fillStyle = '#5AB0FF'; roundRect(c, x + 30, 26, 68, 46, 8); c.fill(); c.fillStyle = '#0D1520'; c.fillRect(x + 30, 38, 68, 8);
      c.fillStyle = '#DDE6F0'; c.font = `600 22px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('请刷卡', x + 64, 100);
    }
    S.tex.update(false);
  }
  /** 打开某条通道（刷卡 / 出站），dur 秒后自动关（人在通道里会一直开着） */
  openGate(i, dur = 3, beep = true) { const g = this.gates[i]; g.t = Math.max(g.t, dur); g.beep = beep; }
  poster(x, y, z, face, i) {
    const k = this.kit, ad = ADS[Math.floor(Math.abs(i)) % ADS.length], nx = Math.sin(face), nz = Math.cos(face);
    k.sign(x + nx * 0.07, y, z + nz * 0.07, { kind: 'poster', w: 3.6, h: 1.9, ...ad, face });
    // 不锈钢外框：前面离画面 2.5cm（以前外框前面和画面只差 5mm，远处闪）
    k.metal.box(x + nx * 0.02, y, z + nz * 0.02, Math.abs(nz) * 3.75 + 0.04, 2.05, Math.abs(nx) * 3.75 + 0.04, STEEL, 0, 0, 0, 1, { ao: false });
  }
  /** 楼梯可见部分（花岗岩踏步 + 防滑条）——碰撞由 kit.stairs 负责 */
  stairVisual(a, ya, b, yb, w0, w1) {
    const k = this.kit, F = k.g('floor'), P = k.solid, L = Math.abs(b - a), dy = yb - ya, n = Math.round(Math.abs(dy) / 0.16), dir = Math.sign(b - a);
    for (let s = 0; s < n; s++) {
      const s0 = a + dir * L * s / n, s1 = a + dir * L * (s + 1) / n, top = ya + dy * (s + 1) / n;
      F.slab(s0, s1, top - 0.16, top, w0, w1, FLOOR, { ao: false });
      P.slab(s0, s0 + 0.06, top, top + 0.005, w0 + 0.05, w1 - 0.05, hex('#3A3F45'), { ao: false });
      P.slab(s0, s1, top - 0.16 - 0.3, top - 0.16, w0, w1, hex('#C9C7C2'), { ao: false });
    }
    // 中间扶手 + 两侧矮墙
    const pt = (x, z, h) => [x, ya + dy * (x - a) / (b - a) + h, z];
    k.metal.tube(pt(a, (w0 + w1) / 2, 0.95), pt(b, (w0 + w1) / 2, 0.95), 0.05, STEEL); for (let x = a + 1; x < b; x += 2) k.metal.tube(pt(x, (w0 + w1) / 2, 0), pt(x, (w0 + w1) / 2, 0.95), 0.04, STEEL, 6);
  }
  /** 扶梯：浅灰不锈钢裙板 / 端柱 + 玻璃扶栏 + 黑色橡胶扶手 + 梳齿板 + 桁架外包 */
  escalatorBody(x0, y0, x1, y1, z0, z1) {
    const k = this.kit, P = k.solid, ang = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2, zc = (z0 + z1) / 2, w = z1 - z0;
    const SKIRT = hex('#E6EAEE'), POST = hex('#D5DAE0');
    // 侧板用非金属浅灰（金属度 1 的材质在站厅环境里反射暗，看起来发黑）
    P.box(mx, my - 0.5, zc, len, 0.9, w + 0.3, hex('#DDE2E7'), 0, 0, ang, 1, { ao: false }); // 桁架外包（浅灰）
    for (const e of [-1, 1]) {
      const ze = e < 0 ? z0 - 0.08 : z1 + 0.08;
      P.box(mx, my + 0.18, ze, len, 0.55, 0.07, SKIRT, 0, 0, ang, 1, { ao: false }); // 裙板（浅灰）
      k.metal.box(mx, my + 0.47, ze, len, 0.04, 0.08, STEEL, 0, 0, ang, 1, { ao: false }); // 不锈钢压条
      k.glass.box(mx, my + 0.72, ze, len, 0.78, 0.025, hex('#E2F2FA'), 0, 0, ang);
      const hr = (x, h) => [x, y0 + (y1 - y0) * (x - x0) / (x1 - x0) + h, ze];
      // 扶手：黑色橡胶；端柱改不锈钢浅灰
      const A = [x0 - 1.2, y0 + 1.08, ze], A1 = [x0 + 0.3, y0 + 1.08, ze], B1 = [x1 - 0.3, y1 + 1.08, ze], Bb = [x1 + 1.2, y1 + 1.08, ze];
      P.path([A, A1, hr(x0 + 0.9, 1.08), hr(x1 - 0.9, 1.08), B1, Bb], 0.09, hex('#1E2125'), 8);
      for (const [px, py, dd] of [[x0 - 1.2, y0, -1], [x1 + 1.2, y1, 1]]) { P.cyl(px, py + 0.62, ze, 0.12, 0.9, POST, 10, 0, 0, 0, undefined, { ao: false }); P.rbox(px - dd * 0.6, py, ze, 1.4, 0.95, 0.12, SKIRT, 0.04, 0, { ao: false }); k.glass.box(px - dd * 0.6, py + 0.6, ze, 1.3, 0.8, 0.02, hex('#E2F2FA')); }
    }
    // 上下梳齿板 + 黄色警示
    for (const [xx, yy, dd] of [[x0 - 0.9, y0, -1], [x1 + 0.9, y1, 1]]) {
      k.metal.slab(xx - 0.9, xx + 0.9, yy, yy + 0.008, z0, z1, STEEL, { ao: false });
      P.slab(xx - dd * 0.75 - 0.05, xx - dd * 0.75 + 0.05, yy, yy + 0.01, z0, z1, hex('#F2C230'), { ao: false });
    }
  }
  escSteps(zc, w, ang, len, _dir, y) {
    const g = new Geo();
    g.box(0, 0, 0, 0.42, 0.08, w - 0.08, hex('#4A4F55'), 0, 0, 0, 1, { ao: false });
    for (let i = -3; i <= 3; i++) g.box(i * 0.055, 0.042, 0, 0.02, 0.006, w - 0.12, hex('#7B828A'), 0, 0, 0, 1, { ao: false });
    g.box(0.19, 0.043, 0, 0.04, 0.008, w - 0.1, hex('#F2C230'), 0, 0, 0, 1, { ao: false });
    for (const s of [-1, 1]) g.box(0, 0.043, s * (w / 2 - 0.07), 0.42, 0.008, 0.04, hex('#F2C230'), 0, 0, 0, 1, { ao: false });
    const src = g.toMesh('step', this.scene, this.kit.M.paint, this.kit.root); src.isVisible = false;
    const out = [];
    for (let i = 0; i < 40; i++) { const st = src.createInstance('st'); st.parent = this.kit.root; st.rotation.z = ang; st.position.z = zc; out.push(st); }
    return out;
  }
  /* ---------------- 站台 ---------------- */
  platform(P) {
    const k = this.kit, y = P.y, zc = P.zc, L = LINES[P.line], lc = L.color, th = this.th, s = this.s, isMain = P.zc === MAIN.zc, Pm = k.solid, W = k.g('wall'), S = k.shade;
    const FB = isMain ? 'floor@P' : 'floor@P2', CY = y + 4.2;
    const holes = [];
    if (this.platforms.length > 1 && P.line === 1) holes.push([-20, -6, 12, 16]);
    k.floorWithHoles(-HALL_X, HALL_X, zc - PSD_OFF, zc + PSD_OFF, y - 1.3, y, FLOOR, holes, true, FB);
    k.colSlab(-HALL_X, HALL_X, y - 0.3, y, zc - PSD_OFF - 0.25, zc - PSD_OFF); k.colSlab(-HALL_X, HALL_X, y - 0.3, y, zc + PSD_OFF, zc + PSD_OFF + 0.25);
    const ceilHoleS = isMain ? [[-2.2, 16.2, 9.4, 18.6]] : [[-19.5, -5.2, 40.5, 45.5]];
    const inHole = x => ceilHoleS.some(h => x > h[0] - 0.5 && x < h[1] + 0.5);
    for (const sz of [-1, 1]) {
      // 站台边缘：黄色盲道提示带 + 石材收边
      k.g('tactile').slab(-HALL_X, HALL_X, y, y + 0.006, zc + sz * 5.2 - 0.2, zc + sz * 5.2 + 0.2, hex('#F2C230'), { ao: false });
      Pm.slab(-HALL_X, HALL_X, y, y + 0.004, Math.min(zc + sz * 5.62, zc + sz * 5.96), Math.max(zc + sz * 5.62, zc + sz * 5.96), hex('#9AA0A6'), { ao: false });
      // 轨道：混凝土道床 + 排水沟 + 钢轨 + 轨枕
      const tz = zc + sz * TRACK_OFF, C = k.g('concrete');
      C.slab(-TUNNEL_X, TUNNEL_X, y - 1.75, y - 1.38, tz - 2.3, tz + 2.3, hex('#B8B6B0'), { ao: false });
      Pm.slab(-TUNNEL_X, TUNNEL_X, y - 1.379, y - 1.375, tz - 0.25, tz + 0.25, hex('#2E3134'), { ao: false });
      for (const rz of [-0.72, 0.72]) { k.metal.slab(-TUNNEL_X, TUNNEL_X, y - 1.32, y - 1.2, tz + rz - 0.035, tz + rz + 0.035, hex('#9EA4AA'), { ao: false }); Pm.slab(-TUNNEL_X, TUNNEL_X, y - 1.36, y - 1.32, tz + rz - 0.07, tz + rz + 0.07, hex('#3A3530'), { ao: false }); }
      for (let x = -HALL_X - 10; x < HALL_X + 10; x += 0.9) C.slab(x, x + 0.26, y - 1.38, y - 1.32, tz - 1.15, tz + 1.15, hex('#9C9A94'), { ao: false });
      // 架空接触网（广州 1、2 号线是受电弓 + 架空线）
      k.solid.tube([-TUNNEL_X, y + 3.75, tz], [TUNNEL_X, y + 3.75, tz], 0.03, hex('#6B4A2E'), 5);
      k.solid.tube([-TUNNEL_X, y + 4.05, tz], [TUNNEL_X, y + 4.05, tz], 0.02, hex('#3A3F45'), 5);
      for (let x = -HALL_X; x <= HALL_X; x += 9) { k.solid.tube([x, y + 3.75, tz], [x, y + 4.05, tz], 0.012, hex('#3A3F45'), 4); k.solid.box(x, y + 4.5, tz, 0.08, 0.9, 0.08, hex('#3A3F45'), 0, 0, 0, 1, { ao: false }); }
      // 轨行区墙：搪瓷板 + 站名牌 + 广告灯箱
      const wz = zc + sz * WALL_OFF;
      W.slab(-HALL_X, HALL_X, y - 1.75, y + 4.8, wz, wz + sz * 0.3, mix(WALLC, th, 0.4), { aoTop: true }); k.colSlab(-HALL_X, HALL_X, y - 1.75, y + 4.8, wz, wz + sz * 0.3);
      Pm.slab(-HALL_X, HALL_X, y - 1.75, y - 0.2, wz - sz * 0.025, wz, hex('#5A6068'), { ao: false });
      Pm.slab(-HALL_X, HALL_X, y + 0.2, y + 0.55, wz - sz * 0.03, wz, hex(lc), { ao: false });
      const stIdx = L.stations.indexOf(this.code), prevC = L.stations[stIdx - 1], nextC = L.stations[stIdx + 1];
      // 观看者面朝墙时，+x 在左边（A 侧墙 sz<0 → 面朝 +z，+x 在右）
      const leftC = sz < 0 ? prevC : nextC, rightC = sz < 0 ? nextC : prevC;
      for (let x = -40; x <= 40; x += 16) {
        k.sign(x - 3.5, y + 2.0, wz - sz * 0.03, { kind: 'name', w: 6.4, h: 1.4, zh: s.zh, en: s.en, badges: [badge(P.line)], lineColor: lc, face: sz > 0 ? Math.PI : 0,
          prev: leftC ? { zh: STATIONS[leftC].zh, en: STATIONS[leftC].en } : null, next: rightC ? { zh: STATIONS[rightC].zh, en: STATIONS[rightC].en } : null });
        this.poster(x + 4.3, y + 2.0, wz - sz * 0.02, sz > 0 ? Math.PI : 0, Math.round((x + 40) / 16) + (sz > 0 ? 2 : 0));
      }
      // 隧道（两端）：混凝土 + 电缆托架 + 区间灯
      for (const e of [-1, 1]) {
        const xa = e * HALL_X, xb = e * TUNNEL_X, x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), C2 = k.g('concrete');
        for (const wsd of [-1, 1]) C2.slab(x0, x1, y - 1.75, y + 3.6, tz + wsd * 2.3, tz + wsd * 2.6, hex('#A8A6A0'), { ao: false });
        C2.slab(x0, x1, y + 3.6, y + 4.6, tz - 2.6, tz + 2.6, hex('#A09E98'), { ao: false });
        Pm.slab(xb - e * 0.3, xb, y - 1.75, y + 4.6, tz - 2.6, tz + 2.6, hex('#15181D'));
        for (const wsd of [-1, 1]) for (const hh of [0.6, 1.0]) Pm.slab(x0, x1, y + hh, y + hh + 0.05, tz + wsd * 2.15, tz + wsd * 2.3, hex('#3A3F45'), { ao: false });
        for (let x = x0 + 5; x < x1; x += 10) k.glow.box(x, y + 2.6, tz - sz * 2.28, 0.6, 0.12, 0.05, hex('#FFE9A8'));
      }
    }
    // 端墙（带隧道口）
    for (const e of [-1, 1]) {
      const x = e * HALL_X, a = zc - TRACK_OFF, b = zc + TRACK_OFF, segs = [[zc - WALL_OFF, a - 2.3], [a + 2.3, b - 2.3], [b + 2.3, zc + WALL_OFF]];
      for (const [z0, z1] of segs) k.block(x - 0.15, x + 0.15, y - 1.75, y + 4.8, z0, z1, mix(WALLC, th, 0.4), true, 'wall', { aoTop: true });
      for (const t of [a, b]) Pm.slab(x - 0.15, x + 0.15, y + 3.6, y + 4.8, t - 2.3, t + 2.3, hex('#5A6068'));
    }
    // 结构顶板（主站台中间被站厅地板盖住）+ 吊顶 + 灯带
    // 2 号线站台的结构顶板不能伸进换乘通道（以前在通道 z>33.4 那段地面上凸出 0.2m 深灰色板，盖住了地砖和地面引导带）
    const ceilHoles = isMain ? [[-18, 18, -100, 100]] : [[-19, -5.6, 41, 45], [-24.3, -18.7, 33, 45.3]];
    k.floorWithHoles(-HALL_X, HALL_X, zc - WALL_OFF, zc + WALL_OFF, y + 4.8, y + 5.2, hex('#4E545B'), ceilHoles, true);
    k.floorWithHoles(-HALL_X, HALL_X, zc - PSD_OFF, zc + PSD_OFF, CY, CY + 0.06, CEIL, ceilHoleS, false, 'ceiling');
    for (const sz of [-1, 1]) {
      let run = null; const seg = [];
      for (let x = -45; x <= 45; x += 0.5) { const h = inHole(x); if (!h && run === null) run = x; if ((h || x >= 45) && run !== null) { seg.push([run, x]); run = null; } }
      for (const [a0, a1] of seg) { this.lightStrip('x', a0, a1, zc + sz * 2.6, CY, 0.16, 1.0, 0.32); this.floorSheen('x', a0, a1, zc + sz * 2.6, y, 0.4, 0.05); }
    }
    S.shadeRoom(-HALL_X, HALL_X, zc - PSD_OFF + 0.1, zc + PSD_OFF - 0.1, y + 0.008, 0.6, 0.18);
    // 柱子、座椅、垃圾桶、候车乘客
    for (let x = -40; x <= 40; x += 8) {
      if ((isMain && x > -3 && x < 17) || (holes.length && x > -22 && x < -4) || (!isMain && x > -21 && x < -4)) continue;
      W.cyl(x, (y + CY) / 2, zc, 0.8, CY - y, mix(WALLC, th, 0.6), 24, 0, 0, 0, undefined, { aoTop: true }); k.col(x, y + 2.4, zc, 0.8, 4.8, 0.8);
      k.metal.cyl(x, y + 0.08, zc, 0.86, 0.16, STEEL, 24, 0, 0, 0, undefined, { ao: false });
      Pm.cyl(x, y + 2.4, zc, 0.84, 0.34, hex(lc), 24, 0, 0, 0, undefined, { ao: false });
      S.shadeRing(x, zc, 0.42, 1.0, y + 0.006, 0.3);
      if (Math.abs(x) % 16 === 8) { D.seats(k, x + 2.4, y, zc, 0, 4); k.col(x + 2.4, y + 0.4, zc, 2.2, 0.8, 0.5); }
      else D.bin(k, x + 0.9, y, zc, 0);
    }
    const doorsOk = DOOR_XS.filter(d => Math.abs(d - 24.6) > 1 && Math.abs(d - 6) > 1 && Math.abs(d - 18.6) > 1 && !(isMain && d > -3 && d < 17));
    for (let i = 0; i < 6; i++) {
      const sz = i % 2 ? 1 : -1, d = doorsOk[(i * 3 + 1) % doorsOk.length], x = d + (i % 3 === 0 ? -1.3 : 1.3);
      this.crowd.add(x, y, zc + sz * 4.4, sz > 0 ? 0 : Math.PI, randomLook({ phone: i % 3 === 1, bag: i % 2 ? 'backpack' : null }), i % 3 === 1 ? 'phone' : 'idle');
    }
    // 屏蔽门 + 悬挂导向牌 + PIDS
    for (const side of [P.sides.A, P.sides.B]) {
      const dirKey = Object.keys(L.dirs).find(d => L.dirs[d].step === side.step), dest = L.dirs[dirKey], nx = nextStation(P.line, this.code, side.step);
      const zz = side.psdZ + (side.key === 'A' ? 1.0 : -1.0), face = side.key === 'A' ? 0 : Math.PI;
      const arrowDir = (side.step > 0) === (side.key === 'B') ? 'right' : 'left';
      for (const x of [-22, 22]) {
        k.sign(x, y + 3.25, zz, { kind: 'dir', w: 6.2, h: 0.62, zh: nx ? `往 ${dest.zh}` : '终点站 · 不载客', en: nx ? 'To ' + dest.en : 'Terminus', badges: [badge(P.line)], arrow: nx ? arrowDir : undefined, face, hang: CY, bar: lc });
        if (nx) k.sign(x, y + 2.79, zz, { kind: 'dir', w: 6.2, h: 0.3, zh: `下一站 ${STATIONS[nx].zh}   Next: ${STATIONS[nx].en}`, face, bg: '#3A3F45' });
      }
      this.psdBuild(P, side);
    }
    this.pidsBuild(P, CY);
    // 楼梯口出口牌 / 站名
    if (isMain) k.sign(16.6, y + 3.35, 14, { kind: 'exit', w: 4.4, h: 0.6, arrow: 'up', exits: ['A', 'D'], face: Math.PI / 2, double: true, hang: CY });
    k.sign(isMain ? -30 : 30, y + 3.3, zc, { kind: 'dir', w: 5.2, h: 0.62, zh: s.zh + ' · ' + L.zh, en: s.en, badges: [badge(P.line)], face: isMain ? Math.PI / 2 : -Math.PI / 2, double: true, hang: CY, bar: lc });
    D.cctv(k, isMain ? 20 : 34, CY, zc, -Math.PI / 2); D.cctv(k, -36, CY, zc, Math.PI / 2);
    if (isMain) for (const x of [24, 20]) arrow(k, x, y + 0.006, zc - 4.2, Math.PI / 2, '#FFFFFF'), arrow(k, x, y + 0.006, zc + 4.2, Math.PI / 2, '#FFFFFF');
  }
  /** 屏蔽门：3m 全高；玻璃滑动门 + 固定玻璃 + 不锈钢框；门头深灰 + 线路色灯带 + 线路色门号；地面上下车指示 */
  psdBuild(P, side) {
    const k = this.kit, y = P.y, z = side.psdZ, sgn = side.key === 'A' ? -1 : 1, lc = LINES[P.line].color, ink = LINES[P.line].ink, Pm = k.solid, CY = y + 4.2;
    const fz = z - sgn * 0.11; // 站台一侧的面
    let x = -HALL_X; const ops = DOOR_XS.map(d => [d - 0.8, d + 0.8]);
    const seg = (a, b) => {
      if (b - a < 0.05) return;
      k.glass.slab(a, b, y + 0.1, y + 2.3, z - 0.012, z + 0.012, hex('#D6EEF8'));
      for (let m = a; m <= b + 0.01; m += Math.max(0.5, (b - a) / Math.max(1, Math.round((b - a) / 1.6)))) k.metal.slab(m - 0.04, m + 0.04, y, y + 2.3, z - 0.06, z + 0.06, STEEL, { ao: false });
      k.colSlab(a, b, y, y + 3.2, z - 0.08, z + 0.08);
    };
    for (const [a, b] of ops) { seg(x, a); x = b; } seg(x, HALL_X);
    k.metal.slab(-HALL_X, HALL_X, y, y + 0.1, z - 0.07, z + 0.07, STEEL, { ao: false });
    // 门头
    // 门头：深灰底 + 两面宽线路色饰带（0.26m，醒目）+ 底部细灯带
    Pm.slab(-HALL_X, HALL_X, y + 2.3, y + 2.82, z - 0.12, z + 0.12, hex('#2A2D31'), { ao: false });
    k.colSlab(-HALL_X, HALL_X, y + 2.0, CY, z - 0.12, z + 0.12); // 门洞上沿以上到吊顶：镜头碰撞（以前抬高视角时第三人称镜头会越过屏蔽门顶跑到轨行区 / 车厢里）
    for (const sd of [-sgn, sgn]) {
      const fzz = z + sd * 0.124;
      Pm.slab(-HALL_X, HALL_X, y + 2.46, y + 2.72, fzz - 0.003, fzz + 0.003, hex(lc), { ao: false });
      k.glow.slab(-HALL_X, HALL_X, y + 2.3, y + 2.34, fzz - 0.003, fzz + 0.003, hex('#FFF8E8'), { ao: false });
    }
    // 门头以上：搪瓷板封到吊顶
    k.g('wall').slab(-HALL_X, HALL_X, y + 2.82, CY, z - 0.08, z + 0.08, mix(WALLC, this.th, 0.3), { ao: false });
    let n = 1; const doorsSorted = side.key === 'A' ? DOOR_XS : DOOR_XS.slice().reverse();
    for (const d of doorsSorted) {
      // 门号（线路色方块，线路色是规范要求）+ 门状态灯
      k.sign(d - 0.62, y + 2.59, z - sgn * 0.128, { kind: 'plain', w: 0.3, h: 0.3, bg: '#FFFFFF', fg: '#1B1D20', zh: String(n++), face: side.key === 'A' ? 0 : Math.PI, align: 'center', box: false });
      k.glow.slab(d - 0.18, d + 0.18, y + 2.36, y + 2.42, z - sgn * 0.13, z - sgn * 0.126, hex('#3DDC84'), { ao: false });
      // 地面上下车指示：中间“下车”箭头朝外，两边“上车”箭头朝门
      const pz = z - sgn * 1.0;
      arrow(k, d, y + 0.006, pz, sgn > 0 ? 0 : Math.PI, '#3DBE6E', 0.75);
      for (const s2 of [-1, 1]) arrow(k, d + s2 * 1.1, y + 0.006, pz, sgn > 0 ? Math.PI : 0, '#F2C230', 0.6);
    }
    // 门扇（实例）：不锈钢框 + 玻璃 + 线路色贴条
    const src = new Geo();

    // 门扇框 = 四边不锈钢（中间留空给玻璃实例）
    for (const [bx, by, bw, bh] of [[0, 0.1, 0.8, 0.2], [0, 2.21, 0.8, 0.1], [-0.36, 1.15, 0.08, 2.26], [0.36, 1.15, 0.08, 2.26]]) src.box(bx, by, 0, bw, bh, 0.05, STEEL, 0, 0, 0, 1, { ao: false });
    src.box(0, 1.25, 0, 0.66, 0.14, 0.058, hex(lc), 0, 0, 0, 1, { ao: false });
    const sm = src.toMesh('psdLeaf', this.scene, k.M.paint, k.root); sm.isVisible = false;
    const gsrc = new Geo(); gsrc.box(0, 1.2, 0, 0.66, 2.0, 0.02, hex('#D6EEF8'), 0, 0, 0, 1, { ao: false });
    const gm = gsrc.toMesh('psdLeafGlass', this.scene, k.M.glass, k.root); gm.isVisible = false; gm.alphaIndex = 10;
    const leaves = [], cols = [];
    for (const d of DOOR_XS) {
      for (const lr of [-1, 1]) for (const srcM of [sm, gm]) { const inst = srcM.createInstance('pl'); inst.parent = k.root; inst.metadata = { d, lr }; leaves.push(inst); }
      cols.push(k.col(d, y + 1.2, z, 1.6, 2.4, 0.16, { dynamic: false, name: 'psdDoor' }));
    }
    const st = { P, side, leaves, cols, z, y, f: -1 };
    this.psd.push(st); side.psd = st; this.setPSD(st, 0);
  }
  setPSD(st, f) {
    if (st.f === f) return; st.f = f;
    const e = f * f * (3 - 2 * f);
    for (const l of st.leaves) l.position.set(l.metadata.d + l.metadata.lr * (0.4 + e * 0.76), st.y, st.z);
    for (const c of st.cols) c.checkCollisions = f < 0.7;
  }
  /** 乘客信息屏（PIDS）：吊在站台中线，双面，显示两个方向的下一班车 */
  pidsBuild(P, CY) {
    const k = this.kit, y = P.y, zc = P.zc, isMain = P.zc === MAIN.zc;
    const tex = new B.DynamicTexture('pids', { width: 512, height: 160 }, this.scene, true);
    const mat = new B.StandardMaterial('pidsMat', this.scene); mat.diffuseColor = new B.Color3(0, 0, 0); mat.specularColor = new B.Color3(0, 0, 0); mat.emissiveTexture = tex; mat.disableLighting = true;
    const g = new Geo(); const xs = isMain ? [-12, 30, -36] : [12, 36, -30];
    for (const x of xs) {
      k.solid.rbox(x, y + 2.75, zc, 1.9, 0.68, 0.16, hex('#1E2125'), 0.04, 0, { ao: false, bottom: true });
      for (const s of [-1, 1]) k.metal.tube([x + s * 0.6, y + 3.43, zc], [x + s * 0.6, CY, zc], 0.04, STEEL, 6);
      for (const sz of [-1, 1]) { const zf = zc + sz * 0.082; sz > 0 ? g.quad([x + 0.85, y + 2.8, zf], [x - 0.85, y + 2.8, zf], [x - 0.85, y + 3.36, zf], [x + 0.85, y + 3.36, zf], [1, 1, 1]) : g.quad([x - 0.85, y + 2.8, zf], [x + 0.85, y + 2.8, zf], [x + 0.85, y + 3.36, zf], [x - 0.85, y + 3.36, zf], [1, 1, 1]); }
    }
    // UV：每个面整张贴图
    g.u = []; for (let i = 0; i < g.p.length / 3; i++) { const q = i % 4; g.u.push(q === 0 || q === 3 ? 0 : 1, q < 2 ? 0 : 1); }
    const m = g.toMesh('pidsScreens', this.scene, mat, k.root);
    this.pids.push({ P, tex, mat, mesh: m, t: 0 });
  }
  drawPids(pd, metro) {
    const c = pd.tex.getContext(), W = 512, H = 160, L = LINES[pd.P.line];
    c.fillStyle = '#061226'; c.fillRect(0, 0, W, H);
    c.fillStyle = L.color; c.fillRect(0, 0, W, 36); c.fillStyle = L.ink; c.font = `600 22px ${FONT}`; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText(L.zh + ' ' + L.en, 12, 19);
    const now = new Date(); c.textAlign = 'right'; c.fillText(String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), W - 12, 19);
    const rows = Object.values(L.dirs);
    rows.forEach((d, i) => {
      const yy = 62 + i * 52, slot = metro && metro.slots.find(s => s.P === pd.P && s.step === d.step);
      let txt = '—';
      if (slot) {
        if (slot.state === 'away') txt = Math.max(1, Math.ceil((slot.t + 9) / 60)) + ' 分钟';
        else if (slot.state === 'arriving') txt = '即将进站';
        else if (slot.state === 'departing') txt = '列车出发';
        else txt = '列车到站';
      }
      const term = !nextStation(pd.P.line, this.code, d.step);
      c.textAlign = 'left'; c.fillStyle = '#FFFFFF'; c.font = `600 28px ${FONT}`; c.fillText(term ? '终点站' : '往 ' + d.zh, 14, yy);
      c.fillStyle = '#9FB4CC'; c.font = `500 14px ${FONT_EN}`; c.fillText(term ? 'Terminus' : 'To ' + d.en, 14, yy + 22);
      c.textAlign = 'right'; c.fillStyle = txt.includes('分钟') ? '#FFC72C' : '#3DDC84'; c.font = `600 28px ${FONT}`; c.fillText(term ? '' : txt, W - 14, yy + 8);
    });
    pd.tex.update(false);
  }
  /* ---------------- 公园前换乘（1 号线站台 → 2 号线站台） ---------------- */
  transfer() {
    const k = this.kit, y1 = MAIN.y, yc = -17, y2 = GYQ2.y, c2 = LINES[2].color, c1 = LINES[1].color, Pm = k.solid, W = k.g('wall');
    k.stairs('x', -6, y1, -19.33, yc, 12, 16, yc - 0.2, FLOOR);
    k.rail(-20, 12, -6, 12, y1); k.rail(-20, 16, -6, 16, y1); k.rail(-20, 12, -20, 16, y1);
    W.slab(-24.2, -6, yc - 0.2, y1 - 0.4, 11.7, 11.9, WALLC); W.slab(-19.0, -6, yc - 0.2, y1 - 0.4, 16.1, 16.3, WALLC);
    // 楼梯井两侧墙也要碰撞：第三人称镜头的防穿墙射线只认碰撞体，以前在楼梯上转镜头会穿到墙外
    k.colSlab(-24.2, -6, yc - 0.2, y1 - 0.4, 11.7, 11.9); k.colSlab(-19.0, -6, yc - 0.2, y1 - 0.4, 16.1, 16.3);
    // 通道 x∈[-24,-19], z∈[12,45]
    k.floorWithHoles(-24, -19, 12, 45, yc - 0.2, yc, FLOOR, [[-24, -19, 26, 33]], true, 'floor');
    k.floorWithHoles(-24.2, -19, 16.3, 45.2, -14, -13.7, hex('#4E545B'), [], true);
    k.g('ceiling').slab(-24, -19, -14.12, -14.0, 16.3, 45, CEIL, { ao: false });
    k.block(-24.3, -24, yc, -14, 11.7, 45.2, WALLC, true, 'wall', { aoTop: true }); k.block(-19, -18.7, yc, -14, 16.3, 41, WALLC, true, 'wall', { aoTop: true }); k.block(-24.3, -18.7, yc, -14, 45, 45.3, WALLC, true, 'wall', { aoTop: true });
    k.block(-24.3, -19.3, yc, y1 - 0.4, 11.6, 11.9, WALLC, true, 'wall');
    // 线路色引导带（左 2 号线蓝、右 1 号线黄）
    Pm.slab(-23.99, -23.95, yc + 1.0, yc + 1.3, 16.3, 45, hex(c2), { ao: false }); Pm.slab(-19.05, -19.01, yc + 1.0, yc + 1.3, 16.3, 41, hex(c1), { ao: false });
    k.metal.slab(-23.99, -23.95, yc, yc + 0.12, 12, 45, STEEL, { ao: false }); k.metal.slab(-19.05, -19.01, yc, yc + 0.12, 16.3, 41, STEEL, { ao: false });
    this.lightStrip('z', 16.6, 44.6, -21.5, -14.12, 0.16, 0.9, 0.34); this.floorSheen('z', 16.6, 44.6, -21.5, yc, 0.4, 0.05);
    k.shade.shadeRoom(-24, -19, 16.3, 45, yc + 0.004, 0.55, 0.25);
    for (let z = 20; z < 44; z += 8) this.poster(-23.97, yc + 1.9, z, Math.PI / 2, z / 8);
    // 2 号线站台楼梯（向东下行）+ 竖井
    k.stairs('x', -19, yc, -5.67, y2, 41, 45, y2, FLOOR);
    k.block(-19, -5.6, GYQ2.y + 4.8, -14, 40.7, 41, WALLC, false, 'wall'); k.block(-19, -5.6, GYQ2.y + 4.8, -14, 45, 45.3, WALLC, false, 'wall');
    k.colSlab(-19, -5.6, GYQ2.y + 4.8, -14, 40.7, 41); k.colSlab(-19, -5.6, GYQ2.y + 4.8, -14, 45, 45.3); k.colSlab(-5.9, -5.6, GYQ2.y + 4.8, -13.7, 40.7, 45.3); // 竖井墙：镜头碰撞
    k.block(-19, -5.6, -14, -13.7, 40.7, 45.3, hex('#4E545B'));
    k.block(-5.9, -5.6, GYQ2.y + 4.8, -13.7, 40.7, 45.3, WALLC, false, 'wall'); // 竖井东头的墙（以前从楼梯往下看能看到天）
    this.lightStrip('x', -18.6, -6, 43, -14.02, 0.14, 0.8, 0.3);
    // 会自己拼起来的桥 + 通道里的路标
    this.bridge = MV.foldingBridge(k, -24, -19, 26, 33, yc); this.mv.push(this.bridge);
    // （以前这里是几个蓝 / 黄地面箭头，换成 transferWayfinding() 里连续的引导带）
    // 1 号线站台上的换乘楼梯口：换乘 2 号线（两头终点）
    k.sign(-5.4, y1 + 3.3, 14, { kind: 'way', w: 7.6, h: 0.85, zh: '换乘', en: 'Transfer', badges: [badge(2)], arrow: 'down', dirs: termini(2, 'gyq'), face: Math.PI / 2, double: true, bar: c2, hang: y1 + 4.2 });
    // 换乘通道：入口、中段（过桥之后）各一块双面牌——往里走看到“换乘 2号线”，往回走看到“换乘 1号线”；通道尽头的墙上指向右手边下 2 号线站台的楼梯
    for (const z of [17.2, 36]) k.sign(-21.5, -14.5, z, { kind: 'way', w: 4.6, h: 0.8, zh: '换乘', en: 'Line 2', badges: [badge(2)], arrow: 'up', face: Math.PI, bar: c2, double: true, back: { kind: 'way', zh: '换乘', en: 'Line 1', badges: [badge(1)], arrow: 'up', bar: c1 }, hang: -14.0 });
    k.sign(-21.5, -14.9, 44.9, { kind: 'way', w: 4.6, h: 0.85, badges: [badge(2)], arrow: 'right', dirs: [{ zh: '2号线站台', en: 'Line 2' }], face: Math.PI, bar: c2 });
    // 2 号线站台楼梯口（向东下行）：箭头往下 + 两头终点
    k.sign(-18.75, -14.48, 43, { kind: 'way', w: 3.9, h: 0.78, badges: [badge(2)], arrow: 'down', dirs: termini(2, 'gyq'), face: -Math.PI / 2, bar: c2, hang: -14.0 });
    // 正面（朝东）给往回走的人：换乘 1 号线 · 出口；背面（下楼梯到站台时正前方）：这里就是 2 号线站台 + 两头终点
    k.sign(-4.8, y2 + 3.3, 43, { kind: 'dir', w: 6.2, h: 0.62, zh: '换乘 1号线 · 出口', en: 'Line 1 · Exit', badges: [badge(1)], exits: ['A', 'D'], arrow: 'up', face: Math.PI / 2, double: true, bar: c1, hang: y2 + 4.2,
      back: { kind: 'way', w: 6.2, h: 0.62, zh: '2号线站台', en: 'Line 2', badges: [badge(2)], dirs: termini(2, 'gyq'), bar: c2 } });
    this.transferWayfinding();
  }
  /**
   * 公园前换乘导向（给第一次来的小朋友）：
   *   - 1 号线站台：楼梯 / 两部扶梯下来正前方一块大蓝牌“换乘 2号线”（掉头箭头），沿站台再挂几块重复牌；
   *   - 地面蓝色引导带（约 0.4m 宽 + 白色 V 形箭头）：每个楼梯 / 扶梯脚 → 站台北侧走道 → 换乘楼梯 → 通道（过桥）→ 2 号线楼梯 → 2 号线站台；
   *   - 反方向（2 → 1）一条黄色引导带走在另一侧，2 号线站台上挂“换乘 1号线”重复牌。
   * 色带走在各自前进方向的右手边：往 2 号线走的蓝带、往 1 号线走的黄带并排不重叠。
   */
  transferWayfinding() {
    const k = this.kit, G = k.g('band'), y1 = MAIN.y, yc = -17, y2 = GYQ2.y, c2 = LINES[2].color, c1 = LINES[1].color, W2 = '#FFFFFF', D1 = '#3A2E00';
    const zB = 14.7, zY = 13.3, xB = -20.8, xY = -22.2, zB2 = 42.3, zY2 = 43.7, NB = 18.6, TX = 17.4;
    // —— 蓝：1 号线站台（楼梯脚 x≈15，扶梯脚 x≈16.8）→ 北侧走道 → 换乘楼梯口
    for (const [x0, z] of [[15.3, 14], [16.4, 17.1], [16.4, 10.9]]) flatBand(G, [[x0, z], [TX, z]], y1, c2, W2, { start: 0.6 });
    flatBand(G, [[TX, 10.9], [TX, NB], [-2.8, NB], [-2.8, zB], [-6, zB]], y1, c2, W2);
    stairBand(G, -6, y1, -19.33, yc, zB, c2, W2);
    flatBand(G, [[-19.33, zB], [xB, zB], [xB, 25.8]], yc, c2, W2);
    flatBand(G, [[xB, 33.2], [xB, zB2], [-19, zB2]], yc, c2, W2);
    stairBand(G, -19, yc, -5.67, y2, zB2, c2, W2);
    flatBand(G, [[-5.67, zB2], [-1.2, zB2]], y2, c2, W2, { start: 0.6 });
    // —— 黄：2 号线站台 → 楼梯 → 通道 → 换乘楼梯 → 1 号线站台
    // 站台上这一段绕开 x=0 的柱子和垃圾桶（柱子 z 43.6~44.4，正好压在 zY2 上，从站台东边看过来黄带整段被挡）：先走 z=45.1，过了柱子再拐回 zY2 上楼梯
    flatBand(G, [[3.6, 45.1], [-1.6, 45.1], [-1.6, zY2], [-5.67, zY2]], y2, c1, D1, { start: 0.6 });
    stairBand(G, -19, yc, -5.67, y2, zY2, c1, D1, { walkDir: -1 });
    flatBand(G, [[-19, zY2], [xY, zY2], [xY, 33.2]], yc, c1, D1);
    flatBand(G, [[xY, 25.8], [xY, zY], [-19.33, zY]], yc, c1, D1);
    stairBand(G, -6, y1, -19.33, yc, zY, c1, D1, { walkDir: 1 });
    flatBand(G, [[-6, zY], [-3.6, zY]], y1, c1, D1, { start: 0.6 });
    // —— 桥：每块桥板上一段（桥板翻上来拼好时色带才连起来）
    const br = this.bridge, dz = 7 / 6;
    const src = bridgeStripe(this.scene, k.M.band, k.root, dz, [{ dx: xB + 21.5, col: c2, chev: W2, dirZ: 1 }, { dx: xY + 21.5, col: c1, chev: D1, dirZ: -1 }]);
    br.tiles.forEach((t, i) => { const inst = src.createInstance('bridgeStripe' + i); inst.parent = t.pivot; inst.position.set(0, 0, 0); });
    // —— 1 号线站台的牌子
    const W2B = { t: '2', bg: '#FFFFFF', fg: c2 }, big = { kind: 'way', bg: c2, zh: '换乘 2号线', en: 'Transfer to Line 2', badges: [W2B] };
    // 楼梯 / 两部扶梯脚正前方（宽 6.4m 盖住 z 10.8~17.2 三条下来的路）：掉头箭头（往左拐、往回走，和地上的蓝带一致）
    // 内容居中（center）：竖屏（834 宽）下牌子两头会出画，箭头放在左端时被切掉
    k.sign(20.6, y1 + 2.85, 14, { ...big, w: 6.4, h: 1.15, arrow: 'uturn', center: true, face: -Math.PI / 2, double: true, back: { ...big, w: 6.4, h: 1.15, arrow: 'upright' }, hang: y1 + 4.2 });
    // 北侧走道上两块（往西走时正前方）
    for (const x of [9, 2]) k.sign(x, y1 + 2.6, 19.0, { ...big, w: 1.7, h: 0.75, arrow: 'up', en: 'Line 2', face: Math.PI / 2, hang: y1 + 4.8 });
    // 站台两头（下车的人）：往换乘楼梯
    k.sign(36, y1 + 3.25, 14, { ...big, w: 4.4, h: 0.8, arrow: 'up', face: Math.PI / 2, hang: y1 + 4.2 });
    k.sign(-27, y1 + 3.25, 14, { ...big, w: 4.4, h: 0.8, arrow: 'up', face: -Math.PI / 2, hang: y1 + 4.2 });
    // —— 2 号线站台：换乘 1 号线（深色牌 + 黄色条，和 1 号线线路色一致）
    const back1 = { kind: 'way', zh: '换乘 1号线', en: 'Transfer to Line 1', badges: [badge(1)], arrow: 'up', bar: c1 };
    k.sign(20, y2 + 3.25, GYQ2.zc, { ...back1, w: 4.4, h: 0.8, face: Math.PI / 2, hang: y2 + 4.2 });
    k.sign(-28, y2 + 3.25, GYQ2.zc, { ...back1, w: 4.4, h: 0.8, face: -Math.PI / 2, hang: y2 + 4.2 });
  }
  /* ---------------- 每帧 ---------------- */
  update(dt, player, cam, Audio, metro) {
    const p = player.position;
    const pol = this.ticketPolicy;
    this.gates.forEach((g, i) => {
      const lane = Math.abs(p.x - g.x) < 0.75 && Math.abs(p.z - g.z) < 2.0 && Math.abs(p.y - g.y) < 1.5;
      // 出站方向（付费区一侧）：身上没有票卡就直接放行（从站台开始玩、或者测试传送进来都不会被关住）
      if (lane && p.z > g.z + 0.3 && (!pol || pol.autoOut())) { if (g.t < 0.8) { g.t = 0.8; g.beep = true; } }
      // 已经打开的通道：人还在通道里就不关
      if (g.t > 0 && lane && Math.abs(p.z - g.z) < 1.3) g.t = Math.max(g.t, 0.6);
      g.t -= dt;
      const want = g.t > 0;
      if (want && !g.open) { g.open = true; if (g.beep) Audio.sfx('gateBeep'); setTimeout(() => Audio.sfx('gateOpen', { volume: 0.7 }), 120); this.events.emit('gate', { x: g.x, i, beep: g.beep }); g.beep = true; }
      if (!want && g.open) g.open = false;
      g.f += ((g.open ? 1 : 0) - g.f) * Math.min(1, dt * 9);
      g.flaps.forEach(fl => { fl.pv.rotation.y = fl.sd * g.f * Math.PI / 2; });
      g.col.checkCollisions = g.f < 0.6;
      if (g.scrT > 0) { g.scrT -= dt; if (g.scrT <= 0) this.setGateScreen(i, 'idle'); }
    });
    const sc = this.security; sc.cool -= dt; sc.flash -= dt;
    if (Math.abs(p.x) < 0.95 && Math.abs(p.z - sc.z) < 0.45 && Math.abs(p.y - sc.y) < 1.5 && sc.cool <= 0) {
      sc.cool = 2.5; sc.flash = 1.6; sc.belt = 4; Audio.sfx('securityBeep'); this.events.emit('security', {});
    }
    const lit = sc.flash > 0 && Math.sin(sc.flash * 18) > -0.3;
    sc.light.emissiveColor.copyFrom(lit ? new B.Color3(0.24, 0.86, 0.52) : new B.Color3(0.53, 0.63, 0.72));
    sc.belt -= dt; const bs = sc.belt > 0 ? 1.2 : 0.25;
    sc.bags.forEach(b => { b.position.z += bs * dt; if (b.position.z > sc.z + 2.4) b.position.z -= 5.1; });
    for (const e of this.escalators) {
      e.off += dt * 0.55; const L = Math.hypot(e.x1 - e.x0, e.y1 - e.y0), n = e.steps.length;
      e.steps.forEach((st, i) => { let u = ((i / n) * L + e.off * e.dir) % L; if (u < 0) u += L; const f = u / L; st.position.x = e.x0 + (e.x1 - e.x0) * f; st.position.y = e.y0 + (e.y1 - e.y0) * f + 0.06; });
    }
    for (const m of this.mv) m.update(dt, cam, this.events, player);
    this.crowd.update(dt, p);
    for (const pd of this.pids) { pd.t -= dt; if (pd.t <= 0) { pd.t = 1; this.drawPids(pd, metro); } }
  }
  conveyor(p) {
    for (const e of this.escalators) {
      if (p.z < e.z0 || p.z > e.z1 || p.x < e.x0 || p.x > e.x1) continue;
      const yr = e.y0 + (e.y1 - e.y0) * (p.x - e.x0) / (e.x1 - e.x0);
      if (Math.abs(p.y - yr) < 0.6) return e.dir * 0.75;
    }
    return 0;
  }
  zoneOf(p) {
    if (p.y > -3) return { kind: 'street' };
    for (const P of this.platforms) if (Math.abs(p.y - P.y) < 2.2 && p.x > -HALL_X && p.x < HALL_X && p.z > P.zc - WALL_OFF && p.z < P.zc + WALL_OFF) return { kind: 'platform', P };
    if (p.y > YC - 1.5 && p.y < YC + 4 && p.x > -18.5 && p.x < 18.5 && p.z > -20.5 && p.z < 26.5) return { kind: 'concourse', paid: p.z > -2 };
    if (p.y < -12.5 && p.y > -21) return { kind: 'transfer' };
    return { kind: 'passage' };
  }
  platformFor(line) { return this.platforms.find(p => p.line === line); }
  /** 反射探针用的静态网格（不含地面本身） */
  probeMeshes() { return this.kit.meshes.filter(m => !m.name.startsWith('floor') && m.name !== 'shade' && m.name !== 'halo'); }
  dispose() { this.crowd.dispose(); this.pids.forEach(p => { p.tex.dispose(); p.mat.dispose(); }); for (const o of [this.tvmScr, this.gateScr, this.wallMap]) if (o) { o.tex.dispose(); o.mat.dispose(); } this.wallMap = null; this.kit.dispose(); }
}

/** 地面箭头（油漆） */
export function arrow(k, x, y, z, a, col, s = 1) {
  const c = hex(col), P = k.solid;
  const fx = Math.sin(a), fz = Math.cos(a), rx = Math.cos(a), rz = -Math.sin(a);
  const pt = (f, r) => [x + fx * f * s + rx * r * s, y, z + fz * f * s + rz * r * s];
  P.quad(pt(-0.45, -0.11), pt(-0.45, 0.11), pt(0.1, 0.11), pt(0.1, -0.11), c);
  const k0 = P.p.length / 3, A = pt(0.5, 0), B1 = pt(0.05, 0.32), C1 = pt(0.05, -0.32);
  [A, B1, C1].forEach(v => P.push(v[0], v[1], v[2], 0, 1, 0, c));
  P.i.push(k0, k0 + 2, k0 + 1); P.i.push(k0, k0 + 1, k0 + 2);
}
function goat(g, x, y, z, ry, s) {
  const c = hex('#ECE6DA'), P = (lx, lz) => [x + (lx * Math.cos(ry) + lz * Math.sin(ry)) * s, z + (-lx * Math.sin(ry) + lz * Math.cos(ry)) * s];
  let p = P(0, 0); g.ellipsoid(p[0], y + 0.9 * s, p[1], 0.75 * s, 0.62 * s, 1.35 * s, c, 2, ry);
  p = P(0, 0.78); g.ellipsoid(p[0], y + 1.38 * s, p[1], 0.42 * s, 0.46 * s, 0.6 * s, c, 2, ry, -0.4);
  for (const [lx, lz] of [[-0.22, -0.42], [0.22, -0.42], [-0.22, 0.42], [0.22, 0.42]]) { p = P(lx, lz); g.cyl(p[0], y + 0.32 * s, p[1], 0.14 * s, 0.64 * s, c, 8); }
  for (const lx of [-0.13, 0.13]) { p = P(lx, 0.7); g.tubeTaper([p[0], y + 1.6 * s, p[1]], [p[0] + Math.sin(ry) * -0.25 * s, y + 1.75 * s, p[1] + Math.cos(ry) * -0.25 * s], 0.1 * s, 0.04 * s, hex('#C8B68E'), 6); }
}
