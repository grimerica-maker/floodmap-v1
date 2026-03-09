"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// For production, set NEXT_PUBLIC_FLOOD_ENGINE to your backend URL.
// Temporary direct VPS URL:
const FLOOD_ENGINE =
  process.env.NEXT_PUBLIC_FLOOD_ENGINE || "http://137.184.86.1:8000";

const FLOOD_SOURCE_ID = "flood-source";
const FLOOD_LAYER_ID = "flood-layer";

const IMPACT_FLOOD_SOURCE_ID = "impact-flood-source";
const IMPACT_FLOOD_LAYER_ID = "impact-flood-layer";

const IMPACT_SOURCE_ID = "impact-point-source";
const IMPACT_RADIUS_SOURCE_ID = "impact-radius-source";
const IMPACT_RADIUS_FILL_ID = "impact-radius-fill";
const IMPACT_RADIUS_LINE_ID = "impact-radius-line";
const IMPACT_RING_LAYER_ID = "impact-point-ring-layer";
const IMPACT_LAYER_ID = "impact-point-layer";

const PRESETS = [
  { label: "Ice Age", value: -120 },
  { label: "Modern", value: 0 },
  { label: "Holocene", value: 6 },
  { label: "Eocene", value: 70 },
  { label: "Total Flood", value: 5000 },
];

const createGeodesicCircle = (lng, lat, radiusMeters, steps = 96) => {
  const coords = [];
  const earthRadius = 6371008.8;
  const angularDistance = radiusMeters / earthRadius;

  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  for (let i = 0; i <= steps; i += 1) {
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
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
  };
};

export default function HomePage() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const hoverTimerRef = useRef(null);

  const scenarioModeRef = useRef("flood");
  const impactPointRef = useRef(null);
  const executedImpactRef = useRef(null);
  const seaLevelRef = useRef(0);
  const viewModeRef = useRef("map");
  const impactDiameterRef = useRef(100);

  const [inputLevel, setInputLevel] = useState(0);
  const [seaLevel, setSeaLevel] = useState(0);
  const [viewMode, setViewMode] = useState("map");
  const [status, setStatus] = useState("Loading map...");
  const [scenarioMode, setScenarioMode] = useState("flood");

  const [impactDiameter, setImpactDiameter] = useState(100);
  const [impactPoint, setImpactPoint] = useState(null);
  const [executedImpact, setExecutedImpact] = useState(null);

  const [hoverLat, setHoverLat] = useState(null);
  const [hoverLng, setHoverLng] = useState(null);
  const [hoverElevation, setHoverElevation] = useState(null);

  useEffect(() => {
    scenarioModeRef.current = scenarioMode;
  }, [scenarioMode]);

  useEffect(() => {
    impactPointRef.current = impactPoint;
  }, [impactPoint]);

  useEffect(() => {
    executedImpactRef.current = executedImpact;
  }, [executedImpact]);

  useEffect(() => {
    seaLevelRef.current = seaLevel;
  }, [seaLevel]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    impactDiameterRef.current = impactDiameter;
  }, [impactDiameter]);

  const waterDifference =
    hoverElevation !== null
      ? Number((hoverElevation - seaLevel).toFixed(2))
      : null;

  const clampLevel = (value) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return 0;
    return Math.max(-5000, Math.min(5000, parsed));
  };

  const clampImpactDiameter = (value) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return 10;
    return Math.max(10, Math.min(1000, parsed));
  };

  const removeFloodLayer = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer(FLOOD_LAYER_ID)) {
      map.removeLayer(FLOOD_LAYER_ID);
    }

    if (map.getSource(FLOOD_SOURCE_ID)) {
      map.removeSource(FLOOD_SOURCE_ID);
    }
  };

  const addFloodLayer = (level) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    removeFloodLayer();

    map.addSource(FLOOD_SOURCE_ID, {
      type: "raster",
      tiles: [`${FLOOD_ENGINE}/flood/${level}/{z}/{x}/{y}.png`],
      tileSize: 256,
    });

    map.addLayer({
      id: FLOOD_LAYER_ID,
      type: "raster",
      source: FLOOD_SOURCE_ID,
      paint: {
        "raster-opacity": 0.82,
        "raster-fade-duration": 0,
      },
    });
  };

  const removeImpactFloodLayer = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer(IMPACT_FLOOD_LAYER_ID)) {
      map.removeLayer(IMPACT_FLOOD_LAYER_ID);
    }

    if (map.getSource(IMPACT_FLOOD_SOURCE_ID)) {
      map.removeSource(IMPACT_FLOOD_SOURCE_ID);
    }
  };

  const addImpactFloodLayer = ({ lat, lng, diameter, runId }) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    removeImpactFloodLayer();

    map.addSource(IMPACT_FLOOD_SOURCE_ID, {
      type: "raster",
      tiles: [
        `${FLOOD_ENGINE}/impact-flood/${lat}/${lng}/${diameter}/{z}/{x}/{y}.png?run=${runId}`,
      ],
      tileSize: 256,
    });

    map.addLayer({
      id: IMPACT_FLOOD_LAYER_ID,
      type: "raster",
      source: IMPACT_FLOOD_SOURCE_ID,
      paint: {
        "raster-opacity": 0.82,
        "raster-fade-duration": 0,
      },
    });
  };

  const ensureImpactLayers = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (!map.getSource(IMPACT_RADIUS_SOURCE_ID)) {
      map.addSource(IMPACT_RADIUS_SOURCE_ID, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });
    }

    if (!map.getSource(IMPACT_SOURCE_ID)) {
      map.addSource(IMPACT_SOURCE_ID, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });
    }

    if (!map.getLayer(IMPACT_RADIUS_FILL_ID)) {
      map.addLayer({
        id: IMPACT_RADIUS_FILL_ID,
        type: "fill",
        source: IMPACT_RADIUS_SOURCE_ID,
        paint: {
          "fill-color": "#ef4444",
          "fill-opacity": 0.22,
        },
      });
    }

    if (!map.getLayer(IMPACT_RADIUS_LINE_ID)) {
      map.addLayer({
        id: IMPACT_RADIUS_LINE_ID,
        type: "line",
        source: IMPACT_RADIUS_SOURCE_ID,
        paint: {
          "line-color": "#b91c1c",
          "line-width": 3,
        },
      });
    }

    if (!map.getLayer(IMPACT_RING_LAYER_ID)) {
      map.addLayer({
        id: IMPACT_RING_LAYER_ID,
        type: "circle",
        source: IMPACT_SOURCE_ID,
        paint: {
          "circle-radius": 16,
          "circle-color": "rgba(239,68,68,0.25)",
          "circle-stroke-width": 0,
        },
      });
    }

    if (!map.getLayer(IMPACT_LAYER_ID)) {
      map.addLayer({
        id: IMPACT_LAYER_ID,
        type: "circle",
        source: IMPACT_SOURCE_ID,
        paint: {
          "circle-radius": 8,
          "circle-color": "#ef4444",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });
    }
  };

  const clearImpactPointOnMap = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const pointSource = map.getSource(IMPACT_SOURCE_ID);
    if (pointSource) {
      pointSource.setData({
        type: "FeatureCollection",
        features: [],
      });
    }

    const radiusSource = map.getSource(IMPACT_RADIUS_SOURCE_ID);
    if (radiusSource) {
      radiusSource.setData({
        type: "FeatureCollection",
        features: [],
      });
    }
  };

  const setImpactPointOnMap = (
    point,
    diameterValue = impactDiameterRef.current
  ) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !point) return;

    ensureImpactLayers();

    const pointSource = map.getSource(IMPACT_SOURCE_ID);
    const radiusSource = map.getSource(IMPACT_RADIUS_SOURCE_ID);

    if (!pointSource || !radiusSource) return;

    pointSource.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [point.lng, point.lat],
          },
          properties: {
            diameter: diameterValue,
          },
        },
      ],
    });

    const craterRadiusMeters = Math.max(500, diameterValue * 40);

    radiusSource.setData({
      type: "FeatureCollection",
      features: [
        createGeodesicCircle(point.lng, point.lat, craterRadiusMeters),
      ],
    });
  };

  const fetchElevation = async (lat, lng) => {
    try {
      const res = await fetch(
        `${FLOOD_ENGINE}/elevation?lat=${encodeURIComponent(
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

  const syncScenarioLayers = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (scenarioModeRef.current === "flood") {
      removeImpactFloodLayer();
      clearImpactPointOnMap();

      if (viewModeRef.current === "map" && seaLevelRef.current !== 0) {
        addFloodLayer(seaLevelRef.current);
      } else {
        removeFloodLayer();
      }

      return;
    }

    removeFloodLayer();

    if (impactPointRef.current) {
      setImpactPointOnMap(impactPointRef.current, impactDiameterRef.current);
    } else {
      clearImpactPointOnMap();
    }

    if (executedImpactRef.current && viewModeRef.current === "map") {
      addImpactFloodLayer(executedImpactRef.current);
    } else {
      removeImpactFloodLayer();
    }
  };

  const restoreMapOverlays = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    ensureImpactLayers();
    syncScenarioLayers();
  };

  const setMapStyleForMode = (mode) => {
    const map = mapRef.current;
    if (!map) return;

    if (mode === "globe") {
      map.setProjection("globe");
      map.setStyle("mapbox://styles/mapbox/streets-v12");
      map.once("style.load", () => {
        map.setFog({});
        restoreMapOverlays();
      });
      map.flyTo({
        center: [-70, 28],
        zoom: 2.6,
        essential: true,
      });
      setStatus(
        scenarioModeRef.current === "impact"
          ? executedImpactRef.current
            ? "Impact result loaded"
            : "Click map to place impact point"
          : "Globe preview mode"
      );
      return;
    }

    if (mode === "satellite") {
      map.setProjection("mercator");
      map.setStyle("mapbox://styles/mapbox/satellite-streets-v12");
      map.once("style.load", () => {
        restoreMapOverlays();
      });
      map.flyTo({
        center: [-80.19, 25.76],
        zoom: 6.2,
        essential: true,
      });
      setStatus(
        scenarioModeRef.current === "impact"
          ? executedImpactRef.current
            ? "Impact result loaded"
            : "Click map to place impact point"
          : "Satellite placeholder"
      );
      return;
    }

    map.setProjection("mercator");
    map.setStyle("mapbox://styles/mapbox/streets-v12");
    map.once("style.load", () => {
      restoreMapOverlays();
    });
    map.flyTo({
      center: [-80.19, 25.76],
      zoom: 6.2,
      essential: true,
    });
    setStatus(
      scenarioModeRef.current === "impact"
        ? executedImpactRef.current
          ? "Impact result loaded"
          : "Click map to place impact point"
        : "Standard Map ready"
    );
  };

  const executeFlood = () => {
    const level = clampLevel(inputLevel);

    setScenarioMode("flood");
    scenarioModeRef.current = "flood";

    setSeaLevel(level);
    seaLevelRef.current = level;

    if (viewModeRef.current !== "map") {
      removeFloodLayer();
      setStatus("Switch to Standard Map to run flood layer");
      return;
    }

    removeImpactFloodLayer();
    clearImpactPointOnMap();

    if (level === 0) {
      removeFloodLayer();
      setStatus("Flood cleared");
      return;
    }

    addFloodLayer(level);
    setStatus(`Flood tiles loaded at ${level > 0 ? "+" : ""}${level}m`);
  };

  const executeImpact = () => {
    if (!impactPointRef.current) {
      setStatus("Click map to place impact point first");
      return;
    }

    setScenarioMode("impact");
    scenarioModeRef.current = "impact";

    const run = {
      lat: impactPointRef.current.lat,
      lng: impactPointRef.current.lng,
      diameter: impactDiameterRef.current,
      runId: Date.now(),
    };

    setExecutedImpact(run);
    executedImpactRef.current = run;

    removeFloodLayer();

    if (viewModeRef.current === "map") {
      addImpactFloodLayer(run);
      setStatus("Impact flood simulated");
    } else {
      setStatus("Impact saved — switch to Standard Map to view flood extent");
    }
  };

  const clearFlood = () => {
    setInputLevel(0);
    setSeaLevel(0);
    seaLevelRef.current = 0;

    setImpactPoint(null);
    impactPointRef.current = null;

    setExecutedImpact(null);
    executedImpactRef.current = null;

    removeFloodLayer();
    removeImpactFloodLayer();
    clearImpactPointOnMap();
    setStatus("Flood cleared");
  };

  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-80.19, 25.76],
      zoom: 6.2,
      projection: "mercator",
      dragPan: true,
      scrollZoom: true,
      boxZoom: true,
      dragRotate: true,
      keyboard: true,
      touchZoomRotate: true,
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.getCanvas().style.cursor = "crosshair";

    const handleLoad = () => {
      ensureImpactLayers();
      setStatus("Map ready");
    };

    const handleMouseMove = (e) => {
      const lat = Number(e.lngLat.lat.toFixed(5));
      const lng = Number(e.lngLat.lng.toFixed(5));

      setHoverLat(lat);
      setHoverLng(lng);

      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }

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

      const point = {
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
      };

      impactPointRef.current = point;
      setImpactPoint(point);
      setImpactPointOnMap(point, impactDiameterRef.current);
      setStatus("Impact point selected — click Execute Impact");
    };

    map.on("load", handleLoad);
    map.on("mousemove", handleMouseMove);
    map.on("mouseleave", handleMouseLeave);
    map.on("click", handleMapClick);

    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }

      map.off("load", handleLoad);
      map.off("mousemove", handleMouseMove);
      map.off("mouseleave", handleMouseLeave);
      map.off("click", handleMapClick);

      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    setMapStyleForMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    syncScenarioLayers();

    if (scenarioMode === "impact") {
      if (executedImpactRef.current) {
        setStatus(
          viewMode === "map"
            ? "Impact result loaded"
            : "Impact saved — switch to Standard Map to view flood extent"
        );
      } else if (impactPointRef.current) {
        setStatus("Impact point selected — click Execute Impact");
      } else {
        setStatus("Click map to place impact point");
      }
      return;
    }

    if (viewMode !== "map") {
      setStatus("Switch to Standard Map to run flood layer");
      return;
    }

    if (seaLevel === 0) {
      setStatus("Flood cleared");
      return;
    }

    setStatus(`Flood tiles loaded at ${seaLevel > 0 ? "+" : ""}${seaLevel}m`);
  }, [scenarioMode, impactDiameter, viewMode, seaLevel, executedImpact]);

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      <div
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
          zIndex: 10,
          overflowY: "auto",
        }}
      >
        <h1 style={{ margin: "8px 0 24px 0", fontSize: 22 }}>Floodmap V1</h1>

        <div style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
          Python tile flood engine
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
          {seaLevel > 0 ? "+" : ""}
          {seaLevel} m
        </div>

        <input
          type="number"
          min="-5000"
          max="5000"
          step="10"
          value={inputLevel}
          onChange={(e) => setInputLevel(clampLevel(e.target.value))}
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
          Range: -5000m to +5000m
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
            const active = inputLevel === preset.value;
            return (
              <button
                key={preset.label}
                onClick={() => setInputLevel(preset.value)}
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
                  {preset.value > 0 ? "+" : ""}
                  {preset.value}m
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
              Asteroid impact simulation
            </div>
          </button>
        </div>

        {scenarioMode === "impact" && (
          <>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              ASTEROID DIAMETER
            </div>

            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={impactDiameter}
              onChange={(e) =>
                setImpactDiameter(clampImpactDiameter(e.target.value))
              }
              style={{
                width: "100%",
                marginBottom: 10,
              }}
            />

            <input
              type="number"
              min="10"
              max="1000"
              step="10"
              value={impactDiameter}
              onChange={(e) =>
                setImpactDiameter(clampImpactDiameter(e.target.value))
              }
              style={{
                width: "100%",
                padding: 10,
                fontSize: 16,
                border: "1px solid #ccc",
                marginBottom: 10,
                boxSizing: "border-box",
              }}
            />

            <div style={{ fontSize: 14, marginBottom: 12 }}>
              Diameter: {impactDiameter} m across
            </div>

            <button
              onClick={executeImpact}
              style={{
                width: "100%",
                padding: 14,
                background: "#7f1d1d",
                color: "white",
                border: "none",
                fontWeight: 700,
                cursor: "pointer",
                borderRadius: 12,
                marginBottom: 24,
              }}
            >
              Execute Impact
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
              Pro placeholder
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
              Preview
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
          zIndex: 10,
          minWidth: 260,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          Current Scenario
        </div>
        <div>
          Sea level: {seaLevel > 0 ? "+" : ""}
          {seaLevel}m
        </div>
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
        <div>Asteroid Diameter: {impactDiameter} m</div>
        <div>
          Impact Point:{" "}
          {impactPoint
            ? `${impactPoint.lng.toFixed(3)}, ${impactPoint.lat.toFixed(3)}`
            : "--"}
        </div>
        <div>
          Executed Impact:{" "}
          {executedImpact
            ? `${executedImpact.lng.toFixed(3)}, ${executedImpact.lat.toFixed(
                3
              )} @ ${executedImpact.diameter}m`
            : "--"}
        </div>

        <hr style={{ margin: "10px 0", opacity: 0.25 }} />

        <div style={{ fontWeight: 700, marginBottom: 6 }}>Cursor</div>
        <div>Lat: {hoverLat ?? "--"}</div>
        <div>Lng: {hoverLng ?? "--"}</div>
        <div>
          Original Elevation:{" "}
          {hoverElevation !== null ? `${hoverElevation} m` : "--"}
        </div>
        <div>
          Sea Level: {seaLevel > 0 ? "+" : ""}
          {seaLevel} m
        </div>
        <div>
          {waterDifference !== null
            ? waterDifference >= 0
              ? `Above water by ${waterDifference} m`
              : `Underwater by ${Math.abs(waterDifference)} m`
            : "--"}
        </div>
      </div>
    </div>
  );
}
