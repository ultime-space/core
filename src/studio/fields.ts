/**
 * fields.ts — 配置字段（手写少量旋钮，不从派生结果反推清单）
 * ---------------------------------------------------------------------------
 * 只暴露 seed 的稳定参数与配置器自己的选择 / 派生参数；颜色族、阴影档位、
 * 字阶不在这里逐项列出 —— 它们是派生结果，改 seed 后自动联动。
 */

import type { FieldSpec, GroupSpec } from '@ultime/studio'
import { NEUTRAL_RECIPE_NAMES } from '../model/color/ramp'

export const THEME_GROUPS: GroupSpec[] = [
  { key: 'color', label: '颜色 · seed', description: '主题锚点 / 中性配方 / 画布对称', order: 10 },
  { key: 'skeleton', label: '骨架 · 参数', description: '圆角基座、档数与字号基准', order: 20 },
  { key: 'light', label: '光影 · 方向与光色', description: '全局光源方向、仰角与光色', order: 30 },
  { key: 'motion', label: '动效 · 步长', description: '时长 / 循环 / 延迟 / 曲线参数', order: 40 },
  { key: 'output', label: '出口', description: '产哪些格式、写到哪个目录', order: 50 },
  { key: 'custom', label: '选择 · 定制', description: '选择类别 / 档位与参数化派生', order: 60 },
]

const seedPaths = {
  primaryHue: '/tokens/seed/color/primaryHue',
  chromaRatio: '/tokens/seed/color/chromaRatio',
  onSideLight: '/tokens/seed/color/onSide/light',
  onSideDark: '/tokens/seed/color/onSide/dark',
  neutralPreset: '/tokens/seed/color/neutral/preset',
  canvasSymmetry: '/tokens/seed/color/surface/canvasSymmetry',
  radiusBase: '/tokens/seed/skeleton/radius/base',
  radiusLevels: '/tokens/seed/skeleton/radius/levels',
  fontSizeBase: '/tokens/seed/skeleton/fontSize/base',
  azimuthAngle: '/tokens/seed/light/azimuthAngle',
  altitudeAngle: '/tokens/seed/light/altitudeAngle',
  durationUnit: '/tokens/seed/motion/duration/unit',
  durationCount: '/tokens/seed/motion/duration/count',
  easingT: '/tokens/seed/motion/easing/t',
}

const seedFields: FieldSpec[] = [
  { path: seedPaths.primaryHue, label: '主题色相', type: 'hue', group: 'color', hint: '彩度系数为 0 时只影响中性温' },
  {
    path: seedPaths.chromaRatio,
    label: '彩度系数',
    type: 'slider',
    group: 'color',
    min: 0,
    max: 1,
    step: 0.01,
    hint: '0 = 墨色主色（默认）；1 = 色域上限',
  },
  {
    path: seedPaths.onSideLight,
    label: '浅色模式前景方向',
    type: 'select',
    group: 'color',
    options: [
      { value: 'light', label: '浅字' },
      { value: 'dark', label: '深字' },
    ],
  },
  {
    path: seedPaths.onSideDark,
    label: '深色模式前景方向',
    type: 'select',
    group: 'color',
    options: [
      { value: 'light', label: '浅字' },
      { value: 'dark', label: '深字' },
    ],
  },
  {
    path: '/tokens/seed/color/modes',
    label: '启用模式',
    type: 'multi-select',
    group: 'color',
    options: [
      { value: 'light', label: '浅色' },
      { value: 'dark', label: '深色' },
    ],
    hint: '单侧项目只审启用侧',
  },
  {
    path: '/tokens/seed/color/solidTarget',
    label: '实心面前景目标',
    type: 'slider',
    group: 'color',
    min: 3,
    max: 7,
    step: 0.1,
    hint: '带字实心面的对比度目标；不达标只警告',
  },
  {
    path: seedPaths.neutralPreset,
    label: '中性配方',
    type: 'select',
    group: 'color',
    options: NEUTRAL_RECIPE_NAMES.map((name) => ({ value: name, label: name })),
  },
  {
    path: seedPaths.canvasSymmetry,
    label: '画布对称',
    type: 'slider',
    group: 'color',
    min: 1.15,
    max: 1.25,
    step: 0.01,
    hint: '两端画布到各自极点取同一对比度',
  },
  { path: seedPaths.radiusBase, label: '圆角基座', type: 'number', group: 'skeleton', min: 0, max: 16, unit: 'px' },
  { path: seedPaths.radiusLevels, label: '圆角档数', type: 'number', group: 'skeleton', min: 3, max: 12 },
  {
    path: seedPaths.fontSizeBase,
    label: '字号基准',
    type: 'number',
    group: 'skeleton',
    min: 8,
    max: 20,
    unit: 'px',
    hint: '全档整体平移；阶梯形状由 steps 整体替换',
  },
  {
    path: seedPaths.azimuthAngle,
    label: '光源方位',
    type: 'select',
    group: 'light',
    options: [
      { value: 0, label: '0° 正上' },
      { value: 45, label: '45° 右上' },
      { value: 315, label: '315° 左上' },
    ],
  },
  {
    path: seedPaths.altitudeAngle,
    label: '光源仰角',
    type: 'slider',
    group: 'light',
    min: 30,
    max: 75,
    step: 5,
    unit: '°',
    hint: '只影响影长，不进运行时',
  },
  {
    path: '/tokens/seed/light/lightColor',
    label: '主光色',
    type: 'color',
    group: 'light',
    optional: true,
    hint: '省略 = 纯白；只染 highlight.key',
  },
  {
    path: '/tokens/seed/light/ambientColor',
    label: '环境色',
    type: 'color',
    group: 'light',
    optional: true,
    hint: '省略 = 中性墨；染 ambient 高光、阴影 / 遮罩 / 暗侧',
  },
  {
    path: '/tokens/seed/light/ambientAlpha',
    label: '环境高光强度',
    type: 'slider',
    group: 'light',
    min: 0,
    max: 0.2,
    step: 0.002,
    hint: '方向边线的环境底',
  },
  {
    path: '/tokens/seed/light/key/light/highlight',
    label: '浅色受光边 α',
    type: 'slider',
    group: 'light',
    min: 0,
    max: 0.5,
    step: 0.01,
    advanced: true,
  },
  {
    path: '/tokens/seed/light/key/light/shade',
    label: '浅色暗边 α',
    type: 'slider',
    group: 'light',
    min: 0,
    max: 0.5,
    step: 0.01,
    advanced: true,
  },
  {
    path: '/tokens/seed/light/key/dark/highlight',
    label: '深色受光边 α',
    type: 'slider',
    group: 'light',
    min: 0,
    max: 0.5,
    step: 0.01,
    advanced: true,
  },
  {
    path: '/tokens/seed/light/key/dark/shade',
    label: '深色暗边 α',
    type: 'slider',
    group: 'light',
    min: 0,
    max: 0.5,
    step: 0.01,
    advanced: true,
  },
  { path: seedPaths.durationUnit, label: '时长步长', type: 'number', group: 'motion', min: 50, max: 200, unit: 'ms' },
  { path: seedPaths.durationCount, label: '时长档数', type: 'number', group: 'motion', min: 3, max: 10 },
  {
    path: seedPaths.easingT,
    label: '曲线参数 t',
    type: 'slider',
    group: 'motion',
    min: 0.2,
    max: 0.8,
    step: 0.01,
    hint: '0.42 = CSS ease-in-out / Apple easeInEaseOut',
  },
]

const outputFields: FieldSpec[] = [
  {
    path: '/tokens/platforms',
    label: '出口格式',
    type: 'multi-select',
    group: 'output',
    options: [
      { value: 'css', label: 'CSS' },
      { value: 'json', label: 'JSON' },
      { value: 'dtcg', label: 'DTCG' },
    ],
  },
  { path: '/tokens/output', label: '输出目录', type: 'text', group: 'output', hint: '相对项目根；缺省 ultime-tokens' },
]

const customFields: FieldSpec[] = [
  {
    path: '/selection',
    label: '选择',
    type: 'custom',
    group: 'custom',
    optional: true,
    advanced: true,
    hint: '类别 / 档位；省略 = 全量。结构见 SelectionConfig',
  },
  {
    path: '/derivation/light/form',
    label: '光影形态',
    type: 'select',
    group: 'custom',
    optional: true,
    options: [
      { value: 'convex', label: '凸起（静态默认）' },
      { value: 'flat', label: '平面' },
      { value: 'concave', label: '凹陷' },
    ],
    hint: '按 solveLight 重算 highlight / shade；不写回 seed',
  },
]

export const THEME_FIELDS: FieldSpec[] = [...seedFields, ...outputFields, ...customFields]
