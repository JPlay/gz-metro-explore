/*
 * Web Speech 备用朗读：只在某段报站 MP3 不存在时使用（config.VOICE_FALLBACK === 'webspeech'）。
 * 忠实移植自旧项目 index.html 的 announce(zh, yue, en)：
 *   speechSynthesis.cancel(); 然后依次 zh-CN（总是）、zh-HK（仅当存在 zh-hk 声音）、en-US（仅当存在 en 声音），
 *   rate 0.95，不指定具体声音。
 */
function hasVoice(pre) {
  try { return speechSynthesis.getVoices().some(v => v.lang.replace('_', '-').toLowerCase().indexOf(pre) === 0); } catch (e) { return false; }
}
export function available() { return typeof window !== 'undefined' && !!window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined'; }

/** 旧版原样接口：一次三语 */
export function announce(zh, yue, en) {
  if (!available()) return;
  try {
    speechSynthesis.cancel();
    [[zh, 'zh-CN', true], [yue, 'zh-HK', hasVoice('zh-hk')], [en, 'en-US', hasVoice('en')]].forEach(a => {
      if (!a[0] || !a[2]) return;
      const u = new SpeechSynthesisUtterance(a[0]); u.lang = a[1]; u.rate = 0.95; speechSynthesis.speak(u);
    });
  } catch (e) {}
}

const LANG = { zh: ['zh-CN', () => true], yue: ['zh-HK', () => hasVoice('zh-hk')], en: ['en-US', () => hasVoice('en')] };
/** 单段朗读（报站队列逐段调用）；没有对应声音时返回 false，由调用方只显示字幕 */
export function speakClip(text, lang, timeoutMs = 12000) {
  return new Promise(resolve => {
    if (!available() || !text) return resolve(false);
    const spec = LANG[lang] || LANG.zh;
    if (!spec[1]()) return resolve(false);
    let done = false; const finish = ok => { if (!done) { done = true; clearTimeout(t); resolve(ok); } };
    const t = setTimeout(() => finish(true), timeoutMs);
    try {
      const u = new SpeechSynthesisUtterance(text); u.lang = spec[0]; u.rate = 0.95;
      u.onend = () => finish(true); u.onerror = () => finish(false);
      speechSynthesis.speak(u);
    } catch (e) { finish(false); }
  });
}
export function cancel() { try { if (available()) speechSynthesis.cancel(); } catch (e) {} }
/** iOS 需要在第一次手势里“唤醒”朗读引擎 */
export function prime() { try { if (!available()) return; const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {} }
