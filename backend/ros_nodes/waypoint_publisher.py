#!/usr/bin/env python3
"""One-shot waypoint publisher: publishes a single waypoint mission JSON to the
``/waypoint`` topic and exits.  Accepts the full payload via ``--payload`` so
that the GCS backend can pass waypoints directly instead of relying on a
shared file.

Uses TRANSIENT_LOCAL QoS so that a late-joining mission_bridge still receives
the mission.
"""

import argparse
import json
import sys

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
    def __init__(self, payload: dict):
        super().__init__("waypoint_publisher")
        self.publisher_ = self.create_publisher(String, "waypoint", _WAYPOINT_QOS)
        self._payload = payload
        self._published = False
        self.timer = self.create_timer(0.15, self._timer_callback)
        self.get_logger().info(
            f"One-shot publisher ready: mission_id={payload.get('mission_id', '?')}, "
            f"{len(payload.get('waypoints', []))} waypoints"
        )

    def _timer_callback(self):
        if self._published:
            return
        msg = String()
        msg.data = json.dumps(self._payload)
        self.publisher_.publish(msg)
        self._published = True
        self.get_logger().info(
            f"Published waypoint mission: mission_id={self._payload.get('mission_id', '?')}"
        )
        self.destroy_timer(self.timer)
        self._schedule_exit()

    def _schedule_exit(self):
        self._exit_timer = self.create_timer(0.1, self._exit)

    def _exit(self):
        if self._exit_timer is not None:
            self.destroy_timer(self._exit_timer)
            self._exit_timer = None
        rclpy.shutdown()


def main():
    parser = argparse.ArgumentParser(description="One-shot waypoint publisher")
    parser.add_argument(
        "--payload",
        required=True,
        help="JSON payload with mission_id, explicit_replan, and waypoints",
    )
    args = parser.parse_args()

    try:
        payload = json.loads(args.payload)
    except json.JSONDecodeError as exc:
        print(f"Invalid JSON payload: {exc}", file=sys.stderr)
        sys.exit(1)

    if not payload.get("waypoints"):
        print("Payload contains no waypoints", file=sys.stderr)
        sys.exit(1)

    rclpy.init()
    node = WaypointPublisher(payload)
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
