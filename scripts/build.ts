/**
 * build.ts — core 的唯一构建入口（脚本）
 * ---------------------------------------------------------------------------
 * 产物（全部平铺在包根）：tokens.css / tokens.json / tokens.dtcg.json / kernel.json
 *
 * 用法：
 *   tsx scripts/build.ts                       # theme.example.json → 写盘
 *   tsx scripts/build.ts --seed my-seed.json   # 指定项目 seed
 *   tsx scripts/build.ts --check               # 只校验产物与源一致
 *   tsx scripts/build.ts --css-only            # 只写 / 比 CSS
 */

import fs from 'node:fs'
import path from 'node:path'

import { planProject } from '../src/tools'
import { readJsonc, type SeedInput } from '../src/seed'

const PKG = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const CHECK = args.includes('--check')
const argOf = (name: string): string | undefined => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const OUT = path.resolve(process.cwd(), argOf('--out-dir') ?? PKG)
const output = path.relative(process.cwd(), OUT) || '.'

const seedPath = argOf('--seed') ?? path.join(PKG, 'theme.example.json')
const seedInput: SeedInput = fs.existsSync(seedPath) ? (readJsonc(fs.readFileSync(seedPath, 'utf8')) as SeedInput) : {}

const build = planProject({ tokens: { output } }, seedInput)
const selected = args.includes('--css-only')
  ? build.artifacts.filter((file) => file.path.endsWith('.css'))
  : build.artifacts

let drift: string[] = []
if (CHECK) {
  drift = selected
    .filter((file) => {
      const target = path.join(OUT, file.path)
      return !fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== file.content
    })
    .map((file) => file.path.replace(/^\.\//, ''))
} else {
  fs.mkdirSync(OUT, { recursive: true })
  for (const file of selected) fs.writeFileSync(path.join(OUT, file.path), file.content)
}

const line = '─'.repeat(74)
console.log('\nUltime · core 构建摘要')
console.log(line)
console.log(`  seed                  ${fs.existsSync(seedPath) ? path.relative(PKG, seedPath) : '默认'}`)
console.log(`  seed 指纹             ${build.manifest.seedHash}`)
console.log(
  `  token                 ${build.core.counts.total} 条（${Object.entries(build.core.counts.byCategory)
    .map(([k, v]) => `${k} ${v}`)
    .join(' · ')}）`,
)
console.log(
  `  合同                  ${build.core.contracts.total} 条 · 失败 ${build.core.contracts.failed} · 覆盖 ${build.core.contracts.ids.length} 类`,
)
console.log(
  `  产物                  ${selected.length} 个 → ${path.relative(PKG, OUT) || '.'}/${CHECK ? '（--check：不写盘）' : ''}`,
)
console.log(line)

for (const diagnostic of build.diagnostics) {
  const mark = diagnostic.level === 'error' ? '✗' : '△'
  console.error(`${mark} ${diagnostic.message}`)
}

if (CHECK) {
  if (drift.length) {
    for (const file of drift) console.error(`✗ 产物与源不一致：packages/core/${file}`)
    console.error('  已在内存生成，未写盘；请运行 tsx scripts/build.ts 后提交生成物。')
    process.exit(1)
  }
  console.log('✓ 产物与源一致')
}

const errors = build.diagnostics.filter((diagnostic) => diagnostic.level === 'error')
process.exit(errors.length || build.core.contracts.failed ? 1 : 0)
