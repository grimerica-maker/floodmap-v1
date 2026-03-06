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

export default function HomePage() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const overlayCanvasRef = useRef(null);

  const [inputLevel, setInputLevel] = useState(0);
  const [seaLevel, setSeaLevel] = useState(0);
  const [viewMode, setViewMode] = useState("map");
  const [status, setStatus] = useState("Ready");
  const [floodedCells, setFloodedCells] = useState(0);

  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-80.19, 25.76],
      zoom: 6.2,
      projection: "mercator",
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("style.load", () => {
      if (map.getProjection()?.name === "globe") {
        map.setFog({});
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (viewMode === "globe") {
      map.setProjection("globe");
      map.flyTo({ center: [-70, 28], zoom: 2.6, essential: true });
    } else {
      map.setProjection("mercator");
      map.flyTo({ center: [-80.19, 25.76], zoom: 6.2, essential: true });
    }

    clearFloodOverlay();
    setStatus("View changed. Click Execute Flood.");
  }, [viewMode]);

  const clampLevel = (value) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return 0;
    return Math.max(-5000, Math.min(5000, parsed));
  };

  const clearFloodOverlay = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    setFloodedCells(0);
  };

  const executeFlood = () => {
    const map = mapRef.current;
    const canvas = overlayCanvasRef.current;

    if (!map || !canvas) return;

    const appliedLevel = clampLevel(inputLevel);
    setSeaLevel(appliedLevel);

    const rect = map.getContainer().getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (appliedLevel <= 0) {
      setFloodedCells(0);
      setStatus("Sea level is 0 or below. No flood drawn.");
      return;
    }

    setStatus("Calculating flood...");

    const width = canvas.width;
    const height = canvas.height;

    const columns = 140;
    const rows = 90;
    const cellW = width / columns;
    const cellH = height / rows;

    let floodedCount = 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const x = col * cellW;
        const y = row * cellH;

        const lngLat = map.unproject([x + cellW / 2, y + cellH / 2]);

        const lat = lngLat.lat;
        const lng = lngLat.lng;

        // Fake elevation model for strong visible viral demo effect
        const elevation =
          120 +
          Math.sin(lat / 8) * 80 +
          Math.cos(lng / 10) * 70 +
          Math.sin((lat + lng) / 7) * 30;

        if (elevation > appliedLevel) continue;

        const depth = appliedLevel - elevation;
        floodedCount += 1;

        let fill = "rgba(56, 189, 248, 0.55)";
        if (depth > 20) fill = "rgba(59, 130, 246, 0.68)";
        if (depth > 80) fill = "rgba(37, 99, 235, 0.78)";
        if (depth > 200) fill = "rgba(29, 78, 216, 0.86)";
        if (depth > 1000) fill = "rgba(30, 64, 175, 0.92)";

        ctx.fillStyle = fill;
        ctx.fillRect(x, y, cellW + 1, cellH + 1);
      }
    }

    setFloodedCells(floodedCount);
    setStatus(
      floodedCount > 0
        ? `Flood rendered at ${appliedLevel > 0 ? "+" : ""}${appliedLevel}m`
        : "No flooded cells found at this level in the current view"
    );
  };

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative", overflow: "hidden" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      <canvas
        ref={overlayCanvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />

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
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          Floodmap V1
        </div>

        <div style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
          Viral sea-level simulator
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
              onClick={() => {
                setInputLevel(0);
                setSeaLevel(0);
                clearFloodOverlay();
                setStatus("Flood cleared");
              }}
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
                onClick={() => {
                  setInputLevel(preset.value);
                  setSeaLevel(preset.value);
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: seaLevel === preset.value ? "#111827" : "#fff",
                  color: seaLevel === preset.value ? "#fff" : "#111827",
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
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>Best for flood overlay</div>
            </button>

            <button
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                color: "#9ca3af",
                textAlign: "left",
                cursor: "not-allowed",
                fontWeight: 600,
              }}
            >
              Satellite View 🔒
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>Pro</div>
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
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>Preview only</div>
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
            Pro Version Later
          </div>
          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
            Satellite view, stronger flood rendering, 3D globe, impact events, and spin-speed scenarios.
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
          minWidth: 220,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Current Scenario</div>
        <div>
          Sea level: {seaLevel > 0 ? "+" : ""}
          {seaLevel}m
        </div>
        <div>Mode: {viewMode === "globe" ? "Globe" : "Standard Map"}</div>
        <div>Status: {status}</div>
        <div>Flooded cells: {floodedCells}</div>
      </div>
    </div>
  );
}
