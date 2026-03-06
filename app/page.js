"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function HomePage() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  const [seaLevel, setSeaLevel] = useState(0);

  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-95, 30],
      zoom: 3,
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

  const handleSeaLevelChange = (value) => {
    const parsed = parseInt(value, 10);

    if (Number.isNaN(parsed)) {
      setSeaLevel(0);
      return;
    }

    const clamped = Math.max(-5000, Math.min(5000, parsed));
    setSeaLevel(clamped);
  };

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          background: "white",
          padding: 16,
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          minWidth: 300,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Floodmap V1
        </div>

        <div style={{ fontSize: 14, marginBottom: 10, color: "#444" }}>
          Sea Level: {seaLevel > 0 ? "+" : ""}
          {seaLevel} m
        </div>

        <label
          htmlFor="seaLevelInput"
          style={{ display: "block", fontSize: 13, marginBottom: 6, color: "#555" }}
        >
          Enter sea level in meters
        </label>

        <input
          id="seaLevelInput"
          type="number"
          min="-5000"
          max="5000"
          step="10"
          value={seaLevel}
          onChange={(e) => handleSeaLevelChange(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            fontSize: 16,
          }}
        />

        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "#666",
          }}
        >
          Allowed range: -5000m to +5000m
        </div>
      </div>
    </div>
  );
}
