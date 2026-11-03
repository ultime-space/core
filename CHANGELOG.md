# Changelog

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
