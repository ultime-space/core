import type { Bounds, PathCommand, PathSample, Point, SampleOptions } from './types'

const EPS = 1e-9

const finite = (value: number, field: string): number => {
  if (!Number.isFinite(value)) throw new RangeError(`${field} 必须是有限数字`)
  return value
}

const normalize = (x: number, y: number): Point => {
  const length = Math.hypot(x, y)
  if (length < EPS) return { x: 1, y: 0 }
  return { x: x / length, y: y / length }
}

const normalOf = (tangent: Point): Point => ({ x: -tangent.y, y: tangent.x })

const samePoint = (a: Point, b: Point): boolean => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

interface ArcGeometry {
  cx: number
  cy: number
  startAngle: number
  delta: number
  radius: number
}

/** 圆形弧的圆心 / 起角 / 扫角；只支持 rx === ry、rotation = 0。 */
function arcGeometry(from: Point, command: Extract<PathCommand, { type: 'A' }>): ArcGeometry {
  const radius = command.rx
  if (Math.abs(command.rx - command.ry) > EPS || command.rotation !== 0) {
    throw new RangeError('samplePath 只支持圆形弧（rx === ry 且 rotation === 0）')
  }
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('圆弧半径必须是正数')

  const dx = (from.x - command.to.x) / 2
  const dy = (from.y - command.to.y) / 2
  const chord = Math.hypot(dx, dy)
  if (chord < EPS) throw new RangeError('samplePath 不支持起终点重合的圆弧')
  if (chord > radius + EPS) throw new RangeError('圆弧半径小于半弦长')

  const factor = chord < EPS ? 0 : Math.sqrt(Math.max(0, radius * radius - chord * chord)) / chord
  const sign = command.largeArc === command.sweep ? -1 : 1
  const cx = sign * factor * dy + (from.x + command.to.x) / 2
  const cy = sign * factor * -dx + (from.y + command.to.y) / 2

  const startAngle = Math.atan2(from.y - cy, from.x - cx)
  const endAngle = Math.atan2(command.to.y - cy, command.to.x - cx)
  let delta = endAngle - startAngle
  if (command.sweep && delta < 0) delta += Math.PI * 2
  if (!command.sweep && delta > 0) delta -= Math.PI * 2
  if (command.largeArc && Math.abs(delta) < Math.PI) delta += delta > 0 ? Math.PI * 2 : -Math.PI * 2
  if (!command.largeArc && Math.abs(delta) > Math.PI) delta -= delta > 0 ? Math.PI * 2 : -Math.PI * 2

  return { cx, cy, startAngle, delta, radius }
}

/**
 * 采样路径命令：返回点、累计弧长、切向、法向与曲率。
 * 弧长按采样折线累计；圆弧解析采样，曲线用三次贝塞尔求导。
 */
export function samplePath(commands: PathCommand[], options: SampleOptions = {}): PathSample[] {
  const steps = options.steps ?? 32
  if (!Number.isInteger(steps) || steps < 1) throw new RangeError('steps 必须是正整数')

  const samples: PathSample[] = []
  let current: Point = { x: 0, y: 0 }
  let subpathStart: Point | null = null
  let distance = 0

  const push = (point: Point, tangent: Point, curvature: number, delta: number): void => {
    const last = samples[samples.length - 1]
    if (last && samePoint(last.point, point)) return
    distance += delta
    samples.push({ point, distance, tangent, normal: normalOf(tangent), curvature })
  }

  const sampleLine = (from: Point, to: Point): void => {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.hypot(dx, dy)
    if (length < EPS) return
    const tangent = { x: dx / length, y: dy / length }
    const step = length / steps
    for (let i = 0; i <= steps; i++) {
      const u = i / steps
      push({ x: from.x + dx * u, y: from.y + dy * u }, tangent, 0, i === 0 ? 0 : step)
    }
  }

  const sampleCubic = (from: Point, c1: Point, c2: Point, to: Point): void => {
    let previous = from
    for (let i = 0; i <= steps; i++) {
      const u = i / steps
      const v = 1 - u
      const point: Point = {
        x: v * v * v * from.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u * u * u * to.x,
        y: v * v * v * from.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u * u * u * to.y,
      }
      const d1 = {
        x: 3 * v * v * (c1.x - from.x) + 6 * v * u * (c2.x - c1.x) + 3 * u * u * (to.x - c2.x),
        y: 3 * v * v * (c1.y - from.y) + 6 * v * u * (c2.y - c1.y) + 3 * u * u * (to.y - c2.y),
      }
      const d2 = {
        x: 6 * v * (c2.x - 2 * c1.x + from.x) + 6 * u * (to.x - 2 * c2.x + c1.x),
        y: 6 * v * (c2.y - 2 * c1.y + from.y) + 6 * u * (to.y - 2 * c2.y + c1.y),
      }
      const speed = Math.hypot(d1.x, d1.y)
      const curvature = speed < EPS ? 0 : Math.abs(d1.x * d2.y - d1.y * d2.x) / speed ** 3
      const delta = i === 0 ? 0 : Math.hypot(point.x - previous.x, point.y - previous.y)
      push(point, normalize(d1.x, d1.y), curvature, delta)
      previous = point
    }
  }

  const sampleArc = (from: Point, command: Extract<PathCommand, { type: 'A' }>): void => {
    const arc = arcGeometry(from, command)
    const step = (Math.abs(arc.delta) * arc.radius) / steps
    for (let i = 0; i <= steps; i++) {
      const angle = arc.startAngle + (arc.delta * i) / steps
      const point = {
        x: arc.cx + arc.radius * Math.cos(angle),
        y: arc.cy + arc.radius * Math.sin(angle),
      }
      const direction = arc.delta >= 0 ? 1 : -1
      const tangent = normalize(-Math.sin(angle) * direction, Math.cos(angle) * direction)
      push(point, tangent, 1 / arc.radius, i === 0 ? 0 : step)
    }
  }

  for (const command of commands) {
    if (command.type === 'M') {
      finite(command.to.x, 'path x')
      finite(command.to.y, 'path y')
      current = command.to
      subpathStart = command.to
      continue
    }
    if (command.type === 'L') {
      finite(command.to.x, 'path x')
      finite(command.to.y, 'path y')
      sampleLine(current, command.to)
      current = command.to
      continue
    }
    if (command.type === 'C') {
      sampleCubic(current, command.c1, command.c2, command.to)
      current = command.to
      continue
    }
    if (command.type === 'A') {
      sampleArc(current, command)
      current = command.to
      continue
    }
    if (subpathStart && !samePoint(current, subpathStart)) {
      sampleLine(current, subpathStart)
      current = subpathStart
    }
  }

  return samples
}

/** 路径长度（采样折线；默认步长足够设计计算使用）。 */
export function pathLength(commands: PathCommand[], options: SampleOptions = {}): number {
  const samples = samplePath(commands, { steps: options.steps ?? 64 })
  return samples[samples.length - 1]?.distance ?? 0
}

/** 路径包围盒（按采样点计算；默认步长足够设计计算使用）。 */
export function pathBounds(commands: PathCommand[], options: SampleOptions = {}): Bounds {
  const samples = samplePath(commands, { steps: options.steps ?? 64 })
  if (samples.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const sample of samples) {
    minX = Math.min(minX, sample.point.x)
    minY = Math.min(minY, sample.point.y)
    maxX = Math.max(maxX, sample.point.x)
    maxY = Math.max(maxY, sample.point.y)
  }
  return { minX, minY, maxX, maxY }
}
