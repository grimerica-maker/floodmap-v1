"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

const CONFIGURED_FLOOD_ENGINE_URL = process.env.NEXT_PUBLIC_FLOOD_ENGINE_URL;
const FLOOD_ENGINE_PROXY_PATH = "/api/engine";
const DEBUG_FLOOD = true;

const MAP_STYLE_URL = "mapbox://styles/mapbox/streets-v12";
const SATELLITE_STYLE_URL = "mapbox://styles/mapbox/satellite-streets-v12";

const FLOOD_TILE_VERSION = "204";
const FLOOD_SOURCE_ID = "flood-source";
const FLOOD_LAYER_ID = "flood-layer";

const IMPACT_SOURCE_ID = "impact-point-source";
const IMPACT_LAYER_ID = "impact-point-layer";
const IMPACT_PREVIEW_SOURCE_ID = "impact-preview-source";
const IMPACT_CRATER_LAYER_ID = "impact-crater-layer";
const IMPACT_BLAST_LAYER_ID = "impact-blast-layer";
const IMPACT_THERMAL_LAYER_ID = "impact-thermal-layer";

const FRONTEND_BUILD_LABEL = "v65";
const LOGO_DATA = "data:image/png;base64,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";

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

  // Star field animation
  useEffect(() => {
    const canvas = document.getElementById("star-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    const stars = Array.from({ length: 300 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.4 + 0.3,
      alpha: Math.random() * 0.7 + 0.3,
      speed: Math.random() * 0.004 + 0.001,
      phase: Math.random() * Math.PI * 2,
    }));
    const draw = (t) => {
      const W = canvas.width = canvas.offsetWidth;
      const H = canvas.height = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#00001a";
      ctx.fillRect(0, 0, W, H);
      stars.forEach((s) => {
        const a = s.alpha * (0.6 + 0.4 * Math.sin(t * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

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
      `${IMPACT_CRATER_LAYER_ID}-ejecta-line`,
      `${IMPACT_BLAST_LAYER_ID}-fill`, IMPACT_THERMAL_LAYER_ID,
      `${IMPACT_THERMAL_LAYER_ID}-line`,
      IMPACT_BLAST_LAYER_ID, IMPACT_CRATER_LAYER_ID,
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
      // Preview: colored zones with dashed borders to distinguish from final result
      map.addLayer({ id: IMPACT_THERMAL_LAYER_ID, type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "thermal"], paint: { "fill-color": "#f97316", "fill-opacity": 0.10 } });
      map.addLayer({ id: `${IMPACT_THERMAL_LAYER_ID}-line`, type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "thermal"], paint: { "line-color": "#f97316", "line-width": 2, "line-opacity": 0.6, "line-dasharray": [4, 3] } });
      map.addLayer({ id: IMPACT_BLAST_LAYER_ID, type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "blast"], paint: { "line-color": "#ef4444", "line-width": 2.5, "line-opacity": 0.7, "line-dasharray": [4, 3] } });
      map.addLayer({ id: IMPACT_CRATER_LAYER_ID, type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "crater"], paint: { "fill-color": "#000000", "fill-opacity": 0.40 } });
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
      // Thermal zone — orange fill + orange border
      map.addLayer({ id: IMPACT_THERMAL_LAYER_ID, type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "thermal"], paint: { "fill-color": "#f97316", "fill-opacity": 0.15 } });
      map.addLayer({ id: `${IMPACT_THERMAL_LAYER_ID}-line`, type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "thermal"], paint: { "line-color": "#f97316", "line-width": 2, "line-opacity": 0.9 } });
      // Blast zone — red fill + bright red border
      map.addLayer({ id: `${IMPACT_BLAST_LAYER_ID}-fill`, type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "blast-fill"], paint: { "fill-color": "#ef4444", "fill-opacity": 0.25 } });
      map.addLayer({ id: IMPACT_BLAST_LAYER_ID, type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "blast"], paint: { "line-color": "#ef4444", "line-width": 3, "line-opacity": 1 } });
      // Ejecta ring — brown fill
      map.addLayer({ id: `${IMPACT_CRATER_LAYER_ID}-ejecta`, type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "ejecta"], paint: { "fill-color": "#92400e", "fill-opacity": 0.30 } });
      map.addLayer({ id: `${IMPACT_CRATER_LAYER_ID}-ejecta-line`, type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "ejecta"], paint: { "line-color": "#b45309", "line-width": 2, "line-opacity": 0.8 } });
      // Crater rim — dark red fill + pulsing red border
      map.addLayer({ id: `${IMPACT_CRATER_LAYER_ID}-rim`, type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "crater-rim"], paint: { "fill-color": "#7f1d1d", "fill-opacity": 0.50 } });
      // Crater — black fill + bright yellow border
      map.addLayer({ id: IMPACT_CRATER_LAYER_ID, type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "crater"], paint: { "fill-color": "#000000", "fill-opacity": 0.90 } });
      map.addLayer({ id: `${IMPACT_CRATER_LAYER_ID}-inner`, type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "crater-inner"], paint: { "fill-color": "#000000", "fill-opacity": 0.70 } });
      // Pulsing rim outline
      map.addLayer({ id: `${IMPACT_CRATER_LAYER_ID}-pulse`, type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "crater-rim"], paint: { "line-color": "#fde047", "line-width": 3, "line-opacity": 0.95 } });
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
      const nukeLabel = data.severity_class === "Extinction scale" ? "Civilization ending" : data.severity_class;
      setStatus(`${nukeLabel} — ${data.yield_kt >= 1000 ? (data.yield_kt/1000).toFixed(1)+"Mt" : data.yield_kt+"kt"} detonated`);
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
    const nukeLayers = ["nuke-emp","nuke-emp-line",
      "nuke-thermal","nuke-thermal-line",
      "nuke-blast-light","nuke-blast-light-line",
      "nuke-blast-moderate","nuke-blast-moderate-line",
      "nuke-blast-heavy","nuke-blast-heavy-line",
      "nuke-fireball","nuke-fireball-line",
      "nuke-radiation","nuke-fallout","nuke-fallout-line"];
    nukeLayers.forEach(id => { try { if (map.getLayer(id)) map.removeLayer(id); } catch(e) {} });
    try { if (map.getSource(IMPACT_PREVIEW_SOURCE_ID)) map.removeSource(IMPACT_PREVIEW_SOURCE_ID); } catch(e) {}

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
      // Thermal — orange fill + solid orange border
      map.addLayer({ id: "nuke-thermal", type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "thermal"], paint: { "fill-color": "#f97316", "fill-opacity": 0.18 } });
      map.addLayer({ id: "nuke-thermal-line", type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "thermal"], paint: { "line-color": "#f97316", "line-width": 2, "line-opacity": 0.9 } });
      // Light blast — yellow fill + yellow border
      map.addLayer({ id: "nuke-blast-light", type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "blast-light"], paint: { "fill-color": "#fbbf24", "fill-opacity": 0.20 } });
      map.addLayer({ id: "nuke-blast-light-line", type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "blast-light"], paint: { "line-color": "#f59e0b", "line-width": 2, "line-opacity": 0.9 } });
      // Moderate blast — red fill + red border
      map.addLayer({ id: "nuke-blast-moderate", type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "blast-moderate"], paint: { "fill-color": "#ef4444", "fill-opacity": 0.30 } });
      map.addLayer({ id: "nuke-blast-moderate-line", type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "blast-moderate"], paint: { "line-color": "#ef4444", "line-width": 2.5, "line-opacity": 1.0 } });
      // Heavy blast — deep red fill + bright red border
      map.addLayer({ id: "nuke-blast-heavy", type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "blast-heavy"], paint: { "fill-color": "#991b1b", "fill-opacity": 0.55 } });
      map.addLayer({ id: "nuke-blast-heavy-line", type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "blast-heavy"], paint: { "line-color": "#dc2626", "line-width": 3, "line-opacity": 1.0 } });
      // Fireball — white core with bright yellow border
      map.addLayer({ id: "nuke-fireball", type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "fireball"], paint: { "fill-color": "#ffffff", "fill-opacity": 0.98 } });
      map.addLayer({ id: "nuke-fireball-line", type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "fireball"], paint: { "line-color": "#fde047", "line-width": 3, "line-opacity": 1.0 } });
      if (data.radiation_r_m > 0) {
        map.addLayer({ id: "nuke-radiation", type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "radiation"], paint: { "line-color": "#4ade80", "line-width": 3, "line-opacity": 1.0, "line-dasharray": [5, 3] } });
      }
      if (data.fallout_major_km > 0) {
        map.addLayer({ id: "nuke-fallout", type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "fallout"], paint: { "fill-color": "#84cc16", "fill-opacity": 0.15 } });
        map.addLayer({ id: "nuke-fallout-line", type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "fallout"], paint: { "line-color": "#84cc16", "line-width": 2.5, "line-opacity": 0.9, "line-dasharray": [6, 3] } });
      }
      safely(() => map.triggerRepaint());
    } catch (e) { console.error("Failed to draw nuke result", e); }
  };

  const buildFalloutEllipse = (lng, lat, majorKm, minorKm, directionDeg, steps = 64) => {
    // directionDeg = compass bearing fallout travels TO (0=N,90=E,180=S,270=W)
    const kpLat = 110.574;
    const kpLng = 111.32 * Math.cos((lat * Math.PI) / 180);
    const compassRad = (directionDeg * Math.PI) / 180;
    const dNorth = Math.cos(compassRad);
    const dEast  = Math.sin(compassRad);
    // Shift center downwind so detonation point sits at the upwind edge
    const centerLat = lat + (dNorth * majorKm * 0.5) / kpLat;
    const centerLng = lng + (dEast  * majorKm * 0.5) / Math.max(kpLng, 0.0001);
    const coords = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const along = Math.cos(t) * majorKm;
      const perp  = Math.sin(t) * minorKm;
      const northKm = dNorth * along - dEast  * perp;
      const eastKm  = dEast  * along + dNorth * perp;
      coords.push([
        centerLng + eastKm  / Math.max(kpLng, 0.0001),
        centerLat + northKm / kpLat,
      ]);
    }
    return { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} };
  };

  const clearNuke = () => {
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) {
      const nukeLayers = ["nuke-emp","nuke-emp-line","nuke-thermal","nuke-thermal-line",
        "nuke-blast-light","nuke-blast-light-line","nuke-blast-moderate","nuke-blast-moderate-line",
        "nuke-blast-heavy","nuke-blast-heavy-line","nuke-fireball","nuke-fireball-line",
        "nuke-radiation","nuke-fallout","nuke-fallout-line"];
      nukeLayers.forEach((id) => { try { if (map.getLayer(id)) map.removeLayer(id); } catch(e){} });
      try { if (map.getSource(IMPACT_PREVIEW_SOURCE_ID)) map.removeSource(IMPACT_PREVIEW_SOURCE_ID); } catch(e){}
      try { if (map.getLayer(IMPACT_LAYER_ID)) map.removeLayer(IMPACT_LAYER_ID); } catch(e){}
      try { if (map.getSource(IMPACT_SOURCE_ID)) map.removeSource(IMPACT_SOURCE_ID); } catch(e){}
    }
    nukePointRef.current = null;
    setNukePointSet(false);
    setNukeResult(null);
    setNukeError("");
    setStatus("Nuke cleared");
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
        ? nukeLoading ? "Detonating..." : nukeResult ? `${nukeResult.severity_class === "Extinction scale" ? "Civilization ending" : nukeResult.severity_class} — ${nukeResult.yield_kt >= 1000 ? (nukeResult.yield_kt/1000).toFixed(1)+"Mt" : nukeResult.yield_kt+"kt"}` : "Nuke point placed — detonate"
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16, paddingTop: 4 }}>
        <img src={LOGO_DATA} alt="Disaster Map" style={{ width: 90, height: 90, objectFit: "contain", marginBottom: 6 }} />
        <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", fontFamily: "Arial,sans-serif" }}>
          build {FRONTEND_BUILD_LABEL}
        </div>
      </div>

      {/* ── SEA LEVEL ── */}
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, letterSpacing: "0.1em", color: "#f97316", textTransform: "uppercase" }}>Sea Level</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: seaLevel > 0 ? "#3b82f6" : seaLevel < 0 ? "#f97316" : "#94a3b8" }}>
        {formatLevelForDisplay(seaLevel)}
      </div>

      {/* ── UNIT TOGGLE ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button
          onClick={() => setUnitMode("m")}
          style={{ flex: 1, padding: "12px 8px", minHeight: 44, border: "1px solid #d1d5db", background: unitMode === "m" ? "#f97316" : "#1e293b", color: "white", border: unitMode === "m" ? "1px solid #f97316" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 15 }}>
          Meters
        </button>
        <button
          onClick={() => setUnitMode("ft")}
          style={{ flex: 1, padding: "12px 8px", minHeight: 44, border: "1px solid #d1d5db", background: unitMode === "ft" ? "#f97316" : "#1e293b", color: "white", border: unitMode === "ft" ? "1px solid #f97316" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 15 }}>
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
        style={{ width: "100%", padding: "12px 14px", fontSize: 17, border: "1px solid #1e2d45", marginBottom: 10, boxSizing: "border-box", borderRadius: 8, minHeight: 48, background: "#111827", color: "#e2e8f0" }}
      />

      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <button
          onClick={executeFlood}
          style={{ flex: 1, padding: "13px 10px", minHeight: 48, background: "#f97316", color: "white", border: "none", fontWeight: 700, cursor: "pointer", borderRadius: 8, fontSize: 15 }}>
          Execute Flood
        </button>
        <button
          onClick={clearFlood}
          style={{ flex: 1, padding: "13px 10px", minHeight: 48, background: "#1e293b", color: "#e2e8f0", border: "1px solid #1e2d45", fontWeight: 700, cursor: "pointer", borderRadius: 8, fontSize: 15 }}>
          Clear
        </button>
      </div>

      <div style={{ fontSize: 13, marginBottom: 20, color: "#475569" }}>
        Custom input supports positive and negative values in {unitMode === "ft" ? "feet" : "meters"}
      </div>

      <hr style={{ margin: "0 0 16px 0", borderColor: "#1e2d45" }} />

      {/* ── PRESETS ── */}
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: "0.1em", color: "#f97316", textTransform: "uppercase" }}>Presets</div>
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
              style={{ padding: "12px 10px", minHeight: 56, border: "1px solid #d1d5db", background: active ? "#1e3a5f" : "#111827", color: active ? "#60a5fa" : "#94a3b8", border: active ? "1px solid #3b82f6" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 14 }}>{preset.label}</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>{lbl}</div>
            </button>
          );
        })}
      </div>

      <hr style={{ margin: "0 0 16px 0", borderColor: "#1e2d45" }} />

      {/* ── SCENARIO MODE ── */}
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: "0.1em", color: "#f97316", textTransform: "uppercase" }}>Scenario Mode</div>
      <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => { if (scenarioModeRef.current === "nuke") clearNuke(); setScenarioMode("flood"); }}
          style={{ width: "100%", padding: "13px 14px", minHeight: 56, border: "1px solid #d1d5db", background: scenarioMode === "flood" ? "#1e3a5f" : "#111827", color: scenarioMode === "flood" ? "#60a5fa" : "#94a3b8", border: scenarioMode === "flood" ? "1px solid #3b82f6" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 12, fontWeight: 700, textAlign: "left" }}>
          <div style={{ fontSize: 15 }}>Flood</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>Sea level up / down</div>
        </button>
        <button
          onClick={() => { if (scenarioModeRef.current === "nuke") clearNuke(); setScenarioMode("impact"); }}
          style={{ width: "100%", padding: "13px 14px", minHeight: 56, border: "1px solid #d1d5db", background: scenarioMode === "impact" ? "#1e3a5f" : "#111827", color: scenarioMode === "impact" ? "#60a5fa" : "#94a3b8", border: scenarioMode === "impact" ? "1px solid #3b82f6" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 12, fontWeight: 700, textAlign: "left" }}>
          <div style={{ fontSize: 15 }}>Impact</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>Click map to place impact point</div>
        </button>
        <button
          onClick={() => { setScenarioMode("nuke"); clearImpactPreview(); setNukeResult(null); setNukeError(""); setNukePointSet(false); nukePointRef.current = null; }}
          style={{ width: "100%", padding: "13px 14px", minHeight: 56, border: "1px solid #d1d5db", background: scenarioMode === "nuke" ? "#4c1d95" : "#111827", color: scenarioMode === "nuke" ? "#c4b5fd" : "#94a3b8", border: scenarioMode === "nuke" ? "1px solid #7c3aed" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 12, fontWeight: 700, textAlign: "left" }}>
          <div style={{ fontSize: 15 }}>☢️ Nuke</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>Click map to place detonation point</div>
        </button>
      </div>

      {/* ── IMPACT CONTROLS ── */}
      {scenarioMode === "impact" && (
        <>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: "0.1em", color: "#f97316", textTransform: "uppercase" }}>Asteroid Size</div>
          <input
            type="range" min="50" max="20000" step="50" value={impactDiameter}
            onChange={(e) => setImpactDiameter(Number(e.target.value))}
            style={{ width: "100%", marginBottom: 10, height: 6, cursor: "pointer" }}
          />
          <input
            type="number" min="50" max="20000" step="50" value={impactDiameter}
            onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setImpactDiameter(Math.max(50, Math.min(20000, n))); }}
            style={{ width: "100%", padding: "12px 14px", fontSize: 17, border: "1px solid #1e2d45", marginBottom: 10, boxSizing: "border-box", borderRadius: 8, minHeight: 48, background: "#111827", color: "#e2e8f0" }}
          />
          <div style={{ fontSize: 13, marginBottom: 16, color: "#64748b" }}>
            Diameter: <b>{impactDiameter.toLocaleString()} m</b>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button onClick={runImpact} disabled={!impactPointRef.current || impactLoading}
              style={{ flex: 1, padding: "14px 10px", minHeight: 52, background: "#ef4444", color: "white", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 15, opacity: !impactPointRef.current || impactLoading ? 0.65 : 1 }}>
              {impactLoading ? "Running..." : "Run Impact"}
            </button>
            <button onClick={() => { clearImpactPreview(); removeImpactPoint(); setImpactResult(null); setImpactError(""); setStatus("Impact cleared"); }}
              style={{ flex: 1, padding: "14px 10px", minHeight: 52, background: "#1e293b", color: "#e2e8f0", border: "1px solid #1e2d45", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 15 }}>
              Clear
            </button>
          </div>
        </>
      )}

      <hr style={{ margin: "0 0 16px 0", borderColor: "#1e2d45" }} />

      {/* ── NUKE CONTROLS ── */}
      {scenarioMode === "nuke" && (
        <>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: "0.1em", color: "#f97316", textTransform: "uppercase" }}>Yield</div>
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
          <div style={{ fontSize: 13, marginBottom: 12, color: "#64748b" }}>
            Yield: <b>{nukeYield >= 1000 ? (nukeYield/1000).toFixed(2)+" Mt" : nukeYield+" kt"}</b>
          </div>

          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, letterSpacing: "0.1em", color: "#f97316", textTransform: "uppercase" }}>Burst Type</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button onClick={() => setNukeBurst("airburst")}
              style={{ flex: 1, padding: "11px 8px", minHeight: 44, border: "1px solid #d1d5db", background: nukeBurst === "airburst" ? "#7c3aed" : "#111827", color: nukeBurst === "airburst" ? "white" : "#94a3b8", border: nukeBurst === "airburst" ? "1px solid #7c3aed" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 14 }}>
              Airburst
            </button>
            <button onClick={() => setNukeBurst("surface")}
              style={{ flex: 1, padding: "11px 8px", minHeight: 44, border: "1px solid #d1d5db", background: nukeBurst === "surface" ? "#7c3aed" : "#111827", color: nukeBurst === "surface" ? "white" : "#94a3b8", border: nukeBurst === "surface" ? "1px solid #7c3aed" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 14 }}>
              Surface
            </button>
          </div>

          {nukeBurst === "surface" && (
            <>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>WIND DIRECTION</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                {/* Compass arrow — rotates to show fallout direction (wind + 180) */}
                <div style={{ flexShrink: 0, width: 52, height: 52, borderRadius: "50%", background: "#0f172a", border: "2px solid #334155", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  {/* Cardinal labels */}
                  <span style={{ position: "absolute", top: 3, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#64748b", fontWeight: 700 }}>N</span>
                  <span style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#64748b", fontWeight: 700 }}>S</span>
                  <span style={{ position: "absolute", left: 3, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: "#64748b", fontWeight: 700 }}>W</span>
                  <span style={{ position: "absolute", right: 3, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: "#64748b", fontWeight: 700 }}>E</span>
                  {/* Arrow pointing in fallout direction */}
                  <div style={{
                    width: 0, height: 0,
                    transform: `rotate(${nukeWindDeg}deg)`,
                    transition: "transform 0.1s ease",
                    position: "relative", display: "flex", flexDirection: "column", alignItems: "center",
                  }}>
                    {/* Arrowhead (fallout direction = wind + 180, so arrow points FROM wind source) */}
                    <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "12px solid #84cc16" }} />
                    <div style={{ width: 2, height: 12, background: "#84cc16" }} />
                    <div style={{ width: 2, height: 4, background: "#ef4444" }} />
                    <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "8px solid #ef4444" }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#555" }}>Wind FROM <b style={{ color: "#111" }}>{nukeWindDeg}°</b></div>
                  <div style={{ fontSize: 12, color: "#84cc16", fontWeight: 700 }}>↑ Fallout → {Math.round((nukeWindDeg + 180) % 360)}°</div>
                </div>
              </div>
              <input type="range" min="0" max="359" step="1" value={nukeWindDeg}
                onChange={(e) => setNukeWindDeg(Number(e.target.value))}
                style={{ width: "100%", marginBottom: 14, cursor: "pointer" }} />
            </>
          )}

          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button onClick={runNuke} disabled={!nukePointSet || nukeLoading}
              style={{ flex: 1, padding: "14px 10px", minHeight: 52, background: "#7c3aed", color: "white", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 15, opacity: !nukePointSet || nukeLoading ? 0.65 : 1 }}>
              {nukeLoading ? "Detonating..." : "☢️ Detonate"}
            </button>
            <button onClick={clearNuke}
              style={{ flex: 1, padding: "14px 10px", minHeight: 52, background: "#1e293b", color: "#e2e8f0", border: "1px solid #1e2d45", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 15 }}>
              Clear
            </button>
          </div>

          {nukeError && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{nukeError}</div>}
        </>
      )}

      {/* ── VIEW MODE ── */}
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: "0.1em", color: "#f97316", textTransform: "uppercase" }}>View Mode</div>
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
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>{sub}</div>
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
          <div style={{ color: "#fde047" }}>● Crater: {Math.round(Number(impactResult.crater_diameter_m ?? 0)).toLocaleString()} m dia</div>
          <div style={{ color: "#b45309" }}>● Ejecta: {Math.round(Number(impactResult.crater_diameter_m ?? 0) * 1.55).toLocaleString()} m</div>
          <div style={{ color: "#ef4444" }}>● Blast: {Math.round(Number(impactResult.blast_radius_m ?? 0)).toLocaleString()} m</div>
          <div style={{ color: "#f97316" }}>● Thermal: {Math.round(Number(impactResult.thermal_radius_m ?? 0)).toLocaleString()} m</div>
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
          <hr style={{ margin: "8px 0", opacity: 0.2 }} />
          <div style={{ color: "#fde047" }}>● Fireball: {Math.round(nukeResult.fireball_r_m).toLocaleString()} m</div>
          <div style={{ color: "#dc2626" }}>● Heavy blast: {(Math.round(nukeResult.blast_heavy_r_m)/1000).toFixed(1)} km</div>
          <div style={{ color: "#ef4444" }}>● Moderate blast: {(Math.round(nukeResult.blast_moderate_r_m)/1000).toFixed(1)} km</div>
          <div style={{ color: "#f97316" }}>● Thermal (3rd°): {(Math.round(nukeResult.thermal_r_m)/1000).toFixed(1)} km</div>
          <div style={{ color: "#f59e0b" }}>● Light blast: {(Math.round(nukeResult.blast_light_r_m)/1000).toFixed(1)} km</div>
          {nukeResult.radiation_r_m > 0 && <div style={{ color: "#4ade80" }}>◌ Radiation 500rem: {Math.round(nukeResult.radiation_r_m).toLocaleString()} m</div>}
          {nukeResult.emp_r_m > 0 && <div style={{ color: "#a78bfa" }}>◌ EMP radius: {(Math.round(nukeResult.emp_r_m)/1000).toFixed(0)} km</div>}
          {nukeResult.fallout_major_km > 0 && <div style={{ color: "#84cc16" }}>◌ Fallout: {Math.round(nukeResult.fallout_major_km)} × {Math.round(nukeResult.fallout_minor_km)} km</div>}
          <hr style={{ margin: "8px 0", opacity: 0.2 }} />
          <div style={{ fontWeight: 700 }}>Casualties</div>
          <div>Exposed: {nukeResult.population_exposed != null ? nukeResult.population_exposed.toLocaleString() : "—"}</div>
          <div>Est. deaths: {nukeResult.estimated_deaths != null ? nukeResult.estimated_deaths.toLocaleString() : "—"}</div>
        </>
      )}

      {(impactResult || nukeResult) && (
        <>
          <hr style={{ margin: "10px 0", opacity: 0.2 }} />
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, letterSpacing: "0.1em", color: "#f97316" }}>SHARE</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="share-btn" onClick={() => {
              const msg = impactResult
                ? `💥 I just simulated a ${Number(impactResult.diameter_m ?? 0).toLocaleString()}m asteroid impact on Disaster Map! ${Math.round(Number(impactResult.estimated_deaths ?? 0)).toLocaleString()} estimated deaths. Try it: https://floodmap-v1.vercel.app`
                : `☢️ I just detonated a ${nukeResult.yield_kt >= 1000 ? (nukeResult.yield_kt/1000).toFixed(1)+"Mt" : nukeResult.yield_kt+"kt"} nuke on Disaster Map! ${Math.round(Number(nukeResult.estimated_deaths ?? 0)).toLocaleString()} estimated deaths. Try it: https://floodmap-v1.vercel.app`;
              window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(msg), "_blank");
            }} style={{ background: "#000", color: "#fff" }}>
              𝕏 Tweet
            </button>
            <button className="share-btn" onClick={() => {
              window.open("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(window.location.href), "_blank");
            }} style={{ background: "#1877f2", color: "#fff" }}>
              f Share
            </button>
            <button className="share-btn" onClick={() => {
              navigator.clipboard.writeText(window.location.href).then(() => { setStatus("Link copied!"); setTimeout(() => setStatus(""), 2000); });
            }} style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #1e2d45" }}>
              🔗 Copy Link
            </button>
          </div>
        </>
      )}
    </>
  );

  return (
    <div style={{ width: "100%", height: "100vh", height: "100dvh", position: "relative", overflow: "hidden" }}>
      <style>{`
        /* ── Mapbox popup ── */
        /* ── Dark panel theme ── */
        :root {
          --dm-bg: #0a0f1e;
          --dm-surface: #111827;
          --dm-border: #1e2d45;
          --dm-text: #e2e8f0;
          --dm-muted: #64748b;
          --dm-accent: #f97316;
          --dm-blue: #3b82f6;
          --dm-active: #1e3a5f;
        }
        /* ── Star field canvas ── */
        #star-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.8s ease;
        }
        #star-canvas.visible { opacity: 1; }
        /* ── Share buttons ── */
        .share-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          font-family: Arial, sans-serif;
          transition: opacity 0.15s;
        }
        .share-btn:hover { opacity: 0.85; }
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
      <canvas id="star-canvas" className={viewMode === "globe" ? "visible" : ""} />
      <div ref={mapContainerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }} />
      {/* Disaster Map wordmark — top center, unobtrusive */}
      <div style={{
        position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
        zIndex: 500, pointerEvents: "none",
        background: "rgba(10,15,30,0.55)", backdropFilter: "blur(4px)",
        borderRadius: 20, padding: "4px 14px",
        fontSize: 13, fontWeight: 700, letterSpacing: "0.08em",
        color: "rgba(255,255,255,0.75)", fontFamily: "Arial, sans-serif",
        whiteSpace: "nowrap",
      }}>
        DISASTER MAP
      </div>

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
          background: "#0a0f1e",
          borderRight: "1px solid #1e2d45",
          padding: 16,
          fontFamily: "Arial, sans-serif",
          zIndex: 1000,
          overflowY: "auto",
          pointerEvents: "auto",
          color: "#e2e8f0",
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
          background: "#0a0f1e",
          borderTop: "1px solid #1e2d45",
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
          <div style={{ width: 40, height: 4, background: "#1e2d45", borderRadius: 4 }} />
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
          background: "#0a0f1e",
          borderTop: "1px solid #1e2d45",
          borderRadius: "14px 14px 0 0",
          zIndex: 1001,
          alignItems: "center",
          padding: "0 12px",
          gap: 10,
          boxShadow: "0 -2px 12px rgba(0,0,0,0.1)",
          fontFamily: "Arial, sans-serif",
          color: "#e2e8f0",
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
          <div style={{ fontSize: 18, fontWeight: 700, color: seaLevel > 0 ? "#3b82f6" : seaLevel < 0 ? "#f97316" : "#e2e8f0", lineHeight: 1 }}>
            {stripLabel}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ background: scenarioMode === "impact" ? "#ef4444" : "#0f172a", color: "white", fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 7px" }}>
              {stripModePill}
            </span>
            <span style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
            background: scenarioMode === "impact" ? "#ef4444" : scenarioMode === "nuke" ? "#7c3aed" : "#f97316",
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
          style={{ flexShrink: 0, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid #1e2d45", borderRadius: 10, cursor: "pointer", fontSize: 18, color: "#94a3b8" }}
        >
          ⌃
        </button>
      </div>
    </div>
  );
}
