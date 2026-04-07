# AI 开发日志

> 本文件由 AI 自动维护，记录每次代码改动的详情，作为项目记忆使用。
> 文件名使用 AI-DEVLOG.md 以避免与项目自身的 CHANGELOG.md 冲突。

---

## [2026-04-07] 降低 Companion 运行时卡顿风险

**改动类型**：Bug修复

**涉及文件**：
- `apps/companion/src/main/main.ts` — 增加 Electron 单实例锁，避免重复启动多个桌宠进程
- `apps/companion/src/renderer/App.tsx` — 删除 walking 移除后仍持续运行的逐帧位置更新循环
- `apps/companion/src/renderer/pixelCat.ts` — 将宠物 Canvas 动画刷新频率限制为约 30 FPS，降低持续 CPU 占用

**改动说明**：
排查“程序跑着跑着电脑卡死”时发现，Companion 存在两个会放大资源消耗的风险点：重复启动时没有阻止多实例并存，以及 walking 已移除后渲染层仍保留一个无实际作用的 `requestAnimationFrame` 循环。此次补上单实例保护，并移除多余循环，同时将宠物动画渲染频率从每帧全速刷新调整为约 30 FPS，以降低 CPU 和 WindowServer 压力。

**注意事项**：
本次采样时系统高 CPU 主要仍集中在 VS Code 渲染进程和 Java 扩展进程，Companion 修复能减少自身负担，但如果后续仍有整机卡顿，需要继续排查 VS Code 扩展侧负载。

---

## [2026-04-07] 移除宠物行走状态并重画背身工作态

**改动类型**：重构

**涉及文件**：
- `apps/companion/src/renderer/App.tsx` — 将空闲动作轮换从“坐着 / 趴着 / 走路”调整为“坐着 / 趴着”
- `apps/companion/src/renderer/pixelCat.ts` — 将猫咪 working 动画改为背身操作电脑，并放大工作态电脑屏幕；同步调大龙虾工作态电脑尺寸
- `README.md` — 更新宠物状态说明
- `docs/architecture.md` — 更新状态机说明

**改动说明**：
按新的交互要求，删除宠物 walking 作为实际空闲状态，不再让宠物在桌面上来回走动。工作态方面，将猫咪从侧身操作电脑改为背对用户的工作姿态，并增大电脑屏幕占比，使“正在工作”的识别更直接；龙虾工作态也同步增大了电脑屏幕尺寸。

---

## [2026-04-07] 移除 VS Code 用户数据中的 instructions 副本同步

**改动类型**：重构

**涉及文件**：
- `apps/companion/src/main/main.ts` — 调整全局 instructions 同步逻辑，仅保留 `~/.copilot/instructions` 目标路径，并清理旧的 VS Code 用户数据副本
- `apps/companion/src/renderer/App.tsx` — 更新设置页说明文案
- `README.md` — 删除 VS Code 用户数据 instructions 副本说明
- `docs/architecture.md` — 删除 VS Code 用户数据 instructions 副本说明

**改动说明**：
按当前产品要求，不再需要向 VS Code 用户数据目录写入 instructions 副本。Companion 现仅同步用户级 `~/.copilot/instructions/agentpet.instructions.md`，同时在关闭或重新同步时清理旧的 `%APPDATA%/Code/User/prompts/agentpet.instructions.md` 历史残留文件。

---

## [2026-04-07] 修复全局 Copilot 指令导致的 AgentPet MCP 不触发问题

**改动类型**：Bug修复

**涉及文件**：
- `apps/companion/src/main/main.ts` — 修正全局 instructions 模板内容，并将用户级指令同步到多个稳定路径
- `apps/companion/public/copilot-instructions.md` — 移除要求先执行 `tool_search` 的错误步骤，改为直接调用 `notify_pet`
- `apps/companion/src/renderer/App.tsx` — 更新设置页说明，明确该开关控制的是全局 instructions 同步
- `README.md` — 更新全局指令写入位置说明
- `docs/architecture.md` — 更新全局 instructions 注册说明

**改动说明**：
排查发现 Companion 已经正常写入用户级 `mcp.json`，但用于驱动自动调用的全局 Copilot 指令包含一条要求先执行 `tool_search` 的过时步骤，而当前环境并不存在该工具，容易导致 Agent 不触发后续的 `notify_pet`。本次移除了该错误步骤，并把 instructions 同步到 VS Code 用户数据目录和 `~/.copilot/instructions` 两个位置，降低全局指令未被发现的风险。

**注意事项**：
仓库级 `build:companion` 任务仍会受到根脚本递归问题影响，实际验证构建时应优先使用 `npm run build -w @agentpet/companion`。

---

## [2026-04-07] 修正猫咪行走状态的侧脸头部造型

**改动类型**：Bug修复

**涉及文件**：
- `apps/companion/src/renderer/pixelCat.ts` — 重画 walking 状态的猫头侧脸轮廓，修正头部朝向、口鼻结构和五官分布

**改动说明**：
上一版 walking 侧脸存在头部朝向与身体关系错误、鼻口外形过尖以及张嘴形态失真的问题。本次参考真实猫侧脸的基本结构，将 walking 头部改为短口鼻、单眼可见、近侧耳更完整的侧脸轮廓，并让鼻口朝向身体外侧，避免出现“变形怪脸”的观感。

---

## [2026-04-07] 优化猫咪行走状态的体型和头尾细节

**改动类型**：重构

**涉及文件**：
- `apps/companion/src/renderer/pixelCat.ts` — 调整 walking 状态的身体比例、尾巴绘制和头部侧脸造型

**改动说明**：
将猫咪 walking 状态的身体拉长并加厚，增强横向行走时的体块感；尾巴改为单一路径绘制，修复原先重复描边导致的“尾巴分叉”观感；同时为 walking 状态单独绘制侧脸头部，使走路时更符合侧身移动的视觉逻辑。

---

## [2026-04-07] 同步文档中的宠物状态说明

**改动类型**：其他

**涉及文件**：
- `README.md` — 更新宠物状态表格，反映当前空闲动作轮换与工作中操作电脑的行为
- `docs/architecture.md` — 更新状态机示意，说明 completed 和 failed 仅影响提示气泡，不切换独立动作

**改动说明**：
此前 README 和架构文档仍保留旧版的睡觉、喝咖啡、抠动等描述，与当前实现不一致。本次已按实际状态机同步更新文档。

---

## [2026-04-07] 迁移 Copilot 指令模板到应用资源目录

**改动类型**：重构

**涉及文件**：
- `apps/companion/public/copilot-instructions.md` — 新增随 Companion 一起分发的 Copilot 指令模板
- `apps/companion/src/main/main.ts` — 调整全局指令复制逻辑，优先从应用资源目录读取模板
- `README.md` — 更新指令模板来源说明
- `docs/architecture.md` — 更新架构文档中的模板存放位置
- `.github/copilot-instructions.md` — 删除旧位置的模板文件

**改动说明**：
将 Copilot 指令模板从 `.github` 迁移到 `apps/companion/public`，使其能够在开发态和打包后的 App 中都作为应用资源直接读取，再复制到 VS Code 全局配置目录。

---

## [2026-04-07] 补充 README 启动命令说明

**改动类型**：其他

**涉及文件**：
- `README.md` — 补充开发模式、构建后启动、仅启动已构建 Companion 的命令说明

**改动说明**：
将 README 中的快速开始命令统一为工作区脚本，并新增“启动命令”小节，方便直接查找开发启动与正式启动方式。

---

## [2026-04-07] 修复 companion 类型检查兼容问题

**改动类型**：Bug修复

**涉及文件**：
- `apps/companion/src/main/main.ts` — 为 `createRequire` 方式加载的 Electron API 补充类型导入，修复 `BrowserWindow` 和 `Tray` 的类型报错
- `apps/companion/src/preload/preload.ts` — 将 `electron/renderer` 导入切回 `electron`，恢复 TypeScript 类型声明匹配

**改动说明**：
前一轮为兼容 Electron 运行时修改了主进程和 preload 的导入方式，但留下了 TypeScript 类型缺口，导致 companion 包无法完成全量 typecheck。此次补充类型别名并调整 preload 导入入口后，`npm run typecheck -w @agentpet/companion` 已可通过。

---

## [2026-04-07] 新增操作电脑工作状态并扩展空闲动作

**改动类型**：新增功能

**涉及文件**：
- `apps/companion/src/renderer/App.tsx` — 调整宠物状态机，让空闲态轮换坐着、趴着、走路三种动作，工作中切换为操作电脑状态
- `apps/companion/src/renderer/pixelCat.ts` — 为猫咪和龙虾新增 working 动画，并补充电脑、打字爪子等绘制逻辑

**改动说明**：
将通知阶段与实际动画状态拆开处理。无工作时不再固定为单一姿态，而是在坐着、趴着、走路之间轮换；收到 started 或 progress 时则切到单独的 working 动画，表现为宠物坐在电脑前操作。底部移动逻辑也同步改为仅在 walking 动画时触发。

**注意事项**：
当前空闲动作按固定时间轮换，如需改成更随机的节奏或按屏幕边缘智能停留，可继续扩展。

---

## [2026-04-07] 优化猫咪走路动作与体型比例

**改动类型**：重构

**涉及文件**：
- `apps/companion/src/renderer/pixelCat.ts` — 调整猫咪 walking 状态的步态节奏、尾巴摆动、头部起伏与身体轮廓，减少走路时的臃肿椭圆感

**改动说明**：
将猫咪 walking 动画从简单的四肢对称摆动，改为带抬脚节奏的前后腿交替步态，并同步加入更轻微的身体起伏、头部点动和尾巴摆动。原先走路时使用的横向椭圆身体改为更修长的流线型躯干，让视觉上不再显得过胖。

**注意事项**：
工作区根目录的 `typecheck` 脚本当前会递归调用自身，本次仅使用 companion 包的类型检查完成验证。

---