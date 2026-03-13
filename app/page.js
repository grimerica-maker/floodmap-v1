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
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
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
  layers: [
    {
      id: "esri-satellite",
      type: "raster",
      source: "esri",
    },
  ],
};

const FLOOD_TILE_VERSION = "30";

const FLOOD_SOURCE_ID = "flood-source";
const FLOOD_LAYER_ID = "flood-layer";

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
  const debugListenersAddedRef = useRef(false);
  const hasAppliedInitialViewModeRef = useRef(false);
  const styleRestoreFrameRef = useRef(null);
  const activeFloodLevelRef = useRef(null);

  const scenarioModeRef = useRef("flood");
  const seaLevelRef = useRef(0);
  const viewModeRef = useRef("map");

  const [inputLevel, setInputLevel] = useState(0);
  const [inputText, setInputText] = useState("0");
  const [seaLevel, setSeaLevel] = useState(0);
  const [viewMode, setViewMode] = useState("map");
  const [unitMode, setUnitMode] = useState("m");
  const [status, setStatus] = useState("Loading map...");
  const [scenarioMode, setScenarioMode] = useState("flood");

  const [impactDiameter, setImpactDiameter] = useState(100);
  const [floodEngineUrl, setFloodEngineUrl] = useState(FLOOD_ENGINE_PROXY_PATH);

  const [hoverLat, setHoverLat] = useState(null);
  const [hoverLng, setHoverLng] = useState(null);
  const [hoverElevation, setHoverElevation] = useState(null);

  useEffect(() => {
    scenarioModeRef.current = scenarioMode;
  }, [scenarioMode]);

  useEffect(() => {
    seaLevelRef.current = seaLevel;
  }, [seaLevel]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

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
  }, [unitMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatLevelForDisplay = (meters, unit = unitMode) => {
    if (unit === "ft") {
      const feet = Math.round(metersToFeet(meters));
      return `${feet > 0 ? "+" : ""}${feet} ft`;
    }
    return `${meters > 0 ? "+" : ""}${Math.round(meters)} m`;
  };

  const waterDifference =
    hoverElevation !== null
      ? Number((hoverElevation - seaLevel).toFixed(2))
      : null;

  const clampImpactDiameter = (value) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return MIN_ASTEROID_DIAMETER_M;
    return Math.max(
      MIN_ASTEROID_DIAMETER_M,
      Math.min(MAX_ASTEROID_DIAMETER_M, parsed)
    );
  };

  const floodAllowedInCurrentView = () =>
    viewModeRef.current === "map" || viewModeRef.current === "satellite";

  const isMapReady = () => {
    const map = mapRef.current;
    if (!map) return false;
    if (!map.isStyleLoaded()) return false;
    const style = map.getStyle();
    return !!style && Array.isArray(style.layers) && style.layers.length > 0;
  };

  const cancelStyleRestoreFrame = () => {
    if (styleRestoreFrameRef.current) {
      cancelAnimationFrame(styleRestoreFrameRef.current);
      styleRestoreFrameRef.current = null;
    }
  };

  const removeFloodLayer = () => {
    const map = mapRef.current;
    if (!map) {
      activeFloodLevelRef.current = null;
      return;
    }

    try {
      if (map.getLayer(FLOOD_LAYER_ID)) {
        map.removeLayer(FLOOD_LAYER_ID);
      }
      if (map.getSource(FLOOD_SOURCE_ID)) {
        map.removeSource(FLOOD_SOURCE_ID);
      }
    } catch (error) {
      console.warn("Failed removing flood layer:", error);
    }

    activeFloodLevelRef.current = null;
  };

  const addFloodLayer = (level) => {
    const map = mapRef.current;
    if (!isMapReady()) return false;
    if (scenarioModeRef.current !== "flood") return false;
    if (!floodAllowedInCurrentView()) return false;

    const normalizedLevel = Number(level);
    if (!Number.isFinite(normalizedLevel) || normalizedLevel === 0) return false;

    const tileUrl = `${floodEngineUrl}/flood/${encodeURIComponent(
      normalizedLevel
    )}/{z}/{x}/{y}.png?v=${FLOOD_TILE_VERSION}`;

    try {
      const existingLayer = map.getLayer(FLOOD_LAYER_ID);
      const existingSource = map.getSource(FLOOD_SOURCE_ID);

      if (
        activeFloodLevelRef.current === normalizedLevel &&
        existingLayer &&
        existingSource
      ) {
        return true;
      }

      if (existingLayer) map.removeLayer(FLOOD_LAYER_ID);
      if (existingSource) map.removeSource(FLOOD_SOURCE_ID);

      map.addSource(FLOOD_SOURCE_ID, {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        scheme: "xyz",
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
          "raster-resampling": "nearest",
        },
      });

      activeFloodLevelRef.current = normalizedLevel;
      safely(() => map.triggerRepaint());
      return true;
    } catch (error) {
      console.error("Failed to add flood layer", error);
      activeFloodLevelRef.current = null;
      return false;
    }
  };

  const syncFloodScenario = () => {
    if (!isMapReady()) return;

    if (scenarioModeRef.current !== "flood") {
      removeFloodLayer();
      return;
    }

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

  const restoreActiveScenario = () => {
    if (!isMapReady()) return;
    syncFloodScenario();
  };

  const applyStyleMode = (mode) => {
    const map = mapRef.current;
    if (!map) return;

    cancelStyleRestoreFrame();

    if (mode === "satellite") {
      map.setStyle(SATELLITE_STYLE);
      map.easeTo({
        center: [-80.19, 25.76],
        zoom: 6.2,
        duration: 250,
        essential: true,
      });
      return;
    }

    map.setStyle(MAP_STYLE);
    map.easeTo({
      center: mode === "globe" ? [-70, 28] : [-80.19, 25.76],
      zoom: mode === "globe" ? 2.6 : 6.2,
      duration: 250,
      essential: true,
    });
  };

  const executeFlood = () => {
    const parsedLevel = commitInputText(inputText, unitMode);

    if (parsedLevel === null) {
      setStatus("Enter a valid sea level first");
      return;
    }

    const level = Number(parsedLevel);

    setScenarioMode("flood");
    scenarioModeRef.current = "flood";
    setSeaLevel(level);
    seaLevelRef.current = level;
    setInputLevel(level);

    if (!floodAllowedInCurrentView()) {
      removeFloodLayer();
      setStatus("Switch to Standard Map or Satellite to run flood layer");
      return;
    }

    if (level === 0) {
      removeFloodLayer();
      setStatus("Flood cleared");
      return;
    }

    const added = addFloodLayer(level);
    if (added) {
      setStatus(`Flood tiles loaded at ${formatLevelForDisplay(level)}`);
    } else {
      setStatus("Preparing flood layer...");
    }
  };

  const clearFlood = () => {
    setInputLevel(0);
    setInputText("0");
    setSeaLevel(0);
    seaLevelRef.current = 0;

    removeFloodLayer();
    setStatus("Flood cleared");
  };

  const fetchElevation = async (lat, lng) => {
    try {
      const res = await fetch(
        `${floodEngineUrl}/elevation?lat=${encodeURIComponent(
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
        if (resourceType === "Tile" && url.includes("/flood/")) {
          console.log("FLOOD TILE:", url);
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
        const message = e?.error?.message || e?.message || e?.sourceId || "";
        const sourceId =
          e?.sourceId ||
          e?.source?.id ||
          e?.target?._sourceId ||
          e?.error?.sourceId ||
          null;

        console.log("Map error:", e, message, sourceId);
      });
    }

    const handleLoad = () => {
      fetch(`${floodEngineUrl}/`)
        .then((r) => r.json())
        .then((d) => console.log("Engine health:", d))
        .catch((e) => console.error("Engine unreachable", e));

      restoreActiveScenario();
      setStatus("Map ready");
    };

    const handleStyleData = () => {
      if (!map.isStyleLoaded()) return;

      cancelStyleRestoreFrame();

      styleRestoreFrameRef.current = requestAnimationFrame(() => {
        styleRestoreFrameRef.current = null;
        if (!isMapReady()) return;

        activeFloodLevelRef.current = null;
        restoreActiveScenario();
      });
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

    map.on("load", handleLoad);
    map.on("styledata", handleStyleData);
    map.on("mousemove", handleMouseMove);
    map.on("mouseleave", handleMouseLeave);

    return () => {
      cancelStyleRestoreFrame();

      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

      map.off("load", handleLoad);
      map.off("styledata", handleStyleData);
      map.off("mousemove", handleMouseMove);
      map.off("mouseleave", handleMouseLeave);

      map.remove();
      mapRef.current = null;
      activeFloodLevelRef.current = null;
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
    if (!isMapReady()) return;
    syncFloodScenario();
  }, [scenarioMode, seaLevel]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (viewMode === "globe") {
      setStatus("Wide-area preview mode");
      return;
    }

    if (seaLevel === 0) {
      setStatus("Flood cleared");
      return;
    }

    setStatus(`Flood tiles loaded at ${formatLevelForDisplay(seaLevel)}`);
  }, [viewMode, seaLevel, unitMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
          Flood-only reset build
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
            onClick={() => {
              setScenarioMode("flood");
              scenarioModeRef.current = "flood";
              if (isMapReady()) {
                syncFloodScenario();
                safely(() => mapRef.current?.triggerRepaint());
              }
              setStatus("Flood mode active");
            }}
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
            disabled
            style={{
              width: "100%",
              padding: 14,
              border: "1px solid #d1d5db",
              background: "#f3f4f6",
              color: "#6b7280",
              cursor: "not-allowed",
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            <div>Impact</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
              Temporarily disabled during reset
            </div>
          </button>
        </div>

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
            <div>Wide View</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
              Preview only
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
            : "Wide View"}
        </div>
        <div>Status: {status}</div>
        <div>Scenario Mode: {scenarioMode}</div>
        <div>Impact: disabled in this reset build</div>
        <div>Asteroid Diameter: {impactDiameter} m</div>

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
