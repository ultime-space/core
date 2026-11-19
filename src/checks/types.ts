/**
 * 外部规则的结构契约：由 `@ultime/checks` 运行器执行。
 * 这里刻意不 import `@ultime/checks`，保持 core 运行时零依赖。
 */

export interface ChecksFinding {
  ruleId: string
  level: 'error' | 'warn'
  /** posix，相对 workspaceRoot。 */
  file: string
  line?: number
  column?: number
  message: string
  hint?: string
  locked?: boolean
}

export interface ChecksRuleContext {
  workspaceRoot: string
  root: string
  /** posix，相对 workspaceRoot。 */
  files: string[]
  read(file: string): string
  exists(file: string): boolean
  glob(patterns: string[]): string[]
  match(pattern: string, file: string): boolean
  resolve(specifier: string, importer: string): Promise<string | null>
}

export interface ChecksRule {
  name: string
  /** 规则 ID；外部规则必须带命名空间，避免与内置 `checks/*` 冲突。 */
  id: string
  description: string
  optionKeys?: readonly string[]
  run(ctx: ChecksRuleContext, options: Record<string, unknown>): ChecksFinding[] | Promise<ChecksFinding[]>
}
