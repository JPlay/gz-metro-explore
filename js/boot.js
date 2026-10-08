/*
 * 启动加载器（普通脚本，不是模块）。
 * 1. 依次尝试 three.js 的三个来源：jsDelivr → unpkg → 同源 vendor/ 拷贝；
 *    每个来源 4 秒内必须开始响应（正文最多再等 20 秒），超时/失败立即换下一个，
 *    这样某个 CDN 在国内卡住时也不会让页面一直白屏。
 * 2. 把下载到的源码做成 blob: URL，动态写入 <script type="importmap">，
 *    再插入 js/main.js 模块。全程无构建步骤。
 * 可用 ?three=vendor|unpkg|jsdelivr 强制指定来源（测试用）。
 */
(function () {
  'use strict';
  var VERSION = '0.160.0';
  var base = document.baseURI;
  var SOURCES = [
    { name: 'jsdelivr', url: 'https://cdn.jsdelivr.net/npm/three@' + VERSION + '/build/three.module.min.js' },
    { name: 'unpkg', url: 'https://unpkg.com/three@' + VERSION + '/build/three.module.min.js' },
    { name: 'vendor', url: new URL('vendor/three/' + VERSION + '/three.module.min.js', base).href }
  ];
  var HEAD_TIMEOUT = 4000, BODY_TIMEOUT = 20000;
  var bootText = document.getElementById('bootText');
  var params = new URLSearchParams(location.search);
  var forced = params.get('three');
  if (forced) SOURCES = SOURCES.filter(function (s) { return s.name === forced; }).concat(SOURCES.filter(function (s) { return s.name !== forced; }));

  function fail(msg) {
    var f = document.getElementById('fatal'), t = document.getElementById('fatalText');
    if (t) t.textContent = msg;
    if (f) f.hidden = false;
    var b = document.getElementById('boot'); if (b) b.hidden = true;
  }
  window.addEventListener('error', function (e) { if (!window.__gameStarted) fail('加载出错：' + (e.message || '未知错误')); });

  var supportsImportMap = !!(window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('importmap'));
  if (!supportsImportMap) { fail('这个浏览器太旧了，请把 iPad 升级到 iPadOS 16.4 或更新版本再打开。'); return; }

  function fetchWithTimeout(src) {
    return new Promise(function (resolve, reject) {
      var ctrl = window.AbortController ? new AbortController() : null;
      var done = false;
      var t1 = setTimeout(function () { if (!done) { done = true; if (ctrl) ctrl.abort(); reject(new Error('timeout')); } }, HEAD_TIMEOUT);
      fetch(src.url, { mode: 'cors', credentials: 'omit', cache: 'default', signal: ctrl ? ctrl.signal : undefined }).then(function (r) {
        clearTimeout(t1);
        if (done) return;
        if (!r.ok) { done = true; reject(new Error('HTTP ' + r.status)); return; }
        var t2 = setTimeout(function () { if (!done) { done = true; if (ctrl) ctrl.abort(); reject(new Error('body timeout')); } }, BODY_TIMEOUT);
        r.text().then(function (txt) {
          clearTimeout(t2);
          if (done) return; done = true;
          if (txt.length < 100000 || txt.indexOf('REVISION') === -1 && txt.indexOf('"160"') === -1 && txt.indexOf("'160'") === -1) { reject(new Error('bad body')); return; }
          resolve(txt);
        }, function (e) { clearTimeout(t2); if (!done) { done = true; reject(e); } });
      }, function (e) { clearTimeout(t1); if (!done) { done = true; reject(e); } });
    });
  }

  var attempts = [];
  function tryNext(i) {
    if (i >= SOURCES.length) { fail('三维引擎没有下载成功，请检查网络后重试。'); return; }
    var src = SOURCES[i];
    var t0 = performance.now();
    fetchWithTimeout(src).then(function (code) {
      attempts.push({ name: src.name, ok: true, ms: Math.round(performance.now() - t0) });
      var blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      window.__threeSource = { name: src.name, url: src.url, attempts: attempts };
      var map = document.createElement('script');
      map.type = 'importmap';
      map.textContent = JSON.stringify({ imports: { three: blobUrl } });
      document.head.appendChild(map);
      var main = document.createElement('script');
      main.type = 'module';
      main.src = new URL('js/main.js?v=1.0.0', base).href;
      document.body.appendChild(main);
    }, function (e) {
      attempts.push({ name: src.name, ok: false, error: String(e && e.message || e), ms: Math.round(performance.now() - t0) });
      if (bootText) bootText.textContent = '换一条线路下载中…';
      tryNext(i + 1);
    });
  }
  tryNext(0);
})();
