import React from 'react'
import { MissionControlsProps } from '../types'
import './MissionControls.css'

export const MissionControls: React.FC<MissionControlsProps> = ({
  onRunMission,
  onCancelNavigation,
  isMissionRunning,
  isCancelNavigationSending = false,
  appliedWaypoints,
}) => {
  return (
    <div className="mission-controls">
      <div className="mission-controls__row">
        <button
          type="button"
          onClick={() => void onRunMission(appliedWaypoints)}
          disabled={isMissionRunning}
          className={`mission-controls__button mission-controls__button--start ${isMissionRunning ? 'mission-controls__button--running' : ''}`}
        >
          {isMissionRunning ? 'Mission Running…' : 'Start Mission'}
        </button>
        <button
          type="button"
          onClick={() => void onCancelNavigation()}
          disabled={isCancelNavigationSending}
          className="mission-controls__button mission-controls__button--cancel"
        >
          {isCancelNavigationSending ? 'Sending…' : 'Cancel Nav'}
        </button>
      </div>
      <p className="mission-controls__hint">
        Cancel stops the current waypoint mission (ROS). Then edit / Apply / Start Mission again.
      </p>
    </div>
  )
}
