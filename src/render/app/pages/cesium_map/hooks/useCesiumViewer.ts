import { Cesium } from '@render/lib/tianditu-cesium'
import { useEffect, useRef, useState } from 'react'
import yildizusv from '../../../../assets/models/yildizusv.glb'
import { CESIUM_CONFIG, DEFAULT_LOCATION } from '../constants'

type TiandituViewerCtor = new (
  containerId: string,
  options?: ConstructorParameters<typeof Cesium.Viewer>[1],
) => InstanceType<typeof Cesium.Viewer>

export function useCesiumViewer(containerId: string = 'cesiumContainer') {
  const mapviewer = useRef<InstanceType<typeof Cesium.Viewer> | null>(null)
  const usvModelRef = useRef<Cesium.Model | null>(null)
  const pathPositionRef = useRef<Cesium.SampledPositionProperty | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const [viewerReady, setViewerReady] = useState(false)

  const initialPosition = Cesium.Cartesian3.fromDegrees(
    DEFAULT_LOCATION.longitude,
    DEFAULT_LOCATION.latitude,
    DEFAULT_LOCATION.altitude,
  )
  const fixedFrameTransform = Cesium.Transforms.localFrameToFixedFrameGenerator('north', 'west')

  useEffect(() => {
    let viewer: InstanceType<typeof Cesium.Viewer> | null = null

    const initializeCesium = async () => {
      try {
        const tdtk = import.meta.env.VITE_TIANDITU_TOKEN?.trim()
        if (!tdtk) {
          console.error(
            '缺少环境变量 VITE_TIANDITU_TOKEN（天地图开放平台申请的浏览器端 Key）。',
          )
          return
        }

        const subdomains = ['0', '1', '2', '3', '4', '5', '6', '7']

        console.warn('Initializing Cesium (Tianditu 三维)...')

        const MapCtor = (Cesium as unknown as { Map?: TiandituViewerCtor }).Map
        const ViewerCtor = (MapCtor ?? Cesium.Viewer) as TiandituViewerCtor

        viewer = new ViewerCtor(containerId, {
          shouldAnimate: true,
          sceneMode: Cesium.SceneMode.SCENE3D,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          navigationHelpButton: false,
          navigationInstructionsInitiallyVisible: false,
          baseLayerPicker: false,
          imageryProvider: false,
        })

        viewer.imageryLayers.removeAll()

        const imgUrl
          = `https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${tdtk}`
        viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: imgUrl,
            subdomains,
            tilingScheme: new Cesium.WebMercatorTilingScheme(),
            maximumLevel: 18,
            minimumLevel: 1,
          }),
        )

        const iboUrl
          = `https://t{s}.tianditu.gov.cn/DataServer?T=ibo_w&x={x}&y={y}&l={z}&tk=${tdtk}`
        viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: iboUrl,
            subdomains,
            tilingScheme: new Cesium.WebMercatorTilingScheme(),
            maximumLevel: 10,
            minimumLevel: 1,
          }),
        )

        const ciaUrl
          = `https://t{s}.tianditu.gov.cn/DataServer?T=cia_w&x={x}&y={y}&l={z}&tk=${tdtk}`
        viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: ciaUrl,
            subdomains,
            tilingScheme: new Cesium.WebMercatorTilingScheme(),
            maximumLevel: 18,
            minimumLevel: 1,
          }),
        )

        const GeoTerrainProvider = (
          Cesium as unknown as {
            GeoTerrainProvider?: new (opts: {
              urls: string[]
            }) => Cesium.TerrainProvider
          }
        ).GeoTerrainProvider

        if (GeoTerrainProvider) {
          const terrainUrls = subdomains.map(
            s => `https://t${s}.tianditu.gov.cn/mapservice/swdx?T=elv_c&tk=${tdtk}`,
          )
          viewer.terrainProvider = new GeoTerrainProvider({ urls: terrainUrls })
        }
        else {
          console.warn(
            '[Tianditu] GeoTerrainProvider 未注册，请确认 index.html 已加载 Cesium_ext_min.js',
          )
        }

        /**
         * 拉近视角时 DEM 精度远高于粗略的船高等误差：地形片段会先写入深度缓冲，
         * `depthTestAgainstTerrain=true` 会把略微偏低或与地表争抢深度的模型整块盖住，
         * 表现为「放大到一定层级船就没了」。船舶图标更应压住地表而非藏在 DEM 下，
         * 因此对该地面场景关闭「地形深度剔除」（与原 Ion 上常被忽略的 DEM vs 标记误差同源）。
         */
        viewer.scene.globe.depthTestAgainstTerrain = false
        viewer.scene.logarithmicDepthBuffer = true
        viewer.scene.globe.showGroundAtmosphere = true

        mapviewer.current = viewer
        console.warn('Cesium viewer created (Tianditu imagery + DEM terrain)')

        pathPositionRef.current = new Cesium.SampledPositionProperty()

        const pathEntity = viewer.entities.add({
          position: pathPositionRef.current,
          name: 'Path',
          path: {
            show: true,
            trailTime: CESIUM_CONFIG.PATH_TRAIL_TIME,
            width: CESIUM_CONFIG.PATH_WIDTH,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: CESIUM_CONFIG.PATH_GLOW_POWER,
              color: Cesium.Color[CESIUM_CONFIG.PATH_COLOR],
            }),
          },
        })

        console.warn('Path entity created:', pathEntity)

        try {
          usvModelRef.current = await Cesium.Model.fromGltfAsync({
            url: yildizusv,
            modelMatrix: Cesium.Transforms.headingPitchRollToFixedFrame(
              initialPosition,
              new Cesium.HeadingPitchRoll(),
            ),
            scale: CESIUM_CONFIG.MODEL_SCALE,
            minimumPixelSize: CESIUM_CONFIG.MINIMUM_PIXEL_SIZE,
          })

          viewer.scene.primitives.add(usvModelRef.current)
          console.warn('USV Model loaded and added')
        }
        catch (modelError) {
          console.error('USV Model loading error:', modelError)
        }

        setViewerReady(true)
        console.warn('Cesium fully ready')
      }
      catch (error) {
        console.error('❌ Cesium startup error:', error)
      }
    }

    initializeCesium()

    return () => {
      console.warn('Cesium cleanup')
      if (intervalRef.current)
        clearInterval(intervalRef.current)
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy()
      }
    }
  }, [containerId])

  return {
    viewer: mapviewer.current,
    usvModelRef,
    pathPositionRef,
    intervalRef,
    viewerReady,
    initialPosition,
    fixedFrameTransform,
  }
}
