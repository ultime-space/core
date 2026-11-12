import fs from 'node:fs'
import type { CliContext } from '@ultime/cli'
import type { UltimeConfig } from '../../tools/index.ts'
import { writeConfig } from '../config-file.ts'

/** 起步配置：只开 tokens 区；上层配置随各自重写再加。 */
export const STARTER: UltimeConfig = {
  $schema: 'https://ultime.dev/schema/ultime.config.json',
  tokens: {
    output: 'src/styles/tokens',
  },
}

export function runInit(ctx: CliContext, configPath: string, force: boolean): number {
  if (fs.existsSync(configPath) && !force) {
    ctx.err(`✗ 配置已存在：${configPath}（要覆盖加 --force）`)
    return 1
  }
  writeConfig(configPath, STARTER)
  ctx.out(`✓ 已写入 ${configPath}`)
  ctx.out('  下一步：ultime-core build（seed 省略时用 core 默认 seed）')
  return 0
}
