/*
 * 共享材质库（不随车站重建销毁）。PBR（金属度/粗糙度）+ 顶点色 + 程序化贴图（assets/tex，见 tools/textures）。
 * 每个“桶”= 一种材质 = 每个车站 1 个合并网格。
 *   paint 漆面/塑料（纯顶点色）  floor 花岗岩地砖（站内，带反射探针）  pave 人行道铺装  tactile 盲道
 *   ceiling 铝扣板  wall 搪瓷钢板  metal 拉丝不锈钢  concrete 混凝土  brick 红砖  asphalt 沥青  grass 草地  facade 楼房立面
 *   glass 玻璃  glow 自发光（灯带、屏幕）  halo 灯带光晕（叠加）  shade 贴地柔和暗影（烘焙 AO）
 */
const B = window.BABYLON;
let M = null;
// 贴图对应的真实尺寸（米）
export const TEX = {
  floor: { file: 'floor', size: 1.2, normal: true }, pave: { file: 'paving', size: 1.2, normal: true }, tactile: { file: 'tactile', size: 0.3, normal: true },
  ceiling: { file: 'ceiling', size: 1.2, normal: true }, wall: { file: 'wall', size: 2.4, normal: true }, metal: { file: 'steel', size: 1.0 },
  concrete: { file: 'concrete', size: 2.5 }, brick: { file: 'brick', size: 1.0, normal: true }, asphalt: { file: 'asphalt', size: 4 },
  grass: { file: 'grass', size: 2.5 }, facade: { file: 'facade', size: 6 }
};
const PBR = {
  paint: { rough: 0.55, metal: 0 }, floor: { rough: 0.16, metal: 0, env: 0.9 }, pave: { rough: 0.85, metal: 0 }, tactile: { rough: 0.6, metal: 0 },
  ceiling: { rough: 0.45, metal: 0.15 }, wall: { rough: 0.22, metal: 0, env: 0.8 }, metal: { rough: 0.3, metal: 1 }, concrete: { rough: 0.92, metal: 0 },
  gloss: { rough: 0.1, metal: 0, env: 1.0 }, brick: { rough: 0.85, metal: 0 }, asphalt: { rough: 0.9, metal: 0 }, grass: { rough: 0.95, metal: 0 }, facade: { rough: 0.6, metal: 0 }
};
export const BUCKETS = ['paint', 'gloss', 'floor', 'pave', 'tactile', 'ceiling', 'wall', 'metal', 'concrete', 'brick', 'asphalt', 'grass', 'facade', 'glass', 'glow', 'halo', 'shade'];
const texCache = {};
export function tex(scene, file, ext = 'jpg') {
  const k = file + '.' + ext; if (texCache[k]) return texCache[k];
  const t = new B.Texture('assets/tex/' + k, scene, false, true, B.Texture.TRILINEAR_SAMPLINGMODE);
  t.anisotropicFilteringLevel = 8;
  return (texCache[k] = t);
}
function pbr(name, scene, o) {
  const m = new B.PBRMaterial(name, scene);
  m.albedoColor = new B.Color3(1, 1, 1); m.metallic = o.metal; m.roughness = o.rough;
  m.environmentIntensity = o.env ?? 0.75; m.maxSimultaneousLights = 2; m.enableSpecularAntiAliasing = false;
  m.useHorizonOcclusion = false; m.useRadianceOcclusion = false;
  return m;
}
export function mats(scene) {
  if (M) return M;
  M = { colored: {}, normals: [] };
  for (const [k, o] of Object.entries(PBR)) {
    const m = M[k] = pbr(k, scene, o), T = TEX[k];
    if (T) {
      const t = tex(scene, T.file); t.uScale = t.vScale = 1 / T.size; m.albedoTexture = t;
      if (T.normal) { const n = tex(scene, T.file + '_n'); n.uScale = n.vScale = 1 / T.size; m._normalTex = n; m.bumpTexture = n; n.level = 0.7; M.normals.push(m); m.invertNormalMapY = false; }
    }
  }
  M.solid = M.paint; // 兼容旧名字
  const glass = M.glass = new B.PBRMaterial('glass', scene);
  glass.albedoColor = new B.Color3(0.72, 0.84, 0.9); glass.metallic = 0; glass.roughness = 0.06; glass.alpha = 0.18; glass.environmentIntensity = 0.5;
  glass.useRadianceOverAlpha = true; glass.useSpecularOverAlpha = true; glass.backFaceCulling = false; glass.environmentIntensity = 1.0; glass.maxSimultaneousLights = 2;
  const glow = M.glow = new B.StandardMaterial('glow', scene);
  glow.diffuseColor = new B.Color3(0, 0, 0); glow.specularColor = new B.Color3(0, 0, 0); glow.emissiveColor = new B.Color3(1, 1, 1); glow.disableLighting = true;
  // 发光件基本都是贴在面上的薄片（灯带、屏幕、地面引导带）：加一点多边形偏移，低精度深度（iPad）下也压得住底下的面
  glow.zOffset = -1; glow.zOffsetUnits = -2;
  // 换乘地面引导带 + V 形箭头单独一个材质：偏移比贴地暗影（shade，zOffset −2、不写深度）更强。
  //   以前和灯带共用 glow（−1）：掠射角下暗影的斜率偏移比引导带还大，暗影一片片“盖”到色带上，走动时像闪
  const band = M.band = glow.clone('band'); band.zOffset = -4; band.zOffsetUnits = -4;
  const halo = M.halo = new B.StandardMaterial('halo', scene);
  halo.diffuseColor = new B.Color3(0, 0, 0); halo.specularColor = new B.Color3(0, 0, 0); halo.emissiveColor = new B.Color3(1, 1, 1); halo.disableLighting = true;
  halo.alphaMode = B.Engine.ALPHA_ADD; halo.alpha = 0.999; halo.backFaceCulling = false; halo.disableDepthWrite = true;
  const shade = M.shade = new B.StandardMaterial('shade', scene);
  shade.diffuseColor = new B.Color3(0, 0, 0); shade.specularColor = new B.Color3(0, 0, 0); shade.emissiveColor = new B.Color3(0, 0, 0); shade.disableLighting = true;
  shade.alpha = 0.999; shade.disableDepthWrite = true; shade.zOffset = -2;
  const ghost = M.ghost = new B.StandardMaterial('ghost', scene); ghost.alpha = 0;
  // 贴地圆形阴影（玩家 / 走动的 NPC）
  const blob = M.blob = new B.StandardMaterial('blob', scene);
  blob.diffuseColor = new B.Color3(0, 0, 0); blob.specularColor = new B.Color3(0, 0, 0); blob.disableLighting = true;
  blob.opacityTexture = tex(scene, 'blob', 'png'); blob.disableDepthWrite = true; blob.zOffset = -3; blob.alpha = 0.55;
  // 只冻运行时参数不变的标准材质（PBR 会随画质档切换法线/探针，不能冻）
  for (const k of ['glow', 'band', 'halo', 'shade', 'blob', 'ghost']) {
    if (M[k] && M[k].freeze) try { M[k].freeze(); } catch (_) {}
  }
  return M;
}
/** 法线贴图开关（低画质档关掉省带宽） */
export function setNormalMaps(on) { if (!M) return; for (const m of M.normals) m.bumpTexture = on ? m._normalTex : null; }
/** 单色材质（按颜色缓存），用于需要单独变色的动态物体 */
export function colorMat(scene, hexStr, { emissive = 0.0, glow = false, rough = 0.5, metal = 0 } = {}) {
  const m = mats(scene), key = hexStr + (glow ? 'g' : '') + emissive + '_' + rough + '_' + metal;
  if (m.colored[key]) return m.colored[key];
  const c = B.Color3.FromHexString(hexStr);
  let mt;
  if (glow) { mt = new B.StandardMaterial('c' + key, scene); mt.diffuseColor = new B.Color3(0, 0, 0); mt.specularColor = new B.Color3(0, 0, 0); mt.emissiveColor = c; mt.disableLighting = true; }
  else { mt = pbr('c' + key, scene, { rough, metal }); mt.albedoColor = c.toLinearSpace(); if (emissive) mt.emissiveColor = c.scale(emissive); }
  return (m.colored[key] = mt);
}
