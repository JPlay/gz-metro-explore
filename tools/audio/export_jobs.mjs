// 从 js/data/phrases.js 导出全网报站片段 → tools/audio/voice-jobs.json，并对照 manifest 写出缺失清单 MISSING_VOICE.md。
// 用法：node tools/audio/export_jobs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
const { allJobs } = await import(path.join(root, 'js/data/phrases.js'));
const jobs = allJobs();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/audio/manifest.json'), 'utf8'));
const have = new Set(manifest.assets.filter(a => a.group === 'voice' && fs.existsSync(path.join(root, 'assets/audio', a.file))).map(a => a.id));
const missing = jobs.filter(j => !have.has(j.id));
fs.writeFileSync(path.join(here, 'voice-jobs.json'), JSON.stringify(jobs, null, 1) + '\n');
const byLang = l => missing.filter(j => j.lang === l).length;
let md = `# 缺失的报站语音片段\n\n由 \`node tools/audio/export_jobs.mjs\` 生成。全网共需 ${jobs.length} 条片段，已有 MP3 ${jobs.length - missing.length} 条，缺 ${missing.length} 条（普通话 ${byLang('zh')} / 粤语 ${byLang('yue')} / 英语 ${byLang('en')}）。\n缺失片段在游戏里自动用 Web Speech 朗读（zh-CN → zh-HK（若有）→ en-US（若有），语速 0.95），并照常显示字幕。\n\n生成方法：设置环境变量 DASHSCOPE_API_KEY 后运行 \`python3 tools/audio/generate_voice.py\`（会读取 voice-jobs.json，只生成缺的）。\n\n| id | 语言 | 文本 |\n| --- | --- | --- |\n`;
for (const j of missing) md += `| ${j.id} | ${j.lang} | ${j.text.replace(/\|/g, '\\|')} |\n`;
fs.writeFileSync(path.join(here, 'MISSING_VOICE.md'), md);
console.log(`jobs=${jobs.length} have=${jobs.length - missing.length} missing=${missing.length}`);
