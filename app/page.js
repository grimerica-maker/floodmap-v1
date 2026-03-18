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

const FRONTEND_BUILD_LABEL = "v58";

const EXTINCTION_WAVE_HEIGHT_M = 1500;

const PRESETS = [
  { label: "Ice Age", value: -120 },
  { label: "Modern", value: 0 },
  { label: "All Ice Melted", value: 70 },
  { label: "Biblical Flood", value: 3048 },
  { label: "Fully Drained", value: -11000 },
];

const NUKE_PRESETS = [
  { label: "Tactical", yield_kt: 1 },
  { label: "Hiroshima", yield_kt: 15 },
  { label: "B61", yield_kt: 340 },
  { label: "B83 (1.2Mt)", yield_kt: 1200 },
  { label: "Tsar Bomba", yield_kt: 50000 },
];

const safely = (fn) => {
  try { return fn(); } catch (e) { console.warn("Map operation skipped:", e); return null; }
};

export default function HomePage() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const elevPopupRef = useRef(null);

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
  const [nukeYield, setNukeYield] = useState(15);
  const [nukeBurst, setNukeBurst] = useState("airburst");
  const [nukeWindDeg, setNukeWindDeg] = useState(270);
  const [nukeResult, setNukeResult] = useState(null);
  const [nukeLoading, setNukeLoading] = useState(false);
  const [nukeError, setNukeError] = useState("");
  const nukePointRef = useRef(null);
  const [nukePointSet, setNukePointSet] = useState(false);
  const [impactResult, setImpactResult] = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState("");
  const [unitMode, setUnitMode] = useState("m");
  const [floodDisplaced, setFloodDisplaced] = useState(null);
  const [status, setStatus] = useState("Loading map...");
  const [floodEngineUrl, setFloodEngineUrl] = useState(FLOOD_ENGINE_PROXY_PATH);

  // Mobile-only UI state — purely cosmetic, zero effect on map/engine logic
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);
  // Lazy initializer: correct on first render, no flash of wrong layout
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 640 : false
  );

  // Keep in sync on resize
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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

  const closeElevPopup = () => {
    if (elevPopupRef.current) {
      elevPopupRef.current.remove();
      elevPopupRef.current = null;
    }
  };

  const showElevPopup = async (lng, lat) => {
    const map = mapRef.current;
    if (!map) return;
    closeElevPopup();

    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      className: "elev-popup",
      maxWidth: "220px",
    });

    popup.setLngLat([lng, lat])
      .setHTML(`
        <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;padding:2px 4px">
          <div style="color:#94a3b8;font-size:11px;margin-bottom:4px">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
          <div style="color:#cbd5e1">Loading elevation...</div>
        </div>
      `)
      .addTo(map);

    elevPopupRef.current = popup;

    try {
      const res = await fetch(
        `${floodEngineUrlRef.current}/elevation?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Elevation fetch failed");
      const data = await res.json();
      const elevM = data.elevation_m;

      if (elevPopupRef.current !== popup) return;

      const currentSeaLevel = seaLevelRef.current;
      const diff = elevM - currentSeaLevel;

      const elevDisplay = unitMode === "ft"
        ? `${Math.round(metersToFeet(elevM))} ft`
        : `${elevM} m`;

      let waterStatus = "";
      if (currentSeaLevel !== 0) {
        if (diff >= 0) {
          const aboveDisplay = unitMode === "ft"
            ? `${Math.round(metersToFeet(diff))} ft`
            : `${diff.toFixed(1)} m`;
          waterStatus = `<div style="color:#86efac;margin-top:4px">Above water by ${aboveDisplay}</div>`;
        } else {
          const belowDisplay = unitMode === "ft"
            ? `${Math.round(metersToFeet(Math.abs(diff)))} ft`
            : `${Math.abs(diff).toFixed(1)} m`;
          waterStatus = `<div style="color:#f87171;margin-top:4px">Underwater by ${belowDisplay}</div>`;
        }
      }

      popup.setHTML(`
        <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;padding:2px 4px">
          <div style="color:#94a3b8;font-size:11px;margin-bottom:4px">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
          <div style="color:#e2e8f0">Elevation: <b>${elevDisplay}</b></div>
          ${waterStatus}
        </div>
      `);
    } catch (e) {
      if (elevPopupRef.current !== popup) return;
      popup.setHTML(`
        <div style="font-family:Arial,sans-serif;font-size:13px;padding:2px 4px">
          <div style="color:#94a3b8;font-size:11px;margin-bottom:4px">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
          <div style="color:#f87171">Elevation unavailable</div>
        </div>
      `);
    }
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
    if (waveHeight >= EXTINCTION_WAVE_HEIGHT_M) {
      const ok = addFloodLayer(waveHeight);
      if (!ok) setTimeout(() => { addFloodLayer(waveHeight); }, 50);
      return true;
    }
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
    closeElevPopup();
    setStatus(`Loading flood tiles at ${formatLevelForDisplay(level)}...`);
    if (!addFloodLayer(level)) setStatus("Flood layer failed to attach");
    // Fetch displaced population estimate
    setFloodDisplaced(null);
    fetch(`${floodEngineUrlRef.current}/flood-population?level=${encodeURIComponent(level)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.flood_displaced != null) setFloodDisplaced(d.flood_displaced); })
      .catch(() => {});
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

  const runNuke = async () => {
    if (!nukePointRef.current) { setStatus("Place detonation point first"); return; }
    const nukeLat = nukePointRef.current.lat;
    const nukeLng = nukePointRef.current.lng;
    setNukeLoading(true); setNukeError(""); setNukeResult(null);
    setStatus("Detonating...");
    try {
      const lat = nukeLat;
      const lng = nukeLng;
      const res = await fetch(
        `${floodEngineUrlRef.current}/nuke?lat=${lat}&lng=${lng}&yield_kt=${Number(nukeYield).toFixed(3)}&burst_type=${nukeBurst}&wind_deg=${Number(nukeWindDeg).toFixed(1)}&_=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Nuke request failed");
      const data = await res.json();
      setNukeResult(data);
      drawNukeResult(lng, lat, data);
      setStatus(`${data.severity_class} — ${data.yield_kt >= 1000 ? (data.yield_kt/1000).toFixed(1)+"Mt" : data.yield_kt+"kt"} detonated`);
    } catch (err) {
      setNukeError("Detonation failed");
      setStatus("Detonation failed");
    } finally {
      setNukeLoading(false);
    }
  };

  const drawNukeResult = (lng, lat, data) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    clearImpactPreview();

    const features = [];

    // EMP zone (airburst only) — huge, show first (bottom layer)
    if (data.emp_r_m > 0) {
      features.push({ ...kmCircle(lng, lat, data.emp_r_m / 1000), properties: { kind: "emp" } });
    }
    // Thermal zone
    features.push({ ...kmCircle(lng, lat, data.thermal_r_m / 1000), properties: { kind: "thermal" } });
    // Light blast
    features.push({ ...kmCircle(lng, lat, data.blast_light_r_m / 1000), properties: { kind: "blast-light" } });
    // Moderate blast
    features.push({ ...kmCircle(lng, lat, data.blast_moderate_r_m / 1000), properties: { kind: "blast-moderate" } });
    // Heavy blast
    features.push({ ...kmCircle(lng, lat, data.blast_heavy_r_m / 1000), properties: { kind: "blast-heavy" } });
    // Fireball
    features.push({ ...kmCircle(lng, lat, data.fireball_r_m / 1000), properties: { kind: "fireball" } });
    // Radiation (surface only)
    if (data.radiation_r_m > 0) {
      features.push({ ...kmCircle(lng, lat, data.radiation_r_m / 1000), properties: { kind: "radiation" } });
    }
    // Fallout ellipse (surface only) — approximate as elongated circle
    if (data.fallout_major_km > 0) {
      const falloutFeature = buildFalloutEllipse(lng, lat, data.fallout_major_km, data.fallout_minor_km, data.fallout_direction_deg);
      features.push({ ...falloutFeature, properties: { kind: "fallout" } });
    }

    try {
      map.addSource(IMPACT_PREVIEW_SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features } });
      if (data.emp_r_m > 0) {
        map.addLayer({ id: "nuke-emp", type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "emp"], paint: { "fill-color": "#7c3aed", "fill-opacity": 0.06 } });
        map.addLayer({ id: "nuke-emp-line", type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "emp"], paint: { "line-color": "#7c3aed", "line-width": 1.5, "line-opacity": 0.5, "line-dasharray": [4, 4] } });
      }
      map.addLayer({ id: "nuke-thermal", type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "thermal"], paint: { "fill-color": "#f97316", "fill-opacity": 0.12 } });
      map.addLayer({ id: "nuke-blast-light", type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "blast-light"], paint: { "fill-color": "#fbbf24", "fill-opacity": 0.15 } });
      map.addLayer({ id: "nuke-blast-moderate", type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "blast-moderate"], paint: { "fill-color": "#ef4444", "fill-opacity": 0.25 } });
      map.addLayer({ id: "nuke-blast-heavy", type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "blast-heavy"], paint: { "fill-color": "#dc2626", "fill-opacity": 0.45 } });
      map.addLayer({ id: "nuke-fireball", type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "fireball"], paint: { "fill-color": "#ffffff", "fill-opacity": 0.95 } });
      if (data.radiation_r_m > 0) {
        map.addLayer({ id: "nuke-radiation", type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "radiation"], paint: { "line-color": "#84cc16", "line-width": 2, "line-opacity": 0.9, "line-dasharray": [3, 3] } });
      }
      if (data.fallout_major_km > 0) {
        map.addLayer({ id: "nuke-fallout", type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "fallout"], paint: { "fill-color": "#84cc16", "fill-opacity": 0.12 } });
        map.addLayer({ id: "nuke-fallout-line", type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "fallout"], paint: { "line-color": "#84cc16", "line-width": 1.5, "line-opacity": 0.7 } });
      }
      safely(() => map.triggerRepaint());
    } catch (e) { console.error("Failed to draw nuke result", e); }
  };

  const buildFalloutEllipse = (lng, lat, majorKm, minorKm, directionDeg, steps = 64) => {
    const coords = [];
    const kpLat = 110.574;
    const kpLng = 111.32 * Math.cos((lat * Math.PI) / 180);
    const dirRad = (directionDeg * Math.PI) / 180;
    // Center of ellipse is shifted downwind by half the major axis
    const centerLat = lat + (Math.cos(dirRad) * majorKm * 0.5) / kpLat;
    const centerLng = lng + (Math.sin(dirRad) * majorKm * 0.5) / Math.max(kpLng, 0.0001);
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = Math.cos(t) * majorKm;
      const y = Math.sin(t) * minorKm;
      // Rotate by direction
      const xr = x * Math.cos(dirRad) - y * Math.sin(dirRad);
      const yr = x * Math.sin(dirRad) + y * Math.cos(dirRad);
      coords.push([centerLng + yr / Math.max(kpLng, 0.0001), centerLat + xr / kpLat]);
    }
    return { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} };
  };

  const clearFlood = () => {
    cancelPendingImpactRequest();
    impactRunSeqRef.current += 1;
    setImpactLoading(false);
    setInputLevel(0); setInputText("0"); setSeaLevel(0); seaLevelRef.current = 0;
    removeFloodLayer(); removeImpactPoint(); clearImpactPreview();
    setImpactResult(null); setImpactError("");
    setScenarioMode("flood");
    setFloodDisplaced(null);
    closeElevPopup();
    setStatus("Flood cleared");
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

    let mouseDownPoint = null;

    const handleMouseDown = (e) => {
      mouseDownPoint = e.point;
    };

    const handleClick = (e) => {
      if (mouseDownPoint) {
        const dx = e.point.x - mouseDownPoint.x;
        const dy = e.point.y - mouseDownPoint.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) {
          mouseDownPoint = null;
          return;
        }
      }
      mouseDownPoint = null;

      const { lng, lat } = e.lngLat;

      if (scenarioModeRef.current === "impact") {
        cancelPendingImpactRequest();
        impactRunSeqRef.current += 1;
        setImpactLoading(false);
        clearImpactPreview();
        drawImpactPoint(lng, lat);
        drawImpactPreview(lng, lat, impactDiameterRef.current);
        setImpactResult(null); setImpactError("");
        setStatus("Impact preview ready");
        return;
      }

      if (scenarioModeRef.current === "nuke") {
        nukePointRef.current = { lng, lat };
        setNukePointSet(true);
        clearImpactPreview();
        drawImpactPoint(lng, lat);
        setNukeResult(null); setNukeError("");
        setStatus("Nuke point placed — set yield and detonate");
        return;
      }

      showElevPopup(lng, lat);
    };

    map.on("error", handleError);
    map.on("load", handleLoad);
    map.on("style.load", handleStyleLoad);
    map.on("mousedown", handleMouseDown);
    map.on("click", handleClick);

    return () => {
      cancelPendingImpactRequest();
      if (impactPulseFrameRef.current) { cancelAnimationFrame(impactPulseFrameRef.current); impactPulseFrameRef.current = null; }
      closeElevPopup();
      map.off("error", handleError);
      map.off("load", handleLoad);
      map.off("style.load", handleStyleLoad);
      map.off("mousedown", handleMouseDown);
      map.off("click", handleClick);
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
      closeElevPopup();
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
    if (scenarioMode === "nuke") {
      setStatus(nukePointSet
        ? nukeLoading ? "Detonating..." : nukeResult ? `${nukeResult.severity_class} — ${nukeResult.yield_kt >= 1000 ? (nukeResult.yield_kt/1000).toFixed(1)+"Mt" : nukeResult.yield_kt+"kt"}` : "Nuke point placed — detonate"
        : "Click map to place detonation point"
      );
      return;
    }
    if (viewMode === "globe" && seaLevel === 0) { setStatus("Globe mode"); return; }
    if (seaLevel === 0) { setStatus("Flood cleared"); return; }
    setStatus(`Flood tiles loaded at ${formatLevelForDisplay(seaLevel)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, seaLevel, unitMode, scenarioMode, impactLoading, impactResult, nukeLoading, nukeResult, nukePointSet]);

  // ─── Derived display values for the collapsed strip ───────────────────────
  const stripLabel = scenarioMode === "impact"
    ? `💥 ${impactDiameter.toLocaleString()}m`
    : scenarioMode === "nuke"
    ? `☢️ ${nukeYield >= 1000 ? (nukeYield/1000).toFixed(1)+"Mt" : nukeYield+"kt"}`
    : formatLevelForDisplay(seaLevel);

  const stripModePill = scenarioMode === "impact" ? "Impact" : scenarioMode === "nuke" ? "Nuke" : "Flood";

  const handleStripCTA = (e) => {
    e.stopPropagation();
    if (scenarioMode === "impact") runImpact();
    else if (scenarioMode === "nuke") runNuke();
    else executeFlood();
  };

  // ─── Shared panel content (renders inside both desktop sidebar & mobile drawer) ──
  const panelContent = (
    <>
      <h1 style={{ margin: "8px 0 16px 0", fontSize: 20, color: "red" }}>Floodmap V1 {FRONTEND_BUILD_LABEL} LIVE</h1>
      <div style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>Mapbox flood + impact foundation build</div>

      {/* ── SEA LEVEL ── */}
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, letterSpacing: "0.05em" }}>SEA LEVEL</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: seaLevel > 0 ? "#0f62fe" : seaLevel < 0 ? "#b45309" : "#111827" }}>
        {formatLevelForDisplay(seaLevel)}
      </div>

      {/* ── UNIT TOGGLE ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button
          onClick={() => setUnitMode("m")}
          style={{ flex: 1, padding: "12px 8px", minHeight: 44, border: "1px solid #d1d5db", background: unitMode === "m" ? "#0f172a" : "white", color: unitMode === "m" ? "white" : "#111827", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 15 }}>
          Meters
        </button>
        <button
          onClick={() => setUnitMode("ft")}
          style={{ flex: 1, padding: "12px 8px", minHeight: 44, border: "1px solid #d1d5db", background: unitMode === "ft" ? "#0f172a" : "white", color: unitMode === "ft" ? "white" : "#111827", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 15 }}>
          Feet
        </button>
      </div>

      <input
        type="text"
        inputMode="decimal"
        placeholder={unitMode === "ft" ? "Enter sea level in feet" : "Enter sea level in meters"}
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onBlur={() => { const c = commitInputText(inputText, unitMode); if (c !== null) setInputLevel(c); }}
        onKeyDown={(e) => { if (e.key === "Enter") executeFlood(); }}
        style={{ width: "100%", padding: "12px 14px", fontSize: 17, border: "1px solid #ccc", marginBottom: 10, boxSizing: "border-box", borderRadius: 8, minHeight: 48 }}
      />

      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <button
          onClick={executeFlood}
          style={{ flex: 1, padding: "13px 10px", minHeight: 48, background: "#0f172a", color: "white", border: "none", fontWeight: 700, cursor: "pointer", borderRadius: 8, fontSize: 15 }}>
          Execute Flood
        </button>
        <button
          onClick={clearFlood}
          style={{ flex: 1, padding: "13px 10px", minHeight: 48, background: "white", color: "#111827", border: "1px solid #ccc", fontWeight: 700, cursor: "pointer", borderRadius: 8, fontSize: 15 }}>
          Clear
        </button>
      </div>

      <div style={{ fontSize: 13, marginBottom: 20, color: "#666" }}>
        Custom input supports positive and negative values in {unitMode === "ft" ? "feet" : "meters"}
      </div>

      <hr style={{ margin: "0 0 16px 0", borderColor: "#e5e7eb" }} />

      {/* ── PRESETS ── */}
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, letterSpacing: "0.05em" }}>PRESETS</div>
      <div className={isMobile ? "fm-presets-mobile" : "fm-presets-desktop"}>
        {PRESETS.map((preset) => {
          const active = Math.round(inputLevel) === Math.round(preset.value);
          const lbl = unitMode === "ft"
            ? `${Math.round(metersToFeet(preset.value)) > 0 ? "+" : ""}${Math.round(metersToFeet(preset.value))}ft`
            : `${preset.value > 0 ? "+" : ""}${preset.value}m`;
          return (
            <button
              key={preset.label}
              onClick={() => { setInputLevel(preset.value); setInputText(formatInputTextFromMeters(preset.value, unitMode)); }}
              style={{ padding: "12px 10px", minHeight: 56, border: "1px solid #d1d5db", background: active ? "#0f172a" : "white", color: active ? "white" : "#111827", cursor: "pointer", borderRadius: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 14 }}>{preset.label}</div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 3 }}>{lbl}</div>
            </button>
          );
        })}
      </div>

      <hr style={{ margin: "0 0 16px 0", borderColor: "#e5e7eb" }} />

      {/* ── SCENARIO MODE ── */}
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, letterSpacing: "0.05em" }}>SCENARIO MODE</div>
      <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => setScenarioMode("flood")}
          style={{ width: "100%", padding: "13px 14px", minHeight: 56, border: "1px solid #d1d5db", background: scenarioMode === "flood" ? "#0f172a" : "white", color: scenarioMode === "flood" ? "white" : "#111827", cursor: "pointer", borderRadius: 12, fontWeight: 700, textAlign: "left" }}>
          <div style={{ fontSize: 15 }}>Flood</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 3 }}>Sea level up / down</div>
        </button>
        <button
          onClick={() => setScenarioMode("impact")}
          style={{ width: "100%", padding: "13px 14px", minHeight: 56, border: "1px solid #d1d5db", background: scenarioMode === "impact" ? "#0f172a" : "white", color: scenarioMode === "impact" ? "white" : "#111827", cursor: "pointer", borderRadius: 12, fontWeight: 700, textAlign: "left" }}>
          <div style={{ fontSize: 15 }}>Impact</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 3 }}>Click map to place impact point</div>
        </button>
        <button
          onClick={() => { setScenarioMode("nuke"); clearImpactPreview(); setNukeResult(null); setNukeError(""); setNukePointSet(false); nukePointRef.current = null; }}
          style={{ width: "100%", padding: "13px 14px", minHeight: 56, border: "1px solid #d1d5db", background: scenarioMode === "nuke" ? "#7c3aed" : "white", color: scenarioMode === "nuke" ? "white" : "#111827", cursor: "pointer", borderRadius: 12, fontWeight: 700, textAlign: "left" }}>
          <div style={{ fontSize: 15 }}>☢️ Nuke</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 3 }}>Click map to place detonation point</div>
        </button>
      </div>

      {/* ── IMPACT CONTROLS ── */}
      {scenarioMode === "impact" && (
        <>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, letterSpacing: "0.05em" }}>ASTEROID SIZE</div>
          <input
            type="range" min="50" max="20000" step="50" value={impactDiameter}
            onChange={(e) => setImpactDiameter(Number(e.target.value))}
            style={{ width: "100%", marginBottom: 10, height: 6, cursor: "pointer" }}
          />
          <input
            type="number" min="50" max="20000" step="50" value={impactDiameter}
            onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setImpactDiameter(Math.max(50, Math.min(20000, n))); }}
            style={{ width: "100%", padding: "12px 14px", fontSize: 17, border: "1px solid #ccc", marginBottom: 10, boxSizing: "border-box", borderRadius: 8, minHeight: 48 }}
          />
          <div style={{ fontSize: 13, marginBottom: 16, color: "#555" }}>
            Diameter: <b>{impactDiameter.toLocaleString()} m</b>
          </div>
          <button
            onClick={runImpact}
            disabled={!impactPointRef.current || impactLoading}
            style={{ width: "100%", padding: "14px 10px", minHeight: 52, background: "#ef4444", color: "white", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", marginBottom: 20, fontSize: 16, opacity: !impactPointRef.current || impactLoading ? 0.65 : 1 }}>
            {impactLoading ? "Running..." : "Run Impact"}
          </button>
        </>
      )}

      <hr style={{ margin: "0 0 16px 0", borderColor: "#e5e7eb" }} />

      {/* ── NUKE CONTROLS ── */}
      {scenarioMode === "nuke" && (
        <>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, letterSpacing: "0.05em" }}>YIELD</div>
          <div className={isMobile ? "fm-presets-mobile" : "fm-presets-desktop"} style={{ marginBottom: 12 }}>
            {NUKE_PRESETS.map((p) => (
              <button key={p.label} onClick={() => setNukeYield(p.yield_kt)}
                style={{ padding: "10px 8px", minHeight: 48, border: "1px solid #d1d5db", background: nukeYield === p.yield_kt ? "#7c3aed" : "white", color: nukeYield === p.yield_kt ? "white" : "#111827", cursor: "pointer", borderRadius: 10, fontWeight: 700, whiteSpace: "nowrap", fontSize: 13 }}>
                {p.label}
              </button>
            ))}
          </div>
          <input type="range" min="0.001" max="50000" step="1" value={nukeYield}
            onChange={(e) => setNukeYield(Number(e.target.value))}
            style={{ width: "100%", marginBottom: 6, cursor: "pointer" }} />
          <div style={{ fontSize: 13, marginBottom: 12, color: "#555" }}>
            Yield: <b>{nukeYield >= 1000 ? (nukeYield/1000).toFixed(2)+" Mt" : nukeYield+" kt"}</b>
          </div>

          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>BURST TYPE</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button onClick={() => setNukeBurst("airburst")}
              style={{ flex: 1, padding: "11px 8px", minHeight: 44, border: "1px solid #d1d5db", background: nukeBurst === "airburst" ? "#7c3aed" : "white", color: nukeBurst === "airburst" ? "white" : "#111827", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 14 }}>
              Airburst
            </button>
            <button onClick={() => setNukeBurst("surface")}
              style={{ flex: 1, padding: "11px 8px", minHeight: 44, border: "1px solid #d1d5db", background: nukeBurst === "surface" ? "#7c3aed" : "white", color: nukeBurst === "surface" ? "white" : "#111827", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 14 }}>
              Surface
            </button>
          </div>

          {nukeBurst === "surface" && (
            <>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>WIND DIRECTION</div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Wind blowing FROM: <b>{nukeWindDeg}°</b> → fallout goes {Math.round((nukeWindDeg + 180) % 360)}°</div>
              <input type="range" min="0" max="359" step="1" value={nukeWindDeg}
                onChange={(e) => setNukeWindDeg(Number(e.target.value))}
                style={{ width: "100%", marginBottom: 14, cursor: "pointer" }} />
            </>
          )}

          <button onClick={runNuke} disabled={!nukePointSet || nukeLoading}
            style={{ width: "100%", padding: "14px 10px", minHeight: 52, background: "#7c3aed", color: "white", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", marginBottom: 16, fontSize: 16, opacity: !nukePointRef.current || nukeLoading ? 0.65 : 1 }}>
            {nukeLoading ? "Detonating..." : "☢️ Detonate"}
          </button>

          {nukeError && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{nukeError}</div>}
        </>
      )}

      {/* ── VIEW MODE ── */}
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, letterSpacing: "0.05em" }}>VIEW MODE</div>
      <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
        {[
          { key: "map", label: "Standard Map", sub: "Flood tiles active" },
          { key: "satellite", label: "Satellite View", sub: "Flood overlay supported" },
          { key: "globe", label: "Globe View", sub: "Flood overlay supported" },
        ].map(({ key, label, sub }) => (
          <button
            key={key}
            onClick={() => setViewMode(key)}
            style={{ width: "100%", padding: "13px 14px", minHeight: 56, border: "1px solid #d1d5db", background: viewMode === key ? "#0f172a" : "white", color: viewMode === key ? "white" : "#111827", cursor: "pointer", borderRadius: 12, fontWeight: 700, textAlign: "left" }}>
            <div style={{ fontSize: 15 }}>{label}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 3 }}>{sub}</div>
          </button>
        ))}
      </div>
    </>
  );

  // ─── Stats panel content ───────────────────────────────────────────────────
  const statsContent = (
    <>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Current Scenario</div>
      <div style={{ color: "#facc15", fontWeight: 700 }}>Frontend build: {FRONTEND_BUILD_LABEL}</div>
      <div>Sea level: {formatLevelForDisplay(seaLevel)}</div>
      {floodDisplaced != null && scenarioMode === "flood" && (
        <div style={{ color: "#fca5a5", fontWeight: 700 }}>
          Displaced: {floodDisplaced.toLocaleString()} people
        </div>
      )}
      <div>Mode: {viewMode === "map" ? "Standard Map" : viewMode === "satellite" ? "Satellite" : "Globe"}</div>
      <div>Status: {status}</div>
      <div>Scenario Mode: {scenarioMode}</div>
      <div>Impact Point: {impactPointRef.current ? `${impactPointRef.current.lng.toFixed(3)}, ${impactPointRef.current.lat.toFixed(3)}` : "--"}</div>
      <div>Asteroid Diameter: {impactDiameter.toLocaleString()} m</div>

      {impactError && (
        <>
          <hr style={{ margin: "10px 0", opacity: 0.25 }} />
          <div style={{ color: "#fecaca", fontWeight: 700 }}>{impactError}</div>
        </>
      )}

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

      {scenarioMode === "flood" && (
        <>
          <hr style={{ margin: "10px 0", opacity: 0.25 }} />
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Click map to see elevation</div>
        </>
      )}

      {scenarioMode === "nuke" && nukeResult && (
        <>
          <hr style={{ margin: "10px 0", opacity: 0.25 }} />
          <div style={{ fontWeight: 700, marginBottom: 4 }}>☢️ Detonation Results</div>
          <div>Yield: {nukeResult.yield_kt >= 1000 ? (nukeResult.yield_kt/1000).toFixed(2)+" Mt" : nukeResult.yield_kt+" kt"}</div>
          <div>Type: {nukeResult.burst_type}</div>
          <div>Severity: {nukeResult.severity_class}</div>
          <hr style={{ margin: "8px 0", opacity: 0.2 }} />
          <div style={{ color: "#fca5a5" }}>Fireball: {Math.round(nukeResult.fireball_r_m).toLocaleString()} m</div>
          <div style={{ color: "#fca5a5" }}>Heavy blast: {(Math.round(nukeResult.blast_heavy_r_m)/1000).toFixed(1)} km</div>
          <div style={{ color: "#fbbf24" }}>Moderate blast: {(Math.round(nukeResult.blast_moderate_r_m)/1000).toFixed(1)} km</div>
          <div style={{ color: "#fb923c" }}>Thermal (3rd°): {(Math.round(nukeResult.thermal_r_m)/1000).toFixed(1)} km</div>
          <div style={{ color: "#a3e635" }}>Light blast: {(Math.round(nukeResult.blast_light_r_m)/1000).toFixed(1)} km</div>
          {nukeResult.radiation_r_m > 0 && <div style={{ color: "#86efac" }}>Radiation 500rem: {Math.round(nukeResult.radiation_r_m).toLocaleString()} m</div>}
          {nukeResult.emp_r_m > 0 && <div style={{ color: "#c4b5fd" }}>EMP radius: {(Math.round(nukeResult.emp_r_m)/1000).toFixed(0)} km</div>}
          {nukeResult.fallout_major_km > 0 && <div style={{ color: "#86efac" }}>Fallout: {Math.round(nukeResult.fallout_major_km)} × {Math.round(nukeResult.fallout_minor_km)} km</div>}
          <hr style={{ margin: "8px 0", opacity: 0.2 }} />
          <div style={{ fontWeight: 700 }}>Casualties</div>
          <div>Exposed: {nukeResult.population_exposed != null ? nukeResult.population_exposed.toLocaleString() : "—"}</div>
          <div>Est. deaths: {nukeResult.estimated_deaths != null ? nukeResult.estimated_deaths.toLocaleString() : "—"}</div>
        </>
      )}
    </>
  );

  return (
    <div style={{ width: "100%", height: "100vh", height: "100dvh", position: "relative", overflow: "hidden" }}>
      <style>{`
        /* ── Mapbox popup ── */
        .elev-popup .mapboxgl-popup-content {
          background: #1e3a5f;
          color: white;
          border-radius: 10px;
          padding: 10px 12px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          min-width: 160px;
        }
        .elev-popup .mapboxgl-popup-close-button { color: #94a3b8; font-size: 16px; padding: 4px 8px; }
        .elev-popup .mapboxgl-popup-close-button:hover { color: white; }
        .elev-popup .mapboxgl-popup-tip { border-top-color: #1e3a5f; }

        /* ── Preset grid: 2-col on desktop, horizontal scroll on mobile ── */
        .fm-presets {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        /* ── Mobile drawer slide transition ── */
        .fm-drawer {
          transition: transform 0.32s cubic-bezier(0.4,0,0.2,1);
        }

        /* ── Stats panel slide transition ── */
        .fm-stats-sheet {
          transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
        }

        /* Presets: horizontal scroll on mobile, 2-col grid on desktop — driven by isMobile inline styles */
        .fm-presets-mobile {
          display: flex;
          flex-direction: row;
          overflow-x: auto;
          gap: 10px;
          padding-bottom: 4px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          margin-bottom: 24px;
        }
        .fm-presets-mobile::-webkit-scrollbar { display: none; }
        .fm-presets-mobile > button { flex: 0 0 auto; min-width: 110px; }
        .fm-presets-desktop {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 24px;
        }
      `}</style>

      {/* ── Map canvas ── */}
      <div ref={mapContainerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }} />

      {/* ═══════════════════════════════════════════════
          DESKTOP: left sidebar panel (unchanged from v50)
      ═══════════════════════════════════════════════ */}
      <div
        className="fm-desktop-panel"
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: isMobile ? "none" : "block",
          position: "absolute", top: 0, left: 0,
          width: 340, height: "100%",
          background: "rgba(249,250,251,0.97)",
          borderRight: "1px solid #e5e7eb",
          padding: 16,
          fontFamily: "Arial, sans-serif",
          zIndex: 1000,
          overflowY: "auto",
          pointerEvents: "auto",
        }}
      >
        {panelContent}
      </div>

      {/* ═══════════════════════════════════════════════
          DESKTOP: right stats panel (unchanged from v50)
      ═══════════════════════════════════════════════ */}
      <div
        className="fm-desktop-stats"
        style={{
          display: isMobile ? "none" : "block",
          position: "absolute", right: 20, top: 10,
          background: "#1e3a5f", color: "white",
          padding: 16, borderRadius: 12,
          fontSize: 14, lineHeight: 1.45,
          zIndex: 1000, minWidth: 320,
        }}
      >
        {statsContent}
      </div>

      {/* ═══════════════════════════════════════════════
          MOBILE: stats pill — top center, tap to expand
      ═══════════════════════════════════════════════ */}
      <div
        className="fm-mobile-stats-pill"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setStatsExpanded((v) => !v); }}
        style={{
          display: isMobile ? "flex" : "none",
          position: "absolute", top: 10, left: "50%",
          transform: "translateX(-50%)",
          background: "#1e3a5f", color: "white",
          borderRadius: 20, padding: "7px 16px",
          fontSize: 13, fontWeight: 700,
          zIndex: drawerOpen ? 999 : 1100, cursor: "pointer",
          alignItems: "center", gap: 8,
          boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
          whiteSpace: "nowrap",
          userSelect: "none",
          pointerEvents: drawerOpen ? "none" : "auto",
        }}
      >
        <span style={{ color: "#facc15" }}>{FRONTEND_BUILD_LABEL}</span>
        <span style={{ opacity: 0.7, margin: "0 2px" }}>·</span>
        <span>{formatLevelForDisplay(seaLevel)}</span>
        <span style={{ opacity: 0.7, margin: "0 2px" }}>·</span>
        <span style={{ opacity: 0.85 }}>{status.length > 28 ? status.slice(0, 26) + "…" : status}</span>
        <span style={{ marginLeft: 4, opacity: 0.7, fontSize: 11 }}>{statsExpanded ? "▲" : "▼"}</span>
      </div>

      {/* MOBILE: stats expanded sheet */}
      <div
        className="fm-stats-sheet"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: (isMobile && statsExpanded) ? "block" : "none",
          position: "absolute", top: 48, left: 10, right: 10,
          background: "#1e3a5f", color: "white",
          padding: "14px 16px", borderRadius: 14,
          fontSize: 13, lineHeight: 1.5,
          zIndex: 1050,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          maxHeight: "55vh", overflowY: "auto",
        }}
      >
        {statsContent}
      </div>

      {/* ═══════════════════════════════════════════════
          MOBILE: bottom drawer (full panel content)
      ═══════════════════════════════════════════════ */}
      <div
        className="fm-mobile-drawer fm-drawer"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: isMobile ? "flex" : "none",
          flexDirection: "column",
          position: "fixed", bottom: 0, left: 0, right: 0,
          height: "76vh",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          background: "rgba(249,250,251,0.98)",
          borderTop: "1px solid #d1d5db",
          borderRadius: "18px 18px 0 0",
          zIndex: 1002,
          transform: drawerOpen ? "translateY(0)" : "translateY(100%)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.18)",
          pointerEvents: drawerOpen ? "auto" : "none",
        }}
      >
        {/* Drawer handle bar */}
        <div
          onClick={() => setDrawerOpen(false)}
          style={{ flexShrink: 0, display: "flex", justifyContent: "center", alignItems: "center", padding: "10px 0 6px 0", cursor: "pointer" }}
        >
          <div style={{ width: 40, height: 4, background: "#d1d5db", borderRadius: 4 }} />
        </div>

        {/* Scrollable panel content inside drawer */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 32px 16px" }}>
          {panelContent}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          MOBILE: collapsed bottom strip (always visible)
      ═══════════════════════════════════════════════ */}
      <div
        className="fm-mobile-strip"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: isMobile ? "flex" : "none",
          position: "fixed", bottom: 0, left: 0, right: 0,
          height: 72,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          background: "rgba(249,250,251,0.97)",
          borderTop: "1px solid #e5e7eb",
          borderRadius: "14px 14px 0 0",
          zIndex: 1001,
          alignItems: "center",
          padding: "0 12px",
          gap: 10,
          boxShadow: "0 -2px 12px rgba(0,0,0,0.1)",
          fontFamily: "Arial, sans-serif",
          transform: drawerOpen ? "translateY(100%)" : "translateY(0)",
          transition: "transform 0.32s cubic-bezier(0.4,0,0.2,1)",
          pointerEvents: drawerOpen ? "none" : "auto",
        }}
      >
        {/* Left: current level + mode pill */}
        <div
          onClick={() => setDrawerOpen(true)}
          style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, cursor: "pointer", minWidth: 0 }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: seaLevel > 0 ? "#0f62fe" : seaLevel < 0 ? "#b45309" : "#111827", lineHeight: 1 }}>
            {stripLabel}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ background: scenarioMode === "impact" ? "#ef4444" : "#0f172a", color: "white", fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 7px" }}>
              {stripModePill}
            </span>
            <span style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {status.length > 22 ? status.slice(0, 20) + "…" : status}
            </span>
          </div>
        </div>

        {/* Center: big CTA button */}
        <button
          onClick={handleStripCTA}
          disabled={(scenarioMode === "impact" && impactLoading) || (scenarioMode === "nuke" && (nukeLoading || !nukePointSet))}
          style={{
            flexShrink: 0,
            padding: "0 20px",
            height: 48,
            background: scenarioMode === "impact" ? "#ef4444" : scenarioMode === "nuke" ? "#7c3aed" : "#0f172a",
            color: "white",
            border: "none",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
            opacity: (scenarioMode === "impact" && impactLoading) ? 0.65 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {scenarioMode === "impact"
            ? (impactLoading ? "Running…" : "Run Impact")
            : scenarioMode === "nuke"
            ? (nukeLoading ? "Detonating…" : "☢️ Detonate")
            : "Execute Flood"}
        </button>

        {/* Right: chevron toggle to open drawer */}
        <button
          onClick={() => setDrawerOpen((v) => !v)}
          style={{ flexShrink: 0, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid #e5e7eb", borderRadius: 10, cursor: "pointer", fontSize: 18, color: "#374151" }}
        >
          ⌃
        </button>
      </div>
    </div>
  );
}
