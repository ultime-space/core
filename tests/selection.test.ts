import { describe, expect, it } from 'vite-plus/test'

import { planProject, type UltimeConfig } from '../src/tools'
import { selectBuild, selectTree, type SelectionConfig } from '../src/tools/selection'
import type { Group } from '../src/tree'

const project = (tokens: UltimeConfig['tokens'] = {}) => planProject({ tokens: { output: 'styles', ...tokens } })

const basenames = (files: Array<{ path: string }>) => files.map((file) => file.path.split('/').pop())

describe('studio · 选择模型', () => {
  it('省略 selection 时保留完整树，产物不含 kernel.json', () => {
    const build = project()
    const selected = selectBuild(build)

    expect(selected.tree).toEqual(build.core.tree)
    expect(selected.counts).toEqual(build.core.counts)
    expect(basenames(selected.artifacts)).toEqual(['tokens.css', 'tokens.json', 'tokens.dtcg.json'])
    expect(selected.diagnostics.filter((item) => item.level === 'error')).toHaveLength(0)
  })

  it('按类别选择：只保留 color', () => {
    const build = project()
    const selected = selectBuild(build, { categories: ['color'] })

    expect(Object.keys(selected.tree)).toEqual(['color'])
    expect(selected.counts.byCategory).toEqual({ color: build.core.counts.byCategory.color })

    const css = selected.artifacts.find((file) => file.path.endsWith('tokens.css'))!.content
    expect(css).toContain('--color-surface-canvas')
    expect(css).not.toContain('--space-1')
  })

  it('按档位裁剪，保留非档位 token', () => {
    const selected = selectBuild(project(), {
      categories: ['skeleton', 'light'],
      steps: { space: [1, 2, 4], radius: [1, 3], shadow: [1, 3] },
    })

    expect(Object.keys(selected.tree.space as Group)).toEqual(['1', '2', '4'])
    expect(Object.keys(selected.tree.radius as Group)).toEqual(['1', '3'])
    expect(Object.keys(selected.tree.shadow as Group)).toEqual(['1', '3', 'color'])
    expect(selected.tree.font).toBeDefined()
    expect(selected.tree.highlight).toBeDefined()

    const css = selected.artifacts.find((file) => file.path.endsWith('tokens.css'))!.content
    expect(css).toContain('--space-1:')
    expect(css).not.toContain('--space-3:')
  })

  it('动效按轴裁剪，easing 保留', () => {
    const selected = selectBuild(project(), {
      categories: ['motion'],
      steps: { motionDuration: [1], motionDelay: [], motionLoop: [2] },
    })
    const motion = selected.tree.motion as Group

    expect(Object.keys(motion)).toEqual(['duration', 'loop', 'delay', 'easing'])
    expect(Object.keys(motion.duration as Group)).toEqual(['1'])
    expect(Object.keys(motion.loop as Group)).toEqual(['2'])
    expect(Object.keys(motion.delay as Group)).toEqual([])
    expect(Object.keys(motion.easing as Group)).toEqual(['standard', 'decelerate', 'accelerate', 'linear'])
  })

  it('沿用 ProjectBuild 的出口与目录', () => {
    const selected = selectBuild(project({ platforms: ['css'], output: 'custom' }), { categories: ['color'] })

    expect(selected.artifacts.map((file) => file.path)).toEqual(['custom/tokens.css'])
  })

  it('selectTree 是纯过滤，不依赖 ProjectBuild', () => {
    const build = project()
    const tree = selectTree(build.core.tree, { categories: ['motion'], steps: { motionDuration: [2] } })

    expect(Object.keys(tree)).toEqual(['motion'])
    expect(Object.keys((tree.motion as Group).duration as Group)).toEqual(['2'])
  })

  it('未知类别 / 未知档位 / 缺失档位报 error', () => {
    const selection = {
      categories: ['color', 'typo'],
      steps: { bogus: [1], radius: [99] },
    } as unknown as SelectionConfig
    const selected = selectBuild(project(), selection)
    const codes = selected.diagnostics.map((item) => item.code)

    expect(codes).toContain('selection.category.unknown')
    expect(codes).toContain('selection.step.unknown')
    expect(codes).toContain('selection.step.missing')
    expect(selected.diagnostics.filter((item) => item.level === 'error')).toHaveLength(3)
  })

  it('档位必须是正整数', () => {
    const selected = selectBuild(project(), { steps: { space: [0, 1.5] } } as unknown as SelectionConfig)

    expect(selected.diagnostics.some((item) => item.code === 'selection.step.invalid')).toBe(true)
  })

  it('空选择报 error，树为空', () => {
    const selected = selectBuild(project(), { categories: [] })

    expect(selected.tree).toEqual({})
    expect(selected.counts.total).toBe(0)
    expect(selected.artifacts).toEqual([])
    expect(selected.diagnostics.some((item) => item.code === 'selection.empty')).toBe(true)
  })

  it('semantics 不参与选择导出，只给 warn', () => {
    const selected = selectBuild(project({ semantics: { template: 'default' } }))
    const invalid = selectBuild(project({ semantics: { overrides: { 'gap.x': 'space.999' } } }))

    expect(selected.artifacts.some((file) => file.path.endsWith('semantics.json'))).toBe(false)
    expect(selected.diagnostics.some((item) => item.code === 'selection.semantics' && item.level === 'warn')).toBe(true)
    expect(selected.diagnostics.some((item) => item.code.startsWith('semantics.'))).toBe(false)
    expect(invalid.diagnostics.some((item) => item.code === 'semantics.invalid')).toBe(false)
    expect(invalid.diagnostics.some((item) => item.code === 'selection.semantics')).toBe(true)
  })

  it('同输入逐字节相同', () => {
    const selection: SelectionConfig = {
      categories: ['skeleton', 'color', 'motion'],
      steps: { space: [2, 4, 8], fontSize: [1, 4, 7], motionDuration: [1, 3] },
    }
    const first = selectBuild(project(), selection)
    const second = selectBuild(project(), selection)

    expect(first.artifacts).toEqual(second.artifacts)
  })
})
