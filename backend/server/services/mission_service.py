import os
import threading
import subprocess
from typing import Dict, Any, Optional
from .config_service import ConfigService


class MissionService:
    """Service for mission execution with lifecycle-managed ROS2 subprocesses.

    Each mission type tracks its Popen handle.  Starting a new mission of the
    same type terminates any still-running previous process, preventing the
    process leak that occurred when multiple ``Run Mission`` clicks spawned
    concurrent 1 Hz publishers.
    """

    def __init__(self, config_service: ConfigService):
        self.config_service = config_service
        self._waypoint_proc: Optional[subprocess.Popen] = None
        self._color_proc: Optional[subprocess.Popen] = None
        self._proc_lock = threading.Lock()

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

    def run_waypoint_mission(self) -> Dict[str, Any]:
        """Start (or restart) the waypoint publisher."""
        self._ensure_ros2_python()
        return self._launch_script(
            script_path=self.config_service.get_waypoint_script_path(),
            description="Waypoint mission",
            proc_attr="_waypoint_proc",
        )

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
        one-shot rclpy script (no ``ros2 topic pub`` CLI dependency)."""
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

        return {"status": "success", "message": "cancel published", "topic": topic}

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
