import { describe, expect, it } from 'vite-plus/test'

import { exportThemeArtifacts, themeStudio } from '../src/studio'
import { THEME_DEFAULTS } from '../src/studio/defaults'

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

  it('字段覆盖 seed / 出口两块，不再有 subset', () => {
    const groups = new Set(themeStudio.fields.map((field) => field.group))
    expect(groups.has('color')).toBe(true)
    expect(groups.has('skeleton')).toBe(true)
    expect(groups.has('motion')).toBe(true)
    expect(groups.has('output')).toBe(true)
    expect(groups.has('subset')).toBe(false)
    expect('subset' in THEME_DEFAULTS.tokens).toBe(false)
    expect(themeStudio.fields.some((field) => field.path === '/tokens/seed/skeleton/fontSize/base')).toBe(true)
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

  it('编辑中的空平台 / 空目录不抛错，只给诊断', async () => {
    const config = { tokens: { ...THEME_DEFAULTS.tokens, platforms: [] } }
    expect(themeStudio.preview?.(config)?.css).toBe('')
    expect(themeStudio.inspect?.(config)).toEqual({ artifacts: [], diagnostics: [] })
    const diagnostics = (await themeStudio.validate?.(config, { mode: 'edit' })) ?? []
    expect(diagnostics.some((item) => item.level === 'error')).toBe(true)
  })
})
