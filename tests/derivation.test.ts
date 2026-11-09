import { describe, expect, it } from 'vite-plus/test'

import { planProject } from '../src/tools'
import { deriveTree, selectBuild } from '../src/studio'
import type { Group, ModeValue, ShadowLayerValue, Token } from '../src/tree'

const project = () => planProject({ tokens: { output: 'styles' } })

const shadowValue = (tree: Group, group: string, key: string): ModeValue<ShadowLayerValue[]> =>
  ((tree[group] as Group)[key] as Token<ModeValue<ShadowLayerValue[]>>).$value

describe('studio · 自定义派生', () => {
  it('convex 保持静态树不变', () => {
    const build = project()
    const derived = deriveTree(build, { light: { form: 'convex' } })

    expect(derived.tree).toBe(build.core.tree)
    expect(derived.diagnostics).toEqual([])
  })

  it('flat 清空 highlight / shade', () => {
    const derived = deriveTree(project(), { light: { form: 'flat' } })

    expect(shadowValue(derived.tree, 'highlight', 'key')).toEqual({ light: [], dark: [] })
    expect(shadowValue(derived.tree, 'shade', 'key')).toEqual({ light: [], dark: [] })
    expect(((derived.tree.highlight as Group).ambient as Token).$value).toEqual([])
    expect(derived.diagnostics.some((item) => item.code === 'derivation.light.form')).toBe(true)
  })

  it('concave 可复现且区别于静态树', () => {
    const build = project()
    const first = deriveTree(build, { light: { form: 'concave' } })
    const second = deriveTree(build, { light: { form: 'concave' } })

    expect(first.tree).toEqual(second.tree)
    expect(first.tree).not.toEqual(build.core.tree)
    expect(first.diagnostics.some((item) => item.code === 'derivation.light.form')).toBe(true)
  })

  it('未知形态报 error，保留原树', () => {
    const build = project()
    const derived = deriveTree(build, { light: { form: 'typo' as never } })

    expect(derived.tree).toBe(build.core.tree)
    expect(derived.diagnostics.some((item) => item.code === 'derivation.invalid')).toBe(true)
  })

  it('非法形状报 error', () => {
    const build = project()
    const derived = deriveTree(build, [] as never)

    expect(derived.tree).toBe(build.core.tree)
    expect(derived.diagnostics.some((item) => item.code === 'derivation.invalid')).toBe(true)
  })

  it('selectBuild 同时应用派生与选择', () => {
    const selected = selectBuild(project(), { categories: ['light'] }, { light: { form: 'flat' } })

    expect(Object.keys(selected.tree)).toEqual(['shadow', 'occlusion', 'highlight', 'shade'])
    expect(shadowValue(selected.tree, 'highlight', 'key')).toEqual({ light: [], dark: [] })
    expect(selected.derivation.light?.form).toBe('flat')
    expect(selected.diagnostics.some((item) => item.code === 'derivation.light.form')).toBe(true)
  })
})
