# 加载耗时：python3 tests/e2e/loadtime.py 'http://localhost:8123/?bjs=vendor' [次数]
# 打印 window.__loadT 各阶段（毫秒，相对导航开始）和加载条/文字的变化时间线。无头 Chromium 是软件渲染（SwiftShader），比 iPad 慢得多。
import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__file__))
from common import *
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/?bjs=vendor'
N = int(sys.argv[2]) if len(sys.argv) > 2 else 1
INIT = """
window.__loadLog = [];
new MutationObserver(() => {
  const b = document.getElementById('loadBar'), m = document.getElementById('loadMsg');
  if (!b || !m) return; const e = [Math.round(performance.now()), b.style.width, m.textContent], l = window.__loadLog[window.__loadLog.length - 1];
  if (!l || l[1] !== e[1] || l[2] !== e[2]) window.__loadLog.push(e);
}).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
"""
async def once(p):
    b = await p.chromium.launch(args=ARGS)
    ctx = await b.new_context(viewport={'width': 1112, 'height': 834}, device_scale_factor=2, has_touch=True, is_mobile=True)
    await ctx.add_init_script(INIT)
    pg = await ctx.new_page(); logs = []
    pg.on('console', lambda m: logs.append((m.type, m.text))); pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
    await pg.goto(URL)
    await pg.wait_for_function('window.__loadT && window.__loadT.frame30', timeout=180000, polling=250)
    t = await pg.evaluate('window.__loadT'); log = await pg.evaluate('window.__loadLog'); s = await st(pg)
    await b.close()
    return t, log, s, errs(logs)
async def main():
    async with async_playwright() as p:
        for i in range(N):
            t, log, s, e = await once(p)
            order = sorted(t.items(), key=lambda kv: kv[1])
            print('RUN', i + 1, 'tier', s['tier'], 'probes', s['probes'], 'errs', e[:3])
            prev = 0
            for k, v in order: print(f'  {k:10s} {v:7d} ms  (+{v - prev})'); prev = v
            print('  timeline', json.dumps(log, ensure_ascii=False))
asyncio.run(main())
