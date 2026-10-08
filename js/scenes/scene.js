import * as THREE from 'three';
import { PathGraph } from '../world/pathgraph.js';
import { cancelOwner } from '../core/tween.js';

/**
 * 场景基类。每个场景拥有自己的 root（加入全局 THREE.Scene）、路径图与机关列表。
 * 子类覆盖：build()、enter(params)、update(dt,t)、tap(x,y)、grab(x,y)、fitBox()。
 */
export class Scene {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    this.graph = new PathGraph();
    this.mechs = [];
    this.theme = { top: '#cfe8f2', bottom: '#fdf1dc', fog: 0xfdf1dc };
    this.kind = 'scene';
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
  }
  build() {}
  enter() {}
  exit() { cancelOwner(this); }
  update() {}
  tap() {}
  grab() { return null; }
  fitBox() { return new THREE.Box3().setFromObject(this.root); }
  /** 屏幕点 → 射线 */
  ray(x, y) {
    const cam = this.game.cam;
    this.ndc.set(x / cam.width * 2 - 1, -(y / cam.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, cam.camera);
    return this.raycaster;
  }
  dispose() {
    this.root.traverse(o => { if (o.material && o.material.userData && o.material.userData.unique) o.material.dispose(); });
    this.root.removeFromParent();
  }
}
