/**
 * ROS map/odom ENU (REP-103): yaw is rotation about +Z, zero along +X (East),
 * increasing toward +Y (North).
 * Aviation / geographic compass: 0 = North, clockwise positive.
 *
 * compass_heading_rad = π/2 - enu_yaw (wrapped to [0, 2π)).
 */
export function enuYawRadiansToCompassHeadingRadians(enuYaw: number): number {
  const twoPi = 2 * Math.PI
  let h = Math.PI / 2 - enuYaw
  h = ((h % twoPi) + twoPi) % twoPi
  return h
}
