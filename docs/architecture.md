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

- 透明、无边框、始终置顶的 Electron 窗口 (300×140)
- Windows: 定位在右下角系统托盘上方；macOS: 定位在 dock 居中上方
- HTTP 服务器监听 `/notify`（接收通知）和 `/ping`（健康检查）
- 启动时自动注册到 VS Code 全局 mcp.json 和 prompts 目录
- 设置窗口：独立 BrowserWindow (400×460)，通过 URL hash `#settings` 区分
- 设置持久化：保存到 `app.getPath('userData')/settings.json`

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
type AnimalType = 'cat' | 'dog' | 'lobster' | 'penguin' | 'panda';

interface PetSettings {
  animal: AnimalType;
  name: string;
}
```

## 宠物状态机

```
idle (睡觉 zzz)  <--60s-- completed (喝咖啡)
idle            <--5s---  failed (抠动)
idle            <-------- (始终回归这里)
  ^active: 步行动画
```

## 窗口架构

- **宠物窗口**：transparent + frameless，始终保持 300×140，鼠标穿透
- **设置窗口**：独立的正常窗口 400×460，确保不干扰宠物窗口的透明度
- 两个窗口加载同一个 HTML，通过 `#settings` hash 路由到不同组件

## 全局注册

Companion 启动时自动写入：
- `%APPDATA%/Code/User/mcp.json` — 所有项目共享 MCP Server
- `%APPDATA%/Code/User/prompts/agentpet.instructions.md` — 全局 Copilot 指令
