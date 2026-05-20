import json
import os

import rclpy
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy
from std_msgs.msg import String


_COLOR_QOS = QoSProfile(
    depth=10,
    reliability=ReliabilityPolicy.RELIABLE,
    durability=DurabilityPolicy.TRANSIENT_LOCAL,
)


class ColorCodePublisher(Node):
    """Burst-publish the current color code to mission_bridge (3× at 0.2 s)
    then exit — the same event-style pattern as waypoint_publisher.

    TRANSIENT_LOCAL QoS ensures a late-joining mission_bridge still
    receives the latest color.
    """

    def __init__(self):
        super().__init__("color_code_publisher")
        self.publisher_ = self.create_publisher(String, "color_code", _COLOR_QOS)

        self._color = self._load()

        self._publish_count = 0
        self._max_publish = 3
        self._burst_interval = 0.2
        self.timer = self.create_timer(self._burst_interval, self._timer_callback)
        self._exit_timer = None

        self.get_logger().info(
            f"Burst-publisher ready: color={self._color}, "
            f"{self._max_publish}× every {self._burst_interval}s"
        )

    # ------------------------------------------------------------------
    @staticmethod
    def _load() -> str:
        file_path = os.path.join(
            os.path.dirname(__file__), "..", "data", "color_code.json"
        )
        try:
            with open(file_path, "r") as fh:
                data = json.load(fh)
            return str(data.get("color_code", "#FF0000"))
        except FileNotFoundError:
            return "#FF0000"
        except (json.JSONDecodeError, OSError):
            return "#FF0000"

    # ------------------------------------------------------------------
    def _timer_callback(self):
        msg = String()
        msg.data = self._color
        self.publisher_.publish(msg)

        self._publish_count += 1
        self.get_logger().info(
            f"Published color_code {self._publish_count}/{self._max_publish}: "
            f"{self._color}"
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
    node = ColorCodePublisher()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
