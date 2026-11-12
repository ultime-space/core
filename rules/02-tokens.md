# 02 · Token 与生成物

> 定位：seed、树、快照与合同的变更流程。
> 适用版本：0.10.x
> 关系：目录与边界见 [`01-architecture`](./01-architecture.md)；数值出处见 [`DESIGN.md`](../DESIGN.md)。

---

## 管线

```text
seed（唯一可编辑输入）
  → buildCore（schema / derive / check）
  → 树（token / group / 模式值）
  → CSS / JSON / DTCG / kernel.json
```

- **seed 是唯一输入**：色相、彩度、中性配方、画布对称、面目标、前景端点、模式、圆角基座、字号基准、字体栈、光源方向 / 光色、动效步长。
- **树只有两种节点**：`token`（`$type` / `$value`）与 `group`；组只做分隔。
- **类别不是包**：`skeleton` / `color` / `light` / `motion` 可按类别整块裁剪；选择 / 裁剪在 `src/studio/**`，`buildCore` 仍产完整树。
- **模式是作用域**：颜色与 `highlight.key` / `shade.key` 的值是 `{ light, dark }`；CSS 出口是值位 + 无后缀开关。

## 生成物

| 文件 | 性质 | 规则 |
|---|---|---|
| `tokens.css` / `tokens.json` / `tokens.dtcg.json` | 生成物，入库 | 禁止手改；改 seed / model 后重跑 |
| `kernel.json` | manifest，入库 | 下游唯一契约；不含时间戳与绝对路径 |
| `dist/*.js` | 构建物，不入库 | `prepublishOnly` 强制重建 |

`pre-commit` 会跑 `build --check`，拦下「新源码带旧产物」。

## 合同

- 结构合同（引用闭包、无载体语法、产物同源）**失败即构建失败**。
- 颜色报告按 `pass / warn / deviation / unverified` 分级，只报告并写入 manifest，不阻断，不设 `strict`。
- 同一事实只声明一处：颜色目标由派生与合同共用，不复制到第二份名单。

## 变更流程

1. 改 `src/seed.ts` 或 `src/model/**`；
2. 跑 `pnpm build:tokens` 重算产物；
3. 看 `git diff` 的产物差异，确认只包含预期变化；
4. 跑 `pnpm check` 与 `pnpm test`；
5. 同步 AI 文档的版本戳与能力表（见 [`04-release`](./04-release.md)）。

**反例**：直接改 `tokens.css` 让对比度达标 —— 下次构建即丢失，且合同与产物不同源。
