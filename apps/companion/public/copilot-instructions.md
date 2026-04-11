# agentpet 桌面宠物

通过 MCP `notify_pet` 工具通知桌面宠物任务状态。

## 调用规则

每次编码任务必须调用 `notify_pet`：
- **开始前** — `phase: "started"`，中文标题≤10字
- **切换步骤或持续工作>30秒** — `phase: "progress"`
- **完成时**（task_complete 前必调） — `phase: "completed"`
- **出错时** — `phase: "failed"`

返回"萌宠离线"后本次任务不再调用。
