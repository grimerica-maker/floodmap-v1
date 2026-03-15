"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

const CONFIGURED_FLOOD_ENGINE_URL = process.env.NEXT_PUBLIC_FLOOD_ENGINE_URL;
const FLOOD_ENGINE_PROXY_PATH = "/api/engine";
const DEBUG_FLOOD = true;

const MAP_STYLE_URL = "mapbox://styles/mapbox/streets-v12";
const SATELLITE_STYLE_URL = "mapbox://styles/mapbox/satellite-v9";

const FLOOD_TILE_VERSION = "202";
const FLOOD_SOURCE_ID = "flood-source";
const FLOOD_LAYER_ID = "flood-layer";

const IMPACT_SOURCE_ID = "impact-point-source";
const IMPACT_LAYER_ID = "impact-point-layer";
const IMPACT_PREVIEW_SOURCE_ID = "impact-preview-source";
const IMPACT_CRATER_LAYER_ID = "impact-crater-layer";
const IMPACT_BLAST_LAYER_ID = "impact-blast-layer";
const IMPACT_THERMAL_LAYER_ID = "impact-thermal-layer";
const IMPACT_TSUNAMI_LAYER_ID = "impact-tsunami-layer";

const IMPACT_FLOOD_SOURCE_ID = "impact-flood-source";
const IMPACT_FLOOD_LAYER_ID = "impact-flood-layer";
const IMPACT_FLOOD_TILE_VERSION = "22";

const PRESETS = [
  { label: "Ice Age", value: -120 },
  { label: "Modern", value: 0 },
  { label: "Holocene", value: 6 },
  { label: "All Ice Melted", value: 70 },
  { label: "Biblical Flood", value: 3048 },
  { label: "Fully Drained", value: -11000 },
];

const safely = (fn) => {
  try {
    return fn();
  } catch (error) {
    console.warn("Map operation skipped:", error);
    return null;
  }
};

export default function HomePage() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const hoverTimerRef = useRef(null);
  const activeFloodLevelRef = useRef(null);
  const hasAppliedInitialViewModeRef = useRef(false);
  const impactPointRef = useRef(null);
  const impactPulseFrameRef = useRef(null);

  const seaLevelRef = useRef(0);
  const viewModeRef = useRef("map");
  const floodEngineUrlRef = useRef(FLOOD_ENGINE_PROXY_PATH);
  const scenarioModeRef = useRef("flood");
  const impactDiameterRef = useRef(1000);

  const [inputLevel, setInputLevel] = useState(0);
  const [inputText, setInputText] = useState("0");
  const [seaLevel, setSeaLevel] = useState(0);
  const [viewMode, setViewMode] = useState("map");
  const [scenarioMode, setScenarioMode] = useState("flood");
  const [impactDiameter, setImpactDiameter] = useState(1000);
  const [impactResult, setImpactResult] = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState("");
  const [unitMode, setUnitMode] = useState("m");
  const [status, setStatus] = useState("Loading map...");
  const [floodEngineUrl, setFloodEngineUrl] = useState(FLOOD_ENGINE_PROXY_PATH);

  const [hoverLat, setHoverLat] = useState(null);
  const [hoverLng, setHoverLng] = useState(null);
  const [hoverElevation, setHoverElevation] = useState(null);

  useEffect(() => {
    seaLevelRef.current = seaLevel;
  }, [seaLevel]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    floodEngineUrlRef.current = floodEngineUrl;
  }, [floodEngineUrl]);

  useEffect(() => {
    scenarioModeRef.current = scenarioMode;
  }, [scenarioMode]);

  useEffect(() => {
    impactDiameterRef.current = impactDiameter;
  }, [impactDiameter]);

  useEffect(() => {
    if (!CONFIGURED_FLOOD_ENGINE_URL) {
      setFloodEngineUrl(FLOOD_ENGINE_PROXY_PATH);
      return;
    }

    if (
      typeof window !== "undefined" &&
      window.location.protocol === "https:" &&
      CONFIGURED_FLOOD_ENGINE_URL.startsWith("http://")
    ) {
      setFloodEngineUrl(FLOOD_ENGINE_PROXY_PATH);
      return;
    }

    setFloodEngineUrl(CONFIGURED_FLOOD_ENGINE_URL.replace(/\/+$/, ""));
  }, []);

  const metersToFeet = (meters) => meters * 3.28084;
  const feetToMeters = (feet) => feet / 3.28084;

  const formatNumericText = (value, digits = 2) => {
    const rounded = Number(value.toFixed(digits));
    return String(rounded);
  };

  const formatInputTextFromMeters = (meters, unit = unitMode) => {
    if (unit === "ft") return formatNumericText(metersToFeet(meters), 2);
    return formatNumericText(meters, 2);
  };

  const parseDisplayLevelToMeters = (text, unit = unitMode) => {
    const trimmed = String(text ?? "").trim();

    if (
      trimmed === "" ||
      trimmed === "-" ||
      trimmed === "+" ||
      trimmed === "." ||
      trimmed === "-." ||
      trimmed === "+."
    ) {
      return null;
    }

    const parsed = parseFloat(trimmed);
    if (Number.isNaN(parsed)) return null;

    return unit === "ft" ? feetToMeters(parsed) : parsed;
  };

  const commitInputText = (text = inputText, unit = unitMode) => {
    const parsedMeters = parseDisplayLevelToMeters(text, unit);
    if (parsedMeters === null) return null;

    setInputLevel(parsedMeters);
    setInputText(formatInputTextFromMeters(parsedMeters, unit));
    return parsedMeters;
  };

  useEffect(() => {
    setInputText(formatInputTextFromMeters(inputLevel, unitMode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitMode]);

  const formatLevelForDisplay = (meters, unit = unitMode) => {
    if (unit === "ft") {
      const feet = Math.round(metersToFeet(meters));
      return `${feet > 0 ? "+" : ""}${feet} ft`;
    }
    return `${meters > 0 ? "+" : ""}${Math.round(meters)} m`;
  };

  const formatCompactCount = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return "--";
    return Math.round(n).toLocaleString();
  };

  const floodAllowedInCurrentView = () =>
    viewModeRef.current === "map" ||
    viewModeRef.current === "satellite" ||
    viewModeRef.current === "globe";

  const isMapReady = () => {
    const map = mapRef.current;
    return !!map && map.isStyleLoaded();
  };

  const applyProjectionForMode = (mode) => {
    const map = mapRef.current;
    if (!map) return;

    if (mode === "globe") {
      safely(() => map.setProjection("globe"));
      safely(() => map.setPitch(0));
      safely(() => map.setBearing(0));
      safely(() => map.dragRotate.enable());
      safely(() => map.touchZoomRotate.enableRotation());
      return;
    }

    safely(() => map.setProjection("mercator"));
    safely(() => map.setPitch(0));
    safely(() => map.setBearing(0));
    safely(() => map.dragRotate.disable());
    safely(() => map.touchZoomRotate.disableRotation());
  };

  const removeFloodLayer = () => {
    const map = mapRef.current;
    if (!map) {
      activeFloodLevelRef.current = null;
      return;
    }

    try {
      if (map.getLayer(FLOOD_LAYER_ID)) map.removeLayer(FLOOD_LAYER_ID);
      if (map.getSource(FLOOD_SOURCE_ID)) map.removeSource(FLOOD_SOURCE_ID);
    } catch (error) {
      console.warn("Failed removing flood layer:", error);
    }

    activeFloodLevelRef.current = null;
  };

  const removeImpactFloodLayer = () => {
    const map = mapRef.current;
    if (!map) return;

    try {
      if (map.getLayer(IMPACT_FLOOD_LAYER_ID)) {
        map.removeLayer(IMPACT_FLOOD_LAYER_ID);
      }
      if (map.getSource(IMPACT_FLOOD_SOURCE_ID)) {
        map.removeSource(IMPACT_FLOOD_SOURCE_ID);
      }
    } catch (error) {
      console.warn("Failed removing impact flood layer:", error);
    }
  };

  const getFirstSymbolLayerId = () => {
    const map = mapRef.current;
    if (!map) return undefined;
    const layers = map.getStyle()?.layers || [];
    const firstSymbol = layers.find((layer) => layer.type === "symbol");
    return firstSymbol?.id;
  };

  const addImpactFloodLayer = (runId) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !runId) return false;

    const tileUrl = `${floodEngineUrlRef.current}/impact-flood/${encodeURIComponent(
      runId
    )}/{z}/{x}/{y}.png?v=${IMPACT_FLOOD_TILE_VERSION}`;

    console.log("Adding impact flood layer:", { runId, tileUrl });

    try {
      removeImpactFloodLayer();

      map.addSource(IMPACT_FLOOD_SOURCE_ID, {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 22,
      });

      const beforeId = getFirstSymbolLayerId();

      map.addLayer(
        {
          id: IMPACT_FLOOD_LAYER_ID,
          type: "raster",
          source: IMPACT_FLOOD_SOURCE_ID,
          paint: {
            "raster-opacity": 0.95,
            "raster-fade-duration": 0,
            "raster-resampling": "linear",
          },
        },
        beforeId
      );

      safely(() => map.triggerRepaint());
      return true;
    } catch (error) {
      console.error("Failed to add impact flood layer", error);
      return false;
    }
  };

  const startImpactPulseAnimation = () => {
    const map = mapRef.current;
    if (!map) return;

    if (impactPulseFrameRef.current) {
      cancelAnimationFrame(impactPulseFrameRef.current);
      impactPulseFrameRef.current = null;
    }

    const layerId = `${IMPACT_CRATER_LAYER_ID}-pulse`;
    const start = performance.now();

    const tick = (now) => {
      if (!mapRef.current || !mapRef.current.getLayer(layerId)) {
        impactPulseFrameRef.current = null;
        return;
      }

      const t = (now - start) / 1000;
      const width = 2.5 + Math.sin(t * 2.6) * 0.8;
      const opacity = 0.72 + ((Math.sin(t * 2.6) + 1) / 2) * 0.22;

      safely(() =>
        mapRef.current.setPaintProperty(layerId, "line-width", width)
      );
      safely(() =>
        mapRef.current.setPaintProperty(layerId, "line-opacity", opacity)
      );

      impactPulseFrameRef.current = requestAnimationFrame(tick);
    };

    impactPulseFrameRef.current = requestAnimationFrame(tick);
  };

  const clearImpactPreview = () => {
    const map = mapRef.current;
    if (!map) return;

    if (impactPulseFrameRef.current) {
      cancelAnimationFrame(impactPulseFrameRef.current);
      impactPulseFrameRef.current = null;
    }

    removeImpactFloodLayer();

    const extraLayerIds = [
      `${IMPACT_CRATER_LAYER_ID}-pulse`,
      `${IMPACT_CRATER_LAYER_ID}-inner`,
      `${IMPACT_CRATER_LAYER_ID}-rim`,
      `${IMPACT_CRATER_LAYER_ID}-ejecta`,
      `${IMPACT_BLAST_LAYER_ID}-fill`,
      `${IMPACT_TSUNAMI_LAYER_ID}-line`,
      IMPACT_TSUNAMI_LAYER_ID,
      IMPACT_THERMAL_LAYER_ID,
      IMPACT_BLAST_LAYER_ID,
      IMPACT_CRATER_LAYER_ID,
    ];

    try {
      extraLayerIds.forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });

      if (map.getSource(IMPACT_PREVIEW_SOURCE_ID)) {
        map.removeSource(IMPACT_PREVIEW_SOURCE_ID);
      }
    } catch (error) {
      console.warn("Failed clearing impact preview:", error);
    }
  };

  const removeImpactPoint = () => {
    const map = mapRef.current;
    if (!map) {
      impactPointRef.current = null;
      return;
    }

    try {
      if (map.getLayer(IMPACT_LAYER_ID)) map.removeLayer(IMPACT_LAYER_ID);
      if (map.getSource(IMPACT_SOURCE_ID)) map.removeSource(IMPACT_SOURCE_ID);
    } catch (error) {
      console.warn("Failed removing impact point:", error);
    }

    clearImpactPreview();
    impactPointRef.current = null;
  };

  const drawImpactPoint = (lng, lat) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const data = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
        },
      ],
    };

    try {
      if (!map.getSource(IMPACT_SOURCE_ID)) {
        map.addSource(IMPACT_SOURCE_ID, {
          type: "geojson",
          data,
        });

        map.addLayer({
          id: IMPACT_LAYER_ID,
          type: "circle",
          source: IMPACT_SOURCE_ID,
          paint: {
            "circle-radius": 8,
            "circle-color": "#ef4444",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
      } else {
        map.getSource(IMPACT_SOURCE_ID).setData(data);
      }

      impactPointRef.current = { lng, lat };
      safely(() => map.triggerRepaint());
    } catch (error) {
      console.error("Failed to draw impact point", error);
    }
  };

  const kmCircle = (lng, lat, radiusKm, steps = 96) => {
    const coords = [];
    const latRad = (lat * Math.PI) / 180;
    const kmPerDegLat = 110.574;
    const kmPerDegLng = 111.32 * Math.cos(latRad);

    for (let i = 0; i <= steps; i += 1) {
      const t = (i / steps) * Math.PI * 2;
      const dx = Math.cos(t) * radiusKm;
      const dy = Math.sin(t) * radiusKm;

      coords.push([
        lng + dx / Math.max(kmPerDegLng, 0.0001),
        lat + dy / kmPerDegLat,
      ]);
    }

    return {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [coords],
      },
      properties: {},
    };
  };

  const getImpactPreviewRadiiKm = (diameterM) => {
    const d = Math.max(50, Math.min(20000, Number(diameterM) || 1000));

    return {
      crater: Math.max(0.25, d * 0.0006),
      blast: Math.max(1.0, d * 0.006),
      thermal: Math.max(2.0, d * 0.012),
    };
  };

  const drawImpactPreview = (lng, lat, diameterM) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    removeImpactFloodLayer();

    const radii = getImpactPreviewRadiiKm(diameterM);

    const data = {
      type: "FeatureCollection",
      features: [
        { ...kmCircle(lng, lat, radii.crater), properties: { kind: "crater" } },
        { ...kmCircle(lng, lat, radii.blast), properties: { kind: "blast" } },
        {
          ...kmCircle(lng, lat, radii.thermal),
          properties: { kind: "thermal" },
        },
      ],
    };

    try {
      if (!map.getSource(IMPACT_PREVIEW_SOURCE_ID)) {
        map.addSource(IMPACT_PREVIEW_SOURCE_ID, {
          type: "geojson",
          data,
        });

        map.addLayer({
          id: IMPACT_THERMAL_LAYER_ID,
          type: "fill",
          source: IMPACT_PREVIEW_SOURCE_ID,
          filter: ["==", ["get", "kind"], "thermal"],
          paint: {
            "fill-color": "#111111",
            "fill-opacity": 0.22,
          },
        });

        map.addLayer({
          id: IMPACT_BLAST_LAYER_ID,
          type: "line",
          source: IMPACT_PREVIEW_SOURCE_ID,
          filter: ["==", ["get", "kind"], "blast"],
          paint: {
            "line-color": "#ef4444",
            "line-width": 3,
            "line-opacity": 1,
          },
        });

        map.addLayer({
          id: IMPACT_CRATER_LAYER_ID,
          type: "fill",
          source: IMPACT_PREVIEW_SOURCE_ID,
          filter: ["==", ["get", "kind"], "crater"],
          paint: {
            "fill-color": "#000000",
            "fill-opacity": 0.55,
          },
        });
      } else {
        map.getSource(IMPACT_PREVIEW_SOURCE_ID).setData(data);
      }

      safely(() => map.triggerRepaint());
    } catch (error) {
      console.error("Failed to draw impact preview", error);
    }
  };

  const drawLandImpactFromResult = (lng, lat, result) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !result) return;

    const craterKm = Number(result.crater_diameter_m ?? 0) / 2000;
    const blastKm = Number(result.blast_radius_m ?? 0) / 1000;
    const thermalKm = Number(result.thermal_radius_m ?? 0) / 1000;

    const craterInnerKm = craterKm * 0.72;
    const craterRimKm = craterKm * 1.08;
    const ejectaKm = craterKm * 1.55;
    const blastFillKm = blastKm;

    const data = {
      type: "FeatureCollection",
      features: [
        {
          ...kmCircle(lng, lat, thermalKm),
          properties: { kind: "thermal" },
        },
        {
          ...kmCircle(lng, lat, blastFillKm),
          properties: { kind: "blast-fill" },
        },
        {
          ...kmCircle(lng, lat, blastKm),
          properties: { kind: "blast" },
        },
        {
          ...kmCircle(lng, lat, ejectaKm),
          properties: { kind: "ejecta" },
        },
        {
          ...kmCircle(lng, lat, craterRimKm),
          properties: { kind: "crater-rim" },
        },
        {
          ...kmCircle(lng, lat, craterKm),
          properties: { kind: "crater" },
        },
        {
          ...kmCircle(lng, lat, craterInnerKm),
          properties: { kind: "crater-inner" },
        },
      ],
    };

    try {
      clearImpactPreview();

      map.addSource(IMPACT_PREVIEW_SOURCE_ID, {
        type: "geojson",
        data,
      });

      map.addLayer({
        id: IMPACT_THERMAL_LAYER_ID,
        type: "fill",
        source: IMPACT_PREVIEW_SOURCE_ID,
        filter: ["==", ["get", "kind"], "thermal"],
        paint: {
          "fill-color": "#111111",
          "fill-opacity": 0.35,
        },
      });

      map.addLayer({
        id: `${IMPACT_BLAST_LAYER_ID}-fill`,
        type: "fill",
        source: IMPACT_PREVIEW_SOURCE_ID,
        filter: ["==", ["get", "kind"], "blast-fill"],
        paint: {
          "fill-color": "#7f1d1d",
          "fill-opacity": 0.12,
        },
      });

      map.addLayer({
        id: IMPACT_BLAST_LAYER_ID,
        type: "line",
        source: IMPACT_PREVIEW_SOURCE_ID,
        filter: ["==", ["get", "kind"], "blast"],
        paint: {
          "line-color": "#dc2626",
          "line-width": 3,
          "line-opacity": 1,
        },
      });

      map.addLayer({
        id: `${IMPACT_CRATER_LAYER_ID}-ejecta`,
        type: "fill",
        source: IMPACT_PREVIEW_SOURCE_ID,
        filter: ["==", ["get", "kind"], "ejecta"],
        paint: {
          "fill-color": "#3b2a22",
          "fill-opacity": 0.18,
        },
      });

      map.addLayer({
        id: `${IMPACT_CRATER_LAYER_ID}-rim`,
        type: "fill",
        source: IMPACT_PREVIEW_SOURCE_ID,
        filter: ["==", ["get", "kind"], "crater-rim"],
        paint: {
          "fill-color": "#1a0f0f",
          "fill-opacity": 0.3,
        },
      });

      map.addLayer({
        id: IMPACT_CRATER_LAYER_ID,
        type: "fill",
        source: IMPACT_PREVIEW_SOURCE_ID,
        filter: ["==", ["get", "kind"], "crater"],
        paint: {
          "fill-color": "#000000",
          "fill-opacity": 0.85,
        },
      });

      map.addLayer({
        id: `${IMPACT_CRATER_LAYER_ID}-inner`,
        type: "fill",
        source: IMPACT_PREVIEW_SOURCE_ID,
        filter: ["==", ["get", "kind"], "crater-inner"],
        paint: {
          "fill-color": "#000000",
          "fill-opacity": 0.55,
        },
      });

      map.addLayer({
        id: `${IMPACT_CRATER_LAYER_ID}-pulse`,
        type: "line",
        source: IMPACT_PREVIEW_SOURCE_ID,
        filter: ["==", ["get", "kind"], "crater-rim"],
        paint: {
          "line-color": "#ef4444",
          "line-width": 3,
          "line-opacity": 0.9,
        },
      });

      safely(() => map.triggerRepaint());
      startImpactPulseAnimation();
    } catch (error) {
      console.error("Failed to draw land impact result", error);
    }
  };

  const drawOceanImpactFromResult = (lng, lat, result) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !result) return;

    if (result.is_ocean_impact !== true) {
      drawLandImpactFromResult(lng, lat, result);
      return;
    }

    const blastKm = Number(result.blast_radius_m ?? 0) / 1000;
    const thermalKm = Number(result.thermal_radius_m ?? 0) / 1000;

    try {
      clearImpactPreview();

      const data = {
        type: "FeatureCollection",
        features: [
          {
            ...kmCircle(lng, lat, blastKm),
            properties: { kind: "blast" },
          },
          {
            ...kmCircle(lng, lat, thermalKm),
            properties: { kind: "thermal" },
          },
        ],
      };

      map.addSource(IMPACT_PREVIEW_SOURCE_ID, {
        type: "geojson",
        data,
      });

      map.addLayer({
        id: IMPACT_THERMAL_LAYER_ID,
        type: "fill",
        source: IMPACT_PREVIEW_SOURCE_ID,
        filter: ["==", ["get", "kind"], "thermal"],
        paint: {
          "fill-color": "#111111",
          "fill-opacity": 0.18,
        },
      });

      map.addLayer({
        id: IMPACT_BLAST_LAYER_ID,
        type: "line",
        source: IMPACT_PREVIEW_SOURCE_ID,
        filter: ["==", ["get", "kind"], "blast"],
        paint: {
          "line-color": "#ef4444",
          "line-width": 2,
          "line-opacity": 0.9,
        },
      });

      safely(() => map.triggerRepaint());
    } catch (error) {
      console.error("Failed to draw ocean impact result", error);
    }
  };

  const addFloodLayer = (level) => {
    const map = mapRef.current;

    if (!map) {
      console.warn("addFloodLayer: map missing");
      return false;
    }

    if (!map.isStyleLoaded()) {
      console.warn("addFloodLayer: style not loaded yet");
      return false;
    }

    if (!floodAllowedInCurrentView()) {
      console.warn("addFloodLayer: flood not allowed in this view");
      return false;
    }

    const normalizedLevel = Number(level);
    if (!Number.isFinite(normalizedLevel) || normalizedLevel === 0) {
      console.warn("addFloodLayer: invalid level", level);
      return false;
    }

    const tileUrl = `${floodEngineUrlRef.current}/flood/${encodeURIComponent(
      normalizedLevel
    )}/{z}/{x}/{y}.png?v=${FLOOD_TILE_VERSION}`;

    console.log("Adding flood layer:", tileUrl);

    try {
      if (
        activeFloodLevelRef.current === normalizedLevel &&
        map.getLayer(FLOOD_LAYER_ID) &&
        map.getSource(FLOOD_SOURCE_ID)
      ) {
        console.log("Flood layer already active:", normalizedLevel);
        return true;
      }

      if (map.getLayer(FLOOD_LAYER_ID)) {
        map.removeLayer(FLOOD_LAYER_ID);
      }
      if (map.getSource(FLOOD_SOURCE_ID)) {
        map.removeSource(FLOOD_SOURCE_ID);
      }

      map.addSource(FLOOD_SOURCE_ID, {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 22,
      });

      map.addLayer({
        id: FLOOD_LAYER_ID,
        type: "raster",
        source: FLOOD_SOURCE_ID,
        paint: {
          "raster-opacity": 1,
          "raster-fade-duration": 0,
          "raster-resampling": "linear",
        },
      });

      activeFloodLevelRef.current = normalizedLevel;

      map.once("idle", () => {
        console.log("Flood layer idle for level:", normalizedLevel);
        setStatus(
          `Flood tiles loaded at ${formatLevelForDisplay(normalizedLevel)}`
        );
      });

      safely(() => map.triggerRepaint());
      return true;
    } catch (error) {
      console.error("Failed to add flood layer", error);
      activeFloodLevelRef.current = null;
      return false;
    }
  };

  const syncFloodScenario = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (scenarioModeRef.current !== "flood") return;

    if (!floodAllowedInCurrentView()) {
      removeFloodLayer();
      return;
    }

    const level = Number(seaLevelRef.current);
    if (!Number.isFinite(level) || level === 0) {
      removeFloodLayer();
      return;
    }

    addFloodLayer(level);
  };

  const applyStyleMode = (mode) => {
    const map = mapRef.current;
    if (!map) return;

    if (mode === "satellite") {
      map.setStyle(SATELLITE_STYLE_URL);
      map.easeTo({
        center: [-80.19, 25.76],
        zoom: 6.2,
        duration: 250,
        essential: true,
      });
      return;
    }

    map.setStyle(MAP_STYLE_URL);
    map.easeTo({
      center: mode === "globe" ? [0, 20] : [-80.19, 25.76],
      zoom: mode === "globe" ? 1.6 : 6.2,
      duration: 250,
      essential: true,
    });
  };

  const executeFlood = () => {
    console.log("Execute Flood clicked", {
      inputText,
      unitMode,
      viewMode: viewModeRef.current,
      engine: floodEngineUrlRef.current,
    });

    const parsedLevel = commitInputText(inputText, unitMode);

    if (parsedLevel === null) {
      setStatus("Enter a valid sea level first");
      return;
    }

    const level = Number(parsedLevel);

    setSeaLevel(level);
    seaLevelRef.current = level;
    setInputLevel(level);
    setScenarioMode("flood");

    if (!floodAllowedInCurrentView()) {
      removeFloodLayer();
      setStatus("Switch to a supported view mode");
      return;
    }

    if (level === 0) {
      removeFloodLayer();
      setStatus("Flood cleared");
      return;
    }

    if (!mapRef.current) {
      setStatus("Map not ready");
      return;
    }

    if (!mapRef.current.isStyleLoaded()) {
      setStatus("Map style still loading...");
      return;
    }

    removeImpactPoint();
    setImpactResult(null);
    setImpactError("");
    setStatus(`Loading flood tiles at ${formatLevelForDisplay(level)}...`);

    const added = addFloodLayer(level);

    if (!added) {
      setStatus("Flood layer failed to attach");
    }
  };

  const runImpact = async () => {
    if (!impactPointRef.current) {
      setStatus("Place impact point first");
      return;
    }

    try {
      setImpactLoading(true);
      setImpactError("");

      const { lng, lat } = impactPointRef.current;

      const res = await fetch(
        `${floodEngineUrlRef.current}/impact?lat=${lat}&lng=${lng}&diameter=${impactDiameter}`
      );

      if (!res.ok) {
        throw new Error("Impact request failed");
      }

      const data = await res.json();
      console.log("Impact response:", data);

      setImpactResult(data);

      if (!impactPointRef.current) return;

      if (
        data.is_ocean_impact === true &&
        Number(data.tsunami_radius_m ?? 0) > 0
      ) {
        drawOceanImpactFromResult(
          impactPointRef.current.lng,
          impactPointRef.current.lat,
          data
        );

        if (data.run_id) {
          const added = addImpactFloodLayer(data.run_id);
          if (!added) {
            console.warn("Impact flood layer did not attach");
          }
        } else {
          console.warn("Impact response missing run_id");
        }
      } else {
        drawLandImpactFromResult(
          impactPointRef.current.lng,
          impactPointRef.current.lat,
          data
        );
      }

      setStatus("Impact simulation complete");
    } catch (err) {
      console.error(err);
      setImpactError("Impact simulation failed");
      setStatus("Impact simulation failed");
      removeImpactFloodLayer();
    } finally {
      setImpactLoading(false);
    }
  };

  const clearFlood = () => {
    setInputLevel(0);
    setInputText("0");
    setSeaLevel(0);
    seaLevelRef.current = 0;
    removeFloodLayer();
    if (scenarioModeRef.current === "impact") {
      removeImpactPoint();
      setImpactResult(null);
      setImpactError("");
    }
    setStatus("Flood cleared");
  };

  const fetchElevation = async (lat, lng) => {
    try {
      const res = await fetch(
        `${floodEngineUrlRef.current}/elevation?lat=${encodeURIComponent(
          lat
        )}&lng=${encodeURIComponent(lng)}`
      );

      if (!res.ok) {
        setHoverElevation(null);
        return;
      }

      const data = await res.json();
      setHoverElevation(data.elevation_m);
    } catch {
      setHoverElevation(null);
    }
  };

  useEffect(() => {
    if (mapRef.current || !floodEngineUrl) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLE_URL,
      center: [-80.19, 25.76],
      zoom: 6.2,
      antialias: false,
      attributionControl: true,
      collectResourceTiming: false,
      transformRequest: (url, resourceType) => {
        if (resourceType === "Tile" && url.includes("/flood/")) {
          console.log("FLOOD TILE:", url);
        }
        if (resourceType === "Tile" && url.includes("/impact-flood/")) {
          console.log("IMPACT FLOOD TILE:", url);
        }
        return { url };
      },
    });

    mapRef.current = map;
    applyProjectionForMode("map");

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.getCanvas().style.cursor = "crosshair";

    if (DEBUG_FLOOD) {
      map.on("error", (e) => {
        const message = e?.error?.message || e?.message || "";
        console.log("Map error:", e, message);
      });
      map.on("sourcedata", (e) => {
        if (e.sourceId === FLOOD_SOURCE_ID) {
          console.log("Flood sourcedata:", {
            isSourceLoaded: e.isSourceLoaded,
            sourceId: e.sourceId,
            sourceDataType: e.sourceDataType,
          });
        }
        if (e.sourceId === IMPACT_FLOOD_SOURCE_ID) {
          console.log("Impact flood sourcedata:", {
            isSourceLoaded: e.isSourceLoaded,
            sourceId: e.sourceId,
            sourceDataType: e.sourceDataType,
          });
        }
      });
    }

    const handleStyleLoad = () => {
      console.log("style.load fired");
      applyProjectionForMode(viewModeRef.current);
      activeFloodLevelRef.current = null;

      if (
        scenarioModeRef.current === "flood" &&
        Number(seaLevelRef.current) !== 0 &&
        floodAllowedInCurrentView()
      ) {
        setTimeout(() => {
          syncFloodScenario();
        }, 50);
      } else {
        removeFloodLayer();
      }
    };

    const handleMapLoad = () => {
      console.log("map load fired");
      applyProjectionForMode(viewModeRef.current);

      fetch(`${floodEngineUrlRef.current}/`)
        .then((r) => r.json())
        .then((d) => console.log("Engine health:", d))
        .catch((e) => console.error("Engine unreachable", e));

      setStatus("Map ready");
    };

    const handleMouseMove = (e) => {
      const lat = Number(e.lngLat.lat.toFixed(5));
      const lng = Number(e.lngLat.lng.toFixed(5));

      setHoverLat(lat);
      setHoverLng(lng);

      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        fetchElevation(lat, lng);
      }, 120);
    };

    const handleMouseLeave = () => {
      setHoverLat(null);
      setHoverLng(null);
      setHoverElevation(null);
    };

    const handleMapClick = (e) => {
      if (scenarioModeRef.current !== "impact") return;

      const lng = e.lngLat.lng;
      const lat = e.lngLat.lat;
      drawImpactPoint(lng, lat);
      drawImpactPreview(lng, lat, impactDiameterRef.current);
      setImpactResult(null);
      setImpactError("");
      setStatus("Impact preview ready");
    };

    map.on("load", handleMapLoad);
    map.on("style.load", handleStyleLoad);
    map.on("mousemove", handleMouseMove);
    map.on("mouseleave", handleMouseLeave);
    map.on("click", handleMapClick);

    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (impactPulseFrameRef.current) {
        cancelAnimationFrame(impactPulseFrameRef.current);
        impactPulseFrameRef.current = null;
      }

      map.off("load", handleMapLoad);
      map.off("style.load", handleStyleLoad);
      map.off("mousemove", handleMouseMove);
      map.off("mouseleave", handleMouseLeave);
      map.off("click", handleMapClick);

      map.remove();
      mapRef.current = null;
      activeFloodLevelRef.current = null;
      impactPointRef.current = null;
      hasAppliedInitialViewModeRef.current = false;
    };
  }, [floodEngineUrl]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!hasAppliedInitialViewModeRef.current) {
      hasAppliedInitialViewModeRef.current = true;
      return;
    }

    applyStyleMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (scenarioMode === "impact") {
      removeFloodLayer();
      setStatus(
        impactPointRef.current
          ? "Impact preview ready"
          : "Click map to place impact point"
      );
      return;
    }

    removeImpactPoint();
    setImpactResult(null);
    setImpactError("");
    syncFloodScenario();
  }, [scenarioMode]);

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;

    if (
      scenarioMode === "impact" &&
      impactResult &&
      impactResult.is_ocean_impact === true &&
      Number(impactResult.tsunami_radius_m ?? 0) > 0 &&
      impactResult.run_id
    ) {
      addImpactFloodLayer(impactResult.run_id);
      return;
    }

    removeImpactFloodLayer();
  }, [impactResult, scenarioMode, viewMode]);

  useEffect(() => {
    if (scenarioMode !== "impact") return;
    if (!impactPointRef.current) return;
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;

    if (impactResult) {
      if (
        impactResult.is_ocean_impact === true &&
        Number(impactResult.tsunami_radius_m ?? 0) > 0
      ) {
        drawOceanImpactFromResult(
          impactPointRef.current.lng,
          impactPointRef.current.lat,
          impactResult
        );
        return;
      }

      drawLandImpactFromResult(
        impactPointRef.current.lng,
        impactPointRef.current.lat,
        impactResult
      );
      return;
    }

    drawImpactPreview(
      impactPointRef.current.lng,
      impactPointRef.current.lat,
      impactDiameterRef.current
    );
  }, [impactDiameter, scenarioMode, impactResult]);

  useEffect(() => {
    if (scenarioMode !== "impact") return;
    setImpactResult(null);
    setImpactError("");
    removeImpactFloodLayer();
  }, [impactDiameter]);

  useEffect(() => {
    if (!isMapReady()) return;
    if (scenarioMode !== "flood") return;
    syncFloodScenario();
  }, [seaLevel, viewMode, scenarioMode]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (scenarioMode === "impact") {
      setStatus(
        impactPointRef.current
          ? impactLoading
            ? "Running impact simulation..."
            : impactResult
            ? "Impact simulation complete"
            : "Impact preview ready"
          : "Click map to place impact point"
      );
      return;
    }

    if (viewMode === "globe" && seaLevel === 0) {
      setStatus("Globe mode");
      return;
    }

    if (seaLevel === 0) {
      setStatus("Flood cleared");
      return;
    }

    setStatus(`Flood tiles loaded at ${formatLevelForDisplay(seaLevel)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, seaLevel, unitMode, scenarioMode, impactLoading, impactResult]);

  const waterDifference =
    hoverElevation !== null
      ? Number((hoverElevation - seaLevel).toFixed(2))
      : null;

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        ref={mapContainer}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
        }}
      />

      <div
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 340,
          height: "100%",
          background: "rgba(249,250,251,0.97)",
          borderRight: "1px solid #e5e7eb",
          padding: 16,
          fontFamily: "Arial, sans-serif",
          zIndex: 1000,
          overflowY: "auto",
          pointerEvents: "auto",
        }}
      >
        <h1 style={{ margin: "8px 0 24px 0", fontSize: 22 }}>Floodmap V1</h1>

        <div style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
          Mapbox flood + impact foundation build
        </div>

        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
          SEA LEVEL
        </div>

        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 12,
            color:
              seaLevel > 0
                ? "#0f62fe"
                : seaLevel < 0
                ? "#b45309"
                : "#111827",
          }}
        >
          {formatLevelForDisplay(seaLevel)}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => setUnitMode("m")}
            style={{
              flex: 1,
              padding: "10px 8px",
              border: "1px solid #d1d5db",
              background: unitMode === "m" ? "#0f172a" : "white",
              color: unitMode === "m" ? "white" : "#111827",
              cursor: "pointer",
              borderRadius: 10,
              fontWeight: 700,
            }}
          >
            Meters
          </button>

          <button
            onClick={() => setUnitMode("ft")}
            style={{
              flex: 1,
              padding: "10px 8px",
              border: "1px solid #d1d5db",
              background: unitMode === "ft" ? "#0f172a" : "white",
              color: unitMode === "ft" ? "white" : "#111827",
              cursor: "pointer",
              borderRadius: 10,
              fontWeight: 700,
            }}
          >
            Feet
          </button>
        </div>

        <input
          type="text"
          inputMode="decimal"
          placeholder={
            unitMode === "ft"
              ? "Enter sea level in feet"
              : "Enter sea level in meters"
          }
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
          }}
          onBlur={() => {
            const committed = commitInputText(inputText, unitMode);
            if (committed !== null) {
              setInputLevel(committed);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") executeFlood();
          }}
          style={{
            width: "100%",
            padding: 12,
            fontSize: 18,
            border: "1px solid #ccc",
            marginBottom: 12,
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <button
            onClick={executeFlood}
            style={{
              flex: 1,
              padding: "12px 10px",
              background: "#0f172a",
              color: "white",
              border: "none",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Execute Flood
          </button>

          <button
            onClick={clearFlood}
            style={{
              flex: 1,
              padding: "12px 10px",
              background: "white",
              color: "#111827",
              border: "1px solid #ccc",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>

        <div style={{ fontSize: 14, marginBottom: 24 }}>
          Custom input supports positive and negative values in{" "}
          {unitMode === "ft" ? "feet" : "meters"}
        </div>

        <hr style={{ margin: "0 0 18px 0" }} />

        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
          PRESETS
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 28,
          }}
        >
          {PRESETS.map((preset) => {
            const active = Math.round(inputLevel) === Math.round(preset.value);
            const presetLabel =
              unitMode === "ft"
                ? `${Math.round(metersToFeet(preset.value)) > 0 ? "+" : ""}${Math.round(
                    metersToFeet(preset.value)
                  )}ft`
                : `${preset.value > 0 ? "+" : ""}${preset.value}m`;

            return (
              <button
                key={preset.label}
                onClick={() => {
                  setInputLevel(preset.value);
                  setInputText(
                    formatInputTextFromMeters(preset.value, unitMode)
                  );
                }}
                style={{
                  padding: "12px 10px",
                  border: "1px solid #d1d5db",
                  background: active ? "#0f172a" : "white",
                  color: active ? "white" : "#111827",
                  cursor: "pointer",
                  borderRadius: 12,
                  fontWeight: 700,
                }}
              >
                <div>{preset.label}</div>
                <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
                  {presetLabel}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
          SCENARIO MODE
        </div>

        <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
          <button
            onClick={() => setScenarioMode("flood")}
            style={{
              width: "100%",
              padding: 14,
              border: "1px solid #d1d5db",
              background: scenarioMode === "flood" ? "#0f172a" : "white",
              color: scenarioMode === "flood" ? "white" : "#111827",
              cursor: "pointer",
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            <div>Flood</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
              Sea level up / down
            </div>
          </button>

          <button
            onClick={() => setScenarioMode("impact")}
            style={{
              width: "100%",
              padding: 14,
              border: "1px solid #d1d5db",
              background: scenarioMode === "impact" ? "#0f172a" : "white",
              color: scenarioMode === "impact" ? "white" : "#111827",
              cursor: "pointer",
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            <div>Impact</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
              Click map to place impact point
            </div>
          </button>
        </div>

        {scenarioMode === "impact" && (
          <>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
              ASTEROID SIZE
            </div>

            <input
              type="range"
              min="50"
              max="20000"
              step="50"
              value={impactDiameter}
              onChange={(e) => setImpactDiameter(Number(e.target.value))}
              style={{ width: "100%", marginBottom: 10 }}
            />

            <input
              type="number"
              min="50"
              max="20000"
              step="50"
              value={impactDiameter}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isFinite(next)) {
                  setImpactDiameter(Math.max(50, Math.min(20000, next)));
                }
              }}
              style={{
                width: "100%",
                padding: 12,
                fontSize: 18,
                border: "1px solid #ccc",
                marginBottom: 20,
                boxSizing: "border-box",
              }}
            />

            <div style={{ fontSize: 14, marginBottom: 24 }}>
              Diameter: <b>{impactDiameter.toLocaleString()} m</b>
            </div>

            <button
              onClick={runImpact}
              disabled={!impactPointRef.current || impactLoading}
              style={{
                width: "100%",
                padding: 14,
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: 10,
                fontWeight: 700,
                cursor: "pointer",
                marginBottom: 20,
                opacity: !impactPointRef.current || impactLoading ? 0.7 : 1,
              }}
            >
              {impactLoading ? "Running..." : "Run Impact"}
            </button>
          </>
        )}

        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
          VIEW MODE
        </div>

        <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
          <button
            onClick={() => setViewMode("map")}
            style={{
              width: "100%",
              padding: 14,
              border: "1px solid #d1d5db",
              background: viewMode === "map" ? "#0f172a" : "white",
              color: viewMode === "map" ? "white" : "#111827",
              cursor: "pointer",
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            <div>Standard Map</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
              Flood tiles active
            </div>
          </button>

          <button
            onClick={() => setViewMode("satellite")}
            style={{
              width: "100%",
              padding: 14,
              border: "1px solid #d1d5db",
              background: viewMode === "satellite" ? "#0f172a" : "white",
              color: viewMode === "satellite" ? "white" : "#111827",
              cursor: "pointer",
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            <div>Satellite View</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
              Flood overlay supported
            </div>
          </button>

          <button
            onClick={() => setViewMode("globe")}
            style={{
              width: "100%",
              padding: 14,
              border: "1px solid #d1d5db",
              background: viewMode === "globe" ? "#0f172a" : "white",
              color: viewMode === "globe" ? "white" : "#111827",
              cursor: "pointer",
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            <div>Globe View</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
              Flood overlay supported
            </div>
          </button>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 20,
          top: 10,
          background: "#1e3a5f",
          color: "white",
          padding: 16,
          borderRadius: 12,
          fontSize: 14,
          lineHeight: 1.45,
          zIndex: 1000,
          minWidth: 320,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          Current Scenario
        </div>
        <div>Sea level: {formatLevelForDisplay(seaLevel)}</div>
        <div>
          Mode:{" "}
          {viewMode === "map"
            ? "Standard Map"
            : viewMode === "satellite"
            ? "Satellite"
            : "Globe"}
        </div>
        <div>Status: {status}</div>
        <div>Scenario Mode: {scenarioMode}</div>
        <div>
          Impact Point:{" "}
          {impactPointRef.current
            ? `${impactPointRef.current.lng.toFixed(3)}, ${impactPointRef.current.lat.toFixed(3)}`
            : "--"}
        </div>
        <div>Asteroid Diameter: {impactDiameter.toLocaleString()} m</div>

        {impactError && (
          <>
            <hr style={{ margin: "10px 0", opacity: 0.25 }} />
            <div style={{ color: "#fecaca", fontWeight: 700 }}>
              {impactError}
            </div>
          </>
        )}

        {impactResult && (
          <>
            <hr style={{ margin: "10px 0", opacity: 0.25 }} />

            <div style={{ fontWeight: 700 }}>Impact Results</div>

            <div>
              Energy:{" "}
              {Number(
                impactResult.energy_mt_tnt ?? impactResult.energy_mt ?? 0
              ).toFixed(2)}{" "}
              Mt
            </div>

            <div>
              Crater Diameter:{" "}
              {Math.round(
                Number(impactResult.crater_diameter_m ?? 0)
              ).toLocaleString()}{" "}
              m
            </div>

            <div>
              Blast Radius:{" "}
              {Math.round(
                Number(impactResult.blast_radius_m ?? 0)
              ).toLocaleString()}{" "}
              m
            </div>

            <div>
              Thermal Radius:{" "}
              {Math.round(
                Number(impactResult.thermal_radius_m ?? 0)
              ).toLocaleString()}{" "}
              m
            </div>

            {impactResult.is_ocean_impact === true &&
              Number(impactResult.tsunami_radius_m ?? 0) > 0 && (
                <>
                  <div>
                    Tsunami Radius:{" "}
                    {Math.round(
                      Number(impactResult.tsunami_radius_m ?? 0)
                    ).toLocaleString()}{" "}
                    m
                  </div>

                  <div>
                    Wave Height:{" "}
                    {Math.round(
                      Number(impactResult.wave_height_m ?? 0)
                    ).toLocaleString()}{" "}
                    m
                  </div>
                </>
              )}

            <div>Severity: {impactResult.severity_class ?? "--"}</div>

            <hr style={{ margin: "10px 0", opacity: 0.2 }} />
            <div style={{ fontWeight: 700 }}>Casualty Estimate</div>
            <div>
              Population Exposed:{" "}
              {impactResult.population_exposed != null
                ? formatCompactCount(impactResult.population_exposed)
                : "Coming soon"}
            </div>
            <div>
              Estimated Deaths (red circle):{" "}
              {impactResult.estimated_deaths != null
                ? formatCompactCount(impactResult.estimated_deaths)
                : "Coming soon"}
            </div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Confidence: low / rough estimate
            </div>
          </>
        )}

        <hr style={{ margin: "10px 0", opacity: 0.25 }} />

        <div style={{ fontWeight: 700, marginBottom: 6 }}>Cursor</div>
        <div>Lat: {hoverLat ?? "--"}</div>
        <div>Lng: {hoverLng ?? "--"}</div>
        <div>
          Original Elevation:{" "}
          {hoverElevation !== null
            ? unitMode === "ft"
              ? `${Math.round(metersToFeet(hoverElevation))} ft`
              : `${hoverElevation} m`
            : "--"}
        </div>
        <div>Sea Level: {formatLevelForDisplay(seaLevel)}</div>
        <div>
          {waterDifference !== null
            ? waterDifference >= 0
              ? unitMode === "ft"
                ? `Above water by ${Math.round(
                    metersToFeet(waterDifference)
                  )} ft`
                : `Above water by ${waterDifference} m`
              : unitMode === "ft"
              ? `Underwater by ${Math.round(
                  metersToFeet(Math.abs(waterDifference))
                )} ft`
              : `Underwater by ${Math.abs(waterDifference)} m`
            : "--"}
        </div>
      </div>
    </div>
  );
}
