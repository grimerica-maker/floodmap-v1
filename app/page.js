"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const TILE_SERVER = "https://flood-engine.onrender.com";
const FLOOD_SOURCE_ID = "flood-source";
const FLOOD_LAYER_ID = "flood-layer";

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
  const seaLevelRef = useRef(0);
  const hoverTimerRef = useRef(null);
  const hoverAbortRef = useRef(null);
  const lastHoverKeyRef = useRef("");

  const [inputLevel, setInputLevel] = useState(70);
  const [seaLevel, setSeaLevel] = useState(0);
  const [status, setStatus] = useState("Map loading...");
  const [viewMode, setViewMode] = useState("map");

  const [cursorLngLat, setCursorLngLat] = useState(null);
  const [cursorElevation, setCursorElevation] = useState(null);
  const [cursorLoading, setCursorLoading] = useState(false);

  useEffect(() => {
    seaLevelRef.current = seaLevel;
  }, [seaLevel]);

  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-81.5, 27.8],
      zoom: 6,
      projection: "mercator",
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      setStatus("Map ready");
    });

    map.on("mousemove", (e) => {
      const lng = e.lngLat.lng;
      const lat = e.lngLat.lat;

      setCursorLngLat({
        lng: lng.toFixed(4),
        lat: lat.toFixed(4),
      });

      const hoverKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
      if (hoverKey === lastHoverKeyRef.current) return;
      lastHoverKeyRef.current = hoverKey;

      if (hoverTimerRef.current) {
        window.clearTimeout(hoverTimerRef.current);
      }

      hoverTimerRef.current = window.setTimeout(async () => {
        try {
          if (hoverAbortRef.current) {
            hoverAbortRef.current.abort();
          }

          const controller = new AbortController();
          hoverAbortRef.current = controller;
          setCursorLoading(true);

          const res = await fetch(
            `${TILE_SERVER}/elevation?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
            { signal: controller.signal }
          );

          if (!res.ok) return;

          const data = await res.json();
          if (typeof data.elevation_m === "number") {
            setCursorElevation(Math.round(data.elevation_m));
          }
        } catch (err) {
          if (err?.name !== "AbortError") {
            // ignore
          }
        } finally {
          setCursorLoading(false);
        }
      }, 120);
    });

    map.on("mouseleave", () => {
      setCursorLngLat(null);
      setCursorElevation(null);
      setCursorLoading(false);
      lastHoverKeyRef.current = "";

      if (hoverTimerRef.current) {
        window.clearTimeout(hoverTimerRef.current);
      }
      if (hoverAbortRef.current) {
        hoverAbortRef.current.abort();
      }
    });

    mapRef.current = map;

    return () => {
      if (hoverTimerRef.current) {
        window.clearTimeout(hoverTimerRef.current);
      }
      if (hoverAbortRef.current) {
        hoverAbortRef.current.abort();
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
      tiles: [`${TILE_SERVER}/flood/${level}/{z}/{x}/{y}.png?v=${Date.now()}`],
      tileSize: 256,
      scheme: "xyz",
    });

    map.addLayer({
      id: FLOOD_LAYER_ID,
      type: "raster",
      source: FLOOD_SOURCE_ID,
      paint: {
        "raster-opacity": 0.9,
        "raster-fade-duration": 0,
      },
    });
  };

  const executeFlood = () => {
    const map = mapRef.current;
    if (!map) return;

    if (viewMode !== "map") {
      setStatus("Switch to Standard Map to run flood tiles");
      return;
    }

    const level = clampLevel(inputLevel);
    setSeaLevel(level);

    try {
      addFloodLayer(level);

      if (level > 0) {
        setStatus(`Flood tiles loaded for +${level}m`);
      } else if (level < 0) {
        setStatus(`Drain tiles loaded for ${level}m`);
      } else {
        setStatus("Present-day sea level loaded");
      }
    } catch {
      setStatus("Could not load flood tiles");
    }
  };

  const clearFlood = () => {
    removeFloodLayer();
    setSeaLevel(0);
    setInputLevel(0);
    setStatus("Flood cleared");
  };

  const switchToMap = () => {
    const map = mapRef.current;
    if (!map) return;

    setViewMode("map");
    removeFloodLayer();
    map.setProjection("mercator");
    map.setStyle("mapbox://styles/mapbox/streets-v12");

    map.once("style.load", () => {
      setStatus("Standard Map ready");
      if (seaLevelRef.current !== 0) {
        addFloodLayer(seaLevelRef.current);
      }
    });
  };

  const switchToSatelliteLocked = () => {
    setStatus("Satellite is a Pro feature");
  };

  const switchToGlobeLocked = () => {
    setStatus("Globe comes back after 2D flood is stable");
  };

  const scenarioLabel = () => {
    if (seaLevel > 0) return `+${seaLevel}m rise`;
    if (seaLevel < 0) return `${seaLevel}m lowered sea`;
    return "0m present-day";
  };

  const surfaceLabel = () => {
    if (cursorLoading) return "Loading...";
    if (cursorElevation === null) return "--";

    if (seaLevel > 0) {
      if (cursorElevation >= 0) {
        const floodDepth = seaLevel - cursorElevation;
        if (floodDepth > 0) return `${Math.round(floodDepth)} m flooded`;
        if (floodDepth === 0) return "At sea surface";
        return `${Math.abs(Math.round(floodDepth))} m above water`;
      }

      const presentDepth = Math.abs(Math.round(cursorElevation));
      const totalDepth = Math.round(seaLevel - cursorElevation);
      return `Present depth ${presentDepth} m · After rise ${totalDepth} m`;
    }

    if (seaLevel < 0) {
      if (cursorElevation <= 0 && cursorElevation >= seaLevel) {
        return `${Math.round(cursorElevation - seaLevel)} m above new sea`;
      }
      if (cursorElevation < seaLevel) {
        return `${Math.round(seaLevel - cursorElevation)} m below new sea`;
      }
      return `${Math.round(cursorElevation - seaLevel)} m above new sea`;
    }

    if (cursorElevation < 0) {
      return `${Math.abs(Math.round(cursorElevation))} m below present sea`;
    }
    if (cursorElevation === 0) {
      return "At present sea level";
    }
    return `${Math.round(cursorElevation)} m above present sea`;
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
          background: "rgba(255,255,255,0.97)",
          borderRight: "1px solid #e5e7eb",
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
          padding: 20,
          fontFamily: "Arial, sans-serif",
          overflowY: "auto",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          Floodmap
        </div>

        <div style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
          Ocean-connected rise and negative sea levels
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
              onClick={switchToMap}
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
                Flood tiles run here
              </div>
            </button>

            <button
              onClick={switchToSatelliteLocked}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                color: "#9ca3af",
                textAlign: "left",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Satellite View 🔒
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>
                Pro later
              </div>
            </button>

            <button
              onClick={switchToGlobeLocked}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                color: "#9ca3af",
                textAlign: "left",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Globe View 🔒
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>
                Later
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
          background: "rgba(17,24,39,0.88)",
          color: "white",
          padding: "14px 16px",
          borderRadius: 12,
          fontFamily: "Arial, sans-serif",
          fontSize: 13,
          lineHeight: 1.6,
          boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          minWidth: 320,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Current Scenario</div>
        <div>Sea level: {seaLevel > 0 ? "+" : ""}{seaLevel}m</div>
        <div>Scenario: {scenarioLabel()}</div>
        <div>Mode: {viewMode}</div>
        <div>Status: {status}</div>

        <div style={{ marginTop: 10, fontWeight: 700 }}>Cursor</div>
        <div>
          Coords: {cursorLngLat ? `${cursorLngLat.lat}, ${cursorLngLat.lng}` : "--"}
        </div>
        <div>
          Elevation: {cursorElevation !== null ? `${cursorElevation} m` : "--"}
        </div>
        <div>
          Surface relation: {surfaceLabel()}
        </div>
      </div>
    </div>
  );
}
