import { describe, expect, it } from 'vite-plus/test'

import { buildCore, buildManifest } from '../src/build'

const manifest = buildManifest(buildCore())

describe('core 1.0 · manifest tiers', () => {
  it('导出原子档位路径，不导出语义角色', () => {
    expect(manifest.tiers.fs).toContain('fs.1')
    expect(manifest.tiers.fs).toContain('fs.9')
    expect(manifest.tiers.fs).not.toContain('fs.10')
    expect(manifest.tiers.space).toHaveLength(18)
    expect(manifest.tiers).not.toHaveProperty('ink')
    expect(manifest.tiers).not.toHaveProperty('roles')
  })

  it('surface 只列层级原料，不列 block / 语义角色', () => {
    expect(manifest.tiers.surface).toContain('color.surface.canvas')
    expect(manifest.tiers.surface).toContain('color.surface.float')
    expect(manifest.tiers.surface).toContain('color.surface.inset')
    expect(manifest.tiers.surface).toContain('color.surface.raised')
    expect(manifest.tiers.surface).not.toContain('color.surface.block.base')
    expect(manifest.tiers.surface).not.toContain('surface.overlay')
  })

  it('manifest 只保留 schemaVersion，不再有 engineVersion', () => {
    expect(manifest.schemaVersion).toBe('7.0.0')
    expect(manifest).not.toHaveProperty('engineVersion')
  })
})
