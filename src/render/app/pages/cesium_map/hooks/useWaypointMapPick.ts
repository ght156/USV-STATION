import { useEffect, useRef } from 'react'
import { Cesium } from '@render/lib/tianditu-cesium'

type Viewer = InstanceType<typeof Cesium.Viewer>

/** 航点编辑器打开时：Shift+左键单击将 WGS84 经纬度回传（天地图影像 + 椭球/地形/DEM 拾取，避免与普通左键转视角冲突）。 */
export function useWaypointMapPick(
  viewer: Viewer | null,
  viewerReady: boolean,
  editorOpen: boolean,
  onPick: (latitude: number, longitude: number) => void,
): void {
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    if (!viewerReady || !viewer || viewer.isDestroyed()) return
    if (!editorOpen) return

    const canvas = viewer.scene?.canvas
    if (!canvas) return

    const handler = new Cesium.ScreenSpaceEventHandler(canvas)

    const cb = (click: { position: InstanceType<(typeof Cesium)['Cartesian2']> }) => {
      try {
        let cartesian: any = undefined
        const ray = viewer.camera.getPickRay(click.position)

        // 1. globe.pick — 射线 vs 地形瓦片求交，不依赖深度缓冲，倾斜/缩放下最稳定
        if (ray)
          cartesian = viewer.scene.globe.pick(ray, viewer.scene)

        // 2. scene.pickPosition — 深度缓冲拾取（有 3D 模型时更准）
        if (!Cesium.defined(cartesian))
          cartesian = viewer.scene.pickPosition(click.position)

        // 3. camera.pickEllipsoid — 终极兜底，纯椭球体数学解
        if (!Cesium.defined(cartesian)) {
          cartesian = viewer.camera.pickEllipsoid(
            click.position,
            viewer.scene.globe.ellipsoid,
          )
        }

        if (!Cesium.defined(cartesian))
          return

        const c = Cesium.Cartographic.fromCartesian(cartesian)
        const lat = Cesium.Math.toDegrees(c.latitude)
        const lon = Cesium.Math.toDegrees(c.longitude)
        // height 清零：USV 在水面行驶，避免地形山体高度干扰 Nav2 目标点计算

        if (!Number.isFinite(lat) || !Number.isFinite(lon))
          return
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180)
          return

        onPickRef.current(lat, lon)
      }
      catch (e) {
        console.warn('[useWaypointMapPick]', e)
      }
    }

    handler.setInputAction(
      cb,
      Cesium.ScreenSpaceEventType.LEFT_CLICK,
      Cesium.KeyboardEventModifier.SHIFT,
    )

    return () => {
      handler.destroy()
    }
  }, [viewer, viewerReady, editorOpen])
}
