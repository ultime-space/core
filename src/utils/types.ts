/** 平面坐标；单位由调用方决定（core 默认逻辑像素）。 */
export interface Point {
  x: number
  y: number
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** 角几何的一段：三次贝塞尔或精确圆弧（圆弧固定 90°、sweep=1）。 */
export type CornerSegment = { type: 'C'; c1: Point; c2: Point; to: Point } | { type: 'A'; radius: number; to: Point }

export interface CornerGeometry {
  /** 角在局部坐标系的边长：起点 (0,0)、终点 (size,size)。 */
  size: number
  /** 不含起点的段序列。 */
  segments: CornerSegment[]
  /** 贝塞尔拟合相对真曲线的最大位置误差（px）。 */
  maxError: number
}

/** 路径命令；圆弧仅支持圆形（`rx === ry` 且 `rotation === 0`）。 */
export type PathCommand =
  | { type: 'M'; to: Point }
  | { type: 'L'; to: Point }
  | { type: 'C'; c1: Point; c2: Point; to: Point }
  | {
      type: 'A'
      rx: number
      ry: number
      rotation: number
      largeArc: boolean
      sweep: boolean
      to: Point
    }
  | { type: 'Z' }

export interface SquircleOptions {
  width: number
  height: number
  /** 圆弧半径；`0` 退化为矩形。 */
  radius?: number
  /** 平滑度 0–1；`0` 退化为精确圆弧，默认 0。 */
  smoothing?: number
  /** 路径原点偏移，默认 (0,0)。 */
  origin?: Point
  /** 仅 `squirclePath` 使用的输出精度（小数位），默认 2。 */
  precision?: number
}

export interface SampleOptions {
  /** 每段采样区间数，默认 32；至少 1。 */
  steps?: number
}

export interface PathSample {
  point: Point
  /** 累计弧长（按采样折线计算）。 */
  distance: number
  /** 单位切向。 */
  tangent: Point
  /** 单位法向：切向逆时针旋转 90°。 */
  normal: Point
  /** 曲率（1/半径）；直线为 0。 */
  curvature: number
}
