# 03 · 测试与验收

> 定位：改 core 时跑什么、看什么、什么算通过。
> 适用版本：0.4.x
> 关系：管线见 [`02-tokens`](./02-tokens.md)；发布检查见 [`04-release`](./04-release.md)。

---

## 命令

```bash
pnpm check       # 格式 / lint / 守卫 / 产物同源
pnpm test        # Vitest：内核 / 工具层 / studio 定义
pnpm typecheck   # tsc --noEmit
```

`pnpm check` 必须全绿；没跑或没跑通，交付时说明是哪一条、为什么。

## 覆盖范围

| 测试 | 保护什么 |
|---|---|
| `tests/core.test.ts` | seed → 树 → 合同 → 产物；同输入同输出 |
| `tests/tools.test.ts` | 工具层：子集 / 配置 / 语义表 / 导出编排 |
| `tests/tools-config.test.ts` | 项目配置校验与错误语义 |
| `tests/studio.test.ts` | 配置器定义：字段 / 默认值 / 校验 / 导出 |
| `tests/cli.test.ts` | CLI 冒烟：init / build / build --check / schema |

- 新增 token 或派生规则，必须同时补：合同（能机检的部分）+ 回归断言。
- 改颜色目标或配对规则，必须在测试里体现目标，不写「与上版一致」这类无信息断言。
- 产物差异是验收的一部分：`build --check` 通过只证明同源，不证明变化正确；变化要看 diff。

## 守卫

`scripts/check-model.ts` 机械拦截四类问题：

1. `model/**` 引入第三方运行时依赖；
2. 反向依赖（`model` import 上层）；
3. 类别之间互相 import；
4. 模型值里出现 `px` / `rem` / `var()` / `color-mix` 等载体语法。

守卫失败时不改守卫来放行；先判断是代码放错层，还是规则需要正式变更。

## 反例

- 只跑 `pnpm build` 不跑 `check`：产物更新了，但合同与守卫可能已失效。
- 用快照测试替代合同：快照只能证明「没变」，不能证明「对」。
