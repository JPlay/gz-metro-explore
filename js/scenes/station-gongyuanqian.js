import * as THREE from 'three';
import { StationScene } from './station-base.js';
import { column, cyl, box, PALETTE as P } from '../world/blocks.js';
import { tree, lamp } from '../world/props.js';

/*
 * 公园前（换乘站 · 城市公园）——教学关：旋转台。
 * 高台站厅（y=2）与通往站台的楼梯之间断开；中间一座黄色旋转桥。
 * 把桥转 90°，让它连上两边 → 走下楼梯 → 到站台门。
 */
export class StationGongyuanqian extends StationScene {
  buildLevel() {
    const S = this.S, pal = this.station.palette;
    this.plinth(-1.6, 7.6, -1, 6.6);
    // 高台站厅（2×3），柱身是奶油色楼体，带绿色腰线
    for (let x = 0; x <= 1; x++) for (let z = 3; z <= 5; z++) this.floor(x, 2, z, { id: `pad${x}${z}` });
    box(S, 0.5, 1.2, 5.505, 1.9, 0.14, 0.02, 0x8fcf9a, { cast: false });
    box(S, 1.505, 1.2, 4, 0.02, 0.14, 2.9, 0x8fcf9a, { cast: false });
    box(S, 1.505, 0.75, 4, 0.02, 0.1, 2.9, 0x7fb0e0, { cast: false }); // 2 号线蓝色细线：换乘站
    // 公园花坛与大树
    box(S, -1, 1.0, 4, 0.9, 2.0, 2.8, 0xa9d8a6, { r: 0.14 });
    tree(S, -1, 2.0, 3.3, 1.0); tree(S, -1, 2.0, 4.7, 0.85, P.greenDeep);
    // 旋转桥：枢轴 (3,2,4)，三块黄色桥面
    column(S, 3, 4, -0.4, 1.42, pal.floor, { w: 0.5, d: 0.5, r: 0.12 });
    const rot = this.rotator({ name: 'turntable', pivot: new THREE.Vector3(3, 2, 4), axis: 'y', value: 90, step: 90 });
    for (let lx = -1; lx <= 1; lx++) {
      const n = this.floor(lx, 0, 0, { parent: rot.group, col: false, mech: rot, color: P.yellow, topColor: 0xfff3b8, id: `bridge${lx + 1}` });
    }
    rot.group.children.forEach(c => rot.addHandle(c));
    cyl(rot.group, 0, -0.42, 0, 0.42, 0.42, 0.14, P.yellowDeep);
    rot.addProxy(rot.group, 3.3, 0.9, 1.5, 0, -0.1, 0);
    rot.addRing(S, 3, 1.5, 4, 0.62);
    this.rot = rot;
    // 东侧落脚台 + 两段楼梯往下（朝 -z 下降）
    this.floor(5, 2, 4, { id: 'landing' });
    this.stair(5, 1, 3, { x: 0, z: 1 });
    this.stair(5, 0, 2, { x: 0, z: 1 });
    // 站台（y=0，z=1 一排）
    for (let x = 2; x <= 6; x++) this.floor(x, 0, 1, { id: `plat${x}` });
    this.startId = 'pad04'; this.goalId = 'plat2'; this.startYaw = Math.PI / 2;
    this.trackSpec = { y: 0, z: 0, door: 3, clip: [-0.9, 7.1], signX: 4.2 };
    // 装饰：前景的公园树、路灯
    tree(S, 7, 0, 3.2, 0.9); tree(S, 6.7, 0, 5.4, 1.1, P.greenDeep); tree(S, 3.4, 0, 6.0, 0.8);
    lamp(S, 6.6, 0, 1.9);
    // NPC
    this.wanderers = [{ start: 'pad15', allowed: ['pad03', 'pad04', 'pad05', 'pad13', 'pad14', 'pad15'] }];
    this.queueSpots = [{ pos: new THREE.Vector3(6.0, 0, 0.95), door: 1 }, { pos: new THREE.Vector3(6.05, 0, 1.38), door: 1 }];
  }
  levelHint() {
    const a = this.rot.normalized();
    if (a !== 0 && a !== 180) return this.rot.hint();
    return { world: this.graph.get(this.goalId).world.clone(), kind: 'tap' };
  }
  solution() { return [{ mech: 0, value: 0 }, { walk: this.goalId }]; }
}
