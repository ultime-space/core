# Changelog

## 0.4.0 - 2026-11-04

- 字号 seed 化：`fontSize = { base, steps }`，默认派生仍是 9 档，产物值不变。
- 颜色按模式配对：`onSide` 按模式声明；`foreground` 改为 `tone.{族}.solid.foreground` 配对槽位；两端同一 L 配方；实心面目标不达标只警告并写入 manifest。
- 工具层与 `core/studio` 定义同步新字段；`kernel.json` 的 `engineVersion` 升到 0.4.0。
- `ultime` bin 收归 core：命令与配置读写移到 `src/cli/`，通用参数 / 退出码设施依赖 `@ultime/cli`。

## 0.2.0

- 首次发布：seed → 一棵 DTCG 树 → 快照；工具层与产物编排重写。
