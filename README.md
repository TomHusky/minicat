# AgentPet

AgentPet 是一个桌面宠物系统，通过 MCP (Model Context Protocol) 感知 VS Code Copilot Agent 的工作状态。Agent 执行编码任务时，屏幕上的像素宠物会实时反映状态。

## 架构

```
Copilot Agent  --MCP (stdio)-->  MCP Server  --HTTP POST-->  Electron Companion
```

只有两个运行时组件：

- **MCP Server** (`packages/mcp-server`) — 通过 stdio 与 VS Code 通信，暴露 `notify_pet` 工具
- **Companion** (`apps/companion`) — 运行在系统托盘的 Electron 桌面宠物

## 快速开始

```bash
npm install --ignore-scripts
npm run build:companion
npm run start:companion
```

## 启动命令

开发模式：

```bash
npm run dev
```

构建并启动 Companion：

```bash
npm run build:companion
npm run start:companion
```

只启动已构建的 Companion：

```bash
npm run start -w @agentpet/companion
```

Companion 启动后会自动注册到 VS Code 全局：
- `%APPDATA%/Code/User/mcp.json` — MCP Server 配置
- `~/.copilot/instructions/agentpet.instructions.md` — 用户级 Copilot instructions 文件

项目内的 Copilot 指令模板存放在 `apps/companion/public/copilot-instructions.md`，Companion 启动后会从应用资源中复制到全局目录；退出 Companion 时会自动删除该 instructions 文件，避免在应用未运行时继续影响 Copilot。

所有项目打开后即可使用，无需每个项目单独配置。

## 功能特性

### 宠物状态

| 状态 | 动画 | 说明 |
|------|------|------|
| idle | 坐着 / 睡觉 | 用户有键盘或鼠标操作时保持坐着，连续 1 分钟无操作时切换为睡觉 |
| active | 背身操作电脑 | Agent 正在执行任务时切换到工作状态 |
| completed | 保持空闲动作轮换 + 成功气泡 | 任务完成后显示成功提示，60 秒后清除 |
| failed | 保持空闲动作轮换 + 失败气泡 | 任务失败后显示失败提示，5 秒后清除 |

### 多动物支持

通过系统托盘右键菜单 > “设置” 可以选择不同的动物和给宠物命名：

- 🐱 猫咪（默认）
- 🐶 狗狗
- 🦞 龙虾
- 🐧 企鹅
- 🐼 熊猫

设置会持久化保存，重启后保留。

## 目录结构

```
apps/companion/         Electron 桌面宠物
  src/main/             主进程 (HTTP 服务器 + 窗口 + 设置持久化)
  src/preload/          IPC 桥接
  src/renderer/         React + CSS 像素宠物
packages/mcp-server/    MCP Server (stdio)
packages/protocol/      共享类型定义
```

## 手动测试

```bash
# 测试宠物状态通知
curl -X POST http://127.0.0.1:43127/notify -H "Content-Type: application/json" \
  -d '{"phase":"started","title":"测试任务"}'

# 检查 Companion 是否在线
curl http://127.0.0.1:43127/ping
```
