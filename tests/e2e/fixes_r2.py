# 评审 r2 三个小修快速检查：python3 tests/e2e/fixes_r2.py <url> <截图目录>
#  (a) 坐下后“跳”按钮隐藏、起身后回来；(b) 门上线路图左端“1号线”色块不被立柱挡（重拍 3a）；(c) 线路图类动态贴图的显存（宽×高×4×mip 4/3）
import asyncio, sys, os, json, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/?q=2&start=gyq&line=1'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-3d/').rstrip('/') + '/'
os.makedirs(OUT, exist_ok=True); T0 = time.time(); R = {}
def log(*a): print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)
async def shot(pg, name): await pg.screenshot(path=OUT + name + '.png', timeout=180000); log('shot', name)
async def until(pg, js, t=120):
    for _ in range(int(t / 0.25)):
        if await pg.evaluate(js): return True
        await asyncio.sleep(0.25)
    return False
SLOT = "__game.metro.slots.find(s=>s.line==1&&s.step==1)"
TEXMEM = """(()=>{const out={}; for (const t of __game.scene.textures) { const n=t.name||''; const m=n.match(/^(wallMap|strip|map|signs|hotGlow)/); if(!m) continue;
  const s=t.getSize(), mip=t.noMipmap===false || (t._texture && t._texture.generateMipMaps); const b=s.width*s.height*4*(mip?4/3:1);
  (out[m[1]]=out[m[1]]||{n:0,w:s.width,h:s.height,mip:!!mip,MB:0}); out[m[1]].n++; out[m[1]].MB=+(out[m[1]].MB+b/1048576).toFixed(2);} return out;})()"""
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL)
    await asyncio.sleep(1.5); await pg.touchscreen.tap(1112 * 0.7, 834 * 0.4); await pg.evaluate('__game.setDtMax(0.25)'); log('loaded')
    await pg.evaluate('__game.call(1,1)')
    await until(pg, SLOT + ".state=='dwell'", 200); await pg.evaluate(SLOT + '.t = 1e4'); log('dwell')
    if await pg.evaluate("__game.player.view") != 'first': await pg.evaluate('__game.toggleView()')
    await pg.evaluate(f"(()=>{{const r={SLOT}.train.root.position; __game.teleport(r.x-0.9, r.y+0.02, r.z+0.95, 2.77); __game.player.pitch=-0.30;}})()")
    await asyncio.sleep(1.2); await shot(pg, '3a-car-route-map-r2')
    # 坐下：选一个空座位
    await pg.evaluate(f"""(()=>{{const t={SLOT}.train, r=t.root.position; const s=t.seats.filter(s=>s.free&&s.sd>0).sort((a,b)=>Math.abs(a.x-1.6)-Math.abs(b.x-1.6))[0];
      __game.teleport(r.x+s.x, r.y+0.02, r.z+s.sd*0.62, 0);}})()""")
    R['actSit'] = await until(pg, "(__game.state().act||{}).id=='sit'", 20)
    R['jumpVisibleBefore'] = await pg.evaluate("!document.getElementById('bJump').hidden")
    await pg.evaluate('__game.act()'); await until(pg, '__game.state().seat.seated', 10); await asyncio.sleep(0.6)
    R['jumpHiddenSeated'] = await pg.evaluate("document.getElementById('bJump').hidden")
    if await pg.evaluate("__game.player.view") == 'first': await pg.evaluate('__game.toggleView()')
    await pg.evaluate('__game.player.yaw=__game.player.facing+Math.PI-0.5; __game.player.pitch=0.15; __game.player.dist=3.2'); await asyncio.sleep(1.5)
    await shot(pg, '5-seated-no-jump-button')
    await pg.evaluate('__game.act()')
    R['jumpBackAfterStand'] = await until(pg, "!document.getElementById('bJump').hidden && !__game.state().seat.seated", 15)
    R['texTrain'] = await pg.evaluate(TEXMEM); R['trains'] = await pg.evaluate('__game.metro.trains.length')
    R['errors'] = errs(logs)
    print(json.dumps(R, ensure_ascii=False, indent=1), flush=True)
    chk = {k: bool(R.get(k)) for k in ['actSit', 'jumpVisibleBefore', 'jumpHiddenSeated', 'jumpBackAfterStand']}; chk['noErrors'] = not R['errors']
    print('CHECKS', chk, 'PASS' if all(chk.values()) else 'FAIL', flush=True)
    await b.close()
asyncio.run(main())
