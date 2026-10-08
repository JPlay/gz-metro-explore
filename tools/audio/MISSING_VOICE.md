# 缺失的报站语音片段

由 `node tools/audio/export_jobs.mjs` 生成。全网共需 407 条片段，已有 MP3 77 条，缺 330 条（普通话 110 / 粤语 110 / 英语 110）。
缺失片段在游戏里自动用 Web Speech 朗读（zh-CN → zh-HK（若有）→ en-US（若有），语速 0.95），并照常显示字幕。

生成方法：设置环境变量 DASHSCOPE_API_KEY 后运行 `python3 tools/audio/generate_voice.py`（会读取 voice-jobs.json，只生成缺的）。

| id | 语言 | 文本 |
| --- | --- | --- |
| voice.arrive.xl.zh | zh | 列车即将到达西塱站，请小心列车与站台之间的空隙。 |
| voice.arrive.xl.yue | yue | 列车即将到达西塱站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.xl.en | en | The train is arriving at Xilang. Please mind the gap between the train and the platform. |
| voice.welcome.xl.zh | zh | 欢迎光临西塱站。请排队候车，先下后上。 |
| voice.welcome.xl.yue | yue | 欢迎光临西塱站。请排队候车，先落后上。 |
| voice.welcome.xl.en | en | Welcome to Xilang station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.kk.zh | zh | 下一站，坑口。 |
| voice.next.kk.yue | yue | 下一站，坑口。 |
| voice.next.kk.en | en | The next station is Kengkou. |
| voice.arrive.kk.zh | zh | 列车即将到达坑口站，请小心列车与站台之间的空隙。 |
| voice.arrive.kk.yue | yue | 列车即将到达坑口站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.kk.en | en | The train is arriving at Kengkou. Please mind the gap between the train and the platform. |
| voice.welcome.kk.zh | zh | 欢迎光临坑口站。请排队候车，先下后上。 |
| voice.welcome.kk.yue | yue | 欢迎光临坑口站。请排队候车，先落后上。 |
| voice.welcome.kk.en | en | Welcome to Kengkou station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.hdw.zh | zh | 下一站，花地湾。 |
| voice.next.hdw.yue | yue | 下一站，花地湾。 |
| voice.next.hdw.en | en | The next station is Huadiwan. |
| voice.arrive.hdw.zh | zh | 列车即将到达花地湾站，请小心列车与站台之间的空隙。 |
| voice.arrive.hdw.yue | yue | 列车即将到达花地湾站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.hdw.en | en | The train is arriving at Huadiwan. Please mind the gap between the train and the platform. |
| voice.welcome.hdw.zh | zh | 欢迎光临花地湾站。请排队候车，先下后上。 |
| voice.welcome.hdw.yue | yue | 欢迎光临花地湾站。请排队候车，先落后上。 |
| voice.welcome.hdw.en | en | Welcome to Huadiwan station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.fc.zh | zh | 下一站，芳村，可换乘十一号线、二十二号线。 |
| voice.next.fc.yue | yue | 下一站，芳村，可换乘十一号线、二十二号线。 |
| voice.next.fc.en | en | The next station is Fangcun, the interchange with Line Eleven and Line Twenty-two. |
| voice.arrive.fc.zh | zh | 列车即将到达芳村站，请小心列车与站台之间的空隙。 |
| voice.arrive.fc.yue | yue | 列车即将到达芳村站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.fc.en | en | The train is arriving at Fangcun. Please mind the gap between the train and the platform. |
| voice.welcome.fc.zh | zh | 欢迎光临芳村站。请排队候车，先下后上。 |
| voice.welcome.fc.yue | yue | 欢迎光临芳村站。请排队候车，先落后上。 |
| voice.welcome.fc.en | en | Welcome to Fangcun station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.hs.zh | zh | 下一站，黄沙，可换乘六号线。 |
| voice.next.hs.yue | yue | 下一站，黄沙，可换乘六号线。 |
| voice.next.hs.en | en | The next station is Huangsha, the interchange with Line Six. |
| voice.arrive.hs.zh | zh | 列车即将到达黄沙站，请小心列车与站台之间的空隙。 |
| voice.arrive.hs.yue | yue | 列车即将到达黄沙站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.hs.en | en | The train is arriving at Huangsha. Please mind the gap between the train and the platform. |
| voice.welcome.hs.zh | zh | 欢迎光临黄沙站。请排队候车，先下后上。 |
| voice.welcome.hs.yue | yue | 欢迎光临黄沙站。请排队候车，先落后上。 |
| voice.welcome.hs.en | en | Welcome to Huangsha station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.csl.zh | zh | 下一站，长寿路。 |
| voice.next.csl.yue | yue | 下一站，长寿路。 |
| voice.next.csl.en | en | The next station is Changshou Lu. |
| voice.arrive.csl.zh | zh | 列车即将到达长寿路站，请小心列车与站台之间的空隙。 |
| voice.arrive.csl.yue | yue | 列车即将到达长寿路站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.csl.en | en | The train is arriving at Changshou Lu. Please mind the gap between the train and the platform. |
| voice.welcome.csl.zh | zh | 欢迎光临长寿路站。请排队候车，先下后上。 |
| voice.welcome.csl.yue | yue | 欢迎光临长寿路站。请排队候车，先落后上。 |
| voice.welcome.csl.en | en | Welcome to Changshou Lu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.cjc.zh | zh | 下一站，陈家祠，可换乘八号线。 |
| voice.next.cjc.yue | yue | 下一站，陈家祠，可换乘八号线。 |
| voice.next.cjc.en | en | The next station is Chen Clan Academy, the interchange with Line Eight. |
| voice.arrive.cjc.zh | zh | 列车即将到达陈家祠站，请小心列车与站台之间的空隙。 |
| voice.arrive.cjc.yue | yue | 列车即将到达陈家祠站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.cjc.en | en | The train is arriving at Chen Clan Academy. Please mind the gap between the train and the platform. |
| voice.welcome.cjc.zh | zh | 欢迎光临陈家祠站。请排队候车，先下后上。 |
| voice.welcome.cjc.yue | yue | 欢迎光临陈家祠站。请排队候车，先落后上。 |
| voice.welcome.cjc.en | en | Welcome to Chen Clan Academy station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.xmk.zh | zh | 下一站，西门口。 |
| voice.next.xmk.yue | yue | 下一站，西门口。 |
| voice.next.xmk.en | en | The next station is Ximenkou. |
| voice.arrive.xmk.zh | zh | 列车即将到达西门口站，请小心列车与站台之间的空隙。 |
| voice.arrive.xmk.yue | yue | 列车即将到达西门口站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.xmk.en | en | The train is arriving at Ximenkou. Please mind the gap between the train and the platform. |
| voice.welcome.xmk.zh | zh | 欢迎光临西门口站。请排队候车，先下后上。 |
| voice.welcome.xmk.yue | yue | 欢迎光临西门口站。请排队候车，先落后上。 |
| voice.welcome.xmk.en | en | Welcome to Ximenkou station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.yj.zh | zh | 下一站，杨箕，可换乘五号线。 |
| voice.next.yj.yue | yue | 下一站，杨箕，可换乘五号线。 |
| voice.next.yj.en | en | The next station is Yangji, the interchange with Line Five. |
| voice.arrive.yj.zh | zh | 列车即将到达杨箕站，请小心列车与站台之间的空隙。 |
| voice.arrive.yj.yue | yue | 列车即将到达杨箕站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.yj.en | en | The train is arriving at Yangji. Please mind the gap between the train and the platform. |
| voice.welcome.yj.zh | zh | 欢迎光临杨箕站。请排队候车，先下后上。 |
| voice.welcome.yj.yue | yue | 欢迎光临杨箕站。请排队候车，先落后上。 |
| voice.welcome.yj.en | en | Welcome to Yangji station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.tyxl.zh | zh | 下一站，体育西路，可换乘三号线。 |
| voice.next.tyxl.yue | yue | 下一站，体育西路，可换乘三号线。 |
| voice.next.tyxl.en | en | The next station is Tiyu Xilu, the interchange with Line Three. |
| voice.arrive.tyxl.zh | zh | 列车即将到达体育西路站，请小心列车与站台之间的空隙。 |
| voice.arrive.tyxl.yue | yue | 列车即将到达体育西路站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.tyxl.en | en | The train is arriving at Tiyu Xilu. Please mind the gap between the train and the platform. |
| voice.welcome.tyxl.zh | zh | 欢迎光临体育西路站。请排队候车，先下后上。 |
| voice.welcome.tyxl.yue | yue | 欢迎光临体育西路站。请排队候车，先落后上。 |
| voice.welcome.tyxl.en | en | Welcome to Tiyu Xilu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.tyzx.zh | zh | 下一站，体育中心。 |
| voice.next.tyzx.yue | yue | 下一站，体育中心。 |
| voice.next.tyzx.en | en | The next station is Tianhe Sports Center. |
| voice.arrive.tyzx.zh | zh | 列车即将到达体育中心站，请小心列车与站台之间的空隙。 |
| voice.arrive.tyzx.yue | yue | 列车即将到达体育中心站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.tyzx.en | en | The train is arriving at Tianhe Sports Center. Please mind the gap between the train and the platform. |
| voice.welcome.tyzx.zh | zh | 欢迎光临体育中心站。请排队候车，先下后上。 |
| voice.welcome.tyzx.yue | yue | 欢迎光临体育中心站。请排队候车，先落后上。 |
| voice.welcome.tyzx.en | en | Welcome to Tianhe Sports Center station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.arrive.gzdz.zh | zh | 列车即将到达广州东站站，请小心列车与站台之间的空隙。 |
| voice.arrive.gzdz.yue | yue | 列车即将到达广州东站站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.gzdz.en | en | The train is arriving at Guangzhou East Railway Station. Please mind the gap between the train and the platform. |
| voice.welcome.gzdz.zh | zh | 欢迎光临广州东站站。请排队候车，先下后上。 |
| voice.welcome.gzdz.yue | yue | 欢迎光临广州东站站。请排队候车，先落后上。 |
| voice.welcome.gzdz.en | en | Welcome to Guangzhou East Railway Station station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.destination.l2n.zh | zh | 本次列车终点站为，嘉禾望岗。 |
| voice.destination.l2n.yue | yue | 本次列车终点站为，嘉禾望岗。 |
| voice.destination.l2n.en | en | The destination of this train is Jiahewanggang. |
| voice.terminal.l2n.zh | zh | 下一站是本次列车的终点站，嘉禾望岗。请全部乘客带齐行李物品在此站下车，欢迎再次乘坐广州地铁。 |
| voice.terminal.l2n.yue | yue | 下一站系本次列车嘅终点站，嘉禾望岗。请全部乘客带齐行李物品喺呢一站落车，欢迎再次乘坐广州地铁。 |
| voice.terminal.l2n.en | en | The next station is Jiahewanggang, the terminal of this journey. Please take all your belongings and leave the train. Thank you for travelling on Guangzhou Metro. |
| voice.platform.l2n.1.zh | zh | 一站台，嘉禾望岗方向列车即将进站。 |
| voice.platform.l2n.1.yue | yue | 一站台，嘉禾望岗方向列车即将进站。 |
| voice.platform.l2n.1.en | en | The train bound for Jiahewanggang is approaching at Platform 1. |
| voice.platform.l2n.2.zh | zh | 二站台，嘉禾望岗方向列车即将进站。 |
| voice.platform.l2n.2.yue | yue | 二站台，嘉禾望岗方向列车即将进站。 |
| voice.platform.l2n.2.en | en | The train bound for Jiahewanggang is approaching at Platform 2. |
| voice.destination.l2s.zh | zh | 本次列车终点站为，广州南站。 |
| voice.destination.l2s.yue | yue | 本次列车终点站为，广州南站。 |
| voice.destination.l2s.en | en | The destination of this train is Guangzhou South Railway Station. |
| voice.terminal.l2s.zh | zh | 下一站是本次列车的终点站，广州南站。请全部乘客带齐行李物品在此站下车，欢迎再次乘坐广州地铁。 |
| voice.terminal.l2s.yue | yue | 下一站系本次列车嘅终点站，广州南站。请全部乘客带齐行李物品喺呢一站落车，欢迎再次乘坐广州地铁。 |
| voice.terminal.l2s.en | en | The next station is Guangzhou South Railway Station, the terminal of this journey. Please take all your belongings and leave the train. Thank you for travelling on Guangzhou Metro. |
| voice.platform.l2s.1.zh | zh | 一站台，广州南站方向列车即将进站。 |
| voice.platform.l2s.1.yue | yue | 一站台，广州南站方向列车即将进站。 |
| voice.platform.l2s.1.en | en | The train bound for Guangzhou South Railway Station is approaching at Platform 1. |
| voice.platform.l2s.2.zh | zh | 二站台，广州南站方向列车即将进站。 |
| voice.platform.l2s.2.yue | yue | 二站台，广州南站方向列车即将进站。 |
| voice.platform.l2s.2.en | en | The train bound for Guangzhou South Railway Station is approaching at Platform 2. |
| voice.arrive.gznz.zh | zh | 列车即将到达广州南站站，请小心列车与站台之间的空隙。 |
| voice.arrive.gznz.yue | yue | 列车即将到达广州南站站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.gznz.en | en | The train is arriving at Guangzhou South Railway Station. Please mind the gap between the train and the platform. |
| voice.welcome.gznz.zh | zh | 欢迎光临广州南站站。请排队候车，先下后上。 |
| voice.welcome.gznz.yue | yue | 欢迎光临广州南站站。请排队候车，先落后上。 |
| voice.welcome.gznz.en | en | Welcome to Guangzhou South Railway Station station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.sb.zh | zh | 下一站，石壁，可换乘七号线。 |
| voice.next.sb.yue | yue | 下一站，石壁，可换乘七号线。 |
| voice.next.sb.en | en | The next station is Shibi, the interchange with Line Seven. |
| voice.arrive.sb.zh | zh | 列车即将到达石壁站，请小心列车与站台之间的空隙。 |
| voice.arrive.sb.yue | yue | 列车即将到达石壁站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.sb.en | en | The train is arriving at Shibi. Please mind the gap between the train and the platform. |
| voice.welcome.sb.zh | zh | 欢迎光临石壁站。请排队候车，先下后上。 |
| voice.welcome.sb.yue | yue | 欢迎光临石壁站。请排队候车，先落后上。 |
| voice.welcome.sb.en | en | Welcome to Shibi station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.hj.zh | zh | 下一站，会江。 |
| voice.next.hj.yue | yue | 下一站，会江。 |
| voice.next.hj.en | en | The next station is Huijiang. |
| voice.arrive.hj.zh | zh | 列车即将到达会江站，请小心列车与站台之间的空隙。 |
| voice.arrive.hj.yue | yue | 列车即将到达会江站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.hj.en | en | The train is arriving at Huijiang. Please mind the gap between the train and the platform. |
| voice.welcome.hj.zh | zh | 欢迎光临会江站。请排队候车，先下后上。 |
| voice.welcome.hj.yue | yue | 欢迎光临会江站。请排队候车，先落后上。 |
| voice.welcome.hj.en | en | Welcome to Huijiang station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.np.zh | zh | 下一站，南浦。 |
| voice.next.np.yue | yue | 下一站，南浦。 |
| voice.next.np.en | en | The next station is Nanpu. |
| voice.arrive.np.zh | zh | 列车即将到达南浦站，请小心列车与站台之间的空隙。 |
| voice.arrive.np.yue | yue | 列车即将到达南浦站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.np.en | en | The train is arriving at Nanpu. Please mind the gap between the train and the platform. |
| voice.welcome.np.zh | zh | 欢迎光临南浦站。请排队候车，先下后上。 |
| voice.welcome.np.yue | yue | 欢迎光临南浦站。请排队候车，先落后上。 |
| voice.welcome.np.en | en | Welcome to Nanpu station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.lx.zh | zh | 下一站，洛溪。 |
| voice.next.lx.yue | yue | 下一站，洛溪。 |
| voice.next.lx.en | en | The next station is Luoxi. |
| voice.arrive.lx.zh | zh | 列车即将到达洛溪站，请小心列车与站台之间的空隙。 |
| voice.arrive.lx.yue | yue | 列车即将到达洛溪站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.lx.en | en | The train is arriving at Luoxi. Please mind the gap between the train and the platform. |
| voice.welcome.lx.zh | zh | 欢迎光临洛溪站。请排队候车，先下后上。 |
| voice.welcome.lx.yue | yue | 欢迎光临洛溪站。请排队候车，先落后上。 |
| voice.welcome.lx.en | en | Welcome to Luoxi station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.nz.zh | zh | 下一站，南洲，可换乘广佛线。 |
| voice.next.nz.yue | yue | 下一站，南洲，可换乘广佛线。 |
| voice.next.nz.en | en | The next station is Nanzhou, the interchange with the Guangfo Line. |
| voice.arrive.nz.zh | zh | 列车即将到达南洲站，请小心列车与站台之间的空隙。 |
| voice.arrive.nz.yue | yue | 列车即将到达南洲站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.nz.en | en | The train is arriving at Nanzhou. Please mind the gap between the train and the platform. |
| voice.welcome.nz.zh | zh | 欢迎光临南洲站。请排队候车，先下后上。 |
| voice.welcome.nz.yue | yue | 欢迎光临南洲站。请排队候车，先落后上。 |
| voice.welcome.nz.en | en | Welcome to Nanzhou station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.dxn.zh | zh | 下一站，东晓南，可换乘十号线。 |
| voice.next.dxn.yue | yue | 下一站，东晓南，可换乘十号线。 |
| voice.next.dxn.en | en | The next station is Dongxiao South, the interchange with Line Ten. |
| voice.arrive.dxn.zh | zh | 列车即将到达东晓南站，请小心列车与站台之间的空隙。 |
| voice.arrive.dxn.yue | yue | 列车即将到达东晓南站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.dxn.en | en | The train is arriving at Dongxiao South. Please mind the gap between the train and the platform. |
| voice.welcome.dxn.zh | zh | 欢迎光临东晓南站。请排队候车，先下后上。 |
| voice.welcome.dxn.yue | yue | 欢迎光临东晓南站。请排队候车，先落后上。 |
| voice.welcome.dxn.en | en | Welcome to Dongxiao South station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.jtl.zh | zh | 下一站，江泰路，可换乘十一号线。 |
| voice.next.jtl.yue | yue | 下一站，江泰路，可换乘十一号线。 |
| voice.next.jtl.en | en | The next station is Jiangtai Road, the interchange with Line Eleven. |
| voice.arrive.jtl.zh | zh | 列车即将到达江泰路站，请小心列车与站台之间的空隙。 |
| voice.arrive.jtl.yue | yue | 列车即将到达江泰路站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.jtl.en | en | The train is arriving at Jiangtai Road. Please mind the gap between the train and the platform. |
| voice.welcome.jtl.zh | zh | 欢迎光临江泰路站。请排队候车，先下后上。 |
| voice.welcome.jtl.yue | yue | 欢迎光临江泰路站。请排队候车，先落后上。 |
| voice.welcome.jtl.en | en | Welcome to Jiangtai Road station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.cg.zh | zh | 下一站，昌岗，可换乘八号线。 |
| voice.next.cg.yue | yue | 下一站，昌岗，可换乘八号线。 |
| voice.next.cg.en | en | The next station is Changgang, the interchange with Line Eight. |
| voice.arrive.cg.zh | zh | 列车即将到达昌岗站，请小心列车与站台之间的空隙。 |
| voice.arrive.cg.yue | yue | 列车即将到达昌岗站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.cg.en | en | The train is arriving at Changgang. Please mind the gap between the train and the platform. |
| voice.welcome.cg.zh | zh | 欢迎光临昌岗站。请排队候车，先下后上。 |
| voice.welcome.cg.yue | yue | 欢迎光临昌岗站。请排队候车，先落后上。 |
| voice.welcome.cg.en | en | Welcome to Changgang station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.jnx.zh | zh | 下一站，江南西。 |
| voice.next.jnx.yue | yue | 下一站，江南西。 |
| voice.next.jnx.en | en | The next station is Jiangnanxi. |
| voice.arrive.jnx.zh | zh | 列车即将到达江南西站，请小心列车与站台之间的空隙。 |
| voice.arrive.jnx.yue | yue | 列车即将到达江南西站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.jnx.en | en | The train is arriving at Jiangnanxi. Please mind the gap between the train and the platform. |
| voice.welcome.jnx.zh | zh | 欢迎光临江南西站。请排队候车，先下后上。 |
| voice.welcome.jnx.yue | yue | 欢迎光临江南西站。请排队候车，先落后上。 |
| voice.welcome.jnx.en | en | Welcome to Jiangnanxi station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.seg.zh | zh | 下一站，市二宫。 |
| voice.next.seg.yue | yue | 下一站，市二宫。 |
| voice.next.seg.en | en | The next station is The 2nd Workers' Cultural Palace. |
| voice.arrive.seg.zh | zh | 列车即将到达市二宫站，请小心列车与站台之间的空隙。 |
| voice.arrive.seg.yue | yue | 列车即将到达市二宫站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.seg.en | en | The train is arriving at The 2nd Workers' Cultural Palace. Please mind the gap between the train and the platform. |
| voice.welcome.seg.zh | zh | 欢迎光临市二宫站。请排队候车，先下后上。 |
| voice.welcome.seg.yue | yue | 欢迎光临市二宫站。请排队候车，先落后上。 |
| voice.welcome.seg.en | en | Welcome to The 2nd Workers' Cultural Palace station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.hzgc.zh | zh | 下一站，海珠广场，可换乘六号线。 |
| voice.next.hzgc.yue | yue | 下一站，海珠广场，可换乘六号线。 |
| voice.next.hzgc.en | en | The next station is Haizhu Square, the interchange with Line Six. |
| voice.arrive.hzgc.zh | zh | 列车即将到达海珠广场站，请小心列车与站台之间的空隙。 |
| voice.arrive.hzgc.yue | yue | 列车即将到达海珠广场站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.hzgc.en | en | The train is arriving at Haizhu Square. Please mind the gap between the train and the platform. |
| voice.welcome.hzgc.zh | zh | 欢迎光临海珠广场站。请排队候车，先下后上。 |
| voice.welcome.hzgc.yue | yue | 欢迎光临海珠广场站。请排队候车，先落后上。 |
| voice.welcome.hzgc.en | en | Welcome to Haizhu Square station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.transfer.gyq2.zh | zh | 可换乘一号线。 |
| voice.transfer.gyq2.yue | yue | 可换乘一号线。 |
| voice.transfer.gyq2.en | en | The interchange with Line One. |
| voice.next.jnt.zh | zh | 下一站，纪念堂。 |
| voice.next.jnt.yue | yue | 下一站，纪念堂。 |
| voice.next.jnt.en | en | The next station is Sun Yat-sen Memorial Hall. |
| voice.arrive.jnt.zh | zh | 列车即将到达纪念堂站，请小心列车与站台之间的空隙。 |
| voice.arrive.jnt.yue | yue | 列车即将到达纪念堂站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.jnt.en | en | The train is arriving at Sun Yat-sen Memorial Hall. Please mind the gap between the train and the platform. |
| voice.welcome.jnt.zh | zh | 欢迎光临纪念堂站。请排队候车，先下后上。 |
| voice.welcome.jnt.yue | yue | 欢迎光临纪念堂站。请排队候车，先落后上。 |
| voice.welcome.jnt.en | en | Welcome to Sun Yat-sen Memorial Hall station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.yxgy.zh | zh | 下一站，越秀公园。 |
| voice.next.yxgy.yue | yue | 下一站，越秀公园。 |
| voice.next.yxgy.en | en | The next station is Yuexiu Park. |
| voice.arrive.yxgy.zh | zh | 列车即将到达越秀公园站，请小心列车与站台之间的空隙。 |
| voice.arrive.yxgy.yue | yue | 列车即将到达越秀公园站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.yxgy.en | en | The train is arriving at Yuexiu Park. Please mind the gap between the train and the platform. |
| voice.welcome.yxgy.zh | zh | 欢迎光临越秀公园站。请排队候车，先下后上。 |
| voice.welcome.yxgy.yue | yue | 欢迎光临越秀公园站。请排队候车，先落后上。 |
| voice.welcome.yxgy.en | en | Welcome to Yuexiu Park station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.gzhcz.zh | zh | 下一站，广州火车站，可换乘五号线。 |
| voice.next.gzhcz.yue | yue | 下一站，广州火车站，可换乘五号线。 |
| voice.next.gzhcz.en | en | The next station is Guangzhou Railway Station, the interchange with Line Five. |
| voice.arrive.gzhcz.zh | zh | 列车即将到达广州火车站站，请小心列车与站台之间的空隙。 |
| voice.arrive.gzhcz.yue | yue | 列车即将到达广州火车站站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.gzhcz.en | en | The train is arriving at Guangzhou Railway Station. Please mind the gap between the train and the platform. |
| voice.welcome.gzhcz.zh | zh | 欢迎光临广州火车站站。请排队候车，先下后上。 |
| voice.welcome.gzhcz.yue | yue | 欢迎光临广州火车站站。请排队候车，先落后上。 |
| voice.welcome.gzhcz.en | en | Welcome to Guangzhou Railway Station station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.syl.zh | zh | 下一站，三元里。 |
| voice.next.syl.yue | yue | 下一站，三元里。 |
| voice.next.syl.en | en | The next station is Sanyuanli. |
| voice.arrive.syl.zh | zh | 列车即将到达三元里站，请小心列车与站台之间的空隙。 |
| voice.arrive.syl.yue | yue | 列车即将到达三元里站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.syl.en | en | The train is arriving at Sanyuanli. Please mind the gap between the train and the platform. |
| voice.welcome.syl.zh | zh | 欢迎光临三元里站。请排队候车，先下后上。 |
| voice.welcome.syl.yue | yue | 欢迎光临三元里站。请排队候车，先落后上。 |
| voice.welcome.syl.en | en | Welcome to Sanyuanli station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.fxgy.zh | zh | 下一站，飞翔公园。 |
| voice.next.fxgy.yue | yue | 下一站，飞翔公园。 |
| voice.next.fxgy.en | en | The next station is Feixiang Park. |
| voice.arrive.fxgy.zh | zh | 列车即将到达飞翔公园站，请小心列车与站台之间的空隙。 |
| voice.arrive.fxgy.yue | yue | 列车即将到达飞翔公园站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.fxgy.en | en | The train is arriving at Feixiang Park. Please mind the gap between the train and the platform. |
| voice.welcome.fxgy.zh | zh | 欢迎光临飞翔公园站。请排队候车，先下后上。 |
| voice.welcome.fxgy.yue | yue | 欢迎光临飞翔公园站。请排队候车，先落后上。 |
| voice.welcome.fxgy.en | en | Welcome to Feixiang Park station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.bygy.zh | zh | 下一站，白云公园。 |
| voice.next.bygy.yue | yue | 下一站，白云公园。 |
| voice.next.bygy.en | en | The next station is Baiyun Park. |
| voice.arrive.bygy.zh | zh | 列车即将到达白云公园站，请小心列车与站台之间的空隙。 |
| voice.arrive.bygy.yue | yue | 列车即将到达白云公园站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.bygy.en | en | The train is arriving at Baiyun Park. Please mind the gap between the train and the platform. |
| voice.welcome.bygy.zh | zh | 欢迎光临白云公园站。请排队候车，先下后上。 |
| voice.welcome.bygy.yue | yue | 欢迎光临白云公园站。请排队候车，先落后上。 |
| voice.welcome.bygy.en | en | Welcome to Baiyun Park station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.bywhgc.zh | zh | 下一站，白云文化广场，可换乘十二号线。 |
| voice.next.bywhgc.yue | yue | 下一站，白云文化广场，可换乘十二号线。 |
| voice.next.bywhgc.en | en | The next station is Baiyun Culture Square, the interchange with Line Twelve. |
| voice.arrive.bywhgc.zh | zh | 列车即将到达白云文化广场站，请小心列车与站台之间的空隙。 |
| voice.arrive.bywhgc.yue | yue | 列车即将到达白云文化广场站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.bywhgc.en | en | The train is arriving at Baiyun Culture Square. Please mind the gap between the train and the platform. |
| voice.welcome.bywhgc.zh | zh | 欢迎光临白云文化广场站。请排队候车，先下后上。 |
| voice.welcome.bywhgc.yue | yue | 欢迎光临白云文化广场站。请排队候车，先落后上。 |
| voice.welcome.bywhgc.en | en | Welcome to Baiyun Culture Square station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.xg.zh | zh | 下一站，萧岗。 |
| voice.next.xg.yue | yue | 下一站，萧岗。 |
| voice.next.xg.en | en | The next station is Xiaogang. |
| voice.arrive.xg.zh | zh | 列车即将到达萧岗站，请小心列车与站台之间的空隙。 |
| voice.arrive.xg.yue | yue | 列车即将到达萧岗站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.xg.en | en | The train is arriving at Xiaogang. Please mind the gap between the train and the platform. |
| voice.welcome.xg.zh | zh | 欢迎光临萧岗站。请排队候车，先下后上。 |
| voice.welcome.xg.yue | yue | 欢迎光临萧岗站。请排队候车，先落后上。 |
| voice.welcome.xg.en | en | Welcome to Xiaogang station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.jx.zh | zh | 下一站，江夏。 |
| voice.next.jx.yue | yue | 下一站，江夏。 |
| voice.next.jx.en | en | The next station is Jiangxia. |
| voice.arrive.jx.zh | zh | 列车即将到达江夏站，请小心列车与站台之间的空隙。 |
| voice.arrive.jx.yue | yue | 列车即将到达江夏站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.jx.en | en | The train is arriving at Jiangxia. Please mind the gap between the train and the platform. |
| voice.welcome.jx.zh | zh | 欢迎光临江夏站。请排队候车，先下后上。 |
| voice.welcome.jx.yue | yue | 欢迎光临江夏站。请排队候车，先落后上。 |
| voice.welcome.jx.en | en | Welcome to Jiangxia station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.next.hb.zh | zh | 下一站，黄边。 |
| voice.next.hb.yue | yue | 下一站，黄边。 |
| voice.next.hb.en | en | The next station is Huangbian. |
| voice.arrive.hb.zh | zh | 列车即将到达黄边站，请小心列车与站台之间的空隙。 |
| voice.arrive.hb.yue | yue | 列车即将到达黄边站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.hb.en | en | The train is arriving at Huangbian. Please mind the gap between the train and the platform. |
| voice.welcome.hb.zh | zh | 欢迎光临黄边站。请排队候车，先下后上。 |
| voice.welcome.hb.yue | yue | 欢迎光临黄边站。请排队候车，先落后上。 |
| voice.welcome.hb.en | en | Welcome to Huangbian station. Please line up for the train. Let the passengers get off first before you get on. |
| voice.arrive.jhwg.zh | zh | 列车即将到达嘉禾望岗站，请小心列车与站台之间的空隙。 |
| voice.arrive.jhwg.yue | yue | 列车即将到达嘉禾望岗站，请小心列车同站台之间嘅空隙。 |
| voice.arrive.jhwg.en | en | The train is arriving at Jiahewanggang. Please mind the gap between the train and the platform. |
| voice.welcome.jhwg.zh | zh | 欢迎光临嘉禾望岗站。请排队候车，先下后上。 |
| voice.welcome.jhwg.yue | yue | 欢迎光临嘉禾望岗站。请排队候车，先落后上。 |
| voice.welcome.jhwg.en | en | Welcome to Jiahewanggang station. Please line up for the train. Let the passengers get off first before you get on. |
