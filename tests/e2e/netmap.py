# 全网线路图：python3 tests/e2e/netmap.py <url> <截图目录> [w] [h]
# HUD 右上角「地图」按钮 → 全屏 SVG（1、2 号线 40 站、换乘双色环、当前站脉动“你在这里”）→ 关闭；
# 横屏时再看站厅西墙上的大幅线路图（贴图异步画好 = station.wallMap.ready）。
import asyncio, sys, os, json, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/?q=2'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-3d/').rstrip('/') + '/'
W = int(sys.argv[3]) if len(sys.argv) > 3 else 1112; H = int(sys.argv[4]) if len(sys.argv) > 4 else 834
TAG = ('landscape' if W > H else 'portrait') + os.environ.get('SUFFIX', '')
os.makedirs(OUT, exist_ok=True); T0 = time.time(); R = {}
def log(*a): print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)
async def shot(pg, name): await pg.screenshot(path=OUT + name + '.png', timeout=180000); log('shot', name)
async def tap(pg, sel):
    box = await pg.locator(sel).first.bounding_box()
    await pg.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2); return box
async def until(pg, js, t=60):
    for _ in range(int(t / 0.25)):
        if await pg.evaluate(js): return True
        await asyncio.sleep(0.25)
    return False
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL, w=W, h=H)
    await asyncio.sleep(1.5); await pg.touchscreen.tap(W * 0.7, H * 0.4); log('loaded')
    # 右上角按钮：一排、不重叠、不出屏
    R['btns'] = await pg.evaluate("[...document.querySelectorAll('#btns .btn')].map(b=>{const r=b.getBoundingClientRect(); return [b.id, Math.round(r.left), Math.round(r.top), Math.round(r.width)];})")
    R['where'] = await pg.evaluate("(()=>{const r=document.getElementById('where').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)];})()")
    await tap(pg, '#bMap'); await until(pg, '__game.state().mapOpen && !document.getElementById("netmap").hidden', 10); await asyncio.sleep(0.5)
    R['map'] = await pg.evaluate("""(()=>{const s=document.querySelector('#netmap .mapbox svg'), t=[...s.querySelectorAll('text')].map(e=>e.textContent), r=s.getBoundingClientRect();
      return {texts: t.length, hasHere: t.includes('你在这里'), pulse: !!s.querySelector('.pulse'), box: [Math.round(r.width), Math.round(r.height)], polylines: [...s.querySelectorAll('polyline')].map(p=>p.getAttribute('stroke'))};})()""")
    R['stationsOnMap'] = await pg.evaluate("""(async()=>{const {LINES, STATIONS} = await import('/js/data/lines.js'); const t=[...document.querySelectorAll('#netmap .mapbox svg text')].map(e=>e.textContent);
      const all=[...new Set([...LINES[1].stations, ...LINES[2].stations])]; return {n: all.length, missing: all.filter(c=>!t.includes(STATIONS[c].zh))};})()""")
    await pg.evaluate("document.getAnimations().forEach(a=>{a.pause(); a.currentTime=500;})")
    await shot(pg, f'4-hud-map-{TAG}')
    # 竖屏铺满宽度：地图 svg 宽度 ≥ 视口 90%；换乘站图例两行
    R['fillW'] = R['map']['box'][0] / W
    R['legend'] = await pg.evaluate("[...document.querySelectorAll('#netmap svg text')].map(e=>e.textContent).filter(t=>t.includes('换乘'))")
    # 双指捏合放大（CDP 真触摸）+ 单指拖动
    # 双指捏合放大 + 单指拖动（直接派发 PointerEvent：CDP 触摸在软件渲染下会卡住）
    R['zoom'] = await pg.evaluate("""(()=>{const box=document.querySelector('#netmap .mapbox'), r=box.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height*0.42;
      const ev=(t,id,x,y)=>box.dispatchEvent(new PointerEvent(t,{pointerId:id,clientX:x,clientY:y,bubbles:true,pointerType:'touch',isPrimary:id===1}));
      ev('pointerdown',1,cx-40,cy); ev('pointerdown',2,cx+40,cy); for(let k=1;k<=8;k++){ev('pointermove',1,cx-40-k*22,cy); ev('pointermove',2,cx+40+k*22,cy);} ev('pointerup',1,cx-216,cy); ev('pointerup',2,cx+216,cy);
      return __game.mapZoom.scale;})()""")
    await asyncio.sleep(0.5)
    await pg.evaluate("""(()=>{const box=document.querySelector('#netmap .mapbox'), r=box.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height*0.42;
      const ev=(t,id,x,y)=>box.dispatchEvent(new PointerEvent(t,{pointerId:id,clientX:x,clientY:y,bubbles:true,pointerType:'touch',isPrimary:true}));
      ev('pointerdown',3,cx,cy); for(let k=1;k<=5;k++) ev('pointermove',3,cx,cy+k*20); ev('pointerup',3,cx,cy+100);})()""")
    R['panT'] = await pg.evaluate("document.querySelector('#netmap .mapbox svg').style.transform")
    await shot(pg, f'4-hud-map-{TAG}-zoomed')
    R['stillOpen'] = await pg.evaluate('__game.state().mapOpen')
    await pg.evaluate('__game.mapZoom.reset()')
    await tap(pg, '#netmap .x'); await asyncio.sleep(0.6); R['closed'] = await pg.evaluate('!__game.state().mapOpen')
    await asyncio.sleep(0.4); await shot(pg, f'4-hud-buttons-{TAG}')
    if W > H:
        # 站厅西墙的大幅线路图（x = -17.9，z ≈ 1.2）
        if await pg.evaluate("__game.player.view") != 'first': await pg.evaluate('__game.toggleView()')
        await pg.evaluate('__game.teleport(-10.2,-5.95,1.2,-Math.PI/2); __game.player.pitch=-0.12')
        R['wallReady'] = await until(pg, '__game.station.wallMap && __game.station.wallMap.ready', 30); await asyncio.sleep(1.0)
        await shot(pg, '4-concourse-wall-map')
        if os.environ.get('CLOSE'):
            await pg.evaluate('__game.teleport(-15.3,-5.95,1.2,-Math.PI/2); __game.player.pitch=-0.12'); await asyncio.sleep(1.2)
            await shot(pg, '4-concourse-wall-map-close')
    R['errors'] = errs(logs)
    print(json.dumps(R, ensure_ascii=False, indent=1), flush=True)
    bx = R['btns']; tidy = all(bx[i][1] + bx[i][3] <= bx[i + 1][1] for i in range(len(bx) - 1)) and bx[-1][1] + bx[-1][3] <= W and len({t for _, _, t, _ in bx}) == 1 and R['where'][1] < bx[0][1]
    chk = {'threeBtnsTidy': len(bx) == 3 and tidy, 'allStations': R['stationsOnMap']['n'] == 39 and not R['stationsOnMap']['missing'], 'here': R['map']['hasHere'] and R['map']['pulse'],
           'lineColours': R['map']['polylines'] == ['#F3D03E', '#00629B'], 'closed': R['closed'], 'noErrors': not R['errors'], 'zoomed': R['zoom'] > 1.5 and R['stillOpen'] and 'scale(4)' in R['panT'] and 'translate(0px, 0px)' not in R['panT'], 'legend': len(R['legend']) == 2}
    if H > W: chk['fillsWidth'] = R['fillW'] > 0.9
    if W > H: chk['wallMap'] = R['wallReady']
    print('CHECKS', chk, 'PASS' if all(chk.values()) else 'FAIL', flush=True)
    await b.close()
asyncio.run(main())
