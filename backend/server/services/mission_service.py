import json
import os
import threading
import subprocess
from typing import Dict, Any, List, Optional
from .config_service import ConfigService


class MissionService:
    """Service for mission execution with lifecycle-managed ROS2 subprocesses.

    Each mission type tracks its Popen handle.  Starting a new mission of the
    same type terminates any still-running previous process, preventing the
    process leak that occurred when multiple ``Run Mission`` clicks spawned
    concurrent publishers.

    State tracking fields (``current_mission_id``, ``current_mission_state``)
    are exposed via ``/api/mission_status`` so the frontend can poll progress.
    """

    VALID_STATES = {"IDLE", "RUNNING", "DISPATCHED", "COMPLETED", "FAILED", "CANCELLED"}

    def __init__(self, config_service: ConfigService):
        self.config_service = config_service
        self._waypoint_proc: Optional[subprocess.Popen] = None
        self._color_proc: Optional[subprocess.Popen] = None
        self._proc_lock = threading.Lock()
        self._state_lock = threading.Lock()

        # mission status tracking
        self.current_mission_id: Optional[str] = None
        self.current_mission_state: str = "IDLE"
        self.current_waypoint_index: int = 0
        self.total_waypoints: int = 0
        self.last_error: Optional[str] = None

    # ------------------------------------------------------------------
    # State helpers
    # ------------------------------------------------------------------

    def _set_state(self, state: str, **kwargs) -> None:
        if state not in self.VALID_STATES:
            raise ValueError(f"Invalid mission state: {state}")
        with self._state_lock:
            self.current_mission_state = state
            for k, v in kwargs.items():
                if hasattr(self, k):
                    setattr(self, k, v)

    def get_mission_status(self) -> Dict[str, Any]:
        with self._state_lock:
            return {
                "state": self.current_mission_state,
                "mission_id": self.current_mission_id,
                "current_index": self.current_waypoint_index,
                "total": self.total_waypoints,
                "last_error": self.last_error,
            }

    # ------------------------------------------------------------------
    # Process lifecycle helpers
    # ------------------------------------------------------------------

    def _replace_proc(
        self, proc_attr: str, proc: subprocess.Popen
    ) -> None:
        """Atomically replace a tracked process, terminating the old one."""
        with self._proc_lock:
            old = getattr(self, proc_attr, None)
            if old is not None and old.poll() is None:
                try:
                    old.terminate()
                except Exception:
                    pass
                try:
                    old.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    try:
                        old.kill()
                        old.wait(timeout=2)
                    except Exception:
                        pass
            setattr(self, proc_attr, proc)

    def _clear_proc(self, proc_attr: str, proc: subprocess.Popen) -> None:
        """Clear the tracked process if it is still *proc*."""
        with self._proc_lock:
            if getattr(self, proc_attr, None) is proc:
                setattr(self, proc_attr, None)

    @staticmethod
    def _ensure_ros2_python() -> None:
        """Fail fast if ``python3`` cannot import ``rclpy``."""
        try:
            result = subprocess.run(
                ["python3", "-c", "import rclpy"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode != 0:
                raise RuntimeError(
                    "rclpy is not importable — source your ROS2 setup.bash "
                    "before starting the backend: " + (result.stderr or "").strip()[-300:]
                )
        except FileNotFoundError:
            raise RuntimeError("python3 not found on PATH")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run_waypoint_mission(
        self,
        waypoints: List[Dict[str, float]],
        mission_id: str,
    ) -> Dict[str, Any]:
        """Start (or restart) the waypoint publisher with explicit waypoints.

        Passes the full payload as a JSON string via ``--payload`` so the
        one-shot publisher no longer reads a shared file.
        """
        if not waypoints:
            raise ValueError("waypoints must not be empty")

        self._ensure_ros2_python()

        payload_obj = {
            "mission_id": mission_id,
            "explicit_replan": True,
            "waypoints": waypoints,
        }
        payload_str = json.dumps(payload_obj)

        script = self.config_service.get_waypoint_script_path()
        if not os.path.isfile(script):
            raise FileNotFoundError(f"waypoint publisher script not found: {script}")

        proc = subprocess.Popen(
            ["python3", script, "--payload", payload_str],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        self._replace_proc("_waypoint_proc", proc)

        self._set_state(
            "RUNNING",
            current_mission_id=mission_id,
            current_waypoint_index=0,
            total_waypoints=len(waypoints),
            last_error=None,
        )

        timeout = self.config_service.get_script_timeout()

        def _monitor() -> None:
            try:
                stdout, stderr = proc.communicate(timeout=timeout)
                if proc.returncode != 0:
                    print(f"[Waypoint mission] exited {proc.returncode}: {stderr[-500:]}")
                    self._set_state("FAILED", last_error=stderr[-200:])
                else:
                    print(f"[Waypoint mission] dispatched")
                    self._set_state(
                        "DISPATCHED",
                        current_waypoint_index=len(waypoints) if waypoints else 0,
                        total_waypoints=len(waypoints) if waypoints else 0,
                        last_error=None,
                    )
            except subprocess.TimeoutExpired:
                print(f"[Waypoint mission] timeout ({timeout}s), killing …")
                try:
                    proc.kill()
                    proc.wait(timeout=5)
                except Exception:
                    pass
                self._set_state("FAILED", last_error="timeout")
            except Exception as exc:
                print(f"[Waypoint mission] monitor error: {exc}")
                self._set_state("FAILED", last_error=str(exc))
            finally:
                self._clear_proc("_waypoint_proc", proc)

        threading.Thread(target=_monitor, daemon=True).start()

        return {
            "status": "success",
            "message": "Waypoint mission started",
            "mission_id": mission_id,
            "waypoint_count": len(waypoints),
        }

    def run_color_code_mission(self) -> Dict[str, Any]:
        """Start (or restart) the color-code publisher."""
        self._ensure_ros2_python()
        return self._launch_script(
            script_path=self.config_service.get_color_code_script_path(),
            description="Color code mission",
            proc_attr="_color_proc",
        )

    def cancel_navigation_mission(self) -> Dict[str, Any]:
        """Publish a single ``std_msgs/Empty`` to the cancel topic via a
        one-shot rclpy script (no ``ros2 topic pub`` CLI dependency).

        Clears the tracked mission state so that a stale /waypoint publish
        or frontend poll does not see a phantom running mission.
        """
        topic = self.config_service.get_mission_bridge_cancel_topic()
        if not topic:
            raise ValueError("mission bridge cancel topic is empty")

        self._ensure_ros2_python()

        script = self.config_service.get_script_path("cancel_publisher.py")
        if not os.path.isfile(script):
            raise FileNotFoundError(f"cancel publisher script not found: {script}")

        proc = subprocess.run(
            ["python3", script, "--topic", topic],
            capture_output=True,
            text=True,
            timeout=20,
        )
        if proc.returncode != 0:
            tail = (proc.stderr or proc.stdout or "").strip()[-500:]
            raise RuntimeError(tail or f"cancel publisher exited {proc.returncode}")

        self._set_state(
            "CANCELLED",
            current_mission_id=None,
            current_waypoint_index=0,
            total_waypoints=0,
            last_error=None,
        )

        return {
            "status": "success",
            "message": "cancel published",
            "topic": topic,
            "state": "CANCELLED",
        }

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _launch_script(
        self,
        script_path: str,
        description: str,
        proc_attr: str,
    ) -> Dict[str, Any]:
        if not os.path.isfile(script_path):
            raise FileNotFoundError(f"{description} file not found: {script_path}")

        proc = subprocess.Popen(
            ["python3", script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        self._replace_proc(proc_attr, proc)

        timeout = self.config_service.get_script_timeout()

        def _monitor() -> None:
            try:
                stdout, stderr = proc.communicate(timeout=timeout)
                if proc.returncode != 0:
                    print(f"[{description}] exited {proc.returncode}: {stderr[-500:]}")
                else:
                    print(f"[{description}] completed")
            except subprocess.TimeoutExpired:
                print(f"[{description}] timeout ({timeout}s), killing …")
                try:
                    proc.kill()
                    proc.wait(timeout=5)
                except Exception:
                    pass
            except Exception as exc:
                print(f"[{description}] monitor error: {exc}")
            finally:
                self._clear_proc(proc_attr, proc)

        threading.Thread(target=_monitor, daemon=True).start()

        return {"status": "success", "message": f"{description} started"}
