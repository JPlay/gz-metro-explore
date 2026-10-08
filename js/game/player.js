/*
 * 玩家：方块小孩，Babylon 内置椭球碰撞 + 自己算重力/跳跃。
 * 第一人称：镜头在眼睛高度；第三人称：镜头在身后，射线检测防穿墙，双指捏合调距离。
 */
import { Geo, hex } from '../core/geo.js';
import { CONFIG } from '../core/config.js';
const B = window.BABYLON;
const EYE = 1.38;

export class Player {
  constructor(scene, mats, camera) {
    this.scene = scene; this.cam = camera;
    const c = this.collider = B.MeshBuilder.CreateBox('player', { width: 0.6, height: 1.5, depth: 0.6 }, scene);
    c.isVisible = false; c.isPickable = false; c.checkCollisions = false;
    c.ellipsoid = new B.Vector3(0.32, 0.74, 0.32); c.ellipsoidOffset = new B.Vector3(0, 0.75, 0);
    this.position = c.position;
    this.yaw = 0; this.pitch = 0.05; this.vy = 0; this.grounded = false; this.facing = 0; this.view = 'third';
    this.dist = 4.2; this.camDist = 4.2; this.speed = 0; this.walkPhase = 0; this.vel = new B.Vector3(); this.moving = false; this.airTime = 0;
    this.buildModel(mats);
  }
  buildModel(mats) {
    const s = this.scene, root = this.model = new B.TransformNode('kid', s);
    const part = (name, build, px, py, pz) => { const g = new Geo(); build(g); const m = g.toMesh(name, s, mats.solid); const pv = new B.TransformNode(name + 'P', s); pv.parent = root; pv.position.set(px, py, pz); m.parent = pv; return { pv, m }; };
    const skin = hex('#F2C9A0'), shirt = hex('#3BB4E6'), pants = hex('#3D5A99'), shoe = hex('#2F343B'), hair = hex('#4A2F1E');
    this.legL = part('legL', g => { g.box(0, -0.36, 0, 0.2, 0.62, 0.22, pants); g.box(0, -0.7, 0.03, 0.21, 0.1, 0.27, shoe); }, -0.11, 0.75, 0);
    this.legR = part('legR', g => { g.box(0, -0.36, 0, 0.2, 0.62, 0.22, pants); g.box(0, -0.7, 0.03, 0.21, 0.1, 0.27, shoe); }, 0.11, 0.75, 0);
    this.body = part('body', g => { g.box(0, 0.3, 0, 0.46, 0.6, 0.26, shirt); g.box(0, 0.3, 0.135, 0.2, 0.2, 0.02, hex('#FFD23F')); }, 0, 0.75, 0);
    this.armL = part('armL', g => { g.box(0, -0.25, 0, 0.15, 0.56, 0.17, shirt); g.box(0, -0.56, 0, 0.14, 0.1, 0.15, skin); }, -0.31, 1.32, 0);
    this.armR = part('armR', g => { g.box(0, -0.25, 0, 0.15, 0.56, 0.17, shirt); g.box(0, -0.56, 0, 0.14, 0.1, 0.15, skin); }, 0.31, 1.32, 0);
    this.head = part('head', g => {
      g.box(0, 0.2, 0, 0.4, 0.4, 0.4, skin); g.box(0, 0.42, -0.02, 0.44, 0.1, 0.44, hair); g.box(0, 0.3, -0.2, 0.44, 0.24, 0.06, hair);
      g.box(-0.09, 0.22, 0.205, 0.07, 0.08, 0.02, hex('#222')); g.box(0.09, 0.22, 0.205, 0.07, 0.08, 0.02, hex('#222')); g.box(0, 0.1, 0.205, 0.12, 0.03, 0.02, hex('#C0605A'));
      g.box(0, 0.47, 0.06, 0.46, 0.06, 0.34, hex('#FF6B6B')); g.box(0, 0.45, 0.28, 0.4, 0.04, 0.18, hex('#FF6B6B'));
    }, 0, 1.36, 0);
    this.parts = [this.legL, this.legR, this.body, this.armL, this.armR, this.head];
  }
  meshes() { return this.parts.map(p => p.m); }
  spawn(x, y, z, yaw) { this.position.set(x, y, z); this.yaw = this.facing = yaw; this.vy = 0; this.pitch = 0.05; this.collider.computeWorldMatrix(true); }
  /** 主更新：inp = Input.read() 的结果，extra = 额外水平位移（扶梯） */
  update(dt, inp, extra) {
    const look = 0.0048;
    this.yaw += inp.lx * look; this.pitch += inp.ly * look * 0.85;
    const pmin = this.view === 'first' ? -1.35 : -0.55, pmax = this.view === 'first' ? 1.35 : 1.15;
    this.pitch = Math.max(pmin, Math.min(pmax, this.pitch));
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
    const sw = this.grounded ? Math.sin(this.walkPhase) * Math.min(1, this.speed / 3) * 0.75 : 0.5;
    this.legL.pv.rotation.x = sw; this.legR.pv.rotation.x = -sw; this.armL.pv.rotation.x = -sw * 0.9; this.armR.pv.rotation.x = sw * 0.9;
    if (!this.grounded) { this.armL.pv.rotation.z = -0.6; this.armR.pv.rotation.z = 0.6; } else { this.armL.pv.rotation.z = this.armR.pv.rotation.z = 0; }
    this.model.position.copyFrom(p); this.model.rotation.y = this.facing;
    this.head.pv.rotation.x = this.view === 'third' ? Math.max(-0.4, Math.min(0.4, this.pitch * 0.5)) : 0;
  }
  /** 镜头：每帧在玩家更新之后调用 */
  updateCamera(dt, scene) {
    const cam = this.cam, p = this.position;
    const fwd = new B.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    if (this.view === 'first') {
      const bob = this.grounded ? Math.sin(this.walkPhase * 2) * 0.03 * Math.min(1, this.speed / 3) : 0;
      cam.position.set(p.x + Math.sin(this.yaw) * 0.12, p.y + EYE + bob, p.z + Math.cos(this.yaw) * 0.12);
      this.model.setEnabled(false);
    } else {
      const target = new B.Vector3(p.x, p.y + 1.3, p.z);
      const ray = new B.Ray(target, fwd.scale(-1), this.dist + 0.3);
      const hit = scene.pickWithRay(ray, m => m.checkCollisions && m.isEnabled() && m !== this.collider);
      let want = this.dist; if (hit && hit.hit) want = Math.max(0.35, hit.distance - 0.3);
      this.camDist = want < this.camDist ? want : this.camDist + (want - this.camDist) * Math.min(1, dt * 4);
      cam.position.copyFrom(target.subtract(fwd.scale(this.camDist)));
      this.model.setEnabled(this.camDist > 0.8);
    }
    cam.rotation.set(this.pitch, this.yaw, 0);
  }
  toggleView() {
    this.view = this.view === 'first' ? 'third' : 'first';
    this.cam.fov = this.view === 'first' ? 1.12 : 0.95;
    if (this.view === 'third') this.pitch = Math.max(-0.4, Math.min(0.9, this.pitch + 0.15));
    return this.view;
  }
}
