"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const FLOOD_ENGINE = "https://flood-engine.onrender.com";

export default function Home() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  const [inputLevel, setInputLevel] = useState(0);
  const [seaLevel, setSeaLevel] = useState(0);
  const [status, setStatus] = useState("Loading map...");
  const [viewMode, setViewMode] = useState("map");

  const FLOOD_LAYER = "flood-layer";
  const FLOOD_SOURCE = "flood-source";

  function setCursorHandlers(map) {
    const canvas = map.getCanvas();

    canvas.style.cursor = "grab";

    map.on("mousedown", () => {
      canvas.style.cursor = "grabbing";
    });

    map.on("mouseup", () => {
      canvas.style.cursor = "grab";
    });

    map.on("dragstart", () => {
      canvas.style.cursor = "grabbing";
    });

    map.on("dragend", () => {
      canvas.style.cursor = "grab";
    });

    map.on("mouseleave", () => {
      canvas.style.cursor = "grab";
    });
  }

  function removeFloodLayer() {
    const map = mapRef.current;
    if (!map) return;

    if (map.getLayer(FLOOD_LAYER)) {
      map.removeLayer(FLOOD_LAYER);
    }

    if (map.getSource(FLOOD_SOURCE)) {
      map.removeSource(FLOOD_SOURCE);
    }
  }

  function addFloodLayer(level) {
    const map = mapRef.current;
    if (!map) return;

    removeFloodLayer();

    map.addSource(FLOOD_SOURCE, {
      type: "raster",
      tiles: [
        `${FLOOD_ENGINE}/flood/${level}/{z}/{x}/{y}.png`
      ],
      tileSize: 256
    });

    map.addLayer({
      id: FLOOD_LAYER,
      type: "raster",
      source: FLOOD_SOURCE,
      paint: {
        "raster-opacity": 0.85,
        "raster-fade-duration": 0
      }
    });
  }

  function executeFlood() {
    const level = parseInt(inputLevel);

    if (isNaN(level)) return;

    setSeaLevel(level);
    addFloodLayer(level);

    setStatus(`Flood tiles loaded at ${level > 0 ? "+" : ""}${level}m`);
  }

  function clearFlood() {
    removeFloodLayer();
    setSeaLevel(0);
    setInputLevel(0);
    setStatus("Flood cleared");
  }

  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [2.9, 37.2],
      zoom: 7,
      projection: "mercator"
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    setCursorHandlers(map);

    map.on("load", () => {
      setStatus("Map ready");
    });

    mapRef.current = map;

    return () => {
      map.remove();
    };
  }, []);

  function switchView(mode) {
    const map = mapRef.current;
    if (!map) return;

    setViewMode(mode);

    removeFloodLayer();

    if (mode === "satellite") {
      map.setStyle("mapbox://styles/mapbox/satellite-streets-v12");
    } else if (mode === "globe") {
      map.setProjection("globe");
      map.setStyle("mapbox://styles/mapbox/streets-v12");
    } else {
      map.setProjection("mercator");
      map.setStyle("mapbox://styles/mapbox/streets-v12");
    }

    map.once("style.load", () => {
      setCursorHandlers(map);

      if (seaLevel !== 0 && mode === "map") {
        addFloodLayer(seaLevel);
      }
    });
  }

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>

      <div
        ref={mapContainer}
        style={{ width: "100%", height: "100%" }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 320,
          height: "100%",
          background: "#f9fafb",
          borderRight: "1px solid #e5e7eb",
          padding: 20,
          fontFamily: "Arial"
        }}
      >

        <h2>Floodmap V1</h2>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 20 }}>
          Python tile flood engine
        </div>

        <div style={{ fontWeight: 700 }}>SEA LEVEL</div>

        <div style={{ fontSize: 22, marginBottom: 10 }}>
          {seaLevel > 0 ? "+" : ""}
          {seaLevel} m
        </div>

        <input
          type="number"
          value={inputLevel}
          min="-5000"
          max="5000"
          onChange={(e) => setInputLevel(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            marginBottom: 10
          }}
        />

        <div style={{ display: "flex", gap: 10 }}>

          <button
            onClick={executeFlood}
            style={{
              flex: 1,
              padding: 10,
              background: "#111827",
              color: "white",
              border: "none",
              cursor: "pointer"
            }}
          >
            Execute Flood
          </button>

          <button
            onClick={clearFlood}
            style={{
              flex: 1,
              padding: 10,
              border: "1px solid #ccc",
              background: "white",
              cursor: "pointer"
            }}
          >
            Clear
          </button>

        </div>

        <div style={{ marginTop: 8, fontSize: 12 }}>
          Range: -5000m to +5000m
        </div>

        <hr style={{ margin: "20px 0" }} />

        <div style={{ fontWeight: 700, marginBottom: 10 }}>
          VIEW MODE
        </div>

        <button
          onClick={() => switchView("map")}
          style={{
            width: "100%",
            padding: 10,
            marginBottom: 8,
            background: viewMode === "map" ? "#111827" : "white",
            color: viewMode === "map" ? "white" : "black",
            border: "1px solid #ccc",
            cursor: "pointer"
          }}
        >
          Standard Map
        </button>

        <button
          onClick={() => switchView("satellite")}
          style={{
            width: "100%",
            padding: 10,
            marginBottom: 8,
            border: "1px solid #ccc",
            cursor: "pointer"
          }}
        >
          Satellite View
        </button>

        <button
          onClick={() => switchView("globe")}
          style={{
            width: "100%",
            padding: 10,
            border: "1px solid #ccc",
            cursor: "pointer"
          }}
        >
          Globe View
        </button>

      </div>

      <div
        style={{
          position: "absolute",
          right: 20,
          top: 20,
          background: "#1e293b",
          color: "white",
          padding: 12,
          borderRadius: 8,
          fontSize: 13
        }}
      >

        <b>Current Scenario</b>

        <div>
          Sea level: {seaLevel > 0 ? "+" : ""}
          {seaLevel}m
        </div>

        <div>
          Mode: {viewMode === "map" ? "Standard Map" : viewMode}
        </div>

        <div>Status: {status}</div>

      </div>

    </div>
  );
}
