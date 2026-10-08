import asyncio, sys, json
sys.path.insert(0,__import__('os').path.dirname(__file__))
from common import *
URL=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8123/?q=2'
SHOT=sys.argv[2] if len(sys.argv)>2 else '/workspace/gz-shots-3d/'
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
    await asyncio.sleep(1.2)
    s1=await st(pg); await touch(cdp,'touchEnd',[])
    R['joystick']={'before':s0['pos'],'after':s1['pos'],'moved':round(s1['pos'][2]-s0['pos'][2],2)}
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
    ys=[]
    await pg.touchscreen.tap(box['x']+box['width']/2, box['y']+box['height']/2)
    for _ in range(8): ys.append((await st(pg))['pos'][1]); await asyncio.sleep(0.06)
    R['jump']={'ys':ys,'peak':max(ys)-ys[0] if ys else 0, 'btnSize':[box['width'],box['height']]}
    R['btnSizes']=await pg.evaluate("[...document.querySelectorAll('.btn')].map(b=>[b.id,b.getBoundingClientRect().width,b.getBoundingClientRect().height])")
    await asyncio.sleep(1)
    await pg.screenshot(path=SHOT+'third-person.png')
    # 视角切换
    box=await pg.locator('#bView').bounding_box(); await pg.touchscreen.tap(box['x']+40, box['y']+40); await asyncio.sleep(0.5)
    R['view']=(await st(pg))['view']
    await pg.screenshot(path=SHOT+'first-person.png')
    box=await pg.locator('#bView').bounding_box(); await pg.touchscreen.tap(box['x']+40, box['y']+40); await asyncio.sleep(0.2)
    R['viewBack']=(await st(pg))['view']
    # 脚印
    R['footDefault']=s0['foot']
    box=await pg.locator('#bFoot').bounding_box(); await pg.touchscreen.tap(box['x']+40, box['y']+40)
    await pg.evaluate('__game.setMove(0,1,false)'); await asyncio.sleep(2.5); await pg.evaluate('__game.setMove(0,0)')
    s3=await st(pg); R['foot']={'on':s3['foot'],'count':s3['footCount']}
    await pg.screenshot(path=SHOT+'_footprints.png')
    box=await pg.locator('#bFoot').bounding_box(); await pg.touchscreen.tap(box['x']+40, box['y']+40); await asyncio.sleep(0.2)
    s4=await st(pg); R['footOff']={'on':s4['foot'],'count':s4['footCount']}
    # 键盘
    p0=(await st(pg))['pos']; await pg.keyboard.down('KeyW'); await asyncio.sleep(0.8); await pg.keyboard.up('KeyW'); p1=(await st(pg))['pos']
    await pg.keyboard.press('KeyV'); R['keys']={'W_moved':round(((p1[0]-p0[0])**2+(p1[2]-p0[2])**2)**.5,2),'V':(await st(pg))['view']}
    await pg.keyboard.press('KeyV')
    # 碰撞：往楼房走不应穿过（边界墙 x=60）
    await pg.evaluate('__game.teleport(55,0.05,-20,Math.PI/2)'); await pg.evaluate('__game.setMove(0,1,true)'); await asyncio.sleep(2.5); await pg.evaluate('__game.setMove(0,0)')
    R['collision_x']=(await st(pg))['pos'][0]
    R['fps']=(await st(pg))['fps']; R['audio']=(await st(pg))['audio']['context']
    R['errors']=errs(logs)
    print(json.dumps(R, ensure_ascii=False, indent=1))
    await b.close()
asyncio.run(main())
