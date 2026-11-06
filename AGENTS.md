# AGENTS.md — @ultime/core

> 给在本仓库工作的 AI 与协作者：只放入口与红线，不复述 README。
> 适用版本：0.5.x

## 先读

1. [`README.md`](./README.md) — 用法、出口、产物与边界。
2. [`DESIGN.md`](./DESIGN.md) — 设计理念与数值出处；判断某内容该不该进 core。
3. [`rules/README.md`](./rules/README.md) — 本包开发规范。
4. [`llms.txt`](./llms.txt) — AI 索引；能力表见 [`skills.md`](./skills.md)，操作约束见 [`agent.md`](./agent.md)。
5. [`src/build.ts`](./src/build.ts) — seed → 树 → 合同 → manifest 的唯一装配点。
6. [`scripts/check-model.ts`](./scripts/check-model.ts) — 结构与依赖方向守卫。

## 红线

- **生成物不手改**：`tokens.css` / `tokens.json` / `tokens.dtcg.json` / `kernel.json` 由 `pnpm build:tokens` 生成；
  改 seed 或 `src/model/**` 后重跑，不直接编辑文件。
- **方向单向**：`src/model/**` 不得 import `build` / `exporters` / `tools` / `studio`；四个类别之间也不得互相 import。
- **语义与策略不进 core**：角色、语义表、布局、断点、目标尺寸、交互反馈归上层。
- **派生优先**：能由 seed 参数算出的值不写第二份名单；同一事实只保留一份。
- **不带载体语法**：模型只产出值、量纲与 `$type`；`px` / `rem` / `var()` / `color-mix` 只出现在出口。
- **不引第三方运行时依赖**：`@ultime/studio` 仅在 `src/studio/**` 使用。

## 验证

```bash
pnpm check        # 格式 / lint / 守卫 / 产物同源
pnpm test
pnpm typecheck
```

没跑或没跑通时，必须说明是哪一条、为什么。

## 提交

一个主题一个提交；源与生成物同改同提。
