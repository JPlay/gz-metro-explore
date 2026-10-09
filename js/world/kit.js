/*
 * 场景搭建工具：
 *   - 静态几何按材质分桶（paint/floor/wall/metal/glass/glow/…，见 core/mats.js），每桶最后合成 1 个网格；
 *     桶名可带后缀（如 'floor@P'）= 同一材质的独立副本（用于不同的反射探针）；
 *   - 碰撞体是不可见的方块（Babylon 内置碰撞），静态的冻结世界矩阵；
 *   - 标牌文字画在一张 2048² 的 DynamicTexture 图集上（广州地铁导向风格：深灰底白字、线路色编号、出口信息黄色），所有标牌合成 1 个网格。
 */
import { Geo, hex } from '../core/geo.js';
import { mats } from '../core/mats.js';
import { LINES, OTHER_LINES } from '../data/lines.js';
const B = window.BABYLON;
export const FONT = '"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Noto Sans SC","Source Han Sans SC","Microsoft YaHei",sans-serif';
export const FONT_EN = '"Helvetica Neue",Helvetica,Arial,"Noto Sans",sans-serif';
export const SIGN = { bg: '#2A2D31', frame: '#1B1D20', white: '#FFFFFF', exit: '#FFC72C', exitInk: '#1B1D20' };
const STEEL = hex('#B9C0C8');

export class Kit {
  constructor(scene, name, parent) {
    this.scene = scene; this.M = mats(scene);
    this.root = new B.TransformNode(name, scene); if (parent) this.root.parent = parent;
    this.buckets = {}; this.colliders = []; this.atlas = null; this.meshes = []; this.byBucket = {};
  }
  g(name) { return this.buckets[name] || (this.buckets[name] = new Geo()); }
  get solid() { return this.g('paint'); }
  get glow() { return this.g('glow'); }
  get glass() { return this.g('glass'); }
  get metal() { return this.g('metal'); }
  get shade() { return this.g('shade'); }
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
  /** 实心方块 + 碰撞（bucket 默认 paint） */
  block(x0, x1, y0, y1, z0, z1, col, collide = true, bucket = 'paint', o) {
    this.g(bucket).slab(x0, x1, y0, y1, z0, z1, typeof col === 'string' ? hex(col) : col, o);
    if (collide) this.colSlab(x0, x1, y0, y1, z0, z1);
  }
  /** 地板矩形减去若干洞（洞为 [x0,x1,z0,z1]）：切成不重叠的矩形 */
  floorWithHoles(x0, x1, z0, z1, y0, y1, col, holes = [], collide = true, bucket = 'paint') {
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
    rects.forEach(r => this.block(r[0], r[1], y0, y1, r[2], r[3], col, collide, bucket, { ao: false }));
    return rects;
  }
  /**
   * 楼梯：沿 x 轴（axis='x'）或 z 轴，从 (a, ya) 到 (b, yb)，宽度方向范围 [w0,w1]。
   * 视觉：花岗岩踏步 + 深色防滑条（踏步前缘）+ 不锈钢扶手；碰撞：一块倾斜薄板 + 两侧扶手墙。
   */
  stairs(axis, a, ya, b, yb, w0, w1, baseY, col, { rails = true, steps = true, nosing = '#3A3F45', visual = null } = {}) {
    if (visual) steps = false;
    const L = Math.abs(b - a), dy = yb - ya, n = Math.max(2, Math.round(Math.abs(dy) / 0.16)), dir = Math.sign(b - a);
    const c = typeof col === 'string' ? hex(col) : col, F = this.g('floor'), P = this.g('paint'), nc = hex(nosing);
    for (let k = 0; k < (steps ? n : 0); k++) {
      const s0 = a + dir * L * k / n, s1 = a + dir * L * (k + 1) / n, top = ya + dy * (k + (dy < 0 ? 1 : 0)) / n;
      const lo = Math.min(top, baseY), hi = Math.max(top, baseY);
      if (axis === 'x') F.slab(s0, s1, lo, hi, w0, w1, c, { ao: false }); else F.slab(w0, w1, lo, hi, s0, s1, c, { ao: false });
      // 防滑条：在踏步的“前缘”（低的一侧）
      const edge = dy < 0 ? s1 : s0, e0 = edge - dir * (dy < 0 ? 0.07 : 0), e1 = edge + dir * (dy < 0 ? 0 : 0.07);
      if (axis === 'x') P.slab(Math.min(e0, e1), Math.max(e0, e1), top, top + 0.006, w0 + 0.05, w1 - 0.05, nc, { ao: false });
      else P.slab(w0 + 0.05, w1 - 0.05, top, top + 0.006, Math.min(e0, e1), Math.max(e0, e1), nc, { ao: false });
    }
    const len = Math.hypot(L, dy), ang = Math.atan2(dy, L * dir), mid = (a + b) / 2, my = (ya + yb) / 2, W = Math.abs(w1 - w0), wm = (w0 + w1) / 2;
    const t = 0.3;
    if (axis === 'x') { let nx = -Math.sin(ang), ny = Math.cos(ang); if (ny < 0) { nx = -nx; ny = -ny; } this.col(mid - nx * t / 2, my - ny * t / 2, wm, len, t, W, { rz: ang }); }
    else { const phi = -ang; let nz = Math.sin(phi), ny = Math.cos(phi); if (ny < 0) { nz = -nz; ny = -ny; } this.col(wm, my - ny * t / 2, mid - nz * t / 2, W, t, len, { rx: phi }); }
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
        // 玻璃栏板 + 不锈钢扶手 + 立柱
        if (axis === 'x') { this.col(mid, my + 0.7, w + off, len, 1.4, 0.12, { rz: ang }); this.glass.box(mid, my + 0.55, w + off, len, 0.9, 0.03, hex('#DDEFF7'), 0, 0, ang); }
        else { this.col(w + off, my + 0.7, mid, 0.12, 1.4, len, { rx: -ang }); this.glass.box(w + off, my + 0.55, mid, 0.03, 0.9, len, hex('#DDEFF7'), 0, -ang, 0); }
        const pt = s => axis === 'x' ? [s, ya + dy * (s - a) / (b - a), w + off] : [w + off, ya + dy * (s - a) / (b - a), s];
        const A = pt(a), Bp = pt(b);
        this.metal.tube([A[0], A[1] + 1.02, A[2]], [Bp[0], Bp[1] + 1.02, Bp[2]], 0.055, STEEL);
        const np = Math.max(2, Math.round(len / 1.6));
        for (let k = 0; k <= np; k++) { const s = a + (b - a) * k / np, p = pt(s); this.metal.tube([p[0], p[1], p[2]], [p[0], p[1] + 1.02, p[2]], 0.035, STEEL, 6); }
      }
    }
  }
  /** 玻璃栏杆（直线段）+ 碰撞：钢化玻璃 + 不锈钢扶手 + 立柱 */
  rail(x0, z0, x1, z1, y, h = 1.1) {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    this.glass.box(cx, y + 0.1 + (h - 0.15) / 2, cz, 0.024, h - 0.15, len, hex('#E2F2FA'), ry);
    this.metal.tube([x0, y + h, z0], [x1, y + h, z1], 0.06, STEEL, 10);
    this.metal.box(cx, y + 0.05, cz, 0.06, 0.1, len, STEEL, ry, 0, 0, 1, { ao: false });
    const n = Math.max(1, Math.round(len / 1.5));
    for (let k = 0; k <= n; k++) { const f = k / n; this.metal.cyl(x0 + (x1 - x0) * f, y + h / 2, z0 + (z1 - z0) * f, 0.05, h, STEEL, 8, 0, 0, 0, undefined, { ao: false }); }
    this.col(cx, y + 0.75, cz, 0.15, 1.5, len, { ry });
  }
  /**
   * 标牌：o = { w,h, kind:'dir'|'exit'|'name'|'entrance'|'poster'|'plain', zh,en, arrow, badges:[{line}|{t,bg,fg}], exits:['A','B'], face(弧度), double, back, hang(吊杆顶端 y) }
   * face：正面法线 = (sin a, 0, cos a)
   */
  sign(x, y, z, o) {
    if (!this.atlas) this.atlas = new Atlas(this.scene);
    const a = o.face || 0, uv = this.atlas.draw(o), d = o.double ? 0.06 : 0.07;
    const nx = Math.sin(a), nz = Math.cos(a);
    this.atlas.quad(x, y, z, o.w, o.h, a, uv);
    if (o.double) this.atlas.quad(x - nx * d, y, z - nz * d, o.w, o.h, a + Math.PI, o.back ? this.atlas.draw({ w: o.w, h: o.h, ...o.back }) : uv);
    if (o.box !== false) {
      // 牌面离边框正面 2.3cm（以前只有 1cm：iPad 的深度精度下 8~10m 外牌面和边框抢深度，字闪成碎片）；双面牌两面都一样
      const fc = hex(o.kind === 'name' || o.kind === 'poster' ? '#C9CED4' : SIGN.frame);
      this.solid.box(x - nx * d / 2, y, z - nz * d / 2, o.w + 0.06, o.h + 0.06, d - 0.03, fc, a, 0, 0, 1, { ao: false });
    }
    if (o.hang !== undefined) {
      const rx = -nz, rz = nx, top = o.hang, cy = y + o.h / 2;
      for (const s of [-1, 1]) { const px = x - nx * d / 2 + rx * s * o.w * 0.35, pz = z - nz * d / 2 + rz * s * o.w * 0.35; this.metal.tube([px, cy, pz], [px, top, pz], 0.03, STEEL, 6); }
    }
  }
  finish(freeze = true) {
    const s = this.scene, out = [];
    for (const [name, g] of Object.entries(this.buckets)) {
      if (g.empty) continue;
      const mat = bucketMat(s, this.M, name), alpha = name === 'shade' || name === 'halo';
      const m = g.toMesh(name, s, mat, this.root, { alpha });
      if (name === 'glass') m.alphaIndex = 10; if (name === 'shade') m.alphaIndex = 1; if (name === 'halo') m.alphaIndex = 20;
      m.receiveShadows = !alpha && name !== 'glow' && name !== 'band';
      this.byBucket[name] = m; out.push(m);
    }
    if (this.atlas) { const m = this.atlas.finish(this.root); this.byBucket.signs = m; out.push(m); }
    if (freeze) out.forEach(m => { m.computeWorldMatrix(true); m.freezeWorldMatrix(); m.doNotSyncBoundingInfo = true; });
    this.meshes = out;
    this.buckets = {};
    return out;
  }
  dispose() {
    if (this.atlas) this.atlas.dispose();
    this.root.dispose(false, false);
  }
}
/** 桶 → 材质；'floor@P' 这样的后缀会克隆出独立材质（缓存，不销毁） */
export function bucketMat(scene, M, name) {
  const [base, suf] = name.split('@');
  if (!suf) return M[base] || M.paint;
  const key = 'bucket:' + name;
  if (!M.colored[key]) { const m = (M[base] || M.paint).clone(name); m._normalTex = M[base]._normalTex; if (M[base]._normalTex) M.normals.push(m); M.colored[key] = m; }
  return M.colored[key];
}

/* ============ 标牌图集 ============ */
export function lineBadgeInfo(b) {
  if (b.line !== undefined) {
    const k = b.line;
    if (LINES[k]) return { t: String(k), bg: LINES[k].color, fg: LINES[k].ink };
    const o = OTHER_LINES[k]; return { t: o ? (o.short || String(k)) : String(k), bg: o ? o.color : '#888', fg: '#FFFFFF' };
  }
  return b;
}
export function drawBadge(c, x, y, h, b, wFactor) {
  b = lineBadgeInfo(b);
  const t = String(b.t), w = h * (wFactor || (t.length > 2 ? 1.5 : t.length > 1 ? 1.12 : 0.92));
  c.fillStyle = b.bg; roundRect(c, x, y, w, h, h * 0.18); c.fill();
  c.fillStyle = b.fg || '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const isNum = /^[0-9A-Z]+$/.test(t);
  c.font = `${isNum ? 700 : 600} ${h * (t.length > 2 ? 0.42 : isNum ? 0.74 : 0.5)}px ${isNum ? FONT_EN : FONT}`;
  c.fillText(t, x + w / 2, y + h * 0.53); c.textAlign = 'left';
  return w;
}
/** 箭头（实心，粗杆） */
export function drawArrow(c, x, y, s, dir, col) {
  if (dir === 'uturn') { // 掉头（往左拐回去）：右边往上走、从上面绕到左边、往下指
    c.save(); c.translate(x + s / 2, y + s / 2); const h = s / 2, r = h * 0.42, cy = -h * 0.28;
    c.strokeStyle = col; c.lineWidth = h * 0.3; c.lineCap = 'butt'; c.beginPath(); c.moveTo(r, h * 0.95); c.lineTo(r, cy); c.arc(0, cy, r, 0, Math.PI, true); c.lineTo(-r, h * 0.2); c.stroke();
    c.fillStyle = col; c.beginPath(); c.moveTo(-r - h * 0.42, h * 0.18); c.lineTo(-r + h * 0.42, h * 0.18); c.lineTo(-r, h * 0.98); c.closePath(); c.fill();
    c.restore(); return;
  }
  c.save(); c.translate(x + s / 2, y + s / 2); c.rotate({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2, upleft: -Math.PI * 0.75, upright: -Math.PI / 4 }[dir] || 0);
  c.fillStyle = col; c.beginPath();
  const h = s / 2; c.moveTo(h, 0); c.lineTo(h * 0.05, -h * 0.82); c.lineTo(h * 0.05, -h * 0.3); c.lineTo(-h * 0.92, -h * 0.3); c.lineTo(-h * 0.92, h * 0.3); c.lineTo(h * 0.05, h * 0.3); c.lineTo(h * 0.05, h * 0.82); c.closePath(); c.fill();
  c.restore();
}
function fitText(c, txt, weight, size, font, maxW) {
  c.font = `${weight} ${size}px ${font}`; const w = c.measureText(txt).width;
  if (w > maxW) { size *= maxW / w; c.font = `${weight} ${size}px ${font}`; }
  return size;
}
class Atlas {
  constructor(scene) {
    this.S = 2048; this.H = 3072; this.ppm = 112; this.overflow = 0; this.x = 0; this.y = 0; this.row = 0; this.scene = scene;
    this.tex = new B.DynamicTexture('signs', { width: this.S, height: this.H }, scene, true);
    this.tex.hasAlpha = false; this.tex.anisotropicFilteringLevel = 8; this.ctx = this.tex.getContext();
    this.ctx.fillStyle = SIGN.bg; this.ctx.fillRect(0, 0, this.S, this.H);
    this.p = []; this.uv = []; this.i = []; this.cache = new Map();
  }
  alloc(w, h) {
    if (this.x + w > this.S) { this.x = 0; this.y += this.row + 4; this.row = 0; }
    if (this.y + h > this.H) { this.y = 0; this.x = 0; this.overflow++; console.warn('sign atlas overflow'); }
    const r = { x: this.x, y: this.y, w, h }; this.x += w + 4; this.row = Math.max(this.row, h); return r;
  }
  draw(o) {
    const key = JSON.stringify(o, (k, v) => (k === 'face' || k === 'double' || k === 'hang' || k === 'back' || k === 'box') ? undefined : v);
    if (this.cache.has(key)) return this.cache.get(key);
    const ppm = Math.min(this.ppm, 1400 / o.w), pw = Math.min(this.S, Math.round(o.w * ppm)), ph = Math.min(1024, Math.round(o.h * ppm)), r = this.alloc(pw, ph), c = this.ctx;
    c.save(); c.beginPath(); c.rect(r.x, r.y, pw, ph); c.clip(); c.translate(r.x, r.y);
    (PAINT[o.kind || 'dir'] || PAINT.dir)(c, pw, ph, o);
    c.restore();
    const S = this.S, H = this.H, uv = { u0: (r.x + 0.5) / S, u1: (r.x + pw - 0.5) / S, v0: 1 - (r.y + ph - 0.5) / H, v1: 1 - (r.y + 0.5) / H };
    this.cache.set(key, uv);
    return uv;
  }
  /** face：正面法线 = (sin a, 0, cos a)；文字从观看者的左往右 */
  quad(x, y, z, w, h, a, uv) {
    const nx = Math.sin(a), nz = Math.cos(a), rx = -nz, rz = nx, base = this.p.length / 3;
    const ox = x + nx * 0.008, oz = z + nz * 0.008;
    const P = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    P.forEach(([u, v]) => this.p.push(ox + rx * u, y + v, oz + rz * u));
    this.uv.push(uv.u0, uv.v0, uv.u1, uv.v0, uv.u1, uv.v1, uv.u0, uv.v1);
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  finish(parent) {
    this.tex.update(true);
    const mat = new B.StandardMaterial('signMat', this.scene);
    mat.diffuseColor = new B.Color3(0, 0, 0); mat.specularColor = new B.Color3(0, 0, 0); mat.emissiveTexture = this.tex; mat.disableLighting = true; mat.backFaceCulling = false;
    // 注意：标准材质里 emissiveColor 会与 emissiveTexture 相加，这里必须为黑，亮度用贴图 level 控制
    mat.emissiveColor = new B.Color3(0, 0, 0); this.tex.level = 0.95;
    const m = new B.Mesh('signs', this.scene), vd = new B.VertexData();
    const n = []; for (let k = 0; k < this.p.length; k += 3) n.push(0, 1, 0);
    vd.positions = this.p; vd.uvs = this.uv; vd.indices = this.i; vd.normals = n; vd.applyToMesh(m);
    m.material = mat; m.parent = parent; m.isPickable = false; this.mat = mat;
    return m;
  }
  dispose() { this.tex.dispose(); if (this.mat) this.mat.dispose(); }
}
/* —— 各类标牌的画法（px 坐标，pw×ph） —— */
function textBlock(c, x, ph, avail, zh, en, fg, { zhK = 0.42, enK = 0.2, align = 'left', y0 = 0, h = ph } = {}) {
  c.fillStyle = fg; c.textBaseline = 'alphabetic';
  const zs = fitText(c, zh || '', 600, h * (en ? zhK : zhK * 1.25), FONT, avail);
  const zw = c.measureText(zh || '').width;
  if (zh) c.fillText(zh, align === 'center' ? x + (avail - zw) / 2 : x, y0 + (en ? h * 0.52 : h * 0.66));
  if (en) {
    fitText(c, en, 500, h * enK, FONT_EN, avail); const ew = c.measureText(en).width;
    c.globalAlpha = 0.92; c.fillText(en, align === 'center' ? x + (avail - ew) / 2 : x, y0 + h * 0.83); c.globalAlpha = 1;
  }
  return zs;
}
const PAINT = {
  /** 悬挂导向牌：深灰底，白字；线路编号用线路色方块 */
  dir(c, pw, ph, o) {
    const fg = o.fg || SIGN.white; c.fillStyle = o.bg || SIGN.bg; c.fillRect(0, 0, pw, ph);
    if (o.bar) { c.fillStyle = o.bar; c.fillRect(0, 0, ph * 0.09, ph); }
    const pad = ph * 0.2, bh = ph * 0.62, by = (ph - bh) / 2; let x = pad + (o.bar ? ph * 0.09 : 0);
    const arrow = o.arrow, tailArrow = arrow === 'right' || arrow === 'upright';
    if (arrow && !tailArrow) { drawArrow(c, x, by, bh, arrow, fg); x += bh + pad * 0.8; }
    for (const b of o.badges || []) { x += drawBadge(c, x, by, bh, b) + pad * 0.55; }
    for (const e of o.exits || []) { x += drawBadge(c, x, by, bh, { t: e, bg: SIGN.exit, fg: SIGN.exitInk }) + pad * 0.45; }
    const tail = tailArrow ? bh + pad : 0, avail = pw - x - pad - tail;
    textBlock(c, x, ph, avail, o.zh, o.en, fg, { align: o.align });
    if (tailArrow) drawArrow(c, pw - pad - bh, by, bh, arrow, fg);
  },
  /**
   * 导向牌（升级版，按广州地铁导向牌：深色底、白色中文大字 + 小英文、大箭头、线路色块、终点方向）：
   *   [大箭头] [线路色块…] 主文字（中 / 英）| 往 终点A | 往 终点B（每个方向一格，中间细分隔线）
   *   字少、字大：给 iPad 上走路时一眼看清。o.dirs = [{ zh, en, arrow? }]，o.bar = 左侧线路色竖条。
   */
  way(c, pw, ph, o) {
    const fg = SIGN.white; c.fillStyle = o.bg || '#1F2226'; c.fillRect(0, 0, pw, ph);
    if (o.bar) { c.fillStyle = o.bar; c.fillRect(0, 0, ph * 0.08, ph); }
    const pad = ph * 0.14, bh = ph * 0.6, by = (ph - bh) / 2; let x = pad + (o.bar ? ph * 0.08 : 0);
    // o.center：箭头 + 线路色块 + 文字整组居中（宽牌子在竖屏下两头会被切掉，内容放中间更容易整块看到）
    if (o.center && !(o.dirs || []).length && o.zh) {
      const aw = o.arrow ? ph * 0.78 + pad * 0.7 : 0;
      const bw = (o.badges || []).reduce((sum, b) => { const t = String(lineBadgeInfo(b).t); return sum + bh * (t.length > 2 ? 1.5 : t.length > 1 ? 1.12 : 0.92) + pad * 0.5; }, 0);
      c.font = `600 ${ph * (o.en ? 0.46 : 0.575)}px ${FONT}`; const zw = c.measureText(o.zh).width;
      c.font = `500 ${ph * 0.2}px ${FONT_EN}`; const ew = c.measureText(o.en || '').width;
      x = Math.max(x, (pw - (aw + bw + Math.max(zw, ew))) / 2);
    }
    if (o.arrow) { const ah = ph * 0.78; drawArrow(c, x, (ph - ah) / 2, ah, o.arrow, fg); x += ah + pad * 0.7; }
    for (const b of o.badges || []) { x += drawBadge(c, x, by, bh, b) + pad * 0.5; }
    const dirs = o.dirs || [], segW = dirs.length ? (o.zh ? (pw - x) * (dirs.length > 1 ? 0.62 : 0.5) : pw - x - pad * 0.5) : 0;
    if (o.zh) { textBlock(c, x, ph, pw - x - segW - pad, o.zh, o.en, fg, { zhK: 0.46, enK: 0.2 }); }
    const x0 = pw - segW, sw = segW / Math.max(1, dirs.length);
    dirs.forEach((d, i) => {
      const sx = x0 + i * sw;
      if (o.zh || i > 0) { c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(sx, ph * 0.16, Math.max(2, ph * 0.02), ph * 0.68); }
      let tx = sx + pad * 0.8;
      if (d.arrow) { const ah = ph * 0.5; drawArrow(c, tx, (ph - ah) / 2, ah, d.arrow, fg); tx += ah + pad * 0.4; }
      c.fillStyle = 'rgba(255,255,255,0.8)'; c.textBaseline = 'alphabetic'; const ws = ph * 0.26; c.font = `600 ${ws}px ${FONT}`; c.fillText('往', tx, ph * 0.5); const ww = c.measureText('往').width + ph * 0.08;
      textBlock(c, tx + ww, ph, sx + sw - tx - ww - pad * 0.5, d.zh, d.en, fg, { zhK: 0.4, enK: 0.18 });
    });
  },
  /** 出口导向：深灰底，黄色字 + 黄色出口字母 */
  exit(c, pw, ph, o) { PAINT.dir(c, pw, ph, { ...o, fg: SIGN.exit, zh: o.zh || '出口', en: o.en || 'Exit' }); },
  /** 站名牌（站台墙 / 站厅）：浅色底，黑色大字站名，英文在下；底部线路色条；两侧前后站 */
  name(c, pw, ph, o) {
    c.fillStyle = '#F7F8F9'; c.fillRect(0, 0, pw, ph);
    const lc = o.lineColor || '#F3D03E', band = ph * 0.13;
    c.fillStyle = lc; c.fillRect(0, ph - band, pw, band);
    c.fillStyle = '#2A2D31'; c.fillRect(0, ph - band - ph * 0.025, pw, ph * 0.025);
    const ink = '#1B1D20', main = ph - band;
    const side = (o.prev || o.next) ? pw * 0.22 : 0;
    // 线路编号
    let bx = side + ph * 0.1; const bh = main * 0.36;
    const bw = (o.badges || []).reduce((s, b) => s + bh * 0.95 + main * 0.06, 0);
    // 中文站名 + 英文
    c.fillStyle = ink; c.textBaseline = 'alphabetic';
    const avail = pw - side * 2 - bw - ph * 0.3;
    const zs = fitText(c, o.zh, 700, main * 0.5, FONT, avail); const zw = c.measureText(o.zh).width;
    fitText(c, o.en || '', 500, main * 0.17, FONT_EN, avail); const ew = c.measureText(o.en || '').width;
    const blockW = Math.max(zw, ew), x0 = (pw - blockW) / 2 + bw / 2;
    bx = x0 - bw - main * 0.04;
    for (const b of o.badges || []) { drawBadge(c, bx, main * 0.17, bh, b, 0.95); bx += bh * 0.95 + main * 0.06; }
    c.fillStyle = ink; c.font = `700 ${zs}px ${FONT}`; c.textBaseline = 'middle'; c.fillText(o.zh, x0 + (blockW - zw) / 2, main * 0.4);
    c.font = `500 ${main * 0.17 * Math.min(1, avail / Math.max(1, ew))}px ${FONT_EN}`; c.fillStyle = '#3A3F45'; c.fillText(o.en || '', x0 + (blockW - ew) / 2, main * 0.83); c.textBaseline = 'alphabetic'; // 中英分开放（以前中文基线太低，拼音压在字上）
    // 前后站
    const small = (txt, en, x, alignR) => {
      c.fillStyle = '#4A5058'; c.textAlign = alignR ? 'right' : 'left';
      fitText(c, txt, 600, main * 0.2, FONT, side - main * 0.4); c.fillText(txt, x, main * 0.5);
      fitText(c, en, 500, main * 0.1, FONT_EN, side - main * 0.4); c.fillText(en, x, main * 0.7); c.textAlign = 'left';
    };
    if (o.prev) { drawArrow(c, main * 0.08, main * 0.3, main * 0.3, 'left', '#4A5058'); small(o.prev.zh, o.prev.en, main * 0.46, false); }
    if (o.next) { drawArrow(c, pw - main * 0.38, main * 0.3, main * 0.3, 'right', '#4A5058'); small(o.next.zh, o.next.en, pw - main * 0.46, true); }
    if (o.prev || o.next) { c.fillStyle = '#D5D9DE'; c.fillRect(side, main * 0.12, 2, main * 0.76); c.fillRect(pw - side, main * 0.12, 2, main * 0.76); }
  },
  /** 站口门楣：深灰底，“地铁”标 + 线路编号 + 白色站名 + 出入口字母 */
  entrance(c, pw, ph, o) {
    c.fillStyle = SIGN.bg; c.fillRect(0, 0, pw, ph);
    const pad = ph * 0.16, bh = ph * 0.5, by = (ph - bh) / 2;
    // 地铁标（通用图形：红色圆角方块 + 白色“地铁”）
    c.fillStyle = '#D52B1E'; roundRect(c, pad, by - bh * 0.1, bh * 1.2, bh * 1.2, bh * 0.25); c.fill();
    c.fillStyle = '#fff'; c.font = `700 ${bh * 0.42}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('地铁', pad + bh * 0.6, by + bh * 0.33); c.font = `700 ${bh * 0.26}px ${FONT_EN}`; c.fillText('METRO', pad + bh * 0.6, by + bh * 0.78); c.textAlign = 'left';
    let x = pad * 2 + bh * 1.2;
    for (const b of o.badges || []) { x += drawBadge(c, x, by, bh, b) + pad * 0.45; }
    const ex = o.exits && o.exits[0], tail = ex ? bh * 1.1 + pad * 2 : 0;
    textBlock(c, x + pad * 0.4, ph, pw - x - pad - tail, o.zh, o.en, '#FFFFFF', { zhK: 0.44, enK: 0.19 });
    if (ex) { drawBadge(c, pw - pad - bh * 1.1, by - bh * 0.05, bh * 1.1, { t: ex, bg: SIGN.exit, fg: SIGN.exitInk }); }
  },
  /** 广告灯箱 */
  poster(c, pw, ph, o) {
    const g = c.createLinearGradient(0, 0, pw, ph); g.addColorStop(0, o.c1); g.addColorStop(1, o.c2); c.fillStyle = g; c.fillRect(0, 0, pw, ph);
    c.globalAlpha = 0.25; c.fillStyle = '#fff';
    for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(pw * (0.15 + 0.17 * k), ph * (0.75 - 0.1 * (k % 3)), ph * (0.12 + 0.05 * (k % 2)), 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1; c.fillStyle = o.fg || '#fff'; c.textBaseline = 'alphabetic';
    fitText(c, o.zh, 700, ph * 0.2, FONT, pw * 0.84); c.fillText(o.zh, pw * 0.08, ph * 0.34);
    fitText(c, o.en || '', 500, ph * 0.09, FONT_EN, pw * 0.84); c.fillText(o.en || '', pw * 0.08, ph * 0.48);
  },
  /** 通用：bg/fg，可选居中 */
  plain(c, pw, ph, o) {
    c.fillStyle = o.bg || SIGN.bg; c.fillRect(0, 0, pw, ph);
    if (o.stripe) { c.fillStyle = o.stripe; c.fillRect(0, ph * 0.9, pw, ph * 0.1); }
    if (o.vert) { // 竖排中文
      const ch = [...(o.zh || '')], cs = Math.min(pw * 0.72, ph * 0.9 / ch.length); c.fillStyle = o.fg || '#fff'; c.font = `700 ${cs}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      ch.forEach((t, i) => c.fillText(t, pw / 2, ph / 2 + (i - (ch.length - 1) / 2) * cs * 1.08)); c.textAlign = 'left'; return;
    }
    const pad = ph * 0.18; let x = pad; const bh = ph * 0.6;
    for (const b of o.badges || []) { x += drawBadge(c, x, (ph - bh) / 2, bh, b) + pad * 0.5; }
    textBlock(c, x, ph, pw - x - pad, o.zh, o.en, o.fg || '#fff', { align: o.align || 'left' });
  }
};
export function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
