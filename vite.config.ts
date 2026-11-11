import { defineConfig } from 'vite-plus'
import { resolve } from 'node:path'

const HERE = import.meta.dirname
const at = (p: string) => resolve(HERE, p)

/** 生成物与文档不参与格式化：改源重跑，不与脚本产物产生无意义 diff。 */
const ignore = [
  '**/node_modules/**',
  '**/dist/**',
  '**/*.md',
  '*.css',
  'kernel.json',
  'tokens.json',
  'tokens.dtcg.json',
]

/**
 * core 的库出口：把 TS 源码打成无依赖 ESM，供上层包消费。
 * token / kernel 产物**不在这里**：它们由 `scripts/build.ts` 确定性生成（可逐字节比对）。
 */
export default defineConfig({
  root: HERE,
  staged: { '*': 'vp check --fix' },
  fmt: {
    ignorePatterns: ignore,
    semi: false,
    singleQuote: true,
    trailingComma: 'all',
    printWidth: 120,
  },
  lint: {
    ignorePatterns: ignore,
    plugins: ['typescript'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 20_000,
  },
  pack: {
    entry: {
      index: at('src/index.ts'),
      seed: at('src/seed.ts'),
      exporters: at('src/exporters/index.ts'),
      tools: at('src/tools/index.ts'),
      studio: at('src/studio/index.ts'),
      cli: at('src/cli/index.ts'),
    },
    format: 'esm',
    platform: 'node',
    target: 'node22',
    dts: true,
    // 发布产物默认压缩：注释与说明留在源码与文档，不随 dist 发布。
    minify: true,
    sourcemap: false,
    clean: true,
    publint: true,
    attw: {
      level: 'error',
      entrypoints: ['.', './exporters', './studio', './tools', './seed'],
    },
    unused: true,
    outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
    /* 运行时保持单例：消费方也装 @ultime/studio / @ultime/cli，不能把副本打进 dist */
    deps: { neverBundle: ['@ultime/studio', '@ultime/cli'] },
  },
})
