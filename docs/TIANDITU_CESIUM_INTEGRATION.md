# 地面站天地图三维（Cesium）接入说明

本文档用于复盘 **`GROUND-CONTROL-STATION-dev`** 中「天地图 + Cesium」相关改动，以及后续可优化项。**请勿把真实 Token 提交到 Git**（`.env` 已在 `.gitignore` 中）。

查询经维度填入仿真sdf中发现与三维球的位置不匹配，多个网站查询发现是之前的网站查询不准去，用下面这个网站

https://www.bchrt.com/tools/latitude-longitude-query/

---

## 1. 背景与结论

- **Cesium Ion** 默认的全球影像/地形在国内常见：**访问不稳定、延迟高、部分区域观感差或与业务不符**。
- **天地图开放平台**提供：`img_w` 影像、`cia_w` 注记、`ibo_w` 国界、`elv_c` **三维地形（DEM）** 等；需在示例相同的 **浏览器端 `tk`**（Key）下在线调用瓦片服务。
- 实现方式：**沿用官方三维示例**，在页面中先于应用 bundle 加载天地图 CDN 的 `Cesium.js` + `Cesium_ext_min.js`（含 `GeoTerrainProvider` 等扩展），React 侧通过 `@render/lib/tianditu-cesium` 使用 **`window.Cesium`**；**npm 包 `cesium` 仍保留**，主要用于 **TypeScript 类型**（如 `import type { Viewer } from 'cesium'`）。

---

## 2. 已完成的代码改动（清单）

| 位置 | 说明 |
|------|------|
| `src/render/index.html` | 在 `<script type="module" src="/main.tsx">` **之前**同步引入 Widgets 样式、`Cesium.js`、`Cesium_ext_min.js`、`long` / `bytebuffer` / `protobuf`。 |
| `src/render/lib/tianditu-cesium.ts` | 导出运行时命名空间 **`Cesium`**，从 **`window.Cesium`** 读取（由上述脚本注入）。 |
| `src/render/app/pages/cesium_map/hooks/useCesiumViewer.ts` | 去掉 Ion Token；读取 **`VITE_TIANDITU_TOKEN`**；优先 **`new Cesium.Map(...)`**，否则退回 **`Viewer`**；叠加影像/国界/注记；设置 **`GeoTerrainProvider`**（`swdx`/`elv_c`）；**关闭 Ion 依赖路径**。另见 **§8**（地形深度测试、对数深度缓冲）。 |
| `src/render/app/pages/cesium_map/hooks/useUSVModelUpdater.ts` | 船舶模型经纬来自 GPS；**高度**在经纬度处 **`sampleTerrainMostDetailed`** 对齐 DEM（见 **§8**），失败则退回 **GPS 高度 / 默认高度**。 |
| `src/render/app/pages/cesium_map/constants/index.ts` | **`CESIUM_CONFIG.SAMPLE_TERRAIN_FOR_ALTITUDE`**、**`TERRAIN_HEIGHT_OFFSET_METERS`**：控制是否用地形采样高度及甲板微调（米）。 |
| `src/render/app/pages/cesium_map/**/*.ts(x)`（多处） | 将 `import * as Cesium from 'cesium'` 改为 `import { Cesium } from '@render/lib/tianditu-cesium'`。 |
| `src/render/app/pages/cesium_map/types/index.ts` | `Viewer` 改为 **`import type`**，避免误打包 Ion 相关运行时。 |
| `vite.config.mts` | 移除 **`vite-plugin-cesium`**，避免与 CDN 天地图 Cesium 重复打包 workers / 资产冲突。 |
| `package.json` | 移除 **`vite-plugin-cesium`** 依赖项（需在仓库内执行 `pnpm install` 同步锁文件）。 |
| `.env.example` | 增加 `VITE_TIANDITU_TOKEN` 说明；Ion 改为注释占位。 |

---

## 3. 环境变量（本地）

在项目根目录 **`.env`**（勿提交）中配置：

```bash
VITE_TIANDITU_TOKEN=<天地图开放平台申请的浏览器端 Key>
```

- Key 类型必须为 **浏览器端**；服务端 Key 无法在浏览器直接使用。
- 修改 `.env` 后需 **重启** `pnpm dev` / 重新打包。

`.env.example` 仅保留占位符，**不要写入真实 Token**。

---

## 4. Ion 是否还需要？

当前默认路径 **不再使用** `VITE_CESIUM_ION_TOKEN` 初始化地球。若已无其它用途，可从 `.env` 中删除 Ion 字段；保留也不影响天地图路径（代码未再读取）。

---

## 5. 后续建议（优化 / 待办）

### 5.1 安全与合规

- Token 出现在聊天记录或复制给他人后，建议在天地图控制台 **轮换 / 重新生成 Key**。
- 打包发布前确认 **天地图服务条款**（调用限额、商用资质等）。

### 5.2 Electron / 打包环境

- 若打包后 **外链脚本被 CSP 拦截**，需在 Electron `webPreferences` / `session.webRequest` 等为 `api.tianditu.gov.cn` 放行（按实际报错调整）。
- 离线场景无法访问 CDN 时，需改为 **内网镜像** 天地图脚本（运维侧）。

### 5.3 功能扩展（可选）

- 官方示例中的 **`GeoWTFS`（三维地名）**：可按 [lbs 三维文档](http://lbs.tianditu.gov.cn/docs/#/sanwei/) 叠加；注意性能与样式。
- **海面场景**：若仅需椭球高度，可考虑简化地形或调低地形请求层级以减负。
- **坐标系**：GNSS 一般为 WGS84；若叠加其它国内图源，注意 **GCJ-02 / WGS84** 是否一致，必要时做坐标转换。

### 5.4 工程清理

- 依赖已移除 `vite-plugin-cesium`，建议在 **`GROUND-CONTROL-STATION-dev`** 内执行 **`pnpm install`**，确认 `pnpm-lock.yaml` 更新后一并提交（若团队跟踪 lockfile）。
- 若 **`GROUND-CONTROL-STATION`**（未改名的备份仓库）也要同步，建议 **cherry-pick 或手工合并** 上述文件，避免双份长期分叉。

### 5.5 构建说明

- 曾在部分环境下 **`pnpm run build`** 在 **electron-builder** 阶段失败（与本地图改动无关）；若 CI 仅需验证前端，可单独跑 **`vite build`** 或 `pnpm run build:renderer`。

---

## 6. 关键参考链接

- 天地图开放平台：<https://console.tianditu.gov.cn/>
- 三维服务文档索引：`http://lbs.tianditu.gov.cn/docs/#/sanwei/`（以官网最新为准）
- 社区示例（GIS 笔记）：`https://gisnotes.github.io/posts/dd5c6c5/`（实现思路与 CDN 路径）

---

## 7. 复盘检查表（改代码前看一眼）

- [ ] `.env` 中有有效的 **`VITE_TIANDITU_TOKEN`**（浏览器端）
- [ ] `index.html` 中脚本顺序未被改动（须先于 `main.tsx`）
- [ ] 业务代码统一从 **`@render/lib/tianditu-cesium`** 取 `Cesium`，避免再从 `'cesium'` 引入运行时
- [ ] 不要在仓库中提交含真实 Key 的 `.env`
- [ ] 调整船舶高度逻辑时同步核对 **`CESIUM_CONFIG`**（§8）及 **`useUSVModelUpdater`** 中的采样与回退顺序

---

## 8. 三维场景中船舶显示：地形高度采样 + 地形深度测试（复盘要点）

本节记录 **为何** 要做这两类改动，便于日后改天地图、换 DEM、或与仿真高度对齐时对照排查。

### 8.1 船舶高度：为何不能只写死椭球高 0？

**现象**：经纬度正确，但船像在「水底 / 地下」，或与影像山体不匹配。

**原因简述**：

- Cesium 里 **`Cartesian3.fromDegrees(lon, lat, h)`** 的 **`h` 为相对 WGS84 椭球的大地高**。
- 天地图 **`GeoTerrainProvider`**（`elv_c`）提供 DEM，地球表面会按真实地形隆起；若模型仍用 **`h = 0`**（或任意常数），相当于把船钉在椭球「数学壳」上，与 DEM **不在同一垂直基准**，视觉上就会埋在三维地表之下。
- 上游 **Ion + World Terrain** 看似「自动对了」，往往是示例或数据中高度来源碰巧一致；换成天地图后仍必须 **显式给出与地形可比的高度**，或用 **`sampleTerrainMostDetailed`** 在当前经纬度取 DEM 椭球高。

**代码路径**：`useUSVModelUpdater.ts`

- 在 **`SAMPLE_TERRAIN_FOR_ALTITUDE === true`**（默认）且 **`terrainProvider` 非纯椭球**时，对船舶所在经纬度调用 **`Cesium.sampleTerrainMostDetailed`**，用采样到的 **`height`（椭球高）** 作为模型高度。
- **采样失败**（地形未就绪、扩展 TerrainProvider 异常等）：退回 **`gpsData.altitude`**（若有效），再退回 **`DEFAULT_LOCATION.altitude`**。
- **`TERRAIN_HEIGHT_OFFSET_METERS`**：在采样高度上再加若干米，用于甲板略高于 DEM「水面」、或抵消水库 DEM 与真实水位差异（可按场景微调）。

**可调参数**（`constants/index.ts` → `CESIUM_CONFIG`）：

| 配置项 | 含义 |
|--------|------|
| `SAMPLE_TERRAIN_FOR_ALTITUDE` | `true`：优先用地形采样高度；`false`：仅用 GPS/默认高度（便于对照仿真纯 GNSS）。 |
| `TERRAIN_HEIGHT_OFFSET_METERS` | 地形采样基础上的垂直偏移（米）。 |

**说明**：开阔水域 DEM 未必等于实时水位；若仍偏差，优先调 **`TERRAIN_HEIGHT_OFFSET_METERS`**，而不是盲目改仿真 `world.sdf` 里的 pose（仿真与地面站显示基准可能不同）。

---

### 8.2 拉近视角船舶「突然没了」：`depthTestAgainstTerrain` 与对数深度缓冲

**现象**：缩小或中等视角能看见船，**地球放大（相机拉近）到一定层级**后整船消失。

**原因简述**：

1. **`globe.depthTestAgainstTerrain = true`** 时，不透明物体与 **高精度 DEM** 一起做深度测试。拉近后视野内 DEM 三角形密度高，深度缓冲多为地形写入。
2. 船舶椭球高若 **略低于** 局部地形网格（GPS/DEM 基准误差、水面插值、尺度抖动等），GPU 会认为船 **完全在山体/水面以下**，从而 **整块被剔除或被地形盖住**，表现为「拉近就没了」。
3. 地球尺度下相机贴近地表时，线性深度缓冲易产生 **z-fighting / 精度不足**，可能加剧异常；开启 **`logarithmicDepthBuffer`** 有助于拉近时的深度稳定性。

**代码对策**（`useCesiumViewer.ts`，Terrain 创建之后）：

- **`viewer.scene.globe.depthTestAgainstTerrain = false`**  
  - **含义**：不对地表地形做「谁挡住谁」的严格深度比较（船舶类 overlay 更不易被 DEM **误判埋在地下**）。  
  - **代价**：极少数斜视角度下，船与山体/建筑的 **物理遮挡**不如真实（地面站通常优先「始终能看见船」，可接受）。
- **`viewer.scene.logarithmicDepthBuffer = true`**  
  - **含义**：减轻大范围地球场景下 **近距离** 的深度精度问题。

若将来需要 **严格贴地、桥下遮挡** 等效果，可再评估：仅对 Entity/Billboard 使用 **`disableDepthTestDistance`**，或对船舶单独分层渲染；当前全局关闭地形深度测试是地面站场景的务实默认。

---

## 9. 复盘检查表（船舶显示专项）

- [ ] 船高度不对：先查 **`SAMPLE_TERRAIN_FOR_ALTITUDE`**、`gpsData.altitude` 数据源、再试 **`TERRAIN_HEIGHT_OFFSET_METERS`**
- [ ] 拉近消失：确认 **`depthTestAgainstTerrain`** 仍为 **`false`**（或与 §8.2 策略一致），且未在某次合并中被改回 **`true`**
