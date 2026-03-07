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

const FLOOD_SOURCE_ID = "flood-overlay-source";
const FLOOD_LAYER_ID = "flood-overlay-layer";
const DEM_SOURCE_ID = "mapbox-dem";

export default function HomePage() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const drawTimerRef = useRef(null);

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

  const removeFloodLayer = () => {
    const map = mapRef.current;
    if (!map) return;

    if (map.getLayer(FLOOD_LAYER_ID)) map.removeLayer(FLOOD_LAYER_ID);
    if (map.getSource(FLOOD_SOURCE_ID)) map.removeSource(FLOOD_SOURCE_ID);
  };

  const ensureTerrain = () => {
    const map = mapRef.current;
    if (!map) return;

    if (!map.getSource(DEM_SOURCE_ID)) {
      map.addSource(DEM_SOURCE_ID, {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
    }

    map.setTerrain({
      source: DEM_SOURCE_ID,
      exaggeration: 1,
    });

    setEngineReady(true);
  };

  const addOrUpdateFloodOverlay = (dataUrl, coordinates) => {
    const map = mapRef.current;
    if (!map) return;

    if (map.getSource(FLOOD_SOURCE_ID)) {
      map.getSource(FLOOD_SOURCE_ID).updateImage({
        url: dataUrl,
        coordinates,
      });
    } else {
      map.addSource(FLOOD_SOURCE_ID, {
        type: "image",
        url: dataUrl,
        coordinates,
      });

      map.addLayer({
        id: FLOOD_LAYER_ID,
        type: "raster",
        source: FLOOD_SOURCE_ID,
        paint: {
          "raster-opacity": 0.82,
          "raster-fade-duration": 0,
          "raster-resampling": "linear",
        },
      });
    }
  };

  const clearFlood = () => {
    removeFloodLayer();
    setFloodedCells(0);
    setSeaLevel(0);
    setStatus("Flood cleared");
  };

  const smoothMask = (mask, rows, cols) => {
    const next = Array.from({ length: rows }, () => Array(cols).fill(false));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let neighbors = 0;

        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
            if (mask[rr][cc]) neighbors += 1;
          }
        }

        if (mask[r][c]) {
          next[r][c] = neighbors >= 3;
        } else {
          next[r][c] = neighbors >= 5;
        }
      }
    }

    return next;
  };

  const renderFlood = () => {
    const map = mapRef.current;
    if (!map || !engineReady) return;

    if (viewMode !== "map") {
      setStatus("Flood engine runs in Standard Map mode only");
      return;
    }

    if (seaLevel <= 0) {
      removeFloodLayer();
      setFloodedCells(0);
      setStatus("Sea level is 0 or below. No ocean rise shown.");
      return;
    }

    const canvas = document.createElement("canvas");
    const width = 1400;
    const height = 1000;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    const cols = 180;
    const rows = 128;
    const cellW = width / cols;
    const cellH = height / rows;

    const elev = Array.from({ length: rows }, () => Array(cols).fill(null));
    const lowEnough = Array.from({ length: rows }, () => Array(cols).fill(false));
    let flooded = Array.from({ length: rows }, () => Array(cols).fill(false));

    const tl = map.unproject([0, 0]);
    const tr = map.unproject([width, 0]);
    const br = map.unproject([width, height]);
    const bl = map.unproject([0, height]);

    const coordinates = [
      [tl.lng, tl.lat],
      [tr.lng, tr.lat],
      [br.lng, br.lat],
      [bl.lng, bl.lat],
    ];

    setStatus("Sampling terrain...");

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = c * cellW + cellW / 2;
        const py = r * cellH + cellH / 2;
        const lngLat = map.unproject([px, py]);
        const e = map.queryTerrainElevation(lngLat, { exaggerated: false });

        elev[r][c] = e;
        if (typeof e === "number" && !Number.isNaN(e) && e <= seaLevel) {
          lowEnough[r][c] = true;
        }
      }
    }

    setStatus("Tracing coastline-connected water...");

    const queue = [];
    const push = (r, c) => {
      if (r < 0 || r >= rows || c < 0 || c >= cols) return;
      if (!lowEnough[r][c]) return;
      if (flooded[r][c]) return;
      flooded[r][c] = true;
      queue.push([r, c]);
    };

    for (let c = 0; c < cols; c++) {
      push(0, c);
      push(rows - 1, c);
    }
    for (let r = 0; r < rows; r++) {
      push(r, 0);
      push(r, cols - 1);
    }

    while (queue.length > 0) {
      const [r, c] = queue.shift();

      push(r - 1, c);
      push(r + 1, c);
      push(r, c - 1);
      push(r, c + 1);
      push(r - 1, c - 1);
      push(r - 1, c + 1);
      push(r + 1, c - 1);
      push(r + 1, c + 1);
    }

    flooded = smoothMask(flooded, rows, cols);

    let count = 0;
    ctx.clearRect(0, 0, width, height);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!flooded[r][c]) continue;

        count += 1;
        const depth = seaLevel - elev[r][c];

        let fill = "rgba(56, 189, 248, 0.40)";
        if (depth > 5) fill = "rgba(59, 130, 246, 0.50)";
        if (depth > 20) fill = "rgba(37, 99, 235, 0.60)";
        if (depth > 100) fill = "rgba(29, 78, 216, 0.70)";
        if (depth > 500) fill = "rgba(30, 64, 175, 0.78)";

        ctx.fillStyle = fill;
        ctx.fillRect(c * cellW, r * cellH, cellW + 1.5, cellH + 1.5);
      }
    }

    addOrUpdateFloodOverlay(canvas.toDataURL("image/png"), coordinates);
    setFloodedCells(count);
    setStatus(
      count > 0
        ? `Flood rendered at ${seaLevel > 0 ? "+" : ""}${seaLevel}m`
        : "No ocean-connected flooded cells found in this view"
    );
  };

  const scheduleRender = () => {
    if (drawTimerRef.current) window.clearTimeout(drawTimerRef.current);
    drawTimerRef.current = window.setTimeout(() => {
      renderFlood();
    }, 150);
  };

  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-80.19, 25.76],
      zoom: 6.2,
      projection: "mercator",
      preserveDrawingBuffer: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      ensureTerrain();
      setStatus("Map ready");
    });

    map.on("style.load", () => {
      ensureTerrain();
      if (seaLevel > 0 && viewMode === "map") scheduleRender();
    });

    map.on("moveend", () => {
      if (seaLevel > 0 && viewMode === "map") scheduleRender();
    });

    map.on("zoomend", () => {
      if (seaLevel > 0 && viewMode === "map") scheduleRender();
    });

    map.on("resize", () => {
      if (seaLevel > 0 && viewMode === "map") scheduleRender();
    });

    mapRef.current = map;

    return () => {
      if (drawTimerRef.current) window.clearTimeout(drawTimerRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (viewMode === "globe") {
      removeFloodLayer();
      setFloodedCells(0);
      map.setProjection("globe");
      map.setStyle("mapbox://styles/mapbox/streets-v12");
      map.flyTo({ center: [-70, 28], zoom: 2.6, essential: true });
      setStatus("Globe preview mode");
      return;
    }

    if (viewMode === "satellite") {
      removeFloodLayer();
      setFloodedCells(0);
      map.setProjection("mercator");
      map.setStyle("mapbox://styles/mapbox/satellite-streets-v12");
      map.flyTo({ center: [-80.19, 25.76], zoom: 6.2, essential: true });
      setStatus("Satellite is placeholder for Pro");
      return;
    }

    map.setProjection("mercator");
    map.setStyle("mapbox://styles/mapbox/streets-v12");
    map.flyTo({ center: [-80.19, 25.76], zoom: 6.2, essential: true });
    setStatus("Standard Map ready");
  }, [viewMode]);

  const executeFlood = () => {
    const applied = clampLevel(inputLevel);
    setSeaLevel(applied);

    if (viewMode !== "map") {
      setStatus("Switch to Standard Map to run flood engine");
      return;
    }

    const map = mapRef.current;
    if (!map) return;

    map.once("idle", () => {
      setTimeout(() => {
        renderFlood();
      }, 50);
    });

    setTimeout(() => {
      renderFlood();
    }, 300);
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
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          Floodmap V1
        </div>

        <div style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
          Smoother 2D flood rendering
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
                clearFlood();
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
              Satellite View 🔒
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
            </button>
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
        <div>Mode: {viewMode}</div>
        <div>Status: {status}</div>
        <div>Flooded cells: {floodedCells}</div>
      </div>
    </div>
  );
}
