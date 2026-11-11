# core

> 平台无关的设计系统内核：**seed → 一棵树 → 快照**。Web 的 CSS 只是它的一个出口。

[![license](https://img.shields.io/badge/license-MIT-black)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D22.18-black)](./package.json)

`@ultime/core` 把少量可编辑的设计输入（seed）算成一棵 DTCG 形态的 token 树，再翻译成 CSS / JSON / DTCG。
它不含组件、class、路由或配置界面，也不承载品牌：同一套机制可以生成不同风格。

> **导读**：先上手看[安装](#安装) → [快速开始](#快速开始)；查接口看[出口](#出口) / [CLI](#cli)；改内核先读 [`DESIGN.md`](./DESIGN.md)。

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
`./studio` 出口（配置器）依赖 `@ultime/studio`，`ultime` bin 依赖 `@ultime/cli`；不用配置器 / CLI 时不会进入你的产物。

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

光影用同一份引擎求解；静态快照只表达默认形态 `convex`：

```js
import { solveLight } from '@ultime/core'

solveLight({ form: 'concave', depth: 3, mode: 'dark' })
```

`solveLight` 只收形态 / 深度 / 模式，不收尺寸、圆角或组件名；`flat` / `concave` 在构建期取，不写入静态快照。

## 构建计划

同一次构建只派生一次。CLI、studio 与脚本都消费 `planProject` 返回的同一份事实：

```js
import { planProject } from '@ultime/core/tools'

const build = planProject({ tokens: { output: 'styles' } }, seed)
build.core         // CoreResult
build.manifest     // kernel.json 的内容
build.artifacts    // 产物清单（path / content / bytes）
build.diagnostics  // error / warn / info
```

`exportArtifacts` 是兼容入口，内部同样走 `planProject`；不要再自己拼产物清单。

### 选择与定制产物

选择是配置器的配置，不是 core 的构建输入。`@ultime/core/studio` 提供无头选择 / 派生 API：
从 `ProjectBuild.core.tree` 里按类别与档位过滤、按参数化引擎函数派生，导出定制 tokens；`buildCore` 的完整树不变。

```js
import { planProject } from '@ultime/core/tools'
import { selectBuild, selectTree, deriveTree } from '@ultime/core/studio'

const build = planProject({ tokens: { output: 'styles' } })
const selected = selectBuild(
  build,
  { categories: ['skeleton', 'color'], steps: { space: [1, 2, 4, 6], radius: [1, 3, 5] } },
  { light: { form: 'flat' } },
)

selected.tree         // 过滤 / 派生后的树
selected.counts       // 按类别重算
selected.artifacts    // tokens.css / tokens.json / tokens.dtcg.json（不含 kernel.json）
selected.diagnostics  // 未知类别 / 档位、缺失档位、空选择、semantics 提示

selectTree(build.core.tree, { categories: ['motion'], steps: { motionDuration: [1, 3] } })
deriveTree(build, { light: { form: 'concave' } })
```

- 类别：`skeleton` / `color` / `light` / `motion`；省略 = 全部，空数组 = 不启用。
- 档位：`space` / `size` / `radius` / `fontSize` / `lineHeight` / `letterSpacing` / `shadow` / `occlusion` / `motionDuration` / `motionDelay` / `motionLoop`；省略 = 该组全量，空数组 = 去掉该组数字档位。
- 非档位 token（`shadow.color` / `font` / `motion.easing` 等）跟随所属类别保留。
- 自定义派生只调用 core 引擎函数：目前支持 `light.form` 的 `flat` / `concave`，按 `solveLight` 重算 `highlight` / `shade`，不写回 seed，也不支持用户 recipe。
- `kernel.json` 描述完整内核，不属于选择产物；`semantics.json` 也不在选择里生成。
- 配置器把 `selection` / `derivation` 放在 `ThemeStudioConfig` 根上，可序列化保存；CLI 只读 `tokens` 区，选择 / 派生另存 studio 配置，不写进 `ultime.config.json`。

---

## 模型

> 为什么是一棵树、为什么派生优先、数值出处怎么定：设计取舍见 [DESIGN.md](./DESIGN.md)，本节只写机制。

```text
seed（少量可编辑输入）
      │
      ▼
buildCore：schema + derive + check
      │
      ▼
树（DTCG 形态：token / group / 模式值）
      │
      ├── CSS 变量
      ├── 原生 JSON
      └── DTCG 交换格式 + manifest
```

- **seed 是唯一输入**：色相 / 彩度 / 中性配方 / 画布对称 / 面目标 / 前景端点 / 启用模式 / 圆角基座 / 字号基准 / 字体栈 / 光源方向与光色 / 受光边 alpha / 动效步长。
- **树只有两种节点**：`token`（`$type` / `$value`）与 `group`；组只做分隔，不承载语义。
- **类别不是包**：`skeleton` / `color` / `light` / `motion` 是同一棵树里的类别，可按类别整块裁剪。
- **光影五槽**：`highlight.key` / `highlight.ambient` / `shade.key` / `shadow` / `occlusion`；静态 tokens 只表达 `convex`，`flat` / `concave` 走 `solveLight`。
- **模式是作用域**：颜色与 `highlight.key` / `shade.key` 的值是 `{ light, dark }`；写进 CSS 时变成值位 + 无后缀开关。
- **语义不在树里**：`gap.*` / `type.*` / `border.*` 只写路径，归可选的语义表。
- **实心面前景独立**：每个色族有 `tone.{族}.solid.foreground`；`ink` 只用于中性面，彩色实心面必须用 `foreground`。

---

## 在 Web 里消费

```js
import '@ultime/core/tokens.css'
```

```css
padding: var(--space-6);
font-size: var(--fs-4);
line-height: var(--lh-3);
border-radius: var(--radius-5);

background: var(--color-surface-raised);
color: var(--color-ink-primary);
border-color: var(--color-line-2);

box-shadow: var(--shadow-2);
transition: opacity var(--motion-duration-2) var(--motion-easing-standard);

/* 实心填充：文字必须用该族的 foreground */
background: var(--color-tone-primary-solid-fill-rest);
color: var(--color-tone-primary-solid-foreground);
```

深色由作用域解析：

```html
<html data-theme="dark">
```

- 颜色读无后缀开关；`-light` / `-dark` 是值位，只有主题切换本身才直接读。
- 长度类是 `rem`，字距是 `em`，光影是 `px`，行高无单位。
- `prefers-reduced-motion: reduce` 下时长与延迟归零，循环不归零；循环由组件显式停。

---

## 出口

| 入口 | 提供 |
|---|---|
| `@ultime/core` | `buildCore` / `buildManifest` / `solveLight` / `planGradient` / 树工具 / 合同 / 版本 |
| `@ultime/core/exporters` | `treeToCss` / `treeToJson` / `treeToDtcg`；只读树 |
| `@ultime/core/tools` | `planProject` / `exportTokens` / `exportArtifacts` / 配置校验 / 语义表模板 |
| `@ultime/core/studio` | 无头配置器定义：字段 / 预设 / 校验 / 预览 / 导出；选择：`selectBuild` / `selectTree`；派生：`deriveTree`；渐变判断：`planGradient` |
| `@ultime/core/seed` | seed 类型 / 默认值 / 深合并 / JSONC / 指纹 |

`planGradient(from, to, { length, bitDepth })` 只做判断：建议插值空间、是否需要中间色标、阶梯纹风险、对比度采样点；经验阈值集中在 `GRADIENT_RULES`，可整体覆盖。它不产 token、不拼 CSS。

产物编排（选出口、定目录、排序）走工具层，不写盘：

```js
import { exportTokens } from '@ultime/core/tools'

const files = exportTokens({
  seed: { color: { primaryHue: 250 } },
  platforms: ['css', 'json'],
  output: 'src/styles/tokens',
})
```

按类别裁剪 CSS：

```js
treeToCss(result, { include: ['color', 'motion'] })
```

---

## CLI

`ultime` 由本包提供（`bin/ultime.js`）；参数 / help / 退出码设施来自 `@ultime/cli`，命令与规则都在 core。

```bash
ultime init             # 写一份 ultime.config.json
ultime build            # 读配置 + seed → tokens.* / kernel.json
ultime build --check    # 只比对，不写盘
ultime inspect          # 只读检查：产物 / 平台 / 类别 / 合同 / 颜色 / 诊断
ultime schema --json    # seed 字段 / 出口 / 语义表
```

配置模型为 `tokens.seed / platforms / output / semantics`。
`semantics` 是可选产物：只有配置了才生成 `semantics.json`，它不进树，也不进 `kernel.json`。

core 只产完整 token 集；选择、裁剪与自定义派生归配置器，不写进 `ultime.config.json`。

仓库内开发也可用 `pnpm ultime`（等价于 `vpx src/cli/index.ts`）。

---

## 产物

| 文件 | 性质 | 说明 |
|---|---|---|
| `tokens.css` | 生成物 | 全量原料：几何 / 排版 / 颜色 / 光影 / 动效；含 reduce 覆盖 |
| `tokens.json` | 生成物 | 树形快照，值与 CSS 同源；模式值输出 `{ light, dark }` |
| `tokens.dtcg.json` | 生成物 | DTCG 2025.10 交换格式；真正嵌套 group，模式值是 `light` / `dark` 两个 token |
| `kernel.json` | 生成物 | manifest：schema / engine 版本、seed 与指纹、计数、合同摘要、颜色报告 |
| `dist/*.js` | 构建物 | 库出口：`.` / `./exporters` / `./tools` / `./studio` / `./seed` |

> 产物随仓库入库，用于 diff 与离线消费；**禁止手改**，改 seed 后重跑构建。
> `pre-commit` 会重算产物并逐字节比对，拦下「新源码带旧产物」的提交。
> `dist/*.js` 默认压缩；注释与设计说明留在源码、本 README 与 `DESIGN.md`，不随产物发布。`dist/*.d.ts` 不压缩。

---

## 目录

```text
packages/core/
├── bin/ultime.js               CLI 薄入口（指向 dist/cli.js）
├── src/
│   ├── cli/                    命令：init / build / inspect / schema + 配置读写
│   ├── seed.ts                seed 类型 / 默认值 / 深合并 / JSONC / 指纹
│   ├── tree.ts                token / group / 模式值 / 遍历 / 合成
│   ├── build.ts               seed → 派生 → 一棵树 → 合同 → manifest
│   ├── contracts.ts           几何 / 动效 / 树结构 / 颜色报告
│   ├── version.ts             schemaVersion / engineVersion
│   ├── model/
│   │   ├── skeleton.ts        space / size / radius / fs / lh / ls / font
│   │   ├── color/             颜色数学 + 中性灰 + 画布 / 面阶 / 墨 / 线 / 色族矩阵
│   │   ├── light.ts           shadow / occlusion / highlight / shade
│   │   └── motion.ts          duration / loop / delay / easing
│   ├── exporters/             CSS / JSON / DTCG（只读树）
│   ├── studio/                配置器定义：字段 / 默认值 / 预设 / 校验 / 预览 / 导出 / 选择模型
│   └── tools/                 构建计划 / 产物编排 / 项目配置 / 语义表模板
├── scripts/
│   ├── build.ts               唯一构建入口（`--check` 只校验）
│   └── check-model.ts         内核守卫（零依赖 / 方向 / 类别隔离 / 无载体语法）
├── tests/                     回归基线
├── theme.example.json         示例 seed（可改输入）
└── tokens.* / kernel.json     ⚠️ 生成物
```

---

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

- 包版本按 semver；`kernel.json` 里的 `schemaVersion` 描述树与合同字段的兼容面，`engineVersion` 描述派生实现。
- 依赖基线：`@ultime/studio` / `@ultime/cli` 发版后，core 下次发版前更新 lockfile 到最新已发布版本并重建测试；已发布版本不追改。
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

- 机器入口是 `kernel.json` 与 `ultime schema --json`；不要让 agent 从 Markdown 里抄数值。
- 完整设计规范（取值理由、对比度与配对判据）不随包分发：安装 [`@ultime/designcraft`](https://www.npmjs.com/package/@ultime/designcraft) skill（`npx skills add ultime-space/skills --skill designcraft`）阅读。
- 包内 AI 入口是 [`llms.txt`](./llms.txt)（路由）与 [`SKILLS.md`](./SKILLS.md)（能力表）；`AGENTS.md` / `rules/` 只在仓库内维护。

---

## 许可

MIT，见 [LICENSE](./LICENSE)。
