# core · 开发规则

> 定位：本包开发规范的索引。只写判断、边界与反例；事实以源码、`README.md` 与 `ultime schema --json` 为准。
> 适用版本：0.6.x
> 关系：入口见 [`AGENTS.md`](../AGENTS.md)；设计取舍见 [`DESIGN.md`](../DESIGN.md)；怎么用见 [`README.md`](../README.md)。

---

## 规则清单

| 文件 | 回答什么 |
|---|---|
| [01-architecture](./01-architecture.md) | 包定位、依赖方向、目录职责、五问边界 |
| [02-tokens](./02-tokens.md) | seed → 树 → 快照、生成物、合同与变更流程 |
| [03-testing](./03-testing.md) | 测试分层、守卫、改值后的验收 |
| [04-release](./04-release.md) | 三类版本、发布顺序、发布前检查 |

## 一句话

core 只给**档、参数与合同**；用法、语义、布局和平台策略都在上层。新增任何内容前，先过 [`DESIGN.md`](../DESIGN.md) 的五问。
