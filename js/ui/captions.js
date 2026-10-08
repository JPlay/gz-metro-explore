// 广播字幕：监听音频引擎的 gz-audio-caption 事件，显示当前片段的文字和语言标记。
const BADGE = { zh: '普', yue: '粤', en: 'EN' };
export function initCaptions() {
  const el = document.getElementById('caption'), langEl = el.querySelector('.lang'), textEl = el.querySelector('.text');
  let hideTimer = null;
  window.addEventListener('gz-audio-caption', e => {
    const d = e.detail;
    clearTimeout(hideTimer);
    if (!d) { hideTimer = setTimeout(() => { el.hidden = true; }, 400); return; }
    langEl.textContent = BADGE[d.lang] || d.lang;
    textEl.textContent = d.text;
    el.classList.toggle('silent', !!d.silent);
    el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  });
}
