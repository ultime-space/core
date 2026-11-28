/**
 * 动效契约：状态、相位、方向与事件的唯一命名真源。
 * 设计概念见 design-system/language/motion；这里只放可执行形式，零 DOM / IO / Node。
 */

export const MOTION_ATTRS = {
  STATE: 'data-state',
  PHASE: 'data-phase',
  FREEZE: 'data-motion',
} as const

export const MOTION_STATES = {
  ENTERED: 'entered',
  EXITED: 'exited',
} as const

export const MOTION_PHASES = {
  ENTER_FROM: 'enter-from',
  ENTER_TO: 'enter-to',
  LEAVE_FROM: 'leave-from',
  LEAVE_TO: 'leave-to',
} as const

export const MOTION_DIRECTIONS = {
  ENTER: 'enter',
  LEAVE: 'leave',
} as const

export const MOTION_EVENTS = {
  START: 'motionstart',
  END: 'motionend',
  CANCEL: 'motioncancel',
} as const

export type MotionState = (typeof MOTION_STATES)[keyof typeof MOTION_STATES]
export type MotionPhase = (typeof MOTION_PHASES)[keyof typeof MOTION_PHASES]
export type MotionDirection = (typeof MOTION_DIRECTIONS)[keyof typeof MOTION_DIRECTIONS]
export type MotionAction = 'enter' | 'leave'

export interface MotionEventDetail {
  phase: MotionDirection
}

/** 驱动接缝：官方实现、框架适配与第三方库都实现这个形状。 */
export interface MotionDriver {
  readonly id: string
  state(node: Element): MotionState
  isPresent(node: Element): boolean
  enter(node: Element, options?: { signal?: AbortSignal }): Promise<void>
  leave(node: Element, options?: { signal?: AbortSignal }): Promise<void>
  cancel(node: Element): void
  freeze(): () => void
  transaction<T>(run: () => T): T
  reduced(): boolean
}

export interface MotionDefinition {
  id: string
  apiVersion?: number
  create(deps: MotionDeps): MotionDriver
}

export interface MotionDeps {
  root: Element
  doc: Document
  stateAttr: string
  phaseAttr: string
  motionAttr: string
  limit: number
}
