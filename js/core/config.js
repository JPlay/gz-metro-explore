// 全局配置：所有模块只读。改一行就能切换行为。
const params = new URLSearchParams(location.search);

export const CONFIG = {
  version: '1.0.0',
  threeVersion: '0.160.0',
  // 渲染：devicePixelRatio 上限 2，帧率不够时自动逐级降低（见 renderer.js）
  dprMax: 2,
  qualityLevels: [
    { dpr: 2, shadows: true },
    { dpr: 1.5, shadows: true },
    { dpr: 1.25, shadows: false },
    { dpr: 1, shadows: false }
  ],
  // ?q=0..3 固定画质档位（测试/截图用）；默认自适应
  fixedQuality: params.has('q') ? Math.max(0, Math.min(3, +params.get('q') || 0)) : null,
  // 小乘客步行速度（格/秒）
  walkSpeed: 2.3,
  // 广播片段缺失时的替代方式：'webspeech' 用浏览器朗读（移植自旧版 index.html 的 announce），
  // 'caption' 只显示三语字幕不出声。改这一行即可切换。
  VOICE_FALLBACK: 'webspeech',
  // 闲置多少秒后自动出现提示手势
  hintIdleSeconds: 6,
  debug: params.has('debug'),
  storageKey: 'gz-metro-explore-v1'
};
