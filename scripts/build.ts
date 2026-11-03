/**
 * build.ts — core 的唯一构建入口（脚本）
 * ---------------------------------------------------------------------------
 * 产物（全部平铺在包根）：
 *   tokens.css / tokens.json / tokens.dtcg.json / kernel.json
 *
 * 用法：
 *   tsx scripts/build.ts                       # theme.example.json → 写盘
 *   tsx scripts/build.ts --seed my-seed.json   # 指定项目 seed
 *   tsx scripts/build.ts --check               # 只校验产物是否与源一致
 *   tsx scripts/build.ts --css-only            # 只写 / 比 CSS
 */

import fs from 'node:fs'
import path from 'node:path'

import { buildCore, buildManifest } from '../src/build'
import { treeToCss, treeToDtcg, treeToJson } from '../src/exporters'
import { readJsonc, type SeedInput } from '../src/seed'

const PKG = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const CHECK = args.includes('--check')
const argOf = (name: string): string | undefined => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const OUT = path.resolve(process.cwd(), argOf('--out-dir') ?? PKG)

const seedPath = argOf('--seed') ?? path.join(PKG, 'theme.example.json')
const seedInput: SeedInput = fs.existsSync(seedPath) ? (readJsonc(fs.readFileSync(seedPath, 'utf8')) as SeedInput) : {}

const result = buildCore(seedInput)
const outputs: Record<string, string> = {
  'tokens.css': treeToCss(result),
  'tokens.json': `${JSON.stringify(treeToJson(result), null, 2)}\n`,
  'tokens.dtcg.json': `${JSON.stringify(treeToDtcg(result), null, 2)}\n`,
  'kernel.json': `${JSON.stringify(buildManifest(result), null, 2)}\n`,
}
const selected = args.includes('--css-only')
  ? Object.fromEntries(Object.entries(outputs).filter(([file]) => file.endsWith('.css')))
  : outputs

let drift: string[] = []
if (CHECK) {
  drift = Object.entries(selected)
    .filter(([file, content]) => {
      const p = path.join(OUT, file)
      return !fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== content
    })
    .map(([file]) => file)
} else {
  fs.mkdirSync(OUT, { recursive: true })
  for (const [file, content] of Object.entries(selected)) fs.writeFileSync(path.join(OUT, file), content)
}

const line = '─'.repeat(74)
console.log('\nUltime · core 构建摘要')
console.log(line)
console.log(`  seed                  ${fs.existsSync(seedPath) ? path.relative(PKG, seedPath) : '默认'}`)
console.log(`  seed 指纹             ${buildManifest(result).seedHash}`)
console.log(
  `  token                 ${result.counts.total} 条（${Object.entries(result.counts.byCategory)
    .map(([k, v]) => `${k} ${v}`)
    .join(' · ')}）`,
)
console.log(
  `  合同                  ${result.contracts.total} 条 · 失败 ${result.contracts.failed} · 覆盖 ${result.contracts.ids.length} 类`,
)
console.log(
  `  产物                  ${Object.keys(selected).length} 个 → ${path.relative(PKG, OUT) || '.'}/${CHECK ? '（--check：不写盘）' : ''}`,
)
console.log(line)

const issues = result.contracts.rows.filter((item) => item.level !== 'pass')
if (issues.length) {
  for (const row of issues) {
    const mark = row.blocking ? '✗' : '△'
    console.error(
      `${mark} ${row.id.padEnd(22)} ${row.label}　实测 ${String(row.actual)}　目标 ${String(row.target)}　[${row.level ?? 'deviation'}]`,
    )
  }
}

if (CHECK) {
  if (drift.length) {
    for (const file of drift) console.error(`✗ 产物与源不一致：packages/core/${file}`)
    console.error('  已在内存生成，未写盘；请运行 tsx scripts/build.ts 后提交生成物。')
    process.exit(1)
  }
  console.log('✓ 产物与源一致')
}

process.exit(result.contracts.failed ? 1 : 0)
