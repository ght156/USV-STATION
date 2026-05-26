from fastapi import FastAPI, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from data_store import TelemetryDataStore
from services.config_service import ConfigService
from services.storage_service import StorageService
from services.mission_service import MissionService

class ColorCode(BaseModel):
    """Color code data model"""
    color_code: str

class Waypoint(BaseModel):
    """Waypoint data model with coordinates"""
    latitude: float
    longitude: float


class WaypointsRequest(BaseModel):
    """Waypoints request data model (save draft / apply)"""
    waypoints: list[Waypoint]
    mission_name: str = "yildizusv_mission"


class MissionRequest(BaseModel):
    """Mission start request — waypoints carried directly in body."""
    waypoints: list[Waypoint] = []
    mission_id: str = ""
    explicit_replan: bool = True

class APIServer:
    """FastAPI server for Yildizusv telemetry system"""
    
    def __init__(
        self, 
        data_store: TelemetryDataStore,
        config_service: ConfigService,      
        storage_service: StorageService,   
        mission_service: MissionService     
    ):
        """Initialize API server with service dependencies"""
        self.data_store = data_store
        
       
        self.config_service = config_service
        self.storage_service = storage_service
        self.mission_service = mission_service
        
        # Setup FastAPI app
        self.app = FastAPI(title="Yildizusv Gazebo Telemetry Server")
        self._setup_middleware()
        self._setup_routes()
    
    def _setup_middleware(self):
        """Setup CORS and other middleware"""
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    
    def _setup_routes(self):
        """Setup all API routes - delegates to services for business logic"""
        
        @self.app.get("/")
        async def root():
            """Root endpoint health check"""
            return {"message": "Yildizusv Gazebo Telemetry Server Active"}
        
        @self.app.get("/api/gps_message")
        async def get_gps_message():
            """Get GPS message data from telemetry store；stale (>3s) → empty"""
            import time
            ds = self.data_store
            with ds.core_lock:
                stale = (time.time() - ds._gps_last_ts) > ds.GPS_STALE_SEC
            if stale:
                return {}
            return ds.get_core_data().get("gps", {})

        @self.app.get("/api/imu_message")
        async def get_imu_message():
            """Get IMU message data from telemetry store"""
            return self.data_store.get_core_data().get("imu", {})
        
        @self.app.get("/api/linear_x")
        async def get_linear_x():
            """Get linear X velocity data from telemetry store"""
            return {"linear_x": self.data_store.get_core_data().get("linear_x", 0.0)}
        
        @self.app.get("/api/angular_z")
        async def get_angular_z():
            """Get angular Z velocity data from telemetry store"""
            return {"angular_z": self.data_store.get_core_data().get("angular_z", 0.0)}
        
        @self.app.get("/api/odometry")
        async def get_odometry():
            """Get odometry data from telemetry store"""
            return self.data_store.get_core_data().get("odom", {})
        
        @self.app.get("/api/armed_status")
        async def get_armed_status():
            """Get armed status from telemetry store"""
            return {"armed": self.data_store.get_status_data().get("armed", False)}
        
        @self.app.get("/api/mode_status")
        async def get_mode_status():
            """Get mode status from telemetry store"""
            return {"mode": self.data_store.get_status_data().get("mode", "UNKNOWN")}

        @self.app.get("/api/mavros_status")
        async def get_mavros_status():
            """Get MAVROS connection state (connected, armed, mode) from /mavros/state."""
            ms = self.data_store.get_status_data().get("mavros_status", {})
            return {
                "connected": ms.get("connected", False),
                "armed": ms.get("armed", False),
                "mode": ms.get("mode", "UNKNOWN"),
            }

        @self.app.get("/api/nav2_plan")
        async def get_nav2_plan():
            """Get Nav2 plan data from telemetry store"""
            nav2_data = self.data_store.get_nav2_data().get("nav2_plan", {"poses": [], "pose_count": 0})
            
            if not nav2_data.get("poses"):
                return {
                    "poses": [],
                    "pose_count": 0,
                    "available": False,
                    "message": "No Nav2 plan data available from ROS2",
                }

            nav2_data["available"] = True
            return nav2_data
        
        @self.app.get("/api/all_telemetry")
        async def get_all_telemetry():
            """Get all telemetry data from telemetry store"""
            return self.data_store.get_data()
        
        @self.app.post("/api/save_color_code")
        async def save_color_code(color_code: str = Form(...)):
            """Save color code via storage service"""
            try:
                return self.storage_service.save_color_code(color_code)
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.post("/api/save_waypoints")
        async def save_waypoints(request: WaypointsRequest):
            """Save waypoints via storage service"""
            try:
                waypoints_data = [{"latitude": wp.latitude, "longitude": wp.longitude} for wp in request.waypoints]
                return self.storage_service.save_waypoints(waypoints_data, request.mission_name)
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.post("/api/run_mission")
        async def run_mission(req: MissionRequest = None):
            """Run waypoint mission — prefers waypoints from request body,
            falls back to saved waypoints.json for backward compatibility."""
            try:
                import json
                import time as _time

                if req is not None and req.waypoints:
                    waypoints = [
                        {"latitude": wp.latitude, "longitude": wp.longitude}
                        for wp in req.waypoints
                    ]
                    mission_id = req.mission_id or f"backend_{int(_time.time() * 1000)}"
                    explicit_replan = req.explicit_replan if req is not None else True
                else:
                    saved = self.storage_service.load_waypoints()
                    waypoints = saved.get("waypoints", [])
                    mission_id = f"backend_{int(_time.time() * 1000)}"
                    explicit_replan = True

                if not waypoints:
                    raise HTTPException(status_code=400, detail="No waypoints provided")

                return self.mission_service.run_waypoint_mission(waypoints, mission_id, explicit_replan)
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.post("/api/run_mission2")
        async def run_mission2():
            """Run color code mission via mission service"""
            try:
                return self.mission_service.run_color_code_mission()
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/api/cancel_navigation")
        async def cancel_navigation():
            """Cancel Nav2 waypoint mission via mission_bridge (ROS2 Empty on cancel topic)."""
            try:
                return self.mission_service.cancel_navigation_mission()
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.get("/api/mission_status")
        async def mission_status():
            """Return current mission state for frontend polling.
            Merges GCS dispatch state with Nav2-side mission_bridge state.
            Ros state older than 5 s is treated as stale (dropped)."""
            try:
                import time
                status = self.mission_service.get_mission_status()
                ds = self.data_store
                with ds.core_lock:
                    stale = (time.time() - ds._mission_bridge_last_ts) > ds.MISSION_STATE_STALE_SEC
                if not stale:
                    ros_state = ds.get_core_data().get("mission_bridge_state")
                    if ros_state:
                        status["ros_state"] = ros_state
                return status
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

    def get_app(self):
        """Get the FastAPI app instance"""
        return self.app
