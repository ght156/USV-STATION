import { Cesium } from '@render/lib/tianditu-cesium'
import { useEffect } from 'react'
import { useWaypointVisualizer } from './useWaypointVisualizer'
import { 
  ModelUpdaterProps, 
} from '../types'
import { DEFAULT_LOCATION, CESIUM_CONFIG } from '../constants'
import { handleHookError } from '../utils/errorHandler'
import { enuYawRadiansToCompassHeadingRadians } from '../utils/heading'

// USV model update hook
export const useUSVModelUpdater = ({
  viewer,
  usvModelRef,
  pathPositionRef,
  viewerReady,
  gpsData,
  imuData,
  navigationEnuYaw,
  waypoints,
  reachedWaypoints,
  currentTargetWaypoint,
}: ModelUpdaterProps) => {

  const hpRoll = new Cesium.HeadingPitchRoll()
  const fixedFrameTransform = Cesium.Transforms.localFrameToFixedFrameGenerator('north', 'west')

 // Waypoint visualization hook
  const { drawWaypoints } = useWaypointVisualizer(viewer)

  // Waypoint visual update
  useEffect(() => {
    if (viewerReady && viewer) {
      console.log('🎨 Updating waypoints:', waypoints.length, 'count, Reached:', reachedWaypoints.size, 'Target:', currentTargetWaypoint)
      try {
        drawWaypoints(waypoints, reachedWaypoints, currentTargetWaypoint)
      } catch (error) {
        handleHookError(error, 'useUSVModelUpdater - WaypointVisualizer')
      }
    }
  }, [waypoints, reachedWaypoints, currentTargetWaypoint, viewerReady, viewer, drawWaypoints])

  // Model and position update（高度优先用地形采样，对齐天地图 DEM / 原 Ion 地形思路）
  useEffect(() => {
    if (!viewerReady || !viewer || !gpsData || !imuData || !usvModelRef || !pathPositionRef) {
      return
    }

    let cancelled = false

    const longitude = gpsData.longitude || DEFAULT_LOCATION.longitude
    const latitude = gpsData.latitude || DEFAULT_LOCATION.latitude

    const fallbackAltitude =
      gpsData.altitude != null && Number.isFinite(gpsData.altitude)
        ? gpsData.altitude
        : DEFAULT_LOCATION.altitude

    const applyAtAltitude = (altitudeMeters: number) => {
      if (cancelled)
        return

      const newPosition = Cesium.Cartesian3.fromDegrees(longitude, latitude, altitudeMeters)

      hpRoll.heading =
        enuYawRadiansToCompassHeadingRadians(navigationEnuYaw) +
        CESIUM_CONFIG.MODEL_HEADING_BIAS_RAD
      hpRoll.pitch = -(imuData.pitch || 0)
      hpRoll.roll = (imuData.roll || 0)

      const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(
        newPosition,
        hpRoll,
        Cesium.Ellipsoid.WGS84,
        fixedFrameTransform,
      )

      if (usvModelRef.current) {
        Cesium.Matrix4.clone(modelMatrix, usvModelRef.current.modelMatrix)
      }

      pathPositionRef.current.addSample(Cesium.JulianDate.now(), newPosition)
    }

    ;(async () => {
      let altitudeMeters = fallbackAltitude

      if (CESIUM_CONFIG.SAMPLE_TERRAIN_FOR_ALTITUDE) {
        const tp = viewer.terrainProvider
        const isEllipsoidOnly =
          !tp || (tp as { constructor?: { name?: string } }).constructor?.name === 'EllipsoidTerrainProvider'

        if (tp && !isEllipsoidOnly && typeof Cesium.sampleTerrainMostDetailed === 'function') {
          try {
            const cartos = [Cesium.Cartographic.fromDegrees(longitude, latitude)]
            const sampled = await Cesium.sampleTerrainMostDetailed(tp, cartos)
            const h = sampled[0]?.height
            if (h != null && Number.isFinite(h)) {
              altitudeMeters = h + CESIUM_CONFIG.TERRAIN_HEIGHT_OFFSET_METERS
            }
          }
          catch {
            // 地形未就绪或非标准 TerrainProvider 时退回 GPS / 默认高度
          }
        }
      }

      applyAtAltitude(altitudeMeters)
    })()

    return () => {
      cancelled = true
    }
  }, [gpsData, imuData, navigationEnuYaw, viewerReady, viewer, usvModelRef, pathPositionRef])

  return {
    hpRoll,
    fixedFrameTransform
  }
}
