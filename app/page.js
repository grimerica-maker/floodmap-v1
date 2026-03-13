"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const CONFIGURED_FLOOD_ENGINE_URL = process.env.NEXT_PUBLIC_FLOOD_ENGINE_URL;
const FLOOD_ENGINE_PROXY_PATH = "/api/engine";
const DEBUG_FLOOD = true;

const MAP_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const SATELLITE_STYLE = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Source: Esri, Maxar, Earthstar Geographics",
      maxzoom: 19,
    },
  },
  layers: [{ id: "esri-satellite", type: "raster", source: "esri" }],
};

const FLOOD_TILE_VERSION = "11";
const IMPACT_TILE_VERSION = "11";

const FLOOD_SOURCE_ID = "flood-source";
const FLOOD_LAYER_ID = "flood-layer";

const IMPACT_SOURCE_ID = "impact-point-source";
const IMPACT_PREVIEW_SOURCE_ID = "impact-preview-source";
const IMPACT_PREVIEW_FILL_ID = "impact-preview-fill";
const IMPACT_PREVIEW_LINE_ID = "impact-preview-line";

const IMPACT_CRATER_SOURCE_ID = "impact-crater-source";
const IMPACT_BLAST_SOURCE_ID = "impact-blast-source";
const IMPACT_THERMAL_SOURCE_ID = "impact-thermal-source";
const IMPACT_TSUNAMI_SOURCE_ID = "impact-tsunami-source";

const IMPACT_CRATER_FILL_ID = "impact-crater-fill";
const IMPACT_CRATER_LINE_ID = "impact-crater-line";
const IMPACT_BLAST_FILL_ID = "impact-blast-fill";
const IMPACT_BLAST_LINE_ID = "impact-blast-line";
const IMPACT_THERMAL_FILL_ID = "impact-thermal-fill";
const IMPACT_THERMAL_LINE_ID = "impact-thermal-line";
const IMPACT_TSUNAMI_FILL_ID = "impact-tsunami-fill";
const IMPACT_TSUNAMI_LINE_ID = "impact-tsunami-line";

const IMPACT_SHOCK_SOURCE_ID = "impact-shock-source";
const IMPACT_SHOCK_LINE_ID = "impact-shock-line";
const IMPACT_WAVEFRONT_SOURCE_ID = "impact-wavefront-source";
const IMPACT_WAVEFRONT_LINE_ID = "impact-wavefront-line";

const IMPACT_RING_LAYER_ID = "impact-point-ring-layer";
const IMPACT_LAYER_ID = "impact-point-layer";

const IMPACT_FLOOD_SOURCE_ID = "impact-flood-source";
const IMPACT_FLOOD_LAYER_ID = "impact-flood-layer";

const MAX_ASTEROID_DIAMETER_M = 20000;
const MIN_ASTEROID_DIAMETER_M = 50;

const PRESETS = [
  { label: "Ice Age", value: -120 },
  { label: "Modern", value: 0 },
  { label: "Holocene", value: 6 },
  { label: "All Ice Melted", value: 70 },
  { label: "Biblical Flood", value: 3048 },
  { label: "Fully Drained", value: -11000 },
];

const SHOCKWAVE_ANIMATION_MS = 2600;
const WAVEFRONT_ANIMATION_MS = 4200;

const emptyFeatureCollection = () => ({ type: "FeatureCollection", features: [] });
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);

const safely = (fn) => {
  try {
    return fn();
  } catch (error) {
    console.warn("Map operation skipped:", error);
    return null;
  }
};

const createGeodesicCircle = (lng, lat, radiusMeters, steps = 128) => {
  const coords = [];
  const earthRadius = 6371008.8;
  const angularDistance = radiusMeters / earthRadius;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  for (let i = 0; i <= steps; i++) {
    const bearing = (2 * Math.PI * i) / steps;
    const newLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
        Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const newLng =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
        Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLat)
      );
    coords.push([(newLng * 180) / Math.PI, (newLat * 180) / Math.PI]);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coords] },
  };
};

export default function HomePage() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const hoverTimerRef = useRef(null);
  const debugListenersAddedRef = useRef(false);
  const hasAppliedInitialViewModeRef = useRef(false);
  const pendingFloodLevelRef = useRef(null);
  const styleDebouncerRef = useRef(null); // FIX: debounce styledata events

  const scenarioModeRef = useRef("flood");
  const impactPointRef = useRef(null);
  const executedImpactRef = useRef(null);
  const seaLevelRef = useRef(0);
  const viewModeRef = useRef("map");
  const impactDiameterRef = useRef(100);
  const impactResultRef = useRef(null);
  const activeImpactRunIdRef = useRef(null);
  const impactExecutionSeqRef = useRef(0);
  const styleSwitchInProgressRef = useRef(false);
  const impactFloodRetryTimerRef = useRef(null);
  const shockAnimFrameRef = useRef(null);
  const waveAnimFrameRef = useRef(null);

  const [inputLevel, setInputLevel] = useState(0);
  const [inputText, setInputText] = useState("0");
  const [seaLevel, setSeaLevel] = useState(0);
  const [viewMode, setViewMode] = useState("map");
  const [unitMode, setUnitMode] = useState("m");
  const [status, setStatus] = useState("Loading map...");
  const [scenarioMode, setScenarioMode] = useState("flood");
  const [impactDiameter, setImpactDiameter] = useState(100);
  const [impactPoint, setImpactPoint] = useState(null);
  const [executedImpact, setExecutedImpact] = useState(null);
  const [impactResult, setImpactResult] = useState(null);
  const [impactBusy, setImpactBusy] = useState(false);
  const [floodEngineUrl, setFloodEngineUrl] = useState(FLOOD_ENGINE_PROXY_PATH);
  const [hoverLat, setHoverLat] = useState(null);
  const [hoverLng, setHoverLng] = useState(null);
  const [hoverElevation, setHoverElevation] = useState(null);

  useEffect(() => { scenarioModeRef.current = scenarioMode; }, [scenarioMode]);
  useEffect(() => { impactPointRef.current = impactPoint; }, [impactPoint]);
  useEffect(() => { executedImpactRef.current = executedImpact; }, [executedImpact]);
  useEffect(() => { seaLevelRef.current = seaLevel; }, [seaLevel]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { impactDiameterRef.current = impactDiameter; }, [impactDiameter]);
  useEffect(() => { impactResultRef.current = impactResult; }, [impactResult]);

  useEffect(() => {
    if (!CONFIGURED_FLOOD_ENGINE_URL) {
      setFloodEngineUrl(FLOOD_ENGINE_PROXY_PATH);
      return;
    }
    if (window.location.protocol === "https:" && CONFIGURED_FLOOD_ENGINE_URL.startsWith("http://")) {
      setFloodEngineUrl(FLOOD_ENGINE_PROXY_PATH);
      return;
    }
    setFloodEngineUrl(CONFIGURED_FLOOD_ENGINE_URL.replace(/\/+$/, ""));
  }, []);

  const metersToFeet = (m) => m * 3.28084;
  const feetToMeters = (f) => f / 3.28084;

  const formatNumericText = (value, digits = 2) => String(Number(value.toFixed(digits)));

  const formatInputTextFromMeters = (meters, unit = unitMode) =>
    unit === "ft" ? formatNumericText(metersToFeet(meters), 2) : formatNumericText(meters, 2);

  const parseDisplayLevelToMeters = (text, unit = unitMode) => {
    const trimmed = String(text ?? "").trim();
    if (["", "-", "+", ".", "-.", "+."].includes(trimmed)) return null;
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
  }, [unitMode]);

  const formatLevelForDisplay = (meters, unit = unitMode) => {
    if (unit === "ft") {
      const feet = Math.round(metersToFeet(meters));
      return `${feet > 0 ? "+" : ""}${feet} ft`;
    }
    return `${meters > 0 ? "+" : ""}${Math.round(meters)} m`;
  };

  const waterDifference =
    hoverElevation !== null ? Number((hoverElevation - seaLevel).toFixed(2)) : null;

  const clampImpactDiameter = (value) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return MIN_ASTEROID_DIAMETER_M;
    return Math.max(MIN_ASTEROID_DIAMETER_M, Math.min(MAX_ASTEROID_DIAMETER_M, parsed));
  };

  const floodAllowedInCurrentView = () =>
    viewModeRef.current === "map" || viewModeRef.current === "satellite";

  const clearImpactFloodRetry = () => {
    if (impactFloodRetryTimerRef.current) {
      clearTimeout(impactFloodRetryTimerRef.current);
      impactFloodRetryTimerRef.current = null;
    }
  };

  // ─── FIX 1: isMapReady ────────────────────────────────────────────────────
  // Stronger than isStyleLoaded() alone. styledata fires multiple times during
  // a style transition; checking for at least one layer ensures the style object
  // is actually usable before we start adding sources/layers to it.
  const isMapReady = () => {
    const map = mapRef.current;
    if (!map) return false;
    if (!map.isStyleLoaded()) return false;
    const layers = map.getStyle()?.layers;
    return Array.isArray(layers) && layers.length > 0;
  };

  const getTopLayerId = () => {
    const map = mapRef.current;
    if (!isMapReady()) return undefined;
    const layers = map.getStyle()?.layers || [];
    return layers.length ? layers[layers.length - 1].id : undefined;
  };

  const bringImpactLayersToFront = () => {
    if (!isMapReady()) return;
    const map = mapRef.current;

    const orderedLayerIds = [
      IMPACT_PREVIEW_FILL_ID,
      IMPACT_CRATER_FILL_ID,
      IMPACT_BLAST_FILL_ID,
      IMPACT_THERMAL_FILL_ID,
      IMPACT_TSUNAMI_FILL_ID,
      IMPACT_FLOOD_LAYER_ID,
      IMPACT_PREVIEW_LINE_ID,
      IMPACT_CRATER_LINE_ID,
      IMPACT_BLAST_LINE_ID,
      IMPACT_THERMAL_LINE_ID,
      IMPACT_TSUNAMI_LINE_ID,
      IMPACT_SHOCK_LINE_ID,
      IMPACT_WAVEFRONT_LINE_ID,
      IMPACT_RING_LAYER_ID,
      IMPACT_LAYER_ID,
    ];

    for (const id of orderedLayerIds) {
      safely(() => { if (map.getLayer(id)) map.moveLayer(id); });
    }
  };

  const setLinePaint = (layerId, props) => {
    if (!isMapReady()) return;
    const map = mapRef.current;
    if (!map.getLayer(layerId)) return;
    safely(() => {
      for (const [key, value] of Object.entries(props)) {
        map.setPaintProperty(layerId, key, value);
      }
    });
  };

  const stopImpactAnimations = () => {
    if (shockAnimFrameRef.current) { cancelAnimationFrame(shockAnimFrameRef.current); shockAnimFrameRef.current = null; }
    if (waveAnimFrameRef.current) { cancelAnimationFrame(waveAnimFrameRef.current); waveAnimFrameRef.current = null; }
  };

  // ─── FIX 2: ensureGeoJsonSource returns boolean ───────────────────────────
  // Previously used safely() which swallowed errors silently. Now returns true
  // only if the source is confirmed present after the call. Callers can check
  // this before adding layers that depend on the source.
  const ensureGeoJsonSource = (id) => {
    const map = mapRef.current;
    if (!isMapReady()) return false;
    if (map.getSource(id)) return true;
    try {
      map.addSource(id, { type: "geojson", data: emptyFeatureCollection() });
      return !!map.getSource(id);
    } catch (error) {
      console.warn(`ensureGeoJsonSource: failed to add source "${id}":`, error);
      return false;
    }
  };

  // ─── FIX 3: ensureFillLineLayers drops beforeId capture ──────────────────
  // Capturing getTopLayerId() once then reusing it for multiple addLayer calls
  // caused ordering bugs — after the first layer was added the "top" had shifted.
  // We now append layers without a beforeId and let bringImpactLayersToFront()
  // handle final z-order in one clean pass.
  const ensureFillLineLayers = ({ sourceId, fillId, lineId, fillColor, fillOpacity, lineColor, lineWidth }) => {
    if (!isMapReady()) return;
    const map = mapRef.current;

    safely(() => {
      if (!map.getLayer(fillId)) {
        map.addLayer({
          id: fillId,
          type: "fill",
          source: sourceId,
          paint: { "fill-color": fillColor, "fill-opacity": fillOpacity },
        });
      }
    });

    safely(() => {
      if (!map.getLayer(lineId)) {
        map.addLayer({
          id: lineId,
          type: "line",
          source: sourceId,
          paint: { "line-color": lineColor, "line-width": lineWidth, "line-opacity": 1 },
        });
      }
    });
  };

  // ─── FIX 4: ensureAnimatedLayers guards source registration ──────────────
  // Root cause of the original bug: the shock/wavefront layers were added
  // unconditionally even when their sources failed to register (e.g. during a
  // partial style reload). MapLibre then threw "Source not found" for every
  // render attempt. Now each layer add is gated on its source being confirmed.
  const ensureAnimatedLayers = () => {
    if (!isMapReady()) return;
    const map = mapRef.current;

    const shockOk = ensureGeoJsonSource(IMPACT_SHOCK_SOURCE_ID);
    const waveOk = ensureGeoJsonSource(IMPACT_WAVEFRONT_SOURCE_ID);

    if (shockOk && !map.getLayer(IMPACT_SHOCK_LINE_ID)) {
      safely(() => {
        map.addLayer({
          id: IMPACT_SHOCK_LINE_ID,
          type: "line",
          source: IMPACT_SHOCK_SOURCE_ID,
          paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": 0, "line-blur": 0.8 },
        });
      });
    }

    if (waveOk && !map.getLayer(IMPACT_WAVEFRONT_LINE_ID)) {
      safely(() => {
        map.addLayer({
          id: IMPACT_WAVEFRONT_LINE_ID,
          type: "line",
          source: IMPACT_WAVEFRONT_SOURCE_ID,
          paint: { "line-color": "#7dd3fc", "line-width": 5, "line-opacity": 0, "line-blur": 0.8 },
        });
      });
    }

    if (!shockOk || !waveOk) {
      console.warn("ensureAnimatedLayers: source registration incomplete", { shockOk, waveOk });
    }
  };

  // ─── FIX 5: ensureImpactLayers — all sources first, then all layers ───────
  // Previously sources and layers were interleaved (some sources added inside
  // ensureAnimatedLayers mid-way through fill/line layer registration). Now:
  // 1. All GeoJSON sources are registered in one pass
  // 2. ensureAnimatedLayers() runs (shock + wavefront sources + layers)
  // 3. All fill/line layers are added (sources guaranteed to exist)
  // 4. Point layers added last
  // 5. bringImpactLayersToFront() does one final z-order pass
  const ensureImpactLayers = () => {
    if (!isMapReady()) return;
    const map = mapRef.current;

    // Pass 1: all GeoJSON sources
    ensureGeoJsonSource(IMPACT_SOURCE_ID);
    ensureGeoJsonSource(IMPACT_PREVIEW_SOURCE_ID);
    ensureGeoJsonSource(IMPACT_CRATER_SOURCE_ID);
    ensureGeoJsonSource(IMPACT_BLAST_SOURCE_ID);
    ensureGeoJsonSource(IMPACT_THERMAL_SOURCE_ID);
    ensureGeoJsonSource(IMPACT_TSUNAMI_SOURCE_ID);

    // Pass 2: animated sources + layers (internally guarded)
    ensureAnimatedLayers();

    // Pass 3: ring fill + line layers
    ensureFillLineLayers({
      sourceId: IMPACT_PREVIEW_SOURCE_ID, fillId: IMPACT_PREVIEW_FILL_ID, lineId: IMPACT_PREVIEW_LINE_ID,
      fillColor: "#ef4444", fillOpacity: 0.0, lineColor: "#ffffff", lineWidth: 4,
    });
    ensureFillLineLayers({
      sourceId: IMPACT_CRATER_SOURCE_ID, fillId: IMPACT_CRATER_FILL_ID, lineId: IMPACT_CRATER_LINE_ID,
      fillColor: "#7f1d1d", fillOpacity: 0.0, lineColor: "#ff0000", lineWidth: 4,
    });
    ensureFillLineLayers({
      sourceId: IMPACT_BLAST_SOURCE_ID, fillId: IMPACT_BLAST_FILL_ID, lineId: IMPACT_BLAST_LINE_ID,
      fillColor: "#f97316", fillOpacity: 0.0, lineColor: "#ff7a00", lineWidth: 3,
    });
    ensureFillLineLayers({
      sourceId: IMPACT_THERMAL_SOURCE_ID, fillId: IMPACT_THERMAL_FILL_ID, lineId: IMPACT_THERMAL_LINE_ID,
      fillColor: "#facc15", fillOpacity: 0.0, lineColor: "#ffd400", lineWidth: 3,
    });
    ensureFillLineLayers({
      sourceId: IMPACT_TSUNAMI_SOURCE_ID, fillId: IMPACT_TSUNAMI_FILL_ID, lineId: IMPACT_TSUNAMI_LINE_ID,
      fillColor: "#38bdf8", fillOpacity: 0.0, lineColor: "#00c8ff", lineWidth: 3,
    });

    // Pass 4: point layers
    safely(() => {
      if (!map.getLayer(IMPACT_RING_LAYER_ID)) {
        map.addLayer({
          id: IMPACT_RING_LAYER_ID, type: "circle", source: IMPACT_SOURCE_ID,
          paint: { "circle-radius": 18, "circle-color": "rgba(239,68,68,0.3)", "circle-stroke-width": 0 },
        });
      }
    });

    safely(() => {
      if (!map.getLayer(IMPACT_LAYER_ID)) {
        map.addLayer({
          id: IMPACT_LAYER_ID, type: "circle", source: IMPACT_SOURCE_ID,
          paint: { "circle-radius": 9, "circle-color": "#ef4444", "circle-stroke-width": 3, "circle-stroke-color": "#ffffff" },
        });
      }
    });

    // Pass 5: final z-order
    bringImpactLayersToFront();
  };

  const setSourceData = (sourceId, data) => {
    if (!isMapReady()) return;
    const source = mapRef.current.getSource(sourceId);
    if (!source) return;
    safely(() => source.setData(data));
  };

  const drawImpactPointNow = (point, diameterValue = impactDiameterRef.current) => {
    if (!isMapReady() || !point) return;
    ensureImpactLayers();
    setSourceData(IMPACT_SOURCE_ID, {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: { type: "Point", coordinates: [point.lng, point.lat] },
        properties: { diameter: diameterValue },
      }],
    });
    bringImpactLayersToFront();
    safely(() => mapRef.current.triggerRepaint());
  };

  const clearAnimatedImpactRings = () => {
    ensureAnimatedLayers();
    setSourceData(IMPACT_SHOCK_SOURCE_ID, emptyFeatureCollection());
    setSourceData(IMPACT_WAVEFRONT_SOURCE_ID, emptyFeatureCollection());
    setLinePaint(IMPACT_SHOCK_LINE_ID, { "line-opacity": 0, "line-width": 6, "line-blur": 0.8 });
    setLinePaint(IMPACT_WAVEFRONT_LINE_ID, { "line-opacity": 0, "line-width": 5, "line-blur": 0.8 });
  };

  const clearImpactRings = () => {
    setSourceData(IMPACT_PREVIEW_SOURCE_ID, emptyFeatureCollection());
    setSourceData(IMPACT_CRATER_SOURCE_ID, emptyFeatureCollection());
    setSourceData(IMPACT_BLAST_SOURCE_ID, emptyFeatureCollection());
    setSourceData(IMPACT_THERMAL_SOURCE_ID, emptyFeatureCollection());
    setSourceData(IMPACT_TSUNAMI_SOURCE_ID, emptyFeatureCollection());
    clearAnimatedImpactRings();
  };

  const clearImpactPointOnMap = () => {
    stopImpactAnimations();
    setSourceData(IMPACT_SOURCE_ID, emptyFeatureCollection());
    clearImpactRings();
  };

  const buildRingFeatureCollection = (lng, lat, radiusMeters) => {
    if (!radiusMeters || radiusMeters <= 0) return emptyFeatureCollection();
    return { type: "FeatureCollection", features: [createGeodesicCircle(lng, lat, radiusMeters)] };
  };

  // ─── FIX 6: startImpactAnimations — ensureAnimatedLayers before guard check
  // Previously the source-existence guard ran before ensureAnimatedLayers was
  // called, meaning it would always fail on the first execution after a style
  // reload. Now we ensure first, then guard.
  const startImpactAnimations = (point, result) => {
    if (!isMapReady() || !point || !result) return;
    const map = mapRef.current;

    stopImpactAnimations();
    ensureAnimatedLayers(); // ensure BEFORE checking

    if (!map.getSource(IMPACT_SHOCK_SOURCE_ID) || !map.getSource(IMPACT_WAVEFRONT_SOURCE_ID)) {
      console.warn("startImpactAnimations: animated sources still not ready after ensure, aborting");
      return;
    }

    clearAnimatedImpactRings();

    const shockMaxRadius = Math.max(
      result.blast_radius_m || 0,
      result.thermal_radius_m || 0,
      result.crater_diameter_m ? result.crater_diameter_m / 2 : 0
    );
    const waveMaxRadius = result.tsunami_radius_m || 0;

    const shockStart = performance.now();
    const animateShock = (now) => {
      const progress = Math.min(1, (now - shockStart) / SHOCKWAVE_ANIMATION_MS);
      if (shockMaxRadius > 0) {
        setSourceData(IMPACT_SHOCK_SOURCE_ID, buildRingFeatureCollection(point.lng, point.lat, shockMaxRadius * easeOutCubic(progress)));
        setLinePaint(IMPACT_SHOCK_LINE_ID, {
          "line-opacity": 0.95 * (1 - progress),
          "line-width": 10 - progress * 6,
          "line-blur": 1.2 - progress * 0.8,
        });
      }
      bringImpactLayersToFront();
      if (progress < 1) {
        shockAnimFrameRef.current = requestAnimationFrame(animateShock);
      } else {
        setSourceData(IMPACT_SHOCK_SOURCE_ID, emptyFeatureCollection());
        setLinePaint(IMPACT_SHOCK_LINE_ID, { "line-opacity": 0, "line-width": 6, "line-blur": 0.8 });
        shockAnimFrameRef.current = null;
      }
    };
    shockAnimFrameRef.current = requestAnimationFrame(animateShock);

    if (waveMaxRadius > 0) {
      const waveStart = performance.now();
      const animateWave = (now) => {
        const progress = Math.min(1, (now - waveStart) / WAVEFRONT_ANIMATION_MS);
        setSourceData(IMPACT_WAVEFRONT_SOURCE_ID, buildRingFeatureCollection(point.lng, point.lat, waveMaxRadius * easeOutQuad(progress)));
        setLinePaint(IMPACT_WAVEFRONT_LINE_ID, {
          "line-opacity": 0.95 * (1 - progress * 0.35),
          "line-width": 8 - progress * 3,
          "line-blur": 1.1 - progress * 0.4,
        });
        bringImpactLayersToFront();
        if (progress < 1) {
          waveAnimFrameRef.current = requestAnimationFrame(animateWave);
        } else {
          setSourceData(IMPACT_WAVEFRONT_SOURCE_ID, emptyFeatureCollection());
          setLinePaint(IMPACT_WAVEFRONT_LINE_ID, { "line-opacity": 0, "line-width": 5, "line-blur": 0.8 });
          waveAnimFrameRef.current = null;
        }
      };
      waveAnimFrameRef.current = requestAnimationFrame(animateWave);
    }
  };

  const removeFloodLayer = () => {
    if (!isMapReady()) return;
    const map = mapRef.current;
    safely(() => {
      if (map.getLayer(FLOOD_LAYER_ID)) map.removeLayer(FLOOD_LAYER_ID);
      if (map.getSource(FLOOD_SOURCE_ID)) map.removeSource(FLOOD_SOURCE_ID);
    });
  };

  const removeImpactFloodLayer = () => {
    clearImpactFloodRetry();
    const map = mapRef.current;
    if (!isMapReady()) { activeImpactRunIdRef.current = null; return; }
    safely(() => {
      if (map.getLayer(IMPACT_FLOOD_LAYER_ID)) map.removeLayer(IMPACT_FLOOD_LAYER_ID);
      if (map.getSource(IMPACT_FLOOD_SOURCE_ID)) map.removeSource(IMPACT_FLOOD_SOURCE_ID);
    });
    activeImpactRunIdRef.current = null;
  };

  const addFloodLayer = (level) => {
    if (!isMapReady()) return false;
    if (scenarioModeRef.current !== "flood") return false;
    const map = mapRef.current;

    const tileUrl = `${floodEngineUrl}/flood/${encodeURIComponent(level)}/{z}/{x}/{y}.png?v=${FLOOD_TILE_VERSION}`;

    try {
      safely(() => {
        if (map.getLayer(FLOOD_LAYER_ID)) map.removeLayer(FLOOD_LAYER_ID);
        if (map.getSource(FLOOD_SOURCE_ID)) map.removeSource(FLOOD_SOURCE_ID);
      });
      map.addSource(FLOOD_SOURCE_ID, { type: "raster", tiles: [tileUrl], tileSize: 256, scheme: "xyz", minzoom: 0, maxzoom: 22 });
      map.addLayer({
        id: FLOOD_LAYER_ID, type: "raster", source: FLOOD_SOURCE_ID,
        paint: { "raster-opacity": 0.88, "raster-fade-duration": 0, "raster-resampling": "linear" },
      });
      pendingFloodLevelRef.current = null;
      return true;
    } catch (error) {
      console.error("Failed to add flood layer", error);
      return false;
    }
  };

  const addImpactFloodLayer = (runId) => {
    if (!isMapReady() || !runId) return false;
    if (scenarioModeRef.current !== "impact") return false;
    if (styleSwitchInProgressRef.current) return false;
    const map = mapRef.current;

    const tileUrl = `${floodEngineUrl}/impact-flood/${runId}/{z}/{x}/{y}.png?v=${IMPACT_TILE_VERSION}&run=${encodeURIComponent(runId)}`;

    try {
      const layerExists = map.getLayer(IMPACT_FLOOD_LAYER_ID);
      const sourceExists = map.getSource(IMPACT_FLOOD_SOURCE_ID);

      if (activeImpactRunIdRef.current === runId && layerExists && sourceExists) {
        bringImpactLayersToFront();
        return true;
      }

      safely(() => {
        if (layerExists) map.removeLayer(IMPACT_FLOOD_LAYER_ID);
        if (sourceExists) map.removeSource(IMPACT_FLOOD_SOURCE_ID);
      });

      console.log("Adding impact flood tiles:", tileUrl);
      map.addSource(IMPACT_FLOOD_SOURCE_ID, { type: "raster", tiles: [tileUrl], tileSize: 256, scheme: "xyz", minzoom: 0, maxzoom: 22 });
      map.addLayer({
        id: IMPACT_FLOOD_LAYER_ID, type: "raster", source: IMPACT_FLOOD_SOURCE_ID,
        paint: { "raster-opacity": 0.88, "raster-fade-duration": 0, "raster-resampling": "linear" },
      });
      activeImpactRunIdRef.current = runId;
      bringImpactLayersToFront();
      return true;
    } catch (error) {
      console.error("Failed to add impact flood layer", error);
      return false;
    }
  };

  const scheduleImpactFloodRetry = (runId, delayMs = 250) => {
    clearImpactFloodRetry();
    impactFloodRetryTimerRef.current = setTimeout(() => {
      impactFloodRetryTimerRef.current = null;
      if (scenarioModeRef.current !== "impact" || !runId) return;
      const retry = addImpactFloodLayer(runId);
      console.log("Impact flood layer retry added:", retry);
      if (retry) {
        setStatus("Impact executed with tsunami flooding");
      } else {
        console.warn("Impact flood layer attach failed after retry");
        setStatus("Impact executed, but flood layer attach failed");
      }
    }, delayMs);
  };

  const flushPendingFloodLayer = () => {
    if (!isMapReady()) return;
    if (scenarioModeRef.current === "flood" && floodAllowedInCurrentView() && pendingFloodLevelRef.current !== null) {
      const level = pendingFloodLevelRef.current;
      pendingFloodLevelRef.current = null;
      addFloodLayer(level);
    }
  };

  const setImpactPreviewOnMap = (point, diameterValue = impactDiameterRef.current) => {
    if (!isMapReady() || !point) return;
    stopImpactAnimations();
    ensureImpactLayers();
    setSourceData(IMPACT_SOURCE_ID, {
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: { type: "Point", coordinates: [point.lng, point.lat] }, properties: { diameter: diameterValue } }],
    });
    setSourceData(IMPACT_PREVIEW_SOURCE_ID, buildRingFeatureCollection(point.lng, point.lat, Math.max(500, diameterValue * 20)));
    setSourceData(IMPACT_CRATER_SOURCE_ID, emptyFeatureCollection());
    setSourceData(IMPACT_BLAST_SOURCE_ID, emptyFeatureCollection());
    setSourceData(IMPACT_THERMAL_SOURCE_ID, emptyFeatureCollection());
    setSourceData(IMPACT_TSUNAMI_SOURCE_ID, emptyFeatureCollection());
    clearAnimatedImpactRings();
    bringImpactLayersToFront();
    safely(() => mapRef.current.triggerRepaint());
  };

  const setExecutedImpactOnMap = (point, diameterValue, result) => {
    if (!isMapReady() || !point || !result) return;
    ensureImpactLayers();
    setSourceData(IMPACT_SOURCE_ID, {
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: { type: "Point", coordinates: [point.lng, point.lat] }, properties: { diameter: diameterValue } }],
    });
    setSourceData(IMPACT_PREVIEW_SOURCE_ID, emptyFeatureCollection());
    setSourceData(IMPACT_CRATER_SOURCE_ID, buildRingFeatureCollection(point.lng, point.lat, result.crater_diameter_m > 0 ? result.crater_diameter_m / 2 : 0));
    setSourceData(IMPACT_BLAST_SOURCE_ID, buildRingFeatureCollection(point.lng, point.lat, result.blast_radius_m > 0 ? result.blast_radius_m : 0));
    setSourceData(IMPACT_THERMAL_SOURCE_ID, buildRingFeatureCollection(point.lng, point.lat, result.thermal_radius_m > 0 ? result.thermal_radius_m : 0));
    setSourceData(IMPACT_TSUNAMI_SOURCE_ID, buildRingFeatureCollection(point.lng, point.lat, result.tsunami_radius_m > 0 ? result.tsunami_radius_m : 0));
    startImpactAnimations(point, result);
    bringImpactLayersToFront();
    safely(() => mapRef.current.triggerRepaint());
  };

  const fetchElevation = async (lat, lng) => {
    if (styleSwitchInProgressRef.current || impactBusy) return;
    try {
      const res = await fetch(`${floodEngineUrl}/elevation?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
      if (!res.ok) { setHoverElevation(null); return; }
      const data = await res.json();
      setHoverElevation(data.elevation_m);
    } catch {
      setHoverElevation(null);
    }
  };

  const syncFloodScenario = () => {
    if (!isMapReady()) return;
    if (scenarioModeRef.current !== "flood") { removeFloodLayer(); return; }
    clearImpactPointOnMap();
    removeImpactFloodLayer();
    if (floodAllowedInCurrentView() && seaLevelRef.current !== 0) {
      addFloodLayer(seaLevelRef.current);
    } else {
      removeFloodLayer();
    }
  };

  const syncImpactScenario = () => {
    if (!isMapReady()) return;
    if (scenarioModeRef.current !== "impact") return;
    removeFloodLayer();
    ensureImpactLayers();

    if (executedImpactRef.current && impactResultRef.current) {
      setExecutedImpactOnMap(
        { lng: executedImpactRef.current.lng, lat: executedImpactRef.current.lat },
        executedImpactRef.current.diameter,
        impactResultRef.current
      );
      const runId = executedImpactRef.current.runId;
      if (impactResultRef.current.is_ocean_impact && impactResultRef.current.tsunami_radius_m > 0 && runId) {
        const added = addImpactFloodLayer(runId);
        if (!added) scheduleImpactFloodRetry(runId, 250);
      } else {
        removeImpactFloodLayer();
      }
      return;
    }

    removeImpactFloodLayer();
    if (impactPointRef.current) {
      drawImpactPointNow(impactPointRef.current, impactDiameterRef.current);
      setImpactPreviewOnMap(impactPointRef.current, impactDiameterRef.current);
    } else {
      clearImpactPointOnMap();
    }
  };

  const restoreMapOverlays = () => {
    if (!isMapReady()) return;
    ensureImpactLayers();
    if (scenarioModeRef.current === "impact") {
      syncImpactScenario();
    } else {
      syncFloodScenario();
    }
  };

  const applyStyleMode = (mode) => {
    const map = mapRef.current;
    if (!map) return;
    styleSwitchInProgressRef.current = true;
    clearImpactFloodRetry();
    if (mode === "satellite") {
      map.setStyle(SATELLITE_STYLE);
    } else {
      map.setStyle(MAP_STYLE);
    }
    map.easeTo({
      center: mode === "globe" ? [-70, 28] : [-80.19, 25.76],
      zoom: mode === "globe" ? 2.6 : 6.2,
      duration: 250,
      essential: true,
    });
  };

  const executeFlood = () => {
    const parsedLevel = commitInputText(inputText, unitMode);
    if (parsedLevel === null) { setStatus("Enter a valid sea level first"); return; }
    const level = parsedLevel;

    setScenarioMode("flood");
    scenarioModeRef.current = "flood";
    setImpactBusy(false);
    setSeaLevel(level);
    seaLevelRef.current = level;
    setInputLevel(level);
    setExecutedImpact(null);
    executedImpactRef.current = null;
    setImpactResult(null);
    impactResultRef.current = null;
    impactExecutionSeqRef.current += 1;

    if (!floodAllowedInCurrentView()) {
      removeFloodLayer();
      setStatus("Switch to Standard Map or Satellite to run flood layer");
      return;
    }

    clearImpactPointOnMap();
    removeImpactFloodLayer();

    if (level === 0) {
      pendingFloodLevelRef.current = null;
      removeFloodLayer();
      setStatus("Flood cleared");
      return;
    }

    const added = addFloodLayer(level);
    if (added) { setStatus(`Flood tiles loaded at ${formatLevelForDisplay(level)}`); return; }

    pendingFloodLevelRef.current = level;
    setStatus("Preparing flood layer...");
    setTimeout(() => {
      if (scenarioModeRef.current === "flood" && floodAllowedInCurrentView() && pendingFloodLevelRef.current === level) {
        const retried = addFloodLayer(level);
        if (retried) setStatus(`Flood tiles loaded at ${formatLevelForDisplay(level)}`);
      }
    }, 300);
  };

  const executeImpact = async () => {
    if (impactBusy) return;
    if (!impactPointRef.current) { setStatus("Click map to place impact point first"); return; }

    const point = { lng: impactPointRef.current.lng, lat: impactPointRef.current.lat };
    const diameter = clampImpactDiameter(impactDiameterRef.current);
    const executionSeq = impactExecutionSeqRef.current + 1;
    impactExecutionSeqRef.current = executionSeq;

    clearImpactFloodRetry();
    setImpactBusy(true);
    setScenarioMode("impact");
    scenarioModeRef.current = "impact";
    removeFloodLayer();
    removeImpactFloodLayer();
    drawImpactPointNow(point, diameter);
    setImpactPreviewOnMap(point, diameter);
    setStatus("Executing impact...");

    try {
      const url = `${floodEngineUrl}/impact?lat=${encodeURIComponent(point.lat)}&lng=${encodeURIComponent(point.lng)}&diameter=${encodeURIComponent(diameter)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Impact request failed: ${res.status}`);
      const data = await res.json();
      console.log("Impact response data:", data);

      if (impactExecutionSeqRef.current !== executionSeq) { setImpactBusy(false); return; }

      const run = { lat: point.lat, lng: point.lng, diameter, runId: data.run_id };
      setImpactPoint(point);
      impactPointRef.current = point;
      setExecutedImpact(run);
      executedImpactRef.current = run;
      setImpactResult(data);
      impactResultRef.current = data;

      setExecutedImpactOnMap(point, diameter, data);

      if (data.is_ocean_impact && data.tsunami_radius_m > 0 && data.run_id) {
        const added = addImpactFloodLayer(data.run_id);
        if (added) {
          setStatus("Impact executed with tsunami flooding");
        } else {
          setStatus("Preparing tsunami flooding...");
          scheduleImpactFloodRetry(data.run_id, 250);
        }
      } else {
        removeImpactFloodLayer();
        setStatus("Impact executed (land impact)");
      }

      safely(() =>
        mapRef.current?.easeTo({
          center: [point.lng, point.lat],
          zoom: Math.max(mapRef.current.getZoom(), 5.8),
          duration: 250,
          essential: true,
        })
      );
    } catch (error) {
      if (impactExecutionSeqRef.current === executionSeq) {
        console.error(error);
        setStatus("Impact execution failed");
      }
    } finally {
      if (impactExecutionSeqRef.current === executionSeq) setImpactBusy(false);
    }
  };

  const clearFlood = () => {
    setInputLevel(0);
    setInputText("0");
    setSeaLevel(0);
    seaLevelRef.current = 0;
    setImpactPoint(null);
    impactPointRef.current = null;
    setExecutedImpact(null);
    executedImpactRef.current = null;
    setImpactResult(null);
    impactResultRef.current = null;
    pendingFloodLevelRef.current = null;
    activeImpactRunIdRef.current = null;
    impactExecutionSeqRef.current += 1;
    setImpactBusy(false);
    removeFloodLayer();
    removeImpactFloodLayer();
    clearImpactPointOnMap();
    setStatus("Flood cleared");
  };

  useEffect(() => {
    if (mapRef.current || !floodEngineUrl) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: [-80.19, 25.76],
      zoom: 6.2,
      dragPan: true,
      scrollZoom: true,
      boxZoom: true,
      dragRotate: true,
      keyboard: true,
      touchZoomRotate: true,
      antialias: false,
      transformRequest: (url, resourceType) => {
        if (resourceType === "Tile") {
          if (url.includes("/impact-flood/")) console.log("IMPACT TILE:", url);
          else if (url.includes("/flood/")) console.log("FLOOD TILE:", url);
        }
        return { url };
      },
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.getCanvas().style.cursor = "crosshair";

    if (DEBUG_FLOOD && !debugListenersAddedRef.current) {
      debugListenersAddedRef.current = true;
      map.on("error", (e) => {
        const sourceId = e?.sourceId || e?.source?.id || e?.target?._sourceId || e?.error?.sourceId || null;
        const ignoreIds = new Set([
          IMPACT_SOURCE_ID, IMPACT_PREVIEW_SOURCE_ID, IMPACT_CRATER_SOURCE_ID,
          IMPACT_BLAST_SOURCE_ID, IMPACT_THERMAL_SOURCE_ID, IMPACT_TSUNAMI_SOURCE_ID,
          IMPACT_SHOCK_SOURCE_ID, IMPACT_WAVEFRONT_SOURCE_ID, IMPACT_FLOOD_SOURCE_ID,
        ]);
        if (sourceId && ignoreIds.has(sourceId)) return;
        console.log("Map error:", e?.error?.message || e?.message || "", sourceId);
      });
    }

    const handleLoad = () => {
      ensureImpactLayers();
      fetch(`${floodEngineUrl}/`).then((r) => r.json()).then((d) => console.log("Engine health:", d)).catch((e) => console.error("Engine unreachable", e));
      flushPendingFloodLayer();
      restoreMapOverlays();
      setStatus("Map ready");
    };

    // ─── FIX 7: debounced styledata handler ──────────────────────────────────
    // styledata fires 3–6 times per style load cycle (once per source, once per
    // layer group, once when fully loaded). Without debouncing, each firing
    // attempted to add impact layers to a partially-built style, causing the
    // "source not found" error on intermediate firings. We debounce to 60ms so
    // we only run once after the style has fully settled.
    const handleStyleData = () => {
      if (styleDebouncerRef.current) clearTimeout(styleDebouncerRef.current);
      styleDebouncerRef.current = setTimeout(() => {
        styleDebouncerRef.current = null;
        if (!isMapReady()) return;
        ensureImpactLayers();
        restoreMapOverlays();
        flushPendingFloodLayer();
        styleSwitchInProgressRef.current = false;
      }, 60);
    };

    const handleMouseMove = (e) => {
      const lat = Number(e.lngLat.lat.toFixed(5));
      const lng = Number(e.lngLat.lng.toFixed(5));
      setHoverLat(lat);
      setHoverLng(lng);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => fetchElevation(lat, lng), 120);
    };

    const handleMouseLeave = () => {
      setHoverLat(null);
      setHoverLng(null);
      setHoverElevation(null);
    };

    const handleMapClick = (e) => {
      if (scenarioModeRef.current !== "impact") return;
      if (impactBusy) return;

      const point = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      impactExecutionSeqRef.current += 1;
      impactPointRef.current = point;
      setImpactPoint(point);
      setExecutedImpact(null);
      executedImpactRef.current = null;
      setImpactResult(null);
      impactResultRef.current = null;
      removeImpactFloodLayer();

      if (isMapReady()) {
        drawImpactPointNow(point, impactDiameterRef.current);
        setImpactPreviewOnMap(point, impactDiameterRef.current);
        bringImpactLayersToFront();
        safely(() => map.triggerRepaint());
      }

      setStatus("Impact point selected - click Execute Impact");
      safely(() =>
        map.easeTo({ center: [point.lng, point.lat], zoom: Math.max(map.getZoom(), 5.8), duration: 250, essential: true })
      );
    };

    map.on("load", handleLoad);
    map.on("styledata", handleStyleData);
    map.on("mousemove", handleMouseMove);
    map.on("mouseleave", handleMouseLeave);
    map.on("click", handleMapClick);

    return () => {
      stopImpactAnimations();
      clearImpactFloodRetry();
      if (styleDebouncerRef.current) { clearTimeout(styleDebouncerRef.current); styleDebouncerRef.current = null; }
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      map.off("load", handleLoad);
      map.off("styledata", handleStyleData);
      map.off("mousemove", handleMouseMove);
      map.off("mouseleave", handleMouseLeave);
      map.off("click", handleMapClick);
      map.remove();
      mapRef.current = null;
      pendingFloodLevelRef.current = null;
      hasAppliedInitialViewModeRef.current = false;
      activeImpactRunIdRef.current = null;
      styleSwitchInProgressRef.current = false;
    };
  }, [floodEngineUrl]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!hasAppliedInitialViewModeRef.current) { hasAppliedInitialViewModeRef.current = true; return; }
    applyStyleMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady() || styleSwitchInProgressRef.current) return;
    if (scenarioMode === "impact") { syncImpactScenario(); } else { syncFloodScenario(); }
  }, [scenarioMode, seaLevel, impactPoint, executedImpact, impactResult]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady() || styleSwitchInProgressRef.current) return;
    if (scenarioMode !== "impact" || !impactPointRef.current) return;

    if (executedImpactRef.current && impactResultRef.current) {
      setExecutedImpactOnMap(impactPointRef.current, impactDiameter, impactResultRef.current);
    } else {
      drawImpactPointNow(impactPointRef.current, impactDiameter);
      setImpactPreviewOnMap(impactPointRef.current, impactDiameter);
    }
    bringImpactLayersToFront();
  }, [impactDiameter, scenarioMode, impactPoint, executedImpact, impactResult]);

  useEffect(() => {
    if (!mapRef.current || !isMapReady()) return;
    if (scenarioMode === "impact") {
      if (impactBusy) { setStatus("Executing impact..."); }
      else if (impactResult) { setStatus(impactResult.is_ocean_impact ? "Impact executed with tsunami flooding" : "Impact executed (land impact)"); }
      else if (impactPointRef.current) { setStatus("Impact point selected - click Execute Impact"); }
      else { setStatus("Click map to place impact point"); }
      return;
    }
    if (viewMode === "globe") { setStatus("Wide-area preview mode"); return; }
    if (seaLevel === 0) { setStatus("Flood cleared"); return; }
    setStatus(`Flood tiles loaded at ${formatLevelForDisplay(seaLevel)}`);
  }, [scenarioMode, viewMode, seaLevel, impactResult, unitMode, impactBusy]);

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative", overflow: "hidden" }}>
      <div ref={mapContainer} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }} />

      <div
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", top: 0, left: 0, width: 340, height: "100%",
          background: "rgba(249,250,251,0.97)", borderRight: "1px solid #e5e7eb",
          padding: 16, fontFamily: "Arial, sans-serif", zIndex: 1000,
          overflowY: "auto", pointerEvents: "auto",
        }}
      >
        <h1 style={{ margin: "8px 0 24px 0", fontSize: 22 }}>Floodmap V1</h1>
        <div style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>Python tile flood engine</div>

        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>SEA LEVEL</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: seaLevel > 0 ? "#0f62fe" : seaLevel < 0 ? "#b45309" : "#111827" }}>
          {formatLevelForDisplay(seaLevel)}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {["m", "ft"].map((u) => (
            <button key={u} onClick={() => setUnitMode(u)}
              style={{ flex: 1, padding: "10px 8px", border: "1px solid #d1d5db", background: unitMode === u ? "#0f172a" : "white", color: unitMode === u ? "white" : "#111827", cursor: "pointer", borderRadius: 10, fontWeight: 700 }}>
              {u === "m" ? "Meters" : "Feet"}
            </button>
          ))}
        </div>

        <input
          type="text" inputMode="decimal"
          placeholder={unitMode === "ft" ? "Enter sea level in feet" : "Enter sea level in meters"}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onBlur={() => { const c = commitInputText(inputText, unitMode); if (c !== null) setInputLevel(c); }}
          onKeyDown={(e) => { if (e.key === "Enter") executeFlood(); }}
          style={{ width: "100%", padding: 12, fontSize: 18, border: "1px solid #ccc", marginBottom: 12, boxSizing: "border-box" }}
        />

        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <button onClick={executeFlood} style={{ flex: 1, padding: "12px 10px", background: "#0f172a", color: "white", border: "none", fontWeight: 700, cursor: "pointer" }}>
            Execute Flood
          </button>
          <button onClick={clearFlood} style={{ flex: 1, padding: "12px 10px", background: "white", color: "#111827", border: "1px solid #ccc", fontWeight: 700, cursor: "pointer" }}>
            Clear
          </button>
        </div>

        <div style={{ fontSize: 14, marginBottom: 24 }}>
          Custom input supports positive and negative values in {unitMode === "ft" ? "feet" : "meters"}
        </div>

        <hr style={{ margin: "0 0 18px 0" }} />
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>PRESETS</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28 }}>
          {PRESETS.map((preset) => {
            const active = Math.round(inputLevel) === Math.round(preset.value);
            const presetLabel = unitMode === "ft"
              ? `${Math.round(metersToFeet(preset.value)) > 0 ? "+" : ""}${Math.round(metersToFeet(preset.value))}ft`
              : `${preset.value > 0 ? "+" : ""}${preset.value}m`;
            return (
              <button key={preset.label}
                onClick={() => { setInputLevel(preset.value); setInputText(formatInputTextFromMeters(preset.value, unitMode)); }}
                style={{ padding: "12px 10px", border: "1px solid #d1d5db", background: active ? "#0f172a" : "white", color: active ? "white" : "#111827", cursor: "pointer", borderRadius: 12, fontWeight: 700 }}>
                <div>{preset.label}</div>
                <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>{presetLabel}</div>
              </button>
            );
          })}
        </div>

        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>SCENARIO MODE</div>
        <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
          <button
            onClick={() => {
              setScenarioMode("flood");
              scenarioModeRef.current = "flood";
              setImpactBusy(false);
              setStatus("Flood mode active");
              removeImpactFloodLayer();
              if (mapRef.current?.isStyleLoaded()) { syncFloodScenario(); safely(() => mapRef.current.triggerRepaint()); }
            }}
            style={{ width: "100%", padding: 14, border: "1px solid #d1d5db", background: scenarioMode === "flood" ? "#0f172a" : "white", color: scenarioMode === "flood" ? "white" : "#111827", cursor: "pointer", borderRadius: 12, fontWeight: 700 }}>
            <div>Flood</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>Sea level up / down</div>
          </button>

          <button
            onClick={() => {
              setScenarioMode("impact");
              scenarioModeRef.current = "impact";
              setStatus("Click map to place impact point");
              if (mapRef.current?.isStyleLoaded()) { ensureImpactLayers(); syncImpactScenario(); bringImpactLayersToFront(); safely(() => mapRef.current.triggerRepaint()); }
            }}
            style={{ width: "100%", padding: 14, border: "1px solid #d1d5db", background: scenarioMode === "impact" ? "#0f172a" : "white", color: scenarioMode === "impact" ? "white" : "#111827", cursor: "pointer", borderRadius: 12, fontWeight: 700 }}>
            <div>Impact</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>Asteroid impact simulation</div>
          </button>
        </div>

        {scenarioMode === "impact" && (
          <>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>ASTEROID DIAMETER</div>
            <input type="range" min={String(MIN_ASTEROID_DIAMETER_M)} max={String(MAX_ASTEROID_DIAMETER_M)} step="50"
              value={impactDiameter} onChange={(e) => setImpactDiameter(clampImpactDiameter(e.target.value))}
              style={{ width: "100%", marginBottom: 10 }} />
            <input type="number" min={String(MIN_ASTEROID_DIAMETER_M)} max={String(MAX_ASTEROID_DIAMETER_M)} step="50"
              value={impactDiameter} onChange={(e) => setImpactDiameter(clampImpactDiameter(e.target.value))}
              style={{ width: "100%", padding: 10, fontSize: 16, border: "1px solid #ccc", marginBottom: 10, boxSizing: "border-box" }} />
            <div style={{ fontSize: 14, marginBottom: 12 }}>
              Diameter: {impactDiameter >= 1000 ? `${(impactDiameter / 1000).toFixed(2)} km` : `${impactDiameter} m`} (max {(MAX_ASTEROID_DIAMETER_M / 1000).toFixed(0)} km)
            </div>
            <button onClick={executeImpact} disabled={impactBusy}
              style={{ width: "100%", padding: 14, background: impactBusy ? "#7f1d1d99" : "#7f1d1d", color: "white", border: "none", fontWeight: 700, cursor: impactBusy ? "not-allowed" : "pointer", borderRadius: 12, marginBottom: 24 }}>
              {impactBusy ? "Executing..." : "Execute Impact"}
            </button>
          </>
        )}

        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>VIEW MODE</div>
        <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
          {[
            { id: "map", label: "Standard Map", sub: "Flood tiles active" },
            { id: "satellite", label: "Satellite View", sub: "Flood overlay supported" },
            { id: "globe", label: "Wide View", sub: "Preview" },
          ].map(({ id, label, sub }) => (
            <button key={id} onClick={() => setViewMode(id)}
              style={{ width: "100%", padding: 14, border: "1px solid #d1d5db", background: viewMode === id ? "#0f172a" : "white", color: viewMode === id ? "white" : "#111827", cursor: "pointer", borderRadius: 12, fontWeight: 700 }}>
              <div>{label}</div>
              <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>{sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", right: 20, top: 10, background: "#1e3a5f", color: "white", padding: 16, borderRadius: 12, fontSize: 14, lineHeight: 1.45, zIndex: 1000, minWidth: 320 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Current Scenario</div>
        <div>Sea level: {formatLevelForDisplay(seaLevel)}</div>
        <div>Mode: {viewMode === "map" ? "Standard Map" : viewMode === "satellite" ? "Satellite" : "Wide View"}</div>
        <div>Status: {status}</div>
        <div>Scenario Mode: {scenarioMode}</div>
        <div>Asteroid Diameter: {impactDiameter} m</div>
        <div>Impact Point: {impactPoint ? `${impactPoint.lng.toFixed(3)}, ${impactPoint.lat.toFixed(3)}` : "--"}</div>
        <div>Executed Impact: {executedImpact ? `${executedImpact.lng.toFixed(3)}, ${executedImpact.lat.toFixed(3)} @ ${executedImpact.diameter}m` : "--"}</div>

        {impactResult && (
          <>
            <hr style={{ margin: "10px 0", opacity: 0.25 }} />
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Impact Results</div>
            <div>Type: {impactResult.is_ocean_impact ? "Ocean impact" : "Land impact"}</div>
            <div>Severity: {impactResult.severity_class}</div>
            <div>Energy: {impactResult.energy_mt.toExponential(2)} Mt TNT</div>
            <div>Crater: {Math.round(impactResult.crater_diameter_m)} m</div>
            <div>Blast Radius: {Math.round(impactResult.blast_radius_m)} m</div>
            <div>Thermal Radius: {impactResult.thermal_radius_m > 0 ? `${Math.round(impactResult.thermal_radius_m)} m` : "--"}</div>
            <div>Tsunami Radius: {impactResult.tsunami_radius_m > 0 ? `${Math.round(impactResult.tsunami_radius_m)} m` : "--"}</div>
            <div>Wave Height: {impactResult.wave_height_m > 0 ? `${Math.round(impactResult.wave_height_m)} m` : "--"}</div>
            <div>Rings: C {Math.round((impactResult.crater_diameter_m || 0) / 2)} | B {Math.round(impactResult.blast_radius_m || 0)} | T {Math.round(impactResult.thermal_radius_m || 0)} | S {Math.round(impactResult.tsunami_radius_m || 0)}</div>
          </>
        )}

        <hr style={{ margin: "10px 0", opacity: 0.25 }} />
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Cursor</div>
        <div>Lat: {hoverLat ?? "--"}</div>
        <div>Lng: {hoverLng ?? "--"}</div>
        <div>Original Elevation: {hoverElevation !== null ? (unitMode === "ft" ? `${Math.round(metersToFeet(hoverElevation))} ft` : `${hoverElevation} m`) : "--"}</div>
        <div>Sea Level: {formatLevelForDisplay(seaLevel)}</div>
        <div>
          {waterDifference !== null
            ? waterDifference >= 0
              ? unitMode === "ft" ? `Above water by ${Math.round(metersToFeet(waterDifference))} ft` : `Above water by ${waterDifference} m`
              : unitMode === "ft" ? `Underwater by ${Math.round(metersToFeet(Math.abs(waterDifference)))} ft` : `Underwater by ${Math.abs(waterDifference)} m`
            : "--"}
        </div>
      </div>
    </div>
  );
}
