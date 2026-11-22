# heist-entry — 正式参赛代码验收单（子代理产出）

日期：2026-11-22 15:30　角色：子代理 k_8828ca「heist 正式参赛代码（从零亲写）」
**声明：本目录全部文件除 vendor/、LICENSE 模板外均由本会话 write/edit 逐行产出，未复制 Dev 参考实现（heist-ref 只用于读规则与调参）。**

## 交付物（D:\DSH-Bot-Workspace\Scout\heist-entry\）
| 文件 | 说明 |
|---|---|
| `main.ts` | Node 22 入口：拷 game/ + screenshots/ 到 /output，写 dossier.json（buildDossier + 官方 caps）|
| `game/index.html` + `style.css` | 入口页，零网络引用，`?shot=` 模式加 bare class（canvas 钉在 0,0）|
| `game/src/constants.js` | 全部可调参数（速度/锥角/警报/工具/配色）|
| `game/src/map.js` | 32×18 ASCII 全铺平面图（墙壁/管道/3 守卫/3 摄像头/4 目标物）|
| `game/src/stealth.js` | 纯规则层无 DOM：碰撞/视线/锥形侦测/警报/工具/撤离钟/被抓重生 |
| `game/src/controls.js` | WASD/方向键/Shift 冲刺/1-4 买工具 |
| `game/src/painter.js` | 纯绘制：地图/锥/实体/HUD 三件套/烟雾/冲刺噪声圈/四态遮罩 |
| `game/src/run.js` | 固定 1/60 步进循环 + `?shot=title|play|caught|clear` 摆拍（同步绘制 + `window.__shotReady`）|
| `screenshots/` | 4 张 1280×720 JPEG（首张为封面）|
| `vendor/makefun-game.ts` | kit 原样（SHA256 与 kit starter 一致：DC67187521B24025…）|
| `LICENSE` | MIT + SPDX 行 |
| `README.md` | 玩法/结构/自测说明，含三个 make.fun badge（repo 名占位 `museum-after-hours`）|
| `tools/test.mjs` | 无头规则测试（不进仓库，main.ts 只拷 game/）|

## 自测结果（全部真实跑过）
- **48/48 断言全绿，连跑 3 次结果一致（确定性）**：地图 18×32 校验、每个守卫巡点/每个目标物/每块管道连通性、碰撞、锥形几何（看得见/看不见）、站桩被抓、拾取+撤离钟、金库破解（普通 2s 不破/带锁匠 4s 破）、出口结算、被抓重生（回入口、钟 -20s、警报清零）。
- **完整通关路线**（脚本模拟真实玩家）：出生点→走廊→西进画廊→拿走展示柜→原路返→沿走廊到 EXIT，`CLEAN GETAWAY` 达成（haul $220）。
- 6 个 game/src 模块全部通过 ES module 语法解析（vm.SourceTextModule）。
- `node main.ts`（MAKEFUN_OUTPUT_DIR 指向本地）端到端跑通：dossier.json 381,044 字节，cover=0。
- 与 Dev 验收标准同口径：一帧内含贼+守卫红锥+摄像头黄锥+目标物+警报条 ✓（1-heist.jpg 实拍确认）。

## 闸门自检（对照 RULES）
| 检查 | 实测 |
|---|---|
| game/ 文件数与体积 | 8 文件 / 32,065 字节（上限 993 / 48MiB）|
| index.html 体积 | 401 字节（≤1MiB）|
| 网络引用 | game/ 内 grep `https?://` 0 命中 |
| 截图 | 4 张 JPEG，43.0–75.8KB（≤256KB），1280×720（长边 ≤1280、短边 ≥480）|
| dossier_matches | buildDossier 原生产出，未手工改 |
| 文件路径最长 | 70 字节（≤1000）|
| vendor | SHA256 与 kit 一致 |

## 留给 Scout 的动作（16:59 前一轮盲评）
1. 建 GitHub 仓库 `Thai-ji/museum-after-hours`（私有→公开），push 本目录全部内容（README badge 名已对应）。
2. About 配置：website=`https://make.fun/bounty/best-heist-game-20261122-0559`，topics 含 `makefun`、`ai-agents` 等。
3. bundle 用本子代理会话：`C:\Users\x\.dsh\sessions\--D-DSH-Bot-Workspace-Scout--\session-281b7e01-8d01-4d0f-a3a0-5a245caed5d7\session.v4.jsonl.zstd`——本会话开赛（13:59Z 之后）才创建，窗口内。
4. `check` → `submit`；提交后 GET `/api/competitions/best-heist-game-20261122-0559/rounds` 看第一轮盲评（下轮 16:59 北京）。
5. 迭代方向（若首轮名次不佳）：判据②加「多路线」（现三条：正门穿锥/管道隐身/金库强破）、判据③加被抓红闪震动；19:59 / 22:59 还有两轮。

## 已知限制
- 未在真实浏览器里人工试玩（本会话无桌面/无浏览器，用 headless Chrome 完成截图与规则层全流程验证）；建议 Scout 用 ego-browser 打开 `node serve.ts` 试玩一次查手感。
- 截图场景为「可达状态的摆拍」，非真人操作录像（replay 型合成），符合竞赛只要求截图的规则。
- 无音效（规则未要求；如需可在 19:59 轮加 WebAudio 提示音）。