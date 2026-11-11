import { describe, expect, it } from 'vite-plus/test'

import { GRADIENT_RULES, planGradient } from '../src/model/color/gradient'

describe('core · 渐变规划', () => {
  it('同色没有渐变，判为无层次', () => {
    const plan = planGradient({ from: '#3355AA', to: '#3355AA' })
    expect(plan.flat).toBe(true)
    expect(plan.pixelsPerStep).toBeNull()
    expect(plan.bandingRisk).toBe('low')
    expect(plan.space).toBe('srgb')
  })

  it('色相差异足够大时不算无层次', () => {
    const plan = planGradient({
      from: '#0000FF',
      to: '#FFFF00',
      rules: { flatTone: 100, flatChroma: 1 },
    })
    expect(plan.hueDistance).toBeGreaterThanOrEqual(GRADIENT_RULES.flatHue)
    expect(plan.flat).toBe(false)
  })

  it('对立色相走感知空间，并要求沿整段采样', () => {
    const plan = planGradient({ from: '#0000FF', to: '#FFFF00' })
    expect(plan.hueDistance).toBeGreaterThanOrEqual(GRADIENT_RULES.opposedHue)
    expect(plan.midChromaRatio).toBeLessThan(GRADIENT_RULES.midChromaFloor)
    expect(plan.space).toBe('oklch')
    expect(plan.contrastSampling).toBe('sample')
    expect(plan.notes.some((note) => note.includes('感知空间'))).toBe(true)
  })

  it('同色相浅深走默认插值，只验两端', () => {
    const plan = planGradient({ from: '#DCEBFF', to: '#1E3A8A' })
    expect(plan.space).toBe('srgb')
    expect(plan.contrastSampling).toBe('endpoints')
    expect(plan.needsMidStop).toBe(false)
  })

  it('过渡越长、色差越小，台阶越容易被看见', () => {
    const near = { from: '#707070', to: '#909090' }
    const long = planGradient({ ...near, length: 320 })
    const short = planGradient({ ...near, length: 40 })
    expect(long.pixelsPerStep).toBeGreaterThan(short.pixelsPerStep ?? 0)
    expect(long.bandingRisk).toBe('high')
    expect(short.bandingRisk).toBe('low')
    expect(long.notes.some((note) => note.includes('台阶'))).toBe(true)
  })

  it('高位深降低台阶风险', () => {
    const same = { from: '#707070', to: '#909090', length: 320 }
    const eight = planGradient({ ...same, bitDepth: 8 })
    const ten = planGradient({ ...same, bitDepth: 10 })
    expect(ten.pixelsPerStep).toBeLessThan(eight.pixelsPerStep ?? 0)
    expect(ten.bandingRisk).not.toBe('high')
  })

  it('经验阈值可整体覆盖', () => {
    const custom = planGradient({
      from: '#0000FF',
      to: '#FFFF00',
      rules: { opposedHue: 200 },
    })
    expect(custom.space).toBe('srgb')
  })

  it('诊断文本不带载体语法', () => {
    const plans = [
      planGradient({ from: '#0000FF', to: '#FFFF00' }),
      planGradient({ from: '#808080', to: '#8A8A8A', length: 320 }),
    ]
    for (const plan of plans) {
      for (const note of plan.notes) {
        expect(note).not.toMatch(/var\(|--|color-mix/)
      }
    }
  })

  it('同输入结果稳定', () => {
    const input = { from: '#123456', to: '#ABCDEF', length: 200 }
    expect(JSON.stringify(planGradient(input))).toBe(JSON.stringify(planGradient(input)))
  })
})
