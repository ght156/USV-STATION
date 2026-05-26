import { useState, useEffect, useCallback } from 'react'
import PlaneService from '../service/plane_service'
import { MissionHandlersReturn, MissionStatus, Waypoint } from '../types'
import { MESSAGES } from '../constants'
import { handleHookError } from '../utils/errorHandler'
import { useNotification } from '../services/notification.service'

// Hook for managing mission execution handlers and UI state
export const useMissionHandlers = (service: PlaneService): MissionHandlersReturn => {
  const { showSuccess, showError, showWarning } = useNotification()
  const [isMissionRunning, setIsMissionRunning] = useState(false)
  const [isMission2Running, setIsMission2Running] = useState(false)
  const [isCancelNavigationSending, setIsCancelNavigationSending] = useState(false)
  const [colorCode, setColorCode] = useState('')
  const [missionStatus, setMissionStatus] = useState<MissionStatus | null>(null)

  // Handle mission execution — sends waypoints directly in request body
  const handleRunMission = async (waypoints: Waypoint[]) => {
    if (!waypoints || waypoints.length === 0) {
      showWarning('No waypoints to start mission')
      return
    }
    setIsMissionRunning(true)
    try {
      const missionId = `frontend_${Date.now()}`
      const wps = waypoints.map(w => ({ latitude: w.latitude, longitude: w.longitude }))
      const result = await service.runMission(wps, missionId)
      if (result && result.status === "success") {
        showSuccess(MESSAGES.MISSION_SUCCESS)
      } else {
        showError(MESSAGES.MISSION_FAILED)
      }
    } catch (error) {
      handleHookError(error, 'useMissionHandlers - handleRunMission')
      showError(MESSAGES.MISSION_ERROR)
    } finally {
      setIsMissionRunning(false)
    }
  }

  // Handle second mission execution - runs color code publisher mission 
  const handleRunMission2 = async () => {
    setIsMission2Running(true)
    try {
      const result = await service.runMission2()
      if (result && result.status === "success") {
        showSuccess("Second mission started successfully!")
      } else {
        showError("Second mission could not be started!")
      }
    } catch (error) {
      handleHookError(error, 'useMissionHandlers - handleRunMission2')
      showError("Error occurred while running second mission!")
    } finally {
      setIsMission2Running(false)
    }
  }

  const handleCancelNavigation = async () => {
    setIsCancelNavigationSending(true)
    try {
      const result = await service.cancelNavigation()
      if (result && result.status === "success") {
        showSuccess(MESSAGES.CANCEL_NAV_SUCCESS)
      } else {
        showError(MESSAGES.CANCEL_NAV_FAILED)
      }
    }
    catch (error) {
      handleHookError(error, 'useMissionHandlers - handleCancelNavigation')
      showError(MESSAGES.CANCEL_NAV_FAILED)
    }
    finally {
      setIsCancelNavigationSending(false)
    }
  }

  // Handle color code saving via storage service
  const handleSaveColorCode = async () => {
    if (!colorCode.trim()) {
      showWarning(MESSAGES.COLOR_CODE_EMPTY)
      return
    }
    try {
      const result = await service.saveColorCode(colorCode)
      if (result && result.status === "success") {
        showSuccess(MESSAGES.COLOR_CODE_SUCCESS(result.file_path || ''))
        setColorCode('')
      } else {
        showError(MESSAGES.COLOR_CODE_FAILED)
      }
    } catch (error) {
      handleHookError(error, 'useMissionHandlers - handleSaveColorCode')
      showError("Error occurred while saving color code!")
    }
  }

  // Handle waypoint saving via storage service
  const handleSaveWaypoints = async (waypoints: Waypoint[]) => {
    if (waypoints.length === 0) {
      throw new Error('No waypoints to save found.')
    }
    
    try {
      const result = await service.saveWaypoints(waypoints)
      if (result && result.status === "success") {
        return result
      } else {
        throw new Error('Waypoints could not be saved.')
      }
    } catch (error) {
      handleHookError(error, 'useMissionHandlers - handleSaveWaypoints')
      throw error
    }
  }

  // Poll mission status from backend every 2s
  const fetchMissionStatus = useCallback(async () => {
    try {
      const status = await service.getMissionStatus()
      if (status) setMissionStatus(status)
    } catch {
      // silently ignore — backend may not be ready
    }
  }, [service])

  useEffect(() => {
    fetchMissionStatus()
    const interval = setInterval(fetchMissionStatus, 2000)
    return () => clearInterval(interval)
  }, [fetchMissionStatus])

  return {
    isMissionRunning,
    isMission2Running,
    isCancelNavigationSending,
    colorCode,
    setColorCode,
    handleRunMission,
    handleRunMission2,
    handleCancelNavigation,
    handleSaveColorCode,
    handleSaveWaypoints,
    missionStatus,
  }
}
