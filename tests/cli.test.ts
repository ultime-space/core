import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { parseArgs, runCli, type CliContext } from '@ultime/cli'
import { createCoreSpec } from '../src/cli/spec.ts'
import { readSeedFile } from '../src/cli/config-file.ts'
import { runBuild } from '../src/cli/commands/build.ts'
import { runInit } from '../src/cli/commands/init.ts'
import { runInspect } from '../src/cli/commands/inspect.ts'
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
    const spec = createCoreSpec('1.2.3')
    const args = parseArgs(['build', '--check', '--config=foo.json', '--cwd', 'dir'], {
      flags: spec.commands.build?.flags,
    })
    expect(args.command).toBe('build')
    expect(args.flags).toEqual({ check: true, config: 'foo.json', cwd: 'dir' })
  })

  it('布尔 flag 不吞后面的 positional', () => {
    const spec = createCoreSpec('1.2.3')
    const args = parseArgs(['init', '--force', 'dir'], { flags: spec.commands.init?.flags })
    expect(args.flags).toEqual({ force: true })
    expect(args.positional).toEqual(['dir'])
  })
})

describe('core cli · 入口', () => {
  it('版本与单命令帮助不执行命令', async () => {
    const { ctx, out } = collector(process.cwd())
    const spec = createCoreSpec('1.2.3')
    expect(await runCli(spec, ['--version'], ctx)).toBe(0)
    expect(await runCli(spec, ['build', '--help'], ctx)).toBe(0)
    expect(out).toEqual(['1.2.3', 'ultime-core build [--check] [--config <path>] [--cwd <dir>]'])
  })

  it('未知参数报用法错误', async () => {
    const { ctx, err } = collector(process.cwd())
    expect(await runCli(createCoreSpec('1.2.3'), ['build', '--chek'], ctx)).toBe(2)
    expect(err.join('\n')).toContain('未知参数：--chek')
    expect(err.join('\n')).toContain('--check')
  })

  it('分发给 schema 命令并输出 JSON', async () => {
    const { ctx, out } = collector(process.cwd())
    expect(await runCli(createCoreSpec('1.2.3'), ['schema', '--json'], ctx)).toBe(0)
    expect(JSON.parse(out.join('\n'))).toHaveProperty('seed')
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

describe('core cli · seed 文件', () => {
  it('非对象 seed 直接报错', () => {
    const dir = tempDir()
    const file = path.join(dir, 'seed.json')
    for (const content of ['[]', 'null', '"text"', '1']) {
      fs.writeFileSync(file, content)
      expect(() => readSeedFile(file)).toThrow('seed 文件必须是对象')
    }
    fs.writeFileSync(file, '{"color":{}}')
    expect(readSeedFile(file)).toEqual({ color: {} })
  })
})

describe('core cli · inspect', () => {
  it('构建诊断有 error 时返回 1', () => {
    const dir = tempDir()
    const configPath = writeConfig(dir, { tokens: {}, selection: { categories: ['nope'] } })
    const { ctx, out } = collector(dir)

    expect(runInspect(ctx, { configPath, json: false })).toBe(1)
    expect(out.join('\n')).toContain('未知选择类别')
  })

  it('--json 下仍输出诊断并返回 1', () => {
    const dir = tempDir()
    const configPath = writeConfig(dir, { tokens: {}, selection: { categories: ['nope'] } })
    const { ctx, out } = collector(dir)

    expect(runInspect(ctx, { configPath, json: true })).toBe(1)
    const payload = JSON.parse(out.join('\n')) as { diagnostics: Array<{ code: string }> }
    expect(payload.diagnostics.some((item) => item.code === 'selection.category.unknown')).toBe(true)
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
