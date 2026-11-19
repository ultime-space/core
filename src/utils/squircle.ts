import type { CornerGeometry, CornerSegment, PathCommand, Point, SquircleOptions } from './types'

type Vec = [number, number]

const vec = (value: Point): Vec => [value.x, value.y]
const point = (value: Vec): Point => ({ x: value[0], y: value[1] })

const finite = (value: number, field: string): number => {
  if (!Number.isFinite(value)) throw new RangeError(`${field} 必须是有限数字`)
  return value
}

const positive = (value: number, field: string): number => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${field} 必须是正数`)
  return value
}

const clampSmoothing = (value: number | undefined): number => {
  const s = value ?? 0
  finite(s, 'smoothing')
  return Math.max(0, Math.min(1, s))
}

/** 三次贝塞尔取点。 */
const bez = (p0: Vec, c1: Vec, c2: Vec, p1: Vec, u: number): Vec => {
  const v = 1 - u
  const a = v * v * v
  const b = 3 * v * v * u
  const c = 3 * v * u * u
  const d = u * u * u
  return [a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]]
}

/** 三次贝塞尔在端点处的曲率（t = 0 / 1）。 */
const bezKappa = (p0: Vec, c1: Vec, c2: Vec, p1: Vec, t: 0 | 1): number => {
  const d1 = t === 0 ? [3 * (c1[0] - p0[0]), 3 * (c1[1] - p0[1])] : [3 * (p1[0] - c2[0]), 3 * (p1[1] - c2[1])]
  const d2 =
    t === 0
      ? [6 * (p0[0] - 2 * c1[0] + c2[0]), 6 * (p0[1] - 2 * c1[1] + c2[1])]
      : [6 * (c1[0] - 2 * c2[0] + p1[0]), 6 * (c1[1] - 2 * c2[1] + p1[1])]
  const speed = Math.hypot(d1[0], d1[1])
  if (speed === 0) return 0
  return Math.abs(d1[0] * d2[1] - d1[1] * d2[0]) / speed ** 3
}

/**
 * 算一个连续曲率角（角局部坐标：起点 (0,0)、切向 +x；终点 (size,size)、切向 +y）。
 *
 * 模型：曲率沿弧长按 smoothstep 从 0 → 1/r → 0，用三段表达：
 * ① 三次贝塞尔（曲率 ramp 0 → 1/r）
 * ② 精确圆弧（恒定曲率段）
 * ③ 三次贝塞尔（曲率 ramp 1/r → 0）
 * `smoothing = 0` 时退化为一条精确圆弧（等同 `border-radius`）。
 */
export function cornerGeometry(radius: number, smoothing = 0): CornerGeometry {
  positive(radius, 'radius')
  const s = clampSmoothing(smoothing)
  const k0 = 1 / radius
  const arc = (Math.PI / 2) * radius
  const m = s * arc
  const total = arc + m

  const smoothstep = (u: number) => u * u * (3 - 2 * u)
  const kappa = (a: number) =>
    m < 1e-9 ? k0 : a < m ? k0 * smoothstep(a / m) : a > total - m ? k0 * smoothstep((total - a) / m) : k0

  /* 细积分得到弧长 → 点/切向的查询表；端点精度足以支撑 2 位小数输出。 */
  const N = 16384
  const dA = total / N
  const xs = [0]
  const ys = [0]
  const ths = [0]
  let th = 0
  let x = 0
  let y = 0
  for (let i = 1; i <= N; i++) {
    th += kappa((i - 0.5) * dA) * dA
    x += Math.cos(th) * dA
    y += Math.sin(th) * dA
    xs.push(x)
    ys.push(y)
    ths.push(th)
  }
  const at = (a: number) => {
    const t = Math.min(N, Math.max(0, a / dA))
    const i = Math.floor(t)
    const f = t - i
    const j = Math.min(N, i + 1)
    return {
      x: xs[i] + (xs[j] - xs[i]) * f,
      y: ys[i] + (ys[j] - ys[i]) * f,
      th: ths[i] + (ths[j] - ths[i]) * f,
    }
  }

  /* 一段 ramp（起点 κ=0、终点 κ=1/r）拟合成一条三次贝塞尔：
     C2 取两条切向线的交点（该端曲率恰为 0）；再解 C1 的距离，使另一端曲率恰为 1/r。 */
  let maxError = 0
  const fitRamp = (a0: number, a1: number): Extract<CornerSegment, { type: 'C' }> => {
    const L = a1 - a0
    const P0 = at(a0)
    const P1 = at(a1)
    const t0: Vec = [Math.cos(P0.th), Math.sin(P0.th)]
    const t1: Vec = [Math.cos(P1.th), Math.sin(P1.th)]
    const Dx = P1.x - P0.x
    const Dy = P1.y - P0.y
    const det = t0[0] * t1[1] - t0[1] * t1[0]
    const C2: Vec =
      Math.abs(det) < 1e-12
        ? [P1.x - t1[0] * (L / 3), P1.y - t1[1] * (L / 3)]
        : [P0.x + t0[0] * ((Dx * t1[1] - Dy * t1[0]) / det), P0.y + t0[1] * ((Dx * t1[1] - Dy * t1[0]) / det)]

    const kEnd = (h: number) => bezKappa([P0.x, P0.y], [P0.x + t0[0] * h, P0.y + t0[1] * h], C2, [P1.x, P1.y], 1)
    let h = L / 3
    let prevH = L * 0.02
    let prev = kEnd(prevH) - k0
    for (let i = 1; i <= 200; i++) {
      const cur = (L * 1.6 * i) / 200
      const v = kEnd(cur) - k0
      if (prev * v <= 0) {
        let lo = prevH
        let hi = cur
        for (let k = 0; k < 60; k++) {
          const mid = (lo + hi) / 2
          if ((kEnd(lo) - k0) * (kEnd(mid) - k0) <= 0) hi = mid
          else lo = mid
        }
        h = (lo + hi) / 2
        break
      }
      if (Math.abs(v) < Math.abs(prev)) h = cur
      prev = v
      prevH = cur
    }

    const C1: Vec = [P0.x + t0[0] * h, P0.y + t0[1] * h]
    const truth: Vec[] = []
    for (let k = 0; k <= 256; k++) {
      const q = at(a0 + (L * k) / 256)
      truth.push([q.x, q.y])
    }
    for (let k = 0; k <= 32; k++) {
      const b = bez([P0.x, P0.y], C1, C2, [P1.x, P1.y], k / 32)
      let m2 = Infinity
      for (const t of truth) m2 = Math.min(m2, (b[0] - t[0]) ** 2 + (b[1] - t[1]) ** 2)
      maxError = Math.max(maxError, Math.sqrt(m2))
    }
    return { type: 'C', c1: point(C1), c2: point(C2), to: point([P1.x, P1.y]) }
  }

  const D = (xs[N] + ys[N]) / 2
  const segments: CornerSegment[] = []
  if (m > 1e-9) {
    const ramp = fitRamp(0, m)
    const arcEnd = at(total - m)
    segments.push(ramp)
    segments.push({ type: 'A', radius, to: point([arcEnd.x, arcEnd.y]) })
    const mirror = ([px, py]: Vec): Vec => [D - py, D - px]
    segments.push({
      type: 'C',
      c1: point(mirror(vec(ramp.c2))),
      c2: point(mirror(vec(ramp.c1))),
      to: { x: D, y: D },
    })
  } else {
    segments.push({ type: 'A', radius, to: { x: D, y: D } })
  }

  return { size: D, segments, maxError }
}

const pathPoint = (value: Vec, origin: Point): Point => ({ x: value[0] + origin.x, y: value[1] + origin.y })

/**
 * 生成连续曲率圆角矩形的路径命令；不含字符串格式化，便于继续采样 / 变换。
 * 半径 0 = 矩形；`smoothing = 0` = 精确圆弧。
 */
export function squirclePathData(options: SquircleOptions): PathCommand[] {
  const width = positive(options.width, 'width')
  const height = positive(options.height, 'height')
  const radius = options.radius ?? 0
  if (!Number.isFinite(radius) || radius < 0) throw new RangeError('radius 必须是非负数')
  const origin = options.origin ?? { x: 0, y: 0 }
  finite(origin.x, 'origin.x')
  finite(origin.y, 'origin.y')

  if (radius === 0) {
    return [
      { type: 'M', to: pathPoint([0, 0], origin) },
      { type: 'L', to: pathPoint([width, 0], origin) },
      { type: 'L', to: pathPoint([width, height], origin) },
      { type: 'L', to: pathPoint([0, height], origin) },
      { type: 'Z' },
    ]
  }

  const corner = cornerGeometry(radius, options.smoothing ?? 0)
  const D = corner.size
  if (D > Math.min(width, height) / 2 + 1e-9) {
    throw new RangeError('radius 与 smoothing 超出可用角宽；请减小 radius 或 smoothing')
  }

  const commands: PathCommand[] = []
  const move = (x: number, y: number) => commands.push({ type: 'M', to: pathPoint([x, y], origin) })
  const line = (x: number, y: number) => commands.push({ type: 'L', to: pathPoint([x, y], origin) })
  const transforms: Array<(value: Vec) => Vec> = [
    ([px, py]) => [width - D + px, py],
    ([px, py]) => [width - py, height - D + px],
    ([px, py]) => [D - px, height - py],
    ([px, py]) => [py, D - px],
  ]
  const emitCorner = (transform: (value: Vec) => Vec) => {
    for (const segment of corner.segments) {
      if (segment.type === 'C') {
        commands.push({
          type: 'C',
          c1: pathPoint(transform(vec(segment.c1)), origin),
          c2: pathPoint(transform(vec(segment.c2)), origin),
          to: pathPoint(transform(vec(segment.to)), origin),
        })
        continue
      }
      const to = pathPoint(transform(vec(segment.to)), origin)
      commands.push({
        type: 'A',
        rx: segment.radius,
        ry: segment.radius,
        rotation: 0,
        largeArc: false,
        sweep: true,
        to,
      })
    }
  }

  move(D, 0)
  line(width - D, 0)
  emitCorner(transforms[0]!)
  line(width, height - D)
  emitCorner(transforms[1]!)
  line(D, height)
  emitCorner(transforms[2]!)
  line(0, D)
  emitCorner(transforms[3]!)
  commands.push({ type: 'Z' })
  return commands
}

const formatNumber = (value: number, precision: number): string => {
  finite(value, 'path coordinate')
  const rounded = Number(value.toFixed(precision))
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

/** 路径命令 → SVG path 字符串；坐标按 precision 四舍五入并去掉尾零。 */
export function pathToString(commands: PathCommand[], precision = 2): string {
  if (!Number.isInteger(precision) || precision < 0 || precision > 6) {
    throw new RangeError('precision 必须是 0–6 的整数')
  }
  const n = (value: number) => formatNumber(value, precision)
  const p = (value: Point) => `${n(value.x)} ${n(value.y)}`
  return commands
    .map((command) => {
      if (command.type === 'M') return `M ${p(command.to)}`
      if (command.type === 'L') return `L ${p(command.to)}`
      if (command.type === 'C') return `C ${p(command.c1)} ${p(command.c2)} ${p(command.to)}`
      if (command.type === 'A') {
        return `A ${n(command.rx)} ${n(command.ry)} ${n(command.rotation)} ${command.largeArc ? 1 : 0} ${
          command.sweep ? 1 : 0
        } ${p(command.to)}`
      }
      return 'Z'
    })
    .join(' ')
}

/** 连续曲率圆角矩形的 SVG path 字符串。 */
export function squirclePath(options: SquircleOptions): string {
  return pathToString(squirclePathData(options), options.precision ?? 2)
}
