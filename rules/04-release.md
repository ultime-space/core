# 04 · 版本与发布

> 定位：core 的三类版本、发布顺序与发布前检查。
> 适用版本：0.9.x
> 关系：测试见 [`03-testing`](./03-testing.md)；发布由仓库 owner 按本清单执行。

---

## 三类版本

| 版本 | 位置 | 管什么 |
|---|---|---|
| 包版本 | `package.json` | semver，对外安装与兼容判断 |
| `schemaVersion` | `src/version.ts` → `kernel.json` | 树与合同字段的兼容面 |
| `engineVersion` | `src/version.ts` → `kernel.json` | 派生实现版本 |

- 0.x 阶段 minor 可含破坏性变更；破坏性变更写进 README「版本与兼容」。
- 改轴 / 命名 / 值形态 = 契约变更，一次改完：模型、合同、产物、README、AI 文档同批。
- 下游兼容以 `kernel.json` 为准，不以包版本的直觉判断。

## 发布顺序

`@ultime/cli` → `@ultime/studio` → `@ultime/core`。被依赖者先发；依赖写已发布版本范围（如 `^0.1.2`），不写 `workspace:*`。

## 发布前检查

- [ ] `pnpm check` 与 `pnpm test` 全绿
- [ ] `pnpm build` 后 `git diff` 产物符合预期
- [ ] `npm pack --dry-run` 内容正确（`dist` 在、测试与临时文件与 `src` 不在）
- [ ] `exports.types` 指向 `dist/*.d.ts`，安装后类型解析不依赖源码
- [ ] `package.json` 版本、tag、`CHANGELOG.md` 三者一致
- [ ] README「版本与兼容」已更新（契约变更时）
- [ ] AI 文档同步：`rules/` / `llms.txt` / `SKILLS.md` / `AGENTS.md` 的版本戳与能力表已更新
- [ ] 包内配套设施：`npm pack --dry-run` 含 `llms.txt` / `SKILLS.md`，且与 `exports` 对齐
- [ ] 根仓 `pnpm ai-docs:check` 通过

## 反例

- 只升 `package.json`，忘了 `engineVersion`：manifest 记录的派生版本与代码不符。
- 发版后才补 `SKILLS.md`：安装到的包与 AI 读到的能力表不是同一版本。
