import { describe, expect, it } from 'vite-plus/test'

import { buildCore, buildManifest } from '../src/build'
import { classifyContrast } from '../src/model/color/derive'
import { treeToCss, treeToDtcg, treeToJson } from '../src/exporters'
import { DEFAULT_SEED, resolveSeed, seedHash } from '../src/seed'
import { cssValue } from '../src/exporters/css'
import { flatten } from '../src/exporters/css'
import { isToken } from '../src/tree'

const result = buildCore()

describe('core · seed 与派生', () => {
  it('同输入逐字节相同', () => {
    const again = buildCore()
    expect(JSON.stringify(again.tree)).toBe(JSON.stringify(result.tree))
    expect(seedHash(again.seed)).toBe(seedHash(result.seed))
  })

  it('几何族档位与序号一致', () => {
    const space = result.tree.space as Record<string, ReturnType<typeof isToken> extends never ? never : any>
    expect(isToken(space['1'])).toBe(true)
    expect(space['1'].$value).toEqual({ value: 2, unit: 'px' })
    expect(space['18'].$value).toEqual({ value: 160, unit: 'px' })

    const size = result.tree.size as Record<string, any>
    expect(Object.keys(size)).toHaveLength(5)
    expect(size['1'].$value.value).toBe(24)
    expect(size['5'].$value.value).toBe(56)

    const radius = result.tree.radius as Record<string, any>
    expect(Object.keys(radius)).toHaveLength(9)
    expect(radius['1'].$value.value).toBe(0)
    expect(radius['9'].$value.value).toBe(32)
  })

  it('排版 9 / 4 / 5 档', () => {
    expect(Object.keys(result.tree.fs as object)).toHaveLength(9)
    expect(Object.keys(result.tree.lh as object)).toHaveLength(4)
    expect(Object.keys(result.tree.ls as object)).toHaveLength(5)
    expect((result.tree.ls as Record<string, any>)['1'].$value).toEqual({ value: -0.02, unit: 'em' })
  })

  it('字号由 base + steps 派生', () => {
    expect(result.skeleton.primitives.fontSize).toEqual([10, 12, 14, 16, 18, 20, 24, 32, 40])

    const shifted = buildCore({ skeleton: { fontSize: { base: 12 } } })
    expect(shifted.skeleton.primitives.fontSize).toEqual([12, 14, 16, 18, 20, 22, 26, 34, 42])
    expect(shifted.contracts.failed).toBe(0)

    const restyled = buildCore({ skeleton: { fontSize: { steps: [0, 2, 4, 6, 8, 10, 12, 14, 16] } } })
    expect(restyled.skeleton.primitives.fontSize).toEqual([10, 12, 14, 16, 18, 20, 22, 24, 26])
    expect(restyled.contracts.failed).toBe(0)
  })

  it('字号阶梯非法时合同失败', () => {
    const invalid = buildCore({ skeleton: { fontSize: { steps: [0, 2, 4] } } })
    expect(invalid.contracts.rows.find((row) => row.id === 'type-steps')?.pass).toBe(false)
  })

  it('动效四轴按 seed 派生', () => {
    expect(result.motion.duration).toEqual([100, 200, 300, 400, 500, 600])
    expect(result.motion.loop).toEqual([1000, 2000, 4000])
    expect(result.motion.delay).toEqual([50, 100, 200])
    expect(result.motion.easing.standard).toEqual([0.42, 0, 0.58, 1])
    expect(result.motion.easing.decelerate).toEqual([0, 0, 0.58, 1])
    expect(result.motion.easing.accelerate).toEqual([0.42, 0, 1, 1])
  })

  it('自定义档数只改 seed', () => {
    const custom = buildCore({ motion: { duration: { unit: 120, count: 4 } } })
    expect(custom.motion.duration).toEqual([120, 240, 360, 480])
  })
})

describe('core · 颜色与光影', () => {
  it('画布不透明，面阶是半透明模式值', () => {
    const canvas = result.color.tree.surface.canvas
    expect(canvas.light.alpha).toBe(1)
    expect(canvas.dark.alpha).toBe(1)
    expect(canvas.light.hex).toMatch(/^#[0-9A-F]{6}$/)

    const raised = result.color.tree.surface.raised
    expect(raised.light.alpha).toBeLessThan(1)
    expect(raised.dark.alpha).toBeLessThan(1)
  })

  it('墨分四档，线分三档，状态有四项', () => {
    expect(Object.keys(result.color.tree.ink)).toEqual(['primary', 'secondary', 'tertiary', 'disabled'])
    expect(Object.keys(result.color.tree.line)).toEqual(['1', '2', '3'])
    expect(Object.keys(result.color.tree.state)).toEqual(['hover', 'pressed', 'disabled', 'selected'])
  })

  it('色族矩阵按 底 × 用途 × 强度 × 状态 展开', () => {
    const primary = result.color.tree.tone.primary as Record<string, any>
    expect(Object.keys(primary)).toEqual(['solid', 'soft', 'bare'])
    expect(Object.keys(primary.solid.fill)).toHaveLength(8)
    expect(Object.keys(primary.soft.fill)).toHaveLength(8)
    expect(Object.keys(primary.solid.ink)).toEqual(['weak', 'base', 'strong'])
    expect(Object.keys(primary.bare.line)).toEqual(['weak', 'base', 'strong'])
    expect(primary.solid.foreground.light.hex).toBe('#FFFFFF')
    expect(primary.solid.foreground.dark.hex).toBe('#000000')
  })

  it('foreground 方向按模式声明，可单侧启用', () => {
    const flipped = buildCore({ color: { onSide: { light: 'dark', dark: 'light' } } })
    const primary = flipped.color.tree.tone.primary as Record<string, any>
    expect(primary.solid.foreground.light.hex).toBe('#000000')
    expect(primary.solid.foreground.dark.hex).toBe('#FFFFFF')

    const lightOnly = buildCore({ color: { modes: ['light'] } })
    expect(lightOnly.color.report.every((row) => row.mode !== 'dark')).toBe(true)
    expect(lightOnly.contracts.failed).toBe(0)
  })

  it('颜色项只报告、不阻断；端点偏离只 warn', () => {
    const drifted = buildCore({ color: { onColors: { light: '#FFFFFF', dark: '#111113' } } })
    const endpoint = drifted.color.report.find((row) => row.id === 'foreground-endpoint' && row.mode === 'dark')
    expect(endpoint?.level).toBe('warn')
    expect(drifted.contracts.failed).toBe(0)
  })

  it('对比度分级与不可达填充', () => {
    expect(classifyContrast(7, 6, 4.5)).toBe('pass')
    expect(classifyContrast(5, 6, 4.5)).toBe('warn')
    expect(classifyContrast(3, 6, 4.5)).toBe('deviation')

    const unreachable = buildCore({ color: { solidTarget: 22 } })
    expect(
      unreachable.color.report.some((row) => row.id === 'tone-fill-unreachable' && row.level === 'deviation'),
    ).toBe(true)
    expect(unreachable.contracts.failed).toBe(0)
  })

  it('旧 onSide 字符串给出明确迁移错误', () => {
    expect(() => buildCore({ color: { onSide: 'light' as never } })).toThrow('onSide')
  })

  it('阴影 4 档三槽位，level 1 的 inner 是空槽', () => {
    const shadow = result.tree.shadow as Record<string, any>
    expect(shadow['1'].$value).toHaveLength(2)
    expect(shadow['2'].$value).toHaveLength(3)
    expect(shadow['4'].$value).toHaveLength(3)
    expect(shadow.color.$value.hex).toMatch(/^#[0-9A-F]{6}$/)
  })

  it('rim 是独立高光环，occlusion 4 档', () => {
    const rim = result.tree.rim as any
    expect(rim.$type).toBe('shadow')
    expect(rim.$value[0].spread.value).toBe(1)
    expect(Object.keys(result.tree.occlusion as object)).toHaveLength(4)
  })
})

describe('core · 合同与出口', () => {
  it('默认 seed 的合同全部通过', () => {
    const failed = result.contracts.rows.filter((row) => !row.pass)
    expect(failed, JSON.stringify(failed, null, 2)).toHaveLength(0)
  })

  it('manifest 无时间戳且记录 seed 指纹', () => {
    const manifest = buildManifest(result)
    expect(manifest.seedHash).toMatch(/^fnv1a-/)
    expect(JSON.stringify(manifest)).not.toMatch(/20\d\d-\d\d-\d\dT/)
    expect(manifest.counts.total).toBeGreaterThan(0)
  })

  it('CSS 出口：值位 + 开关 + reduce 覆盖', () => {
    const css = treeToCss(result)
    expect(css).toContain('--color-surface-canvas-light:')
    expect(css).toContain('--color-surface-canvas-dark:')
    expect(css).toContain('--color-surface-canvas: var(--color-surface-canvas-light);')
    expect(css).toContain('[data-theme="dark"]')
    expect(css).toContain('--motion-duration-1: 0.01ms;')
    expect(css).toContain('--motion-delay-1: 0s;')
    expect(css).not.toContain('--dur-')
    expect(css).not.toContain('--ease-')
    expect(css).toContain('--motion-easing-standard: cubic-bezier(0.42, 0, 0.58, 1);')
  })

  it('CSS 出口：不含角色节点', () => {
    const css = treeToCss(result)
    expect(css).not.toMatch(/--(enter|exit|press|stagger)-/)
  })

  it('JSON 出口保留树形与模式值', () => {
    const json = treeToJson(result) as any
    expect(json.tokens.space['1']).toBe('0.125rem')
    expect(json.tokens.color.surface.canvas).toEqual({
      light: expect.stringMatching(/^#[0-9A-F]{6}$/),
      dark: expect.stringMatching(/^#[0-9A-F]{6}$/),
    })
  })

  it('DTCG 出口使用嵌套 group，键里不含点', () => {
    const dtcg = treeToDtcg(result) as any
    expect(dtcg.color.surface.canvas.light.$type).toBe('color')
    expect(dtcg.color.surface.canvas.light.$value.colorSpace).toBe('srgb')
    expect(dtcg.motion.duration['1'].$value).toEqual({ value: 100, unit: 'ms' })
    expect(dtcg.space['1'].$value).toEqual({ value: 2, unit: 'px' })
    const dotted = flatten(result.tree).filter(({ path }) => path.some((part) => part.includes('.')))
    expect(dotted).toHaveLength(0)
  })

  it('cssValue 的单位口径固定', () => {
    const flat = flatten(result.tree)
    const find = (path: string) => flat.find((item) => item.path.join('.') === path)!
    expect(cssValue(find('space.6').path, find('space.6').token)).toBe('1rem')
    expect(cssValue(find('shadow.1').path, find('shadow.1').token)).toContain('px')
    expect(cssValue(find('motion.easing.linear').path, find('motion.easing.linear').token)).toBe('linear')
  })

  it('seed 合并允许只写局部字段', () => {
    const seed = resolveSeed({ color: { primaryHue: 300 } })
    expect(seed.color.primaryHue).toBe(300)
    expect(seed.color.solidTarget).toBe(DEFAULT_SEED.color.solidTarget)
    expect(seed.motion.duration.unit).toBe(100)
  })
})
