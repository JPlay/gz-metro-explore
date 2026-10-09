/*
 * 几何累加器：把大量方块 / 圆柱 / 圆角体 / 挤出体写进同一份顶点数据，最后生成 1 个网格 = 1 次绘制调用。
 *   - 顶点色：材质颜色 × 顶点色；
 *   - UV：按面法线做平面投影（单位：米），同一材质的相邻物体贴图无缝；材质用 uScale 换算成贴图尺寸；
 *   - 烘焙环境光遮蔽（AO）：高的方块 / 圆柱在贴地 0.35m 处自动加一圈暗边（顶点色变暗），
 *     另外 shade* 系列在地面画半透明的柔和暗影（墙根、柱脚、长椅下）。
 *   - bone：给角色用，每个顶点记一个骨骼编号（刚性蒙皮）。
 */
const B = window.BABYLON;
const tmpM = new B.Matrix(), tmpV = new B.Vector3(), tmpN = new B.Vector3(), tmpQ = new B.Quaternion(), tmpS = new B.Vector3(), tmpT = new B.Vector3();
const cache = {};
function proto(key, make) { return cache[key] || (cache[key] = make()); }

export function hex(h) { const c = B.Color3.FromHexString(h); return [c.r, c.g, c.b]; }
export function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
export function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
const C = c => typeof c === 'string' ? hex(c) : c;

/** 自定义“分段”方块原型：竖直面在 rows（0..1 的高度比例）处切开，便于做贴地暗边 */
function bandBox(rows) {
  const P = [], N = [], I = [], S = []; // S = 每个顶点所在高度比例（用于 AO）
  const quad = (a, b, c, d, n) => { const k = P.length / 3; [a, b, c, d].forEach(v => { P.push(...v); N.push(...n); S.push(v[1] + 0.5); }); I.push(k, k + 2, k + 1, k, k + 3, k + 2); };
  const faces = [[[0, 0, 1], [1, 0, 0]], [[0, 0, -1], [-1, 0, 0]], [[1, 0, 0], [0, 0, -1]], [[-1, 0, 0], [0, 0, 1]]];
  for (const [n, r] of faces) for (let k = 0; k < rows.length - 1; k++) {
    const y0 = rows[k] - 0.5, y1 = rows[k + 1] - 0.5;
    const p = (s, y) => [n[0] * 0.5 + r[0] * s, y, n[2] * 0.5 + r[2] * s];
    quad(p(-0.5, y0), p(0.5, y0), p(0.5, y1), p(-0.5, y1), n);
  }
  quad([-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5], [0, 1, 0]);
  quad([-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5], [0, -1, 0]);
  return { positions: P, normals: N, indices: I, s: S };
}
/** 分段圆柱原型（侧面光滑），rows 同上 */
function bandCyl(tess, rows, topScale = 1) {
  const P = [], N = [], I = [], S = [];
  const slope = (1 - topScale) * 0.5;
  for (let r = 0; r < rows.length; r++) {
    const y = rows[r] - 0.5, rad = 0.5 * (1 + (topScale - 1) * rows[r]);
    for (let k = 0; k <= tess; k++) {
      const a = k / tess * Math.PI * 2, cx = Math.cos(a), sz = Math.sin(a);
      const nl = Math.hypot(1, slope); P.push(cx * rad, y, sz * rad); N.push(cx / nl, slope / nl, sz / nl); S.push(rows[r]);
    }
  }
  const W = tess + 1;
  for (let r = 0; r < rows.length - 1; r++) for (let k = 0; k < tess; k++) { const a = r * W + k, b = a + W; I.push(a, a + 1, b + 1, a, b + 1, b); }
  for (const [y, sgn, rr] of [[0.5, 1, 0.5 * topScale], [-0.5, -1, 0.5]]) {
    const c0 = P.length / 3; P.push(0, y, 0); N.push(0, sgn, 0); S.push(y + 0.5);
    for (let k = 0; k <= tess; k++) { const a = k / tess * Math.PI * 2; P.push(Math.cos(a) * rr, y, Math.sin(a) * rr); N.push(0, sgn, 0); S.push(y + 0.5); }
    for (let k = 0; k < tess; k++) sgn > 0 ? I.push(c0, c0 + 1 + k, c0 + 2 + k) : I.push(c0, c0 + 2 + k, c0 + 1 + k);
  }
  return { positions: P, normals: N, indices: I, s: S };
}
const q2 = v => Math.round(v * 50) / 50;
function rowsFor(h, ao, aoTop) {
  const r = [0]; if (ao && h > 0.7) r.push(q2(Math.min(0.45, 0.35 / h))); if (aoTop && h > 1.2) r.push(q2(1 - Math.min(0.4, 0.3 / h))); r.push(1); return r;
}

export class Geo {
  constructor() { this.p = []; this.n = []; this.c = []; this.i = []; this.u = []; this.b = null; this.bone = 0; this.tint = null; this.ao = 0.62; }
  get empty() { return this.i.length === 0; }
  withBones() { this.b = []; return this; }
  push(x, y, z, nx, ny, nz, col, a = 1, shade = 1) {
    if (this.tint) shade *= this.tint(x, y, z, nx, ny, nz);
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(col[0] * shade, col[1] * shade, col[2] * shade, a);
    // 平面投影 UV（米）
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    if (ay >= ax && ay >= az) this.u.push(x, z); else if (ax >= az) this.u.push(nx > 0 ? -z : z, y); else this.u.push(nz > 0 ? x : -x, y);
    if (this.b) this.b.push(this.bone);
  }
  /** 追加一份（单位尺寸）原型，用矩阵变换；aoFn(s) 返回该顶点的明暗系数 */
  addVD(vd, m, col, alpha = 1, aoFn) {
    const base = this.p.length / 3, P = vd.positions, N = vd.normals;
    for (let k = 0, j = 0; k < P.length; k += 3, j++) {
      B.Vector3.TransformCoordinatesFromFloatsToRef(P[k], P[k + 1], P[k + 2], m, tmpV);
      B.Vector3.TransformNormalFromFloatsToRef(N[k], N[k + 1], N[k + 2], m, tmpN); tmpN.normalize();
      this.push(tmpV.x, tmpV.y, tmpV.z, tmpN.x, tmpN.y, tmpN.z, col, alpha, aoFn && vd.s ? aoFn(vd.s[j], N[k + 1]) : 1);
    }
    const I = vd.indices; for (let k = 0; k < I.length; k++) this.i.push(I[k] + base);
    return this;
  }
  _aoFn(ao, aoTop) {
    if (!ao && !aoTop) return null; const lo = this.ao;
    return (s, ny) => { if (ny < -0.5) return lo; let f = 1; if (ao && s < 0.01) f = lo; if (aoTop && s > 0.99 && ny < 0.5) f = Math.min(f, 0.8); return f; };
  }
  /** 方块：中心 (x,y,z)，尺寸 (w,h,d)，可选旋转；o.ao 贴地暗边（默认：高度>1.2m 时开），o.aoTop 顶部暗边 */
  box(x, y, z, w, h, d, col, ry = 0, rx = 0, rz = 0, alpha = 1, o = {}) {
    col = C(col);
    const ao = o.ao ?? (h > 1.2 && !rx && !rz), aoTop = !!o.aoTop, rows = rowsFor(h, ao, aoTop);
    const vd = proto('bb' + rows.join(','), () => bandBox(rows));
    B.Quaternion.RotationYawPitchRollToRef(ry, rx, rz, tmpQ); tmpS.set(w, h, d); tmpT.set(x, y, z);
    B.Matrix.ComposeToRef(tmpS, tmpQ, tmpT, tmpM);
    return this.addVD(vd, tmpM, col, alpha, this._aoFn(ao, aoTop));
  }
  /** 底面在 y0、顶面在 y1 的方块 */
  slab(x0, x1, y0, y1, z0, z1, col, o) { return this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), col, 0, 0, 0, 1, o); }
  cyl(x, y, z, dia, h, col, tess = 12, ry = 0, rx = 0, rz = 0, dTop, o = {}) {
    col = C(col);
    const ts = dTop === undefined ? 1 : q2(dTop / dia), ao = o.ao ?? (h > 1.2 && !rx && !rz), rows = rowsFor(h, ao, !!o.aoTop);
    const vd = proto('cy' + tess + '_' + ts + '_' + rows.join(','), () => bandCyl(tess, rows, ts));
    B.Quaternion.RotationYawPitchRollToRef(ry, rx, rz, tmpQ); tmpS.set(dia, h, dia); tmpT.set(x, y, z);
    B.Matrix.ComposeToRef(tmpS, tmpQ, tmpT, tmpM);
    return this.addVD(vd, tmpM, col, 1, this._aoFn(ao, !!o.aoTop));
  }
  /** 两点之间的圆管（扶手、杆子） */
  tube(a, b, dia, col, tess = 8) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz); if (L < 1e-4) return this;
    const dir = new B.Vector3(dx / L, dy / L, dz / L), up = new B.Vector3(0, 1, 0);
    const axis = B.Vector3.Cross(up, dir), ang = Math.acos(Math.max(-1, Math.min(1, B.Vector3.Dot(up, dir))));
    const q = axis.length() < 1e-5 ? (dir.y > 0 ? B.Quaternion.Identity() : B.Quaternion.RotationAxis(new B.Vector3(1, 0, 0), Math.PI)) : B.Quaternion.RotationAxis(axis.normalize(), ang);
    const vd = proto('cy' + tess + '_1_0,1', () => bandCyl(tess, [0, 1], 1));
    tmpS.set(dia, L, dia); tmpT.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    B.Matrix.ComposeToRef(tmpS, q, tmpT, tmpM);
    return this.addVD(vd, tmpM, C(col));
  }
  /** 折线圆管，拐点加小球 */
  path(pts, dia, col, tess = 8) { for (let k = 0; k < pts.length - 1; k++) this.tube(pts[k], pts[k + 1], dia, col, tess); for (let k = 1; k < pts.length - 1; k++) this.sphere(pts[k][0], pts[k][1], pts[k][2], dia, col, 1, 1, false); return this; }
  sphere(x, y, z, dia, col, seg = 2, sy = 1, flat = false, sx = 1, sz = 1) {
    const vd = proto('ico' + seg + flat, () => B.VertexData.CreateIcoSphere({ radius: 0.5, subdivisions: seg, flat }));
    tmpS.set(dia * sx, dia * sy, dia * sz); tmpT.set(x, y, z);
    B.Matrix.ComposeToRef(tmpS, B.Quaternion.Identity(), tmpT, tmpM);
    return this.addVD(vd, tmpM, C(col));
  }
  /** 椭球（可旋转），用于人物身体部件 */
  ellipsoid(x, y, z, sx, sy, sz, col, seg = 2, ry = 0, rx = 0, rz = 0) {
    const vd = proto('ico' + seg + 'false', () => B.VertexData.CreateIcoSphere({ radius: 0.5, subdivisions: seg, flat: false }));
    B.Quaternion.RotationYawPitchRollToRef(ry, rx, rz, tmpQ); tmpS.set(sx, sy, sz); tmpT.set(x, y, z);
    B.Matrix.ComposeToRef(tmpS, tmpQ, tmpT, tmpM);
    return this.addVD(vd, tmpM, C(col));
  }
  /** 胶囊（两端半球），沿 a→b，用于四肢 */
  capsule(a, b, r0, r1, col, tess = 10) {
    this.tubeTaper(a, b, r0 * 2, r1 * 2, col, tess);
    this.sphere(a[0], a[1], a[2], r0 * 2, col, 1); this.sphere(b[0], b[1], b[2], r1 * 2, col, 1);
    return this;
  }
  tubeTaper(a, b, d0, d1, col, tess = 10) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz); if (L < 1e-4) return this;
    const dir = new B.Vector3(dx / L, dy / L, dz / L), up = new B.Vector3(0, 1, 0);
    const axis = B.Vector3.Cross(up, dir), ang = Math.acos(Math.max(-1, Math.min(1, B.Vector3.Dot(up, dir))));
    const q = axis.length() < 1e-5 ? (dir.y > 0 ? B.Quaternion.Identity() : B.Quaternion.RotationAxis(new B.Vector3(1, 0, 0), Math.PI)) : B.Quaternion.RotationAxis(axis.normalize(), ang);
    const ts = q2(d1 / d0), vd = proto('cy' + tess + '_' + ts + '_0,1', () => bandCyl(tess, [0, 1], ts));
    tmpS.set(d0, L, d0); tmpT.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    B.Matrix.ComposeToRef(tmpS, q, tmpT, tmpM);
    return this.addVD(vd, tmpM, C(col));
  }
  /**
   * 圆角方块（平面圆角，竖直挤出）：中心 (x,z)，底 y0 顶 y1，尺寸 w×d，圆角半径 r，绕竖轴 ry。
   * o.top=false 不封顶；o.ao 贴地暗边；o.bevel 顶面倒角高度
   */
  rbox(x, y0, z, w, h, d, col, r = 0.05, ry = 0, o = {}) {
    col = C(col); r = Math.min(r, w / 2 - 1e-3, d / 2 - 1e-3); const seg = o.seg ?? 3, bev = Math.min(o.bevel ?? 0, h / 3, r);
    const outline = [];
    const corners = [[w / 2 - r, d / 2 - r, 0], [-w / 2 + r, d / 2 - r, Math.PI / 2], [-w / 2 + r, -d / 2 + r, Math.PI], [w / 2 - r, -d / 2 + r, Math.PI * 1.5]];
    for (const [cx, cz, a0] of corners) for (let k = 0; k <= seg; k++) { const a = a0 + k / seg * Math.PI / 2; outline.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, Math.cos(a), Math.sin(a)]); }
    const cs = Math.cos(ry), sn = Math.sin(ry), T = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs], TN = (nx, nz) => [nx * cs + nz * sn, -nx * sn + nz * cs];
    const ao = o.ao ?? h > 0.6, lo = this.ao;
    const rings = [[y0, ao ? lo : 1, 0]]; if (ao && h > 0.7) rings.push([y0 + Math.min(0.35, h * 0.4), 1, 0]); rings.push([y0 + h - bev, 1, 0]); if (bev > 0) rings.push([y0 + h, 1, bev]);
    const n = outline.length;
    for (let ri = 0; ri < rings.length; ri++) {
      const [yy, sh, inset] = rings[ri];
      for (let k = 0; k <= n; k++) {
        const [lx, lz, nx, nz] = outline[k % n], [px, pz] = T(lx - nx * inset, lz - nz * inset), [wx, wz] = TN(nx, nz);
        const up = inset > 0 ? 0.7 : 0, l = Math.hypot(1, up);
        this.push(px, yy, pz, wx / l, up / l, wz / l, col, 1, sh);
      }
    }
    const W = n + 1, base0 = this.p.length / 3 - rings.length * W;
    for (let ri = 0; ri < rings.length - 1; ri++) for (let k = 0; k < n; k++) { const a = base0 + ri * W + k, b = a + W; this.i.push(a, a + 1, b + 1, a, b + 1, b); }
    // 顶、底面
    const capY = [[y0 + h, 1, bev], ...(o.bottom ? [[y0, -1, 0]] : [])];
    if (o.top !== false) for (const [yy, sg, inset] of capY) {
      const c0 = this.p.length / 3, [cx0, cz0] = T(0, 0); this.push(cx0, yy, cz0, 0, sg, 0, col);
      for (let k = 0; k <= n; k++) { const [lx, lz, nx, nz] = outline[k % n], [px, pz] = T(lx - nx * inset, lz - nz * inset); this.push(px, yy, pz, 0, sg, 0, col); }
      for (let k = 0; k < n; k++) sg > 0 ? this.i.push(c0, c0 + 1 + k, c0 + 2 + k) : this.i.push(c0, c0 + 2 + k, c0 + 1 + k);
    }
    return this;
  }
  /**
   * 沿 x 挤出一条截面折线 pts=[[z,y],...]（从 x0 到 x1）。法线按折线平滑。flip 反转朝向（做内壁）。
   * colFn(z,y) 可按位置给颜色。
   */
  extrudeX(pts, x0, x1, col, { flip = false, colFn = null, smooth = true } = {}) {
    if (pts.length < 2) return this;
    const n = pts.length, nrm = [];
    for (let k = 0; k < n; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)];
      let tz = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tz, ty) || 1; tz /= l; ty /= l;
      // 折线前进方向的右手法线（对外）
      let nz = ty, ny = -tz; if (flip) { nz = -nz; ny = -ny; } nrm.push([nz, ny]);
    }
    if (!smooth) { /* 每段独立法线 */
      for (let k = 0; k < n - 1; k++) this.extrudeX([pts[k], pts[k + 1]], x0, x1, col, { flip, colFn, smooth: true });
      return this;
    }
    const base = this.p.length / 3;
    for (const x of [x0, x1]) for (let k = 0; k < n; k++) { const [z, y] = pts[k], [nz, ny] = nrm[k]; this.push(x, y, z, 0, ny, nz, colFn ? colFn(z, y) : C(col)); }
    for (let k = 0; k < n - 1; k++) { const a = base + k, b = base + n + k; if (!flip) this.i.push(a, a + 1, b + 1, a, b + 1, b); else this.i.push(a, b + 1, a + 1, a, b, b + 1); }
    return this;
  }
  /** 放样：sections = [{x, pts:[[z,y]...]}]（每段点数相同），截面在 yz 平面，沿 x 排列 */
  loftX(sections, col, { flip = false, colFn = null } = {}) {
    const n = sections[0].pts.length, base = this.p.length / 3, S = sections.length;
    const pos = (s, k) => [sections[s].x, sections[s].pts[k][1], sections[s].pts[k][0]];
    for (let s = 0; s < S; s++) for (let k = 0; k < n; k++) {
      const p = pos(s, k), pa = pos(s, Math.max(0, k - 1)), pb = pos(s, Math.min(n - 1, k + 1)), sa = pos(Math.max(0, s - 1), k), sb = pos(Math.min(S - 1, s + 1), k);
      const t1 = new B.Vector3(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]), t2 = new B.Vector3(sb[0] - sa[0], sb[1] - sa[1], sb[2] - sa[2]);
      const nn = B.Vector3.Cross(t2, t1).normalize(); if (flip) nn.scaleInPlace(-1);
      this.push(p[0], p[1], p[2], nn.x, nn.y, nn.z, colFn ? colFn(p[2], p[1], s) : C(col));
    }
    for (let s = 0; s < S - 1; s++) for (let k = 0; k < n - 1; k++) {
      const a = base + s * n + k, b = a + n; if (flip) this.i.push(a, b + 1, a + 1, a, b, b + 1); else this.i.push(a, a + 1, b + 1, a, b + 1, b);
    }
    return this;
  }
  /** 任意平面四边形（逆时针 = 正面朝向观察者），顶点色可分别给 */
  quad(a, b, c, d, col, cols) {
    const e1 = new B.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), e2 = new B.Vector3(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    const nn = B.Vector3.Cross(e2, e1).normalize(), k = this.p.length / 3;
    [a, b, c, d].forEach((v, j) => { const cc = cols ? cols[j] : col; this.push(v[0], v[1], v[2], nn.x, nn.y, nn.z, C(cc).slice(0, 3), cc && cc[3] !== undefined ? cc[3] : 1); });
    this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
    return this;
  }
  /* —— 贴地柔和暗影（shade 桶专用：黑色 + 顶点透明度）—— */
  /** 墙根暗带：沿 (x0,z0)→(x1,z1) 的墙线，向 (nx,nz) 方向延伸 w 米 */
  shadeStrip(x0, z0, x1, z1, y, nx, nz, w = 0.6, a = 0.32) {
    const k = this.p.length / 3, P = [[x0, z0, a], [x1, z1, a], [x1 + nx * w, z1 + nz * w, 0], [x0 + nx * w, z0 + nz * w, 0]];
    P.forEach(([x, z, al]) => this.push(x, y, z, 0, 1, 0, [0, 0, 0], al));
    this.i.push(k, k + 1, k + 2, k, k + 2, k + 3, k, k + 2, k + 1, k, k + 3, k + 2);
    return this;
  }
  /** 矩形区域四周的墙根暗带（房间内侧） */
  shadeRoom(x0, x1, z0, z1, y, w = 0.7, a = 0.3) {
    this.shadeStrip(x0, z0, x1, z0, y, 0, 1, w, a); this.shadeStrip(x0, z1, x1, z1, y, 0, -1, w, a);
    this.shadeStrip(x0, z0, x0, z1, y, 1, 0, w, a); this.shadeStrip(x1, z0, x1, z1, y, -1, 0, w, a);
    return this;
  }
  /** 椭圆形暗影（中心最深） */
  shadeBlob(x, z, rx, rz, y, a = 0.35, ry = 0, seg = 16) {
    const k = this.p.length / 3, cs = Math.cos(ry), sn = Math.sin(ry);
    this.push(x, y, z, 0, 1, 0, [0, 0, 0], a);
    for (let s = 0; s <= seg; s++) { const t = s / seg * Math.PI * 2, lx = Math.cos(t) * rx, lz = Math.sin(t) * rz; this.push(x + lx * cs + lz * sn, y, z - lx * sn + lz * cs, 0, 1, 0, [0, 0, 0], 0); }
    for (let s = 0; s < seg; s++) this.i.push(k, k + 1 + s, k + 2 + s);
    return this;
  }
  /** 圆环暗影（柱脚） */
  shadeRing(x, z, r0, r1, y, a = 0.3, seg = 20) {
    const k = this.p.length / 3;
    for (let s = 0; s <= seg; s++) { const t = s / seg * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t); this.push(x + c * r0, y, z + sn * r0, 0, 1, 0, [0, 0, 0], a); this.push(x + c * r1, y, z + sn * r1, 0, 1, 0, [0, 0, 0], 0); }
    for (let s = 0; s < seg; s++) { const a0 = k + s * 2; this.i.push(a0, a0 + 1, a0 + 3, a0, a0 + 3, a0 + 2); }
    return this;
  }
  /** 合并另一个 Geo（带变换） */
  merge(g, m) {
    for (let k = 0, j = 0; k < g.p.length; k += 3, j++) {
      if (m) { B.Vector3.TransformCoordinatesFromFloatsToRef(g.p[k], g.p[k + 1], g.p[k + 2], m, tmpV); B.Vector3.TransformNormalFromFloatsToRef(g.n[k], g.n[k + 1], g.n[k + 2], m, tmpN); }
      else { tmpV.set(g.p[k], g.p[k + 1], g.p[k + 2]); tmpN.set(g.n[k], g.n[k + 1], g.n[k + 2]); }
      const base = this.p.length / 3; void base;
      this.p.push(tmpV.x, tmpV.y, tmpV.z); this.n.push(tmpN.x, tmpN.y, tmpN.z);
      this.u.push(g.u[j * 2], g.u[j * 2 + 1]); if (this.b) this.b.push(g.b ? g.b[j] : this.bone);
    }
    const base = this.p.length / 3 - g.p.length / 3;
    this.c.push(...g.c); for (const v of g.i) this.i.push(v + base);
    return this;
  }
  toMesh(name, scene, mat, parent, { alpha = false } = {}) {
    const m = new B.Mesh(name, scene);
    // PBR 在线性空间计算：顶点色（sRGB 十六进制）转线性；标准材质（发光件）保持原样
    const lin = mat && mat.getClassName && mat.getClassName() === 'PBRMaterial';
    const cols = lin ? this.c.map((v, i) => (i % 4 === 3 ? v : Math.pow(v, 2.2))) : this.c;
    const vd = new B.VertexData(); vd.positions = this.p; vd.normals = this.n; vd.colors = cols; vd.indices = this.i; vd.uvs = this.u;
    if (this.b) {
      const mi = [], mw = []; for (const bi of this.b) { mi.push(bi, 0, 0, 0); mw.push(1, 0, 0, 0); }
      vd.matricesIndices = mi; vd.matricesWeights = mw;
    }
    vd.applyToMesh(m, false);
    m.hasVertexAlpha = alpha;
    m.material = mat; if (parent) m.parent = parent;
    m.isPickable = false;
    return m;
  }
}
