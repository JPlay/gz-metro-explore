# 端到端测试（Playwright，无头 Chromium）

模拟 iPad：1112×834、触屏、DPR 2。先在仓库根目录 `python3 -m http.server 8123`，再：

```bash
pip install playwright && playwright install chromium
python3 tests/e2e/smoke.py    'http://localhost:8123/?q=1'   # 能启动、无报错
python3 tests/e2e/controls.py 'http://localhost:8123/?q=2'   # 摇杆、拖动转头、捏合、跳、视角、脚印、键盘、碰撞
python3 tests/e2e/journey.py  'http://localhost:8123/?q=3'   # 完整旅程：进站→安检→闸机→站台→1 号线坐 2 站→坐回→换乘 2 号线坐 1 站
python3 tests/e2e/shots.py    'http://localhost:8123/'       # 截图（含竖屏 834×1112）
```

测试通过 `window.__game`（见 `js/main.js`）读取状态、设置虚拟摇杆和自动走路；触屏操作用 CDP 触摸事件真实模拟。
软件渲染下帧率只有个位数到二十几，不代表 iPad 上的表现。截图默认写到 `/workspace/gz-shots-3d/`，可传第二个参数修改。
