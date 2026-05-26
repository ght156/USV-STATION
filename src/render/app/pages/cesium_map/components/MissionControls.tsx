import React from 'react'
import { MissionControlsProps } from '../types'
import './MissionControls.css'

export const MissionControls: React.FC<MissionControlsProps> = ({
  onRunMission,
  onCancelNavigation,
  isMissionRunning,
  isCancelNavigationSending = false,
  appliedWaypoints,
  missionStatus,
}) => {
  const state = missionStatus?.state ?? 'IDLE'
  const stateColors: Record<string, string> = {
    IDLE: '#666',
    RUNNING: '#238636',
    DISPATCHED: '#1f6feb',
    COMPLETED: '#2ea043',
    FAILED: '#da3633',
    CANCELLED: '#c08400',
  }

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
      <div className="mission-controls__status" style={{ marginTop: 10, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontWeight: 'bold' }}>State:</span>
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 3,
          background: stateColors[state] || '#666',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: 11,
        }}>
          {state}
        </span>
        {missionStatus?.mission_id && (
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
            #{missionStatus.mission_id.slice(-8)}
          </span>
        )}
      </div>
      {state === 'FAILED' && missionStatus?.last_error && (
        <div style={{ marginTop: 6, fontSize: 10, color: '#f85149' }}>
          {missionStatus.last_error.slice(-120)}
        </div>
      )}
      <p className="mission-controls__hint">
        Cancel stops the current waypoint mission (ROS). Then edit / Apply / Start Mission again.
      </p>
    </div>
  )
}
