/*
 * 一号线 · 方块奇境 —— 启动与游戏状态机。
 * 状态：title（标题，背景是城市）→ hub（城市枢纽选站）→ ride（站间行车）→ station（车站谜题）→ ride → …
 * 四站顺序沿 1 号线上行：公园前 → 农讲所 → 烈士陵园 → 东山口；东山口之后回到城市并庆祝。
 */
import * as THREE from 'three';
import { CONFIG } from './core/config.js';
import { createRenderer } from './core/renderer.js';
import { IsoCamera } from './core/camera.js';
import { Input } from './core/input.js';
import { updateTweens, tween, wait, Ease } from './core/tween.js';
import { startLoop } from './core/loop.js';
import { torusGeo } from './world/blocks.js';
import { STATIONS, stationById, stationIndex } from './scenes/stations.js';
import { HubScene } from './scenes/hub.js';
import { RideScene } from './scenes/ride.js';
import * as Audio from './audio/audio.js';
import * as I18n from './ui/i18n.js';
import { Hud } from './ui/hud.js';
import { TitleScreen } from './ui/title.js';
import { StationPicker } from './ui/station-picker.js';
import { Hints } from './ui/hints.js';
import { initCaptions } from './ui/captions.js';

window.__gameStarted = true;
const $ = id => document.getElementById(id);

class Game {
  constructor() {
    this.canvas = $('scene');
    this.R = createRenderer(this.canvas);
    this.renderer = this.R.renderer;
    this.renderer.localClippingEnabled = true;
    this.scene3d = new THREE.Scene();
    this.cam = new IsoCamera();
    this.state = 'boot'; this.scene = null; this.shadowsDirty = true;
    this.progress = this.loadProgress();
    this.stationById = stationById;
    this.setupLights();
    this.hints = new Hints();
    this.hud = new Hud({ onHome: () => this.goHub(), onHint: () => this.scene && this.scene.showHint && this.scene.showHint() });
    this.title = new TitleScreen({ onStart: () => this.start() });
    this.picker = new StationPicker(STATIONS, { onPick: id => this.pickStation(id) });
    initCaptions();
    I18n.apply();
    I18n.onLang(() => this.updateRideBar());
    $('btnSkip').addEventListener('click', () => this.scene && this.scene.skip && this.scene.skip());
    $('btnAgain').addEventListener('click', () => { $('celebrate').hidden = true; this.picker.show(); });
    this.input = new Input(this.canvas, {
      grab: (x, y) => this.scene && this.scene.grab ? this.scene.grab(x, y) : null,
      tap: (x, y) => this.scene && this.scene.tap && this.scene.tap(x, y),
      pan: (dx, dy) => { if (this.state === 'station' || this.state === 'hub') this.cam.pan(dx, dy); },
      pinch: f => { if (this.state === 'station' || this.state === 'hub') this.cam.zoomBy(f); }
    });
    // 点按涟漪
    this.ripple = new THREE.Mesh(torusGeo(0.32, 0.04), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    this.ripple.renderOrder = 3; this.scene3d.add(this.ripple);
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.onResize(), 250));
    this.onResize();
    // 场景实例：枢纽和行车常驻，车站进入时才搭建
    this.hub = new HubScene(this, STATIONS); this.hub.build();
    this.ride = new RideScene(this); this.ride.build();
    this.R.onQuality(() => { this.shadowsDirty = true; });
    startLoop((dt, t) => this.tick(dt, t));
    this.showTitle();
    $('boot').hidden = true;
  }
  setupLights() {
    const hemi = new THREE.HemisphereLight(0xfff8ef, 0xd9c8e8, 1.55);
    this.scene3d.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.1);
    sun.position.set(-4, 10, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
    this.scene3d.add(sun); this.scene3d.add(sun.target);
    this.sun = sun; this.hemi = hemi;
    this.scene3d.fog = new THREE.Fog(0xfdf1dc, 70, 150);
  }
  fitShadow(box) {
    const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2 + 1;
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).add(new THREE.Vector3(-4, 10, 7).normalize().multiplyScalar(r + 10));
    const sc = this.sun.shadow.camera; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 0.5; sc.far = 2 * r + 20; sc.updateProjectionMatrix();
    this.shadowsDirty = true;
  }
  setTheme(th) {
    const app = $('app');
    app.style.setProperty('--sky-top', th.top); app.style.setProperty('--sky-bot', th.bottom);
    this.scene3d.fog.color.set(th.fog);
  }
  onResize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.R.resize(); this.cam.resize(w, h);
    if (this.scene) this.fitCamera(true);
  }
  fitCamera(immediate) {
    const portrait = this.cam.height > this.cam.width;
    const box = this.scene.fitBox();
    // 枢纽/行车下方有按钮条，镜头稍微上移
    const offset = this.state === 'hub' || this.state === 'title' ? -0.06 : (this.state === 'ride' ? -0.04 : -0.02);
    this.cam.fit(box, portrait ? 1.08 : 1.12, immediate, offset);
  }
  setScene(sc, params) {
    if (this.scene && this.scene !== sc) { this.scene.exit(); this.scene.root.removeFromParent(); if (this.scene.kind === 'station') { this.scene.exitScene(); this.scene.dispose(); } }
    this.scene = sc;
    this.scene3d.add(sc.root);
    this.setTheme(sc.theme);
    sc.enter(params);
    this.fitCamera(true);
    this.fitShadow(sc.fitBox());
    this.hints.hide();
  }
  async fade(on) { $('fade').classList.toggle('on', on); await wait(0.6); }

  /* ---------- 状态切换 ---------- */
  showTitle() {
    this.state = 'title';
    this.setScene(this.hub);
    this.cam.goalZoom = 0.92;
    this.title.show(); this.hud.hide(); this.picker.hide();
  }
  start() {
    Audio.unlock(); // 必须在点击事件里同步调用（iOS）
    this.title.hide();
    this.state = 'hub';
    this.hud.show({ home: false, hint: false });
    this.picker.refresh(this.progress.done); this.picker.show();
    this.fitCamera(false);
  }
  async goHub() {
    if (this.state === 'hub') return;
    Audio.cancelAnnouncements();
    this.input.cancelAll();
    await this.fade(true);
    this.state = 'hub';
    this.setScene(this.hub);
    this.hideRide();
    this.hud.show({ home: false, hint: false });
    this.picker.refresh(this.progress.done); this.picker.show();
    await this.fade(false);
  }
  async pickStation(id) {
    if (this.state !== 'hub' || this.busy) return;
    this.busy = true;
    this.picker.hide();
    await this.hub.playPick(id);
    await this.startRide(id, true);
    this.busy = false;
  }
  async startRide(to, withDestination) {
    await this.fade(true);
    this.state = 'ride';
    this.setScene(this.ride, { to, withDestination, onArrive: () => to ? this.enterStation(to) : this.finale() });
    this.hud.show({ home: true, hint: false });
    this.showRide(to);
    await this.fade(false);
  }
  async enterStation(id) {
    await this.fade(true);
    this.hideRide();
    const st = stationById(id);
    const sc = new st.Scene(this, st); sc.build();
    this.state = 'station';
    this.setScene(sc);
    this.hud.show({ home: true, hint: true });
    await this.fade(false);
  }
  onStationComplete(id) {
    this.progress.done[id] = true; this.saveProgress();
    const i = stationIndex(id);
    if (i < STATIONS.length - 1) this.startRide(STATIONS[i + 1].id, false);
    else this.startRide(null, false);
  }
  async finale() {
    await this.fade(true);
    this.hideRide();
    this.state = 'hub';
    this.setScene(this.hub);
    this.hud.show({ home: false, hint: false });
    this.picker.refresh(this.progress.done);
    $('celeStars').innerHTML = STATIONS.map((s, i) => `<span style="animation-delay:${0.2 + i * 0.18}s">★</span>`).join('');
    $('celebrate').hidden = false;
    await this.fade(false);
    this.hub.transformAll();
    Audio.blip('goal');
  }
  showRide(to) {
    $('rideBar').hidden = false; $('btnSkip').hidden = true;
    this.rideTo = to; this.updateRideBar();
    clearTimeout(this.skipTimer);
    this.skipTimer = setTimeout(() => { if (this.state === 'ride') $('btnSkip').hidden = false; }, 2500);
  }
  hideRide() { $('rideBar').hidden = true; clearTimeout(this.skipTimer); }
  updateRideBar() {
    const el = $('rideLine'); if (!el) return;
    const ti = this.rideTo ? stationIndex(this.rideTo) : STATIONS.length;
    el.innerHTML = STATIONS.map((s, i) => `<div class="stop ${i < ti ? 'passed' : ''} ${i === ti ? 'next' : ''}"><i></i><span>${I18n.stationName(s)}</span></div>`).join('');
  }
  tapRipple(pos, exact) {
    const r = this.ripple; r.position.copy(pos); r.position.y += 0.03;
    r.material.color.set(exact ? 0xffffff : 0xffc9b8);
    tween(0.6, k => { r.scale.setScalar(0.6 + k * 0.9); r.material.opacity = 0.9 * (1 - k); }, { ease: Ease.outCubic });
  }

  /* ---------- 存档 ---------- */
  loadProgress() { try { const s = JSON.parse(localStorage.getItem(CONFIG.storageKey) || '{}'); return { done: s.done || {} }; } catch (_) { return { done: {} }; } }
  saveProgress() { try { const s = JSON.parse(localStorage.getItem(CONFIG.storageKey) || '{}'); s.done = this.progress.done; localStorage.setItem(CONFIG.storageKey, JSON.stringify(s)); } catch (_) {} }

  /* ---------- 主循环 ---------- */
  tick(dt, t) {
    updateTweens(dt);
    if (this.scene) this.scene.update(dt, t);
    if (this.state === 'title') { this.cam.goal.x += Math.sin(t * 0.2) * dt * 0.15; }
    this.cam.update(dt);
    this.hints.update(dt, this.cam);
    if (this.shadowsDirty) { this.renderer.shadowMap.needsUpdate = true; this.shadowsDirty = false; }
    this.renderer.render(this.scene3d, this.cam.camera);
    this.R.sample(dt);
  }
}

let game;
try {
  game = new Game();
} catch (e) {
  console.error(e);
  $('fatalText').textContent = '启动失败：' + e.message; $('fatal').hidden = false; $('boot').hidden = true;
}

// 测试/调试接口（Playwright 用；不影响正常游玩）
window.__game = {
  get game() { return game; },
  get state() { return game.state; },
  get stationId() { return game.scene && game.scene.station ? game.scene.station.id : null; },
  three: () => window.__threeSource,
  quality: () => ({ ...game.R.stats }),
  audio: () => Audio.getState(),
  stations: STATIONS.map(s => s.id),
  async goto(state, id) {
    if (state === 'station') { Audio.cancelAnnouncements(); game.hideRide(); const st = stationById(id); const sc = new st.Scene(game, st); sc.build(); game.state = 'station'; game.setScene(sc); game.hud.show({ home: true, hint: true }); game.picker.hide(); $('title').hidden = true; }
    if (state === 'ride') { Audio.cancelAnnouncements(); game.picker.hide(); $('title').hidden = true; await game.startRide(id, true); }
    if (state === 'hub') { await game.goHub(); }
  },
  /** 当前车站：路径图信息、可达性、节点可见性 */
  graphInfo() {
    const sc = game.scene; if (!sc || !sc.graph) return null;
    const g = sc.graph, from = sc.passenger ? sc.passenger.nodeId : null;
    const links = []; for (const [id, ls] of g.links) for (const l of ls) links.push({ from: id, to: l.to, illusion: l.illusion });
    return { nodes: [...g.nodes.values()].map(n => ({ id: n.id, active: n.active, w: [n.world.x, n.world.y, n.world.z].map(v => +v.toFixed(2)) })), links, passenger: from, goal: sc.goalId, goalReachable: from ? !!g.astar(from, sc.goalId) : null };
  },
  /** 每个节点顶面是否被别的方块挡住（沿视线射线检测） */
  occlusion() {
    const sc = game.scene; if (!sc || !sc.graph) return null;
    const rc = new THREE.Raycaster(), dir = game.cam.camera.getWorldDirection(new THREE.Vector3()).negate();
    const solids = []; sc.root.traverse(o => { if (o.isMesh && o.material && o.material.visible !== false && !o.material.transparent && !(o.parent && o.parent.userData.figure) && !o.userData.nodeId) solids.push(o); });
    const out = [];
    for (const n of sc.graph.nodes.values()) {
      if (!n.active) continue;
      const p = n.world.clone().add(new THREE.Vector3(0, 0.12, 0));
      rc.set(p, dir); rc.far = 200;
      const hit = rc.intersectObjects(solids, false).find(h => !(h.object.parent && (h.object.parent.userData.figure || h.object.parent.parent && h.object.parent.parent.userData.figure)) && !isFigure(h.object));
      if (hit) out.push({ id: n.id, by: hit.object.name || hit.object.geometry.type, at: hit.point.toArray().map(v => +v.toFixed(2)) });
    }
    return out;
  },
  screenOf(id) { const n = game.scene.graph.get(id); return game.cam.toScreen(n.world); },
  mechScreen(i) { const m = game.scene.mechs[i]; const w = m.centerWorld || (m.center) || m.group.getWorldPosition(new THREE.Vector3()); return game.cam.toScreen(w); },
  mechValues() { return game.scene.mechs ? game.scene.mechs.map(m => +m.value.toFixed(2)) : []; },
  solve() { return game.scene.autoSolve(); },
  skipRide() { game.scene.skip && game.scene.skip(); }
};
function isFigure(o) { let p = o; while (p) { if (p.userData && p.userData.figure) return true; p = p.parent; } return false; }
