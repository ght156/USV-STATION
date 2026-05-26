# GCS 任务状态体系

> 说明 GCS 前端 Mission State 与 Nav2 Plan Status 的区别、数据流、前端组件对应关系。
> 维护于 2026-05-26，后续状态机变更请同步更新本文。

---

## 1. 两套 State 的区别

GCS 前端同时显示两类状态，容易混淆：

| | **Mission State** | **Nav2 Plan Status** |
|---|---|---|
| **数据来源** | `GET /api/mission_status` | `GET /api/nav2_plan` |
| **后端来源** | `mission_service` + `/mission_bridge/state` ROS 话题 | `data_store.nav2_plan_data`（ROS `/plan` 话题） |
| **含义** | 航点任务的**生命周期**（是否派遣、Nav2 是否执行、是否失败） | Nav2 **当前是否有规划好的路径**（路径层快照） |
| **取值** | IDLE / RUNNING / DISPATCHED / COMPLETED / FAILED / CANCELLED | Loading / Active / No Data / Error |
| **前端组件** | `MissionControls`（左上角状态徽章） | `Nav2PlanControls`（左下角 Show/Hide Plan 旁） |
| **更新频率** | 2 秒（`useMissionHandlers`） | 2 秒（`useNav2PlanData`） |

### 场景举例

| Mission State | Nav2 Plan Status | 含义 |
|---------------|------------------|------|
| IDLE | No Data | 未启动任务，Nav2 空闲 |
| RUNNING | Active | 航点已下发，Nav2 正在执行，路径可见 |
| DISPATCHED | No Data | 航点已派遣，但 Nav2 尚未算出路径（规划中或失败） |
| FAILED (ros_state) | No Data | mission_bridge 确认 Nav2 规划/执行失败 |
| COMPLETED | No Data | 全部航点已走完 |

**关键认知**：Mission State = 任务层，Nav2 Plan Status = 路径层。两者互补，不可互相替代。

---

## 2. 双源状态合并

`/api/mission_status` 返回两个状态源：

```json
{
  "state": "DISPATCHED",          // GCS 调度侧状态（waypoint_publisher 进程）
  "mission_id": "frontend_...",
  "current_index": 0,
  "total": 3,
  "last_error": null,
  "ros_state": "RUNNING"          // Nav2 侧状态（/mission_bridge/state）
}
```

- **`state`**：由 `WaypointPublisher` 子进程生命周期决定。`RUNNING` = 进程运行中，`DISPATCHED` = 进程正常退出（航点已发布），`FAILED` = 进程异常退出。
- **`ros_state`**：由 `mission_bridge` ROS 节点通过 `/mission_bridge/state` 话题发布。反映 Nav2 `FollowWaypoints` action 的真实结果：`RUNNING` / `COMPLETED` / `FAILED` / `IDLE`。

前端 `MissionControls` **优先显示 `ros_state`**（Nav2 执行状态），仅当 `ros_state` 不存在或与 GCS 调度状态相同时回退到 `state`。两者不一致时，副标签显示 GCS 状态：

```
State: [FAILED] (GCS: DISPATCHED)
```

---

## 3. 数据流链路

```
GCS 前端
  ├─ MissionControls ◄── useMissionHandlers (2s poll) ◄── GET /api/mission_status
  │    ├─ mission_service.run_waypoint_mission → state (DISPATCHED/FAILED)
  │    └─ data_store.mission_bridge_state → ros_state (ROS topic)
  │
  └─ Nav2PlanControls ◄── useNav2PlanData (2s poll) ◄── GET /api/nav2_plan
       └─ data_store.nav2_plan_data (ROS /plan topic)

                          ┌─ /waypoint ──────────► mission_bridge ──► Nav2 FollowWaypoints
GCS backend               │                          │
  waypoint_publisher.py ──┤                          │
  ros_subscriber.py ◄─────┼── /mission_bridge/state ◄─┘ (2026-05-26 新增)
                          │
                          └── /plan ◄─── Nav2 planner_server
```

---

## 4. 前端组件对应

| 组件 | 文件 | 显示内容 |
|------|------|---------|
| **MissionControls** | `components/MissionControls.tsx` + `.css` | 按钮（Start/Cancel）+ 状态徽章（色标）+ mission_id + 错误信息 |
| **Nav2PlanControls** | `components/Nav2PlanControls.tsx` + `.css` | Show/Hide Plan 开关 + Status（Loading/Active/No Data/Error） |
| **DebugPanel** | `components/DebugPanel.tsx` + `.css` | GPS 定位质量 + 速度 + 航点进度 |

排版修改请编辑对应的 `.tsx`（结构）和 `.css`（样式）文件。

---

## 5. 状态色标约定

| 状态 | 颜色 | 色号 |
|------|------|------|
| IDLE | 灰 | `#666` |
| RUNNING | 绿 | `#238636` |
| DISPATCHED | 蓝 | `#1f6feb` |
| COMPLETED | 深绿 | `#2ea043` |
| FAILED | 红 | `#da3633` |
| CANCELLED | 橙 | `#c08400` |

---

## 6. 变更记录

### 2026-05-26

| 变更 | 涉及文件 |
|------|---------|
| **数据陈腐检测**：GPS >3s 无更新返回空，ros_state >5s 无更新视为过期 | `data_store.py`, `api_server.py` |
| **分发看门狗**：dispatch 后 5s 内 mission_bridge 无反馈 → 自动回 IDLE | `services/mission_service.py` |
| **SCRIPT_TIMEOUT** 300s → 10s | `config/settings.py` |
| **MAVROS 状态订阅**：统一订阅 `/mavros/state`（含 connected/armed/mode），新增 `/api/mavros_status` | `ros_subscriber.py`, `data_store.py`, `api_server.py` |
| **前端** `VehicleStatusIndicator` 新增 FCU CONNECTED / NO FCU 显示，2s 轮询 | `CesiumMap.tsx`, `VehicleStatusIndicator.tsx`, `types/index.ts` |
| **UI 布局重构**：统一左侧 sidebar（flex column），各组件去除 absolute 定位，WaypointEditor 内联展开 | `CesiumMap.tsx`, `CesiumMap.css`, `MissionControls.css`, `ExtraControls.css`, `WaypointEditorTrigger.css`, `DebugPanel.css` |
| `mission_bridge.py` 新增 `/mission_bridge/state` publisher | `wuxihik_navigation` |
| GCS 订阅 `/mission_bridge/state` → `ros_state` 合并到 `/api/mission_status` | `ros_subscriber.py`, `data_store.py`, `api_server.py` |
| 前端 `MissionControls` 优先显示 `ros_state` | `MissionControls.tsx` |
| `PlaneService` 改为 `useMemo` 稳定化，修复轮询定时器饥饿 | `CesiumMap.tsx` |
| `useWaypointMapPick` 拾取优先级改为 `globe.pick`，修复倾斜/缩放漂移 | `useWaypointMapPick.ts` |
| `waypoint_publisher.py` 退出延迟 0.1s → 1.0s | `waypoint_publisher.py` |
| `explicit_replan` 从前端透传至 ROS payload | `api_server.py`, `mission_service.py` |
