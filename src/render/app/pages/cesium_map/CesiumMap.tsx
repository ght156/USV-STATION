import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import PlaneService from './service/plane_service'
import './CesiumMap.css'

import { useCesiumViewer } from './hooks/useCesiumViewer'
import { useUSVData } from './hooks/useUSVData'
import { useWaypointTracker } from './hooks/useWaypointTracker'
import { useUSVModelUpdater } from './hooks/useUSVModelUpdater'
import { useMissionHandlers } from './hooks/useMissionHandlers'
import { useNav2PlanData } from './hooks/useNav2PlanData'
import { useNav2PlanVisualizer } from './hooks/useNav2PlanVisualizer'
import { useWaypointVisualizer } from './hooks/useWaypointVisualizer'

import {
  MissionControls,
  ExtraControls,
  DebugPanel,
  WaypointStatusPanel,
  VehicleStatusIndicator,
  FlightIndicator,
  Nav2PlanControls,
  WaypointEditorTrigger
} from './components'
import WaypointEditor from './WaypointEditor'

// Constants and types
import { ARRIVAL_THRESHOLD_METERS } from './constants'
import { enuYawRadiansToCompassHeadingRadians } from './utils/heading'
import { CesiumMapProps } from './types'
import type { RootState } from '../../store'
import { incrementByAmount } from '../../../hooks/HeadingIndicator_features'
import { setPendingWaypointFromMap } from '../../store/waypointsSlice'
import { openEditor, closeEditor } from '../../store/editorSlice'
import { useWaypointMapPick } from './hooks/useWaypointMapPick'

// Main CesiumMap component for Yildizusv telemetry visualization

const CesiumMap = (_props: CesiumMapProps) => {
  // Redux state - use applied waypoints for map visualization
  const appliedWaypoints = useSelector((state: RootState) => state.waypoints.appliedWaypoints)
  const waypointEditorOpen = useSelector((state: RootState) => state.editor.isOpen)
  const dispatch = useDispatch()

  // Services — useMemo 稳定引用，避免每次渲染重建导致定时器饥饿
  const service = useMemo(() => new PlaneService(), [])

  // MAVROS FCU connection state from /mavros/state (real boat only; returns defaults in sim)
  const [mavrosConnected, setMavrosConnected] = useState(false)
  useEffect(() => {
    let active = true
    const poll = async () => {
      try {
        const status = await service.getMavrosStatus()
        if (active && status) setMavrosConnected(status.connected)
      } catch { /* silently ignore */ }
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => { active = false; clearInterval(id) }
  }, [service])

  // Nav2 plan state for toggle functionality
  const [showNav2Plan, setShowNav2Plan] = useState(false)

  // Hooks - each handles its own responsibility
  const { viewer, usvModelRef, pathPositionRef, viewerReady } = useCesiumViewer('cesiumContainer')

  useWaypointMapPick(viewer, viewerReady, waypointEditorOpen, (latitude, longitude) => {
    dispatch(setPendingWaypointFromMap({ latitude, longitude }))
  })

  const {
    gpsData,
    imuData,
    odomData,
    linearX,
    angularZ,
    armedStatus,
    modeStatus
  } = useUSVData(service, viewerReady)

  const navigationEnuYaw = useMemo(() => {
    const oy = odomData?.yaw
    if (oy !== undefined && Number.isFinite(oy)) {
      return oy
    }
    return imuData?.yaw ?? 0
  }, [odomData?.yaw, imuData?.yaw])

  const { reachedWaypoints, currentTargetWaypoint, distanceToTarget } = useWaypointTracker(
    appliedWaypoints,
    gpsData,
    ARRIVAL_THRESHOLD_METERS
  )

  // Waypoint visualizer hook for proper animation and display
  const waypointVisualizer = useWaypointVisualizer(viewer)


  useUSVModelUpdater({
    viewer,
    usvModelRef,
    pathPositionRef,
    viewerReady,
    gpsData,
    imuData,
    odomData,
    navigationEnuYaw,
    waypoints: appliedWaypoints,
    reachedWaypoints,
    currentTargetWaypoint,
  })


  const {
    handleRunMission,
    handleRunMission2,
    handleCancelNavigation,
    isCancelNavigationSending,
    handleSaveColorCode,
    isMissionRunning,
    isMission2Running,
    colorCode,
    setColorCode,
    missionStatus,
    handleSaveWaypoints,
  } = useMissionHandlers(service)


  const { nav2PlanData, isPlanLoading, planError } = useNav2PlanData(service, viewerReady)

  useNav2PlanVisualizer({
    viewer,
    nav2PlanData,
    showPlan: showNav2Plan, // Dynamic showPlan state
    odomData,
    gpsData
  })

  // Nav2 plan toggle handler
  const handleNav2PlanToggle = () => {
    setShowNav2Plan(prev => !prev)
  }

  // Update waypoint visualization when waypoints or status changes
  useEffect(() => {
    if (waypointVisualizer && viewerReady) {
      waypointVisualizer.drawWaypoints(appliedWaypoints, reachedWaypoints, currentTargetWaypoint)
    }
  }, [appliedWaypoints, reachedWaypoints, currentTargetWaypoint, waypointVisualizer, viewerReady])

  // Orchestrator responsibility: coordinate data flow to Redux（航向：ENU yaw → 罗盘北顺时针）
  useEffect(() => {
    if (imuData && gpsData && linearX && angularZ) {
      const indicatorData = {
        heading: enuYawRadiansToCompassHeadingRadians(navigationEnuYaw),
        pitch: imuData.pitch || 0,
        roll: imuData.roll || 0,
        airSpeed: linearX.linear_x || 0,
        vario: angularZ.angular_z || 0,
        turn: angularZ.angular_z || 0,
        altitude: gpsData.altitude || 0,
        pressure: 1013.25
      };
      dispatch(incrementByAmount(indicatorData));
    }
  }, [imuData, gpsData, linearX, angularZ, dispatch, navigationEnuYaw]);

  return (
    <div className="cesium-container">
      <div id="cesiumContainer" className="cesium-viewer" />

      {/* ==================== 左侧统一 Sidebar ==================== */}
      <div className="gcs-left-sidebar">
        <MissionControls
          onRunMission={handleRunMission}
          onCancelNavigation={handleCancelNavigation}
          isMissionRunning={isMissionRunning}
          isCancelNavigationSending={isCancelNavigationSending}
          appliedWaypoints={appliedWaypoints}
          missionStatus={missionStatus}
        />

        <WaypointEditorTrigger onOpen={() => dispatch(openEditor())} />

        {waypointEditorOpen && (
          <WaypointEditor
            onClose={() => dispatch(closeEditor())}
            onSaveWaypoints={handleSaveWaypoints}
          />
        )}

        <ExtraControls
          onRunMission2={handleRunMission2}
          isMission2Running={isMission2Running}
          onSaveColorCode={handleSaveColorCode}
          colorCode={colorCode}
          setColorCode={setColorCode}
        />
      </div>

      {/* ==================== Debug / 右侧遥测 ==================== */}
      <DebugPanel
        isUpdating={true}
        viewerReady={viewerReady}
        gpsData={gpsData}
        odomData={odomData}
        linearX={linearX}
        angularZ={angularZ}
        reachedWaypoints={reachedWaypoints.size}
        totalWaypoints={appliedWaypoints.length}
        currentTargetWaypoint={currentTargetWaypoint + 1}
        distanceToTarget={distanceToTarget}
      />

      <WaypointStatusPanel
        waypoints={appliedWaypoints}
        currentTargetWaypoint={currentTargetWaypoint}
        distanceToTarget={distanceToTarget}
        reachedWaypoints={reachedWaypoints}
      />

      <VehicleStatusIndicator
        armedStatus={armedStatus}
        modeStatus={modeStatus}
        connected={mavrosConnected}
      />

      <FlightIndicator />

      <Nav2PlanControls
        showPlan={showNav2Plan}
        onTogglePlan={handleNav2PlanToggle}
        isPlanLoading={isPlanLoading}
        planError={planError}
        planData={nav2PlanData}
      />
    </div>
  )
}

export default CesiumMap
