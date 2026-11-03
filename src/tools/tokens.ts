/**
 * tokens.ts — token 产物编排（纯函数）
 * ---------------------------------------------------------------------------
 * 选出口 + 定目录 + 排序；值全部来自 `buildCore`，不在出口里二次派生。
 */

import { buildCore, buildManifest } from '../build'
import { treeToCss, treeToDtcg, treeToJson } from '../exporters'
import type { SeedInput } from '../seed'
import { tokensConfigJson, type SubsetConfig } from './tokens-config'
import type { OutputFile } from './types'

export type TokenPlatform = 'css' | 'json' | 'dtcg'

export interface ExportTokensOptions {
  seed?: SeedInput
  /** 项目子集：给了就额外写出 `tokens.config.json` */
  subset?: SubsetConfig
  platforms?: TokenPlatform[]
  output?: string
}

const DEFAULT_DIR = 'ultime-tokens'
const DEFAULT_PLATFORMS: TokenPlatform[] = ['css', 'json', 'dtcg']

export function exportTokens(options: ExportTokensOptions = {}): OutputFile[] {
  const result = buildCore(options.seed ?? {})

  const all: Array<[string, string]> = [
    ['tokens.css', treeToCss(result)],
    ['tokens.json', `${JSON.stringify(treeToJson(result), null, 2)}\n`],
    ['tokens.dtcg.json', `${JSON.stringify(treeToDtcg(result), null, 2)}\n`],
    ['kernel.json', `${JSON.stringify(buildManifest(result), null, 2)}\n`],
  ]

  const platforms = options.platforms ?? DEFAULT_PLATFORMS
  const want = (file: string): boolean => {
    if (file === 'kernel.json') return true
    if (file.endsWith('.dtcg.json')) return platforms.includes('dtcg')
    if (file.endsWith('.json')) return platforms.includes('json')
    return platforms.includes('css')
  }

  const dir = (options.output ?? DEFAULT_DIR).replace(/\/+$/, '')
  const files = all.filter(([file]) => want(file)).map(([file, content]) => ({ path: `${dir}/${file}`, content }))

  if (options.subset) files.push({ path: 'tokens.config.json', content: tokensConfigJson(options.subset) })

  return files
}
