import { describe, expect, it } from 'vite-plus/test'

import { buildCore } from '../src/build'
import { DEFAULT_SEMANTICS } from '../src/tools/semantics'

describe('core 1.0 · 面层级命名', () => {
  it('原料使用 surface.float，不再有 surface.overlay', () => {
    const surface = (buildCore().tree.color as any).surface as any
    expect(surface.float).toBeDefined()
    expect(surface.overlay).toBeUndefined()
    expect(surface.root).toBeUndefined()
  })

  it('语义角色 overlay 映射到 color.surface.float', () => {
    expect(DEFAULT_SEMANTICS.surface.overlay).toBe('color.surface.float')
  })

  it('旧面阶 seed 键在 1.0 报错', () => {
    expect(() => buildCore({ color: { surface: { faceContrast: { overlay: 1.14 } } } } as any)).toThrow(/float/)
    expect(() => buildCore({ color: { surface: { alpha: { light: { overlay: 0.84 } } } } } as any)).toThrow(/float/)
  })
})
