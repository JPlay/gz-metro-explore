/*
 * 玩家主角：8 岁小男孩（玩这个游戏的孩子本人的卡通玩具版）。
 *   - 蜂蜜金色锅盖头 + 齐眉厚刘海；白皙皮肤；透明镜框 + 淡粉色半透明镜片的圆眼镜；
 *   - 浅麻灰圆领 T 恤（胸前几个小彩色方块印花）；宽松浅蓝绿阔腿裤（白色五角星）；浅灰白洞洞鞋；
 *   - 浅蓝挂绳 + 胸前卡套（就是他的羊城通）；白色双肩小书包；约 1.3m、大头的儿童比例。
 *   - 全部是简单几何体 + 顶点色，合并成 1 个蒙皮网格（星星 / 印花也是顶点色几何，不加贴图）；
 *     只有眼镜（镜片 + 透明镜框）单独 1 个半透明网格，共用同一套骨骼 → 一共 2 次绘制调用。
 * 骨骼 = people.js 的 11 根 + 第 12 根“右手手指”（平时缩成 0，打招呼时伸出食指和小指 🤘）。
 * 两个招牌动作：wave（打招呼）= 举起右手比 🤘；cheer（到站下车庆祝）= 两只拳头举过肩膀“努力！”。
 */
import { Geo, hex, mix } from '../core/geo.js';
import { Person, boneDefs } from '../world/people.js';
const B = window.BABYLON;

export const HERO_LOOK = {
  fem: false, kid: true, skin: '#F7DDCB', top: '#CDCED0', bottom: '#86C6D8', hair: '#CF9C58', shoes: '#E6E8EA',
  hairStyle: 'bowl', skirt: false, shorts: false, longSleeve: false, bag: 'backpack', bagCol: '#F4F4F0', glasses: true,
  cap: null, scale: 0.9, uniform: null, phone: false, prop: null, tie: null, collar: false, hunch: 0, role: 'hero', pattern: null
};
const COL = {
  hair: hex('#CF9C58'), hairDark: hex('#B07E44'), hairHi: hex('#E2B676'),
  shirt: hex('#CDCED0'), shirtDark: hex('#B7B9BC'), pants: hex('#86C6D8'), pantsDark: hex('#74B4C8'), star: hex('#FBFCFD'),
  clog: hex('#E6E8EA'), clogSole: hex('#CDD1D6'), hole: hex('#8E959D'), lanyard: hex('#86C3EA'), lanyardHi: hex('#FFFFFF'),
  bag: hex('#F4F4F0'), bagDark: hex('#DCDDD8'), eye: hex('#2A2522'), mouth: hex('#D08A80'),
  prints: ['#E8505B', '#F5B841', '#2BB3B1', '#F28C38', '#8E6CCF', '#42B883'].map(hex)
};
// 小孩骨骼尺寸（与 people.js 的 kid 一致，髋高 0.6 → 坐姿公式不变）
const D = { hip: 0.6, thigh: 0.31, shin: 0.29, torso: 0.4, uarm: 0.22, farm: 0.2, shoulder: 0.17, hipW: 0.075, head: 0.35, neck: 0.04, chestW: 0.3, chestD: 0.18 };
export const HAND_R = 11;

function heroDefs(L) {
  const d = boneDefs(L);
  d.push({ n: 'fingersR', p: 6, o: [0, -D.farm - 0.05, 0.005] });
  return d;
}

/** 在曲面上贴一个平面五角星（顶点色几何）：c = 中心，n = 外法线，up = 星星“上”方向，r = 外半径 */
function star(g, c, n, up, r, col) {
  const N = new B.Vector3(...n).normalize(), U0 = new B.Vector3(...up);
  const R = B.Vector3.Cross(U0, N).normalize(), U = B.Vector3.Cross(N, R).normalize();
  const k = g.p.length / 3, o = 0.0035;
  g.push(c[0] + N.x * o, c[1] + N.y * o, c[2] + N.z * o, N.x, N.y, N.z, col);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, rr = i % 2 ? r * 0.42 : r, x = Math.sin(a) * rr, y = Math.cos(a) * rr;
    g.push(c[0] + (R.x * x + U.x * y) + N.x * o, c[1] + (R.y * x + U.y * y) + N.y * o, c[2] + (R.z * x + U.z * y) + N.z * o, N.x, N.y, N.z, col);
  }
  // 两面都画（左右腿镜像时不怕法线朝向）
  for (let i = 0; i < 10; i++) { const a = k + 1 + i, b = k + 1 + (i + 1) % 10; g.i.push(k, a, b, k, b, a); }
}
/** 在竖直圆台（沿 -y，半径 r0→r1，长 len）表面撒星星 */
function starsOnLeg(g, y0, len, r0, r1, spots, sr) {
  for (const [ang, t] of spots) {
    const y = y0 - len * t, r = (r0 + (r1 - r0) * t) + 0.002, x = Math.sin(ang) * r, z = Math.cos(ang) * r;
    star(g, [x, y, z], [Math.sin(ang), 0, Math.cos(ang)], [0, 1, 0], sr, COL.star);
  }
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/**
 * 锅盖头发壳（头骨骼局部坐标）：椭球面从头顶往下长到“下沿”，下沿高度随方位角变化——
 *   正前方 = 眉毛（平直一刀切的厚刘海），两侧 = 耳朵中间（盖住耳朵上半），后脑 = 发际线；
 *   下沿有一圈向里收的厚度（看得出是一层厚头发，不是帽子），越往下越蓬；顶点色做发丝明暗 + 头顶高光。
 */
function bowlCut(g, hr, hy) {
  const cx = 0, cy = hy + hr * 0.06, cz = -hr * 0.05, Rx = hr * 0.61, Ry = hr * 0.6, Rz = hr * 0.62;
  const front = hy + hr * 0.13, side = hy - hr * 0.07, back = hy - hr * 0.3;
  const edgeY = th => { const a = Math.abs(Math.atan2(Math.sin(th), Math.cos(th))); return front + (side - front) * smooth(0.55, 1.25, a) + (back - side) * smooth(1.6, 2.6, a); };
  const NT = 56, NP = 14, k0 = g.p.length / 3, W = NT + 1;
  const col = (th, f, y) => {
    const strand = 0.965 + 0.035 * Math.sin(th * 46 + f * 3), lowDark = 1 - 0.14 * f * f;
    const hi = Math.max(0, 1 - Math.hypot((y - (hy + hr * 0.42)) / (hr * 0.16), Math.atan2(Math.sin(th), Math.cos(th)) / 0.9)) * 0.5;
    return mix(COL.hair, COL.hairHi, hi).map(c => c * strand * lowDark);
  };
  const ring = [];
  for (let j = 0; j <= NP; j++) for (let i = 0; i <= NT; i++) {
    const th = i / NT * Math.PI * 2, f = j / NP, pm = Math.acos(Math.max(-1, Math.min(1, (edgeY(th) - cy) / Ry))), ph = pm * f;
    const puff = 1 + 0.07 * Math.pow(f, 2.2);
    const x = cx + Rx * puff * Math.sin(ph) * Math.sin(th), y = cy + Ry * Math.cos(ph), z = cz + Rz * puff * Math.sin(ph) * Math.cos(th);
    const n = new B.Vector3((x - cx) / (Rx * Rx), (y - cy) / (Ry * Ry), (z - cz) / (Rz * Rz)).normalize();
    g.push(x, y, z, n.x, n.y, n.z, col(th, f, y));
    if (j === NP) ring.push([x, y, z, th]);
  }
  for (let j = 0; j < NP; j++) for (let i = 0; i < NT; i++) { const a = k0 + j * W + i, b = a + W; g.i.push(a, a + 1, b, a + 1, b + 1, b); }
  // 下沿厚度：外沿 → 向里 0.07hr 的内沿（法线朝下），再往上折进去一点
  const k1 = g.p.length / 3, dark = COL.hairDark;
  for (const [x, y, z] of ring) g.push(x, y, z, 0, -1, 0, dark);
  for (const [x, y, z] of ring) { const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1; g.push(x - dx / l * hr * 0.075, y + hr * 0.005, z - dz / l * hr * 0.075, 0, -1, 0, dark); }
  for (const [x, y, z] of ring) { const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1; g.push(x - dx / l * hr * 0.09, y + hr * 0.08, z - dz / l * hr * 0.09, -dx / l, 0, -dz / l, dark); }
  for (let r = 0; r < 2; r++) for (let i = 0; i < NT; i++) { const a = k1 + r * W + i, b = a + W; g.i.push(a, b, a + 1, a + 1, b, b + 1, a, a + 1, b, a + 1, b + 1, b); } // 双面，哪个角度看下沿都实
}

function heroParts(L) {
  const d = D, out = [];
  const P = bone => { const g = new Geo(); out.push({ bone, g }); return g; };
  const skin = hex(L.skin), H = COL.hair;
  // —— 腿：宽松阔腿裤（浅蓝绿 + 白星星），裤脚微微收口；洞洞鞋 ——
  const legSpots = [[[0.3, 0.25], [-0.9, 0.55], [1.9, 0.35], [2.9, 0.7], [-2.2, 0.2], [0.9, 0.8], [-0.2, 0.62], [3.9, 0.45]],
                    [[0.1, 0.22], [-1.1, 0.5], [1.4, 0.62], [2.6, 0.28], [-2.4, 0.72], [0.7, 0.88], [-0.4, 0.58], [3.6, 0.15]]];
  [[7, 9, -1], [8, 10, 1]].forEach(([t, s, sx], li) => {
    const th = P(t);
    // 灯笼阔腿裤：大腿到小腿越来越鼓，脚踝处收口
    th.tubeTaper([0, 0.03, 0], [0, -d.thigh, 0], 0.19, 0.215, COL.pants, 14);
    th.sphere(0, -d.thigh, 0, 0.215, COL.pants, 2);
    starsOnLeg(th, 0.0, d.thigh * 0.95, 0.095, 0.107, legSpots[li].slice(0, 4).map(([a, f]) => [a * sx, f]), 0.027);
    const sh = P(s), s1 = -d.shin * 0.45, s2 = -d.shin + 0.085;
    sh.tubeTaper([0, 0, 0], [0, s1, 0], 0.215, 0.245, COL.pants, 14);
    sh.sphere(0, s1, 0, 0.245, COL.pants, 2, 0.5);
    sh.tubeTaper([0, s1, 0], [0, s2, 0], 0.245, 0.15, COL.pants, 14);
    sh.tubeTaper([0, s2 + 0.005, 0], [0, -d.shin + 0.05, 0], 0.15, 0.108, COL.pantsDark, 14); // 收口的裤脚
    starsOnLeg(sh, -0.02, -s1 - 0.03, 0.108, 0.122, legSpots[li].slice(4, 6).map(([a, f]) => [a * sx, f]), 0.027);
    starsOnLeg(sh, s1 - 0.01, s1 - s2 - 0.03, 0.122, 0.078, legSpots[li].slice(6).map(([a, f]) => [a * sx, f * 0.7]), 0.024);
    sh.tubeTaper([0, -d.shin + 0.06, 0], [0, -d.shin + 0.02, 0], 0.07, 0.065, skin, 8); // 脚踝
    // 洞洞鞋：厚鞋底 + 圆鼓鞋头 + 鞋面几个小圆洞 + 后跟带
    const fy = -d.shin - 0.005;
    sh.rbox(0, fy, 0.03, 0.112, 0.03, 0.215, COL.clogSole, 0.05, 0, { ao: false });
    sh.ellipsoid(0, fy + 0.04, 0.065, 0.112, 0.085, 0.17, COL.clog, 2);
    sh.ellipsoid(0, fy + 0.035, -0.02, 0.108, 0.07, 0.13, COL.clog, 2);
    for (const [hx, hz] of [[-0.025, 0.1], [0.025, 0.1], [0, 0.125], [-0.03, 0.06], [0.03, 0.06], [0, 0.08]]) sh.ellipsoid(hx, fy + 0.077 - Math.abs(hz - 0.07) * 0.25, hz, 0.014, 0.008, 0.014, COL.hole, 1);
    sh.tube([-0.055, fy + 0.05, -0.02], [0, fy + 0.06, -0.075], 0.014, COL.clogSole, 5); sh.tube([0.055, fy + 0.05, -0.02], [0, fy + 0.06, -0.075], 0.014, COL.clogSole, 5);
  });
  // —— 髋：高腰、宽松的裤腰 ——
  const hp = P(0);
  hp.ellipsoid(0, -0.02, 0, d.chestW * 1.12, 0.24, d.chestD * 1.25, COL.pants, 2);
  for (const [a, y] of [[0.5, 0.02], [-0.7, -0.03], [2.6, 0.0], [-2.4, 0.03]]) star(hp, [Math.sin(a) * d.chestW * 0.555, y - 0.02, Math.cos(a) * d.chestD * 0.62], [Math.sin(a), 0, Math.cos(a)], [0, 1, 0], 0.024, COL.star);
  // —— 躯干：浅麻灰圆领 T 恤（略宽松、下摆盖住裤腰）——
  const sp = P(1), tr = d.torso;
  sp.tubeTaper([0, -0.04, 0], [0, tr * 0.62, 0], d.chestW * 0.9, d.chestW * 0.98, COL.shirt, 14);
  sp.ellipsoid(0, tr * 0.66, 0, d.chestW * 1.02, tr * 0.5, d.chestD * 1.12, COL.shirt, 2);
  sp.capsule([-d.shoulder * 0.8, tr - 0.07, 0], [d.shoulder * 0.8, tr - 0.07, 0], 0.065, 0.065, COL.shirt, 10);
  sp.cyl(0, tr - 0.02, 0, 0.12, 0.03, COL.shirtDark, 14); // 圆领罗纹
  // 胸前印花：几个小彩色方块（贴着圆柱面，略弯）
  const rAt = y => (d.chestW * 0.9 + (d.chestW * 0.98 - d.chestW * 0.9) * ((y + 0.04) / (tr * 0.66))) / 2;
  [[-0.05, 0.27], [0.05, 0.27], [-0.05, 0.19], [0.05, 0.19], [-0.05, 0.11], [0.05, 0.11]].forEach(([px, py], i) => {
    const r = rAt(py), a = Math.asin(px / r), z = Math.cos(a) * r;
    sp.box(px, py, z + 0.002, 0.04, 0.04, 0.008, COL.prints[i], a, 0, 0, 1, { ao: false });
  });
  // 白色双肩小书包（背后）+ 两根肩带
  sp.rbox(0, tr * 0.12, -d.chestD * 0.62 - 0.065, d.chestW * 0.78, tr * 0.66, 0.12, COL.bag, 0.05, 0, { ao: false, bevel: 0.03 });
  sp.rbox(0, tr * 0.16, -d.chestD * 0.62 - 0.13, d.chestW * 0.55, tr * 0.3, 0.04, COL.bagDark, 0.03, 0, { ao: false }); // 前袋
  for (const sx of [-1, 1]) sp.path([[sx * 0.085, tr * 0.12, -0.15], [sx * 0.1, tr - 0.02, -0.06], [sx * 0.1, tr - 0.02, 0.06], [sx * 0.09, tr * 0.42, rAt(tr * 0.42) + 0.006]], 0.02, COL.bagDark, 6);
  // 浅蓝挂绳 + 胸前卡套（=羊城通）
  const cy = tr * 0.4, cz = rAt(cy) + 0.012;
  for (const sx of [-1, 1]) sp.path([[sx * 0.055, tr - 0.005, 0.045], [sx * 0.045, tr * 0.8, rAt(tr * 0.8) + 0.004], [sx * 0.012, cy + 0.05, cz]], 0.009, COL.lanyard, 5);
  sp.rbox(0, cy - 0.045, cz + 0.002, 0.06, 0.085, 0.012, '#F6F7F8', 0.012, 0, { ao: false });
  sp.box(0, cy - 0.006, cz + 0.009, 0.046, 0.06, 0.004, '#2BA7B8', 0, 0, 0, 1, { ao: false });
  sp.box(0, cy + 0.008, cz + 0.012, 0.03, 0.012, 0.003, '#FFFFFF', 0, 0, 0, 1, { ao: false });
  // —— 头：大圆头 + 白皙皮肤 + 蜂蜜金锅盖头 ——
  const hd = P(2), hr = d.head, hy = d.neck + hr * 0.48;
  hd.tubeTaper([0, -0.02, 0], [0, d.neck + 0.03, 0], 0.085, 0.075, skin, 8);
  hd.ellipsoid(0, hy, 0.005, hr, hr * 1.04, hr * 0.98, skin, 5);
  for (const sx of [-1, 1]) hd.ellipsoid(sx * hr * 0.49, hy - hr * 0.06, -hr * 0.02, hr * 0.12, hr * 0.2, hr * 0.14, mix(skin, hex('#F0A8A0'), 0.25), 1); // 耳朵
  // 锅盖头：一整块“碗”形发壳——齐眉一刀切的厚刘海、两侧盖住耳朵上半、后面到发际；下摆略外翻更蓬
  bowlCut(hd, hr, hy);
  // 五官：眯眯的小眼睛、小鼻子、粉嘴、腮红（眉毛藏在刘海下面）
  const fz = hr * 0.47;
  for (const sx of [-1, 1]) {
    hd.ellipsoid(sx * hr * 0.17, hy + hr * 0.0, fz, hr * 0.095, hr * 0.08, hr * 0.06, COL.eye, 2);
    hd.sphere(sx * hr * 0.15, hy + hr * 0.02, fz + hr * 0.025, hr * 0.025, '#FFFFFF', 2);
    hd.ellipsoid(sx * hr * 0.28, hy - hr * 0.13, fz - hr * 0.06, hr * 0.12, hr * 0.06, hr * 0.04, mix(skin, hex('#F08A8A'), 0.4), 1);
  }
  hd.ellipsoid(0, hy - hr * 0.2, fz - hr * 0.015, hr * 0.11, hr * 0.035, hr * 0.04, COL.mouth, 1);
  hd.sphere(0, hy - hr * 0.08, fz + hr * 0.01, hr * 0.06, mix(skin, [0.9, 0.62, 0.55], 0.18), 1);
  // —— 手臂：宽松短袖 + 白皙手臂 ——
  for (const [u, f] of [[3, 5], [4, 6]]) {
    const ua = P(u); ua.capsule([0, 0, 0], [0, -d.uarm * 0.55, 0], 0.068, 0.064, COL.shirt, 10); ua.tubeTaper([0, -d.uarm * 0.55, 0], [0, -d.uarm, 0], 0.085, 0.075, skin, 10); ua.sphere(0, -d.uarm, 0, 0.075, skin, 1);
    const fa = P(f); fa.tubeTaper([0, 0, 0], [0, -d.farm, 0], 0.074, 0.064, skin, 10);
    fa.ellipsoid(0, -d.farm - 0.035, 0.005, 0.075, 0.085, 0.07, skin, 2); // 小拳头
  }
  // 右手手指（🤘：食指 + 小指），挂在第 12 根骨骼上，平时缩成 0
  const fg = P(HAND_R);
  fg.capsule([0.022, 0, 0.012], [0.026, -0.075, 0.016], 0.011, 0.01, skin, 6);   // 食指
  fg.capsule([-0.024, 0, 0.004], [-0.03, -0.06, 0.008], 0.01, 0.009, skin, 6);   // 小指
  fg.capsule([-0.002, 0.02, 0.03], [0.006, -0.012, 0.035], 0.012, 0.011, skin, 6); // 大拇指压着中指
  return out;
}

/** 眼镜：透明镜框 + 淡粉色半透明镜片（顶点透明度），绑在头骨骼上 */
function glassesGeo(restHead) {
  const g = new Geo().withBones(); g.bone = 2;
  const hr = D.head, hy = D.neck + hr * 0.48, z = hr * 0.53, ly = hy + hr * 0.01, rx = hr * 0.155, ry = hr * 0.115;
  const lens = [1.0, 0.7, 0.76], frame = [0.97, 0.93, 0.94], LA = 0.3, FA = 0.38, FR = 0.0026, n = 40, curve = 0.004;
  const t = new Geo();
  // 光滑细框：沿椭圆扫一圈小圆截面，共享顶点 + 平滑法线（不分段、不起棱）
  const rim = (cx, sx) => {
    const k = t.p.length / 3, m = 8;
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const C = [cx + ca * rx, ly + sa * ry, z - ca * ca * curve], N = new B.Vector3(ca / rx, sa / ry, 0).normalize();
      for (let j = 0; j <= m; j++) { const b = j / m * Math.PI * 2, nx = N.x * Math.cos(b), ny = N.y * Math.cos(b), nz = Math.sin(b); t.push(C[0] + nx * FR, C[1] + ny * FR, C[2] + nz * FR, nx, ny, nz, frame, FA); }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = k + i * (m + 1) + j, b = a + m + 1; t.i.push(a, b, a + 1, a + 1, b, b + 1); }
  };
  for (const sx of [-1, 1]) {
    const cx = sx * hr * 0.19;
    // 镜片：微弯的椭圆片（半透明粉）
    const k = t.p.length / 3; t.push(cx, ly, z, 0, 0, 1, lens, LA);
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; t.push(cx + Math.cos(a) * rx, ly + Math.sin(a) * ry, z - Math.cos(a) ** 2 * curve, -Math.cos(a) * 0.15 * sx * 0, 0, 1, lens, LA); }
    for (let i = 0; i < n; i++) t.i.push(k, k + 1 + i, k + 2 + i, k, k + 2 + i, k + 1 + i);
    rim(cx, sx);
    const f1 = t.p.length / 3; t.tube([sx * (hr * 0.19 + rx), ly + ry * 0.2, z - curve], [sx * hr * 0.5, ly + ry * 0.35, -hr * 0.04], 0.005, frame, 8); for (let q = f1; q < t.p.length / 3; q++) t.c[q * 4 + 3] = FA;
  }
  const f2 = t.p.length / 3; t.tube([-hr * 0.19 + rx, ly + ry * 0.3, z + 0.001], [hr * 0.19 - rx, ly + ry * 0.3, z + 0.001], 0.005, frame, 8); for (let q = f2; q < t.p.length / 3; q++) t.c[q * 4 + 3] = FA;
  g.merge(t, restHead);
  return g;
}
let lensMat = null;
function getLensMat(scene) {
  if (lensMat && lensMat.getScene() === scene) return lensMat;
  const m = lensMat = new B.PBRMaterial('heroLens', scene);
  m.albedoColor = new B.Color3(1, 1, 1); m.metallic = 0; m.roughness = 0.12; m.environmentIntensity = 0.6; m.maxSimultaneousLights = 2;
  m.useRadianceOverAlpha = false; m.useSpecularOverAlpha = false; m.backFaceCulling = false; m.alpha = 0.999;
  return m;
}

/** 玩家主角（Person 的子类：同一套程序化动画 + 两个招牌动作） */
export class Hero extends Person {
  constructor(scene, mat, opts = {}) {
    super(scene, mat, { ...HERO_LOOK }, { name: opts.name || 'kid', build: { defs: heroDefs, parts: heroParts } });
    // 眼镜：第 2 个网格（半透明），共用骨骼
    const restHead = B.Matrix.Translation(0, D.hip + 0.02 + D.torso, 0);
    const gm = this.glasses = glassesGeo(restHead).toMesh('kidGlasses', scene, getLensMat(scene), null, { alpha: true });
    gm.skeleton = this.skeleton; gm.numBoneInfluencers = 1; gm.parent = this.mesh; gm.alphaIndex = 3;
    this.fingers(0);
  }
  fingers(k) { const s = Math.max(0.001, k); this._b[HAND_R].setScale(new B.Vector3(s, s, s)); this.fingerK = k; }
  animate(dt, o = {}) {
    const mode = o.mode || this.mode;
    if (mode !== 'wave' && mode !== 'cheer') { if (this.fingerK) this.fingers(0); return super.animate(dt, o); }
    super.animate(dt, { ...o, mode: 'idle' });
    const t = this.t;
    if (mode === 'wave') {
      // 打招呼：右手举到脸旁比 🤘（食指 + 小指），手腕轻轻晃（骨骼 rz：右臂正 = 向外，左臂负 = 向外）
      const w = Math.sin(t * 7) * 0.12;
      this.setBone(4, -0.2, 0, 1.0); this.setBone(6, -0.25, 0, 2.2 + w);
      this.setBone(2, 0.02, this.lookYaw * 0.3, -0.06);
      this.fingers(1);
    } else {
      // 庆祝“努力！”：两只拳头举过肩膀（上臂水平向外、前臂竖直向上），双腿叉开，身体一颠一颠
      const b = Math.abs(Math.sin(t * 5)) * 0.12;
      this.setBone(3, 0, 0, -1.7 - b); this.setBone(4, 0, 0, 1.7 + b);
      this.setBone(5, 0, 0, -1.45); this.setBone(6, 0, 0, 1.45);
      this.setBone(7, 0, 0, -0.32); this.setBone(8, 0, 0, 0.32); this.setBone(9, 0, 0, 0.1); this.setBone(10, 0, 0, -0.1);
      this.setBone(2, -0.12, 0, Math.sin(t * 2.5) * 0.08);
      this.fingers(0);
      this.hipBob = -0.03;
    }
  }
  dispose() { this.glasses.dispose(); super.dispose(); }
}
