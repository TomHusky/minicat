# 迭代手册

## 当前架构

项目只有两个运行时组件：MCP Server + Electron Companion。
Agent 通过 VS Code 全局 prompts 和 mcp.json（Companion 启动时自动注册）进行集成。

## 已实现功能

- 像素风宠物动画（4种状态：idle/active/completed/failed）
- 睡觉 zzz 动画（idle 状态）
- 语音气泡显示任务标题
- 2 种动物选择：猫咪、龙虾
- 设置持久化（动物；名称字段仍保留在数据模型中）
- 独立设置窗口（避免透明窗口 resize 问题）
- VS Code 全局自动注册（mcp.json + instructions 文件 + settings.json 注入）
- 退出时自动清理所有全局配置（mcp.json、instructions 文件、settings.json 条目）
- MCP 工具自动授权（toolApprovalRequired: false）

## 后续改进方向

### 1. 动画视觉加强

- 用 Sprite Sheet 替换手绘像素画
- 为不同动物定制专属动画
- 增加庆祝 / 思考等更多状态

### 2. 多屏幕支持

- 当前只支持主显示器，后续可检测用户选择的显示器

### 3. 打包分发

- electron-builder 打包为 exe/dmg
- 安装包自动注册到 VS Code

### 4. 更多动物

- 扩展 `AnimalType` 与设置面板选项
- 为新增动物补充渲染资源与动画

## 添加 MCP 工具的步骤

1. 在 `packages/mcp-server/index.mjs` 的 TOOLS 数组中添加工具定义
2. 在 `handleRequest` 的 `tools/call` 分支中支持新工具逻辑
3. 如需要新的通知类型，在 `packages/protocol/src/index.ts` 中更新类型
4. 在 Companion 的 `App.tsx` 中处理新的通知

## 添加新动物的步骤

1. 在 `packages/protocol/src/index.ts` 的 `AnimalType` 中添加类型
2. 在 `App.tsx` 的 `ANIMALS` 数组中添加 emoji 和标签
3. 在 `pixelCat.ts` 中补充对应动物的绘制逻辑或素材映射
