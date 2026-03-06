"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

export default function HomePage() {

  const mapContainer = useRef(null)
  const mapRef = useRef(null)

  const [seaLevel, setSeaLevel] = useState(0)

  useEffect(() => {

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-95, 30],
      zoom: 3,
      projection: "globe"
    })

    map.addControl(new mapboxgl.NavigationControl())

    map.on("style.load", () => {

      map.setFog({})

      map.addSource("flood", {
        type: "raster-dem",
        url: "mapbox://mapbox.terrain-rgb"
      })

    })

    mapRef.current = map

    return () => map.remove()

  }, [])

  return (
    <div style={{width:"100%",height:"100vh"}}>

      <div
        ref={mapContainer}
        style={{width:"100%",height:"100%"}}
      />

      <div style={{
        position:"absolute",
        top:20,
        left:20,
        background:"white",
        padding:12,
        borderRadius:8
      }}>

        <div>Sea Level: {seaLevel} m</div>

<input
  type="range"
  min="-5000"
  max="5000"
  step="10"
  value={seaLevel}
  onChange={(e)=>setSeaLevel(parseInt(e.target.value))}
/>

      </div>

    </div>
  )
}
