/*
 * Babylon.js 加载器（普通脚本，无构建步骤）。
 * 依次尝试：jsDelivr → unpkg → 同源备份 vendor/babylonjs/<版本>/babylon.js。
 * 每个来源 4 秒内必须开始响应（拿到响应头），否则换下一个；下载中途 8 秒无进度也换下一个。
 * 用 fetch 下载（可显示进度），成功后以 Blob URL 注入 <script>，再动态 import 游戏主模块 js/main.js。
 * 调试：?bjs=jsdelivr|unpkg|vendor 强制只用某个来源。实际来源记录在 window.__babylonSource。
 */
(function () {
  'use strict';
  var VERSION = '9.28.0';
  var SOURCES = [
    { id: 'jsdelivr', url: 'https://cdn.jsdelivr.net/npm/babylonjs@' + VERSION + '/babylon.js' },
    { id: 'unpkg', url: 'https://unpkg.com/babylonjs@' + VERSION + '/babylon.js' },
    { id: 'vendor', url: 'vendor/babylonjs/' + VERSION + '/babylon.js' }
  ];
  var HEADER_TIMEOUT = 4000, STALL_TIMEOUT = 8000;
  var force = (location.search.match(/[?&]bjs=(\w+)/) || [])[1];
  var list = force ? SOURCES.filter(function (s) { return s.id === force; }) : SOURCES;
  var bar = document.getElementById('loadBar'), msg = document.getElementById('loadMsg');
  window.__babylonVersion = VERSION;
  window.__babylonAttempts = [];

  function setMsg(t) { if (window.__loadUI) window.__loadUI.set(null, t); else if (msg) msg.textContent = t; }
  function setBar(f) { if (window.__loadUI) window.__loadUI.set(f); else if (bar) bar.style.width = Math.max(3, Math.min(100, f * 100)).toFixed(1) + '%'; }
  function fail(t) { var l = document.getElementById('loading'); if (l) l.className = 'err'; setMsg(t); }

  function viaScriptTag(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.async = true;
      var t = setTimeout(function () { s.onload = s.onerror = null; rej(new Error('timeout')); }, HEADER_TIMEOUT * 4);
      s.onload = function () { clearTimeout(t); window.BABYLON ? res() : rej(new Error('no BABYLON')); };
      s.onerror = function () { clearTimeout(t); rej(new Error('script error')); };
      document.head.appendChild(s);
    });
  }

  function load(src, idx) {
    if (!window.fetch || !window.AbortController || !window.ReadableStream) return viaScriptTag(src.url);
    var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, HEADER_TIMEOUT);
    return fetch(src.url, { signal: ctrl.signal, mode: 'cors', credentials: 'omit' }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var total = +r.headers.get('content-length') || 8600000, got = 0, chunks = [];
      var reader = r.body.getReader();
      return new Promise(function (res, rej) {
        var stall = setTimeout(function () { ctrl.abort(); rej(new Error('stalled')); }, STALL_TIMEOUT);
        function pump() {
          reader.read().then(function (x) {
            clearTimeout(stall);
            if (x.done) return res(new Blob(chunks, { type: 'text/javascript' }));
            chunks.push(x.value); got += x.value.length;
            setBar(0.05 + 0.40 * Math.min(1, got / (total > got ? total : got * 1.15)));
            stall = setTimeout(function () { ctrl.abort(); rej(new Error('stalled')); }, STALL_TIMEOUT);
            pump();
          }, function (e) { clearTimeout(stall); rej(e); });
        }
        pump();
      });
    }).then(function (blob) {
      var u = URL.createObjectURL(blob);
      return viaScriptTag(u).then(function () { URL.revokeObjectURL(u); });
    }, function (e) { clearTimeout(timer); throw e; });
  }

  function next(i) {
    if (i >= list.length) { fail('列车暂时开不过来，请检查网络后刷新页面。'); return; }
    var src = list[i], t0 = performance.now();
    setMsg(i === 0 ? '列车正在进站…' : '换一条轨道，列车马上就到…');
    load(src, i).then(function () {
      window.__babylonSource = src.id;
      window.__babylonAttempts.push({ id: src.id, ok: true, ms: Math.round(performance.now() - t0) });
      (window.__loadT = window.__loadT || {}).babylon = Math.round(performance.now());
      setBar(0.48); setMsg('正在打开闸机…');
      return import('./main.js').then(function (m) { return m.start(); });
    }, function (e) {
      window.__babylonAttempts.push({ id: src.id, ok: false, error: String(e && e.message || e), ms: Math.round(performance.now() - t0) });
      next(i + 1);
    }).catch(function (e) {
      console.error(e); fail('哎呀，车站没开好，请刷新页面再试一次。');
    });
  }
  next(0);
})();
