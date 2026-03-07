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
  const redrawTimeoutRef = useRef(null);

  const [inputLevel, setInputLevel] = useState(0);
  const [seaLevel, setSeaLevel] = useState(0);
  const [viewMode, setViewMode] = useState("map");
  const [status, setStatus] = useState("Loading map...");
  const [floodedCells, setFloodedCells] = useState(0);
  const [engineReady, setEngineReady] = useState(false);

  const clampLevel = (value) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return 0;
    return Math.max(-5000, Math.min(5000, parsed));
  };

  const clearOverlay = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    setFloodedCells(0);
  };

  const configureTerrain = (map) => {
    if (!map.getSource("mapbox-dem")) {
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
    }

    map.setTerrain({
      source: "mapbox-dem",
      exaggeration: 1,
    });

    if (map.getProjection()?.name === "globe") {
      map.setFog({});
    }

    setEngineReady(true);
  };

  const scheduleFloodRender = () => {
    if (redrawTimeoutRef.current) {
      window.clearTimeout(redrawTimeoutRef.current);
    }

    redrawTimeoutRef.current = window.setTimeout(() => {
      renderFlood();
    }, 120);
  };

  const renderFlood = () => {
    const map = mapRef.current;
    const canvas = overlayCanvasRef.current;

    if (!map || !canvas || !engineReady) return;

    const rect = map.getContainer().getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (seaLevel <= 0) {
      setFloodedCells(0);
      setStatus("Sea level is 0 or below. No ocean rise shown.");
      return;
    }

    setStatus("Sampling terrain...");

    const width = canvas.width;
    const height = canvas.height;

    const cols = 110;
    const rows = 78;
    const cellW = width / cols;
    const cellH = height / rows;

    const elev = Array.from({ length: rows }, () => Array(cols).fill(null));
    const passable = Array.from({ length: rows }, () => Array(cols).fill(false));
    const flooded = Array.from({ length: rows }, () => Array(cols).fill(false));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellW + cellW / 2;
        const y = r * cellH + cellH / 2;

        const lngLat = map.unproject([x, y]);
        const e = map.queryTerrainElevation(lngLat, { exaggerated: false });

        elev[r][c] = e;

        if (typeof e === "number" && !Number.isNaN(e) && e <= seaLevel) {
          passable[r][c] = true;
        }
      }
    }

    setStatus("Tracing new coastline...");

    const queue = [];
    const pushIfPassable = (r, c) => {
      if (r < 0 || r >= rows || c < 0 || c >= cols) return;
      if (!passable[r][c]) return;
      if (flooded[r][c]) return;
      flooded[r][c] = true;
      queue.push([r, c]);
    };

    // Seed from all map edges: treat them as ocean-connected boundaries
    for (let c = 0; c < cols; c++) {
      pushIfPassable(0, c);
      pushIfPassable(rows - 1, c);
    }
    for (let r = 0; r < rows; r++) {
      pushIfPassable(r, 0);
      pushIfPassable(r, cols - 1);
    }

    // Flood fill through connected low-elevation cells
    while (queue.length > 0) {
      const [r, c] = queue.shift();

      pushIfPassable(r - 1, c);
      pushIfPassable(r + 1, c);
      pushIfPassable(r, c - 1);
      pushIfPassable(r, c + 1);

      // Diagonals help smooth coastlines visually
      pushIfPassable(r - 1, c - 1);
      pushIfPassable(r - 1, c + 1);
      pushIfPassable(r + 1, c - 1);
      pushIfPassable(r + 1, c + 1);
    }

    let count = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!flooded[r][c]) continue;

        count += 1;
        const x = c * cellW;
        const y = r * cellH;
        const depth = seaLevel - elev[r][c];

        let fill = "rgba(56, 189, 248, 0.45)";
        if (depth > 5) fill = "rgba(59, 130, 246, 0.55)";
        if (depth > 20) fill = "rgba(37, 99, 235, 0.66)";
        if (depth > 100) fill = "rgba(29, 78, 216, 0.74)";
        if (depth > 500) fill = "rgba(30, 64, 175, 0.82)";

        ctx.fillStyle = fill;
        ctx.fillRect(x, y, cellW + 1, cellH + 1);
      }
    }

    setFloodedCells(count);
    setStatus(
      count > 0
        ? `Flood rendered at ${seaLevel > 0 ? "+" : ""}${seaLevel}m`
        : "No ocean-connected flooded cells found in this view"
    );
  };

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

    map.on("load", () => {
      configureTerrain(map);
      setStatus("Map ready");
    });

    map.on("style.load", () => {
      configureTerrain(map);
    });

    map.on("moveend", scheduleFloodRender);
    map.on("zoomend", scheduleFloodRender);
    map.on("rotateend", scheduleFloodRender);
    map.on("pitchend", scheduleFloodRender);
    map.on("resize", scheduleFloodRender);

    mapRef.current = map;

    return () => {
      if (redrawTimeoutRef.current) {
        window.clearTimeout(redrawTimeoutRef.current);
      }
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

    clearOverlay();
    setStatus("View changed. Click Execute Flood.");
  }, [viewMode]);

  const executeFlood = () => {
    const applied = clampLevel(inputLevel);
    setSeaLevel(applied);

    const map = mapRef.current;
    if (!map) return;

    map.once("idle", () => {
      renderFlood();
    });

    // backup trigger
    setTimeout(() => {
      renderFlood();
    }, 250);
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
          Coastline-connected sea-level simulator
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
                clearOverlay();
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
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>Best for flood rendering</div>
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
            Satellite view, higher-res flood rendering, 3D globe, impact events, and spin-speed scenarios.
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
