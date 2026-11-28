# 迁移指南

> 定位：跨版本的破坏性变更与操作清单，按版本倒序；1.0 起不提供旧版桥接。
> 适用版本：`@ultime/core` 2.0.x
> 关系：变更摘要见 [CHANGELOG](./CHANGELOG.md)，架构与出口见 [README](./README.md)，机检规则见 [CHECKS](./CHECKS.md)（运行器为 [`@ultime/checks`](https://www.npmjs.com/package/@ultime/checks)）。

## 一、1.0.x → 2.0：深浅模式与语义色收敛

**机制变化**

- CSS 出口由 `-light` / `-dark` 值位 + `[data-theme="dark"]` 重指块，改为 `light-dark(浅, 深)` + `color-scheme`；根 `color-scheme: light dark` 跟随系统，显式选择写 `data-color-mode`，不重指 token。
- 深色写法从 `<html data-theme="dark">` 改为 `<html data-color-mode="dark">`；auto 状态不写属性。
- 组件不写模式选择器；局部反色声明 `color-scheme: dark`，内部仍消费同一套 token。
- JS 读 `--color-*` 得到 `light-dark(...)` 原文；canvas / 图表 / 导出这类需要具体值的场景须自行解析。
- 非 Web 出口按平台能力映射为双值变量；不支持 `light-dark()` 的目标要么提高基线，要么整个 Web 出口退回值位，不做双份声明兜底。
- 默认 seed 不再产出 `info` 语义色族：`--color-tone-info-*` 共 34 个 token 与对应的 12 条对比度合同消失，语义色只剩 danger / warning / success 三族。语义色族本身是开放扩展，需要 info 的项目自行声明。

**操作清单**

1. 更新 `@ultime/core` 到 `2.0.x`，重新安装并更新 lockfile。
2. 全局搜索 `--color-*-light` / `--color-*-dark`（含 `highlight-key` / `shade-key`）的读取点：改为读无后缀变量。
3. 全局搜索 `data-theme="dark"`：改为 `data-color-mode="dark"`；需要「跟随系统」时不写属性。
4. 需要具体色值的脚本（canvas、图表、导出、内联 SVG）：自己解析 `light-dark(浅, 深)`，不假定 `getPropertyValue` 返回颜色。
5. 局部反色容器（深色卡片 / hero / 设计稿 stage）：声明 `color-scheme`，不要重指 token。
6. 处理 info：需要保留就在 seed 的 `color.semantics` 里加回 `"info": 210` 并重建；不需要则清理 `--color-tone-info-*` 的引用点，信息类提示改用 `primary` 或自定义语义族。
7. 重跑构建更新 `tokens.css` 等产物；跑下游 `check` / `test`，确认没有残留值位读取与 info 引用。

## 二、0.11.x → 1.0

### 2.1 升级前确认

- 0.11.x 可以继续使用；升级到 1.0 是一次性替换，不保留双轨命名或双轨入口。
- 先确认谁在读 core 的产物：`kernel.json`、`tokens.css` / `tokens.json` / `tokens.dtcg.json`、语义表、seed JSON。
- 记录当前 `schemaVersion`、`seedHash` 与合同摘要；升级后用新产物对比差异。

### 2.2 破坏性变更

| 0.11.x | 1.0 | 处理 |
|---|---|---|
| `kernel.json.engineVersion` | 删除 | 派生实现由 `@ultime/core` 包版本表达；删除读取、日志与 UI 展示 |
| `surface.overlay` 原料 / `color.surface.overlay` | `surface.float` / `color.surface.float` | seed、CSS 变量、`kernel.json` 引用全部改名；语义角色 `overlay` 保留并映射到 `color.surface.float` |
| seed `faceContrast.overlay` / `alpha.*.overlay` | `faceContrast.float` / `alpha.*.float` | 旧键在 1.0 构建时报错，按新键重写 seed |
| `light.azimuthAngle` + `light.altitudeAngle` | `light.angle`（单角度） | 只保留一个角度；旧双角度键在构建时报错 |
| `canvasSymmetry` 数字 | `{ light, dark }` 一对 | 配置器改为浅 / 深两个滑块；旧数字写 `{ "light": n, "dark": n }` |
| `schemaVersion` 6.0.0 | 7.0.0 | 结构破坏；按 7.0.0 的字段读取 |
| 无 `tiers` | `kernel.json.tiers` | 需要机检时读 `tiers`；不要手写第二份档位名单 |
| 语义表只出 JSON | `semantics.css` + `semantics.json` | 默认同时产出；CSS 只引用原料变量 |

### 2.3 操作清单

1. 更新 `@ultime/core` 到 `1.0.x`，重新安装并更新 lockfile。
2. 改 seed：`faceContrast.overlay` → `float`，`alpha.*.overlay` → `float`；`light.azimuthAngle` / `altitudeAngle` → `light.angle`；`canvasSymmetry` 数字 → `{ light, dark }`（两端同值就写两遍）。
3. 全局搜索并替换：`surface.overlay`、`surface-overlay`、`--color-surface-overlay`、`engineVersion`、`azimuthAngle`、`altitudeAngle`。
4. 重跑构建，更新 `tokens.css` / `tokens.json` / `tokens.dtcg.json` / `kernel.json` / 语义表；不要手改产物。
5. 消费 `kernel.json` 时：按 `schemaVersion: "7.0.0"` 读取，删除 `engineVersion` 分支，按需读 `tiers`。
6. 消费语义表时：改为读取 `semantics.css` / `semantics.json`；语义角色映射到新的原料名。
7. 跑下游的 `check` / `test`；需要机检 token 消费时，用 `@ultime/core/checks` 的 `tokensRule` + `@ultime/checks` 0.5.0+ 运行器。

### 2.4 不做什么

- 不提供 0.x 桥接版，不保留旧名 / 旧入口双轨。
- 不在 1.0 同时维护两份默认值或两份档位名单。
- 不回填旧 `kernel.json`；需要旧结果就留在 0.11.2。

### 2.5 回退

1.0 是破坏性升级。回退需要恢复 0.11.x 的依赖、lockfile 与产物，并按旧 seed 重建；`kernel.json` 的 `schemaVersion` 会回到 6.0.0。
