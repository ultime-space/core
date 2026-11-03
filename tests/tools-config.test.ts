import { describe, expect, it } from 'vite-plus/test'

import {
  DEFAULT_SEMANTICS,
  SUBSET_DEFAULTS,
  exportArtifacts,
  resolveSemantics,
  validateConfig,
  validateSemantics,
} from '../src/tools'

describe('tools · 项目配置', () => {
  it('空配置合法，且不产生产物', () => {
    expect(validateConfig({})).toEqual([])
    expect(exportArtifacts({})).toEqual([])
  })

  it('未知字段报错，不静默忽略', () => {
    expect(validateConfig({ token: {} } as never).join(' ')).toContain('未知顶层字段')
    expect(validateConfig({ tokens: { seedd: {} } } as never).join(' ')).toContain('tokens 未知字段')
  })

  it('seed 只接受对象或路径', () => {
    expect(validateConfig({ tokens: { seed: 42 } } as never).join(' ')).toContain('tokens.seed')
    expect(validateConfig({ tokens: { seed: './seed.json' } })).toEqual([])
    expect(validateConfig({ tokens: { seed: { color: { primaryHue: 250 } } } })).toEqual([])
  })

  it('subset 必须给全 9 维且在原语集内', () => {
    expect(validateConfig({ tokens: { subset: { space: [4] } } } as never).join(' ')).toContain('缺少维度')
    expect(validateConfig({ tokens: { subset: { ...SUBSET_DEFAULTS, fontSize: [11] } } }).join(' ')).toContain('11')
    expect(validateConfig({ tokens: { subset: SUBSET_DEFAULTS } })).toEqual([])
  })

  it('platforms 与 output 的约束', () => {
    expect(validateConfig({ tokens: { platforms: [] } }).join(' ')).toContain('非空数组')
    expect(validateConfig({ tokens: { platforms: ['css', 'svg'] } } as never).join(' ')).toContain('svg')
    expect(validateConfig({ tokens: { output: '  ' } }).join(' ')).toContain('tokens.output')
  })

  it('默认导出四份产物，路径落在 output 目录', () => {
    const files = exportArtifacts({ tokens: { output: 'styles' } })
    expect(files.map((file) => file.path)).toEqual([
      'styles/tokens.css',
      'styles/tokens.json',
      'styles/tokens.dtcg.json',
      'styles/kernel.json',
    ])
  })

  it('给子集时额外写 tokens.config.json', () => {
    const files = exportArtifacts({ tokens: { subset: SUBSET_DEFAULTS } })
    expect(files.some((file) => file.path === 'tokens.config.json')).toBe(true)
  })

  it('seed 用路径时必须由调用方先读成对象', () => {
    expect(() => exportArtifacts({ tokens: { seed: './seed.json' } })).toThrow('文件路径')
    expect(exportArtifacts({ tokens: { seed: './seed.json' } }, { color: { primaryHue: 250 } })).toHaveLength(4)
  })

  it('同输入两次生成逐字节相同', () => {
    const config = { tokens: { subset: SUBSET_DEFAULTS, semantics: { template: 'default' } } }
    expect(JSON.stringify(exportArtifacts(config))).toBe(JSON.stringify(exportArtifacts(config)))
  })
})

describe('tools · 语义表', () => {
  it('默认表可用，且只写路径', () => {
    expect(validateSemantics(DEFAULT_SEMANTICS)).toEqual([])
    expect(resolveSemantics().gap.stack).toBe('space.4')
  })

  it('未知模板直接报错', () => {
    expect(() => resolveSemantics({ template: 'nope' })).toThrow('未知语义表模板')
    expect(validateConfig({ tokens: { semantics: { template: 'nope' } } }).join(' ')).toContain('未知模板')
  })

  it('路径必须存在于树里', () => {
    const issues = validateSemantics({ gap: { card: 'space.99' } })
    expect(issues.join(' ')).toContain('space.99')
  })

  it('跨角色引用必须存在且不能成环', () => {
    expect(validateSemantics({ a: { x: '@b.y' }, b: { y: 'space.2' } })).toEqual([])
    expect(validateSemantics({ a: { x: '@nope.y' } }).join(' ')).toContain('不存在的 @nope.y')
    expect(validateSemantics({ a: { x: '@b.y' }, b: { y: '@a.x' } }).join(' ')).toContain('成环')
  })

  it('局部覆盖只改指定槽位', () => {
    const table = resolveSemantics({ overrides: { 'gap.stack': 'space.6' } })
    expect(table.gap.stack).toBe('space.6')
    expect(table.gap.inline).toBe('space.2')
  })

  it('配置带语义表时额外写 semantics.json', () => {
    const files = exportArtifacts({ tokens: { semantics: {} } })
    const file = files.find((item) => item.path === 'ultime-tokens/semantics.json')
    expect(file).toBeDefined()
    expect(file!.content).toContain('"gap"')
  })
})
