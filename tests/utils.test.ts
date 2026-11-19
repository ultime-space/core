import { describe, expect, it } from 'vite-plus/test'
import {
  cornerGeometry,
  pathBounds,
  pathLength,
  pathToString,
  samplePath,
  squirclePath,
  squirclePathData,
  type PathCommand,
} from '../src/utils/index.ts'

const cornerCommands = (radius: number, smoothing: number): PathCommand[] => {
  const corner = cornerGeometry(radius, smoothing)
  return [
    { type: 'M', to: { x: 0, y: 0 } },
    ...corner.segments.map((segment): PathCommand =>
      segment.type === 'C'
        ? { type: 'C', c1: segment.c1, c2: segment.c2, to: segment.to }
        : {
            type: 'A',
            rx: segment.radius,
            ry: segment.radius,
            rotation: 0,
            largeArc: false,
            sweep: true,
            to: segment.to,
          },
    ),
  ]
}

describe('@ultime/core/utils · 连续曲率', () => {
  it('smoothing = 0 退化为精确圆弧', () => {
    const path = squirclePath({ width: 200, height: 120, radius: 20, smoothing: 0 })
    expect(path.startsWith('M 20 0')).toBe(true)
    expect(path.endsWith('Z')).toBe(true)
    expect(path).toContain('A 20 20')
    expect(path).not.toContain('C ')

    const corner = cornerGeometry(20, 0)
    expect(corner.size).toBeCloseTo(20, 6)
    expect(corner.maxError).toBe(0)
    expect(corner.segments).toHaveLength(1)
    expect(corner.segments[0]).toMatchObject({ type: 'A', radius: 20 })
  })

  it('smoothing > 0 使用两段贝塞尔 + 圆弧，角框不越界', () => {
    const options = { width: 200, height: 120, radius: 20, smoothing: 0.6 }
    const path = squirclePath(options)
    expect(path).toContain('C ')
    expect(path).toContain('A 20 20')

    const corner = cornerGeometry(20, 0.6)
    expect(corner.size).toBeGreaterThan(20)
    expect(corner.segments.map((segment) => segment.type)).toEqual(['C', 'A', 'C'])
    expect(corner.maxError).toBeLessThan(0.05)

    const bounds = pathBounds(squirclePathData(options))
    expect(bounds.minX).toBeGreaterThanOrEqual(-1e-6)
    expect(bounds.minY).toBeGreaterThanOrEqual(-1e-6)
    expect(bounds.maxX).toBeLessThanOrEqual(200 + 1e-6)
    expect(bounds.maxY).toBeLessThanOrEqual(120 + 1e-6)
    expect(bounds.maxX).toBeCloseTo(200, 3)
    expect(bounds.maxY).toBeCloseTo(120, 3)
  })

  it('radius = 0 生成矩形，origin 平移所有点', () => {
    const commands = squirclePathData({ width: 100, height: 50, radius: 0, origin: { x: 10, y: 20 } })
    expect(commands).toEqual([
      { type: 'M', to: { x: 10, y: 20 } },
      { type: 'L', to: { x: 110, y: 20 } },
      { type: 'L', to: { x: 110, y: 70 } },
      { type: 'L', to: { x: 10, y: 70 } },
      { type: 'Z' },
    ])
    expect(pathToString(commands)).toBe('M 10 20 L 110 20 L 110 70 L 10 70 Z')
  })

  it('smoothing 自动夹到 0–1，非法尺寸与半径报错', () => {
    expect(squirclePathData({ width: 100, height: 100, radius: 10, smoothing: 2 })).toEqual(
      squirclePathData({ width: 100, height: 100, radius: 10, smoothing: 1 }),
    )
    expect(squirclePathData({ width: 100, height: 100, radius: 10, smoothing: -1 })).toEqual(
      squirclePathData({ width: 100, height: 100, radius: 10, smoothing: 0 }),
    )

    expect(() => squirclePathData({ width: 0, height: 100 })).toThrow(/width/)
    expect(() => squirclePathData({ width: 100, height: 100, radius: -1 })).toThrow(/radius/)
    expect(() => squirclePathData({ width: 100, height: 100, radius: 50, smoothing: 0.6 })).toThrow(/角宽/)
    expect(() => squirclePath({ width: 100, height: 100, precision: 7 })).toThrow(/precision/)
  })

  it('接缝曲率连续：起点 / 终点为 0，中间达到 1/r', () => {
    const samples = samplePath(cornerCommands(20, 0.6), { steps: 64 })
    expect(samples.length).toBeGreaterThan(10)
    expect(samples[0]?.curvature).toBeCloseTo(0, 3)
    expect(samples[samples.length - 1]?.curvature).toBeCloseTo(0, 3)
    expect(Math.max(...samples.map((sample) => sample.curvature))).toBeCloseTo(1 / 20, 2)
  })

  it('路径长度与解析值一致（smoothing = 0）', () => {
    const commands = squirclePathData({ width: 200, height: 120, radius: 20, smoothing: 0 })
    const expected = 2 * (200 - 40) + 2 * (120 - 40) + 2 * Math.PI * 20
    expect(pathLength(commands)).toBeCloseTo(expected, 1)
  })

  it('采样返回单位切向、单位法向与单调弧长', () => {
    const options = { width: 200, height: 120, radius: 20, smoothing: 0.6 }
    const start = cornerGeometry(20, 0.6).size
    const samples = samplePath(squirclePathData(options))
    expect(samples.length).toBeGreaterThan(0)
    let previous = -1
    for (const sample of samples) {
      expect(Math.hypot(sample.tangent.x, sample.tangent.y)).toBeCloseTo(1, 6)
      expect(sample.tangent.x * sample.normal.x + sample.tangent.y * sample.normal.y).toBeCloseTo(0, 6)
      expect(sample.distance).toBeGreaterThanOrEqual(previous)
      previous = sample.distance
    }
    expect(samples[0]?.point.x).toBeCloseTo(start, 6)
    expect(samples[0]?.point.y).toBeCloseTo(0, 6)
    expect(samples[samples.length - 1]?.point.x).toBeCloseTo(start, 6)
    expect(samples[samples.length - 1]?.point.y).toBeCloseTo(0, 6)
  })

  it('确定性：同输入同输出', () => {
    const options = { width: 200, height: 120, radius: 20, smoothing: 0.6 }
    expect(squirclePath(options)).toBe(squirclePath(options))
    expect(samplePath(squirclePathData(options))).toEqual(samplePath(squirclePathData(options)))
  })

  it('samplePath 拒绝非法步长与非圆弧', () => {
    const commands = squirclePathData({ width: 100, height: 100, radius: 10 })
    expect(() => samplePath(commands, { steps: 0 })).toThrow(/steps/)
    expect(() =>
      samplePath([
        { type: 'M', to: { x: 0, y: 0 } },
        { type: 'A', rx: 10, ry: 5, rotation: 0, largeArc: false, sweep: true, to: { x: 10, y: 10 } },
      ]),
    ).toThrow(/圆形弧/)
  })
})
