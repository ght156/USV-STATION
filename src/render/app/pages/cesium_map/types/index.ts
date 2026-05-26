import type { Viewer } from 'cesium';
import { MutableRefObject } from 'react';
import { Dispatch } from 'redux';

export interface GPSData {
  altitude: number;
  latitude: number;
  longitude: number;
  timestamp: number;
  /** NavSatFix status.status: -1=NO_FIX, 0=FIX, 1=SBAS_FIX, 2=GBAS_FIX */
  fix_status?: number;
  /** NavSatFix status.service bitmask: 1=GPS, 2=GLONASS, 4=COMPASS, 8=Galileo */
  service?: number;
  /** NavSatFix position_covariance_type: 0=UNKNOWN, 1=APPROXIMATED, 2=DIAGONAL_KNOWN, 3=KNOWN */
  covariance_type?: number;
}

export interface MissionStatus {
  state: 'IDLE' | 'RUNNING' | 'DISPATCHED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  mission_id: string | null;
  current_index: number;
  total: number;
  last_error: string | null;
  /** Nav2-side state from mission_bridge (IDLE/RUNNING/COMPLETED/FAILED), authoritative for execution */
  ros_state?: string;
}

export interface IMUData {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface OdomData {
  /** ROS ENU yaw (rad) from filtered odometry pose, when provided by backend */
  yaw?: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  linear_velocity: {
    x: number;
    y: number;
    z: number;
  };
}

export interface LinearX {
  linear_x: number;
}

export interface AngularZ {
  angular_z: number;
}

export interface ArmedStatus {
  armed: boolean;
}

export interface ModeStatus {
  mode: string;
}

export interface MavrosStatus {
  connected: boolean;
  armed: boolean;
  mode: string;
}

export interface Nav2PlanPose {
  position: {
    x: number;
    y: number;
    z: number;
  };
  orientation: {
    x: number;
    y: number;
    z: number;
    w: number;
  };
  header: {
    frame_id: string;
    stamp: number;
  };
}

export interface Nav2PlanData {
  header: {
    frame_id: string;
    stamp: number;
  };
  poses: Nav2PlanPose[];
  pose_count: number;
}

export interface Waypoint {
  id: string | number;
  latitude: number;
  longitude: number;
}

export interface WaypointRequest {
  latitude: number;
  longitude: number;
}

export interface WaypointsRequest {
  waypoints: WaypointRequest[];
  mission_name: string;
}

export interface ViewerRefs {
  viewer: Viewer | null;
  usvModelRef: MutableRefObject<any>;
  pathPositionRef: MutableRefObject<any>;
}

export interface VehicleData {
  gpsData: GPSData | null;
  imuData: IMUData | null;
  odomData: OdomData | null;
}

export interface MissionData {
  waypoints: Waypoint[];
  reachedWaypoints: Set<string | number>;
  currentTargetWaypoint: number;
}

export interface APIResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  file_path?: string;
}

export interface CesiumMapProps {
  // waypoints now comes from Redux store
}

export interface MissionControlsProps {
  onRunMission: (waypoints: Waypoint[]) => void;
  onCancelNavigation: () => void;
  isMissionRunning: boolean;
  isCancelNavigationSending?: boolean;
  appliedWaypoints: Waypoint[];
  missionStatus?: MissionStatus | null;
}

export interface WaypointTrackerProps {
  waypoints: Waypoint[];
  gpsData: GPSData;
  arrivalThreshold?: number;
}

export interface USVDataReturn {
  gpsData: GPSData;
  imuData: IMUData;
  odomData: OdomData;
  linearX: LinearX;
  angularZ: AngularZ;
  armedStatus: ArmedStatus;
  modeStatus: ModeStatus;
  fetchUSVData: () => Promise<void>;
}

export interface WaypointTrackerReturn {
  reachedWaypoints: Set<string | number>;
  currentTargetWaypoint: number;
  distanceToTarget: number;
  resetTracker: () => void;
}

export interface MissionHandlersReturn {
  isMissionRunning: boolean;
  isMission2Running: boolean;
  colorCode: string;
  setColorCode: (code: string) => void;
  handleRunMission: (waypoints: Waypoint[]) => Promise<void>;
  handleRunMission2: () => Promise<void>;
  handleCancelNavigation: () => Promise<void>;
  isCancelNavigationSending: boolean;
  handleSaveColorCode: () => Promise<void>;
  handleSaveWaypoints: (waypoints: Waypoint[]) => Promise<any>;
  missionStatus: MissionStatus | null;
}

export interface ReduxAction {
  type: string;
  payload?: any;
}

export type ReduxDispatch = Dispatch<ReduxAction>;

export interface ServiceEndpoint {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
}

export interface AppError {
  message: string;
  context?: string;
  timestamp?: Date;
}

export interface ModelUpdaterViewerProps {
  viewer: Viewer | null;
  usvModelRef: MutableRefObject<any>;
  pathPositionRef: MutableRefObject<any>;
  viewerReady: boolean;
}

export interface ModelUpdaterDataProps {
  gpsData: GPSData | null;
  imuData: IMUData | null;
  odomData: OdomData | null;
  /** ENU yaw (rad): use filtered odom when available, else IMU — same frame as Nav2 / RViz */
  navigationEnuYaw: number;
}

export interface ModelUpdaterMissionProps {
  waypoints: Waypoint[];
  reachedWaypoints: Set<string | number>;
  currentTargetWaypoint: number;
}

export interface ModelUpdaterProps extends 
  ModelUpdaterViewerProps,
  ModelUpdaterDataProps,
  ModelUpdaterMissionProps {}
