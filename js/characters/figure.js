import * as THREE from 'three';
import { blobShadow, PALETTE as P } from '../world/blocks.js';

// 圆润的方块小人：胶囊身体 + 球形脑袋 + 帽子/头发，没有颗粒、没有关节——只是柔和几何。
const capsule = new THREE.CapsuleGeometry(0.17, 0.24, 4, 12);
const head = new THREE.SphereGeometry(0.15, 16, 12);
const cap = new THREE.SphereGeometry(0.155, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const brim = new THREE.CylinderGeometry(0.17, 0.17, 0.025, 16);
const eye = new THREE.SphereGeometry(0.022, 8, 6);
const bag = new THREE.BoxGeometry(0.16, 0.18, 0.08);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x3d4a5c });

export function makeFigure({ body = P.sky, hat = P.yellow, skin = 0xffe0c8, bagColor = null, scale = 1 } = {}) {
  const root = new THREE.Group();
  const inner = new THREE.Group(); root.add(inner);
  const mats = [];
  const M = c => { const m = new THREE.MeshLambertMaterial({ color: c }); mats.push(m); return m; };
  const b = new THREE.Mesh(capsule, M(body)); b.position.y = 0.29; b.castShadow = true; inner.add(b);
  const h = new THREE.Mesh(head, M(skin)); h.position.y = 0.66; h.castShadow = true; inner.add(h);
  const c = new THREE.Mesh(cap, M(hat)); c.position.y = 0.675; inner.add(c);
  if (hat !== null) { const br = new THREE.Mesh(brim, M(hat)); br.position.set(0, 0.68, 0.06); br.scale.set(1, 1, 0.9); inner.add(br); }
  for (const s of [-1, 1]) { const e = new THREE.Mesh(eye, eyeMat); e.position.set(s * 0.055, 0.65, 0.135); inner.add(e); }
  if (bagColor) { const g = new THREE.Mesh(bag, M(bagColor)); g.position.set(0, 0.32, -0.18); inner.add(g); }
  const shadow = blobShadow(0.28); root.add(shadow);
  root.scale.setScalar(scale);
  root.userData.figure = true;
  return {
    root, inner, mats, shadow,
    /** 跨越视错觉连接的瞬间临时置顶绘制，避免被前景方块“吃掉” */
    setOnTop(v) { for (const m of mats) { m.depthTest = !v; } eyeMat.depthTest = true; inner.traverse(o => { o.renderOrder = v ? 10 : 0; }); },
    setOpacity(a) { for (const m of mats) { m.transparent = a < 1; m.opacity = a; } shadow.material.opacity = a; }
  };
}
