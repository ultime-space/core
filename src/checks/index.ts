/**
 * `@ultime/core/checks`：core 自有的 checks 规则。
 * 规则内容归 core；`@ultime/checks` 只负责运行。
 */

export { RuleConfigError } from './errors'
export { tokensRule } from './tokens'
export type { ChecksFinding, ChecksRule, ChecksRuleContext } from './types'
