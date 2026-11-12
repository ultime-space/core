import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { exportConfig } from '@ultime/studio'

import { runBuild } from '../src/cli/commands/build.ts'
import { DEFAULT_SEED, readJsonc, resolveSeed, stableStringify, type SeedInput } from '../src/seed.ts'
import { exportTheme, resolveThemeConfig, THEME_DEFAULTS } from '../src/tools'
import { themeStudio } from '../src/studio'
import type { CliContext } from '@ultime/cli'

const temps: string[] = []

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultime-pipeline-'))
  temps.push(dir)
  return dir
}

function collector(cwd: string): CliContext {
  return { cwd, out: () => {}, err: () => {} }
}

const byName = (files: ReadonlyArray<{ path: string; content: string }>): Record<string, string> =>
  Object.fromEntries(files.map((file) => [path.basename(file.path), file.content]))

afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('pipeline · 默认值单一来源', () => {
  it('theme.example.json 解析后与默认 seed 等价', () => {
    const example = readJsonc(fs.readFileSync(path.join(process.cwd(), 'theme.example.json'), 'utf8')) as SeedInput
    expect(stableStringify(resolveSeed(example))).toBe(stableStringify(resolveSeed(DEFAULT_SEED)))
  })

  it('省略配置时合并出与 THEME_DEFAULTS 相同的配置', () => {
    const resolved = resolveThemeConfig({ tokens: {} })
    expect(resolved.diagnostics).toEqual([])
    expect(stableStringify(resolved.config)).toBe(stableStringify(THEME_DEFAULTS))
  })
})

describe('pipeline · 同配置三入口一致', () => {
  it('CLI / 库 API / studio 默认导出逐字节一致', async () => {
    const dir = tempDir()
    const configPath = path.join(dir, 'ultime.config.json')
    fs.writeFileSync(configPath, JSON.stringify({ tokens: { output: 'styles' } }))

    expect(runBuild(collector(dir), { configPath, check: false })).toBe(0)
    const cliFiles = fs
      .readdirSync(path.join(dir, 'styles'))
      .map((name) => ({ path: name, content: fs.readFileSync(path.join(dir, 'styles', name), 'utf8') }))

    const library = exportTheme(resolveThemeConfig({ tokens: {} }).config).artifacts
    const studio = await exportConfig(themeStudio, THEME_DEFAULTS)

    expect(studio.ok).toBe(true)
    expect(byName(cliFiles)).toEqual(byName(library))
    expect(byName(studio.files)).toEqual(byName(library))
  })

  it('selection / derivation 在 CLI 与库 API 下产物一致', async () => {
    const dir = tempDir()
    const selection = { categories: ['skeleton'], steps: { space: [1, 2] } }
    const derivation = { light: { form: 'flat' } }
    const configPath = path.join(dir, 'ultime.config.json')
    fs.writeFileSync(configPath, JSON.stringify({ tokens: { output: 'styles' }, selection, derivation }))

    expect(runBuild(collector(dir), { configPath, check: false })).toBe(0)
    const cliFiles = fs
      .readdirSync(path.join(dir, 'styles'))
      .map((name) => ({ path: name, content: fs.readFileSync(path.join(dir, 'styles', name), 'utf8') }))

    const resolved = resolveThemeConfig({ tokens: {}, selection, derivation })
    const library = exportTheme(resolved.config).artifacts

    expect(cliFiles.map((file) => file.path).sort()).toEqual(['tokens.css', 'tokens.dtcg.json', 'tokens.json'])
    expect(byName(cliFiles)).toEqual(byName(library))
  })
})

describe('pipeline · 配置诊断', () => {
  it('schema 错误以 diagnostics 返回，不抛异常', () => {
    const resolved = resolveThemeConfig({ tokens: { platforms: [] } })
    expect(resolved.diagnostics.some((item) => item.level === 'error')).toBe(true)
  })

  it('seed 是文件路径时要求调用方先读取', () => {
    const resolved = resolveThemeConfig({ tokens: { seed: './seed.json' } })
    expect(resolved.diagnostics.some((item) => item.code === 'config.seed-path')).toBe(true)
  })
})
