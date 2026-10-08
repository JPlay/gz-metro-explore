import * as THREE from 'three';
import { StationScene } from './station-base.js';
import { box, column, ball, PALETTE as P } from '../world/blocks.js';
import { redWall, pavilion, tree, lamp } from '../world/props.js';

/*
 * 农讲所（红墙庭院）——滑块踏板。
 * 站在红墙顶上，中间是一条轨槽，上面有一块会滑动的黄色踏板（带红灯笼把手）。
 * 先走上踏板 → 把踏板推到对面 → 下台阶到站台门。
 */
export class StationNongjiangsuo extends StationScene {
  buildLevel() {
    const S = this.S, pal = this.station.palette;
    this.plinth(-1.2, 10.4, -1.2, 5.2);
    const wallTop = 0xf1dcb0;
    // 起点红墙（墙顶可走）
    this.floor(0, 1, 0, { color: P.red, topColor: wallTop, id: 'w0' });
    this.floor(1, 1, 0, { color: P.red, topColor: wallTop, id: 'w1' });
    // 轨槽
    box(S, 2, 0.12, 1.5, 0.5, 0.24, 4.0, 0xc9b9a0, { r: 0.08 });
    box(S, 2, 0.26, 1.5, 0.16, 0.06, 3.9, 0x9a8a78, { r: 0.03, cast: false });
    // 滑动踏板：沿 z 从 0 滑到 3
    const sl = this.slider({ name: 'stepstone', base: new THREE.Vector3(2, 0, 0), axis: new THREE.Vector3(0, 0, 1), min: 0, max: 3, value: 0 });
    this.floor(0, 1, 0, { parent: sl.group, col: false, mech: sl, color: P.yellow, topColor: 0xfff3b8, id: 'stone' });
    column(sl.group, 0, 0, 0.28, 0.72, 0xc8a24a, { w: 0.3, d: 0.3, r: 0.1 });
    // 红灯笼把手（朝相机一侧）
    ball(sl.group, 0.62, 0.78, 0, 0.17, P.redDeep, { emissive: 0xff6040, ei: 0.25 });
    box(sl.group, 0.62, 0.98, 0, 0.12, 0.06, 0.12, P.gold, { r: 0.02 });
    sl.group.children.forEach(c => sl.addHandle(c));
    sl.addProxy(sl.group, 1.6, 1.2, 1.4, 0.2, 0.7, 0);
    sl.addRing(sl.group, 0, 1.05, 0, 0.66);
    sl.handleWorld = () => sl.group.localToWorld(new THREE.Vector3(0.62, 0.78, 0));
    this.sl = sl;
    // 对面红墙 + 台阶 + 站台
    this.floor(3, 1, 3, { color: P.red, topColor: wallTop, id: 'e3' });
    this.floor(4, 1, 3, { color: P.red, topColor: wallTop, id: 'e4' });
    this.stair(5, 0, 3, { x: -1, z: 0 });
    for (let x = 6; x <= 9; x++) this.floor(x, 0, 3, { id: `plat${x}` });
    this.startId = 'w0'; this.goalId = 'plat7'; this.startYaw = Math.PI / 2;
    this.trackSpec = { y: 0, z: 2, door: 0, clip: [2.95, 9.9], signX: 8.5 };
    // 庭院装饰：红墙、黄绿琉璃瓦、小殿
    redWall(S, -0.9, 9.9, -0.95, -0.95, -0.4, 1.2);
    redWall(S, -0.95, -0.95, -0.9, 4.6, -0.4, 1.2);
    pavilion(S, 5.6, -0.4, 0.35, 2.0, 1.4, 1.1);
    tree(S, 0.2, 0, 3.6, 0.8, P.greenDeep); tree(S, 1.2, 0, 4.4, 0.65);
    box(S, 0.6, 0.06, 2.2, 1.6, 0.12, 1.2, 0xeadcc4, { r: 0.05 }); // 庭院石板
    lamp(S, 9.6, 0, 4.2);
    this.queueSpots = [{ pos: new THREE.Vector3(9.0, 0, 2.95), door: 1 }, { pos: new THREE.Vector3(9.05, 0, 3.4), door: 1 }];
    this.wanderers = [];
  }
  levelHint() {
    const p = this.passenger, s = Math.round(this.sl.value);
    if (p.standingOn(this.sl)) return s < 3 ? this.sl.hint(3) : null;
    if (s !== 0) return this.sl.hint(0);
    return { world: this.graph.get('stone').world.clone(), kind: 'tap' };
  }
  solution() { return [{ walk: 'stone' }, { mech: 0, value: 3 }, { walk: this.goalId }]; }
}
