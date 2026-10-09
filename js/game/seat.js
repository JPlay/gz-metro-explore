/*
 * 车厢里坐下：靠近一个空座位（烘焙的坐着的乘客占着的座位不算）时右下角出现「坐下」，
 * 坐下后玩家贴在座位上（髋部落在座垫上，坐姿动画），第一人称镜头降低；「起身」（或跳）站起来。
 * 列车进出隧道、到站都保持坐着，直到自己点起身。
 */
export class SeatCtl {
  constructor({ player, metro, Audio, events }) { Object.assign(this, { player, metro, Audio, events }); this.count = { sit: 0, stand: 0 }; }
  trainAt(p) { return this.metro.trains.find(t => t.root.isEnabled() && t.contains(p)); }
  update() {
    const pl = this.player;
    if (pl.seat) return { id: 'stand', label: '起身', icon: 'stand', run: () => this.stand() };
    if (!pl.grounded) return null;
    const tr = this.trainAt(pl.position); if (!tr) return null;
    const l = tr.local(pl.position); let best = null, bd = 1.0;
    for (const s of tr.seats) if (s.free) { const d = Math.hypot(l.x - s.x, l.z - s.sd * 0.62); if (d < bd) { bd = d; best = s; } }
    return best ? { id: 'sit', label: '坐下', icon: 'seat', run: () => this.sit(tr, best) } : null;
  }
  sit(tr, s) { this.player.sit(tr, s); this.Audio.blip('sit'); this.count.sit++; this.events.emit('seat', { sit: true }); }
  stand() { if (!this.player.seat) return; this.player.standUp(); this.Audio.blip('stand'); this.count.stand++; this.events.emit('seat', { sit: false }); }
  info() { const s = this.player.seat; return s ? { seated: true, x: +s.seat.x.toFixed(2), sd: s.seat.sd, train: s.train.id } : { seated: false }; }
}
