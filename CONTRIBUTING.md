# Contributing

> 给贡献者与 AI 的最短协作规则。用法见 [README](./README.md)，设计取舍见 [DESIGN](./DESIGN.md)。

## Git 流程

1. 从 `main` 切 `feat/<主题>` / `fix/<主题>` / `docs-<主题>`。
2. 开发完成后 `git rebase main`；一次提交一件事，提交信息用 `type(scope): subject`，正文写「为什么」。
3. push 分支并开 PR；CI 必须通过，评论必须解决。
4. 用 rebase / squash 合并，删除分支；`main` 不保留中间提交。
5. 不直接 push `main`，不 force push、不删除 `main`；`main` 受保护，管理员也一样。
6. 发布按包版本打 tag，由 CI 执行；tag 规则见仓库保护设置。

## 改动规则

- 生成物 `tokens.css` / `tokens.json` / `tokens.dtcg.json` / `kernel.json` 禁止手改；改 `src/seed.ts` 或 `src/model/**` 后跑 `pnpm build:tokens`。
- 值或派生规则变更必须补合同或测试。
- 契约变更（轴 / 命名 / 值形态）一次改完：模型、合同、产物、README、AI 文档同批。
- `src/model/**` 不 import `build` / `exporters` / `tools` / `studio`；类别之间互不 import。

## Review

提交 PR 前自查五件事：

- **文档**：README / 用法 / 示例是否仍准确；链接、版本、CHANGELOG 是否同步。
- **注释**：只写为什么、约束、反直觉处；不复述代码。
- **冗余**：同一事实只有一份正文；新增说明先改真源，其他位置只留指针。
- **缺漏**：新增能力是否有入口、示例与验证命令。
- **漂移**：`package.json` / README / `CHANGELOG` / VERSION（及适用的 AI 文档）版本是否一致。
- **包体**：`npm pack --dry-run` 不含 `tests` / `scripts` / `rules` / 包根 `AGENTS.md` / 构建配置 / lockfile；`exports` 与类型入口一致。
- **基线**：`engines.node >= 22.18`、`build.target: node22` 未偏离；开发端脚本与依赖不进入发布包。

机械检查交给 CI；人审看架构、边界、语义与取舍。

## 验证

```bash
pnpm check
pnpm test
pnpm build          # 含 publint / attw / unused
pnpm size           # 体积只报告，不设门禁
npm pack --dry-run
```

## 版本

- 包版本按 semver；`schemaVersion` 管树与合同字段兼容面，`engineVersion` 管派生实现。
- 0.x 阶段 minor 可含破坏性变更，必须写进 README「版本与兼容」。
