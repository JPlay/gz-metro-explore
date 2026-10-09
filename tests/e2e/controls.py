import asyncio, sys, json
sys.path.insert(0,__import__('os').path.dirname(__file__))
from common import *
URL=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8123/?q=2'
SHOT=sys.argv[2] if len(sys.argv)>2 else '/workspace/gz-shots-3d/'
async def until(pg, js, timeout=25.0, step=0.25):
    # 软件渲染下可能只有 1–5 fps：按条件等，不按固定秒数等
    t = 0.0
    while t < timeout:
        if await pg.evaluate(js): return True
        await asyncio.sleep(step); t += step
    return False
async def touch(cdp, typ, pts):
    await cdp.send('Input.dispatchTouchEvent', {'type':typ, 'touchPoints':[{'x':x,'y':y,'id':i} for i,(x,y) in pts]})
async def main():
  R={}
  async with async_playwright() as p:
    b,pg,logs=await open_game(p,URL)
    cdp=await pg.context.new_cdp_session(pg)
    await asyncio.sleep(1.5)
    s0=await st(pg); R['babylon']=s0['babylon']
    # 摇杆：左下按住往上推（超过半径 = 跑）
    await touch(cdp,'touchStart',[(0,(200,600))])
    for k in range(1,9): await touch(cdp,'touchMove',[(0,(200,600-k*10))]); await asyncio.sleep(0.03)
    await asyncio.sleep(1.2); await until(pg, '__game.player.position.z > %f' % (s0['pos'][2]+1.0), 20)
    s1=await st(pg); await touch(cdp,'touchEnd',[])
    R['joystick']={'before':s0['pos'],'after':s1['pos'],'moved':round(s1['pos'][2]-s0['pos'][2],2),'yawChange':round(s1['yaw']-s0['yaw'],3),'pitchChange':round(s1['pitch']-s0['pitch'],3)}
    # 鼠标按在摇杆上往上拖：只走路，不转视角（评审用鼠标时出现的顶视问题）
    await pg.evaluate('__game.teleport(0,0.05,-48,0)'); await asyncio.sleep(0.5)
    m0=await st(pg)
    await pg.mouse.move(200,620); await pg.mouse.down()
    for k in range(1,12): await pg.mouse.move(200,620-k*9); await asyncio.sleep(0.03)
    await until(pg, '__game.player.position.z > -47', 20); await pg.mouse.up()
    m1=await st(pg)
    R['mouseStick']={'moved':round(m1['pos'][2]-m0['pos'][2],2),'yawChange':round(m1['yaw']-m0['yaw'],3),'pitchChange':round(m1['pitch']-m0['pitch'],3)}
    await pg.evaluate('__game.teleport(0,0.05,-48,0)'); await asyncio.sleep(0.5)
    # 右侧拖动 → 转头
    y0=(await st(pg))['yaw']
    await touch(cdp,'touchStart',[(1,(800,400))])
    for k in range(1,11): await touch(cdp,'touchMove',[(1,(800+k*12,400+k*3))]); await asyncio.sleep(0.03)
    await touch(cdp,'touchEnd',[]); await asyncio.sleep(0.2)
    s2=await st(pg); R['look']={'yaw0':y0,'yaw1':s2['yaw'],'pitch':s2['pitch']}
    # 双指捏合（第三人称拉近）
    d0=await pg.evaluate('__game.player.dist')
    await touch(cdp,'touchStart',[(2,(700,400)),(3,(950,400))])
    for k in range(1,9): await touch(cdp,'touchMove',[(2,(700+k*10,400)),(3,(950-k*10,400))]); await asyncio.sleep(0.03)
    await touch(cdp,'touchEnd',[]); await asyncio.sleep(0.2)
    R['pinch']={'dist0':d0,'dist1':await pg.evaluate('__game.player.dist')}
    # 跳（点 JUMP 按钮）
    box=await pg.locator('#bJump').bounding_box()
    # 软件渲染帧率很低，按帧记录最高点（不靠定时采样）
    y0=(await st(pg))['pos'][1]
    await pg.evaluate("window.__maxY=-99; window.__jo=__game.scene.onBeforeRenderObservable.add(()=>{window.__maxY=Math.max(window.__maxY,__game.player.position.y)})")
    await pg.touchscreen.tap(box['x']+box['width']/2, box['y']+box['height']/2)
    for _ in range(40):
        await asyncio.sleep(0.25)
        if await pg.evaluate('window.__maxY')-y0>0.5 and await pg.evaluate('__game.player.grounded'): break
    peak=await pg.evaluate('window.__maxY')-y0; await pg.evaluate('__game.scene.onBeforeRenderObservable.remove(window.__jo)')
    R['jump']={'peak':round(peak,2), 'btnSize':[box['width'],box['height']]}
    R['btnSizes']=await pg.evaluate("[...document.querySelectorAll('.btn')].map(b=>[b.id,b.getBoundingClientRect().width,b.getBoundingClientRect().height])")
    await asyncio.sleep(1)
    await pg.screenshot(path=SHOT+'third-person.png', timeout=120000)
    # 视角切换
    box=await pg.locator('#bView').bounding_box(); await pg.touchscreen.tap(box['x']+40, box['y']+40); await asyncio.sleep(0.5)
    R['view']=(await st(pg))['view']
    await pg.screenshot(path=SHOT+'first-person.png', timeout=120000)
    box=await pg.locator('#bView').bounding_box(); await pg.touchscreen.tap(box['x']+40, box['y']+40); await asyncio.sleep(0.2)
    R['viewBack']=(await st(pg))['view']
    # 脚印系统已移除：右上角只剩视角 / 声音按钮
    R['noFootBtn']=await pg.evaluate("!document.getElementById('bFoot') && !('toggleFoot' in __game) && !('footCount' in __game.state())")
    # 键盘
    p0=(await st(pg))['pos']; await pg.keyboard.down('KeyW'); await asyncio.sleep(0.8)
    await until(pg, 'Math.hypot(__game.player.position.x-(%f), __game.player.position.z-(%f)) > 0.5' % (p0[0], p0[2]), 20)
    await pg.keyboard.up('KeyW'); p1=(await st(pg))['pos']
    await pg.keyboard.press('KeyV'); R['keys']={'W_moved':round(((p1[0]-p0[0])**2+(p1[2]-p0[2])**2)**.5,2),'V':(await st(pg))['view']}
    await pg.keyboard.press('KeyV')
    # 碰撞：往楼房走不应穿过（边界墙 x=60）
    await pg.evaluate('__game.teleport(55,0.05,-20,Math.PI/2)'); await pg.evaluate('__game.setMove(0,1,true)'); await asyncio.sleep(2.5)
    await until(pg, '__game.player.position.x > 58.5', 30); await asyncio.sleep(1.0); await pg.evaluate('__game.setMove(0,0)')
    R['collision_x']=(await st(pg))['pos'][0]
    R['fps']=(await st(pg))['fps']; R['audio']=(await st(pg))['audio']['context']
    R['errors']=errs(logs)
    print(json.dumps(R, ensure_ascii=False, indent=1))
    chk={'joystickMoves': R['joystick']['moved']>0.8, 'joystickNoLook': abs(R['joystick']['yawChange'])<1e-3 and abs(R['joystick']['pitchChange'])<1e-3,
         'mouseStickMoves': R['mouseStick']['moved']>0.5, 'mouseStickNoLook': abs(R['mouseStick']['yawChange'])<1e-3 and abs(R['mouseStick']['pitchChange'])<1e-3,
         'look': abs(R['look']['yaw1']-R['look']['yaw0'])>0.2, 'pinch': R['pinch']['dist1']>R['pinch']['dist0']+1, 'jump': R['jump']['peak']>0.5,
         'view': R['view']=='first' and R['viewBack']=='third', 'noFootBtn': R['noFootBtn'],
         'keysW': R['keys']['W_moved']>0.3, 'keyV': R['keys']['V']=='first',
         'collision': R['collision_x']<59.9, 'noErrors': not R['errors']}
    print('CHECKS', chk, 'PASS' if all(chk.values()) else 'FAIL')
    await b.close()
asyncio.run(main())
