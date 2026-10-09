# 售票 UI 小修（评审 r1）的快速检查 + 截图：python3 tests/e2e/ticket_ui.py <url> <截图目录> [w] [h] [后缀]
# 不走完整旅程：传送到闸机前 / 售票机前，直接摆状态。
#   1d 没票刷闸机：提示箭头按售票机相对镜头的方向转（售票机在身后 → 箭头朝下、“售票机在你身后”）
#   1b/1c 选站：选中站用单程票青绿色圈 + 名字底色，和红色“你在这里”区分
#   1g/1h 出票后标题“出票成功”；1k 羊城通说明不把“下”字单独挤到第二行
import asyncio, sys, os, json, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/?q=2'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-3d/').rstrip('/') + '/'
W = int(sys.argv[3]) if len(sys.argv) > 3 else 1112; H = int(sys.argv[4]) if len(sys.argv) > 4 else 834
SUF = sys.argv[5] if len(sys.argv) > 5 else '-v2'
TAG = '' if W > H else '-portrait'
ONLY = os.environ.get('ONLY', 'all')   # all | card（竖屏只截羊城通）
os.makedirs(OUT, exist_ok=True)
T0 = time.time(); R = {}
def log(*a): print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)
async def shot(pg, name):
    await pg.screenshot(path=OUT + name + TAG + SUF + '.png', timeout=180000); log('shot', name + TAG + SUF)
async def tap(pg, sel):
    box = await pg.locator(sel).first.bounding_box()
    await pg.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
async def until(pg, js, t=60):
    for _ in range(int(t / 0.25)):
        if await pg.evaluate(js): return True
        await asyncio.sleep(0.25)
    return False
async def freeze(pg, ms): await pg.evaluate(f"document.getAnimations().forEach(a=>{{a.pause(); a.currentTime={ms};}})")
P = '__game.tickets.panel'
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL, w=W, h=H)
    await asyncio.sleep(1.5); await pg.touchscreen.tap(W * 0.7, H * 0.4); await pg.evaluate('__game.setDtMax(0.25)'); log('loaded')
    if ONLY in ('all', 'hint'):
        # 1d：闸机前按刷卡 → 提示 + 箭头。先面向闸机（售票机在左后方），再转身背对售票机（售票机在正后方）
        await pg.evaluate('__game.teleport(0,-5.95,-3.6,0); __game.player.pitch=0.18; __game.player.dist=4.2')
        await until(pg, "(__game.state().act||{}).id=='tapIn'", 30); await tap(pg, '#bAct')
        await until(pg, "!document.getElementById('hint').hidden", 10); await pg.evaluate('__game.tickets.hintT = 1e4'); await asyncio.sleep(1.0)
        HJ = "({txt: document.querySelector('#hint .dir').textContent, rot: document.querySelector('#hint .arr').style.transform})"
        R['hintFacingGate'] = await pg.evaluate(HJ)
        await pg.evaluate("document.getAnimations().forEach(a=>{try{a.finish()}catch(e){}})"); await shot(pg, '1d-gate-no-ticket-left')
        # 背对中间那台售票机：箭头应该朝下（在你身后），每帧跟着镜头转
        await pg.evaluate('(()=>{const p=__game.player.position; __game.player.yaw=Math.atan2(p.x-(-7.4), p.z-(-7.35)); __game.player.pitch=0.12; __game.player.dist=3.6;})()'); await asyncio.sleep(1.5)
        R['hintBehind'] = await pg.evaluate(HJ)
        await shot(pg, '1d-gate-no-ticket')
        await pg.evaluate('__game.tickets.hintT = 0.01'); await asyncio.sleep(0.5)
    if ONLY == 'hint':
        print(json.dumps(R, ensure_ascii=False, indent=1), flush=True); await b.close(); return
    # 售票机
    await pg.evaluate('__game.teleport(-7.4,-5.95,-7.6,0); __game.player.pitch=0.12'); await until(pg, "(__game.state().act||{}).id=='buy'", 30)
    await tap(pg, '#bAct'); await until(pg, P + '.isOpen', 10); await asyncio.sleep(0.4)
    if ONLY == 'all':
        await freeze(pg, 400); await shot(pg, '1b-tvm-pick')
        await tap(pg, '#tvm .st[data-code="njs"] .hit'); await asyncio.sleep(0.3); await freeze(pg, 500)
        R['sel'] = await pg.evaluate(P + '.sel'); R['selRing'] = await pg.evaluate("document.querySelector('#tvm .st.sel .dot').getAttribute('stroke')")
        await shot(pg, '1c-tvm-selected')
        # 直接摆到出票（投币动画已有 1e，不重复）
        await pg.evaluate(f"(()=>{{const T={P}; T.paid=T.fare; T.step='drop'; T.render(); T.timers.forEach(clearTimeout); T.timers=[];}})()")
        R['titleBefore'] = await pg.evaluate("document.querySelector('#tvm .scr').textContent")
        await pg.evaluate("document.querySelector('#tvm .drop').classList.add('dropping')"); await pg.evaluate(P + '.landed()')
        R['titleAfter'] = await pg.evaluate("document.querySelector('#tvm .scr').textContent")
        await freeze(pg, 650); await shot(pg, '1g-token-bounce')
        await pg.evaluate("document.querySelector('#tvm .drop').classList.add('shining')"); await freeze(pg, 0)
        await pg.evaluate("document.querySelectorAll('#tvm .tokwrap .glint, #tvm .tokwrap').forEach(e=>e.getAnimations({subtree:true}).forEach(a=>{a.pause(); a.currentTime = a.animationName=='tokDrop'?1150: 360;}))")
        await pg.evaluate("document.querySelectorAll('#tvm .tok').forEach(e=>e.getAnimations().forEach(a=>{a.pause(); a.currentTime=360;}))")
        await shot(pg, '1h-token-glint')
        await pg.evaluate(f"(()=>{{const T={P}; T.step='pick'; T.render();}})()")
    await tap(pg, '#tvm .seg button[data-v="card"]'); await asyncio.sleep(0.4); await freeze(pg, 300)
    # 羊城通说明：每一行的最后一个字不能是单独一个字（看 span 的行盒）
    R['cardLines'] = await pg.evaluate("""(()=>{const s=document.querySelector('#tvm .cardstep .msg span'), r=document.createRange(), out=[]; let line=null, y=null;
      const walk=n=>{ if(n.nodeType==3){ for(let i=0;i<n.length;i++){ r.setStart(n,i); r.setEnd(n,i+1); const b=r.getBoundingClientRect(); if(y===null||Math.abs(b.top-y)>4){ y=b.top; out.push(''); } out[out.length-1]+=n.data[i]; } } else n.childNodes.forEach(walk); };
      walk(s); return out;})()""")
    await shot(pg, '1k-tvm-card-mode')
    R['errors'] = errs(logs)
    print(json.dumps(R, ensure_ascii=False, indent=1), flush=True)
    chk = {'noOrphan': all(len(l.strip('，、。 ')) > 1 for l in R['cardLines']), 'noErrors': not R['errors']}
    if ONLY == 'all':
        chk['behind'] = '身后' in R['hintBehind']['txt']; chk['turned'] = R['hintFacingGate']['rot'] != R['hintBehind']['rot']
        chk['title'] = R['titleBefore'].startswith('出票中') and R['titleAfter'] == '出票成功'; chk['selTeal'] = R['selRing'] == '#1AA39B'
    print('CHECKS', chk, 'PASS' if all(chk.values()) else 'FAIL', flush=True)
    await b.close()
asyncio.run(main())
