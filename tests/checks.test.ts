import { describe, expect, it } from 'vite-plus/test'
import { RuleConfigError } from '../src/checks/errors.ts'
import { tokensRule } from '../src/checks/index.ts'
import type { ChecksRuleContext } from '../src/checks/types.ts'

const TIERS = {
  space: ['space.1', 'space.2', 'space.6'],
  radius: ['radius.1', 'radius.2'],
  fs: ['fs.1', 'fs.2', 'fs.3', 'fs.4', 'fs.5', 'fs.6', 'fs.7', 'fs.8', 'fs.9'],
  shadow: ['shadow.1', 'shadow.2', 'shadow.3', 'shadow.4'],
  surface: ['color.surface.canvas', 'color.surface.float', 'color.surface.inset', 'color.surface.raised'],
  occlusion: ['occlusion.1', 'occlusion.2', 'occlusion.3', 'occlusion.4'],
  motion: ['motion.duration.1', 'motion.easing.standard'],
}

const manifest = JSON.stringify({ schemaVersion: '7.0.0', tiers: TIERS })

const contextWith = (files: Record<string, string>): ChecksRuleContext => ({
  workspaceRoot: '/workspace',
  root: '/workspace',
  files: Object.keys(files),
  read: (file) => files[file] ?? '',
  exists: (file) => file in files,
  glob: () => [],
  match: (pattern, file) => (pattern.endsWith('/**') ? file.startsWith(pattern.slice(0, -2)) : pattern === file),
  resolve: async () => null,
})

const run = async (
  files: Record<string, string>,
  options: Record<string, unknown> = {},
  manifestContent = manifest,
) => {
  const context = contextWith({ 'kernel.json': manifestContent, ...files })
  return tokensRule.run(context, { manifest: 'kernel.json', ...options })
}

const expectConfigError = async (
  files: Record<string, string>,
  options: Record<string, unknown>,
  message: string,
  manifestContent?: string,
): Promise<void> => {
  await expect(run(files, options, manifestContent)).rejects.toMatchObject({
    code: 'CONFIG',
    message,
  })
}

describe('core/tokens', () => {
  it('core 默认 token 组合通过', async () => {
    const findings = await run({
      'packs/a.css': `.pack {
  font-size: var(--fs-4);
  font-size: var(--fs-4, 11px);
  font-size: 0;
  background: var(--color-surface-raised);
  background-color: transparent;
  box-shadow: var(--shadow-2), var(--shadow-3);
  box-shadow: var(--occlusion-2);
  box-shadow: var(--highlight-ambient);
  box-shadow: var(--shade-key);
  box-shadow: none;
}
`,
    })
    expect(findings).toEqual([])
  })

  it('裸字号报错并给出行号、列号与修法', async () => {
    const findings = await run({ 'packs/a.css': '.pack {\n  font-size: 11px;\n}\n' })

    expect(findings).toEqual([
      {
        ruleId: 'core/tokens',
        level: 'error',
        file: 'packs/a.css',
        line: 2,
        column: 3,
        message: 'font-size 必须使用 token 变量，不能写成 11px',
        hint: '改用 var(--fs-N)；确属光学微调时登记 allow',
      },
    ])
  })

  it('多行裸阴影整体报一条', async () => {
    const findings = await run({
      'packs/a.css': `.pack {
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.12),
    0px 2px 8px rgba(0, 0, 0, 0.08);
}
`,
    })

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      ruleId: 'core/tokens',
      line: 2,
      message: 'box-shadow 必须整体使用 token 变量，不能写字面阴影',
      hint: '改用 var(--shadow-N) / var(--occlusion-N) 或 none',
    })
  })

  it('复合阴影夹裸值报错', async () => {
    const findings = await run({ 'packs/a.css': 'box-shadow: var(--shadow-2), 0 0 0 1px #000;\n' })
    expect(findings[0]?.message).toBe('box-shadow 必须整体使用 token 变量，不能写字面阴影')
  })

  it('裸背景色报错，但 url() 与 token 变量放行', async () => {
    const findings = await run({
      'packs/a.css': `.pack {
  background-color: #ffffff;
  background-color: #FFF;
  background: url("https://example.com/a.png");
  background: var(--color-tone-primary-solid-fill-rest);
}
`,
    })

    expect(findings.map((finding) => finding.line)).toEqual([2, 3])
  })

  it('颜色函数按字面值处理，var() 组成的颜色函数放行', async () => {
    const findings = await run({
      'packs/a.css': `.pack {
  background-color: rgb(255 255 255);
  background: rgb(var(--shadow-color-rgb) / 0.04);
}
`,
    })

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      line: 2,
      message: '背景色必须使用 token 变量，不能写成 rgb(255 255 255)',
    })
  })

  it('未登记的字号 / 阴影 / 遮蔽档位报错并列出可用档位', async () => {
    const findings = await run({
      'packs/a.css': 'font-size: var(--fs-10);\nbox-shadow: var(--shadow-5);\nbox-shadow: var(--occlusion-9);\n',
    })

    expect(findings).toHaveLength(3)
    expect(findings[0]).toMatchObject({
      message: '未登记的档位：--fs-10',
      hint: 'fs 允许：--fs-1 / --fs-2 / --fs-3 / --fs-4 / --fs-5 / --fs-6 / --fs-7 / --fs-8 / --fs-9',
    })
    expect(findings[1]).toMatchObject({
      message: '未登记的档位：--shadow-5',
      hint: 'shadow 允许：--shadow-1 / --shadow-2 / --shadow-3 / --shadow-4',
    })
    expect(findings[2]).toMatchObject({
      message: '未登记的档位：--occlusion-9',
      hint: 'occlusion 允许：--occlusion-1 / --occlusion-2 / --occlusion-3 / --occlusion-4',
    })
  })

  it('字号引用已导出但非 fs 的档位时报错', async () => {
    const findings = await run({ 'packs/a.css': 'font-size: var(--space-6);\n' })
    expect(findings[0]).toMatchObject({
      message: 'font-size 不能引用 --space-6；应使用 fs 档位',
      hint: '改用 var(--fs-N)',
    })
  })

  it('阴影引用已导出但非光影档位时报错', async () => {
    const findings = await run({ 'packs/a.css': 'box-shadow: var(--space-6);\n' })
    expect(findings[0]).toMatchObject({
      message: 'box-shadow 不能引用 --space-6；应使用 shadow 或 occlusion 档位',
      hint: '改用 var(--shadow-N) / var(--occlusion-N)',
    })
  })

  it('未导出的光影变量按组合放行', async () => {
    const findings = await run({
      'packs/a.css': 'box-shadow: var(--highlight-key), var(--shade-key);\n',
    })
    expect(findings).toEqual([])
  })

  it('allow 按文件与取值放行，未命中仍报错', async () => {
    const options = { allow: [{ pattern: '^2px$', files: ['packs/optical/**'], reason: '光学描边' }] }

    const allowed = await run({ 'packs/optical/a.css': 'font-size: 2px;\n' }, options)
    expect(allowed).toEqual([])

    const denied = await run({ 'packs/a.css': 'font-size: 2px;\n' }, options)
    expect(denied).toHaveLength(1)
  })

  it('allow 自动锚定整个声明值，不做子串匹配', async () => {
    const options = { allow: [{ pattern: '2px', reason: '光学描边' }] }

    expect(await run({ 'packs/a.css': 'font-size: 2px;\n' }, options)).toEqual([])
    expect(await run({ 'packs/a.css': 'font-size: 12px;\n' }, options)).toHaveLength(1)
  })

  it('allow 缺少 reason 按配置错误处理', async () => {
    await expectConfigError(
      { 'packs/a.css': 'font-size: 2px;\n' },
      { allow: [{ pattern: '^2px$' }] },
      'tokens.allow[0].reason 必须是非空字符串',
    )
  })

  it('manifest 缺失、结构异常或缺少 tiers 时给出可见诊断', async () => {
    await expectConfigError(
      { 'packs/a.css': 'font-size: 11px;\n' },
      { manifest: 'nope.json' },
      '找不到 manifest：nope.json',
    )
    await expectConfigError({ 'packs/a.css': 'font-size: 11px;\n' }, {}, 'manifest 无法解析：kernel.json', '{')
    await expectConfigError(
      { 'packs/a.css': 'font-size: 11px;\n' },
      {},
      'manifest 缺少 tiers；需要 core 1.0+ 的 kernel.json',
      '{}',
    )
    await expectConfigError({ 'packs/a.css': 'font-size: 11px;\n' }, {}, 'manifest.tiers 不能为空', '{"tiers":{}}')
    await expectConfigError(
      { 'packs/a.css': 'font-size: 11px;\n' },
      {},
      'manifest.tiers.fs 必须是字符串数组',
      '{"tiers":{"fs":"fs.1"}}',
    )
    await expectConfigError(
      { 'packs/a.css': 'font-size: 11px;\n' },
      {},
      'manifest.tiers.fs 不能为空',
      '{"tiers":{"fs":[]}}',
    )
  })

  it('classes 只启用指定类别，空数组不检查', async () => {
    const onlyFs = await run(
      {
        'packs/a.css': 'font-size: 11px;\nbackground: #ffffff;\nbox-shadow: 0 1px 2px #000;\n',
      },
      { classes: ['fs'] },
    )
    expect(onlyFs).toHaveLength(1)
    expect(onlyFs[0]?.message).toContain('font-size')

    const none = await run(
      {
        'packs/a.css': 'font-size: 11px;\nbackground: #ffffff;\nbox-shadow: 0 1px 2px #000;\n',
      },
      { classes: [] },
    )
    expect(none).toEqual([])
  })

  it('不存在或暂不支持的类别按配置错误处理', async () => {
    await expectConfigError(
      { 'packs/a.css': 'font-size: 11px;\n' },
      { classes: ['blur'] },
      'tokens.classes 含未导出的类别：blur（可用：fs / motion / occlusion / radius / shadow / space / surface）',
    )
    await expectConfigError(
      { 'packs/a.css': 'font-size: 11px;\n' },
      { classes: ['space'] },
      'tokens.classes 暂不支持类别：space（已支持：fs / surface / shadow）',
    )
  })

  it('!important 不影响判据', async () => {
    expect(await run({ 'packs/a.css': 'font-size: var(--fs-4) !important;\n' })).toEqual([])
    expect(await run({ 'packs/a.css': 'font-size: 11px !important;\n' })).toHaveLength(1)
  })

  it('只扫描样式文件，注释、字符串与 scope 不误报', async () => {
    expect(await run({ 'src/a.ts': 'font-size: 11px;\n' })).toEqual([])
    expect(await run({ 'packs/a.css': '/* font-size: 11px; */\n.pack { content: "font-size: 11px"; }\n' })).toEqual([])
    expect(
      await run({ 'packs/a.scss': '// font-size: 11px;\n.pack { background: url(http://example.com/a.png); }\n' }),
    ).toEqual([])
    expect(await run({ 'other/a.css': 'font-size: 11px;\n' }, { scope: ['packs/**'] })).toEqual([])
  })

  it('配置错误使用 RuleConfigError，不依赖 checks 的错误类', async () => {
    const error = await run({ 'packs/a.css': 'font-size: 11px;\n' }, { manifest: 'nope.json' }).catch(
      (reason: unknown) => reason,
    )
    expect(error).toBeInstanceOf(RuleConfigError)
    expect((error as RuleConfigError).code).toBe('CONFIG')
  })
})
