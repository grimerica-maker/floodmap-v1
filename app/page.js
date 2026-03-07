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
  const renderTimerRef = useRef(null);
  const renderJobRef = useRef({ id: 0, cancelled: false });

  const [inputLevel, setInputLevel] = useState(0);
  const [seaLevel, setSeaLevel] = useState(0);
  const [viewMode, setViewMode] = useState("map");
  const [status, setStatus] = useState("Loading map...");
  const [floodedCells, setFloodedCells] = useState(0);
  const [engineReady, setEngineReady] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  const clampLevel = (value) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return 0;
    return Math.max(-5000, Math.min(5000, parsed));
  };

  const cancelRender = () => {
    renderJobRef.current.cancelled = true;
    setIsRendering(false);
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
          "raster-opacity": 0.78,
          "raster-fade-duration": 0,
        },
      });
    }
  };

  const clearFlood = () => {
    cancelRender();
    removeFloodLayer();
    setSeaLevel(0);
    setFloodedCells(0);
    setStatus("Flood cleared");
  };

  const getGridSize = (zoom) => {
    if (zoom >= 10) return { cols: 120, rows: 90 };
    if (zoom >= 8) return { cols: 96, rows: 72 };
    if (zoom >= 6) return { cols: 76, rows: 56 };
    if (zoom >= 4) return { cols: 60, rows: 44 };
    return { cols: 48, rows: 36 };
  };

  const renderFlood = async () => {
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

    cancelRender();
    const nextId = renderJobRef.current.id + 1;
    renderJobRef.current = { id: nextId, cancelled: false };
    const job = renderJobRef.current;

    setIsRendering(true);
    setStatus("Sampling terrain...");

    const canvas = document.createElement("canvas");
    const width = 900;
    const height = 680;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    const { cols, rows } = getGridSize(map.getZoom());
    const cellW = width / cols;
    const cellH = height / rows;

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

    const elev = Array.from({ length: rows }, () => Array(cols).fill(null));
    const lowEnough = Array.from({ length: rows }, () => Array(cols).fill(false));
    const flooded = Array.from({ length: rows }, () => Array(cols).fill(false));

    const rowsPerChunk = 5;

    for (let startRow = 0; startRow < rows; startRow += rowsPerChunk) {
      if (job.cancelled) return;

      const endRow = Math.min(rows, startRow + rowsPerChunk);

      for (let r = startRow; r < endRow; r++) {
        for (let c = 0; c < cols; c++) {
          const px = c * cellW + cellW / 2;
          const py = r * cellH + cellH / 2;
          const lngLat = map.unproject([px, py]);
          const elevation = map.queryTerrainElevation(lngLat, { exaggerated: false });

          elev[r][c] = elevation;

          if (
            typeof elevation === "number" &&
            !Number.isNaN(elevation) &&
            elevation <= seaLevel
          ) {
            lowEnough[r][c] = true;
          }
        }
      }

      setStatus(`Sampling terrain... ${Math.round((endRow / rows) * 100)}%`);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    if (job.cancelled) return;

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
      if (job.cancelled) return;

      const batch = Math.min(queue.length, 1400);
      for (let i = 0; i < batch; i++) {
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

      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    if (job.cancelled) return;

    setStatus("Painting overlay...");

    let count = 0;
    ctx.clearRect(0, 0, width, height);

    for (let startRow = 0; startRow < rows; startRow += rowsPerChunk) {
      if (job.cancelled) return;

      const endRow = Math.min(rows, startRow + rowsPerChunk);

      for (let r = startRow; r < endRow; r++) {
        for (let c = 0; c < cols; c++) {
          if (!flooded[r][c]) continue;

          count += 1;
          const depth = seaLevel - elev[r][c];

          let fill = "rgba(56, 189, 248, 0.40)";
          if (depth > 5) fill = "rgba(59, 130, 246, 0.50)";
          if (depth > 20) fill = "rgba(37, 99, 235, 0.60)";
          if (depth > 100) fill = "rgba(29, 78, 216, 0.72)";
          if (depth > 500) fill = "rgba(30, 64, 175, 0.82)";

          ctx.fillStyle = fill;
          ctx.fillRect(c * cellW, r * cellH, cellW + 1, cellH + 1);
        }
      }

      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    if (job.cancelled) return;

    addOrUpdateFloodOverlay(canvas.toDataURL("image/png"), coordinates);
    setFloodedCells(count);
    setStatus(
      count > 0
        ? `Flood rendered at ${seaLevel > 0 ? "+" : ""}${seaLevel}m`
        : "No ocean-connected flooded cells found in this view"
    );
    setIsRendering(false);
  };

  const scheduleRender = () => {
    if (renderTimerRef.current) {
      window.clearTimeout(renderTimerRef.current);
    }

    renderTimerRef.current = window.setTimeout(() => {
      renderFlood();
    }, 250);
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
      preserveDrawingBuffer: true,
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
      ensureTerrain();
      setStatus("Map ready");
    });

    map.on("style.load", () => {
      ensureTerrain();
      if (seaLevel > 0 && viewMode === "map") {
        scheduleRender();
      }
    });

    map.on("movestart", () => {
      cancelRender();
    });

    map.on("moveend", () => {
      if (seaLevel > 0 && viewMode === "map") {
        setStatus("View changed. Re-rendering...");
        scheduleRender();
      }
    });

    map.on("zoomend", () => {
      if (seaLevel > 0 && viewMode === "map") {
        setStatus("Zoom changed. Re-rendering...");
        scheduleRender();
      }
    });

    map.on("resize", () => {
      if (seaLevel > 0 && viewMode === "map") {
        scheduleRender();
      }
    });

    mapRef.current = map;

    return () => {
      if (renderTimerRef.current) {
        window.clearTimeout(renderTimerRef.current);
      }
      cancelRender();
      map.remove();
      mapRef.current = null;
    };
  }, [seaLevel, viewMode, engineReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    cancelRender();

    if (viewMode === "globe") {
      removeFloodLayer();
      setFloodedCells(0);
      map.setProjection("globe");
      map.setStyle("mapbox://styles/mapbox/streets-v12");
      map.flyTo({
        center: [-70, 28],
        zoom: 2.6,
        essential: true,
      });
      setStatus("Globe preview mode");
      return;
    }

    if (viewMode === "satellite") {
      removeFloodLayer();
      setFloodedCells(0);
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
    setStatus("Standard Map ready");
  }, [viewMode]);

  const executeFlood = () => {
    const applied = clampLevel(inputLevel);
    setSeaLevel(applied);

    if (viewMode !== "map") {
      setStatus("Switch to Standard Map to run flood engine");
      return;
    }

    setTimeout(() => {
      renderFlood();
    }, 50);
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
          Coastline-connected flood engine
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
              disabled={isRendering}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "none",
                background: isRendering ? "#9ca3af" : "#111827",
                color: "#fff",
                fontWeight: 700,
                cursor: isRendering ? "not-allowed" : "pointer",
              }}
            >
              {isRendering ? "Rendering..." : "Execute Flood"}
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
                Flood engine active
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
                Placeholder
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
          Mode: {viewMode === "globe" ? "Globe" : viewMode === "satellite" ? "Satellite" : "Standard Map"}
        </div>
        <div>Status: {status}</div>
        <div>Flooded cells: {floodedCells}</div>
      </div>
    </div>
  );
}
