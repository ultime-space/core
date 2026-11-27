# core

> 平台无关的设计系统内核：**seed → 一棵树 → 快照**。Web 的 CSS 只是它的一个出口。

[![license](https://img.shields.io/badge/license-MIT-black)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D22.18-black)](./package.json)

`@ultime/core` 把少量可编辑的设计输入（seed）算成一棵 DTCG 形态的 token 树，再翻译成 CSS / JSON / DTCG。
它不含组件、class、路由或配置界面，也不承载品牌：同一套机制可以生成不同风格。

> **导读**：先上手看[安装](#安装) → [快速开始](#快速开始)；查接口与 CLI 看 [USAGE](./USAGE.md)；改内核先读 [`DESIGN.md`](./DESIGN.md)。

## 这是什么 / 不是什么

| 是 | 不是 |
|---|---|
| 一份可复现的样式数据源 | 组件库 / 样式框架 |
| seed 驱动的派生引擎与出口 | 设计工具；配置器建立在 `@ultime/core/studio` 之上 |
| 中性工具：只给档与生成参数 | 语义表、布局、断点、目标尺寸（归上层） |
| 可入库、可 diff、可交换的快照 | 组件状态、交互行为或业务规则 |

---

## 安装

```bash
pnpm add @ultime/core
```

Node.js >= 22.18。内核的 `.` / `./exporters` / `./tools` / `./seed` 出口是编译后的 JS，零第三方依赖；
`./studio` 出口（配置器）依赖 `@ultime/studio`，`ultime-core` bin 依赖 `@ultime/cli`；不用配置器 / CLI 时不会进入你的产物。

所有出口 **ESM-only**：用 `import` / `import()` 消费，不提供 `require` 入口；类型来自 `dist/*.d.ts`，包体不含 `src/`。

## 快速开始

```js
import { buildCore } from '@ultime/core'
import { treeToCss, treeToJson, treeToDtcg } from '@ultime/core/exporters'

const result = buildCore({ color: { chromaRatio: 0.9, primaryHue: 250 } })

result.tree        // 一棵树
result.contracts   // 合同：rows / total / failed / ids
result.counts      // token 计数

const css = treeToCss(result)
```

换品牌 / 调档只改 seed，然后重跑构建；不要手改快照。

光影用同一份引擎求解；seed 只给一个全局角度，静态快照只表达默认形态 `convex`：

```js
import { bakeLight, solveLight } from '@ultime/core'

bakeLight({ light: { angle: 45 } }) // 一个角度 → 整套光影原料
solveLight({ form: 'concave', depth: 3, mode: 'dark' })
```

`bakeLight` 在引擎层烘焙，内核只存角度与结果；`solveLight` 只收形态 / 深度 / 模式，不收尺寸、圆角或组件名；`flat` / `convex` / `concave` 在构建期取，不写入静态快照。

## 文档

| 文件 | 回答什么 |
|---|---|
| 本页 | 安装、最小可跑、边界与版本 |
| [USAGE](./USAGE.md) | 完整用法：统一出口、定制、模型、Web 消费、CLI、产物与目录 |
| [DESIGN](./DESIGN.md) | 为什么这样设计 |
| [MIGRATION](./MIGRATION.md) | 从 0.11.x 升级到 1.0 |
| [CHECKS](./CHECKS.md) | 合同与机检 |

## 边界

1. **seed 是唯一输入**：换品牌 / 调档只改 seed，然后重跑构建。
2. **模型不带载体**：树里只存值、量纲与 `$type`；`px` / `rem` / `var()` / `color-mix` 的写法在出口。
3. **语义不在树里**：角色（enter / exit / press）、语义表（gap / type / border）、布局（容器 / 栅格 / 断点）、
   目标尺寸（44 / 28–32）归上层；官方语义表模板属工具层，不参与树的计数与合同。
4. **方向靠守卫**：`model` 不 import `build` / `exporters` / `tools` / `studio`，四个类别之间也互不 import；
   `scripts/check-model.ts` 机械拦截。
5. **可复现**：同 seed 同版本逐字节相同；manifest 不含时间戳与绝对路径。

新增内容前先问：它是值还是用法？依赖平台吗？能由参数派生吗？能机检吗？会不会出现第二份正文？

---

## 版本与兼容

- 1.0.2：包内脚本改用 `vp run` 入口，去掉对 pnpm 二进制的硬依赖；产物与运行时不变。
- 1.0.1：README 改为入口卡，完整用法下沉到 [USAGE.md](./USAGE.md)；树、产物与运行时不变。
- 包版本按 semver；`kernel.json` 里的 `schemaVersion` 描述树与合同字段的兼容面；派生实现由包版本表达，不再单独维护 `engineVersion`。
- 1.0.0：破坏性升级；旧 → 新对照与操作清单见 [MIGRATION.md](./MIGRATION.md)。
- 依赖基线：`@ultime/studio` / `@ultime/cli` 发版后，core 下次发版前更新 lockfile 到最新已发布版本并重建测试；已发布版本不追改。
- 0.11.2：`build` / `inspect` 共用配置加载；依赖基线对齐 `@ultime/cli ^0.4.0`；API、树与产物不变。
- 0.11.1：`readSeedFile` 校验对象形状；`inspect` 有 error 诊断时返回 1；`emitTokens` 按平台生成并复用 manifest。
- 0.11.0 升级 `@ultime/cli ^0.3.0`：CLI 入口改为异步，参数按命令级 flag 校验，未知参数退出 2；库 API、树与产物不变。
- 0.9.1 发布产物默认压缩；API、树与合同不变。
- 0.9.0 新增 `planGradient`（根出口与 `./studio`）：树、合同与产物不变，`engineVersion` 不变。
- 0.7.0 新增 `@ultime/core/studio` 选择 API；树、合同与派生值不变，快照只有 `engineVersion` 变化。
- 0.5.0 是契约刷新：`rim` → `highlight.ambient`，`bevel.highlight/shade` → `highlight.key` / `shade.key`；seed 的 `lightTint` / `ambientTint` / `rimAlpha` / `bevel` 改为 `lightColor` / `ambientColor` / `ambientAlpha` / `key`。不提供迁移器。
- 下游优先读 `kernel.json` 与公开出口，不依赖 `src/` 内部结构。
- 0.x 阶段导出面仍可能调整；升级前对比两份 `kernel.json`（版本 / 计数 / 合同摘要）即可看出差异。

---

## 开发

```bash
pnpm install
pnpm build          # 产物 + dist 库出口（含 bin）
pnpm ultime         # 开发态 CLI（vpx src/cli/index.ts）
pnpm build:tokens   # 只生成 token / manifest
pnpm test           # Vitest 回归
pnpm check          # 格式 / lint / 类型 / 守卫 / 产物同源
```

指定项目 seed：

```bash
pnpm build:tokens -- --seed path/to/theme.json
```

改了 `theme.example.json` 或 `src/model/**` 之后必须重跑 `build:tokens`；`check` 会拦下产物与源不一致的构建。

---

## 给 AI 与其他工具

- 机器入口是 `kernel.json` 与 `ultime-core schema --json`；不要让 agent 从 Markdown 里抄数值。
- 完整设计规范（取值理由、对比度与配对判据）不随包分发：安装 [`@ultime/designcraft`](https://www.npmjs.com/package/@ultime/designcraft) skill（`npx skills add ultime-space/skills --skill designcraft`）阅读。
- 包内 AI 入口是 [`llms.txt`](./llms.txt)（路由）与 [`SKILLS.md`](./SKILLS.md)（能力表）；`AGENTS.md` / `rules/` 只在仓库内维护。

---

## 许可

MIT，见 [LICENSE](./LICENSE)。
