/**
 * spec.ts — `ultime-core` 命令面
 * ---------------------------------------------------------------------------
 * 只注册命令与参数；通用解析 / 帮助 / 退出码交给 `@ultime/cli`。
 * 本文件不判断配置、不拼产物；命令实现都在 ./commands。
 */

import path from 'node:path'
import type { CliContext, CliSpec, ParsedArgs } from '@ultime/cli'
import { flagBool, flagValue } from '@ultime/cli'
import { runBuild } from './commands/build.ts'
import { runInspect } from './commands/inspect.ts'
import { runInit } from './commands/init.ts'
import { runSchema } from './commands/schema.ts'

export const CORE_USAGE = `ultime-core <command> [options]

命令：
  init                    写一份最小 ultime.config.json（--force 覆盖）
  build                   按配置生成 token 产物
  build --check           只比对不写盘：按当前配置重新生成会不会变
  inspect                 只读检查：产物 / 平台 / 类别 / 合同 / 颜色 / 诊断
  schema                  列出 seed 字段 / 出口 / 语义表（--json 机器可读）

选项：
  --config <path>         配置文件（默认 ./ultime.config.json）
  --cwd <dir>             工作目录（默认当前目录；配置与产物路径相对它）
  --json                  仅 schema / inspect：输出机器可读结果
  --force                 仅 init：覆盖已存在的配置
  -v, --version           打印版本
  -h, --help              显示帮助（配合命令可看单条用法）
`

export const CORE_COMMAND_HELP: Record<string, string> = {
  init: 'ultime-core init [--force] [--config <path>] [--cwd <dir>]',
  build: 'ultime-core build [--check] [--config <path>] [--cwd <dir>]',
  inspect: 'ultime-core inspect [--json] [--config <path>] [--cwd <dir>]',
  schema: 'ultime-core schema [--json]',
}

const COMMON_FLAGS = { config: 'string', cwd: 'string' } as const

function paths(args: ParsedArgs, ctx: CliContext): { configPath: string } {
  const cwd = path.resolve(flagValue(args, 'cwd') ?? ctx.cwd)
  return { configPath: path.resolve(cwd, flagValue(args, 'config') ?? 'ultime.config.json') }
}

export function createCoreSpec(version: string): CliSpec {
  return {
    name: 'ultime-core',
    version,
    usage: CORE_USAGE,
    commands: {
      init: {
        help: CORE_COMMAND_HELP.init,
        flags: { ...COMMON_FLAGS, force: 'boolean' },
        run: (args, ctx) => {
          const { configPath } = paths(args, ctx)
          return runInit(ctx, configPath, flagBool(args, 'force'))
        },
      },
      build: {
        help: CORE_COMMAND_HELP.build,
        flags: { ...COMMON_FLAGS, check: 'boolean' },
        run: (args, ctx) => {
          const { configPath } = paths(args, ctx)
          return runBuild(ctx, { configPath, check: flagBool(args, 'check') })
        },
      },
      inspect: {
        help: CORE_COMMAND_HELP.inspect,
        flags: { ...COMMON_FLAGS },
        run: (args, ctx) => {
          const { configPath } = paths(args, ctx)
          return runInspect(ctx, { configPath, json: flagBool(args, 'json') })
        },
      },
      schema: {
        help: CORE_COMMAND_HELP.schema,
        flags: {},
        run: (args, ctx) => runSchema(ctx, flagBool(args, 'json')),
      },
    },
  }
}
