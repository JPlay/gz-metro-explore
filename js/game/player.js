/*
 * 玩家：8 岁小男孩的玩具版（蜂蜜金锅盖头、粉镜片圆眼镜、灰 T 恤、星星阔腿裤、洞洞鞋、挂绳卡套、白书包，见 hero.js），
 *   骨骼蒙皮 + 程序化动画（待机 / 走 / 跑 / 跳 / 坐 / 🤘打招呼 / “努力！”到站庆祝）。
 * 物理：Babylon 内置椭球碰撞 + 自己算重力/跳跃（与旧版一致）。
 * 第一人称：镜头在眼睛高度，走路时轻微头部起伏；第三人称：镜头在身后平滑跟随，射线检测防穿墙，双指捏合调距离。
 */
import { CONFIG } from '../core/config.js';
import { makeBlob } from '../world/people.js';
import { Hero } from './hero.js';
const B = window.BABYLON;
const EYE = 1.38, EYE_SIT = 1.1, SEAT_HIP = 0.55, FOV_FIRST = 1.0, FOV_THIRD = 0.92;

export class Player {
  constructor(scene, mats, camera) {
    this.scene = scene; this.cam = camera;
    const c = this.collider = B.MeshBuilder.CreateBox('player', { width: 0.6, height: 1.5, depth: 0.6 }, scene);
    c.isVisible = false; c.isPickable = false; c.checkCollisions = false;
    c.ellipsoid = new B.Vector3(0.32, 0.74, 0.32); c.ellipsoidOffset = new B.Vector3(0, 0.75, 0);
    this.position = c.position;
    this.yaw = 0; this.pitch = 0.05; this.vy = 0; this.grounded = false; this.facing = 0; this.view = 'third';
    this.dist = 4.2; this.camDist = 4.2; this.speed = 0; this.walkPhase = 0; this.vel = new B.Vector3(); this.moving = false; this.airTime = 0;
    this.buildModel(mats); camera.fov = FOV_THIRD;
  }
  buildModel(M) {
    this.person = new Hero(this.scene, M.paint, { name: 'kid' });
    this.model = this.person.mesh;
    // 脚下的圆形软阴影（实时阴影只在最高画质档开）
    this.blob = makeBlob(this.scene, M, 'kidBlob', 0.44, 0.78); this.groundY = 0;
  }
  /** 到站下车庆祝：下次站定时（6 秒内）转向镜头，两只拳头举起“努力！” */
  celebrate() { this.cheerPending = 6; }
  meshes() { return [this.person.mesh]; }
  /** 坐下：seat = 列车座位（局部 x、侧 sd）。髋部对齐座垫，与烘焙乘客同一公式：脚底 y = 0.55 − 髋高 */
  sit(train, seat) {
    this.seat = { train, seat }; this.vel.set(0, 0, 0); this.vy = 0; this.speed = 0;
    this.facing = seat.sd > 0 ? Math.PI : 0; this.yaw = this.facing; this.pitch = this.view === 'first' ? 0.02 : 0.12;
    this.placeSeat();
  }
  hipH() { return (this.person.look.kid ? 0.6 : 0.86) * this.person.look.scale; }
  placeSeat() { const { train, seat } = this.seat, r = train.root.position; this.position.set(r.x + seat.x, r.y + SEAT_HIP - this.hipH(), r.z + seat.sd * 1.2); }
  /** 贴回座位并同步模型 / 影子（列车移动之后也要调用一次，避免慢一帧） */
  syncSeat() {
    if (!this.seat) return;
    this.placeSeat(); this.collider.computeWorldMatrix(true); this.groundY = this.position.y;
    const p = this.position; this.model.position.set(p.x, p.y, p.z); this.model.rotation.y = this.facing;
    this.blob.position.set(p.x, this.seat.train.root.position.y + 0.02, p.z); this.blob.scaling.set(0.8, 1, 0.8); this.blob.visibility = 0.55;
  }
  standUp() {
    const { train, seat } = this.seat, r = train.root.position; this.seat = null;
    this.position.set(r.x + seat.x, r.y + 0.05, r.z + seat.sd * 0.5); this.vy = 0; this.grounded = true; this.groundY = r.y; this.collider.computeWorldMatrix(true);
  }
  spawn(x, y, z, yaw) { this.position.set(x, y, z); this.groundY = y; this.camY = this.eyeY = undefined; this.yaw = this.facing = yaw; this.vy = 0; this.pitch = 0.05; this.collider.computeWorldMatrix(true); }
  /** 主更新：inp = Input.read() 的结果，extra = 额外水平位移（扶梯） */
  update(dt, inp, extra) {
    const look = 0.0048; this._dt = dt;
    this.yaw += inp.lx * look; this.pitch += inp.ly * look * 0.85;
    // 第三人称俯仰夹在舒适跟随时：最高约 32°，避免被拖成接近垂直的顶视
    const pmin = this.view === 'first' ? -1.35 : -0.35, pmax = this.view === 'first' ? 1.35 : 0.55;
    this.pitch = Math.max(pmin, Math.min(pmax, this.pitch));
    if (this.seat) {
      // 坐着：不走、不受重力，每帧贴回座位（列车移动由 Metro 带着走）；跳键 = 起身
      if (inp.jump && this.onStandRequest) this.onStandRequest();
      else {
        this.person.animate(dt, { mode: 'sit' }); this.grounded = true; this.moving = false; this.speed = 0; this.airTime = 0;
        this.syncSeat();
        return;
      }
    }
    if (inp.pinch && this.view === 'third') this.dist = Math.max(1.8, Math.min(9, this.dist - inp.pinch * 0.02));
    // 水平速度
    const mag = Math.min(1, Math.hypot(inp.mx, inp.my));
    let target = 0; if (mag > 0.08) target = inp.run ? CONFIG.runSpeed : CONFIG.walkSpeed * Math.min(1, mag / 0.75);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let dx = 0, dz = 0; if (mag > 0.08) { dx = (rx * inp.mx + fx * inp.my) / mag; dz = (rz * inp.mx + fz * inp.my) / mag; }
    const k = Math.min(1, dt * (this.grounded ? 12 : 4));
    this.vel.x += (dx * target - this.vel.x) * k; this.vel.z += (dz * target - this.vel.z) * k;
    this.speed = Math.hypot(this.vel.x, this.vel.z); this.moving = this.speed > 0.3;
    if (this.moving) { const want = Math.atan2(this.vel.x, this.vel.z); let d = want - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); this.facing += d * Math.min(1, dt * 12); }
    // 跳
    if (inp.jump && this.grounded) { this.vy = CONFIG.jumpSpeed; this.grounded = false; this.jumped = true; }
    this.vy -= CONFIG.gravity * dt; if (this.vy < -30) this.vy = -30;
    const c = this.collider, p = this.position;
    // ① 水平
    const hx = this.vel.x * dt + (extra ? extra.x : 0), hz = this.vel.z * dt + (extra ? extra.z : 0);
    if (hx || hz) c.moveWithCollisions(new B.Vector3(hx, 0, hz));
    // ② 竖直（落地时往下“吸”一点，下坡不会飘）
    const y0 = p.y, x0 = p.x, z0 = p.z, snap = this.grounded && this.vy <= 0;
    const dy = snap ? -(0.06 + Math.hypot(hx, hz) * 0.8) : this.vy * dt;
    c.moveWithCollisions(new B.Vector3(0, dy, 0));
    const moved = p.y - y0;
    p.x = x0; p.z = z0; // 竖直移动不允许带出水平滑动
    const blocked = Math.abs(moved) < Math.abs(dy) * 0.5;
    if (dy < 0 && blocked) {
      if (!this.grounded && this.airTime > 0.35) this.landed = true;
      this.grounded = true; this.vy = 0; this.airTime = 0;
    } else {
      this.grounded = false; this.airTime += dt; if (snap) this.vy = 0;
      if (dy > 0 && blocked) this.vy = Math.min(this.vy, 0);
    }
    // 动画
    this.walkPhase += dt * (this.speed * 2.6 + 0.001);
    let mode = !this.grounded && this.airTime > 0.08 ? 'jump' : this.speed > 4.4 ? 'run' : this.speed > 0.35 ? 'walk' : 'idle';
    // 打招呼：站着不动时转向对方、挥手（emote = { mode, yaw, t }，一走动就停）
    if (this.cheerPending > 0) {
      this.cheerPending -= dt;
      if (mode === 'idle' && !(this.emote && this.emote.t > 0)) { this.cheerPending = 0; this.emote = { mode: 'cheer', yaw: this.view === 'third' ? this.yaw + Math.PI : this.facing, t: 2.4 }; }
    }
    const em = this.emote;
    if (em && em.t > 0) { em.t -= dt; if (mode === 'idle') { mode = em.mode; let d = em.yaw - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); this.facing += d * Math.min(1, dt * 8); } else em.t = 0; }
    this.person.animate(dt, { mode, speed: this.speed });
    if (this.grounded) this.groundY = p.y;
    this.model.position.set(p.x, p.y + (this.person.hipBob || 0) * 0.6, p.z); this.model.rotation.y = this.facing;
    const air = Math.max(0, p.y - this.groundY), bs = Math.max(0.45, 1 - air * 0.25);
    this.placeBlob(p, bs, Math.max(0.3, 1 - air * 0.3));
  }
  /**
   * 脚下圆影：向下打一条射线落到实际地面上（以前固定在“最后着地高度”，楼梯上是一块水平的圆片悬在台阶上）。
   * 楼梯的碰撞体是一块斜板（比踏步面高出 0~1 级），碰到斜面时再向下打可见的地面网格，影子落在脚下那级踏面上并缩小一点。
   */
  placeBlob(p, bs, vis) {
    const sc = this.scene, o = new B.Vector3(p.x, p.y + 0.5, p.z), down = new B.Vector3(0, -1, 0);
    let y = this.groundY, k = 1;
    const h = sc.pickWithRay(new B.Ray(o, down, 8), this._colPred || (this._colPred = m => m.checkCollisions && m.isEnabled() && m !== this.collider));
    if (h && h.hit) {
      y = h.pickedPoint.y;
      const n = h.getNormal(true);
      if (n && Math.abs(n.y) < 0.985) {
        const h2 = sc.pickWithRay(new B.Ray(o, down, 8), this._floorPred || (this._floorPred = m => m.isEnabled() && /^floor/.test(m.name)));
        if (h2 && h2.hit && h2.pickedPoint.y > y - 0.4) { y = h2.pickedPoint.y; k = 0.72; }
      }
    }
    this.blobY = this.blobY === undefined || Math.abs(this.blobY - y) > 0.5 ? y : this.blobY + (y - this.blobY) * Math.min(1, (this._dt || 0.016) * 20);
    this.blob.position.set(p.x, this.blobY + 0.02, p.z); this.blob.scaling.set(bs * k, 1, bs * k); this.blob.visibility = vis;
  }
  /** 镜头：每帧在玩家更新之后调用 */
  updateCamera(dt, scene) {
    const cam = this.cam, p = this.position;
    const fwd = new B.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    if (this.view === 'first') {
      // 轻微头部起伏：竖直按步频、左右按半步频，幅度随速度
      const k = this.grounded ? Math.min(1, this.speed / 3.5) : 0; this.bobK = (this.bobK || 0) + (k - (this.bobK || 0)) * Math.min(1, dt * 8);
      const ph = this.person.phase || this.walkPhase, bob = Math.abs(Math.sin(ph)) * 0.035 * this.bobK, sway = Math.sin(ph) * 0.012 * this.bobK;
      this.eyeY = this.eyeY === undefined ? p.y : this.eyeY + (p.y - this.eyeY) * Math.min(1, dt * 18);
      if (Math.abs(this.eyeY - p.y) > 0.6) this.eyeY = p.y;
      // 坐下时第一人称眼高 ≈ 车厢地板上 1.1m（从脚底基准换算：座面高 − 髋高 + 眼高）
      const eye = this.seat ? EYE_SIT - SEAT_HIP + this.hipH() : EYE;
      this.eyeOff = this.eyeOff === undefined ? eye : this.eyeOff + (eye - this.eyeOff) * Math.min(1, dt * 6);
      cam.position.set(p.x + Math.sin(this.yaw) * 0.12 + Math.cos(this.yaw) * sway, this.eyeY + this.eyeOff + bob, p.z + Math.cos(this.yaw) * 0.12 - Math.sin(this.yaw) * sway);
      this.model.setEnabled(false); this.blob.setEnabled(true);
    } else {
      // 竖直方向平滑（上下楼梯 / 跳跃时镜头不抖），水平方向紧跟（坐车时不拖影）
      this.camY = this.camY === undefined ? p.y : this.camY + (p.y - this.camY) * Math.min(1, dt * 7);
      if (Math.abs(this.camY - p.y) > 2) this.camY = p.y;
      const target = new B.Vector3(p.x, this.camY + 1.25, p.z);
      // 镜头的障碍物：碰撞体 + 标牌（吊牌没有碰撞体，以前从换乘楼梯脚进通道时镜头直接钻进通道口的吊牌，上半屏一片黑）
      const pred = this._camPred || (this._camPred = m => m.isEnabled() && m !== this.collider && (m.checkCollisions || m.name === 'signs'));
      const ray = new B.Ray(target, fwd.scale(-1), this.dist + 0.3);
      const hit = scene.pickWithRay(ray, pred);
      let want = this.dist; if (hit && hit.hit) want = Math.max(0.35, hit.distance - 0.3);
      // 拉近要立刻（不然穿墙），拉远平滑；界面（售票机等）关掉后的恢复也走这条平滑
      this.camDist = want < this.camDist ? want : this.camDist + (want - this.camDist) * Math.min(1, dt * 2.5);
      cam.position.copyFrom(target.subtract(fwd.scale(this.camDist)));
      // 镜头离天花板 / 两侧墙至少留 0.3m：上面那条射线只管镜头身后，贴着吊顶或侧墙滑动时近裁剪面会切进去（看到墙外 / 楼上）
      const CL = 0.3, up = new B.Vector3(0, 1, 0);
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      for (const [dx, dy, dz] of [[rx, 0, rz], [-rx, 0, -rz]]) {
        const dir = new B.Vector3(dx, dy, dz), h = scene.pickWithRay(new B.Ray(cam.position, dir, CL), pred);
        if (h && h.hit) cam.position.subtractInPlace(dir.scale(CL - h.distance));
      }
      // 低矮处（换乘通道、楼梯口、吊牌下）：镜头高度封顶 = 上方最近的天花 / 吊牌底 − 0.35m。
      //   从玩家头顶、镜头所在点、镜头前后 0.8m 各向上打一条射线取最低（起点都用“没进墙”的高度：头 / 镜头本身，
      //   不能用头的高度去镜头那里打——下楼梯时镜头身后的楼梯比头还高，会从楼梯板下面打到楼梯底面，把镜头压进楼梯里），
      //   封顶值下降快（提前看到前方的低顶）、回升慢，再用头顶和镜头点的实际值硬卡一次，任何时候都不会进到天花板里
      const ceilAt = (x, y0, z) => { const h = scene.pickWithRay(new B.Ray(new B.Vector3(x, y0, z), up, 4), pred); return h && h.hit && h.distance > 0.02 ? y0 + h.distance : Infinity; };
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
      const hard = Math.min(ceilAt(p.x, target.y, p.z), ceilAt(cx, cy, cz)) - 0.35;
      const soft = Math.min(hard, ceilAt(cx + fx * 0.8, cy, cz + fz * 0.8) - 0.35, ceilAt(cx - fx * 0.8, cy, cz - fz * 0.8) - 0.35);
      const tgtCap = Math.max(target.y - 0.2, soft);
      if (this.camCap === undefined || !isFinite(this.camCap) || !isFinite(tgtCap)) this.camCap = tgtCap;
      else this.camCap += (tgtCap - this.camCap) * Math.min(1, dt * (tgtCap < this.camCap ? 9 : 2.5));
      const cap = Math.min(this.camCap, Math.max(target.y - 0.2, hard));
      if (cam.position.y > cap) cam.position.y = cap;
      // 镜头压低后仍对准玩家（只改看的俯仰，不改玩家设定的 pitch）
      const hd = Math.hypot(target.x - cam.position.x, target.z - cam.position.z);
      this.aimPitch = hd > 0.4 ? Math.atan2(cam.position.y - target.y, hd) : this.pitch;
      // 镜头离主角身体（脚底到头顶这根竖线）太近：0.8m 内渐隐，0.5m 内整个藏起来（以前会看到脸和头发的内侧）
      const ay = Math.min(p.y + 1.45, Math.max(p.y + 0.1, cam.position.y));
      const dBody = Math.hypot(cam.position.x - p.x, cam.position.y - ay, cam.position.z - p.z);
      const f = Math.max(0, Math.min(1, (dBody - 0.5) / 0.3));
      this.model.setEnabled(f > 0.02);
      if (f !== this._heroFade) { this._heroFade = f; for (const m of [this.model, ...this.model.getChildMeshes()]) m.visibility = f; }
      this.blob.setEnabled(true);
    }
    // 近裁剪面随镜头调整：第三人称镜头离墙至少 0.3m（见上面的射线），0.25 不会切进墙；第一人称眼睛离墙可能只有 0.18m，用 0.1
    const nz = this.view === 'first' || this.camDist < 0.8 ? 0.1 : 0.25; if (this.view === 'first') this.aimPitch = undefined; if (cam.minZ !== nz) cam.minZ = nz;
    cam.rotation.set(this.view === 'first' || this.aimPitch === undefined ? this.pitch : this.aimPitch, this.yaw, 0);
  }
  toggleView() {
    this.view = this.view === 'first' ? 'third' : 'first';
    this.cam.fov = this.view === 'first' ? FOV_FIRST : FOV_THIRD;
    if (this.view === 'third') this.pitch = Math.max(-0.35, Math.min(0.55, this.pitch + 0.15));
    return this.view;
  }
}
