# Replay Archive

正式站：https://lmnst.github.io/starcraft-replays/

管理后台：https://app.pagescms.org/lmnst/starcraft-replays/main/collection/matches

独立于 `starcraft-replay-pilot` 和 `starcraft-replay-viewer`。英文默认，`?lang=zh` 使用中文。固定比赛链接格式：`?match=01-win-heartbreak`。

## 管理比赛

1. 管理员进入 Pages CMS，选择本仓库 `main` 的 Matches。
2. 新增时填写唯一小写永久 ID（字母、数字、连字符），中英文标题、选手、地图和 `.rep` 文件。只填写已核实的事实，未知胜负选 unknown。
3. 勾选 Show on website 后 Save。CMS 保存至 GitHub 后自动检查和发布，等待 Actions 的 Validate and publish replay archive 成功。
4. 替换：编辑同一记录，上传新文件并 Save；不要改 ID。前台按回放 SHA256 更新文件请求参数，比赛链接不变。
5. 下架：取消 Show on website 并 Save。成功部署后移出列表和公开 catalog，未引用的回放也不进入新发布产物。Git 历史、旧下载、浏览器缓存和旧构建不保证立即清除。

上传文件与保存记录仍可能产生两次提交 / 部署；上传中的未引用文件不会进入公开产物。不自动删除仓库历史文件。

## 构建和验证

Linux / WSL，Python 3、Node、g++，无额外包：

```sh
mkdir -p build
g++ -std=c++14 -O2 scripts/validate-replay.cpp -o build/validate-replay
node --check site/app.js
node --check site/viewer/pilot-bridge.js
node --check site/viewer/archive-ui.js
python3 scripts/build.py
python3 -m unittest discover -s scripts -p 'test_*.py'
python3 -m http.server 8767 --directory dist --bind 127.0.0.1
```

结构校验检查原始 1.16.1 回放标识、分段解压、CRC、动作帧范围和内嵌地图必要块；不替代完整模拟兼容性测试。五份初始回放的既有完整无界面播放证据及文件哈希在 `verification/`。新回放应在浏览器复查载入、控制和终局。MPQ 校验包括文件头、大小和 SHA256。

缓存使用 IndexedDB `ReplayArchiveSelfHosted_DB_v1`，与 pilot 隔离。缓存不可用时直接下载并继续观看。首次下载约 90.3 MB。GitHub Pages 容量 / 带宽限制仍适用，不承诺瞬间载入或绝对稳定。

DOM 控件提供双语；游戏图像、单位名称及引擎画布统计保留原始语言。触屏和不同浏览器验收状态见 `VERIFICATION.md`。

## 恢复上一正常版本

先保存故障部署链接和提交 SHA。在仓库 Actions 找到上一成功提交，并核对其页面可用证据。对引入故障的提交执行 `git revert <SHA>` 并正常推送 main（不 force push，不重写 CMS 历史）；自动流水线重新生成完整产物。若由多次提交造成，用独立分支准备恢复提交并核对内容后再合入。紧急时可在 GitHub Pages deployment 历史重新运行上一成功工作流，但之后 main 内容仍需修复，避免下一次 CMS 保存又发布故障内容。

来源及版权记录见 `THIRD_PARTY.md`，游戏数据未重新声明为开源。
