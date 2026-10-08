/*
 * 音频引擎（移植自旧项目 js/metro/audio.js，接口改为 ES 模块）。
 * 保留旧版做法：
 *   - 全部声音为同源本地 MP3（assets/audio，清单 manifest.json），运行时不调用任何 TTS 服务；
 *   - 尽量 24kHz AudioContext；用 OfflineAudioContext 解码（循环床 16kHz、其余 24kHz），最多 2 路并发解码；
 *   - 语音按需解码，PCM 走 8MiB LRU 缓存（不淘汰正在播放的缓冲）；
 *   - 报站经“站台喇叭”链：高通 280Hz → 低通 4400Hz + 两路早期反射（53ms/137ms），播报时压低环境声；
 *   - 报站串行排队、epoch 取消、优先打断；每段开始/结束派发 gz-audio-caption 事件；
 *   - iOS：首次触摸内同步播放 1 帧静音并 resume（不能先 await 加载）；后台/pagehide 挂起，回前台重试；
 *     支持 navigator.audioSession 时请求 playback。
 * 等轴测游戏没有第一人称听者，所以去掉了 HRTF 空间定位，广播走非定位的 PA 链（旧版无喇叭点时的回退路径）。
 */
import { CONFIG } from '../core/config.js';
import * as WebSpeech from './webspeech.js';

const ROOT = new URL('../../assets/audio/', import.meta.url).href;
let ctx = null, master, compressor, buses, trainFilter, paInput, paNodes = [];
let manifest = null, manifestLoading = null;
let everUnlocked = false, needsGesture = true, muted = false, background = document.hidden, volume = 0.9;
const mix = { ambience: 0.55, train: 0.75, sfx: 0.8, voice: 1 };
const assets = Object.create(null), buffers = Object.create(null), compressed = Object.create(null);
const decoding = Object.create(null), missing = new Set(), decoders = Object.create(null);
const voiceUsed = Object.create(null); let voiceBytes = 0; const voiceLimit = 8 * 1048576;
let decodeActive = 0; const decodeWaiters = [];
const active = []; const ambient = Object.create(null); const loops = Object.create(null); const retired = [];
let zone = 'none', ducked = false;
const queue = []; let pumping = false, current = null, epoch = 0;
let train = { speed: 0, inside: true, braking: false }, lastTrainAt = -1;
const log = { played: [], announced: [], fallbacks: [], errors: [] };

function clamp(n, a, b) { return Math.max(a, Math.min(b, Number.isFinite(n) ? n : a)); }
function smooth(param, target, seconds) {
  if (!ctx) return;
  if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(ctx.currentTime);
  else { param.cancelScheduledValues(ctx.currentTime); param.setValueAtTime(param.value, ctx.currentTime); }
  param.setTargetAtTime(target, ctx.currentTime, seconds || 0.08);
}
function gainNode(parent, v) { const n = ctx.createGain(); n.gain.value = v; n.connect(parent); return n; }
function canPlay() { return !!ctx && everUnlocked && ctx.state === 'running' && !background; }
function audioSession(v) { try { if (navigator.audioSession) navigator.audioSession.type = v; } catch (_) {} }
function emit(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail })); }

function context() {
  if (ctx) return ctx;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) throw new Error('此浏览器不支持 Web Audio');
  try { ctx = new C({ sampleRate: 24000 }); } catch (_) { ctx = new C(); }
  master = ctx.createGain(); master.gain.value = muted ? 0 : volume;
  compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -8; compressor.knee.value = 6; compressor.ratio.value = 4; compressor.attack.value = 0.003; compressor.release.value = 0.18;
  master.connect(compressor); compressor.connect(ctx.destination);
  buses = { ambience: gainNode(master, mix.ambience), sfx: gainNode(master, mix.sfx), voice: gainNode(master, mix.voice), train: gainNode(master, mix.train), ui: gainNode(master, 0.5) };
  trainFilter = ctx.createBiquadFilter(); trainFilter.type = 'lowpass'; trainFilter.frequency.value = 2900; trainFilter.connect(buses.train);
  resetPA();
  ctx.onstatechange = () => {
    if (ctx.state === 'running') { needsGesture = false; if (everUnlocked && !background) { updateZone(); updateTrain(true); } }
    else { needsGesture = !background; stopBeds(); }
    emit('gz-audio-state', { context: ctx.state, needsGesture, background });
  };
  return ctx;
}
function resetPA() {
  // 与旧版一致的站台喇叭链；取消时清掉延迟尾音
  paNodes.forEach(n => { try { n.disconnect(); } catch (_) {} }); paNodes.length = 0;
  const high = ctx.createBiquadFilter(), low = ctx.createBiquadFilter();
  high.type = 'highpass'; high.frequency.value = 280; low.type = 'lowpass'; low.frequency.value = 4400;
  high.connect(low); low.connect(buses.voice); paInput = high; paNodes.push(high, low);
  [0.053, 0.137].forEach((d, i) => {
    const delay = ctx.createDelay(0.5), wet = gainNode(buses.voice, [0.13, 0.07][i]), f = ctx.createBiquadFilter();
    delay.delayTime.value = d; f.type = 'lowpass'; f.frequency.value = 2200;
    low.connect(delay); delay.connect(f); f.connect(wet); paNodes.push(delay, f, wet);
  });
}
function applyMix() {
  if (!ctx) return;
  smooth(master.gain, muted ? 0 : volume, 0.03);
  smooth(buses.ambience.gain, mix.ambience * (ducked ? 0.25 : 1), ducked ? 0.05 : 0.2);
  smooth(buses.train.gain, mix.train * (ducked ? 0.45 : 1), ducked ? 0.05 : 0.2);
}
function duck(v) { if (ducked !== v) { ducked = v; applyMix(); } }

/* ---------- 加载与解码 ---------- */
export function loadManifest() {
  if (manifest) return Promise.resolve(manifest);
  if (manifestLoading) return manifestLoading;
  manifestLoading = fetch(ROOT + 'manifest.json').then(r => { if (!r.ok) throw new Error('音频清单加载失败 ' + r.status); return r.json(); })
    .then(m => { manifest = m; m.assets.forEach(a => { assets[a.id] = a; }); return m; })
    .catch(e => { manifestLoading = null; log.errors.push(e.message); throw e; });
  return manifestLoading;
}
async function decode(a, raw) {
  if (decodeActive >= 2) await new Promise(r => decodeWaiters.push(r));
  decodeActive++;
  try {
    const rate = a.loop ? 16000 : 24000;
    let dec = decoders[rate];
    if (!dec) { const O = window.OfflineAudioContext || window.webkitOfflineAudioContext; try { dec = O ? new O(1, 1, rate) : ctx; } catch (_) { dec = ctx; } decoders[rate] = dec; }
    const buf = await new Promise((res, rej) => { const p = dec.decodeAudioData(raw, res, rej); if (p && p.catch) p.catch(rej); });
    buffers[a.id] = buf;
    if (a.group === 'voice') { voiceBytes += buf.length * buf.numberOfChannels * 4; voiceUsed[a.id] = performance.now(); trimVoice(a.id); }
    return buf;
  } finally { decodeActive--; const n = decodeWaiters.shift(); if (n) n(); }
}
function trimVoice(keep) {
  const ids = Object.keys(voiceUsed).sort((a, b) => voiceUsed[a] - voiceUsed[b]);
  for (let i = 0; voiceBytes > voiceLimit && i < ids.length; i++) {
    const id = ids[i]; if (id === keep || active.some(x => x.id === id)) continue;
    const b = buffers[id]; if (!b) continue;
    voiceBytes -= b.length * b.numberOfChannels * 4; delete buffers[id]; delete voiceUsed[id];
  }
}
/** 取得解码缓冲；文件缺失（404）时 reject，错误带 missing=true */
export async function ensureBuffer(id) {
  await loadManifest(); context();
  const a = assets[id];
  if (!a) { const e = new Error('清单里没有：' + id); e.missing = true; throw e; }
  if (buffers[id]) { if (a.group === 'voice') voiceUsed[id] = performance.now(); return buffers[id]; }
  if (missing.has(id)) { const e = new Error('素材缺失：' + a.file); e.missing = true; throw e; }
  if (decoding[id]) return decoding[id];
  decoding[id] = (async () => {
    let raw = compressed[id];
    if (!raw) {
      const r = await fetch(ROOT + a.file);
      if (!r.ok) { missing.add(id); const e = new Error('素材缺失：' + a.file); e.missing = true; throw e; }
      raw = await r.arrayBuffer();
      if (a.group === 'voice') compressed[id] = raw; // 语音保留小体积 MP3，PCM 可被 LRU 淘汰后重解
    }
    try { return await decode(a, a.group === 'voice' ? raw.slice(0) : raw); }
    catch (e) { missing.add(id); e.missing = true; throw e; }
  })().finally(() => { delete decoding[id]; });
  return decoding[id];
}
/** 后台预取（不阻塞） */
export function prefetch(ids) { ids.forEach(id => ensureBuffer(id).catch(() => {})); }

/* ---------- 播放 ---------- */
function removeItem(it) { const i = active.indexOf(it); if (i !== -1) active.splice(i, 1); try { it.source.disconnect(); it.gain.disconnect(); } catch (_) {} }
function play(id, bus, opts = {}, done) {
  const buf = buffers[id];
  if (!buf || !canPlay()) { done && done(); return 0; }
  if (active.length >= 10) { const old = active.find(a => a.kind === 'sfx'); if (old) { try { old.source.stop(); } catch (_) {} old.finish(); } }
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf; src.playbackRate.value = clamp(opts.rate ?? 1, 0.25, 4);
  g.gain.value = clamp(opts.volume ?? 1, 0, 2); src.connect(g); g.connect(opts.pa ? paInput : bus);
  const it = { source: src, gain: g, id, kind: opts.kind || 'sfx' }; let ended = false;
  it.finish = () => { if (ended) return; ended = true; removeItem(it); done && done(); };
  src.onended = it.finish; active.push(it);
  src.start(ctx.currentTime + clamp(opts.delay || 0, 0, 10));
  log.played.push(id); if (log.played.length > 60) log.played.shift();
  return buf.duration / src.playbackRate.value;
}
function loop(id, parent) {
  const buf = buffers[id]; if (!buf) return null;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  g.gain.value = 0; src.buffer = buf; src.loop = true; src.connect(g); g.connect(parent); src.start();
  const it = { source: src, gain: g };
  src.onended = () => { const i = retired.indexOf(it); if (i !== -1) retired.splice(i, 1); try { src.disconnect(); g.disconnect(); } catch (_) {} };
  return it;
}
function retire(coll, name, now) {
  const it = coll[name]; if (!it) return; delete coll[name];
  if (!now) { retired.push(it); smooth(it.gain.gain, 0, 0.25); }
  try { it.source.stop(ctx.currentTime + (now ? 0 : 1.2)); } catch (_) {}
}
function stopBeds() {
  Object.keys(ambient).forEach(n => retire(ambient, n, true));
  Object.keys(loops).forEach(n => retire(loops, n, true));
  retired.splice(0).forEach(it => { try { it.source.stop(); } catch (_) {} });
}
const ZONE_LEVEL = { street: 0.35, concourse: 0.6, platform: 0.7, train: 0.85 };
function updateZone() {
  if (!canPlay()) return;
  Object.keys(ambient).forEach(n => { if (n !== zone) retire(ambient, n); });
  if (zone === 'none') return;
  const id = 'ambience.' + zone;
  if (ambient[zone]) { smooth(ambient[zone].gain.gain, ZONE_LEVEL[zone] ?? 0.6, 0.4); return; }
  const want = zone;
  ensureBuffer(id).then(() => {
    if (zone !== want || !canPlay() || ambient[want]) return;
    ambient[want] = loop(id, buses.ambience);
    if (ambient[want]) smooth(ambient[want].gain.gain, ZONE_LEVEL[want] ?? 0.6, 0.6);
  }).catch(e => log.errors.push(e.message));
}
/** 环境声区：'street' | 'concourse' | 'platform' | 'train' | 'none' */
export function setZone(z) { if (z !== zone) { zone = z; updateZone(); } }

function layer(name, target, rate) {
  if (!canPlay()) return;
  if (target <= 0) { retire(loops, name); return; }
  const id = 'train.' + name;
  if (!loops[name]) {
    if (!buffers[id]) { ensureBuffer(id).then(() => updateTrain(true)).catch(() => {}); return; }
    loops[name] = loop(id, trainFilter);
  }
  if (loops[name]) { smooth(loops[name].source.playbackRate, rate, 0.15); smooth(loops[name].gain.gain, target, 0.15); }
}
function updateTrain(force) {
  if (!canPlay()) return;
  if (!force && ctx.currentTime - lastTrainAt < 0.05) return;
  lastTrainAt = ctx.currentTime;
  const s = train.speed, moving = s > 0.006, body = train.inside ? 0.72 : 1;
  smooth(trainFilter.frequency, train.inside ? 2900 : 10500, 0.12);
  layer('motor', moving ? body * (0.13 + 0.49 * Math.sqrt(s)) * (train.braking ? 0.34 : 1) : 0, 0.42 + s * 1.65);
  layer('roll', moving ? body * (0.08 + 0.8 * s) : 0, 0.6 + s * 0.78);
  layer('joints', moving ? body * (0.12 + 0.3 * s) : 0, 0.28 + s * 1.85);
  layer('brake', train.braking && moving ? body * (0.2 + 0.38 * (1 - s)) : 0, 0.78 + s * 0.5);
}
/** 列车行驶声：每帧调用 {speed:0..1, inside, braking} */
export function trainSound(o) { train.speed = clamp(o.speed || 0, 0, 1); train.inside = o.inside !== false; train.braking = !!o.braking; updateTrain(false); }

/** 单次音效：name 为清单 id 或 sfx.xxx 的简写 */
export function sfx(name, opts = {}) {
  const id = assets[name] ? name : (name.indexOf('.') > 0 ? name : 'sfx.' + name);
  if (!canPlay()) return 0;
  const bus = id.startsWith('train.') ? buses.train : buses.sfx;
  if (buffers[id]) return play(id, bus, opts);
  ensureBuffer(id).then(() => { if (canPlay()) play(id, bus, opts); }).catch(e => log.errors.push(e.message));
  return assets[id] ? assets[id].duration : 0;
}
let stepIndex = 0;
export function footstep() { stepIndex = (stepIndex + 1) % 4; return sfx('sfx.footstep' + (stepIndex ? stepIndex + 1 : ''), { volume: 0.45, rate: 1.05 }); }

/** 合成的柔和提示音（机关咔哒、到达和弦），不需要素材文件 */
export function blip(kind = 'tick') {
  if (!canPlay()) return;
  const notes = { tick: [[880, 0.04, 0.05]], settle: [[660, 0.0, 0.25], [990, 0.07, 0.3]], goal: [[523, 0, .4], [659, .12, .4], [784, .24, .5], [1046, .36, .7]], nope: [[330, 0, .18]], tap: [[740, 0, .08]] }[kind] || [];
  const t0 = ctx.currentTime;
  for (const [f, d, len] of notes) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + d);
    g.gain.linearRampToValueAtTime(kind === 'tick' ? 0.12 : 0.22, t0 + d + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + d + len);
    o.connect(g); g.connect(buses.ui); o.start(t0 + d); o.stop(t0 + d + len + 0.05);
  }
}

/* ---------- 报站队列 ---------- */
function caption(a, extra) { emit('gz-audio-caption', a ? { id: a.id, text: a.text, lang: a.lang, channel: 'important', ...extra } : null); }
function sleep(ms, token) { return new Promise(r => { const t = setTimeout(r, ms); if (token) token.cancel = () => { clearTimeout(t); r(); }; }); }
let sleepToken = null;
function estimate(a) { return (a.duration || Math.max(1.5, (a.text || '').length * (a.lang === 'en' ? 0.07 : 0.24))) * 1000; }

/** 缺失片段的替代：VOICE_FALLBACK = 'webspeech'（浏览器朗读） | 'caption'（只显示字幕） */
async function fallbackClip(a, myEpoch) {
  log.fallbacks.push(a.id);
  const useSpeech = CONFIG.VOICE_FALLBACK === 'webspeech' && WebSpeech.available() && !muted && !background;
  caption(a, { silent: !useSpeech, fallback: CONFIG.VOICE_FALLBACK });
  if (useSpeech) {
    const spoken = await WebSpeech.speakClip(a.text, a.lang, estimate(a) + 4000);
    if (spoken) return;
  }
  sleepToken = {}; await sleep(estimate(a), sleepToken);
}
async function pump() {
  if (pumping) return;
  pumping = true; duck(true);
  try {
    while (queue.length) {
      const item = queue.shift(); current = item;
      if (item.epoch !== epoch) { item.resolve({ cancelled: true }); continue; }
      for (let i = 0; i < item.ids.length && item.epoch === epoch; i++) {
        const a = assets[item.ids[i]];
        if (!a) { log.errors.push('未知片段 ' + item.ids[i]); continue; }
        if (!canPlay() || muted) {
          // 未解锁/静音/后台：照样按时长显示字幕，保证游戏节奏一致
          caption(a, { silent: true }); sleepToken = {}; await sleep(estimate(a) + (i ? 220 : 70), sleepToken); continue;
        }
        let ok = true;
        try { await ensureBuffer(a.id); } catch (e) { ok = false; }
        if (item.epoch !== epoch) break;
        if (!ok) { await fallbackClip(a, item.epoch); continue; }
        caption(a);
        log.announced.push(a.id);
        await new Promise(res => { const d = play(a.id, buses.voice, { pa: true, volume: 1, delay: i ? 0.22 : 0.07, kind: 'voice' }, res); if (!d) res(); });
      }
      item.resolve({ cancelled: item.epoch !== epoch });
    }
  } finally { current = null; pumping = false; duck(false); caption(null); }
}
/** 串行播放一组片段 id（普通话→粤语→英语的顺序由调用方给出）。返回 Promise<{cancelled}> */
export function announceIds(ids, meta = {}) {
  return loadManifest().then(() => new Promise(resolve => {
    if (meta.interrupt) cancelAnnouncements();
    queue.push({ ids, resolve, epoch, key: meta.key });
    // 预取本组语音，减少段间停顿
    prefetch(ids);
    pump();
  }));
}
export function cancelAnnouncements() {
  epoch++;
  queue.splice(0).forEach(q => q.resolve({ cancelled: true }));
  active.slice().forEach(a => { if (a.kind === 'voice') { try { a.source.stop(); } catch (_) {} a.finish(); } });
  if (sleepToken && sleepToken.cancel) sleepToken.cancel();
  WebSpeech.cancel();
  if (ctx) resetPA();
  caption(null);
}
export function isAnnouncing() { return pumping || queue.length > 0; }

/* ---------- 解锁 / 生命周期 ---------- */
/** 必须在真实触摸事件里同步调用（iOS Safari） */
export function unlock() {
  try {
    context(); audioSession('playback');
    const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    s.connect(ctx.destination); s.onended = () => s.disconnect(); s.start(0);
    if (CONFIG.VOICE_FALLBACK === 'webspeech') WebSpeech.prime();
    const p = ctx.resume();
    loadManifest().catch(() => {});
    return p.then(() => {
      everUnlocked = ctx.state === 'running' || everUnlocked; needsGesture = ctx.state !== 'running';
      if (!needsGesture && !background) { updateZone(); updateTrain(true); }
      emit('gz-audio-state', { context: ctx.state, needsGesture, background });
      return !needsGesture;
    }).catch(e => { log.errors.push(String(e)); return false; });
  } catch (e) { log.errors.push(e.message); return Promise.resolve(false); }
}
function visible(v) {
  background = !v;
  if (!v) { cancelAnnouncements(); stopBeds(); needsGesture = true; audioSession('auto'); if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }
  else if (ctx && everUnlocked) {
    audioSession('playback');
    ctx.resume().then(() => { needsGesture = ctx.state !== 'running'; if (!needsGesture) { updateZone(); updateTrain(true); } }).catch(() => { needsGesture = true; });
  }
}
document.addEventListener('visibilitychange', () => visible(!document.hidden));
window.addEventListener('pagehide', () => visible(false));
window.addEventListener('pageshow', e => { if (e.persisted) visible(!document.hidden); });
['pointerdown', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, () => {
  if (ctx && everUnlocked && (needsGesture || ctx.state !== 'running') && !document.hidden) unlock();
}, { capture: true, passive: true }));

export function setMuted(v) { muted = !!v; applyMix(); if (muted) WebSpeech.cancel(); }
export function isMuted() { return muted; }
export function getManifest() { return manifest; }
export function getAsset(id) { return assets[id]; }
export function getState() {
  return {
    context: ctx ? ctx.state : 'uninitialized', unlocked: everUnlocked && !!ctx && ctx.state === 'running', needsGesture, background, muted,
    zone, ducked, announcing: current ? current.key : null, queued: queue.length, active: active.length,
    decoded: Object.keys(buffers).length, missing: [...missing], voiceCacheBytes: voiceBytes,
    sampleRate: ctx ? ctx.sampleRate : null, fallbackMode: CONFIG.VOICE_FALLBACK,
    log: { played: log.played.slice(), announced: log.announced.slice(), fallbacks: log.fallbacks.slice(), errors: log.errors.slice() }
  };
}
