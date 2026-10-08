// 共享材质（全场只有少数几个）：顶点色实色、顶点色发光、玻璃。不随车站重建销毁。
const B = window.BABYLON;
let M = null;
export function mats(scene) {
  if (M) return M;
  const solid = new B.StandardMaterial('solid', scene);
  solid.diffuseColor = new B.Color3(1, 1, 1); solid.specularColor = new B.Color3(0.12, 0.12, 0.12); solid.specularPower = 24;
  solid.emissiveColor = new B.Color3(0.1, 0.1, 0.11);
  const glow = new B.StandardMaterial('glow', scene);
  glow.diffuseColor = new B.Color3(0, 0, 0); glow.specularColor = new B.Color3(0, 0, 0); glow.emissiveColor = new B.Color3(1, 1, 1); glow.disableLighting = true;
  const glass = new B.StandardMaterial('glass', scene);
  glass.diffuseColor = new B.Color3(0.75, 0.9, 1); glass.specularColor = new B.Color3(0.6, 0.6, 0.6); glass.specularPower = 64; glass.alpha = 0.28;
  glass.emissiveColor = new B.Color3(0.15, 0.2, 0.25); glass.backFaceCulling = false;
  const ghost = new B.StandardMaterial('ghost', scene); ghost.alpha = 0;  // 碰撞体（不可见）
  M = { solid, glow, glass, ghost, colored: {} };
  return M;
}
/** 单色材质（按颜色缓存），用于需要单独变色的动态物体 */
export function colorMat(scene, hexStr, { emissive = 0.08, glow = false } = {}) {
  const m = mats(scene), key = hexStr + (glow ? 'g' : '') + emissive;
  if (m.colored[key]) return m.colored[key];
  const mt = new B.StandardMaterial('c' + key, scene), c = B.Color3.FromHexString(hexStr);
  if (glow) { mt.diffuseColor = new B.Color3(0, 0, 0); mt.emissiveColor = c; mt.disableLighting = true; }
  else { mt.diffuseColor = c; mt.specularColor = new B.Color3(0.15, 0.15, 0.15); mt.emissiveColor = c.scale(emissive); }
  return (m.colored[key] = mt);
}
