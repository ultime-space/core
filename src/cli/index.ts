#!/usr/bin/env node
/**
 * core/cli/index.ts — `ultime-core` 入口（属于 core）
 * ---------------------------------------------------------------------------
 * 命令面在 ./spec.ts；通用参数 / 帮助 / 退出码由 `@ultime/cli` 提供。
 * 本文件只负责取版本并启动，不判断配置、不拼产物。
 */

import { createRequire } from 'node:module'
import { processContext, runCli } from '@ultime/cli'
import { createCoreSpec } from './spec.ts'

const require = createRequire(import.meta.url)
const { version } = require('@ultime/core/package.json') as { version: string }

process.exitCode = await runCli(createCoreSpec(version), process.argv.slice(2), processContext())
