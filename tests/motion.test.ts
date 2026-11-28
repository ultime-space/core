import { describe, expect, it } from 'vite-plus/test'
import {
  MOTION_EVENTS,
  MOTION_PHASES,
  MOTION_STATES,
  equivalentVisual,
  phaseDirection,
  phasesFor,
  revealRadius,
  targetState,
} from '../src/motion/index'

describe('@ultime/core/motion · 纯契约', () => {
  it('动作落到唯一目标态', () => {
    expect(targetState('enter')).toBe(MOTION_STATES.ENTERED)
    expect(targetState('leave')).toBe(MOTION_STATES.EXITED)
  })

  it('一次动作产出成对的起始帧与目标帧', () => {
    expect(phasesFor('enter')).toEqual([MOTION_PHASES.ENTER_FROM, MOTION_PHASES.ENTER_TO])
    expect(phasesFor('leave')).toEqual([MOTION_PHASES.LEAVE_FROM, MOTION_PHASES.LEAVE_TO])
  })

  it('相位方向可判定，成对关系自反', () => {
    expect(phaseDirection(MOTION_PHASES.ENTER_TO)).toBe('enter')
    expect(phaseDirection(MOTION_PHASES.LEAVE_FROM)).toBe('leave')
    for (const phase of Object.values(MOTION_PHASES)) {
      expect(equivalentVisual(equivalentVisual(phase))).toBe(phase)
    }
    expect(equivalentVisual(MOTION_PHASES.ENTER_FROM)).toBe(MOTION_PHASES.LEAVE_TO)
  })

  it('事件名是跨产品契约，不带产品前缀', () => {
    expect(Object.values(MOTION_EVENTS)).toEqual(['motionstart', 'motionend', 'motioncancel'])
  })

  it('揭示半径覆盖视口最远角', () => {
    expect(revealRadius(0, 0, 300, 400)).toBe(500)
    expect(revealRadius(150, 200, 300, 400)).toBe(250)
  })
})
