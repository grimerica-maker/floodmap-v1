"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const FLOOD_ENGINE_PROXY_PATH = "/api/engine";
const CONFIGURED_FLOOD_ENGINE_URL = process.env.NEXT_PUBLIC_FLOOD_ENGINE_URL;

const FLOOD_SOURCE_ID = "flood-source";
const FLOOD_LAYER_ID = "flood-layer";

const MAP_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};

const SAT_STYLE = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: "sat",
      type: "raster",
      source: "esri",
    },
  ],
};

const safely = (fn) => {
  try {
    return fn();
  } catch {
    return null;
  }
};

export default function Page() {
  const mapRef = useRef(null);
  const mapContainer = useRef(null);
  const activeFloodLevel = useRef(null);
  const styleRestoreFrame = useRef(null);

  const [seaLevel, setSeaLevel] = useState(0);
  const [viewMode, setViewMode] = useState("map");
  const [status, setStatus] = useState("Loading map...");
  const [engineUrl, setEngineUrl] = useState(FLOOD_ENGINE_PROXY_PATH);

  useEffect(() => {
    if (!CONFIGURED_FLOOD_ENGINE_URL) {
      setEngineUrl(FLOOD_ENGINE_PROXY_PATH);
      return;
    }

    setEngineUrl(CONFIGURED_FLOOD_ENGINE_URL.replace(/\/+$/, ""));
  }, []);

  const isReady = () => {
    const map = mapRef.current;
    if (!map) return false;
    if (!map.isStyleLoaded()) return false;
    const style = map.getStyle();
    return style && style.layers?.length > 0;
  };

  const removeFlood = () => {
    const map = mapRef.current;
    if (!map) return;

    try {
      if (map.getLayer(FLOOD_LAYER_ID)) map.removeLayer(FLOOD_LAYER_ID);
      if (map.getSource(FLOOD_SOURCE_ID)) map.removeSource(FLOOD_SOURCE_ID);
    } catch {}

    activeFloodLevel.current = null;
  };

  const addFlood = (level) => {
    const map = mapRef.current;
    if (!isReady()) return false;

    if (!level) return false;

    const tile = `${engineUrl}/flood/${level}/{z}/{x}/{y}.png`;

    if (
      activeFloodLevel.current === level &&
      map.getLayer(FLOOD_LAYER_ID) &&
      map.getSource(FLOOD_SOURCE_ID)
    ) {
      return true;
    }

    removeFlood();

    try {
      map.addSource(FLOOD_SOURCE_ID, {
        type: "raster",
        tiles: [tile],
        tileSize: 256,
      });

      map.addLayer({
        id: FLOOD_LAYER_ID,
        type: "raster",
        source: FLOOD_SOURCE_ID,
        paint: {
          "raster-opacity": 1,
          "raster-resampling": "linear",
          "raster-fade-duration": 0,
        },
      });

      activeFloodLevel.current = level;
      return true;
    } catch {
      return false;
    }
  };

  const restoreFlood = () => {
    if (!isReady()) return;

    if (!seaLevel) {
      removeFlood();
      return;
    }

    addFlood(seaLevel);
  };

  useEffect(() => {
    if (mapRef.current || !engineUrl) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: [-80, 26],
      zoom: 5,
      transformRequest: (url, type) => {
        if (type === "Tile" && url.includes("/flood/")) {
          console.log("FLOOD TILE:", url);
        }
        return { url };
      },
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const onLoad = () => {
      fetch(engineUrl)
        .then((r) => r.json())
        .then((d) => console.log("Engine OK", d))
        .catch(() => console.warn("Engine unreachable"));

      restoreFlood();
      setStatus("Map ready");
    };

    const onStyle = () => {
      if (!map.isStyleLoaded()) return;

      cancelAnimationFrame(styleRestoreFrame.current);

      styleRestoreFrame.current = requestAnimationFrame(() => {
        restoreFlood();
      });
    };

    map.on("load", onLoad);
    map.on("styledata", onStyle);

    return () => {
      map.off("load", onLoad);
      map.off("styledata", onStyle);
      map.remove();
    };
  }, [engineUrl]);

  useEffect(() => {
    if (!isReady()) return;
    restoreFlood();
  }, [seaLevel]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (viewMode === "satellite") {
      map.setStyle(SAT_STYLE);
    } else {
      map.setStyle(MAP_STYLE);
    }
  }, [viewMode]);

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <div
        ref={mapContainer}
        style={{ width: "100%", height: "100%", position: "absolute" }}
      />

      <div
        style={{
          position: "absolute",
          left: 20,
          top: 20,
          background: "white",
          padding: 16,
          borderRadius: 8,
          width: 260,
          fontFamily: "Arial",
        }}
      >
        <h3>Floodmap V1</h3>

        <div style={{ marginBottom: 10 }}>
          Sea Level: <b>{seaLevel} m</b>
        </div>

        <input
          type="number"
          value={seaLevel}
          onChange={(e) => setSeaLevel(Number(e.target.value))}
          style={{ width: "100%", marginBottom: 10 }}
        />

        <button
          onClick={() => restoreFlood()}
          style={{ width: "100%", marginBottom: 10 }}
        >
          Execute Flood
        </button>

        <button
          onClick={() => setSeaLevel(0)}
          style={{ width: "100%", marginBottom: 10 }}
        >
          Clear
        </button>

        <div style={{ marginTop: 20 }}>
          <button onClick={() => setViewMode("map")}>Map</button>
          <button onClick={() => setViewMode("satellite")}>Satellite</button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12 }}>Status: {status}</div>
      </div>
    </div>
  );
}
