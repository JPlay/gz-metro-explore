import * as THREE from 'three';

// 柔和几何块：圆角立方体、圆柱、球。几何体与材质全部缓存复用，保持低面数、少材质。
export const PALETTE = {
  cream: 0xfff4de, ivory: 0xfffaf0, sand: 0xf3e3c6, stone: 0xe8e0cf, warmGrey: 0xd9d2c5,
  yellow: 0xf7d44c, yellowDeep: 0xe9b93a, red: 0xe07a6e, redDeep: 0xc8564b, brick: 0xd98b6c,
  pink: 0xf4b6b0, peach: 0xf8cfa8, mint: 0xa9dcc4, green: 0x9fd09a, greenDeep: 0x6fb487,
  sky: 0xa9d2ec, blue: 0x7fb0e0, lilac: 0xc9b8e8, teal: 0x8fcfc9, roofGreen: 0xb9c97a,
  roofTerracotta: 0xe0a080, slate: 0x9fb6a8, window: 0x7d95b8, glass: 0xcfe8f5, white: 0xffffff,
  ink: 0x5a6578, gold: 0xf2c45a, kapok: 0xf08a7c
};

const geoCache = new Map();
const matCache = new Map();

/** 圆角盒子：挤出圆角矩形 + 倒角，得到四周都圆润的方块。尺寸为外包围盒。 */
export function roundedBoxGeo(w, h, d, r = 0.08) {
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const key = `rb:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}:${r.toFixed(3)}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const iw = w - 2 * r, id = d - 2 * r, cr = Math.min(0.05, iw / 2, id / 2);
  const s = new THREE.Shape();
  const x0 = -iw / 2, y0 = -id / 2;
  s.moveTo(x0 + cr, y0);
  s.lineTo(x0 + iw - cr, y0); s.quadraticCurveTo(x0 + iw, y0, x0 + iw, y0 + cr);
  s.lineTo(x0 + iw, y0 + id - cr); s.quadraticCurveTo(x0 + iw, y0 + id, x0 + iw - cr, y0 + id);
  s.lineTo(x0 + cr, y0 + id); s.quadraticCurveTo(x0, y0 + id, x0, y0 + id - cr);
  s.lineTo(x0, y0 + cr); s.quadraticCurveTo(x0, y0, x0 + cr, y0);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, h - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 2 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -(h - 2 * r) / 2, 0);
  g.computeVertexNormals();
  g.computeBoundingBox(); g.computeBoundingSphere();
  geoCache.set(key, g);
  return g;
}
export function cylGeo(rt, rb, h, seg = 16) {
  const key = `cy:${rt}:${rb}:${h}:${seg}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.CylinderGeometry(rt, rb, h, seg));
  return geoCache.get(key);
}
export function sphereGeo(r, ws = 16, hs = 12) {
  const key = `sp:${r}:${ws}:${hs}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.SphereGeometry(r, ws, hs));
  return geoCache.get(key);
}
export function coneGeo(r, h, seg = 4) {
  const key = `co:${r}:${h}:${seg}`;
  if (!geoCache.has(key)) { const g = new THREE.ConeGeometry(r, h, seg); if (seg === 4) g.rotateY(Math.PI / 4); geoCache.set(key, g); }
  return geoCache.get(key);
}
export function torusGeo(r, t) {
  const key = `to:${r}:${t}`;
  if (!geoCache.has(key)) { const g = new THREE.TorusGeometry(r, t, 8, 32); g.rotateX(Math.PI / 2); geoCache.set(key, g); }
  return geoCache.get(key);
}

/** Lambert 材质（便宜，粉彩感好）。opts.emissive 用于发光提示，opts.opacity 用于玻璃 */
export function mat(color, opts = {}) {
  const key = `${color}:${opts.emissive || 0}:${opts.opacity || 1}:${opts.ei || 0}`;
  if (!opts.unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshLambertMaterial({ color });
  if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.ei ?? 0.4; }
  if (opts.opacity != null && opts.opacity < 1) { m.transparent = true; m.opacity = opts.opacity; m.depthWrite = false; }
  if (!opts.unique) matCache.set(key, m);
  return m;
}

/** 放一个圆角方块。(x,y,z) 为中心。 */
export function box(parent, x, y, z, w, h, d, color, opts = {}) {
  const m = new THREE.Mesh(roundedBoxGeo(w, h, d, opts.r ?? 0.08), opts.material || mat(color, opts));
  m.position.set(x, y, z);
  m.castShadow = opts.cast !== false; m.receiveShadow = opts.receive !== false;
  if (opts.name) m.name = opts.name;
  parent.add(m);
  return m;
}
/** 从 yBottom 到 yTop 的柱体（格子中心 x,z） */
export function column(parent, x, z, yBottom, yTop, color, opts = {}) {
  const h = yTop - yBottom;
  return box(parent, x, yBottom + h / 2, z, opts.w ?? 1, h, opts.d ?? 1, color, opts);
}
export function cyl(parent, x, y, z, rt, rb, h, color, opts = {}) {
  const m = new THREE.Mesh(cylGeo(rt, rb, h, opts.seg ?? 16), opts.material || mat(color, opts));
  m.position.set(x, y, z); m.castShadow = opts.cast !== false; m.receiveShadow = true; parent.add(m); return m;
}
export function ball(parent, x, y, z, r, color, opts = {}) {
  const m = new THREE.Mesh(sphereGeo(r, opts.ws ?? 14, opts.hs ?? 10), opts.material || mat(color, opts));
  m.position.set(x, y, z); m.castShadow = opts.cast !== false; m.receiveShadow = true; parent.add(m); return m;
}

/** 台阶：在格子 (x,z) 从 yLow 升到 yLow+1，朝 dir 方向上升。返回 group（四级小台阶 + 底座） */
export function stairMesh(parent, x, yLow, z, dir, color, sideColor) {
  const g = new THREE.Group();
  g.position.set(x, yLow, z);
  g.rotation.y = Math.atan2(-dir.z, dir.x); // 让局部 +x 指向上升方向
  const n = 4;
  for (let i = 0; i < n; i++) {
    const top = (i + 1) / n;
    const m = new THREE.Mesh(roundedBoxGeo(1 / n, top + 0.25, 1, 0.04), mat(i % 2 ? color : sideColor ?? color));
    m.position.set(-0.5 + (i + 0.5) / n, top - (top + 0.25) / 2, 0);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  parent.add(g);
  return g;
}

/** 软阴影贴片：给角色用的便宜“影子” */
let blobTex = null;
export function blobShadow(radius = 0.32) {
  if (!blobTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(40,40,70,0.38)'); gr.addColorStop(1, 'rgba(40,40,70,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.renderOrder = 1;
  return m;
}

/** 发光脉冲材质（提示用），每帧调用 pulse(t) */
export function glowMaterial(color = 0xffe58a) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false });
  m.userData.pulse = t => { m.opacity = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3)); };
  return m;
}
