import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from sensor_msgs.msg import Imu, NavSatFix
from nav_msgs.msg import Odometry, Path
from std_msgs.msg import String as StringMsg
from std_msgs.msg import Bool as BoolMsg
from data_store import TelemetryDataStore

class TelemetrySubscriber(Node):
    """ROS2 subscriber for telemetry data processing"""
    
    def __init__(self, data_store: TelemetryDataStore):
        """Initialize ROS2 telemetry subscriber"""
        super().__init__('telemetry_api_subscriber')
        self.data_store = data_store
        
        self._setup_subscriptions()
        
        self.get_logger().info("ROS2 Telemetry Subscriber started...")
        self._log_subscribed_topics()
    
    def _setup_subscriptions(self):
        """Setup ROS2 subscriptions for telemetry topics"""
        
        self.imu_subscription = self.create_subscription(
            Imu, 
            '/imu/fixed_cov', 
            self.data_store.update_imu, 
            10
        )
        
        self.odom_subscription = self.create_subscription(
            Odometry, 
            '/odometry/filtered', 
            self.data_store.update_odom, 
            10
        )
        
        self.gps_subscription = self.create_subscription(
            NavSatFix, 
            '/gps/fixed_cov', 
            self.data_store.update_gps, 
            10
        )
        
        self.cmd_vel_subscription = self.create_subscription(
            Twist,
            '/cmd_vel_nav',
            self.data_store.update_cmd_vel,
            10
        )
        from mavros_msgs.msg import State as MavrosState
        self.mavros_state_sub = self.create_subscription(
            MavrosState,
            '/mavros/state',
            self.data_store.update_mavros_state,
            10
        )
        self.nav2_plan_subscription = self.create_subscription(
            Path,
            '/plan',
            self.data_store.update_nav2_plan,
            10
        )

        self.mission_bridge_state_sub = self.create_subscription(
            StringMsg,
            '/mission_bridge/state',
            self.data_store.update_mission_bridge_state,
            10
        )

        self.nav_status_sub = self.create_subscription(
            StringMsg,
            '/nav_status',
            self.data_store.update_nav_status,
            10
        )

        self.task_event_sub = self.create_subscription(
            StringMsg,
            '/task_event',
            self.data_store.update_task_event,
            10
        )

    def _log_subscribed_topics(self):
        """Log subscribed ROS2 topics"""
        self.get_logger().info(" Listening Topics:")
        self.get_logger().info(" IMU: /imu/fixed_cov")
        self.get_logger().info(" Odometry: /odometry/filtered")
        self.get_logger().info(" GPS: /gps/fixed_cov")
        self.get_logger().info(" Velocity: /cmd_vel_nav")
        self.get_logger().info(" MAVROS State: /mavros/state (armed, mode, connected)")
        self.get_logger().info(" Nav2 Plan: /plan")
        self.get_logger().info(" Mission Bridge State: /mission_bridge/state")
        self.get_logger().info(" Nav Aggregated Status: /nav_status")
        self.get_logger().info(" Task Events: /task_event")
