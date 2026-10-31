# 正式版第一轮验收记录

## 2026-10-31：首页精简与 Bot 名称

- 删除首页的 eyebrow、口号及介绍三段内容，筛选和比赛列表直接置顶。
- 按用户指定将我方显示名称统一为 Agnes。对手仍为项目记录核实的 `reference-tier-d` / `reference-tier-s`。
- `scripts/run-games.py` 将 candidate 命名为回放内的 `player1`，opponent 命名为 `player2`；按原始昵称映射显示名，不按播放器行号判断，避免引擎排序颠倒双方身份。原始 `.rep` 不变。
- 本机浏览器实际加载 Benzene，统计栏显示 `reference-tier-s` 和 `Agnes`；切换中文后保持名称和当前比赛，计时从 00:13 前进到 00:30。首页列表显示五场 Agnes 对局，原首页介绍区已消失。
- JavaScript 语法、双方行序颠倒的名称映射检查和原有六项回归通过。此项不替代下文仍待完成的 CMS、手机和跨浏览器验收。
- 已部署 `453c272`，Actions：https://github.com/lmnst/starcraft-replays/actions/runs/41176729513 。公开首页实测直接显示筛选与五场 Agnes 对局；公开 Heartbreak 回放自动载入，播放器统计栏显示 `Agnes` 与 `reference-tier-d`，计时到达 00:07。

日期：2026-10-30（Asia/Shanghai）。**已上线，完整验收尚未完成。**

## 隔离及发布

- 正式仓库：https://github.com/lmnst/starcraft-replays
- 正式站：https://lmnst.github.io/starcraft-replays/
- CMS 入口：https://app.pagescms.org/lmnst/starcraft-replays/main/collection/matches
- 实施前确认 `replay-site-pilot/`、`web-replay-viewer/` 工作树干净；pilot 远程 HEAD 为 `3841a6cd69a64ec19bb65e3102dbe1d31863ff3b`。未向这两个仓库写入。
- 新建独立 `replay-site/`，未覆盖其他窗口的仓库。三份 MPQ 及引擎复用 pilot 已验证版本；MPQ 不再使用上游主机。
- 初始部署成功：https://github.com/lmnst/starcraft-replays/actions/runs/41001237439 （`c86c582`）。
- 完整播放器翻译部署成功：https://github.com/lmnst/starcraft-replays/actions/runs/41001317586 （`4edf617`）。
- 最终功能提交：`947b72326571a498dccc5c6bde0c8f1bd3525cda`；发布成功：https://github.com/lmnst/starcraft-replays/actions/runs/41001475004 。

## 本轮确实执行的验证

- 五份代表回放的元数据来自原项目 `reports/replays/*/result.json`，未猜测地图、对手、胜负。原有无界面完整播放证据绑定到回放 SHA256，保存在 `verification/`。
- 五份回放均通过新结构解析：原始回放标识、分段解压、CRC、动作帧边界、地图必要块。地图尾部元数据按 OpenBW 原读取语义处理，不将有效地图尾部误判为损坏。此检查不验证所有动作的模拟语义。
- 六项自动回归通过：损坏、截断、路径越界、同文件 ID 修改、下架同时移除 catalog / 产物并清理旧产物、替换文件时 ID 不变而哈希及帧数改变。
- 自建 JavaScript 脚本语法检查通过；GitHub Actions 实际编译校验器、构建产物并部署成功。
- 本机预览浏览器实际看到五场比赛；搜索 `tier-s` 并选择 Benzene 后只剩一场；中文切换后打开 `?match=05-loss-benzene&lang=zh`，标题和说明为中文。
- 本机预览使用独立的正式版 IndexedDB 名称，自动加载 MPQ 和 `.rep`；看到 Benzene1.1 回放画面和 `00:22` 计时，无手动文件导入。此项不能记为公开 HTTPS 的首次无缓存播放验证。
- 公开 HTTPS 只读 smoke 检查共 18 项均返回 200，包括页面、脚本、WASM、catalog、五份回放、三份 MPQ；所有回放和 MPQ 的完整下载 SHA256 与本地记录一致。第一次 smoke 对应公开 revision `4edf617`；原始报告在本机忽略的 `evidence/https-smoke.json`。
- 最后再次核对公开 catalog 为 `947b723`，五场比赛齐全；首页、应用脚本/样式、来源页及播放器翻译脚本与最终源码逐字节一致（文本统一换行为 LF 后比较）。未引用的旧 `heartbreak-v1.rep` 返回 404。完整 HTTP 证据已提交到 `verification/public-https-20261030.json`，文档提交不触发重复部署。

## 未完成，不能勾选通过

- 正式仓库 Pages CMS 中实际新增 / 替换 / 下架并保存，以及 CMS 保存后的线上联动。配置已经迁移并增加固定 ID、双语说明、胜负字段，但新仓库是否在现有 Pages CMS GitHub App 授权范围内尚未确认。pilot 的历史成功不能算作正式仓库验收。
- 公开 HTTPS 的首次无本站缓存播放、刷新与缓存复用、缓存禁用后仍播放、下载失败后重试。
- 本轮正式版镜头移动、暂停、倍速、跳进度、完整终局及全屏的独立浏览器验收。pilot 的部分历史通过记录见原交接文档；五份旧的 headless 证据也不能代替本轮浏览器终局验证。
- 手机实机、触摸拖动、横屏及不同浏览器实测。已做响应布局并保留引擎触控实现，不宣称手机验收通过。
- 最后补齐的统计栏 / 计时翻译、全屏退出按钮、来源页完整双语切换仅通过语法 / 构建检查，未再次视觉验收。

阻塞原因：Windows 原生浏览器工具无法可靠识别当前网址，主动停止本轮 Computer Use。已停止该 UI 路径；没有绕过限制或用命令行冒充后台操作。CLI 查看 GitHub App installations 亦返回 403，不能确认 CMS 新仓库权限。访客网站本身不要求登录。

## 恢复操作记录

恢复步骤已写入 README，尚未实际执行回滚演练。最近的成功版本 `4edf617` 可作为恢复参照：若 `947b723` 引入问题，在工作树干净且确认远程没有新 CMS 提交后，先拉取 main，执行 `git revert 947b723`，核对改动后正常推送；不要 force push。等待 Actions 成功并核对公开 catalog 的 revision。恢复会回到前一提交的站点代码，回放和 MPQ 不变。

## 翻译边界

宿主页导航、搜索、状态、失败重试、说明、DOM 播放器控制与统计标签提供双语。StarCraft 游戏素材、单位名称、地图内文字、引擎在画布绘制的文字保留原始语言。英文错误原文仅作为中文解释后的技术详情保留。英文品牌和 Bot 名称不翻译。
