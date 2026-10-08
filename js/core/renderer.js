import * as THREE from 'three';
import { CONFIG } from './config.js';

/**
 * WebGL 渲染器 + 自适应画质。
 * A12（iPad Air 3）：起步 min(dpr, 2)，每 2.5 秒统计平均帧率，低于 48fps 就降一档
 * （2 → 1.5 → 1.25 关阴影 → 1）。只降不升，避免来回抖动。
 */
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // 只在机关移动/换场景时更新阴影
  const deviceDpr = Math.min(window.devicePixelRatio || 1, CONFIG.dprMax);
  const levels = CONFIG.qualityLevels.map(l => ({ ...l, dpr: Math.min(l.dpr, deviceDpr) }));
  let level = CONFIG.fixedQuality ?? 0;
  let acc = 0, frames = 0, worst = 0;
  const listeners = [];
  const stats = { fps: 60, level, dpr: levels[level].dpr, shadows: levels[level].shadows, history: [] };

  function apply() {
    const q = levels[level];
    renderer.setPixelRatio(q.dpr);
    renderer.shadowMap.enabled = q.shadows;
    renderer.shadowMap.needsUpdate = true;
    stats.level = level; stats.dpr = q.dpr; stats.shadows = q.shadows;
    resize();
    listeners.forEach(fn => fn(q));
  }
  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
  }
  function sample(dt) {
    acc += dt; frames++; worst = Math.max(worst, dt);
    if (acc >= 2.5) {
      const fps = frames / acc;
      stats.fps = Math.round(fps); stats.history.push(stats.fps); if (stats.history.length > 20) stats.history.shift();
      if (CONFIG.fixedQuality == null && fps < 48 && level < levels.length - 1 && !document.hidden) { level++; apply(); }
      acc = 0; frames = 0; worst = 0;
    }
  }
  window.addEventListener('resize', resize);
  apply();
  return {
    renderer, stats, resize, sample,
    onQuality(fn) { listeners.push(fn); },
    get quality() { return levels[level]; },
    requestShadowUpdate() { renderer.shadowMap.needsUpdate = true; }
  };
}
