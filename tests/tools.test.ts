import { describe, expect, it } from 'vite-plus/test'

import { exportTokens } from '../src/tools'

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

  it('core 只产完整 token 集，不再有 tokens.config.json', () => {
    const files = exportTokens()
    expect(files.some((file) => file.path.endsWith('tokens.config.json'))).toBe(false)
  })

  it('includeManifest: false 时不写 kernel.json', () => {
    const files = exportTokens({ platforms: ['css'], includeManifest: false })
    expect(files.map((file) => file.path)).toEqual(['ultime-tokens/tokens.css'])
  })
})
