# core/tokens · 机检规则

> 定位：`@ultime/core/checks` 导出的 `tokensRule`，按 `kernel.json.tiers` 校验字号、表面与阴影消费；规则归 core，运行器是 `@ultime/checks`。
> 状态：现行（2026-11-19，core 1.0）。
> 关系：产物与出口见 [README](./README.md)；迁移见 [MIGRATION](./MIGRATION.md)；运行器用法见 [`@ultime/checks`](https://www.npmjs.com/package/@ultime/checks)。

## 一、用法

```js
// checks.config.mjs
import { tokensRule } from '@ultime/core/checks'

export default {
  rules: [
    {
      use: tokensRule,
      options: {
        manifest: 'packages/core/kernel.json',
        scope: ['styles/**'],
      },
    },
  ],
}
```

- 规则对象自带 `id: 'core/tokens'`；`use` 直接放对象，不需要注册字符串。
- 运行器要求 `@ultime/checks` 0.5.0+（支持 `use: Rule`）。
- `errors.code === 'CONFIG'` 的配置错误由运行器映射为 `CONFIG_OPTION`，退出码 `2`。

## 二、选项

| 选项 | 默认 | 说明 |
|---|---|---|
| `manifest` | — | 必填；相对 `workspaceRoot` 的 manifest 路径，通常指向 core 的 `kernel.json` |
| `classes` | `['fs', 'surface', 'shadow']` | 启用的类别；必须是 manifest `tiers` 里导出的键，当前支持 `fs` / `surface` / `shadow` |
| `scope` | 全部 | 相对 `workspaceRoot` 的 glob，只扫描命中的文件 |
| `allow` | `[]` | 字面值白名单；`{ pattern, files?, reason }`，`pattern` 自动锚定完整声明值，`reason` 必填 |

## 三、判据

只扫描 `.css` / `.scss` / `.less`；注释与字符串先遮罩，行号仍对应原文件。

| 属性 | 通过 | 失败 |
|---|---|---|
| `font-size` | `var(--fs-N)`（N 在 `tiers.fs` 内）、`0`、全局关键字 | 裸长度（如 `11px`）；已导出但非 `fs` 的档位（如 `var(--space-6)`）；未登记档位（如 `var(--fs-10)`） |
| `background` / `background-color` | `var(--...)`、`transparent` / `none` / `currentColor` / 全局关键字、`url(...)` | 裸 hex 或颜色函数（如 `#fff`、`rgb(0 0 0)`） |
| `box-shadow` | `none`、全局关键字，或整值只由 `var()` 与逗号组成；`--shadow-*` / `--occlusion-*` 在各自 `tiers` 内 | 任一裸阴影分量；已导出但非光影的档位（如 `var(--space-6)`）；未登记的光影档位 |

变量名由档位路径派生：`fs.4` → `--fs-4`，`shadow.2` → `--shadow-2`。只校验 manifest 里已导出的家族；未导出的变量（如 `--highlight-*` / `--shade-*` 或下游别名）按组合放行，由下游自行测试。`--fs-*` / `--shadow-*` 是保留前缀。

`var()` 的 fallback 不参与字面值判断：`var(--fs-4, 11px)` 只看 `--fs-4`。

## 四、manifest 读取

- `manifest` 不存在、不是合法 JSON、缺少 `tiers`、类别为空、类别未导出：都按配置错误处理，退出码 `2`，不静默跳过。
- 只依赖 `tiers` 的形状，不锁 `schemaVersion` major。
- `tiers` 只列原子档位；`surface` 只覆盖 `canvas` / `float` / `inset` / `raised` 四个面层级，因此背景色只查裸字面值，不校验 `--color-surface-*` 变量名是否在册。
- 不修改 manifest，也不要求 core 为规则新增语义角色。

## 五、边界

- 规则内容归 core；`@ultime/checks` 只负责运行、报告、基线、抑制与退出码。
- 不检查 `font` 简写、行内 `style="..."`、JS / TS 样式对象、`.vue` / `.html` 内的 `<style>` 块。
- SCSS / LESS 变量（`$fs-4` / `@fs-4`）不视为 token 引用；样式包应消费 CSS 变量。
- CSS 具名颜色（`white` / `black` 等）与渐变内部的颜色不在识别范围；只识别 hex 与 `rgb()` / `hsl()` 等颜色函数。
- `calc()` / `clamp()` 里混入的裸长度：只要声明引用了合法档位变量就放行。
