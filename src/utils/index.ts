/**
 * `@ultime/core/utils`：与引擎无关的纯设计计算。
 * 零 IO、无 DOM / Node 依赖；可在 Node、浏览器与构建脚本中运行。
 */

export { cornerGeometry, pathToString, squirclePath, squirclePathData } from './squircle'
export { pathBounds, pathLength, samplePath } from './path'
export type {
  Bounds,
  CornerGeometry,
  CornerSegment,
  PathCommand,
  PathSample,
  Point,
  SampleOptions,
  SquircleOptions,
} from './types'
