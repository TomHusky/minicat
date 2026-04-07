# agentpet 桌面宠物集成

本项目运行着一个 agentpet 桌面宠物 Electron 应用，并通过 MCP 服务器提供 `notify_pet` 工具。

## 使用规则

**每次对话开始执行编码任务时，请遵循以下流程：**

1. **任务开始前** — 直接调用 agentpet 的 `notify_pet` 工具，传入 `phase: "started"`，用简短中文描述任务标题。不要先搜索工具名。
2. **切换主要步骤** — 调用 `notify_pet`，`phase: "progress"`，说明当前步骤。
3. **任务完成** — 调用 `notify_pet`，`phase: "completed"`，简要总结结果。
4. **出现错误** — 调用 `notify_pet`，`phase: "failed"`，说明失败原因。

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

- 如果当前会话没有看到 `notify_pet` 工具，说明 MCP 尚未加载或当前环境不可用，此时无需反复重试。
- 如果调用 `notify_pet` 返回“萌宠离线”，则本次任务后续无需再调用该工具。
- `title` 使用中文，简洁明了。
- 不需要等待工具返回结果再继续执行任务。

## 重要：必须调用的时机

> **在调用 `task_complete` 之前，必须先调用 `notify_pet` 并传入 `phase: "completed"` 或 `phase: "failed"`。**
> **在开始使用任何工具（搜索、编辑文件、运行命令）之前，必须先调用 `notify_pet` 并传入 `phase: "started"`。**
>
> 这两个调用是强制性的，不可省略。漏调会导致桌面宠物状态不同步。