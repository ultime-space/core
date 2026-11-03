/**
 * config.ts — 项目配置（工具层：引擎）
 * ---------------------------------------------------------------------------
 * 配置只写「选择 + seed 覆盖」，不含派生值：
 *   tokens.seed / subset / platforms / output / semantics
 * 本文件只做纯函数：校验形状、把配置编成产物清单；读盘写盘归 CLI。
 */

import { buildCore } from '../build'
import type { SeedInput } from '../seed'
import { SUBSET_DIMENSIONS, validateSubset, type SubsetConfig } from './tokens-config'
import { exportTokens, type TokenPlatform } from './tokens'
import {
  exportSemantics,
  resolveSemantics,
  SEMANTICS_TEMPLATES,
  validateSemantics,
  type SemanticsConfig,
} from './semantics'
import type { OutputFile } from './types'

export interface TokensConfig {
  /** 内联 seed，或相对配置文件的路径（路径由 CLI 读取后再传入） */
  seed?: SeedInput | string
  subset?: SubsetConfig
  platforms?: TokenPlatform[]
  output?: string
  semantics?: SemanticsConfig
}

export interface UltimeConfig {
  $schema?: string
  tokens?: TokensConfig
}

const TOP_KEYS = new Set(['$schema', 'tokens'])
const TOKEN_KEYS = new Set(['seed', 'subset', 'platforms', 'output', 'semantics'])
const PLATFORMS: ReadonlySet<string> = new Set(['css', 'json', 'dtcg'])

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** 只报形状问题，一次列全；空数组 = 没问题。 */
export function validateConfig(config: UltimeConfig): string[] {
  const issues: string[] = []
  if (!isObject(config)) return ['配置必须是一个对象']

  for (const key of Object.keys(config)) {
    if (!TOP_KEYS.has(key)) issues.push(`未知顶层字段：${key}（可用：tokens）`)
  }

  if (config.tokens !== undefined) {
    if (!isObject(config.tokens)) {
      issues.push('tokens 必须是对象')
      return issues
    }
    const tokens = config.tokens as unknown as Record<string, unknown>

    for (const key of Object.keys(tokens)) {
      if (!TOKEN_KEYS.has(key))
        issues.push(`tokens 未知字段：${key}（可用：seed / subset / platforms / output / semantics）`)
    }

    if (tokens.seed !== undefined && typeof tokens.seed !== 'string' && !isObject(tokens.seed)) {
      issues.push('tokens.seed 必须是对象（内联 seed）或字符串（文件路径）')
    }

    if (tokens.subset !== undefined) {
      if (!isObject(tokens.subset)) issues.push('tokens.subset 必须是对象')
      else {
        const subset = tokens.subset as Record<string, unknown>
        const missing = SUBSET_DIMENSIONS.map((dimension) => dimension.key).filter((key) => !Array.isArray(subset[key]))
        if (missing.length) issues.push(`tokens.subset 缺少维度：${missing.join(' / ')}（9 维必须全给）`)
        for (const [dimension, values] of Object.entries(subset)) {
          if (!Array.isArray(values) || values.some((value) => typeof value !== 'number')) {
            issues.push(`tokens.subset.${dimension} 必须是数字数组`)
          }
        }
        if (!missing.length)
          issues.push(...validateSubset(subset as SubsetConfig).map((issue) => `tokens.subset：${issue}`))
      }
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
  }

  return issues
}

/**
 * 配置 → 产物文件清单（纯函数）。
 * `seed` 参数用于 CLI 读盘后的结果；配置里的 seed 若为路径则必须由调用方解析。
 */
export function exportArtifacts(config: UltimeConfig, seed?: SeedInput): OutputFile[] {
  const tokens = config.tokens
  if (!tokens) return []

  let input = seed
  if (input === undefined) {
    if (typeof tokens.seed === 'string') {
      throw new Error('tokens.seed 是文件路径：请先读取成对象再调用 exportArtifacts（CLI 负责读盘）')
    }
    input = tokens.seed
  }

  const files = exportTokens({
    seed: input,
    subset: tokens.subset,
    platforms: tokens.platforms,
    output: tokens.output,
  })

  if (tokens.semantics) {
    const table = resolveSemantics(tokens.semantics)
    const issues = validateSemantics(table, buildCore(input).tree)
    if (issues.length) throw new Error(`语义表无效：${issues.join('；')}`)
    files.push(...exportSemantics(table, { output: tokens.output }))
  }

  return files
}
