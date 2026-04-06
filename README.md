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
npm start -w @agentpet/companion
```

Companion 启动后会自动注册到 VS Code 全局：
- `%APPDATA%/Code/User/mcp.json` — MCP Server 配置
- `%APPDATA%/Code/User/prompts/agentpet.instructions.md` — 全局 Copilot 指令

所有项目打开后即可使用，无需每个项目单独配置。

## 功能特性

### 宠物状态

| 状态 | 动画 | 说明 |
|------|------|------|
| idle | 躺在椅子上 + zzz 睡觉 | 无任务时的默认状态 |
| active | 左右步行 | Agent 正在执行任务 |
| completed | 坐下喝咖啡 | 任务完成，60秒后回到 idle |
| failed | 抠动 | 任务失败，5秒后回到 idle |

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
