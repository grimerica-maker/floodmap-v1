"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const PRESETS = [
  { label: "Ice Age", value: -120 },
  { label: "Modern", value: 0 },
  { label: "Holocene", value: 6 },
  { label: "Eocene", value: 70 },
  { label: "Total Flood", value: 5000 },
];

const FLOOD_SOURCE_ID = "flood-source";
const FLOOD_LAYER_ID = "flood-layer";
const FLOOD_ENGINE_URL = "https://flood-engine.onrender.com";

export default function HomePage() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  const [inputLevel, setInputLevel] = useState(0);
  const [seaLevel, setSeaLevel] = useState(0);
  const [viewMode, setViewMode] = useState("map");
  const [status, setStatus] = useState("Loading map...");

  const clampLevel = (value) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return 0;
    return Math.max(-5000, Math.min(5000, parsed));
  };

  const removeFloodLayer = () => {
    const map = mapRef.current;
    if (!map) return;

    if (map.getLayer(FLOOD_LAYER_ID)) {
      map.removeLayer(FLOOD_LAYER_ID);
    }

    if (map.getSource(FLOOD_SOURCE_ID)) {
      map.removeSource(FLOOD_SOURCE_ID);
    }
  };

  const addFloodLayer = (level) => {
    const map = mapRef.current;
    if (!map) return;

    removeFloodLayer();

    map.addSource(FLOOD_SOURCE_ID, {
      type: "raster",
      tiles: [`${FLOOD_ENGINE_URL}/flood/${level}/{z}/{x}/{y}.png`],
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

  const applyStyleAndProjection = (mode) => {
    const map = mapRef.current;
    if (!map) return;

    if (mode === "globe") {
      removeFloodLayer();
      map.setProjection("globe");
      map.setStyle("mapbox://styles/mapbox/streets-v12");
      map.once("style.load", () => {
        map.setFog({});
      });
      map.flyTo({
        center: [-70, 28],
        zoom: 2.6,
        essential: true,
      });
      setStatus("Globe preview mode");
      return;
    }

    if (mode === "satellite") {
      removeFloodLayer();
      map.setProjection("mercator");
      map.setStyle("mapbox://styles/mapbox/satellite-streets-v12");
      map.flyTo({
        center: [-80.19, 25.76],
        zoom: 6.2,
        essential: true,
      });
      setStatus("Satellite placeholder");
      return;
    }

    map.setProjection("mercator");
    map.setStyle("mapbox://styles/mapbox/streets-v12");
    map.flyTo({
      center: [-80.19, 25.76],
      zoom: 6.2,
      essential: true,
    });

    map.once("style.load", () => {
      if (seaLevel !== 0) {
        addFloodLayer(seaLevel);
      }
    });

    setStatus("Standard Map ready");
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

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.getCanvas().style.cursor = "grab";

    map.on("mousedown", () => {
      map.getCanvas().style.cursor = "grabbing";
    });

    map.on("mouseup", () => {
      map.getCanvas().style.cursor = "grab";
    });

    map.on("mouseout", () => {
      map.getCanvas().style.cursor = "grab";
    });

    map.on("load", () => {
      setStatus("Map ready");
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    applyStyleAndProjection(viewMode);
  }, [viewMode]);

  const executeFlood = () => {
    const level = clampLevel(inputLevel);
    setSeaLevel(level);

    if (viewMode !== "map") {
      setStatus("Switch to Standard Map to run flood layer");
      return;
    }

    addFloodLayer(level);

    setStatus(
      level === 0
        ? "Flood cleared"
        : `Flood tiles loaded at ${level > 0 ? "+" : ""}${level}m`
    );
  };

  const clearFlood = () => {
    setInputLevel(0);
    setSeaLevel(0);
    removeFloodLayer();
    setStatus("Flood cleared");
  };

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative", overflow: "hidden" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 320,
          height: "100%",
          background: "rgba(255,255,255,0.96)",
          borderRight: "1px solid #e5e7eb",
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
          padding: 20,
          fontFamily: "Arial, sans-serif",
          overflowY: "auto",
          zIndex: 10,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          Floodmap V1
        </div>

        <div style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
          Python tile flood engine
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8 }}>
            SEA LEVEL
          </div>

          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 10,
              color: seaLevel > 0 ? "#0f62fe" : seaLevel < 0 ? "#b45309" : "#111827",
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
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              fontSize: 16,
              outline: "none",
              marginBottom: 10,
            }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              onClick={executeFlood}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "none",
                background: "#111827",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Execute Flood
            </button>

            <button
              onClick={clearFlood}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#111827",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
            Range: -5000m to +5000m
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 10 }}>
            PRESETS
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => setInputLevel(preset.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: inputLevel === preset.value ? "#111827" : "#fff",
                  color: inputLevel === preset.value ? "#fff" : "#111827",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {preset.label}
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 3 }}>
                  {preset.value > 0 ? "+" : ""}
                  {preset.value}m
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 10 }}>
            VIEW MODE
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <button
              onClick={() => setViewMode("map")}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: viewMode === "map" ? "#111827" : "#fff",
                color: viewMode === "map" ? "#fff" : "#111827",
                textAlign: "left",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Standard Map
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>
                Flood tiles active
              </div>
            </button>

            <button
              onClick={() => setViewMode("satellite")}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: viewMode === "satellite" ? "#111827" : "#f9fafb",
                color: viewMode === "satellite" ? "#fff" : "#9ca3af",
                textAlign: "left",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Satellite View
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>
                Pro placeholder
              </div>
            </button>

            <button
              onClick={() => setViewMode("globe")}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: viewMode === "globe" ? "#111827" : "#fff",
                color: viewMode === "globe" ? "#fff" : "#111827",
                textAlign: "left",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Globe View
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>
                Preview
              </div>
            </button>
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8", marginBottom: 6 }}>
            Next upgrades
          </div>
          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
            Ocean connectivity, better negative sea levels, satellite Pro mode, and globe visualization.
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 20,
          top: 20,
          background: "rgba(17,24,39,0.85)",
          color: "white",
          padding: "12px 14px",
          borderRadius: 12,
          fontFamily: "Arial, sans-serif",
          fontSize: 13,
          lineHeight: 1.5,
          boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          minWidth: 230,
          zIndex: 10,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Current Scenario</div>
        <div>
          Sea level: {seaLevel > 0 ? "+" : ""}
          {seaLevel}m
        </div>
        <div>
          Mode:{" "}
          {viewMode === "globe"
            ? "Globe"
            : viewMode === "satellite"
              ? "Satellite"
              : "Standard Map"}
        </div>
        <div>Status: {status}</div>
      </div>
    </div>
  );
}
