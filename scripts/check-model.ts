/**
 * check-model.ts — 内核机械守卫
 * ---------------------------------------------------------------------------
 * 三条约定从「口头」变成机械检查：
 *   core-dependency        零第三方依赖；`src/studio/**` / `src/cli/**` 例外（共享基础设施）
 *   model-direction        model 不得反向 import build / exporters / tools / studio
 *   category-isolation     color / light / motion / skeleton 四类互不 import
 *   model-forbidden-token  模型产物里禁止出现 var( / color-mix / -- 变量语法
 *
 * 用法：tsx scripts/check-model.ts
 */

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const SRC = path.resolve(import.meta.dirname, '..', 'src')
const problems: string[] = []

const walkFiles = (dir: string): string[] => {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkFiles(full))
    else if (entry.name.endsWith('.ts')) out.push(full)
  }
  return out
}

const IMPORT = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g
const stripComments = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

const categoryOf = (rel: string): string | null => {
  const match = /^model\/([^/]+)\//.exec(rel)
  return match ? match[1] : null
}

for (const file of walkFiles(SRC)) {
  const rel = path.relative(SRC, file).replaceAll(path.sep, '/')
  const code = stripComments(fs.readFileSync(file, 'utf8'))
  const ownCategory = categoryOf(rel)

  for (const match of code.matchAll(IMPORT)) {
    const spec = match[1]

    if (spec.startsWith('node:')) continue
    if (!spec.startsWith('.')) {
      if (spec === '@ultime/studio' && rel.startsWith('studio/')) continue
      if (spec === '@ultime/cli' && rel.startsWith('cli/')) continue
      problems.push(`[core-dependency] ${rel} → ${spec}（core 不允许第三方依赖）`)
      continue
    }

    const target = path.resolve(path.dirname(file), spec)
    const targetRel = path.relative(SRC, target).replaceAll(path.sep, '/')
    if (targetRel.startsWith('..')) {
      problems.push(`[core-scope] ${rel} → ${spec}（引用了 core 之外的文件）`)
      continue
    }

    if (rel.startsWith('model/')) {
      if (/^(build|exporters|tools|studio|contracts|index)(\/|$)/.test(targetRel)) {
        problems.push(`[model-direction] ${rel} → ${spec}（方向只能是 model ← build / exporters）`)
        continue
      }
      const targetCategory = categoryOf(targetRel)
      if (ownCategory && targetCategory && ownCategory !== targetCategory) {
        problems.push(`[category-isolation] ${rel} → ${spec}（${ownCategory} 不得引用 ${targetCategory}）`)
      }
    }
  }
}

const [{ buildCore }, { DEFAULT_SEED }] = await Promise.all([
  import(pathToFileURL(path.join(SRC, 'build.ts')).href),
  import(pathToFileURL(path.join(SRC, 'seed.ts')).href),
])

const result = buildCore(DEFAULT_SEED)
const text = JSON.stringify(result.tree)
const forbidden = /var\(|color-mix|--[a-z]/i
if (forbidden.test(text)) problems.push(`[model-forbidden-token] 树产物里出现载体语法：${text.match(forbidden)?.[0]}`)

if (problems.length) {
  for (const problem of problems) console.error(`✗ ${problem}`)
  console.error(`\n✗ 内核守卫未通过（${problems.length} 处）`)
  process.exit(1)
}

console.log('✓ 内核守卫通过（零依赖 / 方向单向 / 类别隔离 / 模型值无载体语法）')
