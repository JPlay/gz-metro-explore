// 轻量补间：所有移动都走缓动，避免生硬跳变。
export const Ease = {
  linear: t => t,
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: t => Math.sin(t * Math.PI / 2),
  inSine: t => 1 - Math.cos(t * Math.PI / 2),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outBack: t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outQuint: t => 1 - Math.pow(1 - t, 5)
};

const active = [];

/**
 * tween(duration秒, onUpdate(k, t), {ease, delay, owner}) → Promise（附带 cancel()）
 * owner 用于场景退出时一次性取消：cancelOwner(scene)。
 */
export function tween(duration, onUpdate, opts = {}) {
  let resolve;
  const p = new Promise(r => (resolve = r));
  const item = { t: -(opts.delay || 0), d: Math.max(1e-4, duration), fn: onUpdate, ease: opts.ease || Ease.inOutSine, owner: opts.owner, resolve, done: false };
  active.push(item);
  p.cancel = () => { if (!item.done) { item.done = true; resolve(false); } };
  return p;
}

export function wait(seconds, owner) { return tween(seconds, () => {}, { owner, ease: Ease.linear }); }

export function cancelOwner(owner) {
  for (const it of active) if (it.owner === owner && !it.done) { it.done = true; it.resolve(false); }
}

export function updateTweens(dt) {
  for (let i = 0; i < active.length; i++) {
    const it = active[i];
    if (it.done) continue;
    it.t += dt;
    if (it.t < 0) continue;
    const t = Math.min(1, it.t / it.d);
    it.fn(it.ease(t), t);
    if (t >= 1) { it.done = true; it.resolve(true); }
  }
  for (let i = active.length - 1; i >= 0; i--) if (active[i].done) active.splice(i, 1);
}

export function damp(current, target, lambda, dt) { return current + (target - current) * (1 - Math.exp(-lambda * dt)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
