import React from 'react'
import './VehicleStatusIndicator.css'

interface VehicleStatusIndicatorProps {
  armedStatus: { armed: boolean }
  modeStatus: { mode: string }
  connected?: boolean
}

export const VehicleStatusIndicator: React.FC<VehicleStatusIndicatorProps> = ({
  armedStatus,
  modeStatus,
  connected,
}) => {
  return (
    <div className="vehicle-status">
      <div className="vehicle-status__section">
        <strong>FCU:</strong>{' '}
        <span className={connected ? 'vehicle-status__armed' : 'vehicle-status__disarmed'}>
          {connected ? '🟢 CONNECTED' : '🔴 NO FCU'}
        </span>
      </div>
      <div className="vehicle-status__divider"></div>
      <div className="vehicle-status__section">
        <strong>Armed:</strong>{' '}
        <span className={armedStatus.armed ? 'vehicle-status__armed' : 'vehicle-status__disarmed'}>
          {armedStatus.armed ? '🟢 ARMED' : '🔴 DISARMED'}
        </span>
      </div>
      <div className="vehicle-status__divider"></div>
      <div className="vehicle-status__section">
        <strong>Mode:</strong>{' '}
        <span className="vehicle-status__mode">
          {modeStatus.mode}
        </span>
      </div>
    </div>
  )
}
