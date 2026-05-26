import React from 'react'
import { MissionControlsProps } from '../types'
import './MissionControls.css'

const STATE_LABELS: Record<string, string> = {
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  DISPATCHED: 'DISPATCHED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
}

export const MissionControls: React.FC<MissionControlsProps> = ({
  onRunMission,
  onCancelNavigation,
  isMissionRunning,
  isCancelNavigationSending = false,
  appliedWaypoints,
  missionStatus,
}) => {
  const gcsState = missionStatus?.state ?? 'IDLE'
  const rosState = missionStatus?.ros_state
  const displayState = rosState || gcsState

  // 状态颜色映射映射到现代 UI 的变量中
  const stateColors: Record<string, string> = {
    IDLE: '#475569',
    RUNNING: '#22c55e',
    DISPATCHED: '#3b82f6',
    COMPLETED: '#10b981',
    FAILED: '#ef4444',
    CANCELLED: '#f59e0b',
  }

  const currentBadgeColor = stateColors[displayState] || '#64748b'

  return (
    <div className="mission-controls">
      {/* 1. 顶层状态看板区 - 第一眼就能看清船在干什么 */}
      <div className="mission-controls__status-banner">
        <span className="mission-controls__status-label">USV STATE</span>
        <span 
          className="mission-controls__badge" 
          style={{ color: currentBadgeColor, backgroundColor: `${currentBadgeColor}15` }}
        >
          {STATE_LABELS[displayState] || displayState}
        </span>
      </div>

      {/* 2. 简介与元数据区 - 弱化长文本和次要编号 */}
      <div className="mission-controls__meta">
        {missionStatus?.mission_id && (
          <span className="mission-controls__id">
            Mission ID: #{missionStatus.mission_id.slice(-8)}
          </span>
        )}
        
        {/* 当 ROS 状态与 GCS 地面站本地状态不一致时才弹出警告提示 */}
        {rosState && rosState !== gcsState && (
          <div className="mission-controls__sync-warning">
            ⚠️ Syncing (GCS: {STATE_LABELS[gcsState] || gcsState})
          </div>
        )}
      </div>

      {/* 3. 动作操作按钮区 - 主次分明，视觉宽度调整为不平分 */}
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

      {/* 4. 底部错误诊断反馈（条件渲染） */}
      {displayState === 'FAILED' && missionStatus?.last_error && (
        <div className="mission-controls__error-panel">
          <strong>Error:</strong> {missionStatus.last_error}
        </div>
      )}
    </div>
  )
}
