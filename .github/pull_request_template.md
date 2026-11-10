## 变更

<!-- 这个 PR 解决什么问题；为什么现在做。 -->

## 自查

- [ ] README / 用法 / 示例与代码一致；链接、版本、CHANGELOG 已同步
- [ ] 注释只写为什么、约束、反直觉处，没有复述代码
- [ ] 没有新增第二份正文、重复入口或第二套默认值
- [ ] 新增能力有入口、示例与验证命令
- [ ] 生成物未手改；改 seed 或模型后已重跑生成
- [ ] 包体边界：`npm pack --dry-run` 不含 `tests` / `scripts` / `rules` / 包根 `AGENTS.md` / 构建配置 / lockfile
- [ ] Node 基线：`engines.node >= 22.18`、产物 `target: node22` 未偏离
- [ ] 包质量：`pnpm build` 的 `publint` / `attw` / `unused` 通过
- [ ] 体积报告已看（`pnpm size`，只报告、不设门禁）
- [ ] 已跑 `pnpm check`、`pnpm test`、`pnpm build`、`npm pack --dry-run`

## 审核重点

- 架构 / 边界 / 取舍：
- 风险 / 未覆盖：
