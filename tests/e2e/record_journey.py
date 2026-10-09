# 录一段公园前完整旅程视频（逐帧、按游戏时间推进，输出稳定帧率的 H.264 mp4）：
#   街上 → 站口 → 楼梯 → 安检 → 售票机买票（2 号线 纪念堂）→ 刷票过闸 → 下到 1 号线站台 → 跟着蓝色引导带换乘 → 2 号线站台
# 软件渲染每帧要 0.5~1 秒，所以停掉浏览器自己的渲染循环，每次手动走一帧（固定 dt = 1/FPS），截一张图。
# 售票机那段是网页界面（真实时间的动画），按真实时间截图，每帧时长 = 实际经过的时间。
# python3 tests/e2e/record_journey.py <url> <输出目录>      FPS=24  ONLY_WALK=1（只从 1 号线站台开始录）
import asyncio, sys, os, json, time, math, subprocess, shutil
sys.path.insert(0, os.path.dirname(__file__))
from playwright.async_api import async_playwright
from common import ARGS, errs
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/?q=1'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-polish/transfer-r2/').rstrip('/') + '/'
FPS = int(os.environ.get('FPS', '24')); DT = 1 / FPS
FR = OUT + '_frames/'; T0 = time.time()
def log(*a): print(f'[{time.time() - T0:7.1f}s]', *a, flush=True)
SETUP = """
(fps) => {
  const g = __game, e = g.engine;
  window.__rec = { dt: 1 / fps, loops: e._activeRenderLoops.slice(), follow: null };
  e.stopRenderLoop();
  e.getDeltaTime = () => window.__rec.dt * 1000;
  // 平滑跟随路径：限制转身速度（镜头不会在拐角处突然甩过去），拐角前提前转向下一个点
  g.scene.onBeforeRenderObservable.add(() => {
    const f = window.__rec.follow; if (!f || f.done) return;
    const p = g.player, dt = window.__rec.dt; let t = f.pts[f.i];
    let dx = t[0] - p.position.x, dz = t[1] - p.position.z, d = Math.hypot(dx, dz);
    f.time += dt;
    if (d < (f.i === f.pts.length - 1 ? 0.35 : 0.9)) { f.i++; f.time = 0; if (f.i >= f.pts.length) { f.done = true; g.setMove(0, 0); return; } t = f.pts[f.i]; dx = t[0] - p.position.x; dz = t[1] - p.position.z; d = Math.hypot(dx, dz); }
    if (f.time > 15) { f.done = true; f.stuck = [p.position.x, p.position.y, p.position.z, f.i]; g.setMove(0, 0); return; }
    let want = Math.atan2(dx, dz), dy = Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw));
    const turn = f.turn * dt; p.yaw += Math.max(-turn, Math.min(turn, dy));
    if (f.pitch !== undefined) p.pitch += (f.pitch - p.pitch) * Math.min(1, dt * 2);
    const last = f.i === f.pts.length - 1;
    g.setMove(0, Math.abs(dy) > 1.2 ? 0.35 : (last && d < 1 ? 0.5 : f.speed), false);
  });
}
"""
STEP = "(n) => { for (let i = 0; i < n; i++) window.__rec.loops.forEach(f => f()); }"
class Rec:
    def __init__(s, pg): s.pg, s.n, s.durs = pg, 0, []
    async def shot(s, dur):
        fn = f'{FR}{s.n:05d}.jpg'; await s.pg.screenshot(path=fn, type='jpeg', quality=90); s.durs.append(dur); s.n += 1
    async def frame(s):
        await s.pg.evaluate(STEP, 1); await s.shot(DT)
    async def frames(s, n):
        for _ in range(n): await s.frame()
    async def until(s, js, max_s=60):
        for _ in range(int(max_s * FPS)):
            await s.frame()
            if await s.pg.evaluate(js): return True
        return False
    async def follow(s, pts, speed=1.0, pitch=None, turn=2.6, max_s=90):
        await s.pg.evaluate(f'window.__rec.follow = {{ pts: {json.dumps(pts)}, i: 0, time: 0, speed: {speed}, turn: {turn}, pitch: {json.dumps(pitch)}, done: false }}')
        ok = await s.until('window.__rec.follow.done', max_s)
        st = await s.pg.evaluate('({f: window.__rec.follow, p: __game.state().pos})')
        log('follow ->', pts[-1], 'stuck' if st['f'].get('stuck') else 'ok', st['p'], 'frames', s.n)
        return ok and not st['f'].get('stuck')
    async def realtime(s, seconds, step_game=True):
        """网页界面那段：按真实时间截图"""
        t_end = time.time() + seconds; last = time.time()
        while time.time() < t_end:
            if step_game: await s.pg.evaluate(STEP, 1)
            now = time.time(); await s.shot(max(UI_HOLD, now - last)); last = now
    async def tap(s, sel):
        box = await s.pg.locator(sel).first.bounding_box(); await s.pg.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
        last = time.time(); await s.pg.evaluate(STEP, 1); await s.shot(max(UI_HOLD, time.time() - last))
def encode(rec, i0, i1, out):
    lst = FR + f'list_{i0}_{i1}.txt'
    with open(lst, 'w') as f:
        for i in range(i0, i1):
            f.write(f"file '{FR}{i:05d}.jpg'\nduration {rec.durs[i]:.4f}\n")
        f.write(f"file '{FR}{i1 - 1:05d}.jpg'\n")
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-vf', f'fps={FPS},format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22',
                    '-movflags', '+faststart', '-r', str(FPS), out], check=True)
    log('encoded', out, os.path.getsize(out) // 1024, 'KB', f'{sum(rec.durs[i0:i1]):.1f}s')
# 售票机 / 闸机界面帧至少停 0.6s：机器忙时一帧要截好几秒，按墙钟算出来的时长会让买票界面一闪而过
UI_HOLD = 0.6
class _Meta:
    def __init__(s, d): s.durs = d['durs']
async def main():
    if os.environ.get('REENCODE') == '1':                                    # 只用已截好的帧重新编码（改了停留时长后用）
        m = json.load(open(FR + 'meta.json')); R = _Meta(m)
        encode(R, 0, len(R.durs), OUT + 'journey-ticket-to-line2.mp4'); encode(R, m['marks']['walk0'], m['marks']['walk1'], OUT + 'walk-l1-to-l2.mp4'); return
    shutil.rmtree(FR, ignore_errors=True); os.makedirs(FR)
    only_walk = os.environ.get('ONLY_WALK') == '1'
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1112, 'height': 834}, device_scale_factor=1, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); logs = []
        pg.on('console', lambda m: logs.append((m.type, m.text))); pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
        await pg.goto(URL); await pg.wait_for_function('window.__game', timeout=120000)
        await asyncio.sleep(2); await pg.touchscreen.tap(560, 300); await asyncio.sleep(0.5)  # 解锁音频
        await pg.evaluate(SETUP, FPS)
        R = Rec(pg); marks = {}
        y1 = -12
        if not only_walk:
            await pg.evaluate('__game.player.pitch = 0.12')
            await R.frames(int(1.5 * FPS))                                   # 站口外停一下
            await R.follow([[0, -40], [0, -30], [0, -20], [0, -14], [0, -10]], pitch=0.15)   # 站口 → 楼梯 → 安检
            await R.follow([[-3, -8], [-7.4, -7.6]])                        # 售票机
            await pg.evaluate('__game.player.yaw = 0'); await R.frames(int(0.6 * FPS))
            ok = await R.until("(__game.state().act||{}).id=='buy'", 5); log('act buy', ok)
            await R.tap('#bAct'); await R.realtime(1.2)
            await R.tap('#tvm button[data-act="line"][data-v="2"]'); await R.realtime(1.0)
            await R.tap('#tvm .st[data-code="jnt"] .hit'); await R.realtime(1.2)
            await R.tap('#tvm .go'); await R.realtime(1.0)
            fare = (await pg.evaluate('__game.state()'))['ticket']['panel']['fare']; log('fare', fare)
            for _ in range(fare): await R.tap('#tvm .coin1'); await R.realtime(0.9)
            for _ in range(40):                                              # 出票动画（真实时间），面板自己关
                await R.realtime(0.5)
                if not await pg.evaluate('__game.state().ticket.panel.open'): break
            log('ticket', (await pg.evaluate('__game.state()'))['ticket']['inv'])
            await R.frames(int(0.5 * FPS))
            await R.follow([[-7.4, -8.2], [-4, -8.2], [0, -4.2], [0, -3.4]])    # 闸机
            await pg.evaluate('__game.player.yaw = 0')
            ok = await R.until("(__game.state().act||{}).id=='tapIn'", 5); log('act tapIn', ok)
            await R.tap('#bAct')
            ok = await R.until('Math.max(...__game.state().gates)>0.5', 8); log('gate open', ok)
            await R.follow([[0, 2], [-2.5, 8], [-2.5, 14], [10, 14]], pitch=0.25)   # 站厅 → 下 1 号线站台的楼梯
            await R.follow([[15.6, 14]], pitch=0.12)
        else:
            await pg.evaluate(f'__game.teleport(12, {y1 + 0.05}, 14, Math.PI/2); __game.player.pitch = 0.12')
            await R.frames(int(1.0 * FPS))
        marks['walk0'] = R.n
        await R.frames(int(1.2 * FPS))                                       # 楼梯脚：先看见大蓝牌
        # 跟着蓝带：掉头 → 北侧走道 → 换乘楼梯 → 通道（过桥）→ 2 号线楼梯 → 2 号线站台
        await R.follow([[17.0, 14.6], [17.4, 18.0], [12, 18.6], [-2.4, 18.6], [-2.8, 15.0], [-6, 14.7], [-12, 14.7]], pitch=0.15)
        await R.follow([[-19.3, 14.7], [-20.8, 15.6], [-20.8, 24]], pitch=0.25)
        await R.follow([[-20.8, 34], [-20.8, 41.6], [-19.6, 42.3], [-12, 42.3]], pitch=0.15)
        await R.follow([[-5.6, 42.3], [-1.2, 42.3]], pitch=0.25)
        await pg.evaluate('window.__rec.follow = null'); await R.frames(int(1.5 * FPS))   # 2 号线站台停一下
        marks['walk1'] = R.n
        s = await pg.evaluate('__game.state()'); log('end', s['pos'], s['zone'], 'depthBits', s.get('depthBits'))
        e = errs(logs); log('errors', e[:5])
        await b.close()
    json.dump({'durs': R.durs, 'marks': marks}, open(FR + 'meta.json', 'w'))
    if not only_walk: encode(R, 0, R.n, OUT + 'journey-ticket-to-line2.mp4')
    encode(R, marks['walk0'], marks['walk1'], OUT + 'walk-l1-to-l2.mp4')
if __name__ == '__main__': asyncio.run(main())
