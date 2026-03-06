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

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <div
        ref={mapContainer}
        style={{ width: "100%", height: "100%" }}
      />

      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          background: "white",
          padding: 16,
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          minWidth: 280,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Floodmap V1
        </div>

        <div style={{ fontSize: 14, marginBottom: 12, color: "#444" }}>
          Sea Level: {seaLevel > 0 ? "+" : ""}
          {seaLevel} m
        </div>

        <input
          type="range"
          min="-5000"
          max="5000"
          step="10"
          value={seaLevel}
          onChange={(e) => setSeaLevel(parseInt(e.target.value, 10))}
          style={{ width: "100%" }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "#666",
            marginTop: 6,
          }}
        >
          <span>-5000m</span>
          <span>0m</span>
          <span>+5000m</span>
        </div>
      </div>
    </div>
  );
}
