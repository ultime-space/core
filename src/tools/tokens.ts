/**
 * tokens.ts — token 产物编排（纯函数）
 * ---------------------------------------------------------------------------
 * 选出口 + 定目录 + 排序；值全部来自 `buildCore`，不在出口里二次派生。
 * core 只产完整 token 集；裁剪与按需启用归配置器，不在这里做 subset。
 */

import { buildCore, buildManifest, type CoreResult } from '../build'
import { treeToCss, treeToDtcg, treeToJson } from '../exporters'
import type { SeedInput } from '../seed'
import type { OutputFile } from './types'

export type TokenPlatform = 'css' | 'json' | 'dtcg'

export interface ExportTokensOptions {
  seed?: SeedInput
  platforms?: TokenPlatform[]
  output?: string
  /** 默认 true；配置器的选择导出不写 `kernel.json`。 */
  includeManifest?: boolean
  /** 已算好的 manifest；调用方已有结果时避免重复计算。 */
  manifest?: ReturnType<typeof buildManifest>
}

export const DEFAULT_DIR = 'ultime-tokens'
export const DEFAULT_PLATFORMS: TokenPlatform[] = ['css', 'json', 'dtcg']

/** 从已构建的 CoreResult 发射产物；同一构建只调用一次。 */
export function emitTokens(result: CoreResult, options: ExportTokensOptions = {}): OutputFile[] {
  const platforms = options.platforms ?? DEFAULT_PLATFORMS
  const all: Array<[string, string]> = []
  if (platforms.includes('css')) all.push(['tokens.css', treeToCss(result)])
  if (platforms.includes('json')) all.push(['tokens.json', `${JSON.stringify(treeToJson(result), null, 2)}\n`])
  if (platforms.includes('dtcg')) all.push(['tokens.dtcg.json', `${JSON.stringify(treeToDtcg(result), null, 2)}\n`])
  if (options.includeManifest !== false) {
    const manifest = options.manifest ?? buildManifest(result)
    all.push(['kernel.json', `${JSON.stringify(manifest, null, 2)}\n`])
  }

  const dir = (options.output ?? DEFAULT_DIR).replace(/\/+$/, '')
  return all.map(([file, content]) => ({ path: `${dir}/${file}`, content }))
}

/** 便捷入口：直接给 seed，内部构建一次。构建计划应使用 `planProject`。 */
export function exportTokens(options: ExportTokensOptions = {}): OutputFile[] {
  return emitTokens(buildCore(options.seed ?? {}), options)
}
