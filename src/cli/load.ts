/**
 * load.ts — 配置 / seed 的统一加载
 * ---------------------------------------------------------------------------
 * build 与 inspect 共用：读配置 → 读 seed → `resolveThemeConfig` → error 过滤。
 * 只做读取与解析，不输出、不写盘；错误以消息数组返回，由命令决定如何呈现。
 */

import { resolveThemeConfig, type ThemeConfig } from '../tools/index.ts'
import { readConfig, readSeedFile, resolveFromConfig } from './config-file.ts'

export type ConfigLoad = { ok: true; config: ThemeConfig } | { ok: false; errors: string[] }

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

export function loadResolvedConfig(configPath: string): ConfigLoad {
  let loaded
  try {
    loaded = readConfig(configPath)
  } catch (error) {
    return { ok: false, errors: [messageOf(error)] }
  }

  if (!loaded.tokens) return { ok: false, errors: ['配置里没有 tokens 区（本版 CLI 只处理 tokens）'] }

  let resolved
  try {
    const raw = loaded.tokens.seed
    const seed = typeof raw === 'string' ? readSeedFile(resolveFromConfig(configPath, raw)) : undefined
    resolved = resolveThemeConfig(loaded, seed === undefined ? {} : { seed })
  } catch (error) {
    return { ok: false, errors: [messageOf(error)] }
  }

  const errors = resolved.diagnostics
    .filter((diagnostic) => diagnostic.level === 'error')
    .map((diagnostic) => `配置：${diagnostic.message}`)
  return errors.length > 0 ? { ok: false, errors } : { ok: true, config: resolved.config }
}
