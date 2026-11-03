import { describe, expect, it } from 'vite-plus/test'

import { exportTokens, SUBSET_DEFAULTS, tokensConfigJson, validateSubset } from '../src/tools'

describe('tools · token 产物编排', () => {
  it('默认导出四份产物', () => {
    const files = exportTokens()
    expect(files.map((file) => file.path)).toEqual([
      'ultime-tokens/tokens.css',
      'ultime-tokens/tokens.json',
      'ultime-tokens/tokens.dtcg.json',
      'ultime-tokens/kernel.json',
    ])
  })

  it('按平台裁剪，kernel 始终保留', () => {
    const files = exportTokens({ platforms: ['css'] })
    expect(files.map((file) => file.path)).toEqual(['ultime-tokens/tokens.css', 'ultime-tokens/kernel.json'])
  })

  it('带子集时额外写出 tokens.config.json', () => {
    const files = exportTokens({ subset: SUBSET_DEFAULTS })
    expect(files.some((file) => file.path === 'tokens.config.json')).toBe(true)
    const config = files.find((file) => file.path === 'tokens.config.json')!.content
    expect(config).toContain('"space"')
  })

  it('子集必须来自原语集', () => {
    expect(validateSubset(SUBSET_DEFAULTS)).toEqual([])
    expect(validateSubset({ fontSize: [11] }).join(' ')).toContain('11')
  })

  it('子集声明带 seed，可复现', () => {
    const config = JSON.parse(tokensConfigJson()) as { seed: { motion: { duration: { unit: number } } } }
    expect(config.seed.motion.duration.unit).toBe(100)
  })
})
