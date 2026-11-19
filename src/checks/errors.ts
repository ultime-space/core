/**
 * 配置类错误：普通 Error 携带 `code`，checks 运行器会映射为 `CONFIG_OPTION`。
 * 不依赖 `@ultime/checks` 的错误类，保持 core 运行时零依赖。
 */
export class RuleConfigError extends Error {
  readonly code = 'CONFIG'

  constructor(message: string) {
    super(message)
    this.name = 'RuleConfigError'
  }
}
