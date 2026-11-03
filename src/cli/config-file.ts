/**
 * config-file.ts — 配置与 seed 的读写（JSONC）
 * ---------------------------------------------------------------------------
 * 配置是项目里的人工文件，允许注释；解析用核心的 `readJsonc`（纯函数），
 * 这里只负责读盘 / 写盘与相对路径解析。
 */

import fs from 'node:fs'
import path from 'node:path'
import type { SeedInput } from '../seed.ts'
import { readJsonc } from '../seed.ts'
import type { UltimeConfig } from '../tools/index.ts'

export function parseConfig(text: string, file = 'ultime.config.json'): UltimeConfig {
  try {
    return readJsonc(text) as UltimeConfig
  } catch (error) {
    throw new Error(`${file} 不是合法 JSON：${(error as Error).message}`)
  }
}

export function readConfig(file: string): UltimeConfig {
  if (!fs.existsSync(file)) {
    throw new Error(`找不到配置：${file}（先运行 \`ultime init\`）`)
  }
  return parseConfig(fs.readFileSync(file, 'utf8'), file)
}

/** 写配置：目录不存在时补建；内容固定两空格缩进，便于 review。 */
export function writeConfig(file: string, config: UltimeConfig): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`)
}

/** 读 seed 文件：JSONC，返回对象。 */
export function readSeedFile(file: string): SeedInput {
  if (!fs.existsSync(file)) throw new Error(`找不到 seed 文件：${file}`)
  return readJsonc(fs.readFileSync(file, 'utf8')) as SeedInput
}

/** 路径统一相对「配置文件所在目录」。 */
export function resolveFromConfig(configPath: string, target: string): string {
  return path.resolve(path.dirname(configPath), target)
}
