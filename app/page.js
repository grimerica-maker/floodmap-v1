"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

const CONFIGURED_FLOOD_ENGINE_URL = process.env.NEXT_PUBLIC_FLOOD_ENGINE_URL;
const FLOOD_ENGINE_PROXY_PATH = "/api/engine";
const DEBUG_FLOOD = true;

const MAP_STYLE_URL = "mapbox://styles/mapbox/streets-v12";
const SATELLITE_STYLE_URL = "mapbox://styles/mapbox/satellite-v9";

const FLOOD_TILE_VERSION = "204";
const FLOOD_SOURCE_ID = "flood-source";
const FLOOD_LAYER_ID = "flood-layer";

const IMPACT_SOURCE_ID = "impact-point-source";
const IMPACT_LAYER_ID = "impact-point-layer";
const IMPACT_PREVIEW_SOURCE_ID = "impact-preview-source";
const IMPACT_CRATER_LAYER_ID = "impact-crater-layer";
const IMPACT_BLAST_LAYER_ID = "impact-blast-layer";
const IMPACT_THERMAL_LAYER_ID = "impact-thermal-layer";

const FRONTEND_BUILD_LABEL = "v48";

// Wave height threshold above which we use global flood overlay
// instead of bounded /flood-region tiles. At 1500m+ the wave is
// extinction-scale and floods everywhere regardless of barriers.
const EXTINCTION_WAVE_HEIGHT_M = 1500;

const PRESETS = [
  { label: "Ice Age", value: -120 },
  { label: "Modern", value: 0 },
  { label: "Holocene", value: 6 },
  { label: "All Ice Melted", value: 70 },
  { label: "Biblical Flood", value: 3048 },
  { label: "Fully Drained", value: -11000 },
];

const safely = (fn) => {
  try { return fn(); } catch (e) { console.warn("Map operation skipped:", e); return null; }
};

export default function HomePage() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const hoverTimerRef = useRef(null);
  const impactPulseFrameRef = useRef(null);
  const impactRequestRef = useRef(null);
  const impactTimeoutRef = useRef(null);

  const seaLevelRef = useRef(0);
  const viewModeRef = useRef("map");
  const scenarioModeRef = useRef("flood");
  const impactDiameterRef = useRef(1000);
  const floodEngineUrlRef = useRef(FLOOD_ENGINE_PROXY_PATH);

  const impactPointRef = useRef(null);
  const impactResultRef = useRef(null);
  const activeFloodLevelRef = useRef(null);
  const initialViewAppliedRef = useRef(false);
  const impactRunSeqRef = useRef(0);

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

  useEffect(() => { seaLevelRef.current = seaLevel; }, [seaLevel]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { scenarioModeRef.current = scenarioMode; }, [scenarioMode]);
  useEffect(() => { impactDiameterRef.current = impactDiameter; }, [impactDiameter]);
  useEffect(() => { impactResultRef.current = impactResult; }, [impactResult]);
  useEffect(() => { floodEngineUrlRef.current = floodEngineUrl; }, [floodEngineUrl]);

  useEffect(() => {
    if (!CONFIGURED_FLOOD_ENGINE_URL) { setFloodEngineUrl(FLOOD_ENGINE_PROXY_PATH); return; }
    if (typeof window !== "undefined" && window.location.protocol === "https:" && CONFIGURED_FLOOD_ENGINE_URL.startsWith("http://")) {
      setFloodEngineUrl(FLOOD_ENGINE_PROXY_PATH); return;
    }
    setFloodEngineUrl(CONFIGURED_FLOOD_ENGINE_URL.replace(/\/+$/, ""));
  }, []);

  const metersToFeet = (m) => m * 3.28084;
  const feetToMeters = (f) => f / 3.28084;
  const formatNumericText = (v, d = 2) => String(Number(v.toFixed(d)));
  const formatInputTextFromMeters = (m, unit = unitMode) =>
    unit === "ft" ? formatNumericText(metersToFeet(m), 2) : formatNumericText(m, 2);

  const parseDisplayLevelToMeters = (text, unit = unitMode) => {
    const t = String(text ?? "").trim();
    if (["", "-", "+", ".", "-.", "+."].includes(t)) return null;
    const p = parseFloat(t);
    if (Number.isNaN(p)) return null;
    return unit === "ft" ? feetToMeters(p) : p;
  };

  const commitInputText = (text = inputText, unit = unitMode) => {
    const m = parseDisplayLevelToMeters(text, unit);
    if (m === null) return null;
    setInputLevel(m);
    setInputText(formatInputTextFromMeters(m, unit));
    return m;
  };

  useEffect(() => {
    setInputText(formatInputTextFromMeters(inputLevel, unitMode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitMode]);

  const formatLevelForDisplay = (meters, unit = unitMode) => {
    if (unit === "ft") { const f = Math.round(metersToFeet(meters)); return `${f > 0 ? "+" : ""}${f} ft`; }
    return `${meters > 0 ? "+" : ""}${Math.round(meters)} m`;
  };

  const formatCompactCount = (v) => {
    const n = Number(v);
    return !Number.isFinite(n) || n < 0 ? "--" : Math.round(n).toLocaleString();
  };

  const floodAllowedInCurrentView = () =>
    ["map", "satellite", "globe"].includes(viewModeRef.current);

  const isMapReady = () => !!mapRef.current && mapRef.current.isStyleLoaded();

  const cancelPendingImpactRequest = () => {
    if (impactTimeoutRef.current) { clearTimeout(impactTimeoutRef.current); impactTimeoutRef.current = null; }
    if (impactRequestRef.current) { impactRequestRef.current.abort(); impactRequestRef.current = null; }
  };

  const applyProjectionForMode = (mode) => {
    const map = mapRef.current;
    if (!map) return;
    if (mode === "globe") {
      safely(() => map.setProjection("globe"));
      safely(() => map.setPitch(0)); safely(() => map.setBearing(0));
      safely(() => map.dragRotate.enable()); safely(() => map.touchZoomRotate.enableRotation());
      return;
    }
    safely(() => map.setProjection("mercator"));
    safely(() => map.setPitch(0)); safely(() => map.setBearing(0));
    safely(() => map.dragRotate.disable()); safely(() => map.touchZoomRotate.disableRotation());
  };

  const removeFloodLayer = () => {
    const map = mapRef.current;
    if (!map) { activeFloodLevelRef.current = null; return; }
    try {
      if (map.getLayer(FLOOD_LAYER_ID)) map.removeLayer(FLOOD_LAYER_ID);
      if (map.getSource(FLOOD_SOURCE_ID)) map.removeSource(FLOOD_SOURCE_ID);
    } catch (e) { console.warn("Failed removing flood layer:", e); }
    activeFloodLevelRef.current = null;
  };

  const removeImpactPreviewLayers = () => {
    const map = mapRef.current;
    if (!map) return;
    if (impactPulseFrameRef.current) { cancelAnimationFrame(impactPulseFrameRef.current); impactPulseFrameRef.current = null; }
    const ids = [
      `${IMPACT_CRATER_LAYER_ID}-pulse`, `${IMPACT_CRATER_LAYER_ID}-inner`,
      `${IMPACT_CRATER_LAYER_ID}-rim`, `${IMPACT_CRATER_LAYER_ID}-ejecta`,
      `${IMPACT_BLAST_LAYER_ID}-fill`, IMPACT_THERMAL_LAYER_ID, IMPACT_BLAST_LAYER_ID, IMPACT_CRATER_LAYER_ID,
    ];
    try {
      ids.forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource(IMPACT_PREVIEW_SOURCE_ID)) map.removeSource(IMPACT_PREVIEW_SOURCE_ID);
    } catch (e) { console.warn("Failed clearing impact preview layers:", e); }
  };

  const clearImpactPreview = () => { removeFloodLayer(); removeImpactPreviewLayers(); };

  const removeImpactPoint = () => {
    const map = mapRef.current;
    if (!map) { impactPointRef.current = null; return; }
    try {
      if (map.getLayer(IMPACT_LAYER_ID)) map.removeLayer(IMPACT_LAYER_ID);
      if (map.getSource(IMPACT_SOURCE_ID)) map.removeSource(IMPACT_SOURCE_ID);
    } catch (e) { console.warn("Failed removing impact point:", e); }
    clearImpactPreview();
    impactPointRef.current = null;
  };

  const drawImpactPoint = (lng, lat) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const data = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] } }] };
    try {
      if (!map.getSource(IMPACT_SOURCE_ID)) {
        map.addSource(IMPACT_SOURCE_ID, { type: "geojson", data });
        map.addLayer({ id: IMPACT_LAYER_ID, type: "circle", source: IMPACT_SOURCE_ID, paint: { "circle-radius": 8, "circle-color": "#ef4444", "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" } });
      } else { map.getSource(IMPACT_SOURCE_ID).setData(data); }
      impactPointRef.current = { lng, lat };
      safely(() => map.triggerRepaint());
    } catch (e) { console.error("Failed to draw impact point", e); }
  };

  const kmCircle = (lng, lat, radiusKm, steps = 96) => {
    const coords = [];
    const kpLat = 110.574;
    const kpLng = 111.32 * Math.cos((lat * Math.PI) / 180);
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      coords.push([lng + (Math.cos(t) * radiusKm) / Math.max(kpLng, 0.0001), lat + (Math.sin(t) * radiusKm) / kpLat]);
    }
    return { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} };
  };

  const startImpactPulseAnimation = () => {
    const map = mapRef.current;
    if (!map) return;
    if (impactPulseFrameRef.current) { cancelAnimationFrame(impactPulseFrameRef.current); impactPulseFrameRef.current = null; }
    const layerId = `${IMPACT_CRATER_LAYER_ID}-pulse`;
    const start = performance.now();
    const tick = (now) => {
      if (!mapRef.current || !mapRef.current.getLayer(layerId)) { impactPulseFrameRef.current = null; return; }
      const pulse = (Math.sin(((now - start) / 1000) * 2.6) + 1) / 2;
      safely(() => {
        const layer = mapRef.current.getLayer(layerId);
        if (!layer) return;
        if (layer.type === "line") {
          mapRef.current.setPaintProperty(layerId, "line-width", 2.5 + pulse * 1.2);
          mapRef.current.setPaintProperty(layerId, "line-opacity", 0.72 + pulse * 0.2);
        }
        if (layer.type === "circle") {
          mapRef.current.setPaintProperty(layerId, "circle-radius", 20 + pulse * 14);
          mapRef.current.setPaintProperty(layerId, "circle-stroke-opacity", 0.45 + pulse * 0.35);
        }
      });
      impactPulseFrameRef.current = requestAnimationFrame(tick);
    };
    impactPulseFrameRef.current = requestAnimationFrame(tick);
  };

  const getImpactPreviewRadiiKm = (d) => {
    const dm = Math.max(50, Math.min(20000, Number(d) || 1000));
    return { crater: Math.max(0.25, dm * 0.0006), blast: Math.max(1, dm * 0.006), thermal: Math.max(2, dm * 0.012) };
  };

  const drawImpactPreview = (lng, lat, diameterM) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    clearImpactPreview();
    const r = getImpactPreviewRadiiKm(diameterM);
    const data = { type: "FeatureCollection", features: [
      { ...kmCircle(lng, lat, r.crater), properties: { kind: "crater" } },
      { ...kmCircle(lng, lat, r.blast), properties: { kind: "blast" } },
      { ...kmCircle(lng, lat, r.thermal), properties: { kind: "thermal" } },
    ]};
    try {
      map.addSource(IMPACT_PREVIEW_SOURCE_ID, { type: "geojson", data });
      map.addLayer({ id: IMPACT_THERMAL_LAYER_ID, type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "thermal"], paint: { "fill-color": "#111111", "fill-opacity": 0.22 } });
      map.addLayer({ id: IMPACT_BLAST_LAYER_ID, type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "blast"], paint: { "line-color": "#ef4444", "line-width": 3, "line-opacity": 1 } });
      map.addLayer({ id: IMPACT_CRATER_LAYER_ID, type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "crater"], paint: { "fill-color": "#000000", "fill-opacity": 0.55 } });
      safely(() => map.triggerRepaint());
    } catch (e) { console.error("Failed to draw impact preview", e); }
  };

  const drawLandImpactFromResult = (lng, lat, result) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !result) return;
    const craterKm = Number(result.crater_diameter_m ?? 0) / 2000;
    const blastKm = Number(result.blast_radius_m ?? 0) / 1000;
    const thermalKm = Number(result.thermal_radius_m ?? 0) / 1000;
    const data = { type: "FeatureCollection", features: [
      { ...kmCircle(lng, lat, thermalKm), properties: { kind: "thermal" } },
      { ...kmCircle(lng, lat, blastKm), properties: { kind: "blast-fill" } },
      { ...kmCircle(lng, lat, blastKm), properties: { kind: "blast" } },
      { ...kmCircle(lng, lat, craterKm * 1.55), properties: { kind: "ejecta" } },
      { ...kmCircle(lng, lat, craterKm * 1.08), properties: { kind: "crater-rim" } },
      { ...kmCircle(lng, lat, craterKm), properties: { kind: "crater" } },
      { ...kmCircle(lng, lat, craterKm * 0.72), properties: { kind: "crater-inner" } },
    ]};
    try {
      clearImpactPreview();
      map.addSource(IMPACT_PREVIEW_SOURCE_ID, { type: "geojson", data });
      map.addLayer({ id: IMPACT_THERMAL_LAYER_ID, type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "thermal"], paint: { "fill-color": "#111111", "fill-opacity": 0.35 } });
      map.addLayer({ id: `${IMPACT_BLAST_LAYER_ID}-fill`, type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "blast-fill"], paint: { "fill-color": "#7f1d1d", "fill-opacity": 0.12 } });
      map.addLayer({ id: IMPACT_BLAST_LAYER_ID, type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "blast"], paint: { "line-color": "#dc2626", "line-width": 3, "line-opacity": 1 } });
      map.addLayer({ id: `${IMPACT_CRATER_LAYER_ID}-ejecta`, type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "ejecta"], paint: { "fill-color": "#3b2a22", "fill-opacity": 0.18 } });
      map.addLayer({ id: `${IMPACT_CRATER_LAYER_ID}-rim`, type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "crater-rim"], paint: { "fill-color": "#1a0f0f", "fill-opacity": 0.3 } });
      map.addLayer({ id: IMPACT_CRATER_LAYER_ID, type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "crater"], paint: { "fill-color": "#000000", "fill-opacity": 0.85 } });
      map.addLayer({ id: `${IMPACT_CRATER_LAYER_ID}-inner`, type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "crater-inner"], paint: { "fill-color": "#000000", "fill-opacity": 0.55 } });
      map.addLayer({ id: `${IMPACT_CRATER_LAYER_ID}-pulse`, type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "crater-rim"], paint: { "line-color": "#ef4444", "line-width": 3, "line-opacity": 0.9 } });
      safely(() => map.triggerRepaint());
      startImpactPulseAnimation();
    } catch (e) { console.error("Failed to draw land impact result", e); }
  };

  const drawOceanImpactMarker = (lng, lat) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return false;
    try {
      removeImpactPreviewLayers();
      map.addSource(IMPACT_PREVIEW_SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: { kind: "impact-core" } }] } });
      map.addLayer({ id: IMPACT_CRATER_LAYER_ID, type: "circle", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "impact-core"], paint: { "circle-radius": 10, "circle-color": "#ef4444", "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" } });
      map.addLayer({ id: `${IMPACT_CRATER_LAYER_ID}-pulse`, type: "circle", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "impact-core"], paint: { "circle-radius": 28, "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 2, "circle-stroke-color": "#ef4444", "circle-stroke-opacity": 0.9 } });
      safely(() => map.triggerRepaint());
      startImpactPulseAnimation();
      return true;
    } catch (e) { console.error("DRAW OCEAN MARKER ERROR", e); return false; }
  };

  const addFloodLayer = (level, opts = {}) => {
    const map = mapRef.current;
    if (!map || !floodAllowedInCurrentView()) return false;
    const normalizedLevel = Number(level);
    if (!Number.isFinite(normalizedLevel) || normalizedLevel === 0) return false;

    const { impactLat, impactLng, reachM } = opts;
    const isRegional = impactLat != null && impactLng != null && reachM != null && reachM > 0;

    const tileUrl = isRegional
      ? `${floodEngineUrlRef.current}/flood-region/${encodeURIComponent(normalizedLevel)}/${encodeURIComponent(impactLat)}/${encodeURIComponent(impactLng)}/${encodeURIComponent(reachM)}/{z}/{x}/{y}.png?v=${FLOOD_TILE_VERSION}`
      : `${floodEngineUrlRef.current}/flood/${encodeURIComponent(normalizedLevel)}/{z}/{x}/{y}.png?v=${FLOOD_TILE_VERSION}`;

    try {
      if (
        activeFloodLevelRef.current === normalizedLevel &&
        map.getLayer(FLOOD_LAYER_ID) &&
        map.getSource(FLOOD_SOURCE_ID)
      ) return true;
      if (map.getLayer(FLOOD_LAYER_ID)) map.removeLayer(FLOOD_LAYER_ID);
      if (map.getSource(FLOOD_SOURCE_ID)) map.removeSource(FLOOD_SOURCE_ID);
      map.addSource(FLOOD_SOURCE_ID, { type: "raster", tiles: [tileUrl], tileSize: 256, minzoom: 0, maxzoom: 22 });
      map.addLayer({ id: FLOOD_LAYER_ID, type: "raster", source: FLOOD_SOURCE_ID, paint: { "raster-opacity": 1, "raster-fade-duration": 0, "raster-resampling": "linear" } });
      activeFloodLevelRef.current = normalizedLevel;
      safely(() => map.triggerRepaint());
      if (DEBUG_FLOOD) console.log("FLOOD LAYER ADDED", { level: normalizedLevel, isRegional, tileUrl });
      return true;
    } catch (e) {
      console.error("Failed to add flood layer", e);
      activeFloodLevelRef.current = null;
      return false;
    }
  };

  const applyOceanImpactFlood = (result, lng, lat) => {
    const waveHeight = Number(result.wave_height_m ?? 0);
    const reachM = Number(result.estimated_wave_reach_m ?? result.tsunami_radius_m ?? 0);
    if (waveHeight <= 0) return false;

    // Extinction scale: wave >= 1500m means global catastrophe.
    // Use the regular global flood overlay at wave_height_m — everything
    // below that elevation floods worldwide. No need for bounded region.
    if (waveHeight >= EXTINCTION_WAVE_HEIGHT_M) {
      const ok = addFloodLayer(waveHeight);
      if (!ok) setTimeout(() => { addFloodLayer(waveHeight); }, 50);
      return true;
    }

    // Normal tsunami: bounded /flood-region tiles with ray blocking
    const ok = addFloodLayer(waveHeight, { impactLat: lat, impactLng: lng, reachM });
    if (!ok) {
      setTimeout(() => { addFloodLayer(waveHeight, { impactLat: lat, impactLng: lng, reachM }); }, 50);
    }
    return true;
  };

  const syncFloodScenario = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (scenarioModeRef.current !== "flood") return;
    if (!floodAllowedInCurrentView()) { removeFloodLayer(); return; }
    const level = Number(seaLevelRef.current);
    if (!Number.isFinite(level) || level === 0) { removeFloodLayer(); return; }
    addFloodLayer(level);
  };

  const applyStyleMode = (mode) => {
    const map = mapRef.current;
    if (!map) return;
    if (mode === "satellite") {
      map.setStyle(SATELLITE_STYLE_URL);
      map.easeTo({ center: [-80.19, 25.76], zoom: 6.2, duration: 250, essential: true });
      return;
    }
    map.setStyle(MAP_STYLE_URL);
    map.easeTo({ center: mode === "globe" ? [0, 20] : [-80.19, 25.76], zoom: mode === "globe" ? 1.6 : 6.2, duration: 250, essential: true });
  };

  const executeFlood = () => {
    cancelPendingImpactRequest();
    impactRunSeqRef.current += 1;
    setImpactLoading(false);
    const parsedLevel = commitInputText(inputText, unitMode);
    if (parsedLevel === null) { setStatus("Enter a valid sea level first"); return; }
    const level = Number(parsedLevel);
    setSeaLevel(level); seaLevelRef.current = level; setInputLevel(level);
    setScenarioMode("flood");
    if (!floodAllowedInCurrentView()) { removeFloodLayer(); setStatus("Switch to a supported view mode"); return; }
    if (level === 0) { removeFloodLayer(); setStatus("Flood cleared"); return; }
    if (!mapRef.current) { setStatus("Map not ready"); return; }
    if (!mapRef.current.isStyleLoaded()) { setStatus("Map style still loading..."); return; }
    removeImpactPoint(); setImpactResult(null); setImpactError("");
    setStatus(`Loading flood tiles at ${formatLevelForDisplay(level)}...`);
    if (!addFloodLayer(level)) setStatus("Flood layer failed to attach");
  };

  const runImpact = async () => {
    if (!impactPointRef.current) { setStatus("Place impact point first"); return; }
    cancelPendingImpactRequest();
    clearImpactPreview();
    const runSeq = impactRunSeqRef.current + 1;
    impactRunSeqRef.current = runSeq;
    const controller = new AbortController();
    impactRequestRef.current = controller;
    impactTimeoutRef.current = setTimeout(() => { controller.abort(); }, 12000);
    try {
      setImpactLoading(true); setImpactError(""); setImpactResult(null);
      setStatus("Running impact simulation...");
      const { lng, lat } = impactPointRef.current;
      const res = await fetch(
        `${floodEngineUrlRef.current}/impact?lat=${lat}&lng=${lng}&diameter=${impactDiameterRef.current}&_=${Date.now()}`,
        { signal: controller.signal, cache: "no-store" }
      );
      if (!res.ok) throw new Error("Impact request failed");
      const data = await res.json();
      if (DEBUG_FLOOD) console.log("IMPACT RESULT", data);
      if (impactRunSeqRef.current !== runSeq) return;
      if (!impactPointRef.current) return;
      if (scenarioModeRef.current !== "impact") return;
      setImpactResult(data);

      if (data.is_ocean_impact === true && Number(data.wave_height_m ?? 0) > 0) {
        drawOceanImpactMarker(impactPointRef.current.lng, impactPointRef.current.lat);
        applyOceanImpactFlood(data, impactPointRef.current.lng, impactPointRef.current.lat);
        const wh = Math.round(Number(data.wave_height_m));
        const reach = Math.round(Number(data.estimated_wave_reach_m ?? 0) / 1000);
        const isExtinction = wh >= EXTINCTION_WAVE_HEIGHT_M;
        setStatus(isExtinction
          ? `Extinction scale impact — ${wh}m global wave`
          : `Ocean impact — ${wh}m wave, ${reach}km reach`
        );
      } else {
        drawLandImpactFromResult(impactPointRef.current.lng, impactPointRef.current.lat, data);
        setStatus("Land impact simulation complete");
      }
    } catch (err) {
      if (impactRunSeqRef.current !== runSeq) return;
      console.error(err);
      clearImpactPreview();
      if (err?.name === "AbortError") { setImpactError("Impact simulation timed out"); setStatus("Impact simulation timed out"); }
      else { setImpactError("Impact simulation failed"); setStatus("Impact simulation failed"); }
    } finally {
      if (impactTimeoutRef.current) { clearTimeout(impactTimeoutRef.current); impactTimeoutRef.current = null; }
      if (impactRequestRef.current === controller) impactRequestRef.current = null;
      if (impactRunSeqRef.current === runSeq) setImpactLoading(false);
    }
  };

  const clearFlood = () => {
    cancelPendingImpactRequest();
    impactRunSeqRef.current += 1;
    setImpactLoading(false);
    setInputLevel(0); setInputText("0"); setSeaLevel(0); seaLevelRef.current = 0;
    removeFloodLayer(); removeImpactPoint(); clearImpactPreview();
    setImpactResult(null); setImpactError("");
    setScenarioMode("flood"); setStatus("Flood cleared");
  };

  const fetchElevation = async (lat, lng) => {
    try {
      const res = await fetch(`${floodEngineUrlRef.current}/elevation?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`, { cache: "no-store" });
      if (!res.ok) { setHoverElevation(null); return; }
      const data = await res.json();
      setHoverElevation(data.elevation_m);
    } catch { setHoverElevation(null); }
  };

  useEffect(() => {
    if (mapRef.current || !floodEngineUrl) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE_URL,
      center: [-80.19, 25.76],
      zoom: 6.2,
      antialias: false,
      attributionControl: true,
      collectResourceTiming: false,
      transformRequest: (url) => ({ url }),
    });

    mapRef.current = map;
    applyProjectionForMode("map");
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.getCanvas().style.cursor = "crosshair";

    const handleError = (e) => {
      const msg = e?.error?.message || e?.message || "";
      if (DEBUG_FLOOD) console.log("Map error:", msg);
    };

    const handleStyleLoad = () => {
      applyProjectionForMode(viewModeRef.current);
      activeFloodLevelRef.current = null;
      if (scenarioModeRef.current === "flood" && Number(seaLevelRef.current) !== 0 && floodAllowedInCurrentView()) {
        setTimeout(() => { syncFloodScenario(); }, 50);
      } else { removeFloodLayer(); }
      if (scenarioModeRef.current === "impact" && impactPointRef.current && impactResultRef.current) {
        const result = impactResultRef.current;
        setTimeout(() => {
          drawImpactPoint(impactPointRef.current.lng, impactPointRef.current.lat);
          if (result.is_ocean_impact === true && Number(result.wave_height_m ?? 0) > 0) {
            drawOceanImpactMarker(impactPointRef.current.lng, impactPointRef.current.lat);
            setTimeout(() => { applyOceanImpactFlood(result, impactPointRef.current.lng, impactPointRef.current.lat); }, 50);
          } else { drawLandImpactFromResult(impactPointRef.current.lng, impactPointRef.current.lat, result); }
        }, 50);
      }
    };

    const handleLoad = () => { setStatus("Map ready"); };

    const handleMouseMove = (e) => {
      const lat = Number(e.lngLat.lat.toFixed(5));
      const lng = Number(e.lngLat.lng.toFixed(5));
      setHoverLat(lat); setHoverLng(lng);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => { fetchElevation(lat, lng); }, 120);
    };

    const handleMouseLeave = () => { setHoverLat(null); setHoverLng(null); setHoverElevation(null); };

    const handleClick = (e) => {
      if (scenarioModeRef.current !== "impact") return;
      cancelPendingImpactRequest();
      impactRunSeqRef.current += 1;
      setImpactLoading(false);
      clearImpactPreview();
      const { lng, lat } = e.lngLat;
      drawImpactPoint(lng, lat);
      drawImpactPreview(lng, lat, impactDiameterRef.current);
      setImpactResult(null); setImpactError("");
      setStatus("Impact preview ready");
    };

    map.on("error", handleError);
    map.on("load", handleLoad);
    map.on("style.load", handleStyleLoad);
    map.on("mousemove", handleMouseMove);
    map.on("mouseleave", handleMouseLeave);
    map.on("click", handleClick);

    return () => {
      cancelPendingImpactRequest();
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (impactPulseFrameRef.current) { cancelAnimationFrame(impactPulseFrameRef.current); impactPulseFrameRef.current = null; }
      map.off("error", handleError); map.off("load", handleLoad);
      map.off("style.load", handleStyleLoad); map.off("mousemove", handleMouseMove);
      map.off("mouseleave", handleMouseLeave); map.off("click", handleClick);
      map.remove();
      mapRef.current = null; activeFloodLevelRef.current = null;
      impactPointRef.current = null; initialViewAppliedRef.current = false;
    };
  }, [floodEngineUrl]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!initialViewAppliedRef.current) { initialViewAppliedRef.current = true; return; }
    applyStyleMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (scenarioMode === "impact") {
      removeFloodLayer();
      setStatus(impactPointRef.current ? "Impact preview ready" : "Click map to place impact point");
      return;
    }
    cancelPendingImpactRequest();
    impactRunSeqRef.current += 1;
    setImpactLoading(false);
    removeImpactPoint(); setImpactResult(null); setImpactError("");
    syncFloodScenario();
  }, [scenarioMode]);

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    if (scenarioMode !== "impact" || !impactResult || !impactPointRef.current) return;
    if (impactResult.is_ocean_impact === true && Number(impactResult.wave_height_m ?? 0) > 0) {
      drawOceanImpactMarker(impactPointRef.current.lng, impactPointRef.current.lat);
      setTimeout(() => { applyOceanImpactFlood(impactResult, impactPointRef.current.lng, impactPointRef.current.lat); }, 50);
      return;
    }
    drawLandImpactFromResult(impactPointRef.current.lng, impactPointRef.current.lat, impactResult);
  }, [impactResult, scenarioMode]);

  useEffect(() => {
    if (scenarioMode !== "impact") return;
    cancelPendingImpactRequest();
    impactRunSeqRef.current += 1;
    setImpactLoading(false); setImpactResult(null); setImpactError("");
    clearImpactPreview();
    if (impactPointRef.current && mapRef.current && mapRef.current.isStyleLoaded()) {
      drawImpactPoint(impactPointRef.current.lng, impactPointRef.current.lat);
      drawImpactPreview(impactPointRef.current.lng, impactPointRef.current.lat, impactDiameter);
      setStatus("Impact preview ready");
    }
  }, [impactDiameter, scenarioMode]);

  useEffect(() => {
    if (!isMapReady() || scenarioMode !== "flood") return;
    syncFloodScenario();
  }, [seaLevel, viewMode, scenarioMode]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (scenarioMode === "impact") {
      const wh = Math.round(Number(impactResult?.wave_height_m ?? 0));
      const reach = Math.round(Number(impactResult?.estimated_wave_reach_m ?? 0) / 1000);
      const isExtinction = wh >= EXTINCTION_WAVE_HEIGHT_M;
      setStatus(
        impactPointRef.current
          ? impactLoading ? "Running impact simulation..."
            : impactResult
              ? impactResult.is_ocean_impact
                ? isExtinction
                  ? `Extinction scale impact — ${wh}m global wave`
                  : `Ocean impact — ${wh}m wave, ${reach}km reach`
                : "Land impact simulation complete"
              : "Impact preview ready"
          : "Click map to place impact point"
      );
      return;
    }
    if (viewMode === "globe" && seaLevel === 0) { setStatus("Globe mode"); return; }
    if (seaLevel === 0) { setStatus("Flood cleared"); return; }
    setStatus(`Flood tiles loaded at ${formatLevelForDisplay(seaLevel)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, seaLevel, unitMode, scenarioMode, impactLoading, impactResult]);

  const waterDifference = hoverElevation !== null ? Number((hoverElevation - seaLevel).toFixed(2)) : null;

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative", overflow: "hidden" }}>
      <div ref={mapContainerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }} />

      <div onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}
        style={{ position: "absolute", top: 0, left: 0, width: 340, height: "100%", background: "rgba(249,250,251,0.97)", borderRight: "1px solid #e5e7eb", padding: 16, fontFamily: "Arial, sans-serif", zIndex: 1000, overflowY: "auto", pointerEvents: "auto" }}>

        <h1 style={{ margin: "8px 0 24px 0", fontSize: 22, color: "red" }}>Floodmap V1 {FRONTEND_BUILD_LABEL} LIVE</h1>
        <div style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>Mapbox flood + impact foundation build</div>

        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>SEA LEVEL</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: seaLevel > 0 ? "#0f62fe" : seaLevel < 0 ? "#b45309" : "#111827" }}>{formatLevelForDisplay(seaLevel)}</div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button onClick={() => setUnitMode("m")} style={{ flex: 1, padding: "10px 8px", border: "1px solid #d1d5db", background: unitMode === "m" ? "#0f172a" : "white", color: unitMode === "m" ? "white" : "#111827", cursor: "pointer", borderRadius: 10, fontWeight: 700 }}>Meters</button>
          <button onClick={() => setUnitMode("ft")} style={{ flex: 1, padding: "10px 8px", border: "1px solid #d1d5db", background: unitMode === "ft" ? "#0f172a" : "white", color: unitMode === "ft" ? "white" : "#111827", cursor: "pointer", borderRadius: 10, fontWeight: 700 }}>Feet</button>
        </div>

        <input type="text" inputMode="decimal" placeholder={unitMode === "ft" ? "Enter sea level in feet" : "Enter sea level in meters"}
          value={inputText} onChange={(e) => setInputText(e.target.value)}
          onBlur={() => { const c = commitInputText(inputText, unitMode); if (c !== null) setInputLevel(c); }}
          onKeyDown={(e) => { if (e.key === "Enter") executeFlood(); }}
          style={{ width: "100%", padding: 12, fontSize: 18, border: "1px solid #ccc", marginBottom: 12, boxSizing: "border-box" }} />

        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <button onClick={executeFlood} style={{ flex: 1, padding: "12px 10px", background: "#0f172a", color: "white", border: "none", fontWeight: 700, cursor: "pointer" }}>Execute Flood</button>
          <button onClick={clearFlood} style={{ flex: 1, padding: "12px 10px", background: "white", color: "#111827", border: "1px solid #ccc", fontWeight: 700, cursor: "pointer" }}>Clear</button>
        </div>

        <div style={{ fontSize: 14, marginBottom: 24 }}>Custom input supports positive and negative values in {unitMode === "ft" ? "feet" : "meters"}</div>
        <hr style={{ margin: "0 0 18px 0" }} />

        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>PRESETS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28 }}>
          {PRESETS.map((preset) => {
            const active = Math.round(inputLevel) === Math.round(preset.value);
            const lbl = unitMode === "ft"
              ? `${Math.round(metersToFeet(preset.value)) > 0 ? "+" : ""}${Math.round(metersToFeet(preset.value))}ft`
              : `${preset.value > 0 ? "+" : ""}${preset.value}m`;
            return (
              <button key={preset.label} onClick={() => { setInputLevel(preset.value); setInputText(formatInputTextFromMeters(preset.value, unitMode)); }}
                style={{ padding: "12px 10px", border: "1px solid #d1d5db", background: active ? "#0f172a" : "white", color: active ? "white" : "#111827", cursor: "pointer", borderRadius: 12, fontWeight: 700 }}>
                <div>{preset.label}</div>
                <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>{lbl}</div>
              </button>
            );
          })}
        </div>

        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>SCENARIO MODE</div>
        <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
          <button onClick={() => setScenarioMode("flood")} style={{ width: "100%", padding: 14, border: "1px solid #d1d5db", background: scenarioMode === "flood" ? "#0f172a" : "white", color: scenarioMode === "flood" ? "white" : "#111827", cursor: "pointer", borderRadius: 12, fontWeight: 700 }}>
            <div>Flood</div><div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>Sea level up / down</div>
          </button>
          <button onClick={() => setScenarioMode("impact")} style={{ width: "100%", padding: 14, border: "1px solid #d1d5db", background: scenarioMode === "impact" ? "#0f172a" : "white", color: scenarioMode === "impact" ? "white" : "#111827", cursor: "pointer", borderRadius: 12, fontWeight: 700 }}>
            <div>Impact</div><div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>Click map to place impact point</div>
          </button>
        </div>

        {scenarioMode === "impact" && (
          <>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>ASTEROID SIZE</div>
            <input type="range" min="50" max="20000" step="50" value={impactDiameter} onChange={(e) => setImpactDiameter(Number(e.target.value))} style={{ width: "100%", marginBottom: 10 }} />
            <input type="number" min="50" max="20000" step="50" value={impactDiameter}
              onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setImpactDiameter(Math.max(50, Math.min(20000, n))); }}
              style={{ width: "100%", padding: 12, fontSize: 18, border: "1px solid #ccc", marginBottom: 20, boxSizing: "border-box" }} />
            <div style={{ fontSize: 14, marginBottom: 24 }}>Diameter: <b>{impactDiameter.toLocaleString()} m</b></div>
            <button onClick={runImpact} disabled={!impactPointRef.current || impactLoading}
              style={{ width: "100%", padding: 14, background: "#ef4444", color: "white", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", marginBottom: 20, opacity: !impactPointRef.current || impactLoading ? 0.7 : 1 }}>
              {impactLoading ? "Running..." : "Run Impact"}
            </button>
          </>
        )}

        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>VIEW MODE</div>
        <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
          {[{ key: "map", label: "Standard Map", sub: "Flood tiles active" }, { key: "satellite", label: "Satellite View", sub: "Flood overlay supported" }, { key: "globe", label: "Globe View", sub: "Flood overlay supported" }].map(({ key, label, sub }) => (
            <button key={key} onClick={() => setViewMode(key)} style={{ width: "100%", padding: 14, border: "1px solid #d1d5db", background: viewMode === key ? "#0f172a" : "white", color: viewMode === key ? "white" : "#111827", cursor: "pointer", borderRadius: 12, fontWeight: 700 }}>
              <div>{label}</div><div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>{sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", right: 20, top: 10, background: "#1e3a5f", color: "white", padding: 16, borderRadius: 12, fontSize: 14, lineHeight: 1.45, zIndex: 1000, minWidth: 320 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Current Scenario</div>
        <div style={{ color: "#facc15", fontWeight: 700 }}>Frontend build: {FRONTEND_BUILD_LABEL}</div>
        <div>Sea level: {formatLevelForDisplay(seaLevel)}</div>
        <div>Mode: {viewMode === "map" ? "Standard Map" : viewMode === "satellite" ? "Satellite" : "Globe"}</div>
        <div>Status: {status}</div>
        <div>Scenario Mode: {scenarioMode}</div>
        <div>Impact Point: {impactPointRef.current ? `${impactPointRef.current.lng.toFixed(3)}, ${impactPointRef.current.lat.toFixed(3)}` : "--"}</div>
        <div>Asteroid Diameter: {impactDiameter.toLocaleString()} m</div>

        {impactError && (<><hr style={{ margin: "10px 0", opacity: 0.25 }} /><div style={{ color: "#fecaca", fontWeight: 700 }}>{impactError}</div></>)}

        {impactResult && (
          <>
            <hr style={{ margin: "10px 0", opacity: 0.25 }} />
            <div style={{ fontWeight: 700 }}>Impact Results</div>
            <div>Energy: {Number(impactResult.energy_mt_tnt ?? impactResult.energy_mt ?? 0).toFixed(2)} Mt</div>
            <div>Crater Diameter: {Math.round(Number(impactResult.crater_diameter_m ?? 0)).toLocaleString()} m</div>
            <div>Blast Radius: {Math.round(Number(impactResult.blast_radius_m ?? 0)).toLocaleString()} m</div>
            <div>Thermal Radius: {Math.round(Number(impactResult.thermal_radius_m ?? 0)).toLocaleString()} m</div>
            {impactResult.is_ocean_impact === true && Number(impactResult.wave_height_m ?? 0) > 0 && (
              <>
                <div>Wave Height: {Math.round(Number(impactResult.wave_height_m ?? 0)).toLocaleString()} m</div>
                {Number(impactResult.wave_height_m ?? 0) < EXTINCTION_WAVE_HEIGHT_M && (
                  <div>Tsunami Reach: {Math.round(Number(impactResult.estimated_wave_reach_m ?? 0) / 1000).toLocaleString()} km</div>
                )}
              </>
            )}
            <div>Severity: {impactResult.severity_class ?? "--"}</div>
            <hr style={{ margin: "10px 0", opacity: 0.2 }} />
            <div style={{ fontWeight: 700 }}>Casualty Estimate</div>
            <div>Population Exposed: {impactResult.population_exposed != null ? formatCompactCount(impactResult.population_exposed) : "Coming soon"}</div>
            <div>Estimated Deaths: {impactResult.estimated_deaths != null ? formatCompactCount(impactResult.estimated_deaths) : "Coming soon"}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Confidence: low / rough estimate</div>
          </>
        )}

        <hr style={{ margin: "10px 0", opacity: 0.25 }} />
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Cursor</div>
        <div>Lat: {hoverLat ?? "--"}</div>
        <div>Lng: {hoverLng ?? "--"}</div>
        <div>Original Elevation: {hoverElevation !== null ? unitMode === "ft" ? `${Math.round(metersToFeet(hoverElevation))} ft` : `${hoverElevation} m` : "--"}</div>
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
