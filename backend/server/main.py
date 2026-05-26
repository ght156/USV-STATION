import rclpy
import threading
import uvicorn
import sys
import os
from rclpy.executors import MultiThreadedExecutor


sys.path.append(os.path.dirname(__file__))
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from data_store import TelemetryDataStore
from ros_subscriber import TelemetrySubscriber
from api_server import APIServer
from config.settings import Settings

# Import services for dependency injection
from services.config_service import ConfigService
from services.storage_service import StorageService
from services.mission_service import MissionService

def main(args=None):
    """Main function to start Yildizusv telemetry server"""
    print("🚀 YildizUSV Gazebo Telemetry Server Starting...")
    
    data_store = TelemetryDataStore()
    print("✅ TelemetryDataStore created")
    
    config_service = ConfigService()
    print("✅ ConfigService created")
    
    storage_service = StorageService(config_service)
    print("✅ StorageService created")
    
    mission_service = MissionService(config_service, data_store=data_store)
    print("✅ MissionService created")
    
    rclpy.init()
    print("✅ ROS2 initialized")
    
    executor = MultiThreadedExecutor()
    telemetry_subscriber = TelemetrySubscriber(data_store)
    executor.add_node(telemetry_subscriber)
    
    ros_thread = threading.Thread(target=executor.spin, daemon=True)
    ros_thread.start()
    print("✅ ROS2 Subscriber running in background")
    
    
    api_server = APIServer(
        data_store=data_store,
        config_service=config_service,
        storage_service=storage_service,
        mission_service=mission_service
    )
    app = api_server.get_app()
    print("✅ FastAPI Server created")
    
    try:
        print("\n🎯 Server ready! API endpoints:")
        print(f"   📡 http://localhost:{Settings.PORT}")
        print(f"   📊 http://localhost:{Settings.PORT}/docs (Swagger UI)")
        print(f"   📋 http://localhost:{Settings.PORT}/all_telemetry")
        print("\n🔄 ROS2 Topics active:")
        print("   🧭 IMU: /imu/fixed_cov")
        print("   📍 Odometry: /odometry/filtered")
        print("   🛰️  GPS: /gps/fixed_cov")
        print("   🚀 Velocity: /cmd_vel_nav (Nav2 controller; smoothed: /cmd_vel)")
        print("   🗺️  Nav2 Plan: /plan")
        print("   🛰️  MAVROS State: /mavros/state (connected, armed, mode)")
        print("   📡 Mission Bridge State: /mission_bridge/state")
        print("\n⏹️  Press Ctrl+C to stop...\n")
        
        uvicorn.run(app, host=Settings.HOST, port=Settings.PORT, log_level="info")
        
    except KeyboardInterrupt:
        print("\n⏹️  Shutting down server...")
    finally:
        rclpy.shutdown()
        ros_thread.join()
        print("✅ Server completely shut down.")

if __name__ == "__main__":
    main()
