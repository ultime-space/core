/**
 * derivation.ts — 配置器自定义派生（无头）
 * ---------------------------------------------------------------------------
 * 只调用 core 的引擎函数，支持参数化、可复现的派生；不支持用户 recipe。
 * 派生结果只落在返回的树里，不写回 seed，也不改变 `build.core.tree`。
 */

import type { LightForm } from '../model/light'
import { mode, type Group, type ModeValue, type ShadowLayerValue, type Token } from '../tree'
import type { BuildDiagnostic, ProjectBuild } from './project'

export interface DerivationConfig {
  light?: {
    /** 静态 tokens 默认 `convex`；`flat` / `concave` 在这里按 `solveLight` 重算。 */
    form?: LightForm
  }
}

export interface DerivedTree {
  tree: Group
  diagnostics: BuildDiagnostic[]
}

const FORMS = new Set<string>(['flat', 'convex', 'concave'])

const invalid = (message: string): BuildDiagnostic => ({
  level: 'error',
  code: 'derivation.invalid',
  message,
  path: '/derivation',
})

/** 按参数化引擎函数派生树；目前只支持光影形态，其余值保持原样。 */
export function deriveTree(build: ProjectBuild, derivation: DerivationConfig = {}): DerivedTree {
  if (derivation === null || typeof derivation !== 'object' || Array.isArray(derivation)) {
    return { tree: build.core.tree, diagnostics: [invalid('derivation 必须是对象')] }
  }

  const light = derivation.light
  if (light === undefined) return { tree: build.core.tree, diagnostics: [] }
  if (light === null || typeof light !== 'object' || Array.isArray(light)) {
    return { tree: build.core.tree, diagnostics: [invalid('derivation.light 必须是对象')] }
  }

  const form = light.form
  if (form === undefined || form === 'convex') return { tree: build.core.tree, diagnostics: [] }
  if (!FORMS.has(form)) {
    return {
      tree: build.core.tree,
      diagnostics: [
        {
          ...invalid(`未知的光影形态：${String(form)}（可用：flat / convex / concave）`),
          path: '/derivation/light/form',
        },
      ],
    }
  }

  const highlight = build.core.tree.highlight as Group
  const shade = build.core.tree.shade as Group
  const highlightKey = highlight.key as Token<ModeValue<ShadowLayerValue[]>>
  const highlightAmbient = highlight.ambient as Token<ShadowLayerValue[]>
  const shadeKey = shade.key as Token<ModeValue<ShadowLayerValue[]>>

  const lightSide = build.core.light.solve({ form, mode: 'light' })
  const darkSide = build.core.light.solve({ form, mode: 'dark' })

  const tree: Group = {
    ...build.core.tree,
    highlight: {
      key: { ...highlightKey, $value: mode(lightSide.highlight.key, darkSide.highlight.key) },
      ambient: { ...highlightAmbient, $value: lightSide.highlight.ambient },
    },
    shade: {
      key: { ...shadeKey, $value: mode(lightSide.shade.key, darkSide.shade.key) },
    },
  }

  return {
    tree,
    diagnostics: [
      {
        level: 'info',
        code: 'derivation.light.form',
        message: `按 ${form} 形态重算 highlight / shade`,
        path: '/derivation/light/form',
      },
    ],
  }
}
