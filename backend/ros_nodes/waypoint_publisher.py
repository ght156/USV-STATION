import json
import os
from datetime import datetime, timezone

import rclpy
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy
from std_msgs.msg import String


_WAYPOINT_QOS = QoSProfile(
    depth=10,
    reliability=ReliabilityPolicy.RELIABLE,
    durability=DurabilityPolicy.TRANSIENT_LOCAL,
)


class WaypointPublisher(Node):
    """Burst-publish waypoints to mission_bridge (3× at 0.2 s) then exit.

    Uses TRANSIENT_LOCAL QoS so that a late-joining mission_bridge still
    receives the mission (no silent drops due to discovery timing).
    """

    def __init__(self):
        super().__init__("waypoint_publisher")
        self.publisher_ = self.create_publisher(String, "waypoint", _WAYPOINT_QOS)

        self._waypoints, self._mission_id = self._load()

        self._publish_count = 0
        self._max_publish = 3
        self._burst_interval = 0.2
        self.timer = self.create_timer(self._burst_interval, self._timer_callback)
        self._exit_timer = None

        self.get_logger().info(
            f"Burst-publisher ready: mission_id={self._mission_id}, "
            f"{len(self._waypoints)} waypoints, "
            f"{self._max_publish}× every {self._burst_interval}s"
        )

    # ------------------------------------------------------------------
    def _load(self):
        """Return (waypoints, mission_id) from the shared JSON file."""
        file_path = os.path.join(
            os.path.dirname(__file__), "..", "data", "waypoints.json"
        )
        try:
            with open(file_path, "r") as fh:
                data = json.load(fh)
        except FileNotFoundError:
            self.get_logger().warn("waypoints.json not found — nothing to publish")
            return [], f"empty_{datetime.now(timezone.utc).isoformat()[:19]}"
        except (json.JSONDecodeError, OSError) as exc:
            self.get_logger().error(f"Failed to read waypoints.json: {exc}")
            return [], f"error_{datetime.now(timezone.utc).isoformat()[:19]}"

        waypoints = data.get("waypoints", [])
        mission_name = data.get("mission_name", "unknown")
        timestamp = data.get(
            "timestamp", datetime.now(timezone.utc).isoformat() + "Z"
        )
        safe_ts = str(timestamp).replace(":", "-").replace(".", "-")
        mission_id = f"{mission_name}_{safe_ts}"

        return waypoints, mission_id

    # ------------------------------------------------------------------
    def _timer_callback(self):
        if not self._waypoints:
            self.get_logger().warn("No waypoints to publish — exiting.")
            self._schedule_exit()
            return

        payload = {
            "mission_id": self._mission_id,
            "waypoints": self._waypoints,
            "explicit_replan": True,
        }

        msg = String()
        msg.data = json.dumps(payload)
        self.publisher_.publish(msg)

        self._publish_count += 1
        self.get_logger().info(
            f"Published {self._publish_count}/{self._max_publish}  "
            f"mission_id={self._mission_id}  "
            f"waypoints={len(self._waypoints)}"
        )

        if self._publish_count >= self._max_publish:
            self.get_logger().info("Burst complete — exiting.")
            self.destroy_timer(self.timer)
            self._schedule_exit()

    def _schedule_exit(self):
        self._exit_timer = self.create_timer(0.05, self._exit)

    def _exit(self):
        if self._exit_timer is not None:
            self.destroy_timer(self._exit_timer)
            self._exit_timer = None
        rclpy.shutdown()


# ------------------------------------------------------------------
def main(args=None):
    rclpy.init(args=args)
    node = WaypointPublisher()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
