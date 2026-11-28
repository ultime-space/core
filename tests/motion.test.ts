import { describe, expect, it } from 'vite-plus/test'
import {
  MOTION_EVENTS,
  MOTION_PHASES,
  MOTION_STATES,
  equivalentVisual,
  interruptDecision,
  isStale,
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

describe('@ultime/core/motion · 可打断判定', () => {
  it('无在途相位时播动画，不派取消', () => {
    expect(interruptDecision({ current: null, next: 'enter', reduced: false })).toEqual({
      animate: true,
      notifyCancel: false,
      bump: true,
    })
  })

  it('同向在途不重复播，也不递增代数', () => {
    expect(interruptDecision({ current: MOTION_PHASES.ENTER_TO, next: 'enter', reduced: false })).toEqual({
      animate: false,
      notifyCancel: false,
      bump: false,
    })
  })

  it('反向在途先取消再接续', () => {
    expect(interruptDecision({ current: MOTION_PHASES.ENTER_TO, next: 'leave', reduced: false })).toEqual({
      animate: true,
      notifyCancel: true,
      bump: true,
    })
  })

  it('减少动效直接落位，不派取消（无在途时）', () => {
    expect(interruptDecision({ current: null, next: 'leave', reduced: true })).toEqual({
      animate: false,
      notifyCancel: false,
      bump: true,
    })
    expect(interruptDecision({ current: MOTION_PHASES.LEAVE_TO, next: 'enter', reduced: true })).toEqual({
      animate: false,
      notifyCancel: false,
      bump: true,
    })
  })

  it('代数判定旧轮是否失效', () => {
    expect(isStale(3, 4)).toBe(true)
    expect(isStale(4, 4)).toBe(false)
  })
})
