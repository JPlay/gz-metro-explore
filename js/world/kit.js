/*
 * 场景搭建工具：
 *   - 静态几何写进 4 个桶（实色 / 发光 / 玻璃 / 标牌图集），最后各合成 1 个网格；
 *   - 碰撞体是不可见的方块（Babylon 内置碰撞），静态的冻结世界矩阵；
 *   - 标牌文字画在一张 2048² 的 DynamicTexture 图集上，所有标牌合成 1 个网格。
 */
import { Geo, hex } from '../core/geo.js';
import { mats } from '../core/mats.js';
const B = window.BABYLON;
export const FONT = '"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Noto Sans SC","Microsoft YaHei",sans-serif';

export class Kit {
  constructor(scene, name, parent) {
    this.scene = scene; this.M = mats(scene);
    this.root = new B.TransformNode(name, scene); if (parent) this.root.parent = parent;
    this.solid = new Geo(); this.glow = new Geo(); this.glass = new Geo();
    this.colliders = []; this.atlas = null; this.meshes = [];
  }
  /** 不可见碰撞方块（中心+尺寸，可选绕 z/x 旋转用于坡道） */
  col(x, y, z, w, h, d, { rz = 0, rx = 0, ry = 0, parent, dynamic = false, name = 'col' } = {}) {
    const m = B.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.parent = parent || this.root; m.isVisible = false; m.checkCollisions = true; m.isPickable = true; m.doNotSyncBoundingInfo = false;
    m.metadata = { collider: true };
    if (!dynamic) { m.computeWorldMatrix(true); m.freezeWorldMatrix(); }
    this.colliders.push(m);
    return m;
  }
  colSlab(x0, x1, y0, y1, z0, z1, opts) { return this.col((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), opts); }
  /** 实心方块 + 碰撞 */
  block(x0, x1, y0, y1, z0, z1, col, collide = true) {
    this.solid.slab(x0, x1, y0, y1, z0, z1, typeof col === 'string' ? hex(col) : col);
    if (collide) this.colSlab(x0, x1, y0, y1, z0, z1);
  }
  /** 地板矩形减去若干洞（洞为 [x0,x1,z0,z1]）：切成不重叠的矩形 */
  floorWithHoles(x0, x1, z0, z1, y0, y1, col, holes = [], collide = true) {
    let rects = [[x0, x1, z0, z1]];
    for (const h of holes) {
      const out = [];
      for (const r of rects) {
        if (h[0] >= r[1] || h[1] <= r[0] || h[2] >= r[3] || h[3] <= r[2]) { out.push(r); continue; }
        const hx0 = Math.max(h[0], r[0]), hx1 = Math.min(h[1], r[1]), hz0 = Math.max(h[2], r[2]), hz1 = Math.min(h[3], r[3]);
        if (hz0 > r[2]) out.push([r[0], r[1], r[2], hz0]);
        if (hz1 < r[3]) out.push([r[0], r[1], hz1, r[3]]);
        if (hx0 > r[0]) out.push([r[0], hx0, hz0, hz1]);
        if (hx1 < r[1]) out.push([hx1, r[1], hz0, hz1]);
      }
      rects = out;
    }
    rects.forEach(r => this.block(r[0], r[1], y0, y1, r[2], r[3], col, collide));
  }
  /**
   * 楼梯/坡道：沿 x 轴（axis='x'）或 z 轴，从 (a, ya) 到 (b, yb)，宽度方向范围 [w0,w1]。
   * 视觉是台阶（实心填到 baseY），碰撞是一块倾斜薄板 + 两侧扶手墙。
   */
  stairs(axis, a, ya, b, yb, w0, w1, baseY, col, { rails = true, railCol = '#dfe9f2', steps = true } = {}) {
    const L = Math.abs(b - a), dy = yb - ya, n = Math.max(2, Math.round(Math.abs(dy) / 0.18)), dir = Math.sign(b - a);
    const c = typeof col === 'string' ? hex(col) : col, c2 = c.map(v => v * 0.9);
    for (let k = 0; k < n; k++) {
      const s0 = a + dir * L * k / n, s1 = a + dir * L * (k + 1) / n, top = ya + dy * (k + (dy < 0 ? 1 : 0)) / n;
      const lo = Math.min(top, baseY), hi = Math.max(top, baseY);
      if (axis === 'x') this.solid.slab(s0, s1, lo, hi, w0, w1, k % 2 ? c : c2); else this.solid.slab(w0, w1, lo, hi, s0, s1, k % 2 ? c : c2);
    }
    const len = Math.hypot(L, dy), ang = Math.atan2(dy, L * dir), mid = (a + b) / 2, my = (ya + yb) / 2, W = Math.abs(w1 - w0), wm = (w0 + w1) / 2;
    // 碰撞板：顶面贴着台阶前缘连线
    const t = 0.3;
    if (axis === 'x') { let nx = -Math.sin(ang), ny = Math.cos(ang); if (ny < 0) { nx = -nx; ny = -ny; } this.col(mid - nx * t / 2, my - ny * t / 2, wm, len, t, W, { rz: ang }); }
    else { const phi = -ang; let nz = Math.sin(phi), ny = Math.cos(phi); if (ny < 0) { nz = -nz; ny = -ny; } this.col(wm, my - ny * t / 2, mid - nz * t / 2, W, t, len, { rx: phi }); }
    // 楼梯下方实心部分的侧面碰撞（站台上的人不会走进台阶里）
    if (Math.abs(baseY - Math.max(ya, yb)) > 0.6) {
      const segN = 5, yAt = s => ya + dy * (s - a) / (b - a);
      for (let k = 0; k < segN; k++) {
        const s0 = a + (b - a) * k / segN, s1 = a + (b - a) * (k + 1) / segN, top = Math.min(yAt(s0), yAt(s1)) - 0.05;
        if (top - baseY < 0.3 || top < baseY) continue;
        for (const w of [w0, w1]) { if (axis === 'x') this.colSlab(s0, s1, baseY, top, w - 0.05, w + 0.05); else this.colSlab(w - 0.05, w + 0.05, baseY, top, s0, s1); }
      }
      const hi = ya > yb ? a : b, hy = Math.max(ya, yb);
      if (baseY < hy) { if (axis === 'x') this.colSlab(hi - 0.05 * dir * (ya > yb ? -1 : 1), hi, baseY, hy - 0.3, w0, w1); else this.colSlab(w0, w1, baseY, hy - 0.3, hi - 0.05, hi + 0.05); }
    }
    if (rails) {
      for (const w of [w0, w1]) {
        const off = w === w0 ? -0.06 : 0.06;
        if (axis === 'x') { this.col(mid, my + 0.7, w + off, len, 1.4, 0.12, { rz: ang }); this.glass.box(mid, my + 0.55, w + off, len, 0.9, 0.05, hex(railCol), 0, 0, ang); this.solid.box(mid, my + 1.02, w + off, len, 0.07, 0.1, hex('#9aa7b5'), 0, 0, ang); }
        else { this.col(w + off, my + 0.7, mid, 0.12, 1.4, len, { rx: -ang }); this.glass.box(w + off, my + 0.55, mid, 0.05, 0.9, len, hex(railCol), 0, -ang, 0); this.solid.box(w + off, my + 1.02, mid, 0.1, 0.07, len, hex('#9aa7b5'), 0, -ang, 0); }
      }
    }
  }
  /** 玻璃栏杆（直线段）+ 碰撞 */
  rail(x0, z0, x1, z1, y, h = 1.1) {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    this.glass.box(cx, y + h / 2, cz, 0.05, h, len, hex('#dff1ff'), ry);
    this.solid.box(cx, y + h, cz, 0.1, 0.08, len + 0.05, hex('#9aa7b5'), ry);
    const n = Math.max(1, Math.round(len / 1.5));
    for (let k = 0; k <= n; k++) { const f = k / n; this.solid.box(x0 + (x1 - x0) * f, y + h / 2, z0 + (z1 - z0) * f, 0.08, h, 0.08, hex('#9aa7b5')); }
    this.col(cx, y + 0.75, cz, 0.15, 1.5, len, { ry });
  }
  /** 标牌：opts {w,h, bg, fg, zh, en, arrow:'left'|'right'|'up'|'down', badges:[{t,bg,fg}], face(弧度: 正面朝向), double} */
  sign(x, y, z, o) {
    if (!this.atlas) this.atlas = new Atlas(this.scene);
    const uv = this.atlas.draw(o);
    this.atlas.quad(x, y, z, o.w, o.h, o.face || 0, uv);
    if (o.double) this.atlas.quad(x - Math.sin(o.face || 0) * 0.07, y, z - Math.cos(o.face || 0) * 0.07, o.w, o.h, (o.face || 0) + Math.PI, o.backUv ? this.atlas.draw(o.backUv) : uv);
    if (o.box !== false) { const a = o.face || 0; this.solid.box(x - Math.sin(a) * 0.045, y, z - Math.cos(a) * 0.045, o.w + 0.08, o.h + 0.08, o.double ? 0.03 : 0.06, hex('#3b4658'), a); }
  }
  finish(freeze = true) {
    const s = this.scene, out = [];
    if (!this.solid.empty) { const m = this.solid.toMesh('solid', s, this.M.solid, this.root); m.receiveShadows = true; out.push(m); }
    if (!this.glow.empty) out.push(this.glow.toMesh('glow', s, this.M.glow, this.root));
    if (!this.glass.empty) { const m = this.glass.toMesh('glass', s, this.M.glass, this.root); m.alphaIndex = 10; out.push(m); }
    if (this.atlas) out.push(this.atlas.finish(this.root));
    if (freeze) out.forEach(m => { m.computeWorldMatrix(true); m.freezeWorldMatrix(); m.doNotSyncBoundingInfo = true; });
    this.meshes = out;
    this.solid = this.glow = this.glass = null;
    return out;
  }
  dispose() {
    if (this.atlas) this.atlas.dispose();
    this.root.dispose(false, false);
  }
}

/** 标牌图集 */
class Atlas {
  constructor(scene) {
    this.S = 2048; this.ppm = 115; this.overflow = 0; this.x = 0; this.y = 0; this.row = 0; this.scene = scene;
    this.tex = new B.DynamicTexture('signs', { width: this.S, height: this.S }, scene, true);
    this.tex.hasAlpha = false; this.ctx = this.tex.getContext();
    this.ctx.fillStyle = '#2b3445'; this.ctx.fillRect(0, 0, this.S, this.S);
    this.p = []; this.uv = []; this.i = []; this.cache = new Map();
  }
  alloc(w, h) {
    if (this.x + w > this.S) { this.x = 0; this.y += this.row + 4; this.row = 0; }
    if (this.y + h > this.S) { this.y = 0; this.x = 0; this.overflow++; } // 满了就覆盖（ppm=100 时用不满）
    const r = { x: this.x, y: this.y, w, h }; this.x += w + 4; this.row = Math.max(this.row, h); return r;
  }
  draw(o) {
    const key = JSON.stringify([o.w, o.h, o.bg, o.fg, o.zh, o.en, o.arrow, o.badges, o.align]);
    if (this.cache.has(key)) return this.cache.get(key);
    const pw = Math.min(this.S, Math.round(o.w * this.ppm)), ph = Math.round(o.h * this.ppm), r = this.alloc(pw, ph), c = this.ctx;
    c.save(); c.translate(r.x, r.y);
    c.fillStyle = o.bg || '#24324a'; c.fillRect(0, 0, pw, ph);
    if (o.stripe) { c.fillStyle = o.stripe; c.fillRect(0, ph - ph * 0.1, pw, ph * 0.1); }
    let x = ph * 0.18; const fg = o.fg || '#ffffff';
    const arrowGlyph = { left: '←', right: '→', up: '↑', down: '↓' }[o.arrow];
    const drawArrow = () => { c.fillStyle = fg; c.font = `900 ${ph * 0.62}px ${FONT}`; c.textBaseline = 'middle'; c.fillText(arrowGlyph, x, ph * 0.5); x += c.measureText(arrowGlyph).width + ph * 0.18; };
    if (arrowGlyph && o.arrow !== 'right') drawArrow();
    for (const b of o.badges || []) {
      const bw = ph * (String(b.t).length > 2 ? 1.25 : 0.72), bh = ph * 0.62, by = (ph - bh) / 2;
      c.fillStyle = b.bg; roundRect(c, x, by, bw, bh, bh * 0.22); c.fill();
      c.fillStyle = b.fg || '#fff'; c.font = `800 ${bh * (String(b.t).length > 2 ? 0.48 : 0.62)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(b.t, x + bw / 2, ph / 2 + bh * 0.03); c.textAlign = 'left'; x += bw + ph * 0.14;
    }
    const tailArrow = arrowGlyph && o.arrow === 'right' ? ph * 0.8 : 0;
    const avail = pw - x - ph * 0.18 - tailArrow;
    c.fillStyle = fg; c.textBaseline = 'alphabetic';
    if (o.zh) {
      let fs = o.en ? ph * 0.5 : ph * 0.62; c.font = `800 ${fs}px ${FONT}`;
      const tw = c.measureText(o.zh).width; if (tw > avail) { fs *= avail / tw; c.font = `800 ${fs}px ${FONT}`; }
      const tx = o.align === 'center' ? x + (avail - c.measureText(o.zh).width) / 2 : x;
      c.fillText(o.zh, tx, o.en ? ph * 0.56 : ph * 0.72);
    }
    if (o.en) {
      let fs = o.zh ? ph * 0.22 : ph * 0.45; c.font = `600 ${fs}px ${FONT}`;
      const tw = c.measureText(o.en).width; if (tw > avail) { fs *= avail / tw; c.font = `600 ${fs}px ${FONT}`; }
      c.globalAlpha = 0.92; const tx = o.align === 'center' ? x + (avail - c.measureText(o.en).width) / 2 : x;
      c.fillText(o.en, tx, o.zh ? ph * 0.86 : ph * 0.66); c.globalAlpha = 1;
    }
    if (tailArrow) { x = pw - tailArrow; drawArrow(); }
    c.restore();
    const S = this.S, uv = { u0: r.x / S, u1: (r.x + pw) / S, v0: 1 - (r.y + ph) / S, v1: 1 - r.y / S };
    this.cache.set(key, uv); this.dirty = true;
    return uv;
  }
  /** face：正面法线 = (sin a, 0, cos a)；文字从观看者的左往右 */
  quad(x, y, z, w, h, a, uv) {
    const nx = Math.sin(a), nz = Math.cos(a), rx = -nz, rz = nx, base = this.p.length / 3;
    const ox = x + nx * 0.005, oz = z + nz * 0.005;
    const P = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    P.forEach(([u, v]) => this.p.push(ox + rx * u, y + v, oz + rz * u));
    this.uv.push(uv.u0, uv.v0, uv.u1, uv.v0, uv.u1, uv.v1, uv.u0, uv.v1);
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  finish(parent) {
    this.tex.update(true);
    const mat = new B.StandardMaterial('signMat', this.scene);
    mat.diffuseColor = new B.Color3(0, 0, 0); mat.specularColor = new B.Color3(0, 0, 0); mat.emissiveTexture = this.tex; mat.disableLighting = true; mat.backFaceCulling = false;
    const m = new B.Mesh('signs', this.scene), vd = new B.VertexData();
    const n = []; for (let k = 0; k < this.p.length; k += 3) n.push(0, 1, 0);
    vd.positions = this.p; vd.uvs = this.uv; vd.indices = this.i; vd.normals = n; vd.applyToMesh(m);
    m.material = mat; m.parent = parent; m.isPickable = false; this.mat = mat;
    return m;
  }
  dispose() { this.tex.dispose(); if (this.mat) this.mat.dispose(); }
}
export function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
