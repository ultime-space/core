# 使用说明

> 定位：`@ultime/core` 的完整用法：统一出口、选择与定制、模型、Web 消费、CLI、产物与目录。
> 适用版本：1.0.x
> 关系：安装与最小示例见 [README](./README.md)；设计取舍见 [`DESIGN.md`](./DESIGN.md)；迁移见 [`MIGRATION.md`](./MIGRATION.md)；机检见 [`CHECKS.md`](./CHECKS.md)。

## 统一出口

同一次导出只派生一次。CLI、studio 与脚本都走 `resolveThemeConfig` / `exportTheme`：

```js
import { exportTheme, resolveThemeConfig } from '@ultime/core/tools'

const { config, diagnostics } = resolveThemeConfig({ tokens: { output: 'styles' } }, { seed })
const { build, artifacts } = exportTheme(config)

build.core         // CoreResult
build.manifest     // kernel.json 的内容
build.artifacts    // 产物清单（path / content / bytes）
build.diagnostics  // error / warn / info
```

`planProject` 是内部引擎执行器；需要更低层控制时可直接调用，但不要另拼产物清单。

### 选择与定制产物

选择与派生是**导出配置**，可选；默认导出与定制导出走同一条路径。`@ultime/core/tools` 提供统一管线：

```js
import { exportTheme, resolveThemeConfig } from '@ultime/core/tools'

const { config, diagnostics } = resolveThemeConfig({
  tokens: { output: 'styles' },
  selection: { categories: ['skeleton', 'color'], steps: { space: [1, 2, 4, 6], radius: [1, 3, 5] } },
  derivation: { light: { form: 'flat' } },
})
const result = exportTheme(config)

result.build         // ProjectBuild：core / manifest / artifacts / diagnostics
result.artifacts     // 定制产物：tokens.css / tokens.json / tokens.dtcg.json（不含 kernel.json）
result.diagnostics   // 未知类别 / 档位、缺失档位、空选择、semantics 提示
result.selected      // 配置了 selection / derivation 时才存在
```

需要更细的控制时，`selectBuild` / `selectTree` / `deriveTree` 仍可从 `@ultime/core/tools`（或 `/studio` re-export）调用。

- 类别：`skeleton` / `color` / `light` / `motion`；省略 = 全部，空数组 = 不启用。
- 档位：`space` / `size` / `radius` / `fontSize` / `lineHeight` / `letterSpacing` / `shadow` / `occlusion` / `motionDuration` / `motionDelay` / `motionLoop`；省略 = 该组全量，空数组 = 去掉该组数字档位。
- 非档位 token（`shadow.color` / `font` / `motion.easing` 等）跟随所属类别保留。
- 自定义派生只调用 core 引擎函数：目前支持 `light.form` 的 `flat` / `convex` / `concave`，按 `solveLight` 重算 `highlight` / `shade`，不写回 seed，也不支持用户 recipe。
- `kernel.json` 描述完整内核，不属于定制产物；`semantics.json` 也不在定制导出里生成。
- `selection` / `derivation` 可选地写在配置根上，CLI 与 studio 都能读；省略 = 全量 / 静态默认。

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
| `@ultime/core` | `buildCore` / `buildManifest` / `bakeLight` / `solveLight` / `planGradient` / 树工具 / 合同 / 版本 |
| `@ultime/core/exporters` | `treeToCss` / `treeToJson` / `treeToDtcg`；只读树 |
| `@ultime/core/tools` | 统一管线 `resolveThemeConfig` / `exportTheme` / `exportThemeArtifacts`；构建计划 `planProject`；产物出口 `exportTokens` / `emitTokens`；选择 / 派生 `selectBuild` / `selectTree` / `deriveTree`；默认值；配置校验；语义表模板 / `exportSemantics` / `semanticsToCss` |
| `@ultime/core/studio` | 无头配置器定义：字段 / 预设 / 校验映射 / 预览 / 导出；选择 / 派生 API 由 tools 提供并 re-export；渐变判断：`planGradient` |
| `@ultime/core/seed` | seed 类型 / 默认值 / 深合并 / JSONC / 指纹 |
| `@ultime/core/checks` | `tokensRule`（规则 ID `core/tokens`）：按 `kernel.json.tiers` 校验字号 / 表面 / 阴影消费；交给 `@ultime/checks` 运行 |
| `@ultime/core/utils` | 连续曲率 / 几何 / 采样：`squirclePath` / `squirclePathData` / `cornerGeometry` / `samplePath` / `pathLength` / `pathBounds` / `pathToString`；纯函数，不进内核树 |

> `@ultime/core/checks` 只导出规则对象，不内置运行器；用法见 [CHECKS.md](./CHECKS.md)。
> `@ultime/core/utils` 只做设计计算；示例：
>
> ```js
> import { squirclePath } from '@ultime/core/utils'
> const d = squirclePath({ width: 375, height: 812, radius: 52, smoothing: 0.6 })
> ```

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

已有 `CoreResult` 时用 `emitTokens`：它不重新派生、不做选择或诊断，只按平台编排产物；传 `includeManifest: false` 可跳过 `kernel.json`，用于配置器的定制导出。

按类别裁剪 CSS：

```js
treeToCss(result, { include: ['color', 'motion'] })
```

---

## CLI

`ultime-core` 由本包提供（`bin/ultime.js`）；参数 / help / 退出码设施来自 `@ultime/cli`，命令与规则都在 core。

```bash
ultime-core init             # 写一份 ultime.config.json
ultime-core build            # 读配置 + seed → tokens.* / kernel.json
ultime-core build --check    # 只比对，不写盘
ultime-core inspect          # 只读检查：产物 / 平台 / 类别 / 合同 / 颜色 / 诊断
ultime-core schema --json    # seed 字段 / 出口 / 语义表
```

配置模型为 `tokens.seed / platforms / output / semantics`，可选 `selection` / `derivation`。
`semantics` 是可选产物：只有配置了才生成 `semantics.json` / `semantics.css`，它不进树，也不进 `kernel.json`。

参数由 `@ultime/cli` 的命令级 schema 校验：未知参数、布尔参数带值与带值参数缺值会以用法错误退出（2）。

CLI、库 API 与 `core/studio` 都走 `tools/pipeline`：默认配置与自定义配置同一条出口。

仓库内开发也可用 `pnpm ultime`（等价于 `vpx src/cli/index.ts`）。

---

## 产物

| 文件 | 性质 | 说明 |
|---|---|---|
| `tokens.css` | 生成物 | 全量原料：几何 / 排版 / 颜色 / 光影 / 动效；含 reduce 覆盖 |
| `tokens.json` | 生成物 | 树形快照，值与 CSS 同源；模式值输出 `{ light, dark }` |
| `tokens.dtcg.json` | 生成物 | DTCG 2025.10 交换格式；真正嵌套 group，模式值是 `light` / `dark` 两个 token |
| `kernel.json` | 生成物 | manifest：schema / engine 版本、seed 与指纹、计数、允许档位 `tiers`、合同摘要、颜色报告 |
| `dist/*.js` | 构建物 | 库出口：`.` / `./exporters` / `./tools` / `./studio` / `./seed` / `./checks` / `./utils` |

> 产物随仓库入库，用于 diff 与离线消费；**禁止手改**，改 seed 后重跑构建。
> `pre-commit` 会重算产物并逐字节比对，拦下「新源码带旧产物」的提交。
> `dist/*.js` 默认压缩；注释与设计说明留在源码、本文件与 `DESIGN.md`，不随产物发布。`dist/*.d.ts` 不压缩。

---

## 目录

```text
packages/core/
├── bin/ultime.js               CLI 薄入口（ultime-core → dist/cli.js）
├── src/
│   ├── cli/                    命令：init / build / inspect / schema + 配置读写
│   ├── seed.ts                seed 类型 / 默认值 / 深合并 / JSONC / 指纹
│   ├── tree.ts                token / group / 模式值 / 遍历 / 合成
│   ├── build.ts               seed → 派生 → 一棵树 → 合同 → manifest
│   ├── contracts.ts           几何 / 动效 / 树结构 / 颜色报告
│   ├── version.ts             schemaVersion
│   ├── model/
│   │   ├── skeleton.ts        space / size / radius / fs / lh / ls / font
│   │   ├── color/             颜色数学 + 中性灰 + 画布 / 面阶 / 墨 / 线 / 色族矩阵
│   │   ├── light.ts           shadow / occlusion / highlight / shade
│   │   └── motion.ts          duration / loop / delay / easing
│   ├── exporters/             CSS / JSON / DTCG（只读树）
│   ├── studio/                配置器定义：字段 / 预设 / 校验映射 / 预览 / 导出编排
│   └── tools/                 统一管线 / 构建计划 / 选择与派生 / 项目配置 / 语义表模板
├── scripts/
│   ├── build.ts               唯一构建入口（`--check` 只校验）
│   └── check-model.ts         内核守卫（零依赖 / 方向 / 类别隔离 / 无载体语法）
├── tests/                     回归基线
├── theme.example.json         示例 seed（可改输入）
└── tokens.* / kernel.json     ⚠️ 生成物
```

---
