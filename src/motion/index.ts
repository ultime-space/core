/**
 * `@ultime/core/motion`：动效契约与纯计算。
 * 零 DOM、零 IO、零 Node；可在构建脚本、Node 与浏览器运行。
 * 驱动实现由消费侧提供（drafter viewer 的 classic driver、kit 的框架适配等）。
 */
export { MOTION_ATTRS, MOTION_DIRECTIONS, MOTION_EVENTS, MOTION_PHASES, MOTION_STATES } from './contracts'
export type {
  MotionAction,
  MotionDefinition,
  MotionDeps,
  MotionDirection,
  MotionDriver,
  MotionEventDetail,
  InterruptDecision,
  InterruptInput,
  MotionPhase,
  MotionState,
} from './contracts'
export {
  equivalentVisual,
  interruptDecision,
  isStale,
  phaseDirection,
  phasesFor,
  revealRadius,
  targetState,
} from './derive'
