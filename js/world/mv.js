/*
 * 《纪念碑谷》式小彩蛋（都不挡路）：
 *   - Penrose 不可能三角雕塑：站到地上发光圆圈处（或让镜头落在那条视线上）就“闭合”，闪光+叮咚；
 *   - 会自己拼起来的桥：走近时桥板一块块从深谷里翻上来（脚下始终有隐形地板，绝不会掉下去）；
 *   - 透视拱门：一排越来越小、越来越密的拱门，看起来比实际长很多。
 */
import { Geo, hex } from '../core/geo.js';
import { colorMat } from '../core/mats.js';
const B = window.BABYLON;
const V = (x, y, z) => new B.Vector3(x, y, z);

/** Penrose 三角：eye 为最佳观察点（眼睛高度），toward 为从观察点看向雕塑的水平方向（弧度），dist 距离 */
export function penrose(kit, eye, angle, dist = 15, L = 4.2, t = 0.9) {
  const look = V(Math.sin(angle), 0.22, Math.cos(angle)).normalize();   // 观察方向（略微仰视）
  const u = look.scale(-1);                                            // 从雕塑指向观察者
  const a = V(1, 1, 1).normalize(), b = V(-1, 2, -1).normalize(), c = B.Vector3.Cross(a, b);
  const up = V(0, 1, 0), Bw = up.subtract(u.scale(B.Vector3.Dot(up, u))).normalize(), Cw = B.Vector3.Cross(u, Bw);
  const R = p => u.scale(B.Vector3.Dot(a, p)).add(Bw.scale(B.Vector3.Dot(b, p))).add(Cw.scale(B.Vector3.Dot(c, p)));
  const P0 = eye.add(look.scale(dist));
  const g = new Geo(), cols = ['#FF9AA2', '#FFD166', '#7FD1E8'].map(hex);
  const beams = [[V(0, 0, 0), V(L, 0, 0)], [V(L, 0, 0), V(L, L, 0)], [V(L, L, 0), V(L, L, L)]];
  // 为了让末端“接上”起点，把每段用小方块串起来，旋转后写入
  let minP = null;
  const rotQ = B.Quaternion.FromRotationMatrix(invBasis(a, b, c).multiply(B.Matrix.FromValues(u.x, u.y, u.z, 0, Bw.x, Bw.y, Bw.z, 0, Cw.x, Cw.y, Cw.z, 0, 0, 0, 0, 1)));
  beams.forEach(([p, q], i) => {
    const n = 14;
    for (let k = 0; k <= n; k++) {
      if (i === 2 && k === n) continue;
      const lp = B.Vector3.Lerp(p, q, k / n), w = P0.add(R(lp));
      const m = B.Matrix.Compose(V(t, t, t), rotQ, w);
      g.addVD(B.VertexData.CreateBox({ size: 1 }), m, cols[i]);
      if (!minP || w.y < minP.y) minP = w;
    }
  });
  const mat = colorMat(kit.scene, '#FFFFFF', { emissive: 0.25 }).clone('penroseMat');
  const mesh = g.toMesh('penrose', kit.scene, mat, kit.root);
  // 底座
  kit.solid.cyl(minP.x, (minP.y - t / 2) / 2, minP.z, 0.5, Math.max(0.1, minP.y - t / 2), hex('#E7DCCB'), 8);
  kit.solid.cyl(minP.x, 0.15, minP.z, 2.2, 0.3, hex('#D8CCB8'), 12);
  // 地上的观察圈
  kit.glow.cyl(eye.x, 0.03, eye.z, 1.3, 0.04, hex('#FFE680'), 20);
  kit.solid.cyl(eye.x, 0.02, eye.z, 1.6, 0.03, hex('#F6B94A'), 20);
  kit.sign(eye.x - Math.sin(angle) * 1.2 + Math.cos(angle) * 1.4, 1.0, eye.z - Math.cos(angle) * 1.2 - Math.sin(angle) * 1.4, { w: 1.7, h: 0.55, bg: '#FFF4CC', fg: '#6A4B00', zh: '站在圈里看 ✨', en: 'Stand in the circle', face: angle + Math.PI });
  kit.solid.box(eye.x - Math.sin(angle) * 1.2 + Math.cos(angle) * 1.4, 0.37, eye.z - Math.cos(angle) * 1.2 - Math.sin(angle) * 1.4, 0.1, 0.75, 0.1, hex('#6C7A89'));
  const lineP = P0, lineD = u;
  let lit = 0, done = false;
  return {
    name: 'penrose', mesh, eye, aligned: false,
    update(dt, cam, events) {
      // 镜头到“视线”的距离 + 是否大致看向雕塑
      const toCam = cam.position.subtract(lineP), along = B.Vector3.Dot(toCam, lineD);
      const perp = toCam.subtract(lineD.scale(along)).length();
      const fwd = cam.getForwardRay(1).direction, facing = B.Vector3.Dot(fwd, lineD.scale(-1));
      const ok = along > 3 && perp < 0.55 && facing > 0.9;
      this.aligned = ok;
      if (ok && !done) { done = true; lit = 1.6; events.emit('mv', { kind: 'penrose' }); }
      if (!ok && perp > 2.5) done = false;
      lit = Math.max(0, lit - dt);
      const e = 0.25 + (lit > 0 ? 0.6 * Math.abs(Math.sin(lit * 9)) : 0);
      mat.emissiveColor.set(e, e, e);
    }
  };
}
function invBasis(a, b, c) { return B.Matrix.FromValues(a.x, b.x, c.x, 0, a.y, b.y, c.y, 0, a.z, b.z, c.z, 0, 0, 0, 0, 1); }

/** 自拼桥：沿 z 从 z0 到 z1，x 范围 [x0,x1]，桥面高度 y；下方是发光深谷 */
export function foldingBridge(kit, x0, x1, z0, z1, y) {
  const n = 6, dz = (z1 - z0) / n, w = x1 - x0, tiles = [];
  const mat = colorMat(kit.scene, '#9FD8F5', { emissive: 0.2 });
  const src = B.MeshBuilder.CreateBox('tile', { width: w - 0.1, height: 0.3, depth: dz - 0.06 }, kit.scene);
  src.material = mat; src.parent = kit.root; src.isVisible = false;
  for (let i = 0; i < n; i++) {
    const pivot = new B.TransformNode('tp' + i, kit.scene); pivot.parent = kit.root; pivot.position.set((x0 + x1) / 2, y - 0.15, z0 + i * dz);
    const t = src.createInstance('tile' + i); t.parent = pivot; t.position.set(0, 0, dz / 2);
    pivot.rotation.x = 1.45 + i * 0.05; tiles.push({ pivot, f: 0 });
  }
  // 深谷（视觉）+ 隐形地板（保证不掉下去）
  kit.solid.slab(x0, x1, y - 4.2, y - 4.0, z0, z1, hex('#1B3A5C'));
  kit.glow.slab(x0 + 0.4, x1 - 0.4, y - 3.99, y - 3.97, z0 + 0.4, z1 - 0.4, hex('#3F7CC4'));
  for (const xx of [x0, x1]) kit.solid.slab(xx - 0.1, xx + 0.1, y - 4.2, y, z0, z1, hex('#2A4E78'));
  kit.solid.slab(x0, x1, y - 4.2, y, z1 - 0.1, z1 + 0.1, hex('#2A4E78')); kit.solid.slab(x0, x1, y - 4.2, y, z0 - 0.1, z0 + 0.1, hex('#2A4E78'));
  for (let k = 0; k < 10; k++) kit.glow.box(x0 + 0.6 + (k * 1.7) % (w - 1.2), y - 2.5 - (k % 3) * 0.5, z0 + 0.6 + (k * 2.3) % (z1 - z0 - 1.2), 0.12, 0.12, 0.12, hex('#BFE6FF'));
  kit.col((x0 + x1) / 2, y - 0.15, (z0 + z1) / 2, w, 0.3, z1 - z0);
  let state = 0;
  return {
    name: 'bridge', tiles,
    update(dt, cam, events, player) {
      const p = player.position, near = p.x > x0 - 3 && p.x < x1 + 3 && Math.abs(p.y - y) < 4 && p.z > z0 - 11 && p.z < z1 + 11;
      const far = !(p.x > x0 - 8 && p.x < x1 + 8 && Math.abs(p.y - y) < 8 && p.z > z0 - 20 && p.z < z1 + 20);
      if (near && state === 0) { state = 1; events.emit('mv', { kind: 'bridge' }); }
      if (far && state === 1) state = 0;
      tiles.forEach((t, i) => {
        const target = state ? 1 : 0, delay = i * 0.12;
        t.d = (t.d || 0) + dt; if (state && t.d < delay) return;
        const before = t.f; t.f += (target - t.f) * Math.min(1, dt * 7); if (Math.abs(target - t.f) < 0.002) t.f = target;
        if (state && before < 0.92 && t.f >= 0.92) events.emit('tile', { i });
        t.pivot.rotation.x = (1 - t.f) * (1.45 + i * 0.05);
        if (!state) t.d = 0;
      });
    }
  };
}

/** 透视拱门：沿 z 方向从 z0 开始，越来越小、越来越密（最小仍高于 2.7m） */
export function perspectiveArches(kit, xc, z0, dirZ, y, col = '#F2E6D8', accent = '#E07A5F', n = 6) {
  let z = z0, s = 1;
  for (let i = 0; i < n; i++) {
    const w = 4.6 * s, h = 4.6 * s, t = 0.45 * s;
    kit.block(xc - w / 2 - t, xc - w / 2, y, y + h, z - t / 2, z + t / 2, col);
    kit.block(xc + w / 2, xc + w / 2 + t, y, y + h, z - t / 2, z + t / 2, col);
    kit.solid.slab(xc - w / 2 - t, xc + w / 2 + t, y + h, y + h + t, z - t / 2, z + t / 2, hex(accent));
    // 拱：用几块斜方块近似
    for (let k = 1; k < 6; k++) { const a = Math.PI * k / 6, r = w / 2; kit.solid.box(xc - Math.cos(a) * r * 0.92, y + h - 0.2 * s + Math.sin(a) * r * 0.32 - r * 0.32, z, t * 1.1, t * 0.9, t, hex(col), 0, 0, -a + Math.PI / 2); }
    z += dirZ * 2.3 * s; s *= 0.88;
  }
}
