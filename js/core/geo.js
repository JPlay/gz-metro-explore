/*
 * 几何累加器：把大量方块/圆柱写进同一份顶点数据（顶点色），最后生成 1 个网格 = 1 次绘制调用。
 * 静态场景全部走这里：车站一共只有 3~4 个大网格（实色、发光、玻璃、标牌图集）。
 */
const B = window.BABYLON;
const tmpM = new B.Matrix(), tmpV = new B.Vector3(), tmpN = new B.Vector3();
const cache = {};
function proto(kind, key, make) { const k = kind + key; return cache[k] || (cache[k] = make()); }

export function hex(h) { const c = B.Color3.FromHexString(h); return [c.r, c.g, c.b]; }
export function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

export class Geo {
  constructor() { this.p = []; this.n = []; this.c = []; this.i = []; this.uv = null; }
  get empty() { return this.i.length === 0; }
  /** 追加一份 VertexData（单位尺寸原型）并用矩阵变换 */
  addVD(vd, m, col, alpha = 1) {
    const base = this.p.length / 3, P = vd.positions, N = vd.normals;
    for (let k = 0; k < P.length; k += 3) {
      B.Vector3.TransformCoordinatesFromFloatsToRef(P[k], P[k + 1], P[k + 2], m, tmpV);
      B.Vector3.TransformNormalFromFloatsToRef(N[k], N[k + 1], N[k + 2], m, tmpN); tmpN.normalize();
      this.p.push(tmpV.x, tmpV.y, tmpV.z); this.n.push(tmpN.x, tmpN.y, tmpN.z); this.c.push(col[0], col[1], col[2], alpha);
    }
    const I = vd.indices; for (let k = 0; k < I.length; k++) this.i.push(I[k] + base);
    return this;
  }
  /** 方块：中心 (x,y,z)，尺寸 (w,h,d)，可选旋转 (ry 绕竖轴, rx, rz) */
  box(x, y, z, w, h, d, col, ry = 0, rx = 0, rz = 0, alpha = 1) {
    const vd = proto('box', '', () => B.VertexData.CreateBox({ size: 1 }));
    B.Matrix.ComposeToRef(new B.Vector3(w, h, d), B.Quaternion.RotationYawPitchRoll(ry, rx, rz), new B.Vector3(x, y, z), tmpM);
    return this.addVD(vd, tmpM, col, alpha);
  }
  /** 底面在 y0、顶面在 y1 的方块（常用） */
  slab(x0, x1, y0, y1, z0, z1, col) { return this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), col); }
  cyl(x, y, z, dia, h, col, tess = 8, ry = 0, rx = 0, rz = 0, dTop) {
    const key = tess + '_' + (dTop === undefined ? 1 : (dTop / dia).toFixed(3));
    const vd = proto('cyl', key, () => B.VertexData.CreateCylinder({ height: 1, diameterBottom: 1, diameterTop: dTop === undefined ? 1 : dTop / dia, tessellation: tess }));
    B.Matrix.ComposeToRef(new B.Vector3(dia, h, dia), B.Quaternion.RotationYawPitchRoll(ry, rx, rz), new B.Vector3(x, y, z), tmpM);
    return this.addVD(vd, tmpM, col);
  }
  sphere(x, y, z, dia, col, seg = 2, sy = 1) {
    const vd = proto('ico', seg, () => B.VertexData.CreateIcoSphere({ radius: 0.5, subdivisions: seg, flat: true }));
    B.Matrix.ComposeToRef(new B.Vector3(dia, dia * sy, dia), B.Quaternion.Identity(), new B.Vector3(x, y, z), tmpM);
    return this.addVD(vd, tmpM, col);
  }
  /** 合并另一个 Geo（带变换） */
  merge(g, m) {
    const base = this.p.length / 3;
    for (let k = 0; k < g.p.length; k += 3) {
      if (m) { B.Vector3.TransformCoordinatesFromFloatsToRef(g.p[k], g.p[k + 1], g.p[k + 2], m, tmpV); B.Vector3.TransformNormalFromFloatsToRef(g.n[k], g.n[k + 1], g.n[k + 2], m, tmpN); }
      else { tmpV.set(g.p[k], g.p[k + 1], g.p[k + 2]); tmpN.set(g.n[k], g.n[k + 1], g.n[k + 2]); }
      this.p.push(tmpV.x, tmpV.y, tmpV.z); this.n.push(tmpN.x, tmpN.y, tmpN.z);
    }
    this.c.push(...g.c); for (const v of g.i) this.i.push(v + base);
    return this;
  }
  toMesh(name, scene, mat, parent) {
    const m = new B.Mesh(name, scene);
    const vd = new B.VertexData(); vd.positions = this.p; vd.normals = this.n; vd.colors = this.c; vd.indices = this.i;
    vd.applyToMesh(m, false);
    m.material = mat; if (parent) m.parent = parent;
    m.isPickable = false;
    return m;
  }
}
