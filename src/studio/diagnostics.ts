/**
 * diagnostics.ts — 合同诊断到配置器诊断的映射
 * ---------------------------------------------------------------------------
 * 合同行数量随 seed 增长：全部展示会淹没配置器，所以非 error 的合同诊断设上限。
 * `error` 永不截断 —— 少了它，导出前的阻断判定会被误放行。
 */

import type { Diagnostic } from '@ultime/studio'
import type { ProjectBuild } from '../tools'

/** 合同诊断里非 error 的展示上限。 */
const CONTRACT_NOTICE_LIMIT = 12

export function toStudioDiagnostics(source: ProjectBuild['diagnostics']): Diagnostic[] {
  const other = source.filter((item) => !item.code.startsWith('contract.'))
  const contract = source.filter((item) => item.code.startsWith('contract.'))
  const errors = contract.filter((item) => item.level === 'error')
  const notices = contract.filter((item) => item.level !== 'error')
  const kept = notices.slice(0, CONTRACT_NOTICE_LIMIT)

  const diagnostics = [...other, ...errors, ...kept].map(toStudioDiagnostic)
  if (notices.length > kept.length) {
    diagnostics.push({
      level: 'info',
      code: 'core/contract.truncated',
      message: `另有 ${notices.length - kept.length} 条合同提示未显示`,
      path: '/tokens/seed',
    })
  }
  return diagnostics
}

function toStudioDiagnostic(diagnostic: ProjectBuild['diagnostics'][number]): Diagnostic {
  return {
    level: diagnostic.level,
    code: `core/${diagnostic.code}`,
    message: diagnostic.message,
    path: diagnostic.path ?? '/tokens/seed',
  }
}
