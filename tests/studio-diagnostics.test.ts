import { describe, expect, it } from 'vite-plus/test'

import { toStudioDiagnostics } from '../src/studio/diagnostics'
import type { BuildDiagnostic } from '../src/tools'

const warn = (id: number): BuildDiagnostic => ({
  level: 'warn',
  code: `contract.color/pair-${id}`,
  message: `warn ${id}`,
  path: '/tokens/seed',
})

describe('toStudioDiagnostics', () => {
  it('合同 error 永不截断', () => {
    const source: BuildDiagnostic[] = [...Array.from({ length: 20 }, (_, index) => warn(index))]
    source.push({ level: 'error', code: 'contract.space-monotonic', message: 'error', path: '/tokens/seed' })

    const diagnostics = toStudioDiagnostics(source)

    expect(diagnostics.some((item) => item.level === 'error' && item.code === 'core/contract.space-monotonic')).toBe(
      true,
    )
    expect(diagnostics.filter((item) => item.level === 'warn')).toHaveLength(12)
    expect(diagnostics.at(-1)).toMatchObject({ level: 'info', code: 'core/contract.truncated' })
    expect(diagnostics.at(-1)?.message).toContain('8')
  })

  it('提示不超上限时不加摘要', () => {
    const diagnostics = toStudioDiagnostics(Array.from({ length: 12 }, (_, index) => warn(index)))

    expect(diagnostics).toHaveLength(12)
    expect(diagnostics.some((item) => item.code === 'core/contract.truncated')).toBe(false)
  })

  it('非合同诊断不参与截断', () => {
    const source: BuildDiagnostic[] = [
      ...Array.from({ length: 20 }, (_, index) => warn(index)),
      ...Array.from({ length: 20 }, (_, index) => ({
        level: 'info' as const,
        code: `selection.steps-${index}`,
        message: `info ${index}`,
      })),
    ]

    const diagnostics = toStudioDiagnostics(source)

    expect(diagnostics.filter((item) => item.code.startsWith('core/selection.'))).toHaveLength(20)
  })
})
