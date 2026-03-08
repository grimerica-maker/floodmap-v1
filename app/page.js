"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const FLOOD_ENGINE = "https://flood-engine.onrender.com";
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
  const impactMarkerRef = useRef(null);
  const scenarioModeRef = useRef("flood");
  const impactPointRef = useRef(null);
  const seaLevelRef = useRef(0);

  const [inputLevel, setInputLevel] = useState(0);
  const [seaLevel, setSeaLevel] = useState(0);
  const [viewMode, setViewMode] = useState("map");
  const [status, setStatus] = useState("Loading map...");
  const [scenarioMode, setScenarioMode] = useState("flood");

  const [impactSize, setImpactSize] = useState(10);
  const [impactPoint, setImpactPoint] = useState(null);

  const [hoverLat, setHoverLat] = useState(null);
  const [hoverLng, setHoverLng] = useState(null);
  const [hoverElevation, setHoverElevation] = useState(null);

  useEffect(() => {
    scenarioModeRef.current = scenarioMode;
  }, [scenarioMode]);

  useEffect(() => {
    impactPointRef.current = impactPoint;
  }, [impactPoint]);

  useEffect(() => {
    seaLevelRef.current = seaLevel;
  }, [seaLevel]);

  const waterDifference =
    hoverElevation !== null
      ? Number((hoverElevation - seaLevel).toFixed(2))
      : null;

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
    if (!map.isStyleLoaded()) return;

    removeFloodLayer();

    map.addSource(FLOOD_SOURCE_ID, {
      type: "raster",
      tiles: [`${FLOOD_ENGINE}/flood/${level}/{z}/{x}/{y}.png`],
      tileSize: 256,
    });

    map.addLayer({
      id: FLOOD_LAYER_ID,
      type: "raster",
      source: FLOOD_SOURCE_ID,
      paint: {
        "raster-opacity": 0.82,
        "raster-fade-duration": 0,
      },
    });
  };

  const removeImpactMarker = () => {
    if (impactMarkerRef.current) {
      impactMarkerRef.current.remove();
      impactMarkerRef.current = null;
    }
  };

  const addOrUpdateImpactMarker = (point) => {
    const map = mapRef.current;
    if (!map || !point) return;

    if (!impactMarkerRef.current) {
      const el = document.createElement("div");
      el.style.width = "18px";
      el.style.height = "18px";
      el.style.borderRadius = "50%";
      el.style.background = "#ef4444";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 0 0 6px rgba(239,68,68,0.25)";

      impactMarkerRef.current = new mapboxgl.Marker(el).addTo(map);
    }

    impactMarkerRef.current.setLngLat([point.lng, point.lat]);
  };

  const fetchElevation = async (lat, lng) => {
    try {
      const res = await fetch(
        `${FLOOD_ENGINE}/elevation?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
      );

      if (!res.ok) return;

      const data = await res.json();
      setHoverElevation(data.elevation_m);
    } catch (err) {
      setHoverElevation(null);
    }
  };

  const restoreMapOverlays = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (viewMode === "map" && seaLevelRef.current !== 0) {
      addFloodLayer(seaLevelRef.current);
    }

    if (scenarioModeRef.current === "impact" && impactPointRef.current) {
      addOrUpdateImpactMarker(impactPointRef.current);
    }
  };

  const setMapStyleForMode = (mode) => {
    const map = mapRef.current;
    if (!map) return;

    removeFloodLayer();

    if (mode === "globe") {
      map.setProjection("globe");
      map.setStyle("mapbox://styles/mapbox/streets-v12");
      map.flyTo({
        center: [-70, 28],
        zoom: 2.6,
        essential: true,
      });

      map.once("style.load", () => {
        map.setFog({});
        restoreMapOverlays();
      });

      setStatus("Globe preview mode");
      return;
    }

    if (mode === "satellite") {
      map.setProjection("mercator");
      map.setStyle("mapbox://styles/mapbox/satellite-streets-v12");
      map.flyTo({
        center: [-80.19, 25.76],
        zoom: 6.2,
        essential: true,
      });

      map.once("style.load", () => {
        restoreMapOverlays();
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

    map.once("style.load", () => {
      restoreMapOverlays();
    });

    setStatus("Standard Map ready");
  };

  const executeFlood = () => {
    const level = clampLevel(inputLevel);
    setSeaLevel(level);

    if (viewMode !== "map") {
      setStatus("Switch to Standard Map to run flood layer");
      return;
    }

    if (level === 0) {
      removeFloodLayer();
      setStatus("Flood cleared");
      return;
    }

    addFloodLayer(level);
    setStatus(`Flood tiles loaded at ${level > 0 ? "+" : ""}${level}m`);
  };

  const clearFlood = () => {
    setInputLevel(0);
    setSeaLevel(0);
    setImpactPoint(null);
    impactPointRef.current = null;
    removeFloodLayer();
    removeImpactMarker();
    setStatus("Flood cleared");
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
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.getCanvas().style.cursor = "crosshair";

    const handleLoad = () => {
      setStatus("Map ready");
    };

    const handleMouseMove = (e) => {
      const lat = Number(e.lngLat.lat.toFixed(5));
      const lng = Number(e.lngLat.lng.toFixed(5));

      setHoverLat(lat);
      setHoverLng(lng);

      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }

      hoverTimerRef.current = setTimeout(() => {
        fetchElevation(lat, lng);
      }, 120);
    };

    const handleMouseLeave = () => {
      setHoverLat(null);
      setHoverLng(null);
      setHoverElevation(null);
    };

    const handleMapClick = (e) => {
      if (scenarioModeRef.current !== "impact") return;

      const point = {
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
      };

      impactPointRef.current = point;
      setImpactPoint(point);
      addOrUpdateImpactMarker(point);
      setStatus("Impact point selected");
    };

    map.on("load", handleLoad);
    map.on("mousemove", handleMouseMove);
    map.on("mouseleave", handleMouseLeave);
    map.on("click", handleMapClick);

    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }

      map.off("load", handleLoad);
      map.off("mousemove", handleMouseMove);
      map.off("mouseleave", handleMouseLeave);
      map.off("click", handleMapClick);

      removeImpactMarker();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    setMapStyleForMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (scenarioMode !== "impact") {
      removeImpactMarker();
      return;
    }

    if (impactPointRef.current) {
      addOrUpdateImpactMarker(impactPointRef.current);
    }
  }, [scenarioMode, impactPoint]);

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 340,
          height: "100%",
          background: "rgba(249,250,251,0.97)",
          borderRight: "1px solid #e5e7eb",
          padding: 16,
          fontFamily: "Arial, sans-serif",
          zIndex: 10,
          overflowY: "auto",
        }}
      >
        <h1 style={{ margin: "8px 0 24px 0", fontSize: 22 }}>Floodmap V1</h1>

        <div style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
          Python tile flood engine
        </div>

        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
          SEA LEVEL
        </div>

        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 12,
            color:
              seaLevel > 0
                ? "#0f62fe"
                : seaLevel < 0
                  ? "#b45309"
                  : "#111827",
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
            padding: 12,
            fontSize: 18,
            border: "1px solid #ccc",
            marginBottom: 12,
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <button
            onClick={executeFlood}
            style={{
              flex: 1,
              padding: "12px 10px",
              background: "#0f172a",
              color: "white",
              border: "none",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Execute Flood
          </button>

          <button
            onClick={clearFlood}
            style={{
              flex: 1,
              padding: "12px 10px",
              background: "white",
              color: "#111827",
              border: "1px solid #ccc",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>

        <div style={{ fontSize: 14, marginBottom: 24 }}>
          Range: -5000m to +5000m
        </div>

        <hr style={{ margin: "0 0 18px 0" }} />

        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
          PRESETS
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 28,
          }}
        >
          {PRESETS.map((preset) => {
            const active = inputLevel === preset.value;
            return (
              <button
                key={preset.label}
                onClick={() => setInputLevel(preset.value)}
                style={{
                  padding: "12px 10px",
                  border: "1px solid #d1d5db",
                  background: active ? "#0f172a" : "white",
                  color: active ? "white" : "#111827",
                  cursor: "pointer",
                  borderRadius: 12,
                  fontWeight: 700,
                }}
              >
                <div>{preset.label}</div>
                <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
                  {preset.value > 0 ? "+" : ""}
                  {preset.value}m
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
          SCENARIO MODE
        </div>

        <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
          <button
            onClick={() => setScenarioMode("flood")}
            style={{
              width: "100%",
              padding: 14,
              border: "1px solid #d1d5db",
              background: scenarioMode === "flood" ? "#0f172a" : "white",
              color: scenarioMode === "flood" ? "white" : "#111827",
              cursor: "pointer",
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            <div>Flood</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
              Sea level up / down
            </div>
          </button>

          <button
            onClick={() => setScenarioMode("impact")}
            style={{
              width: "100%",
              padding: 14,
              border: "1px solid #d1d5db",
              background: scenarioMode === "impact" ? "#0f172a" : "white",
              color: scenarioMode === "impact" ? "white" : "#111827",
              cursor: "pointer",
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            <div>Impact</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
              Asteroid impact simulation
            </div>
          </button>
        </div>

        {scenarioMode === "impact" && (
          <>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              IMPACT SIZE
            </div>

            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={impactSize}
              onChange={(e) => setImpactSize(Number(e.target.value))}
              style={{
                width: "100%",
                marginBottom: 8,
              }}
            />

            <div style={{ fontSize: 14, marginBottom: 24 }}>
              Size: {impactSize}
            </div>
          </>
        )}

        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
          VIEW MODE
        </div>

        <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
          <button
            onClick={() => setViewMode("map")}
            style={{
              width: "100%",
              padding: 14,
              border: "1px solid #d1d5db",
              background: viewMode === "map" ? "#0f172a" : "white",
              color: viewMode === "map" ? "white" : "#111827",
              cursor: "pointer",
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            <div>Standard Map</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
              Flood tiles active
            </div>
          </button>

          <button
            onClick={() => setViewMode("satellite")}
            style={{
              width: "100%",
              padding: 14,
              border: "1px solid #d1d5db",
              background: viewMode === "satellite" ? "#0f172a" : "white",
              color: viewMode === "satellite" ? "white" : "#111827",
              cursor: "pointer",
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            <div>Satellite View</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
              Pro placeholder
            </div>
          </button>

          <button
            onClick={() => setViewMode("globe")}
            style={{
              width: "100%",
              padding: 14,
              border: "1px solid #d1d5db",
              background: viewMode === "globe" ? "#0f172a" : "white",
              color: viewMode === "globe" ? "white" : "#111827",
              cursor: "pointer",
              borderRadius: 12,
              fontWeight: 700,
            }}
          >
            <div>Globe View</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
              Preview
            </div>
          </button>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 20,
          top: 10,
          background: "#1e3a5f",
          color: "white",
          padding: 16,
          borderRadius: 12,
          fontSize: 14,
          lineHeight: 1.45,
          zIndex: 10,
          minWidth: 260,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          Current Scenario
        </div>
        <div>
          Sea level: {seaLevel > 0 ? "+" : ""}
          {seaLevel}m
        </div>
        <div>
          Mode:{" "}
          {viewMode === "map"
            ? "Standard Map"
            : viewMode === "satellite"
              ? "Satellite"
              : "Globe"}
        </div>
        <div>Status: {status}</div>
        <div>Scenario Mode: {scenarioMode}</div>
        <div>Impact Size: {impactSize}</div>
        <div>
          Impact Point:{" "}
          {impactPoint
            ? `${impactPoint.lng.toFixed(3)}, ${impactPoint.lat.toFixed(3)}`
            : "--"}
        </div>

        <hr style={{ margin: "10px 0", opacity: 0.25 }} />

        <div style={{ fontWeight: 700, marginBottom: 6 }}>Cursor</div>
        <div>Lat: {hoverLat ?? "--"}</div>
        <div>Lng: {hoverLng ?? "--"}</div>
        <div>
          Original Elevation: {hoverElevation !== null ? `${hoverElevation} m` : "--"}
        </div>
        <div>
          Sea Level: {seaLevel > 0 ? "+" : ""}
          {seaLevel} m
        </div>
        <div>
          {waterDifference !== null
            ? waterDifference >= 0
              ? `Above water by ${waterDifference} m`
              : `Underwater by ${Math.abs(waterDifference)} m`
            : "--"}
        </div>
      </div>
    </div>
  );
}
