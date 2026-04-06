# agentpet 桌面宠物集成

本项目运行着一个 agentpet 桌面宠物 Electron 应用，并通过 MCP 服务器提供 `notify_pet` 工具。

## 使用规则

**每次对话开始执行编码任务时，请遵循以下流程：**

0. **首次调用前（每次对话必须执行一次）** — 使用 `tool_search` 搜索 `mcp_agentpet_notify_pet` 以加载该延迟工具。这是强制步骤，不可跳过。如果搜索结果中没有该工具，说明宠物离线，后续无需调用。
1. **任务开始前** — 调用 `notify_pet`，`phase: "started"`，用简短的中文描述任务标题
2. **切换主要步骤** — 调用 `notify_pet`，`phase: "progress"`，说明当前步骤
3. **任务完成** — 调用 `notify_pet`，`phase: "completed"`，简要总结结果
4. **出现错误** — 调用 `notify_pet`，`phase: "failed"`，说明失败原因

## 工具参数

```
notify_pet(
  phase: "started" | "progress" | "completed" | "failed",
  title: string,        // 简短标题，10 字以内
  detail?: string,      // 当前步骤详情（可选）
  agentName?: string    // 默认 "copilot"
)
```

## 注意事项

- 当 AgentPet 桌面宠物未运行时，`notify_pet` 工具不会出现在可用工具列表中，无需调用
- 如果调用 `notify_pet` 返回“萌宠离线”，则本次任务后续不再调用该工具
- `title` 使用中文，简洁明了
- 不需要等待工具返回结果再继续执行任务

## 重要：必须调用的时机

> **在调用 `task_complete` 之前，必须先调用 `notify_pet` 并传入 `phase: "completed"` 或 `phase: "failed"`。**
> **在开始使用任何工具（搜索、编辑文件、运行命令）之前，必须先调用 `notify_pet` 并传入 `phase: "started"`。**
>
> 这两个调用是强制性的，不可省略。漏调会导致桌面宠物状态不同步。
