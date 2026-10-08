import * as THREE from 'three';
import { StationScene } from './station-base.js';
import { box, cyl, PALETTE as P } from '../world/blocks.js';
import { arch, kapok, tree } from '../world/props.js';

/*
 * 烈士陵园（花园 · 纪念牌坊）——视错觉吊桥。
 * 穿过牌坊的小路尽头是一座竖着的吊桥。把它放下来：
 * 桥的尽头在画面上正好“接上”高处的平台——实际上平台更高、更靠前，
 * 但等轴测投影里它们重合，所以真的可以走过去（视错觉连接）。
 */
export class StationLieshilingyuan extends StationScene {
  buildLevel() {
    const S = this.S, pal = this.station.palette;
    this.plinth(-1.6, 11.0, -0.6, 5.8);
    // 花园小路
    for (const [x, z] of [[0, 1], [0, 2], [0, 3], [1, 2], [2, 2]]) this.floor(x, 0, z, { id: `g${x}${z}` });
    arch(S, 1, 0, 2, 2, 2.0, 0xefe8da);
    // 吊桥：铰链在 (2.5,0,2)，绕 z 轴转动，0°=放平，90°=竖起
    const br = this.rotator({ name: 'drawbridge', pivot: new THREE.Vector3(2.5, 0, 2), axis: 'z', value: 90, snaps: [0, 90], min: 0, max: 90 });
    br.noCarry = true;
    this.floor(0.5, 0, 0, { parent: br.group, col: false, mech: br, color: P.yellow, topColor: 0xfff3b8, id: 'b1' });
    this.floor(1.5, 0, 0, { parent: br.group, col: false, mech: br, color: P.yellow, topColor: 0xfff3b8, id: 'b2' });
    br.group.children.forEach(c => br.addHandle(c));
    br.addProxy(br.group, 2.4, 0.8, 1.3, 1.0, -0.1, 0);
    for (const dz of [-0.56, 0.56]) cyl(S, 2.5, -0.12, 2 + dz, 0.16, 0.16, 0.24, P.gold, { seg: 12 }).rotation.x = Math.PI / 2;
    br.addRing(S, 2.5, -0.1, 2.62, 0.4, 'z');
    this.br = br;
    // 高处平台（y=2，z=4）：与放下的桥只在画面上相接
    for (let x = 7; x <= 10; x++) this.floor(x, 2, 4, { id: `t${x}`, color: 0xefe8da });
    box(S, 8.5, 0.9, 4.505, 3.6, 0.12, 0.02, 0xa6cfa8, { cast: false });
    this.startId = 'g02'; this.goalId = 't9'; this.startYaw = Math.PI / 2;
    this.trackSpec = { y: 2, z: 3, door: 1, clip: [3.75, 10.9], signX: 7.6 };
    // 花园装饰：木棉树、花坛、绿篱
    kapok(S, -0.9, 0, 0.3, 1.0); kapok(S, -0.9, 0, 4.4, 0.85); kapok(S, 4.4, 0, 4.9, 0.9);
    tree(S, 1.6, 0, 4.5, 0.8, P.greenDeep);
    box(S, 0, 0.12, 4.3, 1.2, 0.24, 0.7, 0xf4b6b0, { r: 0.1 });
    box(S, 5.6, 0.2, 5.1, 2.4, 0.4, 0.5, 0x9fd09a, { r: 0.18 });
    this.wanderers = [{ start: 'g01', allowed: ['g01', 'g02', 'g03', 'g12'] }];
    this.queueSpots = [{ pos: new THREE.Vector3(10.0, 2, 3.95), door: 1 }, { pos: new THREE.Vector3(10.05, 2, 4.38), door: 1 }];
  }
  levelHint() {
    if (Math.round(this.br.value) !== 0) return this.br.hint();
    return { world: this.graph.get(this.goalId).world.clone(), kind: 'tap' };
  }
  solution() { return [{ mech: 0, value: 0 }, { walk: this.goalId }]; }
}
