#!/usr/bin/env python3
"""One-shot cancel publisher: sends a single ``std_msgs/Empty`` to *topic*
and exits.  Intended to replace ``ros2 topic pub --once`` so that the GCS
backend does not depend on the ``ros2`` CLI being on PATH.

Uses TRANSIENT_LOCAL QoS to maximise the chance that mission_bridge
receives the cancel even under late-Discovery timing."""

import argparse

import rclpy
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy
from std_msgs.msg import Empty

_CANCEL_QOS = QoSProfile(
    depth=10,
    reliability=ReliabilityPolicy.RELIABLE,
    durability=DurabilityPolicy.TRANSIENT_LOCAL,
)


def main():
    parser = argparse.ArgumentParser(description="One-shot Empty cancel publisher")
    parser.add_argument("--topic", required=True, help="ROS2 topic name")
    args = parser.parse_args()

    rclpy.init()
    node = Node("cancel_publisher", start_parameter_services=False)
    pub = node.create_publisher(Empty, args.topic, _CANCEL_QOS)

    msg = Empty()
    done = False

    def _publish_and_signal() -> None:
        nonlocal done
        pub.publish(msg)
        node.get_logger().info(f"cancel published to {args.topic}")
        done = True

    timer = node.create_timer(0.15, _publish_and_signal)

    while rclpy.ok() and not done:
        rclpy.spin_once(node, timeout_sec=0.1)

    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
