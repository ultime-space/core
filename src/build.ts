/**
 * build.ts — 内核唯一构建入口（纯函数）
 * ---------------------------------------------------------------------------
 * seed → 五类派生 → 一棵树 → 合同 → manifest。
 * 构建、配置器、CLI 共用这一份；产物的值不在这里二次加工。
 */

import { deriveColor, type ColorResult } from './model/color/derive'
import { deriveLight, type LightResult, type LightSolveInput, type LightSolveResult } from './model/light'
import { deriveMotion, type MotionResult } from './model/motion'
import { deriveSkeleton, type SkeletonResult } from './model/skeleton'
import { resolveSeed, seedHash, type CoreSeed, type SeedInput } from './seed'
import { auditContracts, countByCategory, type ContractReport } from './contracts'
import { isModeValue, token, type ColorValue, type Group, type ModeValue, type Node } from './tree'
import { ENGINE_VERSION, SCHEMA_VERSION } from './version'

export interface CoreResult {
  seed: CoreSeed
  tree: Group
  skeleton: SkeletonResult
  color: ColorResult
  light: LightResult
  motion: MotionResult
  contracts: ContractReport
  counts: { total: number; byCategory: Record<string, number> }
}

/** 光色是 hex；省略光色 = 白光。阴影墨的彩度封顶在颜色模型里处理。 */
const resolveLightColor = (value: string | null): string => value ?? '#FFFFFF'

/** 把「颜色值 / 模式值 / 嵌套对象」转成 token 树。 */
function colorNodes(value: unknown): Node {
  if (!value || typeof value !== 'object') throw new Error(`颜色树节点不是对象：${JSON.stringify(value)}`)
  if ('colorSpace' in value) return token('color', value as ColorValue)
  if (isModeValue(value)) return token('color', value as ModeValue<ColorValue>)
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, colorNodes(child)]),
  )
}

/** 光影求解所需的上下文：颜色只提供一枚阴影墨，光色在装配点解析。 */
function prepareLight(seed: CoreSeed): { color: ColorResult; light: LightResult } {
  const color = deriveColor(seed.color, seed.light.ambientColor)
  const light = deriveLight(seed.light, color.shadowInk, {
    key: resolveLightColor(seed.light.lightColor),
    ambient: resolveLightColor(seed.light.ambientColor),
  })
  return { color, light }
}

/** 独立求解入口：给上层在构建期按形态 / 深度 / 模式取五槽值。 */
export function solveLight(input: LightSolveInput = {}, seedInput: SeedInput = {}): LightSolveResult {
  const seed = resolveSeed(seedInput)
  return prepareLight(seed).light.solve(input)
}

export function buildCore(input: SeedInput = {}): CoreResult {
  const seed = resolveSeed(input)
  const skeleton = deriveSkeleton(seed.skeleton)
  const { color, light } = prepareLight(seed)
  const motion = deriveMotion(seed.motion)

  const tree: Group = {
    ...skeleton.tree,
    color: {
      surface: colorNodes(color.tree.surface),
      ink: colorNodes(color.tree.ink),
      line: colorNodes(color.tree.line),
      tone: colorNodes(color.tree.tone),
      state: colorNodes(color.tree.state),
      scrim: token('color', color.tree.scrim, '遮罩：半透明背景色，单值、不随模式'),
    },
    shadow: light.tree.shadow,
    occlusion: light.tree.occlusion,
    highlight: light.tree.highlight,
    shade: light.tree.shade,
    motion: motion.tree,
  }

  const contracts = auditContracts({ seed, tree, skeleton, color, light, motion })
  const byCategory = countByCategory(tree)
  const total = Object.values(byCategory).reduce((sum, n) => sum + n, 0)

  return {
    seed,
    tree,
    skeleton,
    color,
    light,
    motion,
    contracts,
    counts: { total, byCategory },
  }
}

/** manifest：可复现记录 + 计数 + 合同摘要；不含时间戳。 */
export function buildManifest(result: CoreResult) {
  return {
    name: '@ultime/core',
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    unit: {
      scale: 'logical',
      definition: '1 逻辑像素 = 1 iOS pt = 1 Android dp = 1 CSS px@1x',
      stored: 'dimension / duration / number；CSS 出口把可缩放长度转 rem',
    },
    themeModes: ['light', 'dark'],
    seed: result.seed,
    seedHash: seedHash(result.seed),
    motion: {
      easingSource: result.motion.easingSource,
      easing: result.motion.easing,
    },
    counts: result.counts,
    contracts: {
      total: result.contracts.total,
      failed: result.contracts.failed,
      ids: result.contracts.ids,
    },
    color: {
      levels: result.color.report.reduce<Record<string, number>>((acc, item) => {
        acc[item.level] = (acc[item.level] ?? 0) + 1
        return acc
      }, {}),
      report: result.color.report,
    },
    artifacts: ['tokens.css', 'tokens.json', 'tokens.dtcg.json', 'kernel.json'],
  }
}
