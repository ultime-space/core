# 迁移指南（0.11.x → 1.0）

> 定位：从 0.11.x 升级到 1.0 的破坏性变更与操作清单；1.0 不提供 0.x 桥接版。
> 适用版本：`@ultime/core` 1.0.x
> 关系：变更摘要见 [CHANGELOG](./CHANGELOG.md)，架构与出口见 [README](./README.md)，机检规则见 [CHECKS](./CHECKS.md)（运行器为 [`@ultime/checks`](https://www.npmjs.com/package/@ultime/checks)）。

## 一、升级前确认

- 0.11.x 可以继续使用；升级到 1.0 是一次性替换，不保留双轨命名或双轨入口。
- 先确认谁在读 core 的产物：`kernel.json`、`tokens.css` / `tokens.json` / `tokens.dtcg.json`、语义表、seed JSON。
- 记录当前 `schemaVersion`、`seedHash` 与合同摘要；升级后用新产物对比差异。

## 二、破坏性变更

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

## 三、操作清单

1. 更新 `@ultime/core` 到 `1.0.x`，重新安装并更新 lockfile。
2. 改 seed：`faceContrast.overlay` → `float`，`alpha.*.overlay` → `float`；`light.azimuthAngle` / `altitudeAngle` → `light.angle`；`canvasSymmetry` 数字 → `{ light, dark }`（两端同值就写两遍）。
3. 全局搜索并替换：`surface.overlay`、`surface-overlay`、`--color-surface-overlay`、`engineVersion`、`azimuthAngle`、`altitudeAngle`。
4. 重跑构建，更新 `tokens.css` / `tokens.json` / `tokens.dtcg.json` / `kernel.json` / 语义表；不要手改产物。
5. 消费 `kernel.json` 时：按 `schemaVersion: "7.0.0"` 读取，删除 `engineVersion` 分支，按需读 `tiers`。
6. 消费语义表时：改为读取 `semantics.css` / `semantics.json`；语义角色映射到新的原料名。
7. 跑下游的 `check` / `test`；需要机检 token 消费时，用 `@ultime/core/checks` 的 `tokensRule` + `@ultime/checks` 0.5.0+ 运行器。

## 四、不做什么

- 不提供 0.x 桥接版，不保留旧名 / 旧入口双轨。
- 不在 1.0 同时维护两份默认值或两份档位名单。
- 不回填旧 `kernel.json`；需要旧结果就留在 0.11.2。

## 五、回退

1.0 是破坏性升级。回退需要恢复 0.11.x 的依赖、lockfile 与产物，并按旧 seed 重建；`kernel.json` 的 `schemaVersion` 会回到 6.0.0。
