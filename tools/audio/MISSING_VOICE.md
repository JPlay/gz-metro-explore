# 缺失的报站语音片段

由 `node tools/audio/export_jobs.mjs` 生成。全网共需 407 条片段，已有 MP3 407 条，缺 0 条（普通话 0 / 粤语 0 / 英语 0）。
缺失片段在游戏里自动用 Web Speech 朗读（zh-CN → zh-HK（若有）→ en-US（若有），语速 0.95），并照常显示字幕。

生成方法：设置环境变量 DASHSCOPE_API_KEY 后运行 `python3 tools/audio/generate_voice.py`（会读取 voice-jobs.json，只生成缺的）。

| id | 语言 | 文本 |
| --- | --- | --- |
