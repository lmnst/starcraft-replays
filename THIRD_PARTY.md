# 第三方来源

正式版复用 pilot 提交 `3841a6cd69a64ec19bb65e3102dbe1d31863ff3b` 的播放器和资源。新增 `archive-ui.js/css`、完整双语宿主页、缓存读取降级和回放请求错误处理，隐藏与比赛库无关的导入、视频导出入口。

`vendor/openbw/` 为本地已使用的 OpenBW 提交 `4b046d5f65302b10cb0a745f0fecd37ec85b20a8` 的头文件，用于构建时解压/校验回放容器。`scripts/validate-replay.cpp` 依据其 `replay.h` 的格式实现 CRC、分段读取、动作帧边界检查，并复用 `data_loading.h` 解压。此结构检查不能替代完整引擎兼容性验证。

`viewer/` 中的 HTML、Foundation 样式及脚本、图片和 `v1.4/` 播放引擎来自：

- https://github.com/dgant/openbw-replay-viewer
- 固定提交：`bb4b9a3a89b7b1c189bbc3fcaafb5c33a8ca66e8`
- OpenBW 引擎：https://github.com/OpenBW/openbw

修改：将 CDN 脚本与字体换成本地文件；加入 `site/viewer/pilot-bridge.js` 以支持自动下载 MPQ、独立浏览器缓存、加载进度与宿主页状态同步；关闭远程音乐列表。保留原播放器的回放操作和界面。

其他依赖：

- jQuery 2.1.0：https://jquery.org/license/ （MIT；文件头保留上游声明）
- Chart.js 2.5.0：https://github.com/chartjs/Chart.js/tree/v2.5.0 （MIT；文件头保留上游声明）
- Foundation：https://github.com/foundation/foundation-sites （MIT）
- Font Awesome 4.5.0：https://fontawesome.com/v4/license/ （字体 SIL OFL 1.1，CSS MIT；保留 CSS 中的声明）

上游播放器仓库根目录未提供独立 LICENSE 文件；这里记录来源，不给第三方代码重新声明许可证。公开发布前应核实上游代码与图片的分发许可。

按项目所有者的明确要求，`site/game-data/` 包含从其本地项目复制的 StarCraft 1.16.1 MPQ 数据；来源及 SHA256 见该目录 `manifest.json`。这些游戏资源仍属于相应权利人，不因本项目托管而获得新的开源许可。`site/replays/` 是本项目的对局回放，不代表官方榜单成绩。
