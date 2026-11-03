/**
 * oklch.ts — 感知明度刻度（OKLCH）
 * ---------------------------------------------------------------------------
 * sRGB ↔ OKLab / OKLCH、色域收敛、tone / chroma 工具。
 * 计算在 OKLCH，交付在 sRGB；产物里不出现 `oklch()` 字面量。
 */

import { clamp, parseHex, toHex } from './math'

const lin = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const gamma = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
const GAMUT_EPS = 1e-4

export interface Oklab {
  L: number
  a: number
  b: number
}

/** tone = L × 100；chroma = C；hue = 0–360。 */
export interface Oklch {
  tone: number
  chroma: number
  hue: number
}

export function hexToOklab(hex: string): Oklab {
  const [r, g, b] = parseHex(hex).map((v) => lin(v / 255))
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  }
}

export function oklabToSrgb01({ L, a, b }: Oklab): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3
  return [
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

const inGamut = ([r, g, b]: [number, number, number]): boolean =>
  r >= -GAMUT_EPS &&
  r <= 1 + GAMUT_EPS &&
  g >= -GAMUT_EPS &&
  g <= 1 + GAMUT_EPS &&
  b >= -GAMUT_EPS &&
  b <= 1 + GAMUT_EPS

export function toOklch(hex: string): Oklch {
  const { L, a, b } = hexToOklab(hex)
  const chroma = Math.hypot(a, b)
  let hue = (Math.atan2(b, a) * 180) / Math.PI
  if (hue < 0) hue += 360
  return { tone: L * 100, chroma, hue }
}

/** 该 tone / hue 在 sRGB 内的最大 chroma。 */
export function chromaMax(tone: number, hue: number): number {
  const l = clamp(tone / 100, 0, 1)
  const hr = (hue * Math.PI) / 180
  const at = (c: number) => oklabToSrgb01({ L: l, a: c * Math.cos(hr), b: c * Math.sin(hr) })
  let lo = 0
  let hi = 0.4
  if (inGamut(at(hi))) return hi
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(at(mid))) lo = mid
    else hi = mid
  }
  return lo
}

export function fromOklch(tone: number, chroma: number, hue: number): string {
  const l = clamp(tone / 100, 0, 1)
  const c = clamp(Math.min(chroma, chromaMax(tone, hue)), 0, 0.4)
  const hr = (hue * Math.PI) / 180
  const [r, g, b] = oklabToSrgb01({ L: l, a: c * Math.cos(hr), b: c * Math.sin(hr) })
  return toHex([r, g, b].map((v) => clamp(v, 0, 1) * 255))
}
