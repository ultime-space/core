# @ultime/core · 操作约束

> 定位：AI 在本仓可以改什么、不能改什么、改完怎么验。与 [`AGENTS.md`](./AGENTS.md) 分工：这里只写操作边界。
> 适用版本：0.6.x

---

## 可写

| 路径 | 条件 |
|---|---|
| `src/seed.ts` / `src/model/**` | 值或派生规则变更；必须有合同或测试 |
| `src/exporters/**` | 只改翻译写法，不改值与派生 |
| `src/tools/**` / `src/studio/**` | 工具层 / 配置器定义；不引入文件 IO 或 DOM |
| `tests/**` | 与代码改动同批 |
| `scripts/**` | 守卫或构建入口；不放业务逻辑 |
| `rules/` / `llms.txt` / `skills.md` / `agent.md` | 随版本同批更新 |

## 只读

- `tokens.css` / `tokens.json` / `tokens.dtcg.json` / `kernel.json`：生成物，改源后重跑；
- `dist/**`：构建物，不手改、不入库；
- `node_modules/**`。

## 禁止

- 在 `src/model/**` 引入第三方运行时依赖；
- `model` 反向 import `build` / `exporters` / `tools` / `studio`；
- 类别之间互相 import；
- 在模型里写 `px` / `rem` / `var()` / `color-mix` 等载体语法；
- 把语义角色、布局、目标尺寸、交互反馈塞进 core；
- 为让守卫通过而放宽守卫；
- 用 Markdown 里的数值替代 `ultime schema --json` / `kernel.json`。

## 验证

```bash
pnpm check
pnpm test
pnpm typecheck
```

- 改了 seed / model：再跑 `pnpm build:tokens`，看产物 diff；
- 改了导出面：同步 `README.md`、`skills.md` 与版本戳；
- 交付时说明跑了哪些命令；没跑或失败要写清哪一条、为什么。

## 不确定时

- 先查 `DESIGN.md` 的五问；仍不确定就停下来问，不猜默认值、不新造 token。
