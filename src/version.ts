/**
 * version.ts — 内核契约与引擎版本
 * ---------------------------------------------------------------------------
 * `SCHEMA_VERSION`：树 / 契约字段的兼容面；字段增删或语义变化时升主版本。
 * `ENGINE_VERSION`：派生实现版本；同 seed 同 schema 下结果应逐字节稳定。
 */

export const SCHEMA_VERSION = '6.0.0'
export const ENGINE_VERSION = '0.6.0'
