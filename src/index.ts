/**
 * index.ts — core 公共入口
 * ---------------------------------------------------------------------------
 * 一个包、一棵树、一份快照：
 *   seed → buildCore → tree → exporters（CSS / JSON / DTCG）。
 * 语义表与组件层不在这个入口；core 只给档与生成参数。
 */

export * from './seed'
export * from './tree'
export * from './build'
export * from './contracts'
export * from './exporters'
export * from './version'
