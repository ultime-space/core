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
}

export const DEFAULT_DIR = 'ultime-tokens'
export const DEFAULT_PLATFORMS: TokenPlatform[] = ['css', 'json', 'dtcg']

const want = (file: string, platforms: TokenPlatform[]): boolean => {
  if (file === 'kernel.json') return true
  if (file.endsWith('.dtcg.json')) return platforms.includes('dtcg')
  if (file.endsWith('.json')) return platforms.includes('json')
  return platforms.includes('css')
}

/** 从已构建的 CoreResult 发射产物；同一构建只调用一次。 */
export function emitTokens(result: CoreResult, options: ExportTokensOptions = {}): OutputFile[] {
  const all: Array<[string, string]> = [
    ['tokens.css', treeToCss(result)],
    ['tokens.json', `${JSON.stringify(treeToJson(result), null, 2)}\n`],
    ['tokens.dtcg.json', `${JSON.stringify(treeToDtcg(result), null, 2)}\n`],
    ['kernel.json', `${JSON.stringify(buildManifest(result), null, 2)}\n`],
  ]

  const platforms = options.platforms ?? DEFAULT_PLATFORMS
  const dir = (options.output ?? DEFAULT_DIR).replace(/\/+$/, '')
  return all.filter(([file]) => want(file, platforms)).map(([file, content]) => ({ path: `${dir}/${file}`, content }))
}

/** 便捷入口：直接给 seed，内部构建一次。构建计划应使用 `planProject`。 */
export function exportTokens(options: ExportTokensOptions = {}): OutputFile[] {
  return emitTokens(buildCore(options.seed ?? {}), options)
}
