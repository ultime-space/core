# AGENTS.md — @ultime/core

> 给在本仓库工作的 AI 与协作者：入口、可写 / 只读、红线与验收。
> 适用版本：0.9.x

## 先读

1. [`README.md`](./README.md) — 用法、出口、产物与边界。
2. [`DESIGN.md`](./DESIGN.md) — 设计理念与数值出处；判断某内容该不该进 core。
3. [`rules/README.md`](./rules/README.md) — 本包开发规范。
4. [`llms.txt`](./llms.txt) — AI 索引；能力表见 [`SKILLS.md`](./SKILLS.md)。
5. [`src/build.ts`](./src/build.ts) — seed → 树 → 合同 → manifest 的唯一装配点。
6. [`src/tools/project.ts`](./src/tools/project.ts) — `planProject`：一次派生 → artifacts / manifest / diagnostics。
7. [`src/studio/selection.ts`](./src/studio/selection.ts) — 配置器选择模型：类别 / 档位过滤与定制产物。
8. [`src/studio/derivation.ts`](./src/studio/derivation.ts) — 配置器自定义派生：只调参数化引擎函数。
9. [`scripts/check-model.ts`](./scripts/check-model.ts) — 结构与依赖方向守卫。

## 可写 / 只读

| 路径 | 条件 |
|---|---|
| `src/seed.ts` / `src/model/**` | 值或派生规则变更；必须有合同或测试 |
| `src/exporters/**` | 只改翻译写法，不改值与派生 |
| `src/tools/**` / `src/studio/**` | 工具层 / 配置器定义；不引入文件 IO 或 DOM |
| `tests/**` | 与代码改动同批 |
| `scripts/**` | 守卫或构建入口；不放业务逻辑 |
| `rules/` / `llms.txt` / `SKILLS.md` | 随版本同批更新 |

只读：`tokens.css` / `tokens.json` / `tokens.dtcg.json` / `kernel.json`（生成物，改源后重跑）；`dist/**`；`node_modules/**`。

## 红线

- **功能变更同批更新**：测试、README、`CHANGELOG.md` 与 AI 文档；没有功能性更新时只改文档并写明。
- **生成物不手改**：`tokens.css` / `tokens.json` / `tokens.dtcg.json` / `kernel.json` 由 `pnpm build:tokens` 生成；
  改 seed 或 `src/model/**` 后重跑，不直接编辑文件。
- **方向单向**：`src/model/**` 不得 import `build` / `exporters` / `tools` / `studio`；四个类别之间也不得互相 import。
- **语义与策略不进 core**：角色、语义表、布局、断点、目标尺寸、交互反馈归上层。
- **选择只在配置器**：选项 / 档位过滤归 `src/studio/selection.ts`；`buildCore` 永远产完整树，不写回 core 配置。
- **派生只调引擎函数**：自定义派生归 `src/studio/derivation.ts`，只包装 `solveLight` 等已有函数；不支持用户 recipe / 沙箱。
- **派生优先**：能由 seed 参数算出的值不写第二份名单；同一事实只保留一份。
- **不带载体语法**：模型只产出值、量纲与 `$type`；`px` / `rem` / `var()` / `color-mix` 只出现在出口。
- **不引第三方运行时依赖**：`@ultime/studio` 仅在 `src/studio/**` 使用。
- **不放宽守卫**：不为让检查通过而改守卫或跳过；守卫缺口按缺陷登记。
- **文档不抄数值**：数值从 `ultime schema --json` 或 `kernel.json` 查，不从 Markdown 抄。

## 验证

```bash
pnpm check        # 格式 / lint / 类型 / 守卫 / 产物同源
pnpm test
```

- 改了 seed / model：再跑 `pnpm build:tokens`，看产物 diff；
- 改了导出面：同步 `README.md`、`SKILLS.md` 与版本戳；
- 没跑或没跑通时，必须说明是哪一条、为什么。

## 提交

一个主题一个提交；源与生成物同改同提。

## 不确定时

先查 `DESIGN.md` 的五问；仍不确定就停下来问，不猜默认值、不新造 token。
