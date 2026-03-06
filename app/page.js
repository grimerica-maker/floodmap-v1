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

  const [seaLevel, setSeaLevel] = useState(0);
  const [viewMode, setViewMode] = useState("globe");

  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-70, 28],
      zoom: 2.6,
      projection: "globe",
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("style.load", () => {
      map.setFog({});
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
      map.setStyle("mapbox://styles/mapbox/streets-v12");
    } else {
      map.setProjection("mercator");
      map.setStyle("mapbox://styles/mapbox/streets-v12");
    }
  }, [viewMode]);

  const handleSeaLevelChange = (value) => {
    if (value === "") {
      setSeaLevel(0);
      return;
    }

    const parsed = parseInt(value, 10);

    if (Number.isNaN(parsed)) {
      return;
    }

    const clamped = Math.max(-5000, Math.min(5000, parsed));
    setSeaLevel(clamped);
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
            value={seaLevel}
            onChange={(e) => handleSeaLevelChange(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              fontSize: 16,
              outline: "none",
            }}
          />

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
                onClick={() => setSeaLevel(preset.value)}
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
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>Free</div>
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
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>Preview</div>
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
            Satellite view, real flood overlays, 3D globe, impact events, and spin-speed scenarios.
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
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Current Scenario</div>
        <div>
          Sea level: {seaLevel > 0 ? "+" : ""}
          {seaLevel}m
        </div>
        <div>Mode: {viewMode === "globe" ? "Globe" : "Standard Map"}</div>
      </div>
    </div>
  );
}
