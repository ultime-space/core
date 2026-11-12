# @ultime/core · 可调用能力

> 定位：AI 可调用的入口、产物与错误语义。字段清单以 `ultime-core schema --json` 为准，本文件不手抄。
> 适用版本：0.9.x
> 同步基线：0.9.x（手写；导出面或 schema 变化时同批更新）

---

## 库入口

| 入口 | 提供 | 形态 |
|---|---|---|
| `@ultime/core` | `buildCore` / `buildManifest` / `solveLight` / `planGradient` / 树工具 / 合同 / 版本 | 编译 JS，零第三方依赖 |
| `@ultime/core/exporters` | `treeToCss` / `treeToJson` / `treeToDtcg` | 只读树 |
| `@ultime/core/tools` | 统一管线：`resolveThemeConfig` / `exportTheme` / `exportThemeArtifacts`；构建计划 `planProject`；选择 / 派生 `selectBuild` / `selectTree` / `deriveTree`；默认值 `THEME_DEFAULTS`；配置校验 / 语义表模板 | 无文件 IO |
| `@ultime/core/studio` | 无头配置器定义：字段 / 预设 / 校验 / 预览 / 导出；选择：`selectBuild` / `selectTree`；派生：`deriveTree`；渐变判断：`planGradient` | 依赖 `@ultime/studio` |
| `@ultime/core/seed` | seed 类型 / 默认值 / 深合并 / JSONC / 指纹 | 纯函数 |

## 统一出口

`resolveThemeConfig(input)` 合并默认值并返回 `{ config, diagnostics }`；`exportTheme(config)` 一次派生，返回 `{ build, selected?, artifacts, diagnostics }`。
CLI、库 API 与 `core/studio` 都走这条路径；`planProject` 只作为引擎执行器，调用方不再直接调它。默认配置与自定义配置没有分支。

## 渐变规划

`planGradient({ from, to, length?, bitDepth?, rules? })` 给两端色，返回判断而不是样式：建议插值空间（`srgb` / `oklch`）、是否需要中间色标、阶梯纹风险（`low` / `medium` / `high`）、对比度采样方式（端点或整段），以及可直接展示的 `notes`。

- 判据：色相距离决定中段是否穿过低彩度中心；端点色差与过渡长度决定台阶可见度。
- 阈值是经验起点，集中在 `GRADIENT_RULES`；用 `rules` 整体覆盖，不要在各处散落数字。
- 不产 token、不拼 CSS；具体渐变声明由消费侧按返回建议拼装。

## 选择与派生

`selectBuild(build, selection, derivation)` 在已有 `ProjectBuild` 上过滤类别 / 档位并应用参数化派生，产出定制 tokens；不重新派生，产物不含 `kernel.json`。
`selectTree(tree, selection)` 是纯过滤入口；`deriveTree(build, derivation)` 是纯派生入口。

- 类别：`skeleton` / `color` / `light` / `motion`；档位枚举与用法见 [`README`](./README.md) §选择与定制产物。
- 派生只调用 core 引擎函数：目前支持 `light.form`（`flat` / `convex` / `concave`），按 `solveLight` 重算 `highlight` / `shade`，不支持用户 recipe。
- 未知类别 / 档位、缺失档位、空选择 → `error` 诊断；配置了 `semantics` → `warn`，选择导出不生成 `semantics.json`。
- 配置器把 `selection` / `derivation` 放在配置根上，可序列化保存；CLI、库 API 与 studio 都能读。

## CLI

| 命令 | 输入 | 输出 | 退出码 |
|---|---|---|---|
| `ultime-core init` | 可选 `--force` | `ultime.config.json` | 0 / 1 |
| `ultime-core build` | 配置 + seed | `tokens.*` + `kernel.json` | 0 / 1 |
| `ultime-core build --check` | 同上 | 只比对，不写盘 | 0（一致）/ 1（不一致） |
| `ultime-core inspect` | 可选 `--json` | 产物 / 平台 / 类别 / 合同 / 颜色 / 诊断 | 0 / 1 |
| `ultime-core schema` | 可选 `--json` | seed 字段 / 出口 / 语义表 | 0 / 1 |

通用选项：`--config <path>`、`--cwd <dir>`、`-h / --help`。

## 配置形状

```jsonc
{
  "tokens": {
    "seed": "./design/seed.json",
    "platforms": ["css", "json", "dtcg"],
    "output": "src/styles/tokens",
    "semantics": { "template": "default" }
  },
  "selection": { "categories": ["skeleton"], "steps": { "space": [1, 2] } },
  "derivation": { "light": { "form": "flat" } }
}
```

`selection` / `derivation` 可选；省略即全量导出（含 `kernel.json`）。

字段全集与取值范围不在此维护：跑 `ultime-core schema --json`。

## 产物

| 文件 | 何时出现 |
|---|---|
| `tokens.css` / `tokens.json` / `tokens.dtcg.json` | 由 `platforms` 决定 |
| `kernel.json` | 恒出 |
| `semantics.json` | 配置了 `semantics` |

## 错误语义

- 配置字段未知、类型错误、平台未知：`validateConfig` 报错，CLI 退出 1；
- 语义表无效、阻断合同失败：`planProject` 给出 `error` 诊断，`build` 退出 1；
- 非阻断合同 / 颜色 `warn` / `deviation`：诊断输出但不阻断；
- 产物与源不一致：`build --check` 退出 1，不写盘。

## 反例

- 从 Markdown 抄 seed 字段：字段会随版本变，必须用 `ultime-core schema --json`。
- 把 `kernel.json` 的时间戳当版本依据：manifest 不含时间戳，版本看 `schemaVersion` / `engineVersion`。
- 给 core 配置加 `subset`：选择走 `selection`，不要另造裁剪字段。
