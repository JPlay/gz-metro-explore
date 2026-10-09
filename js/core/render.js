/*
 * 渲染：环境光照（同源 .env）、天空穹顶、柔和的室内外灯光、后期（FXAA / 轻微泛光 / ACES 色调映射 / 暗角）、画质档位。
 * 美术方向：精致玩具感的写实——光照以“烘焙”为主（顶点 AO、贴地暗影、灯带光晕），实时阴影只给玩家和列车，且只在最高档。
 *   档位 0：1.5x 渲染、实时阴影、后期泛光+MSAA、法线贴图、地面反射探针
 *   档位 1：1.25x、无实时阴影（圆形软阴影）、后期泛光(弱)+FXAA、法线贴图、反射探针
 *   档位 2：1.0x、无后期（色调映射在材质里做）、无法线贴图、反射探针
 *   档位 3：0.8x、同上但不用反射探针（只用环境贴图）
 */
import { mats, setNormalMaps, tex } from './mats.js';
const B = window.BABYLON;
const lerp = (a, b, t) => a + (b - a) * t;

export class Render {
  constructor(engine, scene, cam) {
    this.engine = engine; this.scene = scene; this.cam = cam; this.tier = -1; this.indoor = 0; this.indoorTarget = 0; this.probes = [];
    scene.clearColor = new B.Color4(0.62, 0.78, 0.92, 1);
    const env = this.env = B.CubeTexture.CreateFromPrefilteredData('vendor/env/environmentSpecular.env', scene);
    env.name = 'env'; scene.environmentTexture = env; scene.environmentIntensity = 1.0;
    // 室内影棚环境延迟到第一次进站再加载，缩短首屏
    this.envIn = null; this._envInUrl = 'vendor/env/studio.env';
    const ip = scene.imageProcessingConfiguration;
    // 色调映射：Khronos PBR Neutral（比 ACES 更保色，线路色不发灰）+ 轻微提饱和度
    ip.toneMappingEnabled = true; ip.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL ?? B.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.0; ip.contrast = 1.12;
    ip.colorCurvesEnabled = true; const cc = new B.ColorCurves(); cc.globalSaturation = 22; cc.highlightsSaturation = 10; cc.shadowsHue = 220; cc.shadowsDensity = 6; cc.shadowsSaturation = 20; ip.colorCurves = cc;
    ip.vignetteEnabled = true; ip.vignetteWeight = 1.6; ip.vignetteStretch = 0.25; ip.vignetteColor = new B.Color4(0.05, 0.06, 0.1, 0); ip.vignetteCameraFov = 0.9;
    // 灯光：天光 + 主光（户外 = 太阳斜射；室内 = 头顶灯带的柔和顶光）
    const hemi = this.hemi = new B.HemisphericLight('hemi', new B.Vector3(0.15, 1, 0.1), scene);
    const sun = this.sun = new B.DirectionalLight('sun', new B.Vector3(-0.4, -1, 0.5), scene);
    sun.shadowMinZ = 1; sun.shadowMaxZ = 60; sun.autoUpdateExtends = false; sun.shadowFrustumSize = 22;
    const sg = this.sg = new B.ShadowGenerator(1024, sun);
    sg.usePercentageCloserFiltering = true; sg.filteringQuality = B.ShadowGenerator.QUALITY_LOW; sg.bias = 0.002; sg.normalBias = 0.02; sg.darkness = 0.45;
    sg.getShadowMap().refreshRate = 1;
    // 天空穹顶
    const sky = this.sky = B.MeshBuilder.CreateSphere('sky', { diameter: 800, segments: 16, sideOrientation: B.Mesh.BACKSIDE }, scene);
    const sm = new B.StandardMaterial('skyMat', scene); sm.disableLighting = true; sm.backFaceCulling = false; sm.fogEnabled = false;
    // 天空贴图上边 = 天顶、中线 = 地平线；FIXED_EQUIRECTANGULAR 下要 invertY=false 才是正的（否则云跑到地平线以下、看到的只有下半张的浅色）
    const st = new B.Texture('assets/tex/sky.jpg', scene, false, false, B.Texture.TRILINEAR_SAMPLINGMODE); st.coordinatesMode = B.Texture.FIXED_EQUIRECTANGULAR_MODE; sm.emissiveTexture = st; sm.diffuseColor = new B.Color3(0, 0, 0); sm.specularColor = new B.Color3(0, 0, 0);
    sm.emissiveColor = new B.Color3(0, 0, 0); st.level = 1.0; // emissiveColor 与贴图相加，必须为黑
    sky.material = sm; sky.infiniteDistance = true; sky.isPickable = false; sky.applyFog = false;
    sky.renderingGroupId = 0;
    this.pipeline = null;
    this.applyZone(0, true);
  }
  /** indoor: 0 = 户外，1 = 地下站内 */
  applyZone(f, snap) {
    const s = this.scene, h = this.hemi, sun = this.sun;
    h.intensity = lerp(0.65, 0.95, f);
    h.diffuse = B.Color3.Lerp(new B.Color3(0.95, 0.97, 1.0), new B.Color3(1.0, 0.98, 0.94), f);
    h.groundColor = B.Color3.Lerp(new B.Color3(0.55, 0.55, 0.5), new B.Color3(0.62, 0.62, 0.64), f);
    sun.intensity = lerp(2.4, 0.9, f);
    sun.diffuse = B.Color3.Lerp(new B.Color3(1.0, 0.95, 0.86), new B.Color3(1.0, 0.99, 0.96), f);
    const d = B.Vector3.Lerp(new B.Vector3(-0.42, -1, 0.55), new B.Vector3(-0.08, -1, 0.06), f).normalize(); sun.direction.copyFrom(d);
    s.environmentIntensity = lerp(1.0, 0.9, f);
    if (f > 0.5) this.preloadIndoor();
    const want = f > 0.5 && this.envIn ? this.envIn : this.env; if (s.environmentTexture !== want) s.environmentTexture = want;
    this.sky.setEnabled(f < 0.98);
  }
  /** 室内影棚环境贴图：首屏之后空闲时再加载（不占加载时间） */
  preloadIndoor() {
    if (this.envIn) return;
    this.envIn = B.CubeTexture.CreateFromPrefilteredData(this._envInUrl, this.scene); this.envIn.name = 'envIn';
  }
  update(dt, indoor, focus) {
    this.indoorTarget = indoor;
    const k = Math.min(1, dt * 2.5); const before = this.indoor;
    this.indoor += (this.indoorTarget - this.indoor) * k; if (Math.abs(this.indoor - this.indoorTarget) < 0.002) this.indoor = this.indoorTarget;
    if (before !== this.indoor) this.applyZone(this.indoor);
    // 阴影跟随玩家
    if (focus) { const d = this.sun.direction; this.sun.position.set(focus.x - d.x * 30, focus.y - d.y * 30, focus.z - d.z * 30); }
  }
  addShadowCaster(m) { this.sg.addShadowCaster(m, false); }
  setTier(t, quality) {
    if (t === this.tier) return; this.tier = t;
    const q = quality[t], dpr = window.devicePixelRatio || 1, s = this.scene;
    this.engine.setHardwareScalingLevel(1 / Math.min(dpr, q.scale));
    this.sun.shadowEnabled = !!q.shadows;
    setNormalMaps(!!q.normals);
    // 后期
    if (q.post && !this.pipeline) {
      const p = this.pipeline = new B.DefaultRenderingPipeline('pp', true, s, [this.cam]);
      p.imageProcessingEnabled = true;
      p.bloomEnabled = true; p.bloomThreshold = 0.82; p.bloomWeight = 0.28; p.bloomKernel = 48; p.bloomScale = 0.5;
      p.fxaaEnabled = true;
    }
    if (this.pipeline) {
      if (!q.post) { this.pipeline.dispose(); this.pipeline = null; }
      else { this.pipeline.samples = q.msaa || 1; this.pipeline.fxaaEnabled = !(q.msaa > 1); this.pipeline.bloomEnabled = !!q.bloom; this.pipeline.bloomWeight = q.bloom || 0; this.pipeline.bloomKernel = q.bloomKernel || 32; }
    }
    // 后期关闭时，色调映射 / 暗角由材质直接完成（Babylon 自动切换）
    this.useProbes = !!q.probes;
    this.refreshProbes();
  }
  /** 反射探针：每个车站静态渲染一次（站厅 / 站台各一个），带盒投影，给抛光地面做“镜面反射” */
  makeProbe(name, center, size, renderList, mat) {
    const p = new B.ReflectionProbe(name, 256, this.scene, true, false);
    p.position.copyFrom(center); p.refreshRate = B.RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    renderList.forEach(m => p.renderList.push(m));
    p.cubeTexture.boundingBoxSize = size; p.cubeTexture.boundingBoxPosition = center.clone();
    this.probes.push({ p, mat });
    if (this.useProbes) mat.reflectionTexture = p.cubeTexture;
    return p;
  }
  refreshProbes() {
    for (const { p, mat } of this.probes) { mat.reflectionTexture = this.useProbes ? p.cubeTexture : null; if (this.useProbes) p.cubeTexture.resetRefreshCounter(); }
  }
  disposeProbes() { for (const { p, mat } of this.probes) { mat.reflectionTexture = null; p.dispose(); } this.probes = []; }
}
