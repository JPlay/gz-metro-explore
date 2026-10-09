/*
 * 加载画面小游戏（普通脚本，在 boot.js 之前运行）：
 *   进度条 = 一段 1 号线轨道（西塱 → 广州东站，16 站，取自 js/data/lines.js），小列车随真实加载进度前进，
 *   到达的站点亮起并显示站名；旁边每 4.5 秒换一条给小朋友的地铁小知识（只用 lines.js 数据和公开常识）。
 * 接口：window.__loadUI.set(进度 0..1, 文字)；进度只增不减。#loadBar / #loadMsg 仍保留（测试读取）。
 */
(function () {
  'use strict';
  var root = document.getElementById('loading'); if (!root) return;
  var track = document.getElementById('loadTrack'), dotsEl = document.getElementById('loadDots'), train = document.getElementById('loadTrain');
  var bar = document.getElementById('loadBar'), msg = document.getElementById('loadMsg'), nameEl = document.getElementById('loadStation'), factEl = document.getElementById('loadFact');
  var cur = 0, stations = [], names = [], dots = [], lastIdx = -1, facts = [], fi = 0;

  function render() {
    var pct = (cur * 100).toFixed(1) + '%';
    if (bar) bar.style.width = pct;
    if (train) train.style.left = pct;
    if (!names.length) return;
    var n = names.length - 1, idx = Math.min(n, Math.floor(cur * n + 1e-6));
    for (var k = 0; k < dots.length; k++) dots[k].classList.toggle('on', k <= idx);
    if (idx !== lastIdx && nameEl) {
      lastIdx = idx;
      nameEl.textContent = (idx >= n ? '到站啦：' : '到达：') + names[idx];
      nameEl.classList.remove('pop'); void nameEl.offsetWidth; nameEl.classList.add('pop');
    }
  }
  window.__loadUI = {
    set: function (f, text) {
      if (typeof f === 'number' && isFinite(f)) cur = Math.max(cur, Math.min(1, Math.max(0, f)));
      if (text && msg) msg.textContent = text;
      render();
    },
    get: function () { return cur; }
  };

  function showFact() {
    if (!factEl || !facts.length) return;
    factEl.classList.remove('show'); void factEl.offsetWidth;
    factEl.textContent = facts[fi % facts.length]; fi++;
    factEl.classList.add('show');
  }

  import('./data/lines.js').then(function (D) {
    var L1 = D.LINES[1], L2 = D.LINES[2], S = D.STATIONS;
    stations = L1.stations.slice(); names = stations.map(function (c) { return S[c].zh; });
    if (track) track.style.setProperty('--line', L1.color);
    var n = stations.length - 1;
    stations.forEach(function (c, k) {
      var d = document.createElement('i'); d.className = 'dot' + (k === 0 || k === n ? ' end' : '') + (c === 'gyq' ? ' home' : '');
      d.style.left = (k / n * 100).toFixed(3) + '%'; d.title = S[c].zh;
      if (k === 0 || k === n) { var lb = document.createElement('b'); lb.textContent = S[c].zh; d.appendChild(lb); }
      dotsEl.appendChild(d); dots.push(d);
    });
    // 小知识：数字都从 lines.js 算出来；年份是公开常识（1 号线 1997 年开通）
    var first = S[L1.stations[0]].zh, last = S[L1.stations[n]].zh;
    facts = [
      '1 号线一共有 ' + L1.stations.length + ' 个车站，从' + first + '一直开到' + last + '。',
      '广州地铁 1 号线在 1997 年开通，是广州的第一条地铁线。',
      '1 号线的颜色是黄色，2 号线的颜色是蓝色。',
      '2 号线有 ' + L2.stations.length + ' 个车站，从' + S[L2.stations[0]].zh + '到' + S[L2.stations[L2.stations.length - 1]].zh + '。',
      '在公园前站，可以从 1 号线换乘 2 号线。',
      '在体育西路站，可以换乘 3 号线。',
      '在西塱站，可以换乘广佛线去佛山。',
      '坐地铁要排队，先下后上。',
      '站台上有屏蔽门，列车停稳、门打开了才能上车。'
    ];
    showFact(); setInterval(showFact, 4500);
    render();
  }).catch(function () { if (track) track.classList.add('plain'); });
  render();
})();
