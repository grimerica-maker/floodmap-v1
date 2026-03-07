"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const TILE_SERVER = "https://flood-engine.onrender.com";
const FLOOD_SOURCE_ID = "flood-source";
const FLOOD_LAYER_ID = "flood-layer";

export default function HomePage() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  const [inputLevel, setInputLevel] = useState(50);
  const [status, setStatus] = useState("Loading map...");

  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-80.19, 25.76],
      zoom: 5,
      projection: "mercator",
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      setStatus("Map ready");
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
      tiles: [`${TILE_SERVER}/flood/${level}/{z}/{x}/{y}.png`],
      tileSize: 256,
      scheme: "xyz",
    });

    map.addLayer({
      id: FLOOD_LAYER_ID,
      type: "raster",
      source: FLOOD_SOURCE_ID,
      paint: {
        "raster-opacity": 1.0,
        "raster-fade-duration": 0,
      },
    });
  };

  const executeFlood = () => {
    const level = parseInt(inputLevel, 10);
    if (Number.isNaN(level)) return;

    setStatus(`Loading debug tiles for +${level}m`);
    addFloodLayer(level);
  };

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
        <h2>Floodmap Debug</h2>

        <div style={{ marginTop: 20, fontWeight: "bold" }}>Sea Level</div>
        <div style={{ fontSize: 28, marginBottom: 10 }}>+{inputLevel} m</div>

        <input
          type="number"
          value={inputLevel}
          onChange={(e) => setInputLevel(e.target.value)}
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
            marginBottom: 10,
          }}
        >
          Execute Flood
        </button>

        <button
          onClick={() => {
            removeFloodLayer();
            setStatus("Flood layer removed");
          }}
          style={{
            width: "100%",
            padding: 12,
            background: "white",
            color: "#111",
            border: "1px solid #ccc",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Clear
        </button>
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
          minWidth: 220,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Debug Status</div>
        <div>{status}</div>
        <div>Tile server: connected</div>
      </div>
    </div>
  );
}
