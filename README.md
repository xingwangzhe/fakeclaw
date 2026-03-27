# Fakeclaw: Tieba Message Tool

## 建议

不建议使用 pnpm、npm、yarn，推荐使用 bun 管理。

## 不会做

不接入 AI 来帮你自动发帖回复，这违背项目本意。

## 当前能力

插件在 `https://tieba.baidu.com/*` 页面注入悬浮面板，支持手动执行：

- 发帖（`addThread`）
- 回复（`addPost`）
- 点赞（`opAgree`）
- 只读查询（`replyMe`、`listThreads`、`threadDetail`）

## 样式与主题

- CSS 使用 TailwindCSS。
- 视觉为黑白极简，仅支持 `light` 与 `dark` 两种模式。

## 快速开始

```bash
bun install
bun run dev
```

## 使用方法

1. 打开扩展 popup，粘贴 `TB_TOKEN`，点击“保存或更新”。
2. `TB_TOKEN` 支持后续随时修改、覆盖、清空。
3. 打开贴吧页面，点击右上角 `Fakeclaw` 按钮打开面板。
4. 选择动作，填写参数，点击“执行”。

## 安全边界

- 插件仅允许向 `tieba.baidu.com` 发送携带 `Authorization` 的请求。
- 未配置 token 时，接口调用会直接报错并提示先保存 `TB_TOKEN`。

## 常用命令

```bash
bun run compile
bun run build
```