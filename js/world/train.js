/*
 * 地铁列车：3 节编组（每节 18m，每侧 3 对门），车头圆润，内部有长条座椅、扶手杆、灯带、门上方线路图。
 * 局部坐标：x 沿车长，y=0 为车厢地板顶面（与站台面齐平），z 横向（±1.5）。
 * 车体静态几何合成 5 个网格；车门是同一网格的实例；碰撞体随车移动。
 */
import { Kit, FONT, roundRect } from './kit.js';
import { Geo, hex } from '../core/geo.js';
import { colorMat } from '../core/mats.js';
import { person, reseed } from './decor.js';
import { LINES, STATIONS } from '../data/lines.js';
const B = window.BABYLON;

export const CAR_X = [-18.6, 0, 18.6], DOOR_DX = [-6, 0, 6], HALF = 27.9, DOOR_W = 1.4, DOOR_H = 2.0;
export const DOOR_XS = CAR_X.flatMap(c => DOOR_DX.map(d => c + d));
const WHITE = hex('#F4F6F8'), GREY = hex('#59606B'), DARK = hex('#2F343B'), FLOOR = hex('#B7C0CB'), ROOF = hex('#DDE3EA'), METAL = hex('#C9D1DA');

export class Train {
  constructor(scene, id) {
    this.scene = scene; this.id = id;
    this.kit = new Kit(scene, 'train' + id);
    this.root = this.kit.root;
    this.lineMat = colorMat(scene, '#F3D03E', { emissive: 0.15 }).clone('trainLine' + id);
    this.line = 1; this.open = { 1: 0, '-1': 0 }; this.s = 0; this.pos = new B.Vector3(); this.prev = new B.Vector3();
    this.build();
  }
  build() {
    const k = this.kit, g = k.solid, gl = k.glow, gs = k.glass, ln = new Geo();
    reseed(this.id * 31 + 5);
    for (const cx of CAR_X) {
      const x0 = cx - 9, x1 = cx + 9;
      g.slab(x0, x1, -0.2, 0, -1.43, 1.43, FLOOR);
      g.slab(x0 + 0.2, x1 - 0.2, -1.05, -0.2, -1.36, 1.36, GREY);
      for (const bx of [cx - 6.3, cx + 6.3]) { g.slab(bx - 1.3, bx + 1.3, -1.25, -0.6, -1.2, 1.2, DARK); for (const wx of [-0.8, 0.8]) for (const wz of [-0.75, 0.75]) g.cyl(bx + wx, -1.15, wz * 1.0, 0.75, 0.16, hex('#3A3F46'), 10, 0, Math.PI / 2, 0); }
      for (const sg of [-1, 1]) {
        const zw = sg * 1.47, segs = [[x0, cx - 6.7], [cx - 5.3, cx - 0.7], [cx + 0.7, cx + 5.3], [cx + 6.7, x1]];
        for (const [a, b] of segs) {
          g.slab(a, b, 0, 0.95, zw - 0.04, zw + 0.04, WHITE);
          g.slab(a, b, 1.95, 2.45, zw - 0.04, zw + 0.04, WHITE);
          g.slab(a, a + 0.22, 0.95, 1.95, zw - 0.04, zw + 0.04, WHITE); g.slab(b - 0.22, b, 0.95, 1.95, zw - 0.04, zw + 0.04, WHITE);
          if (b - a > 3) g.slab((a + b) / 2 - 0.1, (a + b) / 2 + 0.1, 0.95, 1.95, zw - 0.04, zw + 0.04, WHITE);
          gs.slab(a + 0.22, b - 0.22, 0.95, 1.95, zw - 0.015, zw + 0.015, hex('#7FA7C4'));
          ln.slab(a, b, 0.55, 0.8, zw + sg * 0.05, zw + sg * 0.07, [1, 1, 1]);   // 外侧色带
          k.col((a + b) / 2, 1.22, zw, b - a, 2.45, 0.1, { parent: this.root, dynamic: true });
          // 座椅（门之间）
          const sa = a + (a === x0 ? 0.5 : 0.25), sb = b - (b === x1 ? 0.5 : 0.25);
          ln.slab(sa, sb, 0.3, 0.46, sg * 0.98, sg * 1.42, [1, 1, 1]);
          ln.slab(sa, sb, 0.46, 0.95, sg * 1.3, sg * 1.42, [0.92, 0.92, 0.92]);
          g.slab(sa, sb, 0, 0.3, sg * 1.05, sg * 1.42, hex('#8E99A6'));
          k.col((sa + sb) / 2, 0.25, sg * 1.2, sb - sa, 0.5, 0.5, { parent: this.root, dynamic: true });
          g.box((sa + sb) / 2, 1.9, sg * 0.98, sb - sa, 0.05, 0.05, METAL);
        }
        for (const dx of DOOR_DX) g.slab(cx + dx - 0.7, cx + dx + 0.7, 2.0, 2.45, zw - 0.04, zw + 0.04, WHITE);
        // 车厢内门上方的线路图条（贴图）
      }
      for (const dx of DOOR_DX) { g.cyl(cx + dx, 1.2, 0, 0.06, 2.4, METAL, 6); }
      g.slab(x0, x1, 2.45, 2.62, -1.5, 1.5, ROOF); g.slab(x0 + 0.3, x1 - 0.3, 2.62, 2.78, -1.2, 1.2, ROOF);
      g.slab(cx - 2.5, cx + 2.5, 2.78, 3.05, -0.8, 0.8, hex('#B8C1CB'));
      gl.slab(x0 + 0.5, x1 - 0.5, 2.38, 2.44, -0.22, 0.22, hex('#FFFBEA'));
      ln.slab(x0, x1, 2.45, 2.5, -1.53, -1.51, [1, 1, 1]); ln.slab(x0, x1, 2.45, 2.5, 1.51, 1.53, [1, 1, 1]);
      // 车厢连接处
      if (cx < 18) {
        for (const zz of [-1, 1]) { g.slab(x1, x1 + 0.6, 0, 2.25, zz * 0.8 - 0.05, zz * 0.8 + 0.05, DARK); k.col(x1 + 0.3, 1.1, zz * 0.85, 0.7, 2.2, 0.1, { parent: this.root, dynamic: true }); }
        g.slab(x1, x1 + 0.6, 2.2, 2.3, -0.85, 0.85, DARK); g.slab(x1, x1 + 0.6, -0.2, 0, -0.85, 0.85, FLOOR);
        for (const ex of [x1 - 0.05, x1 + 0.65]) for (const zz of [-1, 1]) { g.slab(ex - 0.05, ex + 0.05, 0, 2.45, zz * 0.8, zz * 1.47, WHITE); k.col(ex, 1.22, zz * 1.13, 0.12, 2.45, 0.66, { parent: this.root, dynamic: true }); }
        g.slab(x1 - 0.1, x1 + 0.7, 2.05, 2.45, -0.8, 0.8, WHITE);
      }
      // 坐着的乘客
      for (let p = 0; p < 2; p++) { const sg = p ? 1 : -1, px = cx + (p ? 3 : -3.2); person(g, px, 0, sg * 1.08, sg > 0 ? Math.PI : 0, 'sit'); }
    }
    // 车头（两端）
    for (const e of [-1, 1]) {
      const xe = e * HALF;
      g.slab(xe - e * 0.05, xe + e * 0.05, 0, 2.45, -1.47, 1.47, WHITE);
      g.slab(Math.min(xe, xe + e * 1.1), Math.max(xe, xe + e * 1.1), -0.9, 0.9, -1.45, 1.45, WHITE);
      g.slab(Math.min(xe, xe + e * 0.9), Math.max(xe, xe + e * 0.9), 0.9, 2.45, -1.45, 1.45, WHITE);
      g.box(xe + e * 0.95, 1.65, 0, 0.12, 1.2, 2.5, hex('#22303C'), 0, 0, e * -0.25);
      gl.box(xe + e * 1.12, 0.35, -0.95, 0.06, 0.22, 0.4, hex('#FFF7D6')); gl.box(xe + e * 1.12, 0.35, 0.95, 0.06, 0.22, 0.4, hex('#FFF7D6'));
      ln.slab(Math.min(xe, xe + e * 1.12), Math.max(xe, xe + e * 1.12), 0.55, 0.8, -1.5, 1.5, [1, 1, 1]);
      g.slab(Math.min(xe, xe + e * 1.0), Math.max(xe, xe + e * 1.0), 2.45, 2.7, -1.45, 1.45, ROOF);
      k.col(xe, 1.2, 0, 0.2, 2.6, 3.0, { parent: this.root, dynamic: true });
    }
    k.col(0, -0.15, 0, HALF * 2, 0.3, 2.9, { parent: this.root, dynamic: true, name: 'trainFloor' });
    k.col(0, 2.6, 0, HALF * 2, 0.3, 3.0, { parent: this.root, dynamic: true });
    const meshes = k.finish(false);
    meshes.forEach(m => { m.alwaysSelectAsActiveMesh = false; });
    this.body = meshes[0];
    const lm = ln.toMesh('trainLine', this.scene, this.lineMat, this.root); lm.receiveShadows = true;
    // 门扇（实例）
    const leafG = new Geo();
    leafG.box(0, DOOR_H / 2, 0, DOOR_W / 2, DOOR_H, 0.05, WHITE);
    leafG.box(0, 1.35, 0, DOOR_W / 2 - 0.2, 0.9, 0.06, hex('#6E8FA8'));
    leafG.box(0, 0.68, 0, DOOR_W / 2, 0.25, 0.07, hex('#F3D03E'));
    this.leafSrc = leafG.toMesh('leaf', this.scene, this.kit.M.solid, this.root); this.leafSrc.isVisible = false;
    this.leaves = { 1: [], '-1': [] }; this.doorCols = { 1: [], '-1': [] };
    for (const sg of [-1, 1]) for (const dx of DOOR_XS) {
      for (const lr of [-1, 1]) { const inst = this.leafSrc.createInstance('lf'); inst.parent = this.root; inst.metadata = { dx, lr, sg }; this.leaves[sg].push(inst); }
      this.doorCols[sg].push(k.col(dx, 1.0, sg * 1.47, DOOR_W, 2.0, 0.12, { parent: this.root, dynamic: true, name: 'door' }));
    }
    this.setDoors(1, 0); this.setDoors(-1, 0);
    // 线路图（门上方，车内两侧）
    this.mapTex = new B.DynamicTexture('map' + this.id, { width: 1024, height: 128 }, this.scene, true);
    this.mapMat = new B.StandardMaterial('mapMat' + this.id, this.scene);
    this.mapMat.diffuseColor = new B.Color3(0, 0, 0); this.mapMat.specularColor = new B.Color3(0, 0, 0); this.mapMat.emissiveTexture = this.mapTex; this.mapMat.disableLighting = true; this.mapMat.backFaceCulling = false;
    const mp = [], mu = [], mi = [];
    for (const sg of [-1, 1]) for (const dx of DOOR_XS) {
      const b0 = mp.length / 3, z = sg * 1.41, w = 1.3, y0 = 2.03, y1 = 2.33;
      // 文字从车内观看者左往右：面朝 -sg*z
      const xa = dx + (sg > 0 ? -w / 2 : w / 2), xb = dx - (sg > 0 ? -w / 2 : w / 2);
      mp.push(xa, y0, z, xb, y0, z, xb, y1, z, xa, y1, z); mu.push(0, 0, 1, 0, 1, 1, 0, 1); mi.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    }
    const mm = new B.Mesh('trainMap', this.scene), vd = new B.VertexData(); vd.positions = mp; vd.uvs = mu; vd.indices = mi; vd.normals = mp.map((_, i) => i % 3 === 1 ? 1 : 0); vd.applyToMesh(mm);
    mm.material = this.mapMat; mm.parent = this.root; mm.isPickable = false;
    this.shadowMeshes = [this.body, lm];
  }
  setLine(line) {
    this.line = line; const c = B.Color3.FromHexString(LINES[line].color);
    this.lineMat.diffuseColor = c; this.lineMat.emissiveColor = c.scale(0.18);
  }
  /** 线路图：当前站 code、行进方向 step（+1/-1）、isNext 表示正驶向该站 */
  setMap(line, code, step, nextCode) {
    const L = LINES[line], st = L.stations, i = st.indexOf(code), c = this.mapTex.getContext(), W = 1024, H = 128;
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H);
    c.fillStyle = L.color; c.fillRect(0, 0, 150, H); c.fillStyle = L.ink; c.font = `800 46px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(L.zh, 75, 50);
    c.font = `600 24px ${FONT}`; c.fillText(L.en, 75, 96);
    const win = 7, half = 3; let a = Math.max(0, Math.min(st.length - win, i - (step > 0 ? 2 : half + 1))); const vis = st.slice(a, a + win);
    const ordered = step > 0 ? vis : vis.slice().reverse(), x0 = 200, dx = (W - x0 - 50) / (win - 1);
    c.fillStyle = L.color; c.fillRect(x0, 54, dx * (ordered.length - 1), 16);
    ordered.forEach((code2, k) => {
      const x = x0 + k * dx, idx = st.indexOf(code2), passed = step > 0 ? idx < i : idx > i, here = code2 === code, nxt = code2 === nextCode;
      c.beginPath(); c.arc(x, 62, here || nxt ? 17 : 12, 0, Math.PI * 2); c.fillStyle = passed ? '#C8CED6' : (nxt ? '#FF5A4E' : (here ? '#26C281' : '#FFFFFF')); c.fill();
      c.lineWidth = 5; c.strokeStyle = passed ? '#C8CED6' : L.color; c.stroke();
      c.fillStyle = passed ? '#9AA3AE' : '#24324A'; c.font = `${here || nxt ? 800 : 600} ${here || nxt ? 26 : 22}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.fillText(STATIONS[code2].zh, x, 30); if (STATIONS[code2].x.length || STATIONS[code2].lines.length > 1) { c.fillStyle = '#7A8594'; c.font = `600 15px ${FONT}`; c.fillText('换乘', x, 112); }
    });
    c.fillStyle = '#24324A'; c.font = `900 40px ${FONT}`; c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText(step > 0 ? '▶' : '◀', W - 8, 62);
    this.mapTex.update(true);
  }
  /** 打开 / 关闭某一侧车门（sg=+1 局部 +z 侧），f: 0 关 … 1 开 */
  setDoors(sg, f) {
    this.open[sg] = f;
    for (const l of this.leaves[sg]) { const m = l.metadata; l.position.set(m.dx + m.lr * (DOOR_W / 4 + f * (DOOR_W / 2 - 0.02)), 0, m.sg * (1.47 + f * 0.07)); }
    const closed = f < 0.7; for (const c of this.doorCols[sg]) c.checkCollisions = closed;
  }
  setPos(x, y, z) { this.prev.copyFrom(this.root.position); this.root.position.set(x, y, z); this.pos.copyFrom(this.root.position); }
  /** 世界点 → 列车局部 */
  local(p) { return new B.Vector3(p.x - this.root.position.x, p.y - this.root.position.y, p.z - this.root.position.z); }
  contains(p) { const l = this.local(p); return Math.abs(l.x) < HALF - 0.1 && Math.abs(l.z) < 1.42 && l.y > -0.6 && l.y < 2.6; }
  inDoorway(p) { const l = this.local(p); if (Math.abs(l.z) < 1.0 || Math.abs(l.z) > 2.3 || Math.abs(l.y) > 1) return false; return DOOR_XS.some(d => Math.abs(l.x - d) < 0.95); }
  setVisible(v) { this.root.setEnabled(v); }
}
