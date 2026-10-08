import * as THREE from 'three';
import { StationScene } from './station-base.js';
import { box, column, cyl, ball, PALETTE as P } from '../world/blocks.js';
import { villa, tree, lamp, gableRoof } from '../world/props.js';

/*
 * 东山口（红砖洋楼 · 坡屋顶）——摇柄升降台 + 屋顶视错觉。
 * 走上街边的黄色升降台 → 顺时针摇动摇柄把自己升到洋楼屋顶 →
 * 屋顶的尽头在画面上接上了后面更低的红砖平台（视错觉连接）→ 走到站台门。
 */
export class StationDongshankou extends StationScene {
  buildLevel() {
    const S = this.S, pal = this.station.palette;
    this.plinth(-1.4, 10.4, -0.6, 5.6);
    // 街道
    for (let x = 0; x <= 2; x++) this.floor(x, 0, 3, { id: `st${x}` });
    for (let x = 0; x <= 2; x++) this.floor(x, 0, 4, { id: `sf${x}` });
    // 升降台（由摇柄驱动的竖直滑块）
    const lift = this.slider({ name: 'lift', base: new THREE.Vector3(3, 0, 3), axis: new THREE.Vector3(0, 1, 0), min: 0, max: 3, value: 0 });
    this.floor(0, 0, 0, { parent: lift.group, col: false, mech: lift, color: P.yellow, topColor: 0xfff3b8, id: 'lift' });
    for (const dx of [-0.46, 0.46]) column(S, 3 + dx, 2.54, -0.4, 3.35, 0xb9a48e, { w: 0.08, d: 0.08, r: 0.03 });
    box(S, 3, 3.38, 2.54, 1.0, 0.08, 0.1, 0xb9a48e, { r: 0.03 });
    this.lift = lift;
    // 摇柄
    column(S, 1.5, 2.05, -0.4, 0.8, P.brick, { w: 0.42, d: 0.42, r: 0.1 });
    const wheel = new THREE.Group(); wheel.position.set(1.5, 0.95, 2.32); S.add(wheel);
    const disc = cyl(wheel, 0, 0, 0, 0.34, 0.34, 0.08, P.gold, { seg: 20 }); disc.rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) { const sp = box(wheel, 0, 0, 0.05, 0.6, 0.06, 0.04, P.yellowDeep, { r: 0.02 }); sp.rotation.z = i * Math.PI / 3; }
    ball(wheel, 0.27, 0, 0.12, 0.08, P.red);
    const crank = this.crank({ name: 'crank', wheel, wheelAxis: 'z', driven: lift, perTurn: 3, center: new THREE.Vector3(1.5, 0.95, 2.32) });
    wheel.children.forEach(c => crank.addHandle(c));
    crank.addProxy(S, 1.1, 1.1, 0.7, 1.5, 0.95, 2.32);
    crank.addRing(S, 1.5, 0.95, 2.4, 0.44, 'z');
    this.crankM = crank;
    // 洋楼：屋顶（y=3）可走
    for (const x of [4, 5]) this.floor(x, 3, 3, { id: `roof${x}`, color: P.cream, topColor: 0xf3d9b8 });
    for (const x of [4, 5]) for (let f = 0; f < 3; f++) {
      box(S, x, f + 0.55, 3.505, 0.32, 0.42, 0.02, P.window, { r: 0.01, cast: false });
      ball(S, x, f + 0.76, 3.51, 0.16, P.window, { cast: false, ws: 10, hs: 6 });
    }
    for (let f = 0; f < 3; f++) box(S, 5.505, f + 0.55, 3, 0.02, 0.42, 0.32, P.window, { r: 0.01, cast: false });
    box(S, 4.5, 2.88, 3.51, 1.9, 0.08, 0.02, P.brick, { cast: false });
    // 后面更低的红砖平台（y=2，z=2）：与屋顶只在画面上相接
    for (let x = 5; x <= 8; x++) this.floor(x, 2, 2, { id: `tr${x}`, color: P.brick, topColor: 0xf6dcc6 });
    for (let x = 6; x <= 8; x++) box(S, x, 1.0, 2.505, 0.34, 0.5, 0.02, 0xf6dcc6, { r: 0.01, cast: false });
    this.startId = 'st0'; this.goalId = 'tr7'; this.startYaw = Math.PI / 2;
    this.trackSpec = { y: 2, z: 1, door: 0, clip: [2.95, 9.9], signX: 8.6 };
    // 背景洋楼与树
    villa(S, 0.2, 1.0, -0.4, 2, 1.6, 1.3, P.cream, P.roofTerracotta);
    villa(S, 7.6, 4.6, -0.4, 1, 1.4, 1.0, 0xf8e3d0, P.slate);
    tree(S, -0.8, 0, 4.6, 0.8); tree(S, 9.4, 0, 3.6, 0.9, P.greenDeep); tree(S, 3.4, 0, 5.0, 0.7);
    lamp(S, 2.6, 0, 4.6);
    this.wanderers = [{ start: 'sf0', allowed: ['st0', 'st1', 'sf0', 'sf1', 'sf2'] }];
    this.queueSpots = [{ pos: new THREE.Vector3(8.0, 2, 1.95), door: 1 }, { pos: new THREE.Vector3(8.05, 2, 2.38), door: 1 }];
  }
  levelHint() {
    const p = this.passenger, h = Math.round(this.lift.value);
    if (p.standingOn(this.lift)) return h < 3 ? this.crankM.hint(3) : null;
    if (h !== 0) return this.crankM.hint(0);
    return { world: this.graph.get('lift').world.clone(), kind: 'tap' };
  }
  solution() { return [{ walk: 'lift' }, { mech: 1, value: 3 }, { walk: this.goalId }]; }
}
