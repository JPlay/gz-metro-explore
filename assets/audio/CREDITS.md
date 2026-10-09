# 音频来源、许可与广州地铁广播核验

核验日期：2026-10-06。全部发布文件为本地 MP3；无密钥、签名下载 URL、外链音频。总文件体积与解码验证见 `_dev/STATUS-audio.md`。

## 语音合成

由阿里云百炼离线生成，非广州地铁原始录音，也未复刻真实播音员声音。

| 语言 | 模型 | 音色 |
|---|---|---|
| 普通话 | qwen3-tts-instruct-flash | Serena（平静、清晰、中等语速的播报指令） |
| 粤语 | qwen3-tts-flash | Kiki，官方标注“粤语·阿清” |
| 英语 | qwen3-tts-flash | Jennifer |

[百炼官方音色表](https://help.aliyun.com/zh/model-studio/qwen-tts-voice-list)明确列出 Kiki 支持中文粤语且适用于 qwen3-tts-flash；Instruct 系列未列出 Kiki，故没有将普通话音色强行用作粤语。[官方 HTTP API](https://help.aliyun.com/zh/model-studio/qwen-tts-api)用于制作。模型原始 WAV 仅在系统临时目录加工，发布文件经过 145 Hz 高通、6.5 kHz 低通、−19 LUFS 响度规整和短淡入，模拟车站/车厢广播扬声器的清晰度。每段文字、音色、模型和语言均在 manifest.json 中。

## 广播查证

- [1 号线西塱→广州东站全程报站，红茶w](https://www.bilibili.com/video/BV1fFjb6XE5C/)：发布于 2026-06-21，作者注明录于 2026 年 6 月，是本轮查证找到的新近版本参考；视频不下载到发布目录、不使用原始录音素材。
- [广州地铁报站示例](https://baike.baidu.com/item/广州地铁报站示例/22925408)：车内、站台、终点站与公园前专用指引的逐句汇总，并列出 1 号线录音来源。
- [广州地铁 2024 年 12 月线网图与乘车安全提示](https://www.gz.gov.cn/attachment/7/7792/7792268/10198947.pdf)：广州政府网站托管的广州地铁乘车资料，支持灯闪铃响、先下后上及空隙安全提示。
- [广州地铁一号线关门声音，程二次元](https://www.bilibili.com/video/BV1Dgb6e8E3y/)与[1 号线关门铃声纯享，小系统车迷](https://www.bilibili.com/video/BV1vA8ozkEC4/)：关门警示的参考。对第二段视频前 14.985 秒作离线频谱分析：约 860 Hz 高音 0.30 秒、645 Hz 低音 0.44 秒、静音 0.14 秒，约 0.88 秒重复。发布音效按此频率与节奏重新生成，谐波、扬声器染色与具体列车仍有差异。复测数据在 `_dev/tools/audio/reference-analysis.json`。未搬运视频音轨。

采用的事实性用语结构：终点方向→下一站→换乘/下车侧；普通话、粤语、英语依次播报。站台进站使用“X 站台 XX 方向列车即将进站”与“The train bound for XX is approaching at Platform X”。公园前单独提示右门下车、中部楼梯换乘 2 号线；东山口提示换乘 6 号线；其余三站提示左门下车。普通话到站使用“列车即将到达 XX 站”，而不是把其他线路常用的“XX 到了”声称为 1 号线原句。

为儿童体验扩展的部分：实际车厢有些安全/到站提示仅普通话，此项目为它们补齐粤语和英语；英语关门语句改为自然的“Please stand clear of the doors”；欢迎与先下后上合并为一次三语播放；终点站全部乘客下车指引补齐翻译；省略商业赞助与过时防疫宣传。完整措辞详见 manifest.json，不能将这些补齐段落宣称为逐字官方录音。四个游玩站都不是整条 1 号线的终点，terminal 始终播真实终点广州东站/西塱。

站台编号由场景提供。默认上行 1、下行 2 是此场景约定，未证明每个真实车站都遵循该编号。广州东站英语用 Railway Station；西塱粤语“塱”由真正粤语音色读取。未逐字核验实录里每个英译发音。

## CC0 真实环境录音

下列原作者页面在制作时均明确显示 **Creative Commons 0**，可复制、修改和发布。[CC0 1.0 许可](https://creativecommons.org/publicdomain/zero/1.0/)。只发布裁剪、滤波、重混的衍生 MP3，不发布完整原始录音。

| 原始录音与作者 | 原作链接 | 发布用途 |
|---|---|---|
| At dusk, busy and crowded small intersection · lastraindrop | https://freesound.org/people/lastraindrop/sounds/757820/ | street：130 秒起取 29 秒；concourse/train：170 秒起取 29 秒，削弱可辨文字，叠加通风与空间 |
| metro, Warszawa, 2017, Centrum station ambience, no trains, many people, kids, Poland · be_a_hero_not_a_patriot | https://freesound.org/people/be_a_hero_not_a_patriot/sounds/430984/ | platform：41 秒起取 29 秒，低通及远场混响，不同语言人声被压到远处 |
| long subway ride.MP3 · moxobna | https://freesound.org/people/moxobna/sounds/28205/ | train.roll：150 秒起取 9 秒，35–2400 Hz 滤波，加入低频轨道共鸣 |

这些实录来自广西、华沙、多伦多，提供真实车流/空间/轮轨纹理，**不是广州 1 号线的现场录音**。多伦多轮轨采样经 ASR 回转录检查：最初的 118 秒采样检测出异地报站，已替换为 150 秒起的无可辨广播段并复测；2.4 kHz 上限提取机械纹理，保留真实轮轨复杂性。循环接缝采用 550 ms 重叠交叉淡化。中国街道的远场人声作为站厅和车厢背景，避免伪造有明确语义的站内对话。

## 原创离线声学合成

`_dev/tools/audio/generate_soundscape.py` 以固定随机种子制作：通风、牵引逆变器谐波、轮轨低频、双转向架接缝、制动轻啸、进出站风压和立体声移动、瓷砖四种脚步、闸机/安检/售票提示、绿色塑料票币碰撞、闸机扇门、车门与屏蔽门、电笛。无第三方合成音效。全部用带限噪声、谐振、机械冲击包络及早期反射叠加，防止仅用单一白噪声冒充环境。

牵引层是对老式城市地铁电机听感的设计还原，不是对某辆 A1/A2/A3 牵引系统的精确工程仿真。没有将实录中的异地报站作为本项目的广播。关门警示按参考录音复测参数重新生成高低双音；不添加与关门无关的三音音乐铃。

鸣笛是可手动触发的 horn 音效；trainApproach 不自动鸣笛。1 号线正常进站已不采用必鸣笛的旧习惯，详见[1 号线运营历史](https://zh.wikipedia.org/wiki/广州地铁1号线)。

## 重制

```sh
python3 _dev/tools/audio/generate_voice.py
python3 _dev/tools/audio/generate_soundscape.py
python3 _dev/tools/audio/validate_assets.py
```

语音脚本只调用 `os.environ` 读取 DASHSCOPE_API_KEY / DASHSCOPE_HOST，不从项目文件或 Keychain 读取，不输出原始 API 响应、HTTP 请求头或下载签名 URL。当前 Codex 工具进程未继承变量，本轮通过内存读取已有 Codex 进程的同名环境变量后传给生成子进程；没有持久化凭据。重制时需让当前 shell 正确继承环境变量。

CC0 原始音频需置于系统临时目录 `/tmp/gz-audio-source/`，文件名 street.mp3、crowd.mp3、ride.mp3，且对应上表原作。可从原作页面公开的预览地址下载，运行时不需要 Freesound 账号。

## 第二轮：站内安全广播与空间声场

查证日期：2026-10-06。先查证，再调用百炼合成；6 条普通话 + 6 条粤语使用相同真实粤语音色 Kiki。逐段 ASR 结果见 `_dev/tools/audio/transcription-round2.json`，12 条均识别到预期内容（繁简和标点差异除外）。ASR 是内容校验，不代替广州本地人对音色和发音的最终听审。

- [广州地铁官方《乘车安全指引》](https://apppax.gzmtr.cn/DNSFile/wechat/guide/ccaq_index.html)：核验站内通行、同行老人小孩、屏蔽门和灯闪铃响的用语；这四条普通话从指引摘取，标点调整为可播读形式。没有证据证明它们是当前四站的逐字自动广播稿。
- [2017-01-17《广州地铁启动安静模式》报道，广州日报记者李天研，新华网/新浪转载](https://finance.sina.cn/2017-01-17/detail-ifxzqhka3267180.d.html)：记录扶梯提示“请站稳，并握紧黑色扶手带，请勿在扶梯口处停留”，以及黄线/地面标识两句候车提示。体验保留这些历史真实措辞。报道同时说明广州地铁当时已减少广播、撤去扶梯循环喇叭；本项目的间隔循环为用户指定的体验重建，不宣称四站在2026年仍逐字循环这些句子。
- 粤语是与这些已核验中文提示同义的粤语译写，包含“企稳”“唔好”“喺”“嘅”“上落”等自然粤语措辞；不是已核验的运营方粤语原稿，不克隆原播音员。
- 2026-10-09 起全部报站改用 CosyVoice 播报风格（VOICE_STYLE=cosy：普通话 / 英语 cosyvoice-v2 longxiaobai_v2，粤语 cosyvoice-v3-flash longjiayi_v3）。longjiayi_v3 会把“嘅”读成近似“慨 / 海”、“喺”“唔好”也读不准（多次重合成、换粤语音色均复现；SSML phoneme 只支持普通话拼音），所以粤语改用正式播报措辞：“嘅”→“的”，“喺呢一站”→“在本站”，“唔好”→“请勿 / 勿”（地铁实际粤语广播亦属书面语读法），逐句 ASR 回读核对。

新增扶梯驱动链、牵引逆变器分级升调、轮缘接触摩擦和停稳气制动阀放气均为原创离线声学设计，不冒称广州1号线 A1 真车采样。门机械声按照 world 提供的1.25秒行程重制，闸机扇门0.60秒；关门警示双音仍独立3.62秒。空间传播使用浏览器 PannerNode HRTF、距离衰减、头顶朝下广播喇叭和安静的早期反射；普通环境底声仍为扩散声场，不绑定玩家脑内单点。
