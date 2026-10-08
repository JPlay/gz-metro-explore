// requestAnimationFrame 主循环；dt 限幅，后台切回来不会“跳帧”。
export function startLoop(tick) {
  let last = performance.now(), running = true;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    tick(dt, now / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { last = performance.now(); });
  return { stop() { running = false; } };
}
