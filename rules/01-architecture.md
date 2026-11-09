# 01 · 架构与边界

> 定位：core 的职责、依赖方向与目录分工。
> 适用版本：0.7.x
> 关系：规则索引见 [`README`](./README.md)；为什么这样分层见 [`DESIGN.md`](../DESIGN.md)。

---

## 职责

core 是**平台无关的样式数据层**：seed → 一棵 DTCG 形态的树 → 快照。它只给档、生成参数与合同。

| 做 | 不做 |
|---|---|
| 数值、枚举、曲线、alpha 的派生 | 语义表、布局、断点、目标尺寸 |
| 树结构与合同校验 | 组件、class、路由、请求 |
| CSS / JSON / DTCG / manifest 出口 | 品牌、页面策略、交互反馈 |

## 依赖方向

```text
seed / model → build → exporters
        └────→ tools / studio（只读模型）
```

- `src/model/**` 不得 import `build` / `exporters` / `tools` / `studio`。
- `skeleton` / `color` / `light` / `motion` 四个类别**互不 import**。
- 守卫：`scripts/check-model.ts`（零依赖 / 方向单向 / 类别隔离 / 模型值无载体语法）。

**反例**：在 `model/color` 里读 `tools` 的语义表，或在 `model/**` 里写 `var()` / `rem` —— 前者把用法带进值，后者把载体带进模型。

## 目录

| 路径 | 职责 |
|---|---|
| `src/seed.ts` | seed 类型、默认值、深合并、JSONC、指纹 |
| `src/tree.ts` | token / group / 模式值 / 遍历 / 合成 |
| `src/build.ts` | seed → 派生 → 树 → 合同 → manifest 的唯一装配点 |
| `src/contracts.ts` | 几何 / 动效 / 树结构 / 颜色报告 |
| `src/model/**` | 四个类别的派生纯函数 |
| `src/exporters/**` | 只读树，翻译成 CSS / JSON / DTCG |
| `src/tools/**` | 构建计划、产物编排、项目配置、语义表模板 |
| `src/cli/**` | `ultime` 命令与配置读写；通用设施来自 `@ultime/cli` |
| `src/studio/**` | 配置器字段 / 预设 / 校验 / 预览 / 导出定义；选择（类别 / 档位过滤）与参数化派生 |

## 新增内容五问

1. 它是「值 / 参数」还是「用法 / 策略」？值进 core；用法归语义表或组件层。
2. 它依赖平台、输入能力、组件几何吗？依赖就归上层。
3. 它能由参数派生吗？能就不存第二份名单。
4. 它能机检吗？不能就写成指引，不进 core 数据。
5. 它会不会造成同一事实的第二份正文？会就改真源，不加副本。

## 明确不做

- 语义角色（`enter` / `exit` / `press`）、质量带、编排；
- 布局、栅格、断点、目标尺寸；
- 材质轴、渗色、spring、手势；玻璃作为唯一填充角色例外（待实现）；
- 手写阴影名单与运行时角度。
