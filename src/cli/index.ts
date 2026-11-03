#!/usr/bin/env node
/**
 * core/cli/index.ts — `ultime` 入口（属于 core）
 * ---------------------------------------------------------------------------
 * 通用参数 / 帮助 / 退出码由 `@ultime/cli` 提供；这里只注册 core 的命令。
 * 规则与产物内容都在 core 的 tools / studio；本文件不判断配置、不拼产物。
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { processContext, runCli } from '@ultime/cli'
import { readJsonc, type SeedInput } from '../seed.ts'
import { runBuild } from './commands/build.ts'
import { runInit } from './commands/init.ts'
import { runSchema } from './commands/schema.ts'

const require = createRequire(import.meta.url)
const { version } = require('@ultime/core/package.json') as { version: string }

const USAGE = `ultime <command> [options]

命令：
  init                    写一份最小 ultime.config.json（--force 覆盖）
  build                   按配置生成 token 产物
  build --check           只比对不写盘：按当前配置重新生成会不会变
  schema                  列出 seed 字段 / 子集维度 / 语义表（--json 机器可读）

选项：
  --config <path>         配置文件（默认 ./ultime.config.json）
  --cwd <dir>             工作目录（默认当前目录；配置与产物路径相对它）
  --json                  仅 schema：输出机器可读结果
  --force                 仅 init：覆盖已存在的配置
  -v, --version           打印版本
  -h, --help              显示帮助（配合命令可看单条用法）
`

const COMMAND_HELP: Record<string, string> = {
  init: 'ultime init [--force] [--config <path>]',
  build: 'ultime build [--check] [--config <path>] [--cwd <dir>]',
  schema: 'ultime schema [--json]',
}

/** 省略 seed 时用 core 的示例 seed：与 core 产物同源。 */
function defaultSeed(): SeedInput {
  const file = require.resolve('@ultime/core/theme.example.json')
  return readJsonc(fs.readFileSync(file, 'utf8')) as SeedInput
}

process.exitCode = runCli(
  {
    name: 'ultime',
    version,
    usage: USAGE,
    commands: {
      init: {
        help: COMMAND_HELP.init,
        run: (args, ctx) => {
          const cwd = typeof args.flags.cwd === 'string' ? path.resolve(args.flags.cwd) : ctx.cwd
          const configPath = path.resolve(
            cwd,
            typeof args.flags.config === 'string' ? args.flags.config : 'ultime.config.json',
          )
          return runInit(ctx, configPath, Boolean(args.flags.force))
        },
      },
      build: {
        help: COMMAND_HELP.build,
        run: (args, ctx) => {
          const cwd = typeof args.flags.cwd === 'string' ? path.resolve(args.flags.cwd) : ctx.cwd
          const configPath = path.resolve(
            cwd,
            typeof args.flags.config === 'string' ? args.flags.config : 'ultime.config.json',
          )
          return runBuild(ctx, { defaultSeed }, { configPath, check: Boolean(args.flags.check) })
        },
      },
      schema: {
        help: COMMAND_HELP.schema,
        run: (args, ctx) => runSchema(ctx, Boolean(args.flags.json)),
      },
    },
  },
  process.argv.slice(2),
  processContext(),
)
