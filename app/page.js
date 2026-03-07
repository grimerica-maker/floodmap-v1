"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const TILE_SERVER = "https://flood-engine.onrender.com";

export default function HomePage() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  const [seaLevelInput, setSeaLevelInput] = useState(10);
  const [seaLevel, setSeaLevel] = useState(10);

  const FLOOD_SOURCE = "flood-source";
  const FLOOD_LAYER = "flood-layer";

  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-80.19, 25.76],
      zoom: 5,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    mapRef.current = map;
  }, []);

  function addFloodLayer(level) {
    const map = mapRef.current;
    if (!map) return;

    if (map.getLayer(FLOOD_LAYER)) {
      map.removeLayer(FLOOD_LAYER);
    }

    if (map.getSource(FLOOD_SOURCE)) {
      map.removeSource(FLOOD_SOURCE);
    }

    map.addSource(FLOOD_SOURCE, {
      type: "raster",
      tiles: [`${TILE_SERVER}/flood/${level}/{z}/{x}/{y}.png`],
      tileSize: 256,
    });

    map.addLayer({
      id: FLOOD_LAYER,
      type: "raster",
      source: FLOOD_SOURCE,
      paint: {
        "raster-opacity": 0.7,
      },
    });
  }

  function executeFlood() {
    const level = parseInt(seaLevelInput, 10);
    if (Number.isNaN(level)) return;

    setSeaLevel(level);
    addFloodLayer(level);
  }

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 320,
          height: "100%",
          background: "white",
          padding: 20,
          boxShadow: "0 0 20px rgba(0,0,0,0.2)",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h2>Floodmap</h2>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: "bold" }}>Sea Level</div>

          <div style={{ fontSize: 28, marginBottom: 10 }}>
            {seaLevel > 0 ? "+" : ""}
            {seaLevel} m
          </div>

          <input
            type="number"
            value={seaLevelInput}
            min="-5000"
            max="5000"
            step="10"
            onChange={(e) => setSeaLevelInput(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              fontSize: 16,
              marginBottom: 10,
            }}
          />

          <button
            onClick={executeFlood}
            style={{
              width: "100%",
              padding: 12,
              background: "#111",
              color: "white",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Execute Flood
          </button>
        </div>
      </div>
    </div>
  );
}
