# Fakeclaw: Tieba Message Tool

## 快速开始

```bash
bun install
bun run dev
```

## 先决条件（必须先完成）

1. 先获取 `TB_TOKEN`：
	`https://tieba.baidu.com/mo/q/hybrid-usergrow-activity/clawToken`
2. 确认当前页面在贴吧域名：
	`https://tieba.baidu.com/*`
3. 打开插件 popup 或页面悬浮面板，保存 `TB_TOKEN`。

## 正确发送信息（推荐顺序）

1. 打开贴吧页面后，点击 `Fakeclaw` 按钮打开悬浮面板。
2. 在面板顶部确认 `Token 状态：已保存`。
3. 在顶部导航选择动作：`发帖`、`回复`、`查询帖子`。
4. 发帖：填写标题和内容后点击 `发送帖子`。
5. 回复：填写回复内容后点击 `发送回复`。
6. 查询：先点 `读取帖子列表` 或 `读取当前帖子详情`，再按结果继续操作。
7. 以面板中的 `最近状态` 和底部输出为准判断成功/失败。

## 常见失败与排查

1. 提示 `Token 不能为空`：先保存 `TB_TOKEN`。
2. 提示 `未收到后台响应`：重载扩展后再试。
3. 提示 `无法识别帖子上下文`：先打开具体帖子页，或先执行 `读取帖子列表`。
4. 提示 `网络请求失败`：检查 token 是否有效、是否仍在 `tieba.baidu.com`、网络是否可用。
5. 内容过长失败：`content` 不能超过 1000 字符。

## 使用说明

1. `TB_TOKEN` 支持后续随时修改、覆盖、清空。
2. popup 与页面面板会实时同步 token 和主题。
3. `Fakeclaw` 按钮和面板都支持拖拽。
4. 面板为可滚动布局，底部结果区域可查看完整反馈。

## 当前能力

- 发帖（`addThread`）
- 回复（`addPost`）
- 点赞（`opAgree`）
- 只读查询（`replyMe`、`listThreads`、`threadDetail`）

## 安全边界

- 仅允许向 `tieba.baidu.com` 发送携带 `Authorization` 的请求。
- 不会把 `TB_TOKEN` 发送到非贴吧域名。

## 样式与主题

- CSS 使用 TailwindCSS。
- 视觉为黑白极简，仅支持 `light` 与 `dark` 两种模式。

## 开发建议

- 不建议使用 pnpm、npm、yarn，推荐使用 bun 管理。

## 不会做

- 不接入 AI 来帮你自动发帖回复，这违背项目本意。

## 常用命令

```bash
bun run compile
bun run build
```