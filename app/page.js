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
  const hoverTimerRef = useRef(null);
  const abortRef = useRef(null);

  const [inputLevel, setInputLevel] = useState(70);
  const [seaLevel, setSeaLevel] = useState(0);
  const [status, setStatus] = useState("Map loading...");
  const [cursorLngLat, setCursorLngLat] = useState(null);
  const [cursorElevation, setCursorElevation] = useState(null);
  const [cursorLoading, setCursorLoading] = useState(false);

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
      const lat = e.lngLat.lat;
      const lng = e.lngLat.lng;

      setCursorLngLat({
        lat: lat.toFixed(4),
        lng: lng.toFixed(4),
      });

      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

      hoverTimerRef.current = setTimeout(async () => {
        try {
          if (abortRef.current) abortRef.current.abort();
          abortRef.current = new AbortController();

          setCursorLoading(true);

          const res = await fetch(
            `${TILE_SERVER}/elevation?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
            { signal: abortRef.current.signal }
          );

          if (!res.ok) return;
          const data = await res.json();
          setCursorElevation(Math.round(data.elevation_m));
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
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (abortRef.current) abortRef.current.abort();
    });

    mapRef.current = map;

    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (abortRef.current) abortRef.current.abort();
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
    if (map.getLayer(FLOOD_LAYER_ID)) map.removeLayer(FLOOD_LAYER_ID);
    if (map.getSource(FLOOD_SOURCE_ID)) map.removeSource(FLOOD_SOURCE_ID);
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

    const level = clampLevel(inputLevel);
    setSeaLevel(level);
    addFloodLayer(level);

    if (level > 0) setStatus(`Flood tiles loaded for +${level}m`);
    else if (level < 0) setStatus(`Drain tiles loaded for ${level}m`);
    else setStatus("Present-day sea level loaded");
  };

  const clearFlood = () => {
    removeFloodLayer();
    setSeaLevel(0);
    setInputLevel(0);
    setStatus("Flood cleared");
  };

  const surfaceLabel = () => {
    if (cursorLoading) return "Loading...";
    if (cursorElevation === null) return "--";

    if (seaLevel > 0) {
      if (cursorElevation >= 0) {
        const flooded = seaLevel - cursorElevation;
        if (flooded > 0) return `${Math.round(flooded)} m flooded`;
        if (flooded === 0) return "At sea surface";
        return `${Math.abs(Math.round(flooded))} m above water`;
      }
      const presentDepth = Math.abs(cursorElevation);
      const afterDepth = seaLevel - cursorElevation;
      return `Present depth ${presentDepth} m · After rise ${Math.round(afterDepth)} m`;
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

    if (cursorElevation < 0) return `${Math.abs(cursorElevation)} m below present sea`;
    if (cursorElevation === 0) return "At present sea level";
    return `${cursorElevation} m above present sea`;
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
          Positive rise + negative drain
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
              Execute
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
