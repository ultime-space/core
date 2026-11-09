# Changelog

## 0.7.0 - 2026-11-09

- 新增 `@ultime/core/studio` 无头选择 API：`selectBuild` / `selectTree`，按类别与档位从完整树导出定制 tokens。
- 新增 `deriveTree`：参数化引擎函数（目前支持 `light.form`），按 `solveLight` 重算 `highlight` / `shade`；不支持用户 recipe。
- `ThemeStudioConfig` 增加可选 `selection` / `derivation`；`validate` / `inspect` / `preview` / `export` 接入，定制导出不含 `kernel.json`，改选择不重新派生 core。
- 选择导出不生成 `kernel.json`；`emitTokens` 新增 `includeManifest` 选项（默认 `true`）。
- 选择 / 派生只过滤或重算 `ProjectBuild` 的结果，不重新派生；未知类别 / 档位、缺失档位、空选择给 `error` 诊断，`semantics` 不参与选择导出并给 `warn`。
- `engineVersion` 升到 0.7.0；`schemaVersion` 保持 6.0.0（树与合同未变）。

## 0.6.0 - 2026-11-09

- **Breaking**：core 只产完整 token 集，删除 `tokens.subset`、`SUBSET_DIMENSIONS` / `SUBSET_DEFAULTS` / `validateSubset`、`tokens.config.json`；选择与裁剪归配置器。
- **Breaking**：`kernel.json` 删除 `themeModes`（读 `seed.color.modes`）与 `artifacts`（产物清单由 `ProjectBuild.artifacts` 提供）。
- 新增 `planProject` / `ProjectBuild`：一次派生返回 `core` / `manifest` / `artifacts` / `diagnostics`；CLI、studio、`scripts/build.ts` 共用。
- 新增 `ultime inspect`：只读渲染 `ProjectBuild` 的产物、平台、类别、合同、颜色与诊断。
- `exportArtifacts` / `exportTokens` 保留为兼容入口，内部走同一次构建；`tokenPaths` / `validateSemantics` 不再隐式构建默认 seed。
- `engineVersion` 升到 0.6.0；`schemaVersion` 保持 6.0.0（树与合同未变）。

## 0.5.1 - 2026-11-07

- README 补 `solveLight` 示例、光影五槽与 seed 光色说明；无派生 / 契约变化，`engineVersion` 保持 0.5.0。

## 0.5.0 - 2026-11-07

- 光影契约刷新：五槽 `highlight.key` / `highlight.ambient` / `shade.key` / `shadow` / `occlusion`；`rim` → `highlight.ambient`，`bevel.highlight/shade` → `highlight.key` / `shade.key`，删除 `bevel.raised/sunken`。
- seed：`lightTint` / `ambientTint` → `lightColor` / `ambientColor`（hex），`rimAlpha` → `ambientAlpha`，`bevel` → `key`。
- 新增 `solveLight({ form, depth, mode })`；静态 tokens 只表达 `convex`，`flat` / `concave` 在构建期求解。
- 单墨：`shadow` / `occlusion` / `scrim` / `shade.key` 共用 `shadowInk`；状态叠墨 alpha 由目标反解。
- `schemaVersion` 升到 6.0.0，`engineVersion` 升到 0.5.0。

## 0.4.2 - 2026-11-04

- 仓库自带 `pnpm-lock.yaml` 并声明 `packageManager`，CI 用 `--frozen-lockfile`。
- `prepare` 只在 git 仓库内启用钩子；从 git 或目录安装的消费者不会因缺 devDependencies 失败。

## 0.4.1 - 2026-11-04

- 依赖改为已发布版本（`@ultime/cli@^0.1.0` / `@ultime/studio@^0.1.0`），独立 clone 可直接安装。
- 包内补齐格式化与 lint 配置，`pnpm check` 不再依赖元仓根配置。

## 0.4.0 - 2026-11-04

- 字号 seed 化：`fontSize = { base, steps }`，默认派生仍是 9 档，产物值不变。
- 颜色按模式配对：`onSide` 按模式声明；`foreground` 改为 `tone.{族}.solid.foreground` 配对槽位；两端同一 L 配方；实心面目标不达标只警告并写入 manifest。
- 工具层与 `core/studio` 定义同步新字段；`kernel.json` 的 `engineVersion` 升到 0.4.0。
- `ultime` bin 收归 core：命令与配置读写移到 `src/cli/`，通用参数 / 退出码设施依赖 `@ultime/cli`。

## 0.2.0

- 首次发布：seed → 一棵 DTCG 树 → 快照；工具层与产物编排重写。
