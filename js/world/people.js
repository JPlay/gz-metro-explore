/*
 * 人物：精致的低多边形卡通写实小人（圆头、简单五官、衣服款式多样），刚性蒙皮骨骼动画。
 *   - 每个可动的人 = 1 个网格 + 1 套 11 根骨骼（1 次绘制调用），程序化动画：呼吸、东张西望、看手机、挥手、走路 / 跑 / 跳；
 *   - 静态的人（车厢里坐着的乘客）把姿势直接“烘焙”进静态几何，不占额外绘制调用。
 * 骨骼：0 髋 1 脊柱 2 头 3/4 上臂 L/R 5/6 前臂 L/R 7/8 大腿 L/R 9/10 小腿 L/R。人物正面朝局部 +z。
 */
import { Geo, hex, mix } from '../core/geo.js';
const B = window.BABYLON;

const SKIN = ['#F3CFAE', '#EBC09A', '#D9A57C', '#F6DAC0', '#C98D66'];
const TOPS = ['#E8505B', '#3E8EDE', '#F5B841', '#42B883', '#8E6CCF', '#F28C38', '#2BB3B1', '#EF7AA8', '#FFFFFF', '#5C6B7A', '#C8D94A', '#1F3B63'];
const BOTTOMS = ['#2E4A7D', '#3B3F4A', '#6B705C', '#24324A', '#8C6E5A', '#D9D4C7', '#4A5A6E'];
const HAIR = ['#2B1D16', '#1A1414', '#4E3424', '#6B4528', '#9C6B3E', '#3A2A22'];
const SHOES = ['#F2F2F2', '#2B2D31', '#7A4E36', '#3E8EDE', '#E8505B'];
let seed = 11;
export function prnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
export function preseed(s) { seed = 1 + (Math.abs(s) % 2147483000); }
const pick = a => a[Math.floor(prnd() * a.length)];

/** 随机生成一套外形 */
export function randomLook(o = {}) {
  const fem = o.fem ?? prnd() < 0.5;
  return {
    fem, skin: o.skin || pick(SKIN), top: o.top || pick(TOPS), bottom: o.bottom || pick(BOTTOMS), hair: o.hair || pick(HAIR), shoes: o.shoes || pick(SHOES),
    hairStyle: o.hairStyle || (fem ? pick(['long', 'bob', 'bun', 'pony']) : pick(['short', 'short', 'crop', 'side'])),
    skirt: o.skirt ?? (fem && prnd() < 0.4), shorts: o.shorts ?? (!fem && prnd() < 0.25), longSleeve: o.longSleeve ?? prnd() < 0.35,
    bag: o.bag ?? (prnd() < 0.35 ? pick(['backpack', 'shoulder']) : null), bagCol: o.bagCol || pick(['#2B2D31', '#C0392B', '#F5B841', '#3E8EDE', '#7A4E36']),
    glasses: o.glasses ?? prnd() < 0.2, cap: o.cap || null, capCol: o.capCol || '#E8505B',
    scale: o.scale || (0.94 + prnd() * 0.12), kid: !!o.kid, uniform: o.uniform || null, phone: !!o.phone,
    prop: o.prop || null, tie: o.tie || null, collar: !!o.collar, hunch: o.hunch || 0, role: o.role || null, pattern: o.pattern || null
  };
}
/**
 * 四种打招呼的路人（一眼能分清：轮廓 + 道具 + 衣服颜色都不一样，全部复用同一套小人，只多几块道具几何）：
 *   阿婆：灰白发髻、碎花衫、微微驼背，左手挎一篮青菜；学生：蓝白校服（运动服款）、大书包、眼镜；
 *   上班族：白衬衫 + 深色领带 + 深色西裤，右手提公文包；游客：橙色花衬衫、短裤、遮阳帽，胸前挂相机。
 */
export const ARCHETYPES = {
  granny: { role: 'granny', fem: true, skin: '#E9C3A0', top: '#C8507A', pattern: '#F6D7E3', bottom: '#3B3F4A', hair: '#D9D6D0', hairStyle: 'bun', shoes: '#2B2D31', longSleeve: true, skirt: false, bag: null, glasses: false, scale: 0.9, hunch: 0.22, prop: 'basket' },
  student: { role: 'student', fem: false, skin: '#F3CFAE', top: '#FFFFFF', bottom: '#1F4E9C', hair: '#1A1414', hairStyle: 'crop', shoes: '#F2F2F2', longSleeve: true, shorts: false, uniform: null, bag: 'backpack', bagCol: '#E8505B', glasses: true, scale: 0.9, collar: true, tie: '#1F4E9C' },
  office: { role: 'office', fem: false, skin: '#EBC09A', top: '#F4F6F8', bottom: '#24324A', hair: '#2B1D16', hairStyle: 'side', shoes: '#2B2D31', longSleeve: true, shorts: false, bag: null, glasses: false, scale: 1.02, collar: true, tie: '#B3261E', prop: 'briefcase' },
  tourist: { role: 'tourist', fem: true, skin: '#F6DAC0', top: '#F28C38', pattern: '#FFE08A', bottom: '#D9D4C7', hair: '#6B4528', hairStyle: 'pony', shoes: '#3E8EDE', longSleeve: false, skirt: false, shorts: true, bag: null, glasses: false, scale: 0.98, cap: true, capCol: '#F5F1E1', prop: 'camera' }
};
export function archetypeLook(kind) { return randomLook({ ...ARCHETYPES[kind] }); }
/** 骨骼尺寸（成人 / 小孩） */
function dims(L) {
  const k = L.kid;
  return k ? { hip: 0.6, thigh: 0.31, shin: 0.29, torso: 0.4, uarm: 0.22, farm: 0.2, shoulder: 0.17, hipW: 0.075, head: 0.31, neck: 0.04, chestW: 0.3, chestD: 0.18 }
           : { hip: 0.86, thigh: 0.43, shin: 0.43, torso: 0.5, uarm: 0.28, farm: 0.25, shoulder: 0.2, hipW: 0.09, head: 0.29, neck: 0.06, chestW: 0.38, chestD: 0.21 };
}
export function boneDefs(L) {
  const d = dims(L);
  return [
    { n: 'hips', p: -1, o: [0, d.hip, 0] }, { n: 'spine', p: 0, o: [0, 0.02, 0] }, { n: 'head', p: 1, o: [0, d.torso, 0] },
    { n: 'uarmL', p: 1, o: [-d.shoulder, d.torso - 0.06, 0] }, { n: 'uarmR', p: 1, o: [d.shoulder, d.torso - 0.06, 0] },
    { n: 'farmL', p: 3, o: [0, -d.uarm, 0] }, { n: 'farmR', p: 4, o: [0, -d.uarm, 0] },
    { n: 'thighL', p: 0, o: [-d.hipW, 0, 0] }, { n: 'thighR', p: 0, o: [d.hipW, 0, 0] },
    { n: 'shinL', p: 7, o: [0, -d.thigh, 0] }, { n: 'shinR', p: 8, o: [0, -d.thigh, 0] }
  ];
}
/** 各部件几何（骨骼局部坐标，原点在关节） */
function parts(L) {
  const d = dims(L), out = [];
  const P = bone => { const g = new Geo(); out.push({ bone, g }); return g; };
  const skin = hex(L.skin), top = hex(L.uniform ? L.uniform.top : L.top), bottom = hex(L.uniform ? L.uniform.bottom : L.bottom), hair = hex(L.hair), shoe = hex(L.uniform ? '#1B1D20' : L.shoes);
  const legCol = L.shorts || L.skirt ? skin : bottom;
  // 腿
  for (const [t, s] of [[7, 9], [8, 10]]) {
    const th = P(t); th.tubeTaper([0, 0.02, 0], [0, -d.thigh, 0], (L.kid ? 0.13 : 0.15), (L.kid ? 0.1 : 0.115), L.shorts && !L.uniform ? bottom : (L.skirt ? skin : bottom), 10);
    if (L.shorts && !L.uniform) th.tubeTaper([0, -d.thigh * 0.55, 0], [0, -d.thigh, 0], 0.095, 0.09, skin, 10);
    th.sphere(0, -d.thigh, 0, L.kid ? 0.1 : 0.115, legCol, 1);
    const sh = P(s); sh.tubeTaper([0, 0, 0], [0, -d.shin + 0.05, 0], L.kid ? 0.1 : 0.115, L.kid ? 0.075 : 0.085, legCol, 10);
    sh.rbox(0, -d.shin - 0.005, 0.035, L.kid ? 0.1 : 0.11, 0.075, L.kid ? 0.2 : 0.25, shoe, 0.045, 0, { ao: false, bevel: 0.02 });
    sh.rbox(0, -d.shin - 0.01, 0.035, L.kid ? 0.105 : 0.115, 0.02, L.kid ? 0.205 : 0.255, '#F4F4F2', 0.045, 0, { ao: false });
  }
  // 髋 + 躯干
  const hp = P(0);
  hp.ellipsoid(0, 0.0, 0, d.chestW * 0.86, 0.2, d.chestD * 0.95, bottom, 2);
  if (L.skirt && !L.uniform) hp.tubeTaper([0, 0.06, 0], [0, -0.3, 0], d.chestW * 0.85, d.chestW * 1.25, bottom, 14);
  const sp = P(1);
  sp.tubeTaper([0, 0.0, 0], [0, d.torso * 0.62, 0], d.chestW * 0.8, d.chestW * 0.98, top, 14);
  sp.ellipsoid(0, d.torso * 0.66, 0, d.chestW * 1.02, d.torso * 0.5, d.chestD * 1.05, top, 2);
  sp.capsule([-d.shoulder * 0.8, d.torso - 0.07, 0], [d.shoulder * 0.8, d.torso - 0.07, 0], 0.065, 0.065, top, 10);
  if (L.uniform) { // 制服：领口 + 胸前反光条 / 工牌
    sp.ellipsoid(0, d.torso - 0.03, d.chestD * 0.32, 0.12, 0.08, 0.06, '#FFFFFF', 1);
    if (L.uniform.stripe) sp.box(0, d.torso * 0.55, d.chestD * 0.5, d.chestW * 0.95, 0.04, 0.02, L.uniform.stripe, 0, 0, 0, 1, { ao: false });
    sp.box(d.chestW * 0.22, d.torso * 0.72, d.chestD * 0.52, 0.07, 0.09, 0.012, '#E8EEF2', 0, 0, 0, 1, { ao: false });
  } else if (L.pattern) { // 碎花 / 花衬衫：前后几朵小圆花
    const pc = hex(L.pattern);
    for (const [px, py] of [[-0.09, 0.62], [0.08, 0.74], [0.1, 0.5], [-0.07, 0.42], [0.0, 0.86], [-0.12, 0.8]]) for (const sz of [1, -1]) sp.ellipsoid(px * d.chestW / 0.38, d.torso * py, sz * d.chestD * 0.98, 0.028, 0.028, 0.012, pc, 1);
  } else if (L.tie) { // 衬衫领 + 领带
    sp.ellipsoid(0, d.torso - 0.03, d.chestD * 0.36, 0.13, 0.07, 0.06, '#FFFFFF', 1);
    sp.box(0, d.torso * 0.62, d.chestD * 0.56, 0.05, d.torso * 0.5, 0.014, hex(L.tie), 0, 0, 0, 1, { ao: false });
    sp.box(0, d.torso * 0.88, d.chestD * 0.54, 0.06, 0.05, 0.02, hex(L.tie), 0, 0, 0, 1, { ao: false });
  } else if (prnd() < 0.5) sp.box(0, d.torso * 0.64, d.chestD * 0.52, d.chestW * 0.3, d.chestW * 0.2, 0.01, mix(top, [1, 1, 1], 0.32), 0, 0, 0, 1, { ao: false }); // 胸前图案
  if (L.role === 'student') for (const sx of [-1, 1]) sp.box(sx * d.chestW * 0.42, d.torso * 0.5, d.chestD * 0.5 + 0.004, 0.035, d.torso * 0.8, 0.01, hex('#1F4E9C'), 0, 0, 0, 1, { ao: false }); // 校服前襟两条蓝边（以前 x 用了整个胸宽，蓝条飘在身体外面）
  if (L.prop === 'camera') { // 胸前挂相机 + 背带
    sp.rbox(0, d.torso * 0.48, d.chestD * 0.62 + 0.04, 0.16, 0.1, 0.07, '#2B2D31', 0.02, 0, { ao: false });
    sp.cyl(0.02, d.torso * 0.48 + 0.05, d.chestD * 0.62 + 0.1, 0.07, 0.06, '#1B1D20', 12, 0, Math.PI / 2, 0);
    sp.sphere(0.02, d.torso * 0.48 + 0.05, d.chestD * 0.62 + 0.135, 0.025, '#7FB8E8', 1);
    for (const sx of [-1, 1]) sp.tube([sx * 0.07, d.torso * 0.5, d.chestD * 0.62], [sx * 0.11, d.torso * 0.98, d.chestD * 0.2], 0.012, '#2B2D31', 4);
  }
  if (L.bag === 'backpack') { sp.rbox(0, d.torso * 0.18, -d.chestD * 0.55 - 0.06, d.chestW * 0.85, d.torso * 0.62, 0.14, L.bagCol, 0.05, 0, { ao: false, bevel: 0.03, bottom: true }); for (const sx of [-1, 1]) sp.tube([sx * d.chestW * 0.3, d.torso * 0.85, -d.chestD * 0.5], [sx * d.chestW * 0.3, d.torso * 0.85, d.chestD * 0.42], 0.035, L.bagCol, 6); }
  // 头
  const hd = P(2), hr = d.head, hy = d.neck + hr * 0.48;
  hd.tubeTaper([0, -0.02, 0], [0, d.neck + 0.03, 0], 0.085, 0.075, skin, 8);
  hd.ellipsoid(0, hy, 0.005, hr, hr * 1.06, hr * 0.98, skin, 3);
  // 头发
  const hc = hair;
  if (L.cap) {
    hd.ellipsoid(0, hy + hr * 0.12, -hr * 0.14, hr * 1.06, hr * 0.9, hr * 1.0, hc, 2);
    hd.ellipsoid(0, hy + hr * 0.4, -hr * 0.04, hr * 1.13, hr * 0.7, hr * 1.12, L.capCol, 2); // 帽冠完全盖住头发
    hd.ellipsoid(0, hy + hr * 0.28, hr * 0.55, hr * 0.88, hr * 0.07, hr * 0.55, L.capCol, 2);  // 帽檐（略收，避免顶视时像第二块红帽）
  } else {
    hd.ellipsoid(0, hy + hr * 0.17, -hr * 0.13, hr * 1.08, hr * 0.94, hr * 1.0, hc, 2);
    hd.ellipsoid(0, hy + hr * 0.3, hr * 0.22, hr * 0.92, hr * 0.32, hr * 0.5, hc, 2); // 刘海
    if (L.hairStyle === 'long') hd.ellipsoid(0, hy - hr * 0.3, -hr * 0.22, hr * 1.02, hr * 1.2, hr * 0.62, hc, 2);
    if (L.hairStyle === 'bob') hd.ellipsoid(0, hy - hr * 0.08, -hr * 0.08, hr * 1.12, hr * 0.8, hr * 1.0, hc, 2);
    if (L.hairStyle === 'bun') hd.sphere(0, hy + hr * 0.62, -hr * 0.28, hr * 0.42, hc, 2);
    if (L.hairStyle === 'pony') hd.ellipsoid(0, hy - hr * 0.15, -hr * 0.55, hr * 0.28, hr * 0.7, hr * 0.28, hc, 2, 0, 0.25);
    if (L.hairStyle === 'side') hd.ellipsoid(hr * 0.15, hy + hr * 0.38, hr * 0.05, hr * 0.8, hr * 0.3, hr * 0.9, hc, 2);
  }
  if (L.uniform && L.uniform.cap) { hd.ellipsoid(0, hy + hr * 0.42, 0, hr * 1.12, hr * 0.42, hr * 1.12, L.uniform.cap, 2); hd.ellipsoid(0, hy + hr * 0.3, hr * 0.5, hr * 0.8, hr * 0.07, hr * 0.5, '#1B1D20', 2); }
  // 五官：眼睛、眉毛、腮红、嘴
  const fz = hr * 0.47;
  for (const sx of [-1, 1]) {
    hd.ellipsoid(sx * hr * 0.17, hy + hr * 0.02, fz, hr * 0.1, hr * 0.145, hr * 0.06, '#22201F', 1);
    hd.sphere(sx * hr * 0.15, hy + hr * 0.05, fz + hr * 0.025, hr * 0.03, '#FFFFFF', 1);
    hd.box(sx * hr * 0.17, hy + hr * 0.15, fz - hr * 0.01, hr * 0.13, hr * 0.025, hr * 0.03, hc, 0, 0, sx * -0.12, 1, { ao: false });
    hd.ellipsoid(sx * hr * 0.27, hy - hr * 0.1, fz - hr * 0.06, hr * 0.12, hr * 0.06, hr * 0.04, mix(skin, hex('#F08A8A'), 0.45), 1);
  }
  hd.ellipsoid(0, hy - hr * 0.17, fz - hr * 0.015, hr * 0.12, hr * 0.035, hr * 0.04, '#B5574F', 1);
  hd.sphere(0, hy - hr * 0.05, fz + hr * 0.01, hr * 0.06, mix(skin, [0.85, 0.6, 0.5], 0.2), 1);
  if (L.glasses) for (const sx of [-1, 1]) { hd.tube([sx * hr * 0.06, hy + hr * 0.03, fz + 0.012], [sx * hr * 0.28, hy + hr * 0.03, fz + 0.005], 0.012, '#2B2D31', 5); hd.tube([sx * hr * 0.06, hy - hr * 0.08, fz + 0.012], [sx * hr * 0.28, hy - hr * 0.08, fz + 0.005], 0.012, '#2B2D31', 5); }
  // 手臂
  const sleeve = L.longSleeve || L.uniform ? top : skin;
  for (const [u, f] of [[3, 5], [4, 6]]) {
    const ua = P(u); ua.capsule([0, 0, 0], [0, -d.uarm * 0.55, 0], 0.062, 0.058, top, 10); ua.tubeTaper([0, -d.uarm * 0.5, 0], [0, -d.uarm, 0], 0.11, 0.1, sleeve, 10); ua.sphere(0, -d.uarm, 0, 0.1, sleeve, 1);
    const fa = P(f); fa.tubeTaper([0, 0, 0], [0, -d.farm, 0], 0.095, 0.075, sleeve, 10);
    fa.ellipsoid(0, -d.farm - 0.04, 0.005, 0.085, 0.1, 0.06, skin, 2);
  }
  if (L.prop === 'basket') { // 左手挎菜篮：竹篮 + 提手 + 青菜 / 一根红萝卜
    const g = out.find(q => q.bone === 5).g, by = -d.farm - 0.2;
    g.rbox(0, by - 0.1, 0.05, 0.3, 0.17, 0.2, '#C9A063', 0.04, 0, { ao: false, bottom: true });
    for (let k = 0; k < 4; k++) g.slab(-0.152, 0.152, by - 0.09 + k * 0.035, by - 0.08 + k * 0.035, -0.052, 0.152, hex('#A8834A'), { ao: false });
    g.tube([-0.12, by + 0.06, 0.05], [0, -d.farm - 0.02, 0.03], 0.014, '#8C6A38', 5); g.tube([0.12, by + 0.06, 0.05], [0, -d.farm - 0.02, 0.03], 0.014, '#8C6A38', 5);
    for (const [vx, vz, c] of [[-0.08, 0.02, '#4FA34A'], [0.0, 0.08, '#6CC24A'], [0.08, 0.0, '#3E8E3E']]) g.ellipsoid(vx, by + 0.06, vz, 0.06, 0.09, 0.05, hex(c), 1);
    g.tube([0.06, by + 0.02, 0.1], [0.13, by + 0.1, 0.13], 0.022, '#F28C38', 5);
  }
  if (L.prop === 'briefcase') { const g = out.find(q => q.bone === 6).g, by = -d.farm - 0.2; g.rbox(0, by - 0.14, 0.0, 0.08, 0.26, 0.36, '#4A3426', 0.03, 0, { ao: false, bottom: true }); g.tube([0, by + 0.12, -0.06], [0, by + 0.12, 0.06], 0.015, '#2B2D31', 5); g.box(0.042, by - 0.02, 0, 0.005, 0.03, 0.06, '#E0B84A', 0, 0, 0, 1, { ao: false }); }
  if (L.phone) out.find(q => q.bone === 6).g.rbox(0, -d.farm - 0.1, 0.035, 0.075, 0.14, 0.012, '#1B1D20', 0.01, 0, { ao: false });
  if (L.bag === 'shoulder') out.find(q => q.bone === 1).g.rbox(-d.chestW * 0.62, -0.12, 0.02, 0.08, 0.26, 0.3, L.bagCol, 0.05, 0, { ao: false, bottom: true });
  return out;
}
/** 正向运动学：pose = {骨骼编号: [rx, ry, rz]} → 每根骨骼的绝对矩阵（局部 → 人物空间） */
function fk(defs, pose = {}) {
  const abs = [];
  defs.forEach((b, i) => {
    const r = pose[i] || [0, 0, 0], local = B.Matrix.Compose(new B.Vector3(1, 1, 1), B.Quaternion.RotationYawPitchRoll(r[1], r[0], r[2]), new B.Vector3(...b.o));
    abs[i] = b.p < 0 ? local : local.multiply(abs[b.p]);
  });
  return abs;
}
/** 烘焙静态人物到 g（世界坐标 x,y,z，朝向 ry），pose 可用 POSES.* */
export function bakePerson(g, x, y, z, ry, look, pose = POSES.stand) {
  const L = look.fem !== undefined ? look : randomLook(look), defs = boneDefs(L), abs = fk(defs, pose), s = L.scale;
  const world = B.Matrix.Compose(new B.Vector3(s, s, s), B.Quaternion.RotationYawPitchRoll(ry, 0, 0), new B.Vector3(x, y, z));
  for (const { bone, g: pg } of parts(L)) g.merge(pg, abs[bone].multiply(world));
  return L;
}
export const POSES = {
  stand: { 3: [0, 0, 0.08], 4: [0, 0, -0.08], 5: [-0.15, 0, 0], 6: [-0.15, 0, 0] },
  sit: { 7: [-1.5, 0, 0.04], 8: [-1.5, 0, -0.04], 9: [1.5, 0, 0], 10: [1.5, 0, 0], 3: [-0.3, 0, 0.1], 4: [-0.3, 0, -0.1], 5: [-0.9, 0, 0], 6: [-0.9, 0, 0], 0: [0, 0, 0] },
  sitPhone: { 7: [-1.5, 0, 0.04], 8: [-1.5, 0, -0.04], 9: [1.5, 0, 0], 10: [1.5, 0, 0], 3: [-0.3, 0, 0.1], 4: [-0.35, 0, -0.15], 5: [-0.9, 0, 0], 6: [-1.5, 0.3, 0], 2: [0.35, 0, 0] }
};

/** 脚下的圆形软阴影：顶点透明度做的圆盘（中心深、边缘渐隐），用 shade 材质，可做实例 */
export function makeBlob(scene, M, name = 'blob', r = 0.42, a = 0.78) {
  const g = new Geo(), seg = 20, k0 = 0;
  g.push(0, 0, 0, 0, 1, 0, [0, 0, 0], a);
  for (const [rr, aa] of [[0.55, a * 0.62], [1, 0]]) for (let s = 0; s < seg; s++) { const t = s / seg * Math.PI * 2; g.push(Math.cos(t) * r * rr, 0, Math.sin(t) * r * rr, 0, 1, 0, [0, 0, 0], aa); }
  for (let s = 0; s < seg; s++) { const n = (s + 1) % seg; g.i.push(k0, k0 + 1 + s, k0 + 1 + n); g.i.push(k0 + 1 + s, k0 + 1 + seg + n, k0 + 1 + n, k0 + 1 + s, k0 + 1 + seg + s, k0 + 1 + seg + n); }
  const m = g.toMesh(name, scene, M.shade, null, { alpha: true }); m.alphaIndex = 2; m.isPickable = false;
  return m;
}
/** 可动的人（1 个蒙皮网格） */
export class Person {
  constructor(scene, mat, look, { name = 'npc', parent, build } = {}) {
    const L = this.look = look.fem !== undefined ? look : randomLook(look);
    // build = { defs(L), parts(L) }：给玩家主角用的自定义骨骼 / 几何（NPC 不传，走默认）
    const defs = this.defs = build ? build.defs(L) : boneDefs(L), restAbs = fk(defs);
    const g = new Geo().withBones();
    for (const { bone, g: pg } of (build ? build.parts(L) : parts(L))) { g.bone = bone; g.merge(pg, restAbs[bone]); }
    const sk = this.skeleton = new B.Skeleton(name + 'Sk', name + 'Sk' + Math.random(), scene);
    const bones = this._b = [];
    defs.forEach(b => bones.push(new B.Bone(b.n, sk, b.p < 0 ? null : bones[b.p], B.Matrix.Translation(...b.o))));
    const m = this.mesh = g.toMesh(name, scene, mat);
    m.skeleton = sk; m.numBoneInfluencers = 1; if (parent) m.parent = parent;
    m.scaling.setAll(L.scale);
    this.root = m; this.t = prnd() * 10; this.mode = 'idle'; this.phase = 0; this.speed = 0;
    this.lookYaw = 0; this.lookT = 2 + prnd() * 4; this.lookTarget = 0; this.air = 0;
    this.q = defs.map(() => new B.Quaternion());
  }
  setBone(i, rx, ry = 0, rz = 0) { B.Quaternion.RotationYawPitchRollToRef(ry, rx, rz, this.q[i]); this._b[i].setRotationQuaternion(this.q[i], B.Space.LOCAL); }
  /** 程序化动画。mode: idle | phone | wave | walk | run | jump | sit */
  animate(dt, o = {}) {
    this.t += dt; const t = this.t, mode = o.mode || this.mode, sp = o.speed ?? this.speed;
    const breath = Math.sin(t * 1.7) * 0.025, hunch = this.look.hunch || 0;
    // 东张西望
    this.lookT -= dt; if (this.lookT < 0) { this.lookT = 2.5 + prnd() * 5; this.lookTarget = (prnd() - 0.5) * (mode === 'phone' ? 0.3 : 1.0); }
    this.lookYaw += (this.lookTarget - this.lookYaw) * Math.min(1, dt * 2.5);
    if (mode === 'walk' || mode === 'run') {
      const run = mode === 'run', k = Math.min(1, sp / (run ? 6 : 3));
      this.phase += dt * (sp * (run ? 1.9 : 2.6) + 0.5);
      const s = Math.sin(this.phase), c = Math.cos(this.phase), amp = (run ? 0.95 : 0.6) * Math.max(0.35, k);
      this.setBone(7, s * amp - (run ? 0.15 : 0), 0, 0.02); this.setBone(8, -s * amp - (run ? 0.15 : 0), 0, -0.02);
      this.setBone(9, Math.max(0, -c) * amp * 1.3 + 0.08, 0, 0); this.setBone(10, Math.max(0, c) * amp * 1.3 + 0.08, 0, 0);
      this.setBone(3, -s * amp * 0.8, 0, 0.1); this.setBone(4, s * amp * 0.8, 0, -0.1);
      this.setBone(5, run ? -1.3 : -0.35, 0, 0); this.setBone(6, run ? -1.3 : -0.35, 0, 0);
      this.setBone(1, run ? 0.22 : 0.05, s * 0.06, 0); this.setBone(2, run ? -0.15 : -0.03, -s * 0.05, 0);
      this.setBone(0, 0, 0, 0); this.hipBob = Math.abs(c) * (run ? 0.06 : 0.03);
    } else if (mode === 'jump') {
      this.setBone(7, -0.9, 0, 0.05); this.setBone(8, -0.4, 0, -0.05); this.setBone(9, 1.2, 0, 0); this.setBone(10, 0.6, 0, 0);
      this.setBone(3, -2.6, 0, 0.35); this.setBone(4, -2.6, 0, -0.35); this.setBone(5, -0.3, 0, 0); this.setBone(6, -0.3, 0, 0);
      this.setBone(1, -0.05, 0, 0); this.setBone(2, 0.1, 0, 0); this.hipBob = 0;
    } else {
      // 站立类
      for (const i of [7, 8, 9, 10, 0]) this.setBone(i, 0, 0, i === 7 ? 0.03 : i === 8 ? -0.03 : 0);
      this._b[1].setScale(new B.Vector3(1, 1 + breath * 0.4, 1 + breath * 0.6));
      this.setBone(1, 0.02 + breath * 0.2 + hunch, 0, 0);
      if (mode === 'phone') {
        this.setBone(2, 0.42, this.lookYaw * 0.3, 0); this.setBone(3, 0.05, 0, 0.12); this.setBone(5, -0.2, 0, 0);
        this.setBone(4, -0.35, -0.25, -0.15); this.setBone(6, -1.45, 0.35, 0);
      } else if (mode === 'wave') {
        // 挥空着的那只手：公文包/手机在右手 → 挥左手；菜篮在左手 → 挥右手；胸前相机两手都空，默认挥右手
        const w = Math.sin(t * 6) * 0.35, prop = this.look.prop;
        const waveLeft = prop === 'briefcase' || this.look.phone;
        this.setBone(2, 0, this.lookYaw * 0.4, 0);
        if (waveLeft) {
          this.setBone(4, 0, 0, -0.08); this.setBone(6, -0.15, 0, 0);
          this.setBone(3, 0, 0, 2.5 - w * 0.3); this.setBone(5, 0, 0, 0.5 - w);
        } else {
          this.setBone(3, 0, 0, 0.08); this.setBone(5, -0.15, 0, 0);
          this.setBone(4, 0, 0, -2.5 + w * 0.3); this.setBone(6, 0, 0, -0.5 + w);
        }
      } else if (mode === 'chat') {
        // 聊天：边说边点头、一只手比划，偶尔笑得往后仰
        const g = Math.sin(t * 2.3), n = Math.sin(t * 4.1) * 0.06;
        this.setBone(2, -0.02 + n, this.lookYaw * 0.3, Math.sin(t * 0.9) * 0.05); this.setBone(3, 0.02, 0, 0.1); this.setBone(5, -0.2, 0, 0);
        this.setBone(4, -0.55 - g * 0.18, 0.2, -0.25); this.setBone(6, -1.1 + g * 0.3, 0.3 * g, 0);
      } else if (mode === 'point') {
        // 指路：右臂伸直指向 o.pointYaw（相对身体朝向，弧度）
        const py = this.pointYaw || 0;
        this.setBone(2, 0.02, py * 0.6, 0); this.setBone(3, 0, 0, 0.08); this.setBone(5, -0.15, 0, 0);
        this.setBone(4, -1.45, py, -0.05); this.setBone(6, -0.1, 0, 0);
      } else if (mode === 'sit' || mode === 'sitPhone' || mode === 'sitChat') {
        this.setBone(7, -1.5, 0, 0.04); this.setBone(8, -1.5, 0, -0.04); this.setBone(9, 1.5, 0, 0); this.setBone(10, 1.5, 0, 0);
        this.setBone(3, -0.3, 0, 0.1); this.setBone(4, -0.3, 0, -0.1); this.setBone(5, -0.9, 0, 0); this.setBone(6, -0.9, 0, 0); this.setBone(2, 0.05, this.lookYaw, 0);
        if (mode === 'sitPhone') { this.setBone(4, -0.35, 0, -0.15); this.setBone(6, -1.5 + Math.sin(t * 0.7) * 0.05, 0.3, 0); this.setBone(2, 0.38, this.lookYaw * 0.2, 0); }
        if (mode === 'sitChat') { const g = Math.sin(t * 2.1); this.setBone(2, Math.sin(t * 3.7) * 0.06, (this.chatYaw || 0) + Math.sin(t * 0.6) * 0.1, 0); this.setBone(6, -1.2 + g * 0.25, 0.2 * g, 0); }
      } else {
        const sw = Math.sin(t * 1.1) * 0.03;
        this.setBone(2, -0.02, this.lookYaw, 0); this.setBone(3, sw, 0, 0.08); this.setBone(4, -sw, 0, -0.08); this.setBone(5, -0.15, 0, 0); this.setBone(6, -0.15, 0, 0);
      }
      this.hipBob = 0;
    }
    // 叠加：点头（坐在旁边的人看你一眼、点点头）——头转向 nodYaw，上下点两下
    if (this.nodT > 0) {
      this.nodT -= dt; const k = Math.min(1, this.nodT / 0.3, (1.8 - this.nodT) / 0.3), ph = (1.8 - this.nodT) * 7;
      this.setBone(2, Math.max(0, Math.sin(ph)) * 0.32 * k, (this.nodYaw || 0) * k, 0);
    }
  }
  nod(yaw) { this.nodT = 1.8; this.nodYaw = yaw; }
  dispose() { this.mesh.dispose(); this.skeleton.dispose(); }
}

/**
 * NPC 管理：站着的（idle / phone / wave）和沿路线走动的；离玩家远的不更新动画。
 * 每个 NPC 下面一个小圆形软阴影（实例）。
 */
export class Crowd {
  constructor(scene, M, parent) { this.scene = scene; this.M = M; this.parent = parent; this.list = []; this.blobSrc = null; }
  blob() {
    if (!this.blobSrc) { const b = this.blobSrc = makeBlob(this.scene, this.M, 'npcBlob', 0.46); b.isVisible = false; b.parent = this.parent; }
    const i = this.blobSrc.createInstance('nb'); i.parent = this.parent; i.isPickable = false; return i;
  }
  add(x, y, z, ry, look, mode = 'idle') {
    const p = new Person(this.scene, this.M.paint, look, { parent: this.parent });
    p.mesh.position.set(x, y, z); p.mesh.rotation.y = ry; p.mode = mode;
    const sh = this.blob(); sh.position.set(x, y + 0.012, z);
    const n = { p, sh, path: null };
    this.list.push(n); p.animate(0.016);
    return n;
  }
  /** 沿闭合路线走：pts = [[x,z],...] */
  walker(pts, y, look, speed = 1.25) {
    const n = this.add(pts[0][0], y, pts[0][1], 0, look, 'walk');
    n.path = pts; n.i = 1; n.speed = speed; n.wait = 0; n.y = y; n.p.speed = speed; n.bx = pts[0][0]; n.bz = pts[0][1]; n.off = 0; n.offWant = 0; n.sayCool = 0;
    return n;
  }
  /** 临时动作：转身朝 yaw、做 mode（wave / point / chat…）dur 秒，之后慢慢转回原来的朝向和动作 */
  act(n, mode, yaw, dur = 2.5, extra = {}) { n.act = { mode, yaw, t: dur, dur0: dur, ...extra }; if (n.ry0 === undefined) n.ry0 = n.p.mesh.rotation.y; }
  turnTo(m, want, k) { let dr = want - m.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); m.rotation.y += dr * Math.min(1, k); }
  update(dt, focus) {
    for (const n of this.list) {
      const m = n.p.mesh, d2 = focus ? (m.position.x - focus.x) ** 2 + (m.position.z - focus.z) ** 2 + ((m.position.y - focus.y) * 3) ** 2 : 0;
      const near = d2 < 45 * 45;
      if (n.act) {
        const a = n.act; a.t -= dt; this.turnTo(m, a.yaw, dt * 7); n.p.pointYaw = a.pointYaw || 0;
        n.p.animate(dt, { mode: a.t > (a.pointAfter ? a.dur0 - a.pointAfter : 1e9) ? 'idle' : a.mode });
        if (a.t <= 0) n.act = null;
        continue;
      }
      if (n.ry0 !== undefined && !n.path) { this.turnTo(m, n.ry0, dt * 3); if (Math.abs(Math.atan2(Math.sin(n.ry0 - m.rotation.y), Math.cos(n.ry0 - m.rotation.y))) < 0.01) n.ry0 = undefined; }
      if (n.path) {
        if (n.wait > 0) { n.wait -= dt; if (near) n.p.animate(dt, { mode: 'idle' }); }
        else {
          const t = n.path[n.i], dx = t[0] - n.bx, dz = t[1] - n.bz, d = Math.hypot(dx, dz);
          if (d < 0.2) { n.i = (n.i + 1) % n.path.length; if (prnd() < 0.3) n.wait = 1 + prnd() * 2.5; }
          else {
            const fx = dx / d, fz = dz / d;
            // 让路：玩家在前方 1.8m 以内（同一层）→ 往离玩家远的一侧横挪 0.9m，走过去再慢慢回到路线上
            let want = 0;
            if (focus && Math.abs(focus.y - n.y) < 1.5) {
              const px = focus.x - n.bx, pz = focus.z - n.bz, ahead = px * fx + pz * fz, lat = px * fz - pz * fx;
              if (ahead > -0.4 && ahead < 1.8 && Math.abs(lat - n.off) < 1.0) want = lat > n.off * 0.5 ? -0.9 : 0.9;
            }
            if (want && !n.offWant && n.sayCool <= 0 && this.onSidestep) { n.sayCool = 7; this.onSidestep(n); }
            n.offWant = want; n.sayCool -= dt;
            n.off += ((want || 0) - n.off) * Math.min(1, dt * (want ? 4 : 1.2));
            const slow = want ? 0.6 : 1, step = Math.min(d, n.speed * slow * dt); n.bx += fx * step; n.bz += fz * step;
            m.position.x = n.bx + fz * n.off; m.position.z = n.bz - fx * n.off;
            this.turnTo(m, Math.atan2(fx, fz) + (want ? Math.sign(-want) * 0.0 : 0), dt * 6);
            if (near) n.p.animate(dt, { mode: 'walk', speed: n.speed * slow });
          }
          m.position.y = n.y + (n.p.hipBob || 0) * 0.5;
          n.sh.position.x = m.position.x; n.sh.position.z = m.position.z;
        }
      } else if (near) n.p.animate(dt);
    }
  }
  dispose() { this.list.forEach(n => { n.p.dispose(); n.sh.dispose(); }); this.list = []; if (this.blobSrc) this.blobSrc.dispose(); }
}
export { hex };
