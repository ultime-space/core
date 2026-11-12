import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { parseArgs, type CliContext } from '@ultime/cli'
import { runBuild } from '../src/cli/commands/build.ts'
import { runInit } from '../src/cli/commands/init.ts'
import { runSchema } from '../src/cli/commands/schema.ts'

const temps: string[] = []

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultime-core-cli-'))
  temps.push(dir)
  return dir
}

function collector(cwd: string) {
  const out: string[] = []
  const err: string[] = []
  const ctx: CliContext = { cwd, out: (line) => out.push(line), err: (line) => err.push(line) }
  return { ctx, out, err }
}

function writeConfig(dir: string, config: unknown): string {
  const file = path.join(dir, 'ultime.config.json')
  fs.writeFileSync(file, JSON.stringify(config, null, 2))
  return file
}

afterEach(() => {
  while (temps.length) fs.rmSync(temps.pop()!, { recursive: true, force: true })
})

describe('core cli · 参数', () => {
  it('解析命令、flag 与 key=value', () => {
    const args = parseArgs(['build', '--check', '--config=foo.json', '--cwd', 'dir'])
    expect(args.command).toBe('build')
    expect(args.flags).toEqual({ check: true, config: 'foo.json', cwd: 'dir' })
  })
})

describe('core cli · init', () => {
  it('写起步配置；已存在时拒绝覆盖', () => {
    const dir = tempDir()
    const file = path.join(dir, 'ultime.config.json')
    let { ctx, err } = collector(dir)

    expect(runInit(ctx, file, false)).toBe(0)
    const config = JSON.parse(fs.readFileSync(file, 'utf8')) as { tokens: { output: string } }
    expect(config.tokens.output).toBe('src/styles/tokens')

    ;({ ctx, err } = collector(dir))
    expect(runInit(ctx, file, false)).toBe(1)
    expect(err.join('\n')).toContain('配置已存在')
    expect(runInit(ctx, file, true)).toBe(0)
  })
})

describe('core cli · build', () => {
  it('生成四份产物，check 通过；手改后 check 失败，重建恢复', () => {
    const dir = tempDir()
    const configPath = writeConfig(dir, { tokens: { output: 'styles' } })
    let { ctx, out, err } = collector(dir)

    expect(runBuild(ctx, { configPath, check: false })).toBe(0)
    const dirPath = path.join(dir, 'styles')
    expect(fs.readdirSync(dirPath).sort()).toEqual(['kernel.json', 'tokens.css', 'tokens.dtcg.json', 'tokens.json'])
    expect(out.join('\n')).toContain('个产物')

    ;({ ctx, out, err } = collector(dir))
    expect(runBuild(ctx, { configPath, check: true })).toBe(0)

    fs.writeFileSync(path.join(dirPath, 'tokens.css'), 'hand edited\n')
    ;({ ctx, out, err } = collector(dir))
    expect(runBuild(ctx, { configPath, check: true })).toBe(1)
    expect(err.join('\n')).toContain('产物过期')

    ;({ ctx, out, err } = collector(dir))
    expect(runBuild(ctx, { configPath, check: false })).toBe(0)
    expect(runBuild(ctx, { configPath, check: true })).toBe(0)
  })
})

describe('core cli · schema', () => {
  it('输出种子字段、出口与语义表', () => {
    const { ctx, out } = collector(process.cwd())
    expect(runSchema(ctx, false)).toBe(0)
    expect(out.join('\n')).toContain('seed ·')
    expect(out.join('\n')).toContain('出口 ·')
  })
})
