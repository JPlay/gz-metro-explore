import * as THREE from 'three';
import { box, cyl, ball, column, mat, coneGeo, roundedBoxGeo, PALETTE as P, glowMaterial, torusGeo } from './blocks.js';

// 场景道具：黄色 1 号线列车、树、牌坊、洋楼屋顶、红墙、屏蔽门、终点标记……全部是柔和几何块。

/** 黄色 1 号线列车（沿 +x 行驶）。返回 {group, doors[], length, setDoors(k)} */
export function makeTrain(cars = 2) {
  const g = new THREE.Group(); g.name = 'train';
  const carLen = 2.9, gap = 0.12, doors = [];
  for (let c = 0; c < cars; c++) {
    const cx = -c * (carLen + gap);
    const car = new THREE.Group(); car.position.x = cx; g.add(car);
    box(car, 0, 0.62, 0, carLen, 1.0, 0.92, P.yellow, { r: 0.18 });               // 车身
    box(car, 0, 1.17, 0, carLen - 0.25, 0.12, 0.78, P.cream, { r: 0.05 });          // 车顶
    box(car, 0, 0.36, 0.005, carLen - 0.1, 0.09, 0.935, P.red, { r: 0.04, cast: false }); // 红色腰线
    // 车窗带（朝相机的 +z 面和背面）
    for (const side of [1, -1]) {
      for (let i = 0; i < 3; i++) box(car, -0.95 + i * 0.95, 0.78, side * 0.462, 0.5, 0.3, 0.02, P.window, { r: 0.01, cast: false });
    }
    // 车门：每节两扇（局部 x = ±0.48）
    for (const dx of [-0.48, 0.48]) {
      for (const side of [1, -1]) {
        const L = box(car, dx - 0.11, 0.66, side * 0.468, 0.2, 0.74, 0.02, P.yellowDeep, { r: 0.01, cast: false });
        const R = box(car, dx + 0.11, 0.66, side * 0.468, 0.2, 0.74, 0.02, P.yellowDeep, { r: 0.01, cast: false });
        doors.push({ L, R, x0: dx, carX: cx, side });
      }
    }
    // 转向架
    for (const bx of [-0.95, 0.95]) box(car, bx, 0.1, 0, 0.7, 0.18, 0.7, P.ink, { r: 0.06, cast: false });
    if (c === 0) { // 车头
      box(car, carLen / 2 + 0.12, 0.6, 0, 0.3, 0.9, 0.86, P.yellow, { r: 0.2 });
      box(car, carLen / 2 + 0.25, 0.82, 0, 0.06, 0.3, 0.6, P.window, { r: 0.03, cast: false });
      ball(car, carLen / 2 + 0.26, 0.4, 0.28, 0.06, P.ivory, { emissive: 0xffffcc, ei: 0.8, cast: false });
      ball(car, carLen / 2 + 0.26, 0.4, -0.28, 0.06, P.ivory, { emissive: 0xffffcc, ei: 0.8, cast: false });
    }
    if (c === cars - 1) box(car, -carLen / 2 - 0.12, 0.6, 0, 0.3, 0.9, 0.86, P.yellow, { r: 0.2 });
  }
  const length = cars * carLen + (cars - 1) * gap;
  function setDoors(k) { for (const d of doors) { d.L.position.x = d.x0 - 0.11 - k * 0.2; d.R.position.x = d.x0 + 0.11 + k * 0.2; } }
  /** 第 i 扇门（朝 +z 一侧）的局部 x（相对列车原点） */
  function doorX(i) { const d = doors.filter(d => d.side === 1)[i]; return d.carX + d.x0; }
  return { group: g, doors, length, setDoors, doorX };
}

/** 轨道：沿 x 从 x0 到 x1，位于 (z, y) */
export function makeTrack(parent, x0, x1, y, z, opts = {}) {
  const g = new THREE.Group();
  const len = x1 - x0;
  box(g, (x0 + x1) / 2, y - 0.08, z, len, 0.16, 1.1, opts.bed ?? P.warmGrey, { r: 0.05, cast: false });
  for (const dz of [-0.3, 0.3]) box(g, (x0 + x1) / 2, y + 0.02, z + dz, len, 0.05, 0.06, 0xb8bcc6, { r: 0.02, cast: false });
  if (opts.pillars) for (let x = Math.ceil(x0); x <= x1; x += opts.pillars) column(g, x, z, opts.ground ?? -0.5, y - 0.16, opts.pillarColor ?? P.stone, { w: 0.45, d: 0.6, r: 0.1 });
  parent.add(g); return g;
}

/** 圆润的树（公园前的城市公园） */
export function tree(parent, x, y, z, s = 1, color = P.green) {
  cyl(parent, x, y + 0.3 * s, z, 0.07 * s, 0.1 * s, 0.6 * s, 0xb08a6a);
  ball(parent, x, y + 0.85 * s, z, 0.42 * s, color);
  ball(parent, x + 0.18 * s, y + 1.12 * s, z - 0.1 * s, 0.28 * s, color);
}
/** 木棉树：广州市花，红色花团 */
export function kapok(parent, x, y, z, s = 1) {
  cyl(parent, x, y + 0.45 * s, z, 0.06 * s, 0.11 * s, 0.9 * s, 0xa88468);
  for (const [dx, dy, dz, r] of [[0, 1.0, 0, .3], [.25, .85, .1, .2], [-.22, .9, -.08, .22], [.05, 1.22, .05, .18]]) ball(parent, x + dx * s, y + dy * s, z + dz * s, r * s, P.kapok);
}
/** 纪念牌坊（烈士陵园）：两柱一梁，柱距沿 z */
export function arch(parent, x, y, z, span = 2, h = 2.2, color = P.stone) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  for (const s of [-1, 1]) { box(g, 0, h / 2, s * span / 2, 0.45, h, 0.45, color, { r: 0.1 }); box(g, 0, 0.12, s * span / 2, 0.6, 0.24, 0.6, P.warmGrey, { r: 0.06 }); }
  box(g, 0, h + 0.15, 0, 0.55, 0.3, span + 0.9, color, { r: 0.1 });
  box(g, 0, h + 0.42, 0, 0.4, 0.22, span + 0.5, P.red, { r: 0.08 });
  ball(g, 0, h + 0.68, 0, 0.16, P.gold);
  parent.add(g); return g;
}
/** 坡屋顶（东山口洋楼）：沿 x 的双坡顶 */
export function gableRoof(parent, x, y, z, w, d, color = P.roofTerracotta) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const m = new THREE.Mesh(roofGeo(w, d, 0.6), mat(color)); m.castShadow = true; m.receiveShadow = true; g.add(m);
  parent.add(g); return g;
}
const roofCache = new Map();
function roofGeo(w, d, h) {
  const key = w + ':' + d + ':' + h; if (roofCache.has(key)) return roofCache.get(key);
  const s = new THREE.Shape(); s.moveTo(-d / 2 - 0.08, 0); s.lineTo(d / 2 + 0.08, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 });
  g.translate(0, 0, -w / 2); g.rotateY(Math.PI / 2); g.computeVertexNormals(); roofCache.set(key, g); return g;
}
/** 洋楼：带拱窗的方块房子 + 坡屋顶 */
export function villa(parent, x, z, yBase, floors, w = 1, d = 1, wall = P.cream, roof = P.roofTerracotta, opts = {}) {
  const top = yBase + floors;
  column(parent, x, z, yBase, top, wall, { w, d, r: 0.06 });
  for (let f = 0; f < floors; f++) {
    const wy = yBase + f + 0.55;
    box(parent, x, wy, z + d / 2 + 0.005, w * 0.32, 0.42, 0.02, P.window, { r: 0.01, cast: false });   // +z 面窗
    box(parent, x + w / 2 + 0.005, wy, z, 0.02, 0.42, d * 0.32, P.window, { r: 0.01, cast: false });   // +x 面窗
    ball(parent, x, wy + 0.21, z + d / 2 + 0.01, w * 0.16, P.window, { cast: false, ws: 10, hs: 6 });
  }
  box(parent, x, top + 0.04, z, w + 0.1, 0.08, d + 0.1, opts.trim ?? P.ivory, { r: 0.03 });
  if (!opts.flat) gableRoof(parent, x, top + 0.08, z, w, d, roof);
}
/** 红墙段（农讲所：番禺学宫的红墙与黄绿琉璃瓦意象） */
export function redWall(parent, x0, x1, z0, z1, yBase, h, color = P.red) {
  const w = Math.abs(x1 - x0) || 0.3, d = Math.abs(z1 - z0) || 0.3;
  box(parent, (x0 + x1) / 2, yBase + h / 2, (z0 + z1) / 2, w, h, d, color, { r: 0.06 });
  box(parent, (x0 + x1) / 2, yBase + h + 0.08, (z0 + z1) / 2, w + 0.16, 0.16, d + 0.16, P.roofGreen, { r: 0.06 });
}
/** 小亭/殿：红柱 + 黄绿屋顶 */
export function pavilion(parent, x, y, z, w = 2, d = 1.6, h = 1.2) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  box(g, 0, 0.1, 0, w + 0.2, 0.2, d + 0.2, P.stone, { r: 0.06 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, sx * (w / 2 - 0.15), 0.2 + h / 2, sz * (d / 2 - 0.15), 0.08, 0.08, h, P.redDeep, { seg: 10 });
  box(g, 0, 0.2 + h * 0.55, -d / 2 + 0.15, w - 0.3, h * 0.9, 0.08, P.red, { r: 0.03 });
  const roof = new THREE.Mesh(coneGeo(Math.max(w, d) * 0.85, 0.7, 4), mat(P.roofGreen));
  roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); roof.position.y = 0.2 + h + 0.35; roof.castShadow = true; g.add(roof);
  box(g, 0, 0.2 + h + 0.05, 0, w + 0.3, 0.1, d + 0.3, P.roofGreen, { r: 0.04 });
  ball(g, 0, 0.2 + h + 0.75, 0, 0.1, P.gold);
  parent.add(g); return g;
}
/** 屏蔽门（站台门），沿 x 方向，位于站台与轨道之间。返回 {group, open(k)} */
export function screenDoor(parent, x, y, z, width = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const glass = mat(P.glass, { opacity: 0.55 });
  box(g, 0, 1.12, 0, width + 0.3, 0.14, 0.12, P.ivory, { r: 0.04 });
  for (const s of [-1, 1]) box(g, s * (width / 2 + 0.08), 0.56, 0, 0.12, 1.12, 0.12, P.ivory, { r: 0.04 });
  const L = box(g, -width / 4, 0.52, 0, width / 2 - 0.02, 1.0, 0.04, P.glass, { material: glass, cast: false });
  const R = box(g, width / 4, 0.52, 0, width / 2 - 0.02, 1.0, 0.04, P.glass, { material: glass, cast: false });
  const lamp = ball(g, 0, 1.22, 0.02, 0.06, P.yellow, { emissive: 0xffd040, ei: 0.2, unique: true, cast: false });
  parent.add(g);
  return { group: g, lamp, open(k) { L.position.x = -width / 4 - k * width * 0.45; R.position.x = width / 4 + k * width * 0.45; } };
}
/** 终点（站台门前）发光标记：脚下光圈 + 悬浮的黄色小箭头 */
export function goalMarker(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const ring = new THREE.Mesh(torusGeo(0.36, 0.05), glowMaterial(0xffe070)); ring.position.y = 0.04; g.add(ring);
  const arrow = new THREE.Mesh(coneGeo(0.16, 0.3, 4), mat(P.yellow, { emissive: 0xffd040, ei: 0.5 }));
  arrow.rotation.x = Math.PI; arrow.position.y = 1.5; g.add(arrow);
  parent.add(g);
  return { group: g, update(t) { ring.material.userData.pulse(t); arrow.position.y = 1.45 + Math.sin(t * 2.4) * 0.12; arrow.rotation.y = t * 0.8; } };
}
/** 彭罗斯三角雕塑：三根梁的端点相差 (L,L,L)，在等轴测下看起来首尾相接 */
export function penroseTriangle(parent, x, y, z, L = 2.4, t = 0.42, colors = [P.pink, P.mint, P.lilac]) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  box(g, L / 2, 0, 0, L + t, t, t, colors[0], { r: 0.06 });          // 沿 +x
  box(g, L, L / 2, 0, t, L + t, t, colors[1], { r: 0.06 });          // 沿 +y
  box(g, L, L, L / 2 + t / 2, t, t, L, colors[2], { r: 0.06 });      // 沿 +z，末端 (L,L,L) 与起点 (0,0,0) 在投影中重合
  parent.add(g); return g;
}
/** 路灯 */
export function lamp(parent, x, y, z) {
  cyl(parent, x, y + 0.5, z, 0.04, 0.05, 1.0, P.ink, { seg: 8 });
  ball(parent, x, y + 1.05, z, 0.12, P.ivory, { emissive: 0xfff2c0, ei: 0.6 });
}
/** 站名牌：主题色圆点 + 白底（不需要识字：靠颜色与地标图形识别） */
export function stationSign(parent, x, y, z, color) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  cyl(g, 0, 0.55, 0, 0.04, 0.04, 1.1, P.ink, { seg: 8 });
  box(g, 0, 1.2, 0, 0.9, 0.36, 0.08, P.white, { r: 0.05 });
  cyl(g, -0.28, 1.2, 0.05, 0.12, 0.12, 0.04, color, { seg: 16 }).rotation.x = Math.PI / 2;
  box(g, 0.1, 1.2, 0.05, 0.4, 0.08, 0.02, P.yellow, { r: 0.02, cast: false });
  parent.add(g); return g;
}
