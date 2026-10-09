/*
 * 换乘地面引导带（公园前 1↔2 号线）：约 0.4m 宽的线路色色带 + 每隔一段的白色 / 深色 V 形箭头。
 *   - 单独的 band 材质（kit 的 'band' 桶，不受光照）：多边形偏移 −4（比贴地暗影 shade 的 −2 强），掠射角下暗影不会一片片盖到色带上；
 *   - 色带顶面离地 3.5cm（楼梯踏步上 4cm），V 形箭头再高 2cm：箭头和色带、色带和地面之间都不共面；
 *   - 折线拐角不重叠：每段只往终点方向延长半个带宽补拐角，后一段从拐角外开始（以前两段在拐角叠成两层同高的面）；
 *   - 箭头离段两端至少 0.5m（不压在拐角上），臂宽加粗（远处细臂会走样闪烁）；
 *   - 楼梯段每级踏面单独一小段，盖住前缘防滑条（色带里不再夹一道道深色缝），箭头只放在整块踏面内（不跨到踢面 / 下一级）；
 *   - 自拼桥那一段由 bridgeStripe() 生成一块小网格，实例挂在每块桥板上，桥拼好时色带才连起来。
 */
import { Geo, hex } from '../core/geo.js';
const B = window.BABYLON;
export const BAND_W = 0.4, BAND_BOT = 0.012, BAND_TOP = 0.035, CHEV_UP = 0.02, CHEV_Y = BAND_TOP + CHEV_UP;
const STAIR_BOT = 0.02, STAIR_TOP = 0.04;

/** 一个 V 形箭头（两条斜带），中心 (x,z)，指向 (fx,fz)，横向尺寸 s（米）；len = 前后总长（默认 0.8s，楼梯上按踏面深度压扁） */
function chevron(G, x, y, z, fx, fz, s, col, len = s * 0.8) {
  const rx = fz, rz = -fx, t = len * 0.34, f0 = -len / 2 + t, f1 = len / 2; // 臂沿前进方向的厚度 t；尖端在 f1
  const P = (f, r) => [x + fx * f + rx * r, y, z + fz * f + rz * r];
  for (const sd of [-1, 1]) {
    const a = P(f0, sd * s * 0.42), b = P(f1, 0);
    const q = [a, b, [b[0] - fx * t, y, b[2] - fz * t], [a[0] - fx * t, y, a[2] - fz * t]];
    G.quad(q[0], q[1], q[2], q[3], col); G.quad(q[3], q[2], q[1], q[0], col); // 正反两面都画（不依赖朝向）
  }
}
/**
 * 平地段：pts = [[x,z],...] 折线，地面高 y。每段画一条色带；每 every 米一个箭头（指向前进方向）。
 */
export function flatBand(G, pts, y, col, chevCol, { every = 1.6, w = BAND_W, start = 0.8 } = {}) {
  const c = hex(col), cc = hex(chevCol), h = w / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0); if (L < 1e-3) continue;
    const fx = (x1 - x0) / L, fz = (z1 - z0) / L;
    // 只支持横平竖直的段。起点：第一段往后延长半个带宽，其余段从拐角方块外开始；终点：往前延长半个带宽盖住拐角
    const b0 = i === 0 ? -h : h, ax = x0 + fx * b0, az = z0 + fz * b0, bx = x1 + fx * h, bz = z1 + fz * h;
    G.slab(Math.min(ax, bx) - Math.abs(fz) * h, Math.max(ax, bx) + Math.abs(fz) * h, y + BAND_BOT, y + BAND_TOP, Math.min(az, bz) - Math.abs(fx) * h, Math.max(az, bz) + Math.abs(fx) * h, c, { ao: false });
    const lo = Math.min(Math.max(start, 0.5), L / 2), hi = Math.max(L - 0.5, lo);
    for (let d = lo; d <= hi + 1e-6; d += every) chevron(G, x0 + fx * d, y + CHEV_Y, z0 + fz * d, fx, fz, w * 0.9, cc);
  }
}
/** 楼梯段：沿 x 的楼梯（和 kit.stairs 同样的踏步划分），色带中心在 z=zc；箭头每隔 every 级一个（朝 walkDir） */
export function stairBand(G, a, ya, b, yb, zc, col, chevCol, { w = BAND_W, walkDir = 0, every = 3, visual = false } = {}) {
  const c = hex(col), cc = hex(chevCol), L = Math.abs(b - a), dy = yb - ya, n = Math.max(2, Math.round(Math.abs(dy) / 0.16)), dir = Math.sign(b - a), h = w / 2;
  const fx = walkDir || dir;
  for (let k = 0; k < n; k++) {
    const s0 = a + dir * L * k / n, s1 = a + dir * L * (k + 1) / n;
    // kit.stairs（下行）：踏步 k 的面高 ya+dy*(k+1)/n；stairVisual：同样 top = ya + dy*(k+1)/n
    const top = visual ? ya + dy * (k + 1) / n : ya + dy * (k + (dy < 0 ? 1 : 0)) / n;
    // 整块踏面（含前缘防滑条，防滑条只有 6mm 高）各一小段，两头各让 1.5cm，不碰踢面
    const e0 = Math.min(s0, s1) + 0.015, e1 = Math.max(s0, s1) - 0.015;
    G.slab(e0, e1, top + STAIR_BOT, top + STAIR_TOP, zc - h, zc + h, c, { ao: false });
    if (k % every === 1 && k < n - 1) chevron(G, (e0 + e1) / 2, top + STAIR_TOP + CHEV_UP, zc, fx, 0, w * 0.9, cc, Math.min(w * 0.72, (e1 - e0) - 0.06));
  }
}
/** 自拼桥：每块桥板上一段色带（本地坐标：桥板顶面 y=+0.15，沿 z 长 dz），lanes = [{ dx, col, chev, dirZ }] */
export function bridgeStripe(scene, mat, parent, dz, lanes) {
  const G = new Geo();
  for (const ln of lanes) {
    // 桥板顶面在本地 y=0.15：色带底面离开桥板顶面（以前底面与桥板顶面共面，远处看像两层在抢）
    G.slab(ln.dx - BAND_W / 2, ln.dx + BAND_W / 2, 0.15 + BAND_BOT, 0.15 + BAND_TOP, 0.03, dz - 0.03, hex(ln.col), { ao: false });
    chevron(G, ln.dx, 0.15 + CHEV_Y, dz / 2, 0, ln.dirZ, BAND_W * 0.9, hex(ln.chev));
  }
  const m = G.toMesh('bridgeStripe', scene, mat, parent); m.isVisible = false;
  return m;
}
