import { describe, expect, it } from 'vite-plus/test'

import * as build from '../src/build'

const bakeLight = (build as unknown as { bakeLight?: (input?: unknown) => any }).bakeLight

describe('core 1.0 · 单角度光影', () => {
  it('bakeLight 以 light.angle 烘焙，不同角度产生不同高光', () => {
    expect(typeof bakeLight).toBe('function')
    const at0 = bakeLight!({ light: { angle: 0 } })
    const at90 = bakeLight!({ light: { angle: 90 } })
    expect(at0.tree.highlight).not.toEqual(at90.tree.highlight)
  })

  it('bakeLight 同输入确定', () => {
    const first = bakeLight!({ light: { angle: 45 } })
    const second = bakeLight!({ light: { angle: 45 } })
    expect(JSON.stringify(first.tree)).toBe(JSON.stringify(second.tree))
  })

  it('角度归一：0 与 360 结果一致', () => {
    const at0 = bakeLight!({ light: { angle: 0 } })
    const at360 = bakeLight!({ light: { angle: 360 } })
    expect(at0.tree.highlight).toEqual(at360.tree.highlight)
  })

  it('旧双角度输入在 1.0 报错', () => {
    expect(() => build.buildCore({ light: { azimuthAngle: 30 } } as any)).toThrow(/angle/i)
  })
})
