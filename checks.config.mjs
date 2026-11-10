/** 通过 @ultime/checks 运行；规则与词表按本包维护。 */
export default {
  roots: ['.'],
  ignore: ['node_modules', 'dist', 'coverage', '.vite-hooks', '.tmp', 'checks.config.mjs'],
  rules: [
    { use: 'imports', severity: 'error', options: { packageRoots: ['.'], packages: ['@ultime/'] } },
    { use: 'unresolved', severity: 'warn', options: { scope: ['src/**', 'scripts/**'] } },
    {
      use: 'text',
      severity: 'error',
      options: {
        include: 'all',
        deny: ['docs/', 'roadmap/', 'design-system/\\d', 'references', '小巨蛋', 'xiaojudan', '归序札记'],
        warn: ['以前|上一版|旧值|下一轮|待补|待实现|未实现|不再用|TODO|FIXME'],
      },
    },
    { use: 'doc-set', severity: 'error', options: { packages: ['.'] } },
  ],
}
