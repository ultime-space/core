import { extname } from 'node:path'
import { RuleConfigError } from './errors'
import type { ChecksFinding, ChecksRule } from './types'

const STYLE_EXT = new Set(['.css', '.scss', '.less'])
const LINE_COMMENT_EXT = new Set(['.scss', '.less'])
const DEFAULT_CLASSES = ['fs', 'surface', 'shadow']
const SUPPORTED_CLASSES = new Set(DEFAULT_CLASSES)
const CLASS_PROPERTIES: Record<string, string[]> = {
  fs: ['font-size'],
  surface: ['background', 'background-color'],
  shadow: ['box-shadow'],
}
const GLOBAL_KEYWORDS = /^(inherit|initial|unset|revert|revert-layer)$/i
const HEX_COLOR = /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/i
const COLOR_FUNCTION = /(?<![-\w])(rgba?|hsla?|hwb|oklab|oklch|lab|lch|color)\s*\(/gi
const DECLARATION = /(?:^|[;{}])\s*([a-zA-Z][a-zA-Z-]*)\s*:\s*([^;{}]*?)\s*(?=[;}])/g

interface AllowEntry {
  pattern: string
  files?: string[]
  reason: string
}

interface TokensOptions {
  manifest: string
  classes: string[]
  scope: string[]
  allow: AllowEntry[]
}

interface Family {
  name: string
  allowed: Set<string>
  prefix: string
  hint: string
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function asStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new RuleConfigError(`tokens.${field} 必须是字符串数组`)
  }
  return value as string[]
}

function asAllow(value: unknown): AllowEntry[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new RuleConfigError('tokens.allow 必须是数组')

  return value.map((entry, index) => {
    if (!isObject(entry)) throw new RuleConfigError(`tokens.allow[${index}] 必须是对象`)
    if (typeof entry.pattern !== 'string' || entry.pattern.length === 0) {
      throw new RuleConfigError(`tokens.allow[${index}].pattern 必须是非空字符串`)
    }
    try {
      new RegExp(entry.pattern)
    } catch (error) {
      throw new RuleConfigError(
        `tokens.allow[${index}].pattern 的正则无效：${error instanceof Error ? error.message : String(error)}`,
      )
    }
    const files = asStringArray(entry.files, `allow[${index}].files`)
    const reason = typeof entry.reason === 'string' ? entry.reason.trim() : ''
    if (!reason) throw new RuleConfigError(`tokens.allow[${index}].reason 必须是非空字符串`)
    return { pattern: entry.pattern, reason, ...(files ? { files } : {}) }
  })
}

function parseOptions(input: Record<string, unknown>): TokensOptions {
  if (typeof input.manifest !== 'string' || input.manifest.length === 0) {
    throw new RuleConfigError('tokens.manifest 必须是非空字符串')
  }
  return {
    manifest: input.manifest,
    classes: asStringArray(input.classes, 'classes') ?? [...DEFAULT_CLASSES],
    scope: asStringArray(input.scope, 'scope') ?? [],
    allow: asAllow(input.allow),
  }
}

function readTiers(
  ctx: { exists(file: string): boolean; read(file: string): string },
  manifest: string,
): Record<string, string[]> {
  if (!ctx.exists(manifest)) throw new RuleConfigError(`找不到 manifest：${manifest}`)

  let data: unknown
  try {
    data = JSON.parse(ctx.read(manifest))
  } catch {
    throw new RuleConfigError(`manifest 无法解析：${manifest}`)
  }

  const tiers = isObject(data) ? data.tiers : undefined
  if (!isObject(tiers)) {
    throw new RuleConfigError('manifest 缺少 tiers；需要 core 1.0+ 的 kernel.json')
  }
  if (Object.keys(tiers).length === 0) {
    throw new RuleConfigError('manifest.tiers 不能为空')
  }

  const result: Record<string, string[]> = Object.create(null)
  for (const [key, value] of Object.entries(tiers)) {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
      throw new RuleConfigError(`manifest.tiers.${key} 必须是字符串数组`)
    }
    if (value.length === 0) throw new RuleConfigError(`manifest.tiers.${key} 不能为空`)
    result[key] = value as string[]
  }
  return result
}

/** 从档位路径推变量名：`fs.4` → `--fs-4`，`color.surface.raised` → `--color-surface-raised`。 */
function familyOf(entries: string[], name: string): Family {
  const segments = entries.map((entry) => entry.split('.'))
  let prefix = segments[0] ?? []
  for (const current of segments.slice(1)) {
    let size = 0
    while (size < prefix.length && size < current.length && prefix[size] === current[size]) size++
    prefix = prefix.slice(0, size)
  }

  const allowed = new Set(entries.map((entry) => `--${entry.replaceAll('.', '-')}`))
  return {
    name,
    allowed,
    prefix: `--${prefix.join('-')}-`,
    hint: `${name} 允许：${[...allowed].join(' / ')}`,
  }
}

/** 所有已导出档位的家族；长前缀优先，避免一个前缀吞掉另一个。 */
function buildRegistry(tiers: Record<string, string[]>): Family[] {
  return Object.entries(tiers)
    .map(([name, entries]) => familyOf(entries, name))
    .sort((left, right) => right.prefix.length - left.prefix.length)
}

/** 命中的已导出家族；未命中说明是下游组合 / 别名，不在本规则的档位契约内。 */
const familyFor = (registry: Family[], name: string): Family | undefined =>
  registry.find((family) => name.startsWith(family.prefix))

function maskCss(text: string, lineComments: boolean): string {
  const chars = text.split('')
  const blank = (start: number, end: number): void => {
    for (let index = start; index < end; index++) {
      if (chars[index] !== '\n') chars[index] = ' '
    }
  }

  let index = 0
  while (index < text.length) {
    const char = text[index]

    if (char === '"' || char === "'") {
      const start = index
      index++
      while (index < text.length) {
        if (text[index] === '\\') {
          index += 2
          continue
        }
        if (text[index] === char) {
          index++
          break
        }
        index++
      }
      blank(start, Math.min(index, text.length))
      continue
    }

    if (char === '/' && text[index + 1] === '*') {
      const start = index
      index += 2
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) index++
      index = Math.min(index + 2, text.length)
      blank(start, index)
      continue
    }

    if (lineComments && char === '/' && text[index + 1] === '/' && /[\s;{}]/.test(text[index - 1] ?? '\n')) {
      const start = index
      while (index < text.length && text[index] !== '\n') index++
      blank(start, index)
      continue
    }

    index++
  }

  return chars.join('')
}

function closingParen(text: string, open: number): number {
  let depth = 0
  for (let index = open; index < text.length; index++) {
    if (text[index] === '(') depth++
    else if (text[index] === ')') {
      depth--
      if (depth === 0) return index
    }
  }
  return -1
}

/** 找出 `var(--x)` 引用，并把整段调用替换为等长空格，剩余部分用于判断字面值。 */
function scanVars(value: string): { calls: string[]; rest: string } {
  const chars = value.split('')
  const calls: string[] = []
  let index = 0

  while (index < value.length) {
    const before = index === 0 ? '' : value[index - 1]!
    if (/^var\s*\(/i.test(value.slice(index)) && !/[-\w]/.test(before)) {
      const open = value.indexOf('(', index)
      const close = closingParen(value, open)
      const stop = close === -1 ? value.length : close
      const name = /^\s*(--[A-Za-z0-9_-]+)/.exec(value.slice(open + 1, stop))
      if (name) calls.push(name[1]!)
      for (let cursor = index; cursor <= stop && cursor < chars.length; cursor++) {
        if (chars[cursor] !== '\n') chars[cursor] = ' '
      }
      index = stop + 1
      continue
    }
    index++
  }

  return { calls, rest: chars.join('') }
}

function hasLiteralColor(value: string, rest: string): boolean {
  if (HEX_COLOR.test(rest)) return true

  COLOR_FUNCTION.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = COLOR_FUNCTION.exec(value)) !== null) {
    const open = value.indexOf('(', match.index)
    const close = closingParen(value, open)
    const inner = value.slice(open + 1, close === -1 ? value.length : close)
    /* rgb(var(--x) / 0.5) 的取值来自 token，不按字面颜色处理 */
    if (/\bvar\s*\(/i.test(inner)) {
      COLOR_FUNCTION.lastIndex = close === -1 ? value.length : close + 1
      continue
    }
    return true
  }
  return false
}

function normalize(value: string): string {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > 40 ? `${text.slice(0, 40)}…` : text
}

const stripImportant = (value: string): string => value.replace(/!\s*important\s*$/i, '').trim()

function positionAt(text: string, index: number): { line: number; column: number } {
  let line = 1
  let lastBreak = -1
  for (let cursor = 0; cursor < index; cursor++) {
    if (text[cursor] === '\n') {
      line++
      lastBreak = cursor
    }
  }
  return { line, column: index - lastBreak }
}

export const tokensRule: ChecksRule = {
  name: 'tokens',
  id: 'core/tokens',
  description: '按 core manifest 的 tiers 校验字号、表面与阴影是否使用登记档位',
  optionKeys: ['manifest', 'classes', 'scope', 'allow'],
  run(ctx, rawOptions) {
    const options = parseOptions(rawOptions)
    const tiers = readTiers(ctx, options.manifest)

    for (const className of options.classes) {
      if (!tiers[className]) {
        throw new RuleConfigError(
          `tokens.classes 含未导出的类别：${className}（可用：${Object.keys(tiers).sort().join(' / ')}）`,
        )
      }
      if (!SUPPORTED_CLASSES.has(className)) {
        throw new RuleConfigError(
          `tokens.classes 暂不支持类别：${className}（已支持：${[...SUPPORTED_CLASSES].join(' / ')}）`,
        )
      }
    }

    /* 已导出的档位家族按契约校验；未命中的变量是下游组合 / 别名，交给下游自己测试。 */
    const registry = buildRegistry(tiers)

    const propertyClasses = new Map<string, string>()
    for (const className of options.classes) {
      for (const property of CLASS_PROPERTIES[className] ?? []) propertyClasses.set(property, className)
    }

    const allow = options.allow.map((entry) => ({
      ...entry,
      regex: new RegExp(`^(?:${entry.pattern})$`),
    }))

    const findings: ChecksFinding[] = []
    const report = (file: string, source: string, index: number, message: string, hint: string): void => {
      const position = positionAt(source, index)
      findings.push({
        ruleId: 'core/tokens',
        level: 'error',
        file,
        line: position.line,
        column: position.column,
        message,
        hint,
      })
    }

    for (const file of ctx.files) {
      if (!STYLE_EXT.has(extname(file).toLowerCase())) continue
      if (options.scope.length > 0 && !options.scope.some((pattern) => ctx.match(pattern, file))) continue

      const source = maskCss(ctx.read(file), LINE_COMMENT_EXT.has(extname(file).toLowerCase()))
      DECLARATION.lastIndex = 0
      let match: RegExpExecArray | null

      while ((match = DECLARATION.exec(source)) !== null) {
        const property = match[1]!.toLowerCase()
        const className = propertyClasses.get(property)
        if (!className) continue

        const value = stripImportant(match[2] ?? '')
        if (!value) continue
        if (
          allow.some(
            (entry) =>
              (!entry.files || entry.files.some((pattern) => ctx.match(pattern, file))) && entry.regex.test(value),
          )
        ) {
          continue
        }

        const propertyIndex = match.index + match[0].indexOf(match[1]!)
        const { calls, rest } = scanVars(value)

        if (className === 'fs') {
          if (calls.length === 0) {
            if (GLOBAL_KEYWORDS.test(value) || value === '0') continue
            report(
              file,
              source,
              propertyIndex,
              `font-size 必须使用 token 变量，不能写成 ${normalize(value)}`,
              '改用 var(--fs-N)；确属光学微调时登记 allow',
            )
            continue
          }
          for (const name of calls) {
            const family = familyFor(registry, name)
            if (!family) continue
            if (family.name !== 'fs') {
              report(file, source, propertyIndex, `font-size 不能引用 ${name}；应使用 fs 档位`, '改用 var(--fs-N)')
            } else if (!family.allowed.has(name)) {
              report(file, source, propertyIndex, `未登记的档位：${name}`, family.hint)
            }
          }
          continue
        }

        if (className === 'shadow') {
          if (calls.length === 0) {
            if (/^(none|inherit|initial|unset|revert|revert-layer)$/i.test(value)) continue
            report(
              file,
              source,
              propertyIndex,
              'box-shadow 必须整体使用 token 变量，不能写字面阴影',
              '改用 var(--shadow-N) / var(--occlusion-N) 或 none',
            )
            continue
          }

          let invalid = false
          for (const name of calls) {
            const family = familyFor(registry, name)
            if (!family) continue
            if (family.name !== 'shadow' && family.name !== 'occlusion') {
              report(
                file,
                source,
                propertyIndex,
                `box-shadow 不能引用 ${name}；应使用 shadow 或 occlusion 档位`,
                '改用 var(--shadow-N) / var(--occlusion-N)',
              )
              invalid = true
            } else if (!family.allowed.has(name)) {
              report(file, source, propertyIndex, `未登记的档位：${name}`, family.hint)
              invalid = true
            }
          }
          if (!invalid && !/^[\s,]*$/.test(rest)) {
            report(
              file,
              source,
              propertyIndex,
              'box-shadow 必须整体使用 token 变量，不能写字面阴影',
              '改用 var(--shadow-N) / var(--occlusion-N) 或 none',
            )
          }
          continue
        }

        if (className === 'surface') {
          if (/^(none|transparent|currentcolor|inherit|initial|unset|revert|revert-layer)$/i.test(value)) continue
          if (!hasLiteralColor(value, rest)) continue
          report(
            file,
            source,
            propertyIndex,
            `背景色必须使用 token 变量，不能写成 ${normalize(value)}`,
            '改用 var(--color-surface-*)；确属必要例外时登记 allow',
          )
        }
      }
    }

    return findings
  },
}
