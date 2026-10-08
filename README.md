# 一号线 · 方块奇境（Line 1 · Shape City）

一款给孩子玩的网页小游戏：在柔和的几何方块城市里坐**广州地铁一号线**，每到一站就解一个“视错觉”小谜题，把小乘客送到站台门前，列车进站、开门、上车，伴着熟悉的**普通话 → 粤语 → 英语**报站驶向下一站。

画面风格参考《纪念碑谷》：粉彩配色、正等轴测正交相机、只在“看起来对齐”时才连通的错觉路径、可以拖动的旋转台 / 滑块 / 摇柄，以及安静从容的节奏。

- 单页、零安装、零构建：原生 ES Modules + import map，three.js 固定在 `0.160.0`
- 触屏优先，按 iPad Air 3（1112×834 CSS px，横屏）调校，竖屏也能正常游玩
- 不需要识字：发光提示、小手动画、闲置 6 秒自动提示

## 怎么玩

1. 标题页点“出发”（这一下同时解锁 iOS 的声音）。
2. 进入方块城：黄色高架环线上跑着一号线列车，四座小岛就是四个车站。点小岛或下方的车站卡片出发。
3. 每一站：**点地面**让小乘客走过去（自动寻路），**拖动**发光的机关改变道路，走到闪光的站台门前，列车就会进站。

| 站 | 场景 | 谜题 |
| --- | --- | --- |
| 🌳 公园前 | 换乘枢纽 + 公园大树 | 拖动旋转桥，转 90° 接上对岸 |
| 🏮 农讲所 | 红墙庭院 | 站上石板，拖动红灯笼把石板滑到对面 |
| 🌺 烈士陵园 | 花园 + 纪念拱门 | 放下吊桥，桥头与高台在视觉上对齐即可走过（错觉路径） |
| 🏡 东山口 | 洋楼屋顶 | 站上升降台，转动摇柄升到屋顶，再从“看起来相连”的屋顶走到站台 |

四站都完成后回到方块城，城市变换形状庆祝。

## 本地运行

不需要安装任何依赖，用任意静态服务器即可（ES Modules 不能用 `file://` 打开）：

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000/
```

URL 参数（调试用）：

- `?q=0..3`：固定画质档位（0 = DPR 2 + 阴影，3 = DPR 1 无阴影）；不写则自动降档
- `?three=jsdelivr|unpkg|vendor`：强制 three.js 来源

## 部署

纯静态文件，直接部署到 Cloudflare Pages / GitHub Pages 即可（根目录，不需要构建命令）。所有音频和资源都是同源文件；不使用 Google Fonts、统计脚本或其他第三方请求。

### three.js 加载回退链

`js/boot.js` 依次尝试（每个来源约 4 秒超时）：

1. jsDelivr `cdn.jsdelivr.net/npm/three@0.160.0`
2. unpkg `unpkg.com/three@0.160.0`
3. 同源备份 `vendor/three/0.160.0/three.module.min.js`

成功后生成 blob URL 并动态注入 import map，再加载 `js/main.js`。实际使用的来源记录在 `window.__threeSource`。

## 目录结构

```
index.html              单页入口（HUD、标题、选站、字幕、提示层）
css/app.css             粉彩 UI、圆形大按钮、竖屏适配
js/boot.js              three.js CDN 回退加载器 + 动态 import map
js/main.js              Game：状态机（标题 → 城市 → 行车 → 车站 → 行车 … → 庆祝）、灯光、进度存档
js/core/                config 配置 · tween 缓动 · loop 主循环 · renderer 自适应画质 · camera 等轴测相机 · input 触摸/指针手势
js/world/               blocks 圆角方块几何与材质 · pathgraph 路径图与 A* · mechanisms 旋转台/滑块/摇柄 · props 列车/轨道/树/拱门/洋楼等
js/characters/          figure 小人模型 · walker 寻路行走 · passenger 小乘客 · npc 闲逛/排队 NPC
js/scenes/              hub 方块城 · ride 行车 · station-base 车站通用流程 · station-*.js 四个车站谜题 · stations 车站表
js/audio/               audio 音频引擎（PA 滤波混响、队列、打断、LRU、iOS 解锁、字幕事件）· announcements 报站逻辑 · webspeech 缺失语音回退 · ambience 环境声
js/ui/                  i18n 三语文字 · captions 字幕 · hints 提示动画 · hud · title · station-picker
assets/audio/           manifest.json + 语音（90 条）+ 音效 + 列车声 + 环境声，CREDITS.md 为来源说明
tools/audio/            generate_voice.py 语音生成脚本（DashScope）
vendor/three/0.160.0/   three.js 同源备份（MIT）
```

## 核心设计

- **等轴测与错觉**：相机沿 (1,1,1) 方向正交投影，世界里相差 k·(1,1,1) 的点在屏幕上重合。每块可走地砖在四条边中点有“端口”；两个端口在屏幕上重合且朝向相反就连通——世界里也重合是普通连接，只在屏幕上重合就是**错觉连接**。机关转动、滑动结束后整张路径图重新计算。
- **寻路**：A*（屏幕距离启发），行走时每一步都重新校验连接，机关动了会重新规划；站在机关上的小乘客会跟着机关一起移动。
- **机关**：旋转台按屏幕角度拖动并吸附到 90°；滑块沿投影轴拖动；摇柄画圈驱动滑块（顺时针上升）。松手后带回弹缓动吸附。
- **性能**：DPR 上限 2，帧率低于 48 时自动逐档降低（2 → 1.5 → 1.25 无阴影 → 1）；Lambert 材质、一盏平行光 + 半球光；阴影贴图只在场景变化时更新；无后期处理。

## 报站语音

沿用旧项目的方案：DashScope 预生成 mp3，顺序为普通话 → 粤语 → 英语，经过车站广播（PA）滤波与混响链播放，支持排队、优先级打断、LRU 缓存、iOS 首次手势解锁，并通过 `gz-audio-caption` 事件显示三语字幕。

| 语言 | 模型 | 音色 |
| --- | --- | --- |
| 普通话 | qwen3-tts-instruct-flash（带 INSTRUCTION） | Serena |
| 粤语 | qwen3-tts-flash | Kiki |
| 英语 | qwen3-tts-flash | Jennifer |

本版复用旧项目全部 90 条语音，没有新增语音。若以后新增报站：在 `tools/audio/generate_voice.py` 的任务列表里加条目，然后运行

```bash
DASHSCOPE_API_KEY=... python3 tools/audio/generate_voice.py            # 可选 DASHSCOPE_HOST，默认 dashscope.aliyuncs.com
python3 tools/audio/generate_voice.py --only <id 片段>                  # 只生成部分
python3 tools/audio/generate_voice.py --manifest-only                   # 只重写 manifest
```

**缺失语音的回退**：`js/core/config.js` 中 `VOICE_FALLBACK = 'webspeech' | 'caption'`（默认 `'webspeech'`）。只有在某条 mp3 缺失或加载失败时才会启用：`webspeech` 用旧版 `announce(zh, yue, en)` 的 Web Speech 逻辑朗读，`caption` 只静默显示三语字幕。静音状态下同样只显示字幕。

## 已知限制

- 需要支持 import map 的浏览器（iPadOS / Safari 16.4 及以上）；更旧的系统会显示提示页。
- 只在桌面 Chromium（模拟 iPad 触屏）里做过自动化测试，尚未在真机 iPad 上验证手感与帧率。
- 彭罗斯三角目前是方块城中央的雕塑，还不是可以行走的楼梯。
- 未移植旧版的 HRTF 空间音频和车站安全广播调度器。
- 谜题刻意设计得简单（每站一个机关），适合 6～9 岁；没有关卡编辑器。

## 致谢与许可

代码以 MIT 许可发布（见 `LICENSE`）。音频来源与许可见 `assets/audio/CREDITS.md`；three.js 为 MIT 许可（见 `vendor/three/0.160.0/LICENSE`）。
