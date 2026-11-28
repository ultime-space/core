import { MOTION_DIRECTIONS, MOTION_PHASES, MOTION_STATES } from './contracts'
import type {
  InterruptDecision,
  InterruptInput,
  MotionAction,
  MotionDirection,
  MotionPhase,
  MotionState,
} from './contracts'

/** 动作的目标态：enter 落 entered，leave 落 exited。 */
export function targetState(action: MotionAction): MotionState {
  return action === MOTION_DIRECTIONS.ENTER ? MOTION_STATES.ENTERED : MOTION_STATES.EXITED
}

/** 一次动作的两帧相位，顺序为起始帧 → 目标帧。 */
export function phasesFor(action: MotionAction): readonly [MotionPhase, MotionPhase] {
  return action === MOTION_DIRECTIONS.ENTER
    ? [MOTION_PHASES.ENTER_FROM, MOTION_PHASES.ENTER_TO]
    : [MOTION_PHASES.LEAVE_FROM, MOTION_PHASES.LEAVE_TO]
}

/** 相位属于哪一段：取消与事件 detail 都用这个方向。 */
export function phaseDirection(phase: MotionPhase): MotionDirection {
  return phase === MOTION_PHASES.ENTER_FROM || phase === MOTION_PHASES.ENTER_TO
    ? MOTION_DIRECTIONS.ENTER
    : MOTION_DIRECTIONS.LEAVE
}

/** 成对关系：进入起点与离开终点是同一视觉面，反之亦然。 */
export function equivalentVisual(phase: MotionPhase): MotionPhase {
  return phase === MOTION_PHASES.ENTER_FROM
    ? MOTION_PHASES.LEAVE_TO
    : phase === MOTION_PHASES.LEAVE_TO
      ? MOTION_PHASES.ENTER_FROM
      : phase === MOTION_PHASES.ENTER_TO
        ? MOTION_PHASES.LEAVE_FROM
        : MOTION_PHASES.ENTER_TO
}

/** 圆形揭示半径：从交互点到视口最远角。 */
export function revealRadius(x: number, y: number, width: number, height: number): number {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y))
}

/**
 * 打断决策：同向在途不重复播；反向在途先取消再接续；减少动效一律直接落位。
 * 只做判断，不碰 DOM。
 */
export function interruptDecision(input: InterruptInput): InterruptDecision {
  if (input.reduced) return { animate: false, notifyCancel: false, bump: true }
  if (!input.current) return { animate: true, notifyCancel: false, bump: true }
  const inFlight = phaseDirection(input.current)
  if (inFlight === input.next) return { animate: false, notifyCancel: false, bump: false }
  return { animate: true, notifyCancel: true, bump: true }
}

/** 被取消的那一轮结算晚到时，用代数判断是否已失效。 */
export function isStale(generation: number, current: number): boolean {
  return generation !== current
}
