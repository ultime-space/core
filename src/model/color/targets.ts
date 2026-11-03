/**
 * targets.ts — 颜色合同目标（单一来源）
 * ---------------------------------------------------------------------------
 * derive 用它反解，合同用它核验；两处引用同一份，避免各写一套数字。
 */

/** 描边三档：对中性面的对比度目标。 */
export const LINE_TARGETS = { 1: 1.16, 2: 1.45, 3: 3.0 } as const

/** 面阶：面对画布的对比度目标。 */
export const SURFACE_TARGETS = { card: 1.1, overlay: 1.14, sunken: 1.07 } as const

/** 状态叠墨：在声明底上至少拉动多少。 */
export const STATE_TARGETS = { hover: 1.08, pressed: 1.12, disabled: 1.03 } as const

/** 中性墨四档：对声明底的对比度目标。 */
export const INK_TARGETS = { primary: 7.2, secondary: 6.0, tertiary: 5.0, disabled: 2.0 } as const

/** 禁用文字的最小可见度（对画布）。 */
export const DISABLED_TARGET = 2.0

/** 浅底三件套：soft 对画布 / border 对 soft / text 对 soft。 */
export const TONE_TARGETS = { soft: 1.1, border: 1.38, text: 6.0 } as const

/** `foreground` 对实心填充的目标。 */
export const FOREGROUND_TARGET = 4.5

export type LineStep = keyof typeof LINE_TARGETS
