# Contributing

> 给贡献者与 AI 的最短协作规则。用法见 [README](./README.md)，设计取舍见 [DESIGN](./DESIGN.md)。

## 工作流

1. 从 `main` 切 `feat/<主题>` / `fix/<主题>`。
2. 完成后 `git rebase main` 再合并；主分支不保留中间提交。
3. 一次提交一件事，提交信息用 `type(scope): subject`，正文写「为什么」。

## 改动规则

- 生成物 `tokens.css` / `tokens.json` / `tokens.dtcg.json` / `kernel.json` 禁止手改；改 `src/seed.ts` 或 `src/model/**` 后跑 `pnpm build:tokens`。
- 值或派生规则变更必须补合同或测试。
- 契约变更（轴 / 命名 / 值形态）一次改完：模型、合同、产物、README、AI 文档同批。
- `src/model/**` 不 import `build` / `exporters` / `tools` / `studio`；类别之间互不 import。

## 验证

```bash
pnpm check
pnpm test
pnpm typecheck
npm pack --dry-run
```

## 版本

- 包版本按 semver；`schemaVersion` 管树与合同字段兼容面，`engineVersion` 管派生实现。
- 0.x 阶段 minor 可含破坏性变更，必须写进 README「版本与兼容」。
