/*
 * 票卡：背包里最多一样——单程票（圆形 IC 票，出站时投进闸机回收口）或羊城通（一直留着）。
 * 每帧根据玩家位置给出一个“动作”（右下角大按钮）：走到售票机前 →「买票」；闸机进站一侧 →「刷卡/刷票」；
 * 出站一侧带着票卡 →「投票出站 / 刷卡出站」（身上什么都没有时闸机直接放行，不会把小朋友关在里面）。
 * 没票去刷：闸机屏幕显示柔和的红叉，提示气泡“先去买票哦”，气泡里的小箭头指向售票机。
 */
import { STATIONS } from '../data/lines.js';
import { YC } from '../world/station.js';
const B = window.BABYLON;

export class Tickets {
  constructor({ hud, Audio, events, panel, scene, cam }) {
    Object.assign(this, { hud, Audio, events, panel, scene, cam });
    this.inv = null; this.hintT = 0; this.refused = 0; this.taps = []; this.st = null;
  }
  /** 闸机出站方向是否直接放行：身上没有票卡 */
  autoOut() { return !this.inv; }
  giveToken(from, to, fare) { this.inv = { kind: 'token', from, to, fare, entered: false }; this.hud.inv(this.inv); this.events.emit('ticket', { kind: 'token', to }); }
  giveCard() { this.inv = { kind: 'card', entered: false }; this.hud.inv(this.inv); this.events.emit('ticket', { kind: 'card' }); }
  nearestTvm(st, p) { let best = null, bd = 1e9; for (const t of st.tvms || []) { const d = Math.hypot(p.x - t.front.x, p.z - t.front.z); if (d < bd) { bd = d; best = t; } } return best ? { t: best, d: bd } : null; }
  update(dt, st, player) {
    this.st = st;
    const p = player.position;
    if (this.hintT > 0) {
      this.hintT -= dt;
      const n = this.nearestTvm(st, p);
      if (this.hintT <= 0 || !n || this.inv) { this.hintT = 0; this.hud.hint(null); }
      else {
        // 相对镜头朝向（第一 / 第三人称都对）：0 = 正前方，正 = 右边；每帧更新
        const c = this.cam.position, f = this.cam.getDirection(B.Axis.Z), t = n.t.front;
        this.hud.hint({ angle: Math.atan2(t.x - c.x, t.z - c.z) - Math.atan2(f.x, f.z) });
      }
    }
    if (this.panel.isOpen || Math.abs(p.y - YC) > 1.2) return null;
    const n = this.nearestTvm(st, p);
    if (n && n.d < 1.05 && p.z < n.t.z) return { id: 'buy', label: '买票', icon: 'tvm', run: () => this.openPanel(st) };
    for (let i = 0; i < st.gates.length; i++) {
      const g = st.gates[i], dz = p.z - g.z;
      if (Math.abs(p.x - g.x) > 0.62 || g.t > 0.3) continue;
      if (dz < -0.5 && dz > -2.6) return { id: 'tapIn', gate: i, label: this.inv ? (this.inv.kind === 'card' ? '刷卡' : '刷票') : '刷卡/刷票', icon: this.inv && this.inv.kind === 'card' ? 'card' : 'token', run: () => this.tapIn(st, i) };
      if (dz > 0.5 && dz < 2.6 && this.inv) return { id: 'tapOut', gate: i, label: this.inv.kind === 'card' ? '刷卡出站' : '投票出站', icon: this.inv.kind === 'card' ? 'card' : 'token', run: () => this.tapOut(st, i) };
    }
    return null;
  }
  openPanel(st) {
    this.Audio.blip('tap');
    this.panel.open(st.code, st.s.lines[0], {
      token: (to, fare) => this.giveToken(st.code, to, fare),
      card: () => this.giveCard()
    });
  }
  tapIn(st, i) {
    const g = st.gates[i];
    this.taps.push({ dir: 'in', ok: !!this.inv, code: st.code });
    if (!this.inv) {
      this.refused++; st.setGateScreen(i, 'no'); g.scrT = 2.5; this.Audio.blip('oops');
      this.hintT = 4.5; this.events.emit('ticket', { kind: 'refused' });
      return false;
    }
    this.inv.entered = true; this.inv.inAt = st.code;
    this.Audio.sfx('gateBeep'); st.setGateScreen(i, 'ok'); g.scrT = 3; st.openGate(i, 3, false);
    this.hud.toast(this.inv.kind === 'card' ? '嘀！羊城通刷好啦，请进 ✔' : '嘀！单程票刷好啦，请进 ✔', 1800); this.hud.chipPulse();
    this.events.emit('ticket', { kind: 'in' });
    return true;
  }
  tapOut(st, i) {
    const g = st.gates[i], inv = this.inv; if (!inv) return false;
    this.taps.push({ dir: 'out', ok: true, code: st.code, kind: inv.kind });
    st.setGateScreen(i, 'ok'); g.scrT = 3;
    if (inv.kind === 'token') {
      // 单程票飞进闸机的回收口（屏幕上投影到通道入口机柜的位置）
      const slot = this.project(new B.Vector3(g.x + 1, g.y + 1.0, g.z + 0.55));
      this.hud.flyChipTo(slot); this.inv = null; this.Audio.blip('drop');
      setTimeout(() => this.hud.inv(null), 650);
      st.openGate(i, 3, true); this.hud.toast('单程票投进回收口啦，欢迎再来 ✔', 2000);
    } else {
      inv.entered = false; this.Audio.sfx('gateBeep'); st.openGate(i, 3, false); this.hud.toast('嘀！羊城通出站 ✔', 1600); this.hud.chipPulse();
    }
    this.events.emit('ticket', { kind: 'out', token: inv.kind === 'token' });
    return true;
  }
  project(v) {
    const e = this.scene.getEngine(), w = e.getRenderWidth(), h = e.getRenderHeight();
    const s = B.Vector3.Project(v, B.Matrix.Identity(), this.scene.getTransformMatrix(), this.cam.viewport.toGlobal(w, h));
    const k = innerWidth / w; return { x: s.x * k, y: s.y * k };
  }
  info() { return { inv: this.inv ? { ...this.inv, toZh: this.inv.to ? STATIONS[this.inv.to].zh : null } : null, refused: this.refused, hint: this.hintT > 0, taps: this.taps.slice(-6), panel: this.panel.info() }; }
}
