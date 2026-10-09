# 买票 / 刷卡进站：python3 tests/e2e/ticket.py <url> [截图目录] [w] [h]
# 检查：没票刷不开闸机（屏幕红叉 + “先去买票哦”提示、走不过去）→ 售票机买单程票（选站→投币→出票→进背包）→ 刷票进站 → 出站时单程票被回收；羊城通模式。
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from common import *
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/?q=2'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-3d/').rstrip('/') + '/'
W = int(sys.argv[3]) if len(sys.argv) > 3 else 1112; H = int(sys.argv[4]) if len(sys.argv) > 4 else 834
TAG = '' if W > H else '-portrait'
PART = os.environ.get('PART', 'all')   # all | tvm（只跑售票机面板，截竖屏图时用）
os.makedirs(OUT, exist_ok=True)
R = {}
async def shot(pg, name):
    await pg.screenshot(path=OUT + name + TAG + '.png', timeout=180000); print('shot', name + TAG, flush=True)
async def tap(pg, sel):
    box = await pg.locator(sel).first.bounding_box()
    await pg.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2); return box
async def until(pg, js, t=60):
    for _ in range(int(t / 0.25)):
        if await pg.evaluate(js): return True
        await asyncio.sleep(0.25)
    return False
async def walk(pg, pts):
    return (await pg.evaluate(f'__game.autopilot({json.dumps(pts)}, false)'))['ok']
async def freeze(pg, ms):
    # 把面板里正在跑的 CSS / WAAPI 动画都停在 ms 毫秒处（截图时软件渲染很慢，动画不能自己跑）
    await pg.evaluate(f"document.getAnimations().forEach(a=>{{a.pause(); a.currentTime={ms};}})")
async def gate_fail(pg, R):
    T = '__game.state().ticket'
    await pg.evaluate('__game.teleport(0,-5.95,-6,0); __game.player.pitch=0.18'); await asyncio.sleep(0.5)
    await walk(pg, [[0, -3.5]]); await until(pg, "(__game.state().act||{}).id=='tapIn'", 20)
    R['actNoTicket'] = (await st(pg))['act']
    await tap(pg, '#bAct'); await asyncio.sleep(0.6)
    s = await st(pg); R['refused'] = s['ticket']['refused']; R['hintShown'] = await pg.evaluate("!document.getElementById('hint').hidden")
    R['gateClosedNoTicket'] = max(s['gates']) < 0.1
    await asyncio.sleep(0.6); await shot(pg, '1d-gate-no-ticket')
    # 试着硬闯：应该被闸机挡住
    await walk(pg, [[0, 0.5]]); s = await st(pg); R['blockedZ'] = s['pos'][2]; R['cantPassWithoutTicket'] = s['pos'][2] < -2.2
async def buy(pg, R):
    T = '__game.state().ticket'
    # 2) 售票机：走到中间那台前面
    await walk(pg, [[-3, -8], [-7.4, -7.6]]); await pg.evaluate('__game.player.yaw=0; __game.player.pitch=0.12; __game.player.dist=3.2'); await asyncio.sleep(0.4)
    await until(pg, "(__game.state().act||{}).id=='buy'", 20); R['actBuy'] = (await st(pg))['act']
    await shot(pg, '1a-tvm-walkup')
    await tap(pg, '#bAct'); await until(pg, T + '.panel.open', 10); await asyncio.sleep(0.5); await freeze(pg, 400)
    await shot(pg, '1b-tvm-pick')
    await tap(pg, '#tvm .st[data-code="njs"] .hit'); await asyncio.sleep(0.3); await freeze(pg, 500)
    s = await st(pg); R['sel'] = s['ticket']['panel']['sel']; R['fare'] = s['ticket']['panel']['fare']
    await shot(pg, '1c-tvm-selected')
    await tap(pg, '#tvm .go'); await until(pg, T + ".panel.step=='pay'", 10)
    await tap(pg, '#tvm .coin1'); await until(pg, T + '.panel.paid>=1', 10); await asyncio.sleep(0.2)
    # 第二枚硬币：飞在半空时截图
    await pg.evaluate("window.__tvmHold=1"); await tap(pg, '#tvm .coin1'); await asyncio.sleep(0.05)
    await pg.evaluate("document.querySelectorAll('.flymoney').forEach(f=>f.getAnimations().forEach(a=>{a.pause(); a.currentTime=300;}))")
    await shot(pg, '1e-tvm-insert-coin')
    await pg.evaluate("document.querySelectorAll('.flymoney').forEach(f=>f.getAnimations().forEach(a=>a.play()))")
    await until(pg, T + ".panel.step=='drop'", 15)
    # 出票动画：停掉面板自己的计时器，手动一帧一帧摆
    await pg.evaluate("(()=>{const P=__game.tickets.panel; P.timers.forEach(clearTimeout); P.timers=[];})()")
    await pg.evaluate("document.querySelector('#tvm .drop').classList.add('dropping')"); await freeze(pg, 330)
    await shot(pg, '1f-token-falling')
    await pg.evaluate("__game.tickets.panel.landed()")   # 票落进取票槽：标题变“出票成功”
    await freeze(pg, 650); await shot(pg, '1g-token-bounce')
    await pg.evaluate("document.querySelector('#tvm .drop').classList.add('shining')"); await freeze(pg, 0)
    await pg.evaluate("document.querySelectorAll('#tvm .tokwrap .glint, #tvm .tokwrap').forEach(e=>e.getAnimations({subtree:true}).forEach(a=>{a.pause(); a.currentTime = a.animationName=='tokDrop'?1150: 360;}))")
    await pg.evaluate("document.querySelectorAll('#tvm .tok').forEach(e=>e.getAnimations().forEach(a=>{a.pause(); a.currentTime=360;}))")
    await shot(pg, '1h-token-glint')
    await pg.evaluate("__game.tickets.panel.flyToken()"); await asyncio.sleep(0.05)
    await pg.evaluate("document.querySelectorAll('.flyitem').forEach(f=>f.getAnimations().forEach(a=>{a.pause(); a.currentTime=420;}))")
    await shot(pg, '1i-token-fly-to-hud')
    await pg.evaluate("document.querySelectorAll('.flyitem').forEach(f=>f.getAnimations().forEach(a=>a.play()))")
    await until(pg, '!' + T + '.panel.open', 10); await asyncio.sleep(1.0)
    s = await st(pg); R['inv'] = s['ticket']['inv']; R['chip'] = await pg.evaluate("!document.getElementById('inv').hidden && !!document.querySelector('#inv .tok')")
async def gate_ok(pg, R):
    T = '__game.state().ticket'
    # 3) 刷票进站
    await walk(pg, [[-7.4, -8.2], [-4, -8.2], [0, -3.6]]); await pg.evaluate('__game.player.yaw=0; __game.player.pitch=0.18; __game.player.dist=4.2')
    await until(pg, "(__game.state().act||{}).id=='tapIn'", 20); R['actWithTicket'] = (await st(pg))['act']
    await tap(pg, '#bAct'); await until(pg, 'Math.max(...__game.state().gates)>0.8', 20); await asyncio.sleep(0.3)
    await shot(pg, '1j-gate-tap-ok')
    ok = await walk(pg, [[0, 1.5]]); s = await st(pg); R['passedWithTicket'] = ok and s['pos'][2] > 0; R['entered'] = s['ticket']['inv'] and s['ticket']['inv']['entered']
    # 4) 出站：单程票投进回收口
    await asyncio.sleep(1.5); await pg.evaluate('__game.player.yaw=Math.PI')
    await walk(pg, [[0, -0.4]]); await until(pg, "(__game.state().act||{}).id=='tapOut'", 20); R['actOut'] = (await st(pg))['act']
    await tap(pg, '#bAct'); await until(pg, 'Math.max(...__game.state().gates)>0.8', 20)
    ok = await walk(pg, [[0, -4.5]]); s = await st(pg); R['exitedAndTokenReturned'] = ok and s['ticket']['inv'] is None
    # 5) 羊城通
    await walk(pg, [[-3, -8], [-7.4, -7.6]]); await pg.evaluate('__game.player.yaw=0'); await until(pg, "(__game.state().act||{}).id=='buy'", 20)
    await tap(pg, '#bAct'); await until(pg, T + '.panel.open', 10); await tap(pg, '#tvm .seg button[data-v="card"]'); await asyncio.sleep(0.4); await freeze(pg, 300)
    await shot(pg, '1k-tvm-card-mode')
    await tap(pg, '#tvm .go'); await until(pg, '!' + T + '.panel.open', 10); await asyncio.sleep(1)
    R['card'] = (await st(pg))['ticket']['inv']
    await shot(pg, '1l-hud-card-chip')
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL, w=W, h=H)
    await asyncio.sleep(1.5); await pg.touchscreen.tap(W * 0.7, H * 0.4)
    T = '__game.state().ticket'
    # 1) 没票：走到中间通道前，按“刷卡/刷票”
    if PART == 'tvm': await pg.evaluate('__game.teleport(-7.4,-5.95,-8.2,0)'); await asyncio.sleep(0.5)
    else: await gate_fail(pg, R)
    await buy(pg, R)
    if PART == 'tvm':
        print(json.dumps(R, ensure_ascii=False, default=str)); await b.close(); return
    await gate_ok(pg, R)
    R['errors'] = errs(logs)
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    if PART != 'all': return
    chk = {k: bool(R.get(k)) for k in ['refused', 'hintShown', 'gateClosedNoTicket', 'cantPassWithoutTicket', 'chip', 'passedWithTicket', 'entered', 'exitedAndTokenReturned']}
    chk['boughtToken'] = bool(R['inv']) and R['inv']['kind'] == 'token' and R['inv']['to'] == 'njs'
    chk['card'] = bool(R['card']) and R['card']['kind'] == 'card'
    chk['noErrors'] = not R['errors']
    print('CHECKS', chk, 'PASS' if all(chk.values()) else 'FAIL', flush=True)
    await b.close()
asyncio.run(main())
