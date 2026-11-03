import { describe, expect, it } from 'vite-plus/test'

import { exportThemeArtifacts, themeStudio } from '../src/studio'
import { THEME_DEFAULTS } from '../src/studio/defaults'
import { validateSubset } from '../src/tools'

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

  it('字段覆盖 seed / 子集 / 出口三块', () => {
    const groups = new Set(themeStudio.fields.map((field) => field.group))
    expect(groups.has('color')).toBe(true)
    expect(groups.has('skeleton')).toBe(true)
    expect(groups.has('motion')).toBe(true)
    expect(groups.has('subset')).toBe(true)
    expect(groups.has('output')).toBe(true)
    expect(themeStudio.fields.some((field) => field.path === '/tokens/seed/skeleton/fontSize/base')).toBe(true)
  })

  it('越界子集被校验拦住', () => {
    const issues = validateSubset({ space: [3, 4] })
    expect(issues.join(' ')).toContain('3')
  })

  it('预览与导出同源', () => {
    const preview = themeStudio.preview?.(THEME_DEFAULTS)
    const css = exportThemeArtifacts(THEME_DEFAULTS).find((file) => file.path.endsWith('tokens.css'))!.content
    expect(preview?.css).toBe(css)
  })
})
