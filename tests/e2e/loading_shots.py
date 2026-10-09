# 加载画面截图（约 10% / 50% / 90%，横屏 + 竖屏）：
#   python3 tests/e2e/loading_shots.py 'http://localhost:8123/' /workspace/gz-shots-polish/after
#   第三个参数可改进度点：... /workspace/gz-shots-polish/live-r4 0.20,0.50,0.85
# 用 CDP 限速（约 1.2 MB/s）模拟较慢的网络，让引擎下载阶段也能截到；
# 再把 js/world/station.js 和贴图各推迟几秒返回，让“启动游戏（约 48%）”“准备贴图（约 90%）”两段主线程空闲、能截到真实画面。软件渲染。
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-3d/'
OUT = OUT.rstrip('/') + '/'
# 第三个参数：截图进度点（逗号分隔），默认 0.10,0.45,0.85
TS = tuple(float(x) for x in sys.argv[3].split(',')) if len(sys.argv) > 3 else (0.10, 0.45, 0.85)
os.makedirs(OUT, exist_ok=True)
async def run(p, name, w, h):
    b = await p.chromium.launch(args=ARGS)
    ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg = await ctx.new_page(); cdp = await ctx.new_cdp_session(pg)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 60, 'downloadThroughput': 1200 * 1024, 'uploadThroughput': 500 * 1024})
    async def delayed(route, ms):
        await asyncio.sleep(ms / 1000); await route.continue_()
    await pg.route('**/js/world/station.js', lambda r: asyncio.ensure_future(delayed(r, 5000)))
    await pg.route('**/assets/tex/*', lambda r: asyncio.ensure_future(delayed(r, 6000)))
    await pg.goto(URL, wait_until='commit')
    got = {}
    for _ in range(2400):
        try: f = await pg.evaluate('window.__loadUI ? window.__loadUI.get() : 0')
        except Exception: f = 0
        for t in TS:
            if t not in got and f >= t and f < min(0.99, t + 0.1):
                if not await pg.evaluate('!!document.getElementById("loadStation") && !document.querySelector("#loading.done")'): continue
                path = f'{OUT}load-{name}-{round(f*100):02d}pct.png'
                txt = await pg.evaluate('[document.getElementById("loadStation").textContent, document.getElementById("loadMsg").textContent, document.getElementById("loadFact").textContent]')
                await pg.screenshot(path=path, timeout=120000)
                got[t] = (round(f, 3), path, txt); print(name, t, got[t])
        if await pg.evaluate('!!window.__game'): break
        await asyncio.sleep(0.1)
    await b.close()
    return got
async def run_err(p):
    # 出错路径：?bjs=none 让来源列表为空，直接走失败提示（检查文案不含来源名 / 计数）
    b = await p.chromium.launch(args=ARGS)
    pg = await (await b.new_context(viewport={'width': 1112, 'height': 834}, device_scale_factor=2, has_touch=True, is_mobile=True)).new_page()
    await pg.goto(URL + ('&' if '?' in URL else '?') + 'bjs=none')
    await pg.wait_for_selector('#loading.err', timeout=30000); await asyncio.sleep(0.5)
    txt = await pg.evaluate('document.getElementById("loadMsg").textContent')
    await pg.screenshot(path=OUT + 'load-landscape-error.png'); print('error', txt)
    await b.close()
async def main():
    async with async_playwright() as p:
        await run(p, 'landscape', 1112, 834)
        await run(p, 'portrait', 834, 1112)
        await run_err(p)
asyncio.run(main())
