import os
import shutil
import threading
import subprocess
from typing import Dict, Any
from .config_service import ConfigService

class MissionService:
    """Service for handling mission execution and subprocess management"""
    
    def __init__(self, config_service: ConfigService):
        self.config_service = config_service
    
    def run_waypoint_mission(self) -> Dict[str, Any]:
        """Run waypoint publisher mission"""
        return self._run_script(
            script_path=self.config_service.get_waypoint_script_path(),
            mission_description="Waypoint mission"
        )
    
    def run_color_code_mission(self) -> Dict[str, Any]:
        """Run color code publisher mission"""
        return self._run_script(
            script_path=self.config_service.get_color_code_script_path(),
            mission_description="Color code mission"
        )

    def cancel_navigation_mission(self) -> Dict[str, Any]:
        """Publish one std_msgs/msg/Empty to cancel mission_bridge FollowWaypoints / buffers."""
        topic = self.config_service.get_mission_bridge_cancel_topic()
        if not topic:
            raise ValueError("mission bridge cancel topic is empty")

        ros2 = shutil.which("ros2")
        if not ros2:
            raise FileNotFoundError(
                "`ros2` not found on PATH — source your ROS distro (e.g. /opt/ros/humble/setup.bash) "
                "before starting the backend, or extend PATH."
            )

        cmd = [
            ros2,
            "topic",
            "pub",
            "--once",
            topic,
            "std_msgs/msg/Empty",
            "{}",
        ]
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=20,
        )
        if proc.returncode != 0:
            tail = (proc.stderr or proc.stdout or "").strip()[-500:]
            raise RuntimeError(tail or f"ros2 topic pub exited {proc.returncode}")

        return {"status": "success", "message": "cancel published", "topic": topic}

    def _run_script(self, script_path: str, mission_description: str) -> Dict[str, Any]:
        """Run a Python script in a separate thread (fire-and-forget)"""
        try:
            if not os.path.isfile(script_path):
                raise FileNotFoundError(f"{mission_description} file not found: {script_path}")
            
            def run_script():
                try:
                    result = subprocess.run(
                        ["python3", script_path],
                        capture_output=True,
                        text=True,
                        timeout=self.config_service.get_script_timeout()
                    )
                    if result.returncode != 0:
                        print(f"Script error: {result.stderr}")
                    else:
                        print(f"{mission_description} completed successfully")
                except subprocess.TimeoutExpired:
                    print(f"{mission_description} timed out")
                except Exception as e:
                    print(f"{mission_description} execution error: {e}")
            
            thread = threading.Thread(target=run_script, daemon=True)
            thread.start()
            
            return {
                "status": "success", 
                "message": f"{mission_description} started"
            }
        except Exception as e:
            raise Exception(f"{mission_description} could not be started: {str(e)}")
