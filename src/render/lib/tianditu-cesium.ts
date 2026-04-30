import type * as CesiumTypes from 'cesium'

/** 天地图 CDN 注入的全局 `window.Cesium`（含 GeoTerrainProvider / Map 等扩展） */
export function getTiandituCesium(): CesiumTypes & Record<string, unknown> {
  const C = typeof window !== 'undefined'
    ? (window as unknown as { Cesium?: CesiumTypes }).Cesium
    : undefined
  if (!C) {
    throw new Error(
      '[Tianditu] window.Cesium 未加载。请在 src/render/index.html 中先于入口脚本引入天地图 CDN 的 Cesium.js 与 Cesium_ext_min.js。',
    )
  }
  return C as CesiumTypes & Record<string, unknown>
}

/** 与原先 `import * as Cesium from 'cesium'` 用法一致 */
export const Cesium = getTiandituCesium()
