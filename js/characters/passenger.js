import { makeFigure } from './figure.js';
import { Walker } from './walker.js';
import { PALETTE as P } from '../world/blocks.js';
import * as Audio from '../audio/audio.js';

// 小乘客（玩家）：戴黄色帽子（1 号线黄），背小书包。点哪里就走到哪里（A* 寻路）。
export class Passenger extends Walker {
  constructor(scene, nodeId, opts = {}) {
    const fig = makeFigure({ body: 0xfff7ea, hat: P.yellow, bagColor: P.red, scale: 1.05 });
    super(scene, fig, nodeId, { ...opts, onStep: () => Audio.footstep() });
    this.lastPhase = this.phase;
    this.root.name = 'passenger';
  }
}
