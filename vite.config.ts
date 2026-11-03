import { defineConfig } from 'vite-plus'
import { resolve } from 'node:path'

const HERE = import.meta.dirname
const at = (p: string) => resolve(HERE, p)

/**
 * core 的库出口：把 TS 源码打成无依赖 ESM，供上层包消费。
 * token / kernel 产物**不在这里**：它们由 `scripts/build.ts` 确定性生成（可逐字节比对）。
 */
export default defineConfig({
  root: HERE,
  staged: { '*': 'vp check --fix' },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 20_000,
  },
  build: {
    target: 'node22',
    minify: false,
    emptyOutDir: true,
    lib: {
      entry: {
        index: at('src/index.ts'),
        seed: at('src/seed.ts'),
        exporters: at('src/exporters/index.ts'),
        tools: at('src/tools/index.ts'),
        studio: at('src/studio/index.ts'),
        cli: at('src/cli/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      /* 运行时保持单例：消费方也装 @ultime/studio / @ultime/cli，不能把副本打进 dist */
      external: ['@ultime/studio', '@ultime/cli', /^node:/],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
})
