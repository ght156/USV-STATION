import React, { useEffect, useRef } from 'react'
import { MissionControlsProps } from '../types'
import './MissionControls.css'

const STATE_LABELS: Record<string, string> = {
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  DISPATCHED: 'DISPATCHED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  WAITING_SYSTEM: 'WAITING',
  UNKNOWN: 'UNKNOWN',
}

const stateColors: Record<string, string> = {
  IDLE: '#475569',
  RUNNING: '#22c55e',
  DISPATCHED: '#3b82f6',
  COMPLETED: '#10b981',
  FAILED: '#ef4444',
  CANCELLED: '#f59e0b',
  WAITING_SYSTEM: '#f59e0b',
  UNKNOWN: '#94a3b8',
}

const levelColors: Record<string, string> = {
  INFO: '#64748b',
  WARN: '#f59e0b',
  ERROR: '#ef4444',
  FATAL: '#dc2626',
}

export const MissionControls: React.FC<MissionControlsProps> = ({
  onRunMission,
  onCancelNavigation,
  isMissionRunning,
  isCancelNavigationSending = false,
  appliedWaypoints,
  missionStatus,
}) => {
  const displayState = missionStatus?.state ?? 'IDLE'
  const currentBadgeColor = stateColors[displayState] || '#64748b'
  const navPhase = missionStatus?.nav_phase || 'IDLE'

  const recentLogs: Array<{
    stamp: number; level: string; node: string; message: string;
  }> = (missionStatus as any)?.recent_logs ?? []

  // Auto-scroll to bottom when new logs arrive
  const logBodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (logBodyRef.current) {
      logBodyRef.current.scrollTop = logBodyRef.current.scrollHeight
    }
  }, [recentLogs.length])

  return (
    <div className="mission-controls">
      {/* 1. Status banner */}
      <div className="mission-controls__status-banner">
        <span className="mission-controls__status-label">USV STATE</span>
        <span
          className="mission-controls__badge"
          style={{ color: currentBadgeColor, backgroundColor: `${currentBadgeColor}15` }}
        >
          {STATE_LABELS[displayState] || displayState}
        </span>
        {navPhase && displayState === 'RUNNING' && (
          <span className="mission-controls__phase">· {navPhase}</span>
        )}
      </div>

      {/* 2. Action buttons */}
      <div className="mission-controls__row">
        <button
          type="button"
          onClick={() => void onRunMission(appliedWaypoints)}
          disabled={isMissionRunning}
          className={`mission-controls__button mission-controls__button--start`}
        >
          {isMissionRunning ? 'Mission Active' : '⚡ Dispatch Mission'}
        </button>

        <button
          type="button"
          onClick={() => void onCancelNavigation()}
          disabled={isCancelNavigationSending}
          className="mission-controls__button mission-controls__button--cancel"
        >
          {isCancelNavigationSending ? 'Halting…' : '🛑 Cancel'}
        </button>
      </div>

      {/* 3. Error panel for terminal failure */}
      {displayState === 'FAILED' && missionStatus?.last_error && (
        <div className="mission-controls__error-panel">
          <strong>Error:</strong> {missionStatus.last_error}
        </div>
      )}

      {/* 4. Nav2 log panel — scrollable, auto-scrolls to bottom */}
      <div className="mission-controls__log-panel">
        <div className="mission-controls__log-header">
          Nav2 Log
          {recentLogs.length > 0 && (
            <span className="mission-controls__log-count">({recentLogs.length})</span>
          )}
        </div>
        <div className="mission-controls__log-body" ref={logBodyRef}>
          {recentLogs.length === 0 ? (
            <div className="mission-controls__log-empty">Waiting for navigation logs...</div>
          ) : (
            recentLogs.map((entry, i) => (
              <div key={`${entry.stamp}-${i}`} className="mission-controls__log-line">
                <span className="mission-controls__log-level"
                  style={{ color: levelColors[entry.level] || '#94a3b8' }}>
                  [{entry.level}]
                </span>
                <span className="mission-controls__log-node">[{entry.node}]</span>
                <span className="mission-controls__log-msg">{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
