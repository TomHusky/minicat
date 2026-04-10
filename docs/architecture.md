# 架构说明

## 目标

AgentPet 是一个桌面宠物系统，通过 MCP (Model Context Protocol) 感知 VS Code Copilot Agent 的工作状态。

## 整体架构

```
Copilot Agent  --MCP (stdio)-->  MCP Server  --HTTP POST-->  Electron Companion
(按指令调用 notify_pet)   (notify_pet)           (透明悬浮窗口)
```

### packages/mcp-server

- 实现 MCP 协议 (JSON-RPC over stdio)
- 暴露 `notify_pet` 工具
- 将通知通过 HTTP POST 转发给 Companion (127.0.0.1:43127)
- `tools/list` 始终返回工具；`tools/call` 时检测 Companion 在线状态

### apps/companion

- 透明、无边框、始终置顶的 Electron 窗口 (300×192)
- Windows: 定位在右下角系统托盘上方；macOS: 定位在 dock 居中上方
- HTTP 服务器监听 `/notify`（接收通知）和 `/ping`（健康检查）
- 启动时自动注册到 VS Code 全局 mcp.json，并同步用户级 Copilot instructions 文件；退出时自动删除该 instructions 文件
- 设置窗口：独立 BrowserWindow (380×420)，通过 URL hash `#settings` 区分
- 设置持久化：保存到 `app.getPath('userData')/settings.json`，当前仅支持动物选择，Copilot 监听默认开启

### packages/protocol

- 定义 `PetNotification`、`PetSettings`、`AnimalType` 类型

## 通知模型

```typescript
interface PetNotification {
  phase: 'started' | 'progress' | 'completed' | 'failed';
  title: string;       // 简短标题，10 字以内
  detail?: string;     // 当前步骤详情
  agentName?: string;  // 默认 "copilot"
}
```

## 设置模型

```typescript
type AnimalType = 'cat' | 'lobster';

interface PetSettings {
  animal: AnimalType;
  name: string;
  copilotListenerEnabled: boolean;
}
```

## 宠物状态机

```
idle (坐着 / 睡觉) <--60s-- completed (成功气泡，动作按用户活跃度切换)
idle (坐着 / 睡觉) <--5s--- failed (失败气泡，动作按用户活跃度切换)
idle (坐着 / 睡觉) <-------- (始终回归这里)
  ^active: 背身操作电脑动画
```

## 窗口架构

- **宠物窗口**：transparent + frameless，始终保持 300×192，鼠标穿透
- **设置窗口**：独立的正常窗口 380×420，确保不干扰宠物窗口的透明度
- 两个窗口加载同一个 HTML，通过 `#settings` hash 路由到不同组件

## 全局注册与清理

Companion **启动时**自动写入以下三项全局配置：

| 配置项 | 路径 | 说明 |
|--------|------|------|
| MCP Server | `~/Library/Application Support/Code/User/mcp.json` | 注册 `agentpet` stdio 服务，并设置 `toolApprovalRequired: false` 跳过每次授权弹窗 |
| Copilot instructions 文件 | `~/.copilot/instructions/agentpet.instructions.md` | 用户级 Copilot 指令，指导 Agent 调用 `notify_pet` |
| VS Code settings.json | `~/Library/Application Support/Code/User/settings.json` | 向 `github.copilot.chat.codeGeneration.instructions` 数组注入指令文件路径，确保所有工作区生效 |

> 路径示例为 macOS，Windows/Linux 会自动适配对应目录。

Copilot 指令模板跟随应用资源放在 `apps/companion/public/copilot-instructions.md`，便于在打包后的 App 内直接复制到全局配置目录。

Companion **退出时**会自动清理以上三项配置：
- 删除 `~/.copilot/instructions/agentpet.instructions.md`
- 从 `settings.json` 的 instructions 数组中移除对应条目
- 从 `mcp.json` 的 servers 中移除 `agentpet` 条目

让全局配置的生效周期与应用运行周期严格保持一致。
