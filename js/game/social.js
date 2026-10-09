/*
 * 路人互动：
 *   ① 打招呼：走近四种路人（阿婆 / 学生 / 上班族 / 游客）→ 右下角大按钮「打招呼」→ 对方转身挥手，玩家也挥手，头顶冒出说话气泡
 *      （上面粤语、下面小字普通话，每种人几句轮着说）。
 *   ② 让路：走动的路人遇到挡路的玩家会往旁边让一步，偶尔说「唔该借借 / 不好意思，借过一下」。
 *   ③ 车厢：坐着的乘客看手机 / 聊天；玩家坐下时旁边的人转头点点头。
 *   ④ 问路：站厅客服中心的工作人员 →「问路」→ 全网图选站 → 回答坐几号线（线路色）、往哪个方向、要不要在公园前换乘，并转身指向闸机。
 */
import { LINES, STATIONS } from '../data/lines.js';
import { routeTo } from '../data/route.js';
import { networkSVG, nearestStation, svgMap } from '../ui/netmap.js';
import { pressable } from './input.js';

export const LINES_SAY = {
  granny: [['早晨！食咗饭未呀？', '早上好！吃饭了吗？'], ['乖仔，好叻呀！', '好孩子，真棒！'], ['去边度呀？小心啲呀。', '去哪里呀？小心点哦。'], ['今日啲菜好新鲜㗎！', '今天的菜很新鲜的！']],
  student: [['哈啰！你好呀！', '哈喽！你好呀！'], ['我返学呀，拜拜！', '我去上学啦，拜拜！'], ['你都系搭地铁㗎？', '你也是坐地铁的吗？'], ['今日好多功课呀……', '今天作业好多呀……']],
  office: [['早晨！', '早上好！'], ['返工啦，赶时间呀！', '去上班啦，赶时间呀！'], ['小朋友，搭车要揸实扶手呀。', '小朋友，坐车要抓好扶手哦。'], ['去边度呀？', '去哪里呀？']],
  tourist: [['你好呀！我第一次嚟广州㗎！', '你好呀！我第一次来广州！'], ['广州好好玩呀！', '广州真好玩！'], ['边度有好嘢食呀？', '哪里有好吃的呀？'], ['嚟，影张相！', '来，拍张照！']]
};
export const EXCUSE = ['唔该借借', '不好意思，借过一下'];
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const lineTag = l => `<span class="ln" style="background:${LINES[l].color};color:${LINES[l].ink}">${LINES[l].zh}</span>`;

export class Social {
  constructor({ scene, player, bubbles, Audio, events, getStation, getCode, getMetro }) {
    Object.assign(this, { scene, player, bubbles, Audio, events, getStation, getCode, getMetro });
    this.idx = {}; this.sidestepChance = 0.55; this.sayCool = 0; this.count = { greet: 0, excuse: 0, nod: 0, ask: 0 }; this.lastNod = null; this.lastAnswer = null;
    events.on('seat', d => { if (d.sit) setTimeout(() => this.nodNeighbour(), 350); });
    this.buildPicker();
  }
  /** 说话的人头顶上方（世界坐标） */
  head(n) { const m = n.p ? n.p.mesh : n.mesh; return () => m.getAbsolutePosition().add(new window.BABYLON.Vector3(0, 2.0 * (m.scaling.y || 1), 0)); }
  attach(st) { st.crowd.onSidestep = n => this.excuse(n); }
  excuse(n) {
    if (this.sayCool > 0 || Math.random() > this.sidestepChance) return;
    this.sayCool = 3.5; this.count.excuse++; this.bubbles.say({ pos: this.head(n) }, { yue: EXCUSE[0], zh: EXCUSE[1], kind: 'excuse' });
  }
  /** 每帧：返回动作按钮（打招呼 / 问路）或 null */
  update(dt) {
    this.sayCool -= dt;
    const st = this.getStation(), pl = this.player, p = pl.position;
    if (st && this._st !== st) { this.attach(st); this._st = st; }
    if (!st || pl.seat || !pl.grounded || this.pickerOpen) return null;
    let best = null, bd = 2.3;
    for (const g of st.greeters || []) { const m = g.n.p.mesh.position; if (Math.abs(m.y - p.y) > 1.2) continue; const d = Math.hypot(m.x - p.x, m.z - p.z); if (d < bd) { bd = d; best = g; } }
    const a = st.askPoint;
    if (a && Math.abs(a.y - p.y) < 1.2) { const d = Math.hypot(a.x - p.x, a.z - p.z); if (d < Math.min(bd, 2.4)) { this.near = 'staff'; return { id: 'ask', label: '问路', icon: 'ask', run: () => this.ask() }; } }
    this.near = best ? best.kind : null;
    return best ? { id: 'greet', label: '打招呼', icon: 'wave', run: () => this.greet(best) } : null;
  }
  greet(g) {
    const st = this.getStation(), pl = this.player, m = g.n.p.mesh;
    st.crowd.act(g.n, 'wave', yawTo(m.position, pl.position), 3.2);
    pl.emote = { mode: 'wave', yaw: yawTo(pl.position, m.position), t: 3.0 };
    const L = LINES_SAY[g.kind], i = this.idx[g.kind] = ((this.idx[g.kind] ?? -1) + 1) % L.length;
    this.bubbles.say({ pos: this.head(g.n) }, { yue: L[i][0], zh: L[i][1], kind: 'greet ' + g.kind, ms: 2800 });
    this.Audio.blip && this.Audio.blip('tap'); this.count.greet++;
    this.lastGreet = { kind: g.kind, yue: L[i][0], zh: L[i][1] };
  }
  /** 玩家坐下：同侧 1.3m 以内坐着的乘客转头点点头 */
  nodNeighbour() {
    const pl = this.player; if (!pl.seat) return;
    const { train, seat } = pl.seat; let best = null, bd = 1.3;
    for (const q of train.pax || []) if (q.seated && q.sd === seat.sd) { const d = Math.abs(q.x - seat.x); if (d < bd) { bd = d; best = q; } }
    if (!best) { this.lastNod = null; return; }
    const face = best.p.mesh.rotation.y, dx = (seat.x - best.x) * (Math.abs(face) < 0.1 ? 1 : -1);
    best.p.nod(Math.max(-1.1, Math.min(1.1, Math.atan2(dx, 0.35))));
    this.lastNod = { x: best.x, sd: best.sd, dx: +(seat.x - best.x).toFixed(2) }; this.count.nod++;
  }
  /* —— 问路 —— */
  buildPicker() {
    const el = this.picker = document.createElement('div'); el.id = 'askway'; el.hidden = true;
    el.innerHTML = '<div class="sheet glass"><header><div class="ttl"><span class="who">客服中心</span><b>你想去哪个站？</b><small>点一下地图上的车站</small></div><button class="x" aria-label="关闭"><svg class="ico"><use href="#i-close"/></svg></button></header><div class="mapbox"></div></div>';
    document.body.appendChild(el);
    pressable(el.querySelector('.x'), () => this.closePicker());
    const box = el.querySelector('.mapbox');
    let down = null;
    box.addEventListener('pointerdown', e => { e.stopPropagation(); down = [e.clientX, e.clientY]; });
    box.addEventListener('pointerup', e => {
      e.stopPropagation(); if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 24) return; down = null;
      const [qx, qy] = svgMap(box.querySelector('svg')).toSvg(e.clientX, e.clientY);
      const c = nearestStation(qx, qy, this.portrait); if (c) this.answer(c);
    });
    ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'click'].forEach(t => el.addEventListener(t, e => e.stopPropagation()));
  }
  ask() {
    const st = this.getStation(), s = st.staff, pl = this.player;
    st.crowd.act(s, 'wave', yawTo(s.p.mesh.position, pl.position), 1.4);
    this.bubbles.say({ pos: this.head(s) }, { yue: '你好！有咩可以帮到你？', zh: '你好！有什么可以帮你？', kind: 'staff' });
    this.openPicker(); this.count.ask++;
  }
  openPicker() {
    this.portrait = innerHeight > innerWidth;
    this.picker.querySelector('.mapbox').innerHTML = networkSVG(this.getCode(), { portrait: this.portrait });
    this.picker.hidden = false; this.pickerOpen = true; this.Audio.blip && this.Audio.blip('tap');
  }
  closePicker() { this.picker.hidden = true; this.pickerOpen = false; }
  /** 回答：坐几号线（线路色块）、往哪个终点方向、要不要在公园前换乘；工作人员转身指向闸机 */
  answer(to) {
    this.closePicker();
    const st = this.getStation(), s = st.staff, pl = this.player, here = this.getCode(), r = routeTo(here, to), T = STATIONS[to].zh;
    let html;
    if (r.same) html = `<div class="row">你已经喺 <span class="st">${T}</span> 啦！</div><div class="sub">你已经在${T}啦！</div>`;
    else {
      const [a, b] = r.legs;
      html = `<div class="row">搭 ${lineTag(a.line)} 往 <b>${a.dir.zh}</b></div><div class="sub">坐${LINES[a.line].zh}，往${a.dir.zh}方向</div>`;
      if (b) html += `<div class="row">喺 <span class="st">公园前</span> <span class="xf">转</span> ${lineTag(b.line)} 往 <b>${b.dir.zh}</b></div><div class="sub">在公园前换乘${LINES[b.line].zh}，往${b.dir.zh}方向</div>`;
      html += `<div class="row">到 <span class="st">${T}</span> 落车</div><div class="sub">到${T}下车</div>`;
    }
    // 指向：在非付费区指闸机（进站口），已经在付费区就指去站台的楼梯
    const P = s.p.mesh.position, tgt = pl.position.z < (st.gateZ ?? -2) ? st.gatePoint : st.stairPoint, face = yawTo(P, pl.position);
    let py = yawTo(P, tgt) - face; py = Math.atan2(Math.sin(py), Math.cos(py));
    st.crowd.act(s, 'point', face, 7.5, { pointYaw: Math.max(-1.4, Math.min(1.4, py)), pointAfter: 0.5 });
    this.bubbles.say({ pos: this.head(s) }, { html, kind: 'way', ms: 7000 });
    this.lastAnswer = { to, legs: r.legs.map(l => ({ line: l.line, toward: l.dir.zh, from: l.from, to: l.to })), transfer: r.transfer || null, same: !!r.same, pointYaw: +py.toFixed(2) };
    this.Audio.blip && this.Audio.blip('goal');
  }
  info() { return { count: this.count, lastGreet: this.lastGreet, lastNod: this.lastNod, lastAnswer: this.lastAnswer, pickerOpen: !!this.pickerOpen, bubbles: this.bubbles.info() }; }
}
