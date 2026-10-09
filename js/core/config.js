// 全局配置：所有模块只读。改一行就能切换行为。
const params = new URLSearchParams(location.search);

export const CONFIG = {
  version: '2.0.0',
  // 画质档位（帧率低于 45 自动降一档）：scale = 渲染分辨率相对 CSS 像素的倍数（iPad DPR 2，最高只用 1.5 倍）
  //   shadows 实时阴影（只投玩家和列车）  post 后期管线  msaa 多重采样  bloom 泛光强度  normals 法线贴图  probes 地面反射探针
  qualityLevels: [
    { scale: 1.5, shadows: true, post: true, msaa: 4, bloom: 0.3, bloomKernel: 48, normals: true, probes: true },
    { scale: 1.25, shadows: false, post: true, msaa: 1, bloom: 0.2, bloomKernel: 32, normals: true, probes: true },
    { scale: 1.0, shadows: false, post: false, normals: false, probes: true },
    { scale: 0.8, shadows: false, post: false, normals: false, probes: false }
  ],
  // ?q=0..3 固定画质档位（测试/截图用）；默认自适应
  fixedQuality: params.has('q') ? Math.max(0, Math.min(3, +params.get('q') || 0)) : null,
  walkSpeed: 3.0,     // 米/秒（摇杆推到 75% 以内按比例）
  runSpeed: 6.2,      // 摇杆推到尽头 / Shift
  jumpSpeed: 7.2,
  gravity: 22,
  // 广播片段缺失时的替代方式：'webspeech' 用浏览器朗读（移植自旧版 index.html 的 announce），'caption' 只显示字幕
  VOICE_FALLBACK: 'webspeech',
  debug: params.has('debug'),
  // ?start=<车站code>&line=<1|2> 从某站站台开始（测试用）；默认在公园前站口外的街上
  start: params.get('start') || null,
  startLine: +(params.get('line') || 1),
  storageKey: 'gz-metro-3d-v1'
};
