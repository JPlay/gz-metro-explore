import * as THREE from 'three';
import { Scene } from './scene.js';
import { box, column, cyl, ball, mat, roundedBoxGeo, PALETTE as P } from '../world/blocks.js';
import { tree, kapok, arch, pavilion, villa, penroseTriangle, lamp, stationSign } from '../world/props.js';
import { StrollNpc } from '../characters/npc.js';
import { tween, wait, Ease } from '../core/tween.js';
import * as Audio from '../audio/audio.js';
import * as Ambience from '../audio/ambience.js';

/*
 * 城市枢纽：一座会“变形”的方块城市漂浮在空中，黄色 1 号线高架环线绕城一圈，
 * 四个车站小岛各带一个地标（公园树 / 红墙小殿 / 牌坊木棉 / 洋楼坡顶）。
 * 楼块会缓缓升降、旋转；中央是一座彭罗斯三角雕塑（不可能图形）。
 * 点小岛或底部的车站按钮 → 镜头飞过去，城市变形 → 进入行车。
 */
const LOOP = 4.2;          // 环线半边长
const TRACK_Y = 1.5;
export class HubScene extends Scene {
  constructor(game, stations) {
    super(game); this.kind = 'hub'; this.stations = stations;
    this.theme = { top: '#cfe8f2', bottom: '#fdf1dc', fog: 0xf7f1e4 };
    this.buildings = []; this.npcs = []; this.islands = []; this.trainS = 0; this.transformT = 0; this.picking = false;
  }
  build() {
    const R = this.root;
    // 浮岛底座 + 珠江（前方一条蓝色水带）
    box(R, 0, -0.45, 0, 17, 0.9, 17, 0xf6ead2, { r: 0.35 });
    box(R, 0, -1.1, 0, 15.6, 0.5, 15.6, 0xe7d6b8, { r: 0.3 });
    box(R, 0, -0.02, 7.3, 16.4, 0.08, 1.6, 0xa9d2ec, { r: 0.04, cast: false });
    box(R, 7.3, -0.02, 0, 1.6, 0.08, 14.6, 0xb7dbef, { r: 0.04, cast: false });
    // 城市中心：楼块网格（会变形）
    const colors = [P.peach, P.mint, P.lilac, P.sky, P.pink, P.cream, 0xf9e2a8, P.teal];
    let ci = 0;
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
      if (Math.abs(x) <= 1 && Math.abs(z) <= 1) continue; // 中央广场留给雕塑
      if ((x + z) % 3 === 0 && Math.abs(x) + Math.abs(z) > 3) continue;
      const h = 0.4 + ((x * 7 + z * 13 + 50) % 5) * 0.35;
      const m = new THREE.Mesh(roundedBoxGeo(0.86, 1, 0.86, 0.1), mat(colors[ci++ % colors.length]));
      m.castShadow = true; m.receiveShadow = true;
      m.position.set(x, h / 2, z); m.scale.y = h; R.add(m);
      this.buildings.push({ m, h, x, z });
    }
    // 几栋带坡顶的洋楼和树，增加城市感
    tree(R, 5.7, 0, 3.6, 0.8); tree(R, -3.6, 0, 5.8, 0.75, P.greenDeep); tree(R, 3.2, 0, -5.8, 0.7); tree(R, -5.8, 0, -3.4, 0.8, P.greenDeep); lamp(R, 5.6, 0, -2.6); lamp(R, -2.6, 0, 5.6);
    // 中央广场 + 彭罗斯三角
    box(R, 0, 0.08, 0, 2.6, 0.16, 2.6, P.ivory, { r: 0.1 });
    penroseTriangle(R, -0.75, 0.55, -0.75, 1.5, 0.3);
    // 高架环线（1 号线黄色）
    this.buildLoop();
    // 四个车站小岛
    const spots = [[-6.6, 0], [0, -6.6], [6.6, 0], [0, 6.6]]; // 屏幕上：左上、右上、右下、左下（顺时针）
    this.stations.forEach((st, i) => this.buildIsland(st, spots[i][0], spots[i][1], i));
    // 小行人
    this.npcs.push(new StrollNpc(R, [[-1.2, 0.16, -1.2], [1.2, 0.16, -1.2], [1.2, 0.16, 1.2], [-1.2, 0.16, 1.2]], 0.45));
    this.npcs.push(new StrollNpc(R, [[5.2, 0, 5.2], [5.2, 0, -5.2], [-5.2, 0, -5.2], [-5.2, 0, 5.2]], 0.6));
    this.npcs.push(new StrollNpc(R, [[-5.2, 0, 4.4], [-5.2, 0, -4.4]], 0.35));
    this.levelBox = new THREE.Box3(new THREE.Vector3(-8.5, -1, -8.5), new THREE.Vector3(8.5, 3.6, 8.5));
  }
  buildLoop() {
    const R = this.root;
    const L = LOOP;
    for (const [x0, z0, x1, z1] of [[-L, -L, L, -L], [L, -L, L, L], [L, L, -L, L], [-L, L, -L, -L]]) {
      const len = Math.hypot(x1 - x0, z1 - z0) + 1.1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, alongX = z0 === z1;
      box(R, cx, TRACK_Y - 0.1, cz, alongX ? len : 0.9, 0.2, alongX ? 0.9 : len, P.stone, { r: 0.08 });
      box(R, cx, TRACK_Y + 0.01, cz, alongX ? len : 0.5, 0.04, alongX ? 0.5 : len, 0xf2c94c, { r: 0.02, cast: false });
    }
    for (const t of [-L, -L / 2, 0, L / 2, L]) for (const [x, z] of [[t, -L], [t, L], [-L, t], [L, t]]) column(R, x, z, -0.1, TRACK_Y - 0.2, P.warmGrey, { w: 0.34, d: 0.34, r: 0.1 });
    // 环线上的黄色小列车（三节），沿圆角矩形行驶
    this.cars = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      box(g, 0, 0.32, 0, 1.0, 0.5, 0.5, P.yellow, { r: 0.14 });
      box(g, 0, 0.62, 0, 0.86, 0.08, 0.38, P.cream, { r: 0.03 });
      box(g, 0, 0.2, 0, 1.02, 0.05, 0.52, P.red, { r: 0.02, cast: false });
      box(g, 0, 0.42, 0, 0.8, 0.14, 0.52, P.window, { r: 0.02, cast: false });
      g.position.y = TRACK_Y; R.add(g); this.cars.push(g);
    }
  }
  loopPoint(s, out) {
    // s：沿环线的弧长；圆角半径 0.8
    const L = LOOP, r = 0.8, side = 2 * (L - r), arc = Math.PI * r / 2, per = 4 * (side + arc);
    s = ((s % per) + per) % per;
    const corners = [[L - r, -L + r, -Math.PI / 2], [L - r, L - r, 0], [-L + r, L - r, Math.PI / 2], [-L + r, -L + r, Math.PI]];
    const starts = [[-L + r, -L, 1, 0], [L, -L + r, 0, 1], [L - r, L, -1, 0], [-L, L - r, 0, -1]];
    for (let i = 0; i < 4; i++) {
      if (s < side) { const [x, z, dx, dz] = starts[i]; out.set(x + dx * s, TRACK_Y, z + dz * s); return Math.atan2(dx, dz); }
      s -= side;
      if (s < arc) { const [cx, cz, a0] = corners[i]; const a = a0 + s / r; out.set(cx + Math.cos(a) * r, TRACK_Y, cz + Math.sin(a) * r); return Math.atan2(-Math.sin(a), Math.cos(a)); }
      s -= arc;
    }
    return 0;
  }
  buildIsland(st, x, z, i) {
    const R = this.root, g = new THREE.Group(); g.position.set(x, 0, z); R.add(g);
    column(g, 0, 0, -0.1, 1.2, st.palette.floor, { w: 2.6, d: 2.6, r: 0.16 });
    box(g, 0, 1.18, 0, 2.3, 0.08, 2.3, st.palette.tile, { r: 0.05, cast: false });
    box(g, 0, 0.62, 1.305, 2.4, 0.16, 0.02, st.color, { cast: false });
    box(g, 1.305, 0.62, 0, 0.02, 0.16, 2.4, st.color, { cast: false });
    // 连接环线的小天桥
    const toLoop = new THREE.Vector3(-x, 0, -z).normalize();
    box(g, toLoop.x * 1.75, 1.15, toLoop.z * 1.75, Math.abs(toLoop.x) > 0.5 ? 1.1 : 0.7, 0.16, Math.abs(toLoop.z) > 0.5 ? 1.1 : 0.7, P.stone, { r: 0.05 });
    // 地标
    if (st.id === 'gyq') { tree(g, -0.5, 1.2, -0.4, 1.0); tree(g, 0.5, 1.2, 0.3, 0.8, P.greenDeep); tree(g, -0.4, 1.2, 0.6, 0.6); }
    if (st.id === 'njs') { box(g, 0, 1.5, -0.95, 2.2, 0.6, 0.18, P.red, { r: 0.05 }); box(g, 0, 1.85, -0.95, 2.36, 0.12, 0.32, P.roofGreen, { r: 0.04 }); pavilion(g, 0.2, 1.2, 0.1, 1.3, 1.0, 0.8); }
    if (st.id === 'lsly') { arch(g, 0, 1.2, 0, 1.4, 1.3, 0xefe8da); kapok(g, -0.75, 1.2, -0.7, 0.7); kapok(g, 0.7, 1.2, 0.7, 0.6); }
    if (st.id === 'dsk') { villa(g, -0.3, -0.2, 1.2, 1, 1.2, 1.0, P.cream, P.roofTerracotta); villa(g, 0.65, 0.65, 1.2, 1, 0.7, 0.7, 0xf8e3d0, P.slate); }
    stationSign(g, 0.95, 1.2, 0.95, st.color);
    // 选中光圈
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.07, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffe58a, transparent: true, opacity: 0 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 1.25; g.add(ring);
    // 透明触控代理
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.2, 3.0), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.y = 1.4; g.add(proxy);
    this.islands.push({ st, g, ring, proxy, i, baseY: 0 });
  }
  fitBox() { return this.levelBox.clone(); }
  enter() {
    this.game.hud.setStation(null);
    Ambience.setScene('hub');
    this.picking = false;
    this.islands.forEach(is => { is.g.position.y = 0; is.ring.material.opacity = 0; });
  }
  tap(x, y) {
    if (this.picking || this.game.state !== 'hub') return;
    const hits = this.ray(x, y).intersectObjects(this.islands.map(i => i.proxy), false);
    if (hits.length) { const is = this.islands.find(i => i.proxy === hits[0].object); this.game.pickStation(is.st.id); }
  }
  /** 选站动画：小岛升起、光圈亮起、城市楼块一起“变形”，镜头飞过去 */
  async playPick(id) {
    this.picking = true;
    const is = this.islands.find(i => i.st.id === id);
    Audio.blip('settle');
    this.game.cam.focusOn(new THREE.Vector3(is.g.position.x * 0.6, 1, is.g.position.z * 0.6), 1.35);
    tween(1.2, k => { is.g.position.y = Math.sin(k * Math.PI) * 0.35; is.ring.material.opacity = Math.sin(k * Math.PI) * 0.9; }, { owner: this });
    this.transformAll();
    await wait(1.3, this);
  }
  transformAll() {
    for (const b of this.buildings) {
      const to = 0.3 + Math.random() * 1.9, from = b.m.scale.y;
      tween(1.1, k => { const h = from + (to - from) * k; b.m.scale.y = h; b.m.position.y = h / 2; }, { ease: Ease.outBack, delay: Math.random() * 0.4, owner: this });
    }
    this.game.shadowsDirty = true;
  }
  update(dt, t) {
    // 环线列车
    this.trainS += dt * 1.6;
    const p = new THREE.Vector3();
    this.cars.forEach((c, i) => { const yaw = this.loopPoint(this.trainS - i * 1.1, p); c.position.copy(p); c.rotation.y = yaw - Math.PI / 2; });
    // 城市缓缓变形：每隔几秒挑几栋楼升降
    this.transformT -= dt;
    if (this.transformT <= 0) {
      this.transformT = 2.2;
      for (let k = 0; k < 4; k++) {
        const b = this.buildings[Math.floor(Math.random() * this.buildings.length)];
        const to = 0.3 + Math.random() * 1.8, from = b.m.scale.y;
        tween(1.6, q => { const h = from + (to - from) * q; b.m.scale.y = h; b.m.position.y = h / 2; }, { ease: Ease.inOutCubic, owner: this });
      }
      this.game.shadowsDirty = true;
    }
    for (const n of this.npcs) n.update(dt);
    // 小岛轻轻呼吸
    if (!this.picking) this.islands.forEach((is, i) => { is.g.position.y = Math.sin(t * 0.8 + i * 1.6) * 0.04; });
  }
}
