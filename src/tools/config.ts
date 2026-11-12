/**
 * config.ts — 项目配置（工具层：形状校验）
 * ---------------------------------------------------------------------------
 * 配置只写「选择 + seed 覆盖」，不含派生值：
 *   tokens.seed / platforms / output / semantics
 * 本文件只做纯函数形状校验；产物编排在 project.ts，读盘写盘归 CLI。
 */

import type { SeedInput } from '../seed'
import { SEMANTICS_TEMPLATES, type SemanticsConfig } from './semantics'
import type { TokenPlatform } from './tokens'

export interface TokensConfig {
  /** 内联 seed，或相对配置文件的路径（路径由 CLI 读取后再传入） */
  seed?: SeedInput | string
  platforms?: TokenPlatform[]
  output?: string
  semantics?: SemanticsConfig
}

export interface UltimeConfig {
  $schema?: string
  tokens?: TokensConfig
  /** 可选：选择要启用的类别 / 档位；形状由 selection 归一化校验 */
  selection?: Record<string, unknown>
  /** 可选：参数化引擎函数的派生参数；形状由 derivation 归一化校验 */
  derivation?: Record<string, unknown>
}

const TOP_KEYS = new Set(['$schema', 'tokens', 'selection', 'derivation'])
const TOKEN_KEYS = new Set(['seed', 'platforms', 'output', 'semantics'])
const PLATFORMS: ReadonlySet<string> = new Set(['css', 'json', 'dtcg'])

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** 只报形状问题，一次列全；空数组 = 没问题。 */
export function validateConfig(config: UltimeConfig): string[] {
  const issues: string[] = []
  if (!isObject(config)) return ['配置必须是一个对象']

  for (const key of Object.keys(config)) {
    if (!TOP_KEYS.has(key)) issues.push(`未知顶层字段：${key}（可用：tokens / selection / derivation）`)
  }

  if (config.selection !== undefined && !isObject(config.selection)) {
    issues.push('selection 必须是对象')
  }
  if (config.derivation !== undefined && !isObject(config.derivation)) {
    issues.push('derivation 必须是对象')
  }

  if (config.tokens === undefined) return issues
  if (!isObject(config.tokens)) return [...issues, 'tokens 必须是对象']

  const tokens = config.tokens as unknown as Record<string, unknown>

  for (const key of Object.keys(tokens)) {
    if (!TOKEN_KEYS.has(key)) issues.push(`tokens 未知字段：${key}（可用：seed / platforms / output / semantics）`)
  }

  if (tokens.seed !== undefined && typeof tokens.seed !== 'string' && !isObject(tokens.seed)) {
    issues.push('tokens.seed 必须是对象（内联 seed）或字符串（文件路径）')
  }

  if (tokens.platforms !== undefined) {
    if (!Array.isArray(tokens.platforms) || !tokens.platforms.length) {
      issues.push('tokens.platforms 必须是非空数组')
    } else {
      for (const platform of tokens.platforms) {
        if (!PLATFORMS.has(String(platform))) {
          issues.push(`tokens.platforms 含未知出口：${String(platform)}（可用：css / json / dtcg）`)
        }
      }
    }
  }

  if (tokens.output !== undefined && (typeof tokens.output !== 'string' || !tokens.output.trim())) {
    issues.push('tokens.output 必须是非空字符串（目录）')
  }

  if (tokens.semantics !== undefined) {
    if (!isObject(tokens.semantics)) issues.push('tokens.semantics 必须是对象')
    else {
      const semantics = tokens.semantics as Record<string, unknown>
      for (const key of Object.keys(semantics)) {
        if (key !== 'template' && key !== 'overrides') {
          issues.push(`tokens.semantics 未知字段：${key}（可用：template / overrides）`)
        }
      }
      if (semantics.template !== undefined) {
        if (typeof semantics.template !== 'string') issues.push('tokens.semantics.template 必须是字符串')
        else if (!SEMANTICS_TEMPLATES[semantics.template]) {
          issues.push(`tokens.semantics.template 未知模板：${semantics.template}`)
        }
      }
      if (semantics.overrides !== undefined) {
        if (!isObject(semantics.overrides)) issues.push('tokens.semantics.overrides 必须是对象')
        else {
          for (const [key, value] of Object.entries(semantics.overrides)) {
            const valid =
              typeof value === 'string' || (Array.isArray(value) && value.every((item) => typeof item === 'string'))
            if (!valid) issues.push(`tokens.semantics.overrides.${key} 必须是字符串或字符串数组`)
            if (key.split('.').length !== 2) issues.push(`tokens.semantics.overrides.${key} 必须是 role.slot 形式`)
          }
        }
      }
    }
  }

  return issues
}
