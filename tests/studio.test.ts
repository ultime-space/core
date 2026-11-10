import { describe, expect, it } from 'vite-plus/test'
import { deserializeConfig, exportConfig, serializeConfig, validateConfig } from '@ultime/studio'

import { exportThemeArtifacts, themeStudio } from '../src/studio'
import { THEME_DEFAULTS } from '../src/studio/defaults'
import type { SelectionConfig } from '../src/studio/selection'
import type { ThemeStudioConfig } from '../src/studio/types'

describe('studio · core 配置器', () => {
  it('默认配置可导出全部产物', () => {
    const files = exportThemeArtifacts(THEME_DEFAULTS)
    expect(files.map((file) => file.path.split('/').pop())).toEqual(
      expect.arrayContaining(['tokens.css', 'tokens.json', 'tokens.dtcg.json', 'kernel.json']),
    )
    expect(files.find((file) => file.path.endsWith('tokens.css'))!.content).toContain('--color-surface-canvas')
  })

  it('默认配置校验无错误', async () => {
    const diagnostics = (await themeStudio.validate?.(THEME_DEFAULTS, { mode: 'edit' })) ?? []
    expect(diagnostics.filter((item) => item.level === 'error')).toHaveLength(0)
  })

  it('字段覆盖 seed / 出口 / 选择，不再有 subset', () => {
    const groups = new Set(themeStudio.fields.map((field) => field.group))
    expect(groups.has('color')).toBe(true)
    expect(groups.has('skeleton')).toBe(true)
    expect(groups.has('motion')).toBe(true)
    expect(groups.has('output')).toBe(true)
    expect(groups.has('custom')).toBe(true)
    expect(groups.has('subset')).toBe(false)
    expect('subset' in THEME_DEFAULTS.tokens).toBe(false)
    expect(themeStudio.fields.some((field) => field.path === '/tokens/seed/skeleton/fontSize/base')).toBe(true)
    expect(themeStudio.fields.some((field) => field.path === '/selection')).toBe(true)
    expect(themeStudio.fields.some((field) => field.path === '/derivation/light/form')).toBe(true)
  })

  it('预览与导出同源', () => {
    const preview = themeStudio.preview?.(THEME_DEFAULTS)
    const css = exportThemeArtifacts(THEME_DEFAULTS).find((file) => file.path.endsWith('tokens.css'))!.content
    expect(preview?.css).toBe(css)
  })

  it('inspect 给出产物与诊断', () => {
    const inspected = themeStudio.inspect?.(THEME_DEFAULTS) as
      | { artifacts?: unknown[]; diagnostics?: unknown[] }
      | undefined
    expect(inspected?.artifacts).toHaveLength(4)
    expect(Array.isArray(inspected?.diagnostics)).toBe(true)
  })

  it('选择配置导出定制 tokens，不含 kernel', () => {
    const config: ThemeStudioConfig = {
      ...THEME_DEFAULTS,
      selection: { categories: ['skeleton'], steps: { space: [1, 2] } },
    }
    const files = exportThemeArtifacts(config)
    const css = files.find((file) => file.path.endsWith('tokens.css'))!.content

    expect(files.map((file) => file.path.split('/').pop())).toEqual(['tokens.css', 'tokens.json', 'tokens.dtcg.json'])
    expect(css).toContain('--space-1')
    expect(css).not.toContain('--color-surface-canvas')
    expect(themeStudio.preview?.(config)?.css).toBe(css)

    const inspected = themeStudio.inspect?.(config) as
      | { artifacts?: unknown[]; counts?: { total: number }; custom?: boolean }
      | undefined
    expect(inspected?.artifacts).toHaveLength(3)
    expect(inspected?.custom).toBe(true)
    expect(inspected?.counts?.total).toBeGreaterThan(0)
  })

  it('改选择各自派生，产物引用不跨调用复用', () => {
    const color: ThemeStudioConfig = { ...THEME_DEFAULTS, selection: { categories: ['color'] } }
    const motion: ThemeStudioConfig = {
      ...THEME_DEFAULTS,
      selection: { categories: ['motion'] },
      derivation: { light: { form: 'flat' } },
    }
    const first = themeStudio.inspect?.(color) as { manifest?: unknown } | undefined
    const second = themeStudio.inspect?.(motion) as { manifest?: unknown } | undefined

    expect(first?.manifest).toEqual(second?.manifest)
    expect(first?.manifest).not.toBe(second?.manifest)
  })

  it('基线派生共享，返回值被改动也不污染下一次', () => {
    const first = themeStudio.inspect?.(THEME_DEFAULTS) as
      | { manifest?: Record<string, unknown>; diagnostics?: unknown[] }
      | undefined
    if (!first?.manifest) throw new Error('inspect 未返回 manifest')
    first.manifest.seedHash = 'tampered'
    first.diagnostics?.push({ level: 'error', code: 'tampered', message: 'tampered' })

    const second = themeStudio.inspect?.(THEME_DEFAULTS) as
      | { manifest?: { seedHash?: string }; diagnostics?: unknown[] }
      | undefined
    expect(second?.manifest?.seedHash).not.toBe('tampered')
    expect(second?.diagnostics).toEqual(first.diagnostics?.slice(0, -1))
  })

  it('档数为 0 时合同报 error，导出被阻断', async () => {
    const config: ThemeStudioConfig = {
      ...THEME_DEFAULTS,
      tokens: {
        ...THEME_DEFAULTS.tokens,
        seed: {
          ...THEME_DEFAULTS.tokens.seed,
          skeleton: { ...THEME_DEFAULTS.tokens.seed.skeleton!, radius: { base: 4, levels: 0 } },
        },
      },
    }

    const diagnostics = (await themeStudio.validate?.(config, { mode: 'export' })) ?? []
    expect(diagnostics.some((item) => item.level === 'error' && item.code === 'core/contract.radius-derive')).toBe(true)
  })

  it('合法域越界报 error，建议区间只提示', async () => {
    const withSeed = (patch: (seed: NonNullable<ThemeStudioConfig['tokens']['seed']>) => void) => {
      const draft = JSON.parse(JSON.stringify(THEME_DEFAULTS)) as ThemeStudioConfig
      patch(draft.tokens.seed!)
      return draft
    }

    const alpha = withSeed((seed) => {
      seed.light = { ...seed.light, ambientAlpha: 2 }
    })
    const alphaDiagnostics = await validateConfig(themeStudio, alpha)
    expect(alphaDiagnostics.some((item) => item.code === 'field/range' && item.level === 'error')).toBe(true)

    const radius = withSeed((seed) => {
      seed.skeleton = { ...seed.skeleton, radius: { ...seed.skeleton?.radius, base: 80 } }
    })
    const radiusDiagnostics = await validateConfig(themeStudio, radius)
    expect(radiusDiagnostics.some((item) => item.code === 'field/suggested' && item.level === 'warn')).toBe(true)
    expect(radiusDiagnostics.some((item) => item.code === 'field/range')).toBe(false)
  })

  it('非法选择配置在校验时报 error', async () => {
    const config: ThemeStudioConfig = {
      ...THEME_DEFAULTS,
      selection: { categories: ['typo'] } as unknown as SelectionConfig,
    }
    const diagnostics = (await themeStudio.validate?.(config, { mode: 'export' })) ?? []
    expect(diagnostics.some((item) => item.level === 'error')).toBe(true)
  })

  it('运行时导出与序列化接受选择配置', async () => {
    const config: ThemeStudioConfig = {
      ...THEME_DEFAULTS,
      selection: { categories: ['color'], steps: { shadow: [1] } },
      derivation: { light: { form: 'convex' } },
    }

    const outcome = await exportConfig(themeStudio, config)
    expect(outcome.ok).toBe(true)
    expect(outcome.files.map((file) => file.path.split('/').pop())).toEqual([
      'tokens.css',
      'tokens.json',
      'tokens.dtcg.json',
    ])

    const text = serializeConfig(themeStudio, config)
    expect(JSON.parse(text).selection).toEqual(config.selection)
    expect(JSON.parse(text).derivation).toEqual(config.derivation)
    expect(deserializeConfig(themeStudio, text)).toEqual(config)
  })

  it('光影形态派生进入产物与 inspect', () => {
    const config: ThemeStudioConfig = {
      ...THEME_DEFAULTS,
      derivation: { light: { form: 'flat' } },
    }
    const files = exportThemeArtifacts(config)
    const css = files.find((file) => file.path.endsWith('tokens.css'))!.content

    expect(files.some((file) => file.path.endsWith('kernel.json'))).toBe(false)
    expect(css).toContain('--highlight-key-light: none')
    expect(css).toContain('--shade-key-light: none')

    const inspected = themeStudio.inspect?.(config) as
      | { custom?: boolean; diagnostics?: Array<{ code: string }> }
      | undefined
    expect(inspected?.custom).toBe(true)
    expect(inspected?.diagnostics?.some((item) => item.code === 'derivation.light.form')).toBe(true)
  })

  it('编辑中的空平台 / 空目录不抛错，只给诊断', async () => {
    const config = { tokens: { ...THEME_DEFAULTS.tokens, platforms: [] } }
    expect(themeStudio.preview?.(config)?.css).toBe('')
    expect(themeStudio.inspect?.(config)).toEqual({ artifacts: [], diagnostics: [] })
    const diagnostics = (await themeStudio.validate?.(config, { mode: 'edit' })) ?? []
    expect(diagnostics.some((item) => item.level === 'error')).toBe(true)
  })

  it('预览生成失败时返回诊断，不静默丢错', () => {
    const preview = themeStudio.preview?.(null as unknown as ThemeStudioConfig)
    expect(preview?.css).toBe('')
    expect(preview?.diagnostics?.[0]?.code).toBe('core/preview')
  })
})
