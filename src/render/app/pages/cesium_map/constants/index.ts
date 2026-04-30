export const DEFAULT_LOCATION = {
  longitude: 29.0046,
  latitude: 41.0211,
  altitude: 0
} as const;

export const ARRIVAL_THRESHOLD_METERS = 3.0;


const API_PORT = import.meta.env.VITE_API_PORT || 5002;
// file:// (packaged Electron) leaves hostname empty — invalid URL http://:5002 breaks all API calls
const API_HOST =
  (typeof window !== 'undefined' && window.location.hostname?.trim()
    ? window.location.hostname
    : null) ||
  import.meta.env.VITE_API_HOST ||
  '127.0.0.1';
export const API_BASE_URL = `http://${API_HOST}:${API_PORT}`;

export const CESIUM_CONFIG = {
  /**
   * Extra radians applied after ENU→compass conversion for 3D model mesh forward axis.
   * Prefer keeping 0; tune only if the glTF front differs from Cesium HPR convention.
   */
  MODEL_HEADING_BIAS_RAD: 0,
  DEFAULT_ALTITUDE: 0,
  /**
   * 在经纬度处用当前 TerrainProvider（天地图 GeoTerrainProvider / Ion 地形等）采样椭球高，
   * 作为模型高度；失败则退回 GPS 高度或 DEFAULT_LOCATION.altitude。
   */
  SAMPLE_TERRAIN_FOR_ALTITUDE: true,
  /** 地形采样高度上的额外偏移（米），例如甲板略高于 DEM「水面」时可设 0.5～2 */
  TERRAIN_HEIGHT_OFFSET_METERS: 0,
  UPDATE_INTERVAL_MS: 100,
  MODEL_SCALE: 0.01,
  MINIMUM_PIXEL_SIZE: 128,
  PATH_TRAIL_TIME: 3,
  PATH_WIDTH: 8,
  PATH_GLOW_POWER: 0.4,
  PATH_COLOR: 'CYAN',
} as const;

export const NAV2_UPDATE_INTERVAL_MS = 2000;

export const UI_POSITIONS = {
  TOP_LEFT: { top: '10px', left: '10px' },
  TOP_RIGHT: { top: '10px', right: '10px' },
  BOTTOM_LEFT: { bottom: '10px', left: '10px' },
  BOTTOM_RIGHT: { bottom: '10px', right: '10px' }
} as const;

export const COLORS = {
  PRIMARY: '#007bff',
  DISABLED: '#ccc',
  SUCCESS: '#28a745',
  WARNING: '#ffc107',
  DANGER: '#dc3545'
} as const;

export const MESSAGES = {
  MISSION_SUCCESS: "Mission started successfully!",
  MISSION_FAILED: "Mission could not be started!",
  MISSION_ERROR: "Error occurred while running mission!",
  COLOR_CODE_SUCCESS: (filePath: string) => `Color code saved successfully!\n${filePath}`,
  COLOR_CODE_FAILED: "Color code could not be saved!",
  COLOR_CODE_EMPTY: "Please enter a color code!"
} as const;
