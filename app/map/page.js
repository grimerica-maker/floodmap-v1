"use client";

import { useEffect, useRef, useState } from "react";
import { useUser, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

const CONFIGURED_FLOOD_ENGINE_URL = process.env.NEXT_PUBLIC_FLOOD_ENGINE_URL;
const FLOOD_ENGINE_PROXY_PATH = "/api/engine";
const DEBUG_FLOOD = true;

const MAP_STYLE_URL = "mapbox://styles/mapbox/streets-v12";
const SATELLITE_STYLE_URL = "mapbox://styles/mapbox/satellite-streets-v12";

const FLOOD_TILE_VERSION = "204";

// ── Earthquake presets ───────────────────────────────────────────────────────
const EQ_DEPTH_TYPES = [
  { id: "shallow",      label: "Shallow Crustal",   depth: 10,  desc: "0-70km · Max surface damage" },
  { id: "subduction",   label: "Subduction Zone",   depth: 25,  desc: "15-50km · High tsunami risk" },
  { id: "intermediate", label: "Intermediate",       depth: 150, desc: "70-300km · Wide area shaking" },
  { id: "deep",         label: "Deep Slab",          depth: 450, desc: "300-700km · Felt widely, less damage" },
];

const EQ_FAULT_TYPES = [
  { id: "thrust",      label: "Thrust",      tsunami: true,  desc: "Subduction — highest tsunami risk" },
  { id: "strikeslip",  label: "Strike-slip", tsunami: false, desc: "Lateral — low tsunami risk" },
  { id: "normal",      label: "Normal",      tsunami: false, desc: "Extension — moderate risk" },
];

// Hardcoded tsunami impacts for historical presets — real data, bypasses engine
const PRESET_TSUNAMI_IMPACTS = {
  "Tohoku 2011": {
    // 15,897 dead. Rupture 500km NNE along Japan trench. Waves hit E Japan coast.
    // Ellipse along fault strike (NNE), wide enough to cover Sendai plain ~100km inland
    floodLevel: 15, major_km: 500, minor_km: 150, bearing: 203,
    impacts: [
      { lat:38.32, lng:141.55, arrival_min:10, wave_height_m:40, band_color:"#ef4444", band_label:"Extreme — 40m",  warning:"Danger", distance_km:55  },
      { lat:38.50, lng:141.48, arrival_min:12, wave_height_m:20, band_color:"#ef4444", band_label:"Extreme — 20m",  warning:"Danger", distance_km:80  },
      { lat:37.95, lng:141.10, arrival_min:18, wave_height_m:14, band_color:"#ef4444", band_label:"Extreme — 14m",  warning:"Danger", distance_km:140 },
      { lat:39.20, lng:141.90, arrival_min:15, wave_height_m:12, band_color:"#ef4444", band_label:"Extreme — 12m",  warning:"Danger", distance_km:100 },
      { lat:40.50, lng:141.95, arrival_min:22, wave_height_m:8,  band_color:"#f97316", band_label:"Severe — 8m",    warning:"Danger", distance_km:200 },
      { lat:36.50, lng:140.80, arrival_min:28, wave_height_m:6,  band_color:"#f97316", band_label:"Severe — 6m",    warning:"Danger", distance_km:250 },
      { lat:35.50, lng:140.90, arrival_min:38, wave_height_m:3,  band_color:"#fbbf24", band_label:"High — 3m",      warning:"Advisory", distance_km:370 },
      { lat:42.00, lng:140.50, arrival_min:40, wave_height_m:4,  band_color:"#fbbf24", band_label:"High — 4m",      warning:"Advisory", distance_km:350 },
      { lat:34.40, lng:136.90, arrival_min:80, wave_height_m:2,  band_color:"#4ade80", band_label:"Moderate — 2m",  warning:"Watch",  distance_km:680 },
      { lat:51.00, lng:179.00, arrival_min:220,wave_height_m:2,  band_color:"#4ade80", band_label:"Moderate — 2m",  warning:"Watch",  distance_km:3200},
      { lat:21.30, lng:-157.8, arrival_min:480,wave_height_m:1,  band_color:"#4ade80", band_label:"Moderate — 1m",  warning:"Watch",  distance_km:6200},
    ]
  },
  "Indian Ocean 2004": {
    // 227,898 dead. Rupture ran NNW along Sunda trench for 1300km.
    // Two-sided flood: India/Sri Lanka to W, Thailand to E
    // Use wide minor axis to capture both coastlines
    floodLevel: 12, major_km: 1400, minor_km: 1200, bearing: 340,
    impacts: [
      // Banda Aceh — worst hit, 30m, 15min
      { lat:5.55,  lng:95.32,  arrival_min:15,  wave_height_m:30, band_color:"#ef4444", band_label:"Extreme — 30m", warning:"Danger",   distance_km:250 },
      // North Sumatra coast
      { lat:4.20,  lng:96.10,  arrival_min:25,  wave_height_m:20, band_color:"#ef4444", band_label:"Extreme — 20m", warning:"Danger",   distance_km:180 },
      { lat:3.00,  lng:96.80,  arrival_min:35,  wave_height_m:15, band_color:"#ef4444", band_label:"Extreme — 15m", warning:"Danger",   distance_km:130 },
      // Khao Lak Thailand — 10m, 90min
      { lat:8.85,  lng:98.28,  arrival_min:90,  wave_height_m:10, band_color:"#f97316", band_label:"Severe — 10m",  warning:"Danger",   distance_km:500 },
      // Phuket Thailand — 6m, 100min
      { lat:7.88,  lng:98.30,  arrival_min:100, wave_height_m:6,  band_color:"#f97316", band_label:"Severe — 6m",   warning:"Danger",   distance_km:600 },
      // Ko Phi Phi Thailand
      { lat:7.73,  lng:98.76,  arrival_min:105, wave_height_m:8,  band_color:"#f97316", band_label:"Severe — 8m",   warning:"Danger",   distance_km:620 },
      // Sri Lanka west coast — 9m, 2hr
      { lat:6.93,  lng:79.85,  arrival_min:120, wave_height_m:9,  band_color:"#f97316", band_label:"Severe — 9m",   warning:"Danger",   distance_km:1600},
      { lat:8.57,  lng:81.22,  arrival_min:110, wave_height_m:7,  band_color:"#f97316", band_label:"Severe — 7m",   warning:"Danger",   distance_km:1500},
      // Tamil Nadu India — 5m, 2hr
      { lat:11.00, lng:79.85,  arrival_min:130, wave_height_m:5,  band_color:"#fbbf24", band_label:"High — 5m",     warning:"Advisory", distance_km:1700},
      { lat:13.10, lng:80.28,  arrival_min:140, wave_height_m:4,  band_color:"#fbbf24", band_label:"High — 4m",     warning:"Advisory", distance_km:1900},
      // Andaman Islands — 3m, 30min
      { lat:11.70, lng:92.75,  arrival_min:30,  wave_height_m:3,  band_color:"#fbbf24", band_label:"High — 3m",     warning:"Advisory", distance_km:350 },
      // Myanmar
      { lat:16.50, lng:94.50,  arrival_min:75,  wave_height_m:3,  band_color:"#fbbf24", band_label:"High — 3m",     warning:"Advisory", distance_km:600 },
      // Somalia — 3m, 7hr
      { lat:2.00,  lng:45.50,  arrival_min:420, wave_height_m:3,  band_color:"#fbbf24", band_label:"High — 3m",     warning:"Advisory", distance_km:4800},
      // Maldives
      { lat:4.17,  lng:73.51,  arrival_min:180, wave_height_m:3,  band_color:"#fbbf24", band_label:"High — 3m",     warning:"Advisory", distance_km:1900},
    ]
  },
  "Valdivia 1960": {
    // 5,700 dead. Rupture 1000km N-S along Chilean trench.
    // Ellipse along fault (N-S=5°), wide to capture Chilean coast E and Pacific W
    floodLevel: 12, major_km: 900, minor_km: 800, bearing: 5,
    impacts: [
      { lat:-38.50,lng:-73.00, arrival_min:10,  wave_height_m:25, band_color:"#ef4444", band_label:"Extreme — 25m", warning:"Danger",   distance_km:60  },
      { lat:-39.80,lng:-73.40, arrival_min:18,  wave_height_m:20, band_color:"#ef4444", band_label:"Extreme — 20m", warning:"Danger",   distance_km:200 },
      { lat:-36.60,lng:-72.90, arrival_min:20,  wave_height_m:15, band_color:"#ef4444", band_label:"Extreme — 15m", warning:"Danger",   distance_km:200 },
      { lat:-41.50,lng:-73.60, arrival_min:28,  wave_height_m:10, band_color:"#f97316", band_label:"Severe — 10m",  warning:"Danger",   distance_km:370 },
      { lat:-43.50,lng:-73.80, arrival_min:38,  wave_height_m:8,  band_color:"#f97316", band_label:"Severe — 8m",   warning:"Danger",   distance_km:560 },
      { lat:-33.50,lng:-71.60, arrival_min:55,  wave_height_m:4,  band_color:"#fbbf24", band_label:"High — 4m",     warning:"Advisory", distance_km:830 },
      // Hawaii — 10m, 15hr
      { lat:19.70, lng:-155.1, arrival_min:915, wave_height_m:10, band_color:"#f97316", band_label:"Severe — 10m",  warning:"Danger",   distance_km:10700},
      { lat:21.30, lng:-157.8, arrival_min:920, wave_height_m:9,  band_color:"#f97316", band_label:"Severe — 9m",   warning:"Danger",   distance_km:10900},
      // Japan — 6m, 22hr
      { lat:39.40, lng:141.90, arrival_min:1320,wave_height_m:6,  band_color:"#f97316", band_label:"Severe — 6m",   warning:"Danger",   distance_km:17400},
      { lat:35.10, lng:136.80, arrival_min:1310,wave_height_m:4,  band_color:"#fbbf24", band_label:"High — 4m",     warning:"Advisory", distance_km:17200},
      // Philippines — 3m
      { lat:10.30, lng:123.90, arrival_min:1200,wave_height_m:3,  band_color:"#fbbf24", band_label:"High — 3m",     warning:"Advisory", distance_km:13000},
    ]
  },
  "Cascadia (Scenario)": {
    // FEMA: 13,000 dead. Rupture 1000km N-S along Cascadia subduction zone.
    // Ellipse along fault (N-S=350°), wide E to hit coast, narrow W into Pacific
    floodLevel: 15, major_km: 900, minor_km: 300, bearing: 350,
    impacts: [
      // Oregon/Washington coast — 15-30min, no warning
      { lat:47.00, lng:-124.15,arrival_min:12,  wave_height_m:28, band_color:"#ef4444", band_label:"Extreme — 28m", warning:"Danger",   distance_km:65  },
      { lat:46.18, lng:-124.00,arrival_min:15,  wave_height_m:20, band_color:"#ef4444", band_label:"Extreme — 20m", warning:"Danger",   distance_km:140 },
      { lat:48.50, lng:-124.40,arrival_min:16,  wave_height_m:18, band_color:"#ef4444", band_label:"Extreme — 18m", warning:"Danger",   distance_km:100 },
      { lat:44.60, lng:-124.10,arrival_min:18,  wave_height_m:15, band_color:"#ef4444", band_label:"Extreme — 15m", warning:"Danger",   distance_km:290 },
      { lat:43.40, lng:-124.30,arrival_min:20,  wave_height_m:12, band_color:"#f97316", band_label:"Severe — 12m",  warning:"Danger",   distance_km:420 },
      { lat:42.00, lng:-124.40,arrival_min:22,  wave_height_m:10, band_color:"#f97316", band_label:"Severe — 10m",  warning:"Danger",   distance_km:570 },
      // Northern CA
      { lat:40.80, lng:-124.20,arrival_min:28,  wave_height_m:8,  band_color:"#f97316", band_label:"Severe — 8m",   warning:"Danger",   distance_km:750 },
      { lat:38.30, lng:-123.00,arrival_min:45,  wave_height_m:4,  band_color:"#fbbf24", band_label:"High — 4m",     warning:"Advisory", distance_km:1100},
      { lat:37.80, lng:-122.50,arrival_min:50,  wave_height_m:3,  band_color:"#fbbf24", band_label:"High — 3m",     warning:"Advisory", distance_km:1250},
      // Canada
      { lat:49.00, lng:-126.50,arrival_min:18,  wave_height_m:15, band_color:"#ef4444", band_label:"Extreme — 15m", warning:"Danger",   distance_km:170 },
      // Hawaii
      { lat:21.30, lng:-157.80,arrival_min:330, wave_height_m:3,  band_color:"#fbbf24", band_label:"High — 3m",     warning:"Advisory", distance_km:4200},
      // Japan
      { lat:35.70, lng:139.70, arrival_min:590, wave_height_m:2,  band_color:"#4ade80", band_label:"Moderate — 2m", warning:"Watch",    distance_km:8100},
    ]
  }
};

const EQ_PRESETS = [
  { label: "Tohoku 2011", lat: 38.297, lng: 142.373, mag: 9.1, depthId: "subduction", faultId: "thrust",
    strike: 203, dip: 10, rake: 88, depth_km: 25,
    desc: "M9.1 — 15,897 dead, Fukushima meltdown, 40m tsunami",
    wiki: "<h4>Tōhoku 2011 — M9.1</h4><p>March 11, 2011. Japan's most powerful earthquake, triggering a 40m tsunami that destroyed coastal towns and caused three Fukushima Daiichi reactor meltdowns. 15,897 confirmed dead, 2,533 missing. $235B in damages. Shifted Earth's axis by 10-25cm and moved Japan's main island 2.4m east.</p>" },
  { label: "Haiti 2010", lat: 18.457, lng: -72.533, mag: 7.0, depthId: "shallow", faultId: "strikeslip",
    strike: 255, dip: 70, rake: 0, depth_km: 13,
    desc: "M7.0 — 316,000 dead, Port-au-Prince destroyed",
    wiki: "<h4>Haiti 2010 — M7.0</h4><p>January 12, 2010. Shallow strike-slip quake 25km from Port-au-Prince. 316,000 dead, 300,000 injured, 1.5M displaced. 250,000 residences destroyed. Haiti's catastrophic losses attributed to shallow depth, proximity to capital, poor construction standards, and dense population.</p>" },
  { label: "Indian Ocean 2004", lat: 3.295, lng: 95.982, mag: 9.1, depthId: "subduction", faultId: "thrust",
    strike: 329, dip: 8, rake: 110, depth_km: 30,
    desc: "M9.1 — 227,898 dead, Thailand/Indonesia/Sri Lanka",
    wiki: "<h4>Indian Ocean 2004 — M9.1</h4><p>December 26, 2004. Third largest earthquake ever recorded. Subduction quake off Sumatra ruptured 1,300km of fault in 10 minutes. Triggered tsunamis reaching 30m hitting 14 countries. 227,898 dead across Indonesia, Sri Lanka, India, Thailand. Waves reached Africa 7 hours later.</p>" },
  { label: "Valdivia 1960", lat: -38.14, lng: -73.41, mag: 9.5, depthId: "subduction", faultId: "thrust",
    strike: 5, dip: 15, rake: 90, depth_km: 25,
    desc: "M9.5 — Largest ever recorded, 5,700 dead, Chile",
    wiki: "<h4>Valdivia 1960 — M9.5</h4><p>May 22, 1960. Largest earthquake ever recorded in human history. Ruptured 1,000km of Nazca-South American plate boundary. 5,700 dead in Chile, tsunami killed 61 in Hawaii, 122 in Japan, 32 in Philippines. Released more energy than all earthquakes combined from 1906-1960.</p>" },
  { label: "San Andreas (Scenario)", lat: 34.05, lng: -118.25, mag: 7.8, depthId: "shallow", faultId: "strikeslip",
    strike: 140, dip: 90, rake: 180, depth_km: 10,
    desc: "M7.8 scenario — ShakeOut: 1,800 dead, $200B damage, LA",
    wiki: "<h4>San Andreas Scenario — M7.8</h4><p>USGS ShakeOut scenario: a M7.8 rupture of the southern San Andreas fault near Los Angeles. Estimated 1,800 deaths, 53,000 injuries, $200B in damage. 300,000 displaced. Fire following earthquake could double casualties. Last major rupture in this segment was 1857 (M7.9).</p>" },
  { label: "Cascadia (Scenario)", lat: 47.60, lng: -124.0, mag: 9.0, depthId: "subduction", faultId: "thrust",
    strike: 350, dip: 12, rake: 90, depth_km: 20,
    desc: "M9.0 scenario — Pacific Northwest megathrust overdue",
    wiki: "<h4>Cascadia Scenario — M9.0</h4><p>The Cascadia Subduction Zone last ruptured January 26, 1700 (confirmed by Japanese tsunami records). A full M9.0 rupture would devastate Seattle, Portland, and coastal Oregon/Washington. FEMA estimates 13,000 dead, 27,000 injured, $82B damage — with coastal areas having 15-50 minutes before tsunami arrival.</p>" },
];

// Mercalli intensity ring radii — Atkinson & Wald (2007) attenuation
// Matches backend tsunami_engine.py intensity_rings()
function eqIntensityRings(mag, depthKm, faultId) {
  // Calibrated to USGS ShakeMap observations for historical events
  // M9.1 Tohoku: X+~60km, IX~110km, VIII~200km, VII~350km, VI~600km, V~1000km
  // M7.0 Haiti:  X+~6km,  IX~11km,  VIII~19km,  VII~33km,  VI~57km,  V~100km
  const depth = Math.max(depthKm, 5);
  const sourceMmi = 2.085 + 1.428 * mag;
  // Max radius caps per MMI zone (km) — prevents globe-spanning rings
  const caps = { 10: 100, 9: 200, 8: 400, 7: 700, 6: 1200, 5: 2000 };
  const RINGS = [
    { intensity:"X+",  label:"Extreme",     pga:">124%g",   color:"#7f1d1d", opacity:0.85, mmi:10 },
    { intensity:"IX",  label:"Violent",     pga:"62-124%g", color:"#b91c1c", opacity:0.72, mmi:9  },
    { intensity:"VIII",label:"Severe",      pga:"31-62%g",  color:"#dc2626", opacity:0.58, mmi:8  },
    { intensity:"VII", label:"Very Strong", pga:"15-31%g",  color:"#ea580c", opacity:0.42, mmi:7  },
    { intensity:"VI",  label:"Strong",      pga:"8-15%g",   color:"#f97316", opacity:0.28, mmi:6  },
    { intensity:"V",   label:"Moderate",    pga:"4-8%g",    color:"#ca8a04", opacity:0.18, mmi:5  },
  ];
  return RINGS.map(r => {
    if (sourceMmi < r.mmi) return { ...r, radiusKm: 0 };
    const exponent = (sourceMmi - r.mmi) / 1.8;
    const R = Math.min(depth * Math.exp(exponent) * 0.15, caps[r.mmi]);
    return { ...r, radiusKm: Math.max(0, R) };
  }).filter(r => r.radiusKm > 0);
}

// Casualties — PAGER-style range (Jaiswal & Wald 2010)
function eqCasualtyEstimate(mag, depthKm) {
  if (mag < 4.5) return "< 1";
  const logF = 1.47 * mag - 0.6 * Math.log10(Math.max(depthKm, 5)) - 7.0;
  let median = Math.pow(10, logF);
  if (depthKm > 200) median *= 0.05;
  else if (depthKm > 70) median *= 0.25;
  const lo = Math.round(median * 0.01);
  const hi = Math.round(median * 100);
  const fmt = n => {
    if (n < 1) return "< 1";
    if (n < 1000) return "~" + Math.round(n / 10) * 10;
    if (n < 1000000) return "~" + Math.round(n / 1000) + "K";
    return "~" + (n / 1000000).toFixed(1) + "M";
  };
  return fmt(lo) + " – " + fmt(hi);
}

// Build circle GeoJSON for intensity ring
function eqRingGeoJSON(lat, lng, radiusKm, steps = 64) {
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const dLat = (radiusKm * Math.cos(angle)) / 111.32;
    const dLng = (radiusKm * Math.sin(angle)) / (111.32 * Math.cos(lat * Math.PI / 180));
    coords.push([lng + dLng, lat + dLat]);
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} };
}

// Liquefaction risk — high in coastal/river deltas at VI+ shaking
// Approximated by elevation proxy: < 10m elevation = high liquefaction risk
function eqLiquefactionRadius(mag, depthKm) {
  // Liquefaction is near-field only — M7=~8km, M8=~27km, M9=~44km, hard cap 150km
  if (mag < 5.5) return 0;
  const raw = Math.pow(10, 0.35 * mag - 1.5) * Math.max(0.2, 1 - depthKm / 300);
  return Math.min(raw, 150);
}

// ── Scenario wiki content ────────────────────────────────────────────────────
const SCENARIO_WIKI = {
  impact: {
    title: "Meteor Impact", icon: "🌑",
    body: `<h3>Meteor Impact Physics</h3><p>When a meteorite strikes Earth, it releases energy orders of magnitude greater than nuclear weapons. A 1km asteroid delivers ~10,000 megatons — equivalent to all nuclear arsenals combined.</p><h4>Key Events</h4><ul><li><strong>Chicxulub (66 Ma)</strong> — ~10km impactor, triggered mass extinction, 180km crater beneath Yucatán</li><li><strong>Tunguska (1908)</strong> — ~50m asteroid airburst, flattened 2,000 km² of Siberian forest</li><li><strong>Younger Dryas (12,900 BP)</strong> — Proposed ~100m cometary cluster impact over Laurentide ice sheet</li><li><strong>Barringer Crater (50,000 BP)</strong> — ~50m iron meteorite, 1.2km crater, Arizona</li></ul><h4>Impact Zones</h4><p>Fireball → overpressure → thermal radiation → seismic → tsunami. Each zone grows with yield. A 1km impactor creates a fireball visible from 500km.</p>`,
  },
  nuke: {
    title: "Nuclear Detonation", icon: "☢️",
    body: `<h3>Nuclear Weapons Effects</h3><p>Nuclear weapons release energy through fission and fusion. Effects scale with yield and burst height.</p><h4>Yield Comparison</h4><ul><li><strong>Little Boy (Hiroshima)</strong> — 15 kt, 140,000 deaths, 1.6km fireball radius</li><li><strong>Castle Bravo (1954)</strong> — 15 Mt, largest US test, 7km fireball radius</li><li><strong>Tsar Bomba (1961)</strong> — 50 Mt, largest ever detonated, 3.5km fireball</li><li><strong>Modern W87</strong> — 300 kt standard US ICBM warhead</li></ul><h4>Effect Zones</h4><p>Fireball → prompt radiation → overpressure → thermal → fallout. Airburst maximizes blast radius. Nuclear winter possible above ~100 warheads targeting cities.</p>`,
  },
  yellowstone: {
    title: "Super Volcano", icon: "🌋",
    body: `<h3>Supervolcano Eruptions</h3><p>Supervolcanoes (VEI 8+) eject over 1,000 km³ of material, causing global cooling, crop failure, and mass casualties.</p><h4>Major Caldera Systems</h4><ul><li><strong>Yellowstone</strong> — Last eruption 640,000 BP (VEI 8). Ash would blanket North America.</li><li><strong>Toba (74,000 BP)</strong> — VEI 8, possibly caused human population bottleneck. ~6 years of volcanic winter.</li><li><strong>Campi Flegrei</strong> — Active Italian caldera near Naples. Last major eruption 39,000 BP.</li></ul><h4>Global Effects</h4><p>SO₂ injection into stratosphere → volcanic winter → 1-3°C global cooling lasting years. Agriculture collapse within months.</p>`,
  },
  tsunami: {
    title: "Mega-Tsunami", icon: "🌊",
    body: `<h3>Mega-Tsunami Formation</h3><p>Mega-tsunamis are caused by massive landslides, volcanic flank collapses, or asteroid ocean impacts — generating waves 10-100x larger than tectonic tsunamis.</p><h4>Historical Events</h4><ul><li><strong>Lituya Bay 1958</strong> — Largest recorded: 524m runup wave from rockslide. Alaska.</li><li><strong>Storegga Slide (8,150 BP)</strong> — Norwegian shelf collapse, 20m waves hit Britain, may have severed Doggerland.</li><li><strong>La Palma risk</strong> — Cumbre Vieja flank collapse could generate 25m Atlantic waves reaching Americas in 8 hours.</li></ul><h4>Ocean Impact Tsunamis</h4><p>A 1km asteroid striking ocean generates 300m+ wave at impact, 10m+ across ocean basins. Amplifies in coastal shallows.</p>`,
  },
  cataclysm: {
    title: "Pole Shift / Cataclysm", icon: "☄️",
    body: `<h3>Crustal Displacement & Pole Shift</h3><p>Catastrophist theories propose periodic rapid displacement of Earth's lithosphere, shifting geographic poles and triggering global flooding and mass extinctions.</p><h4>Key Models</h4><ul><li><strong>Ben Davidson / Suspicious Observers</strong> — Micronova hypothesis: solar plasma event triggers geomagnetic excursion and crustal shift. New pole: Bay of Bengal.</li><li><strong>ECDO Theory (Ethical Skeptic)</strong> — Earth's crust decouples from mantle along asthenosphere. Rotational momentum imbalance.</li><li><strong>Charles Hapgood (1958)</strong> — Original crustal displacement theory, supported by Einstein.</li></ul><h4>Evidence Cited</h4><p>Megafauna flash-freezing, tropical species in Arctic sediments, Younger Dryas impact evidence, ancient maps showing ice-free Antarctica.</p>`,
  },
  ydi: {
    title: "Younger Dryas Impact", icon: "☄️",
    body: `<h3>Younger Dryas Impact Hypothesis</h3><p>At ~12,900 BP, a cometary or asteroidal cluster impact/airburst over the Laurentide Ice Sheet triggered rapid climate change, megafaunal extinction, and Clovis culture collapse.</p><h4>Key Evidence</h4><ul><li><strong>Platinum/Iridium spike</strong> — Impact markers found across 4 continents at YDB</li><li><strong>Nanodiamond layer</strong> — Shock-formed nanodiamonds in YDB sediments</li><li><strong>Columbia Scablands</strong> — Catastrophic flooding carved Washington State's channeled scablands</li><li><strong>Carolina Bays</strong> — Elliptical depressions across eastern US, possibly secondary ejecta craters</li><li><strong>Mammoth extinction</strong> — Population collapses align with YDB</li></ul><h4>Flood Corridors</h4><p>Lake Agassiz drainage triggered massive freshwater pulses into Atlantic, disrupting thermohaline circulation and causing rapid cooling within decades.</p>`,
  },
};

// ── Storm surge presets (NOAA SLOSH parameterization) ────────────────────────
const SURGE_PRESETS = [
  { id: "ts",   label: "T.Storm", height: 1.0, reach: 25000,  color: "#16a34a", wind_kmh: "63–118",  wind_mph: "39–73",  example: "Tropical Storm Allison (2001) — $9B damage, 41 deaths, Houston flooding" },
  { id: "cat1", label: "Cat 1",   height: 2.0, reach: 45000,  color: "#ca8a04", wind_kmh: "119–153", wind_mph: "74–95",  example: "Hurricane Sandy (2012) — Cat 1 at landfall, $65B damage, 13ft NYC surge" },
  { id: "cat2", label: "Cat 2",   height: 3.0, reach: 65000,  color: "#ea580c", wind_kmh: "154–177", wind_mph: "96–110", example: "Hurricane Ike (2008) — Cat 2, 20ft surge, Galveston devastated, $38B damage" },
  { id: "cat3", label: "Cat 3",   height: 4.5, reach: 90000,  color: "#dc2626", wind_kmh: "178–208", wind_mph: "111–129",example: "Hurricane Katrina (2005) — Cat 3 at landfall, 28ft surge, 1,833 deaths, $186B" },
  { id: "cat4", label: "Cat 4",   height: 6.0, reach: 120000, color: "#b91c1c", wind_kmh: "209–251", wind_mph: "130–156",example: "Hurricane Harvey (2017) — Cat 4, 60 inches rain, $125B, Houston inundated" },
  { id: "cat5", label: "Cat 5",   height: 9.0, reach: 180000, color: "#7f1d1d", wind_kmh: "252+",    wind_mph: "157+",   example: "Hurricane Dorian (2019) — Cat 5, 185mph winds, 23ft surge, Bahamas destroyed" },
];
const SURGE_SOURCE = "dm-surge-source";
const SURGE_LAYER  = "dm-surge-layer";
const FLOOD_SOURCE_ID = "flood-source";
const FLOOD_LAYER_ID = "flood-layer";

const IMPACT_SOURCE_ID = "impact-point-source";
const IMPACT_LAYER_ID = "impact-point-layer";
const IMPACT_PREVIEW_SOURCE_ID = "impact-preview-source";
const IMPACT_CRATER_LAYER_ID = "impact-crater-layer";
const IMPACT_BLAST_LAYER_ID = "impact-blast-layer";
const IMPACT_THERMAL_LAYER_ID = "impact-thermal-layer";


const FRONTEND_BUILD_LABEL = "v250";

// ── Tier config ──────────────────────────────────────────────────────────────
const FREE_SIM_PER_HOUR = 30;
const FREE_SIM_PER_DAY  = 30;
const PRO_SIM_PER_HOUR  = 50;
const PRO_SIM_PER_DAY   = 200;

// ── Paywall limits ────────────────────────────────────────────────────────────
const FREE_MAX_IMPACT_DIAMETER = 5000;   // metres
const PRO_MAX_IMPACT_DIAMETER  = 20000;
const FREE_MAX_NUKE_YIELD_KT   = 1000;   // kt  (= 1 Mt)
const PRO_MAX_NUKE_YIELD_KT    = 100000; // kt  (= 100 Mt)

// ── Rate limit helpers (localStorage) ────────────────────────────────────────
const RL_KEY = "dm_rl";
const getRLData = () => {
  try {
    const d = JSON.parse(localStorage.getItem(RL_KEY) || "{}");
    const nowH = Math.floor(Date.now() / 3600000);
    const nowD = Math.floor(Date.now() / 86400000);
    if (d.hour !== nowH) { d.hour = nowH; d.hourCount = 0; }
    if (d.day  !== nowD) { d.day  = nowD; d.dayCount  = 0; }
    return d;
  } catch { return { hour: 0, hourCount: 0, day: 0, dayCount: 0 }; }
};
const saveRLData = (d) => { try { localStorage.setItem(RL_KEY, JSON.stringify(d)); } catch {} };
const checkAndIncrementRL = (isPro) => {
  const d = getRLData();
  const maxH = isPro ? PRO_SIM_PER_HOUR : FREE_SIM_PER_HOUR;
  const maxD = isPro ? PRO_SIM_PER_DAY  : FREE_SIM_PER_DAY;
  if (d.dayCount  >= maxD) return { allowed: false, reason: `day`,  limit: maxD };
  d.hourCount += 1;
  d.dayCount  += 1;
  saveRLData(d);
  return { allowed: true };
};
const getRLStatus = () => {
  const d = getRLData();
  return { hourCount: d.hourCount || 0, dayCount: d.dayCount || 0 };
};

// ── Pro token check (localStorage — replaced by real auth later) ──────────────
const getProTier = () => {
  try { return localStorage.getItem("dm_pro_tier") || "free"; } catch { return "free"; }
};
const LOGO_DATA = "data:image/png;base64,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";

const EXTINCTION_WAVE_HEIGHT_M = 1500;

const PRESETS = [
  { label: "Ice Age", value: -120 },
  { label: "Modern", value: 0 },
  { label: "All Ice Melted", value: 70 },
  { label: "Biblical Flood", value: 3048 },
  { label: "Fully Drained", value: -11000 },
];

// Real Last Glacial Maximum ice sheet extents as lat/lng polygons
// Sources: Dyke et al. 2002, Ehlers & Gibbard 2004, Hughes et al. 2016
// Each sheet is a closed polygon following the actual glaciological margin
const ICE_SHEET_ZONES = [
  {
    name: "Laurentide Ice Sheet",
    color: "#bfdbfe",
    coords: [
      // Southern margin — follows Missouri & Ohio rivers, then up Atlantic seaboard
      [-76.5, 43.0],  // Finger Lakes / upstate NY
      [-79.0, 42.5],  // Lake Erie south shore
      [-82.5, 41.5],  // NW Ohio
      [-85.5, 41.5],  // Indiana/Ohio border
      [-87.5, 41.8],  // Chicago area
      [-90.0, 42.5],  // Wisconsin
      [-93.0, 43.5],  // Minnesota
      [-96.5, 45.0],  // N Dakota border
      [-99.5, 46.5],  // N Dakota
      [-102.0, 47.5], // N Dakota/Montana
      [-106.0, 48.5], // Montana
      [-109.0, 49.0], // Montana/Alberta border
      [-112.0, 49.0], // Alberta south — ice-free corridor starts here
      // Ice-free corridor indent (Mackenzie Corridor)
      [-113.5, 51.0], [-113.0, 53.5], [-113.5, 56.0], [-116.0, 58.0],
      [-118.0, 59.5], [-120.0, 61.0],
      // Arctic extent — follows actual northern coastline
      [-125.0, 63.0], [-130.0, 65.0], [-135.0, 68.0], [-130.0, 70.0],
      [-120.0, 72.0], [-105.0, 73.0], [-90.0, 73.5],  [-80.0, 74.0],
      [-72.0, 74.5],  [-65.0, 73.0],  [-60.0, 70.0],  [-57.0, 65.0],
      // Eastern margin — down Atlantic seaboard
      [-59.0, 60.0],  [-63.0, 57.0],  [-66.0, 52.0],
      [-69.0, 48.0],  [-71.0, 46.0],  [-73.5, 44.5],
      [-76.5, 43.0],  // close
    ]
  },
  {
    name: "Cordilleran Ice Sheet",
    color: "#bfdbfe",
    coords: [
      [-113.5, 49.0],  // BC/Alberta border — eastern limit
      [-115.0, 48.0],  // N Idaho
      [-117.0, 47.0],  // Washington state
      [-119.5, 46.5],  // Central Washington
      [-121.0, 45.5],  // Columbia River
      [-122.0, 45.0],  // Portland — southern limit
      [-123.5, 45.5],  // Oregon coast
      [-124.0, 47.0],  // Olympic Peninsula
      [-123.5, 48.5],  // Puget Sound
      [-124.0, 50.0],  // Vancouver Island north
      [-125.0, 52.0],  // BC coast
      [-127.0, 54.0],  // BC north coast
      [-129.0, 56.0],  // SE Alaska
      [-132.0, 57.5],  [-135.0, 59.0], [-138.0, 60.5], [-141.0, 61.5],
      [-140.0, 63.0],  [-136.0, 63.5], [-133.0, 62.5], [-129.0, 61.0],
      [-125.0, 60.0],  [-121.0, 59.0], [-118.0, 57.5],
      [-116.0, 55.5],  [-114.5, 53.0], [-113.5, 51.0],
      [-113.5, 49.0],  // close
    ]
  },
  {
    name: "Fennoscandian Ice Sheet",
    color: "#bfdbfe",
    coords: [
      // Southern margin — N Germany / Poland lobes
      [8.0,  54.0], [10.0, 53.5], [13.0, 53.0], [16.0, 52.5],
      [19.0, 52.0], [22.0, 52.5], [25.0, 53.0], [27.0, 53.5],
      [30.0, 55.0], [32.0, 57.0], [34.0, 59.0],
      // Eastern extent — Russia
      [36.0, 61.0], [38.0, 63.0], [42.0, 65.0],
      [48.0, 66.5], [55.0, 68.0], [60.0, 68.5],
      // Northern tip — Arctic Ocean
      [65.0, 70.0], [60.0, 71.0], [50.0, 71.5],
      [30.0, 71.0], [15.0, 71.0], [5.0, 70.5],
      // Western extent — North Sea, Scotland
      [0.0,  68.0], [-2.0, 65.0], [-2.0, 62.0],
      [2.0,  58.0], [5.0,  56.0], [8.0,  54.0], // close
    ]
  },
  {
    name: "British-Irish Ice Sheet",
    color: "#bfdbfe",
    // Two separate polygons — Great Britain and Ireland
    rings: [
      // Great Britain (main island)
      [
        [-2.0,  51.5], [-3.5,  51.5], [-5.0,  51.7], [-5.5,  52.0],
        [-4.5,  52.5], [-3.5,  53.0], [-3.0,  53.5],
        [-2.0,  53.8], [-1.5,  54.5],
        [-2.0,  55.0], [-3.0,  55.5], [-4.5,  56.0],
        [-5.0,  57.5], [-5.5,  58.5], [-4.5,  59.0],
        [-3.5,  59.5], [-1.5,  60.0],
        [0.0,   59.5], [0.5,   58.5],
        [-0.5,  57.5], [0.0,   56.5], [0.0,   55.5],
        [-1.0,  54.5], [-0.5,  53.5], [-0.5,  52.5],
        [-1.0,  52.0], [-2.0,  51.5],
      ],
      // Ireland
      [
        [-10.0, 51.5], [-10.5, 52.5], [-10.0, 53.5],
        [-9.5,  54.5], [-8.0,  55.5], [-7.0,  56.0],
        [-6.0,  55.5], [-6.0,  54.5], [-7.0,  53.5],
        [-8.0,  52.5], [-9.0,  52.0], [-10.0, 51.5],
      ],
    ],
    // coords alias points to first ring for centroid calc
    get coords() { return this.rings[0]; },
  },
  {
    name: "Barents-Kara Ice Sheet",
    color: "#bfdbfe",
    coords: [
      [30.0, 68.0], [35.0, 67.0], [40.0, 67.5], [45.0, 68.0],
      [50.0, 68.5], [55.0, 69.5], [60.0, 70.0], [65.0, 71.0],
      [70.0, 72.0], [75.0, 73.0], [80.0, 74.5],
      [85.0, 76.0], [80.0, 78.0], [70.0, 79.0],
      [55.0, 80.0], [40.0, 79.0], [25.0, 78.0],
      [15.0, 76.0], [15.0, 74.0], [20.0, 72.0],
      [25.0, 70.5], [28.0, 69.0], [30.0, 68.0], // close
    ]
  },
  {
    name: "Greenland Ice Sheet",
    color: "#e0f2fe",
    coords: [
      // Extended LGM margin — slightly beyond modern ice sheet
      [-52.0, 60.0], [-46.0, 59.5], [-42.0, 60.5], [-38.0, 62.0],
      [-32.0, 63.5], [-26.0, 65.0], [-20.0, 66.5], [-17.0, 68.0],
      [-18.0, 70.0], [-20.0, 72.0], [-22.0, 75.0], [-26.0, 77.0],
      [-30.0, 78.5], [-35.0, 80.0], [-42.0, 81.5], [-52.0, 82.5],
      [-62.0, 82.5], [-68.0, 81.0], [-70.0, 79.0], [-68.0, 77.0],
      [-64.0, 75.0], [-60.0, 73.0], [-58.0, 71.0], [-56.0, 68.5],
      [-54.0, 65.5], [-52.0, 63.0], [-52.0, 60.0], // close
    ]
  },
  {
    name: "Patagonian Ice Sheet",
    color: "#bfdbfe",
    coords: [
      // Real southern South American glaciation
      [-66.0, -39.0], [-68.0, -40.0], [-70.0, -41.0], [-72.0, -42.0],
      [-73.0, -43.5], [-73.5, -45.0], [-74.0, -47.0], [-74.5, -49.0],
      [-75.0, -51.0], [-75.5, -53.0], [-76.0, -55.0],
      [-68.0, -55.5], [-66.0, -54.5], [-65.0, -53.0],
      [-65.5, -51.0], [-66.0, -49.0], [-66.5, -47.0],
      [-66.0, -45.0], [-65.5, -43.0], [-65.0, -41.0],
      [-65.5, -39.5], [-66.0, -39.0], // close
    ]
  },
  {
    name: "Antarctic Ice Sheet (Extended)",
    color: "#e0f2fe",
    coords: (() => {
      // Full LGM Antarctic extent — approximately 10% larger radius than modern
      const pts = [];
      const steps = 72;
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        // Vary radius by sector to approximate actual LGM grounding line
        const baseR = 18.0; // degrees from pole
        const r = baseR + Math.sin(angle * 3) * 2.5 + Math.cos(angle * 2) * 1.5;
        const lng = (angle * 180 / Math.PI);
        const lat = -90 + r;
        pts.push([((lng + 180) % 360) - 180, lat]);
      }
      return pts;
    })()
  },
];

const ICE_SHEET_SOURCE = "ice-sheet-source";
const ICE_SHEET_PREFIX = "ice-sheet-zone";

// ── Younger Dryas Impact flood scenario ────────────────────────────────────
const YDI_SOURCE_NODES = [
  { id: "bc",      name: "Cordilleran Ice Dam\n(Nechako / Prince George)", lat: 53.9,  lng: -122.7, reachM: 850000  },
  { id: "nipigon", name: "Laurentide Collapse\n(Lake Nipigon)",            lat: 49.7,  lng: -88.3,  reachM: 700000  },
  { id: "stjean",  name: "Eastern Outlet\n(Lac Saint-Jean)",               lat: 48.6,  lng: -72.0,  reachM: 550000  },
  { id: "columbia",name: "Columbia Mouth\n(Pacific Discharge)",            lat: 46.2,  lng: -123.9, reachM: 320000  },
];
// YDI flood corridors — traced from Carlson/Kennett Younger Dryas flood reconstruction
// Each corridor is a centerline with width_deg that gets buffered into a polygon
// Low = main channels, Medium = widened + tributaries, High = full basin sheet flow
const YDI_FLOOD_CORRIDORS = {
  // LOW — main channels only, following existing river valleys precisely
  low: {
    opacity: 0.82,
    features: [
      // Columbia River Gorge — real channel through Cascade Mountains
      { name: "Columbia River Gorge", flow_km3: 8400, dissipation: "Drains west through Cascades to Pacific — Columbia Bar discharge ~180,000 m³/s peak", width: 1.2, coords: [
        [-117.4, 47.7], [-118.0, 47.2], [-118.5, 46.8], [-119.0, 46.4],
        [-119.1, 46.2], [-119.3, 45.9], [-119.7, 45.7], [-120.2, 45.7],
        [-120.7, 45.7], [-121.2, 45.7], [-121.5, 45.7], [-121.9, 45.6],
        [-122.3, 45.6], [-122.7, 45.5], [-123.1, 46.1], [-123.8, 46.2],
      ]},
      // Channeled Scablands — real flood channels across eastern Washington
      { name: "Channeled Scablands", flow_km3: 12000, dissipation: "Multiple simultaneous flood channels carved through basalt — converges on Columbia River at Pasco Basin", width: 1.4, coords: [
        [-117.5, 47.8], [-117.8, 47.4], [-118.2, 47.0], [-118.6, 46.7],
        [-118.9, 46.4], [-119.1, 46.2],
      ]},
      // Mississippi River — follows actual river course
      { name: "Upper Mississippi", flow_km3: 9200, dissipation: "Flows south along existing Mississippi valley — peak discharge ~150,000 m³/s, dissipates into Gulf of Mexico", width: 1.8, coords: [
        [-93.1, 44.9], [-92.8, 44.3], [-91.5, 43.5], [-91.1, 42.5],
        [-90.6, 41.6], [-90.2, 40.6], [-89.9, 39.7], [-89.6, 38.9],
        [-89.1, 37.1], [-89.2, 36.5], [-89.5, 35.9], [-89.8, 35.1],
        [-90.4, 34.2], [-91.1, 33.2], [-91.5, 32.3], [-91.4, 31.2],
        [-91.2, 30.4], [-89.9, 29.3],
      ]},
      // Finger Lakes drainage — Seneca/Cayuga drain east via Mohawk to Hudson
      { name: "Finger Lakes Outlet", flow_km3: 1800, dissipation: "Seneca and Cayuga Lakes overflow east through Mohawk Valley — joins Hudson River at Troy, drains to Atlantic.", width: 0.8, coords: [
        [-76.8, 42.7], [-76.2, 43.0], [-75.5, 43.1], [-74.8, 43.0],
        [-74.2, 42.9], [-73.7, 42.7], [-73.7, 42.5], [-73.8, 42.0],
        [-73.9, 41.5], [-74.0, 41.0], [-74.0, 40.7],
      ]},
      // St Lawrence — follows real valley
      { name: "St Lawrence Outlet", flow_km3: 6800, dissipation: "Drains east through St Lawrence valley — peak discharge ~80,000 m³/s, dissipates into N Atlantic", width: 1.4, coords: [
        [-79.1, 43.3], [-77.5, 43.0], [-76.5, 43.1], [-75.5, 43.5],
        [-74.5, 43.8], [-74.0, 44.5], [-73.8, 45.5], [-73.5, 46.5],
        [-72.5, 46.8], [-71.2, 46.8], [-69.5, 47.4],
        [-67.5, 47.9], [-65.5, 48.4], [-64.0, 48.8], [-62.5, 48.5], [-61.5, 47.3],
      ]},
    ]
  },

  // MEDIUM — corridors widen + Missouri, Ohio, Great Lakes added
  medium: {
    opacity: 0.86,
    features: [
      // Columbia system wider
      { name: "Columbia River System", flow_km3: 18000, dissipation: "Catastrophic flood pulse through Columbia Gorge — estimated 40x modern peak discharge. Pacific plume extended 300km offshore.", width: 2.6, coords: [
        [-117.4, 47.7], [-117.8, 47.3], [-118.3, 46.9], [-118.8, 46.5],
        [-119.1, 46.2], [-119.3, 45.9], [-119.7, 45.7], [-120.2, 45.7],
        [-120.8, 45.7], [-121.3, 45.7], [-121.7, 45.7], [-122.0, 45.6],
        [-122.3, 45.6], [-122.7, 45.5], [-123.1, 46.1], [-123.9, 46.2],
      ]},
      // Willamette Valley backflood — real Lake Allison extent
      { name: "Willamette Backflood", flow_km3: 3200, dissipation: "Columbia backflood into Willamette Valley — ancient Lake Allison. Water ponded to ~120m elevation before draining south.", width: 1.6, coords: [
        [-122.7, 45.5], [-123.0, 45.1], [-123.1, 44.6],
        [-123.1, 44.1], [-122.9, 43.8], [-122.6, 43.4],
      ]},
      // Missouri River — follows actual river course from Montana to confluence
      { name: "Missouri River Corridor", flow_km3: 14500, dissipation: "Drains southeast along Missouri valley into Mississippi — peak discharge ~200,000 m³/s. Sediment load turned Gulf of Mexico turbid for years.", width: 2.0, coords: [
        [-112.5, 47.5], [-111.5, 47.2], [-110.5, 47.8], [-109.5, 47.5],
        [-107.0, 47.8], [-106.0, 47.6], [-104.0, 47.1], [-101.8, 46.9],
        [-100.4, 46.9], [-99.3, 46.4], [-98.0, 46.0], [-97.4, 46.9],
        [-97.5, 46.0], [-96.8, 46.9], [-96.7, 46.2], [-96.5, 46.0],
        [-96.8, 45.6], [-98.0, 44.5], [-99.3, 43.5], [-100.4, 43.7],
        [-101.2, 42.9], [-99.3, 41.5], [-97.5, 41.2], [-96.8, 41.2],
        [-96.2, 41.5], [-95.9, 41.3], [-95.7, 40.6], [-95.5, 39.9],
        [-94.9, 39.3], [-94.6, 39.1], [-94.0, 39.0], [-93.4, 39.1],
        [-93.0, 39.1], [-92.5, 38.8], [-91.7, 38.8],
      ]},
      // Mississippi wider
      { name: "Lower Mississippi / Gulf", flow_km3: 22000, dissipation: "Combined Missouri + Upper Mississippi discharge — peak ~400,000 m³/s. Gulf of Mexico freshwater cap suppressed thermohaline circulation, triggering Younger Dryas cooling.", width: 2.6, coords: [
        [-93.1, 44.9], [-92.8, 44.3], [-91.5, 43.5], [-91.1, 42.5],
        [-90.6, 41.6], [-90.4, 40.5], [-90.0, 39.5], [-89.6, 38.5],
        [-89.1, 37.1], [-89.5, 36.0], [-89.8, 35.1],
        [-90.4, 34.2], [-91.1, 33.2], [-91.5, 32.3], [-91.4, 31.2],
        [-91.2, 30.4], [-90.0, 29.5], [-89.2, 29.2],
      ]},
      // Ohio River — follows real valley
      { name: "Ohio River Overflow", flow_km3: 4100, dissipation: "Proglacial lakes drained SW through Ohio valley. Joined Mississippi above Cairo IL.", width: 1.4, coords: [
        [-80.5, 40.6], [-81.5, 40.4], [-82.9, 40.4], [-84.2, 39.1],
        [-85.2, 38.8], [-86.8, 37.9], [-87.5, 37.8], [-88.1, 37.2],
        [-88.7, 37.1], [-89.1, 37.1],
      ]},
      // Missouri → Mississippi confluence connector
      { name: "Missouri-Mississippi Confluence", flow_km3: 5200, dissipation: "Missouri joins Mississippi at St Louis — combined flow overwhelms valley, backflooding both banks for 100km.", width: 1.6, coords: [
        [-91.7, 38.8], [-91.4, 38.6], [-91.1, 38.3], [-90.8, 38.0],
        [-90.5, 37.8], [-90.2, 37.5], [-89.8, 37.2], [-89.1, 37.1],
      ]},
      // Pennsylvania / Appalachian overflow — connects Ohio east toward Atlantic
      { name: "Appalachian Overflow", flow_km3: 2800, dissipation: "Proglacial lake overflow across low Appalachian gaps — Potomac, Susquehanna, Delaware all at flood stage simultaneously.", width: 1.2, coords: [
        [-80.5, 40.6], [-79.5, 40.4], [-78.5, 40.2], [-77.5, 40.3],
        [-77.0, 40.0], [-76.5, 39.8], [-76.2, 39.5], [-75.8, 39.2],
        [-75.5, 38.8], [-75.2, 38.5],
      ]},
      // Chicago outlet — Great Lakes drain SW into Illinois River
      { name: "Chicago Outlet", flow_km3: 3100, dissipation: "Lake Michigan overflow through Chicago outlet into Illinois River — ancient drainage route reactivated at peak meltwater discharge.", width: 1.4, coords: [
        [-87.8, 41.8], [-88.0, 41.5], [-88.5, 41.0], [-89.0, 40.5],
        [-89.5, 40.0], [-90.0, 39.5], [-90.4, 39.0], [-90.5, 38.5],
        [-90.5, 38.0], [-89.8, 37.2],
      ]},
      // Great Lakes overflow through Chicago outlet + Niagara
      { name: "Great Lakes System", flow_km3: 8800, dissipation: "Proglacial Lake Agassiz + Great Lakes overflow. Multiple outlet phases — Port Huron, Kirkfield, North Bay outlets active simultaneously.", width: 2.2, coords: [
        [-88.0, 46.0], [-87.2, 45.5], [-86.5, 44.8], [-85.5, 44.0],
        [-84.5, 43.2], [-83.5, 42.5], [-82.8, 42.5], [-81.8, 42.8],
        [-80.8, 42.8], [-80.0, 43.0], [-79.5, 43.3], [-79.1, 43.9],
        [-78.2, 44.0], [-76.8, 44.2],
      ]},
      // Finger Lakes drainage — wider at medium
      { name: "Finger Lakes Outlet", flow_km3: 3200, dissipation: "Seneca/Cayuga/Keuka overflow — Mohawk Valley corridor fills to 60m. Hudson gorge at maximum capacity draining to Atlantic.", width: 1.4, coords: [
        [-77.1, 42.6], [-76.8, 42.7], [-76.2, 43.0], [-75.5, 43.1],
        [-74.8, 43.0], [-74.2, 42.9], [-73.7, 42.7], [-73.7, 42.3],
        [-73.8, 41.8], [-73.9, 41.2], [-74.0, 40.7],
      ]},
      // St Lawrence wider
      { name: "St Lawrence Outlet", flow_km3: 11500, dissipation: "Combined Lake Agassiz + Great Lakes drainage east — primary trigger for AMOC disruption and Younger Dryas onset.", width: 2.0, coords: [
        [-79.1, 43.3], [-77.5, 43.0], [-76.0, 43.2], [-75.0, 43.6],
        [-74.3, 44.5], [-73.8, 45.5], [-73.5, 46.5],
        [-72.5, 46.8], [-71.2, 46.8], [-69.5, 47.4], [-67.5, 47.9], [-65.5, 48.4],
        [-64.0, 48.8], [-62.5, 48.5], [-61.5, 47.3],
      ]},
      // Mackenzie River — primary Arctic drainage
      { name: "Mackenzie Corridor", flow_km3: 7200, dissipation: "Drains northwest through Mackenzie valley to Beaufort Sea — freshwater input suppressed Arctic thermohaline. Ice-free corridor drainage.", width: 1.8, coords: [
        [-113.5, 56.0], [-117.0, 58.5], [-120.5, 61.5],
        [-122.5, 63.5], [-126.0, 65.0], [-128.5, 67.0],
        [-132.0, 68.5], [-134.5, 69.2],
      ]},
    ]
  },

  // HIGH — full continental sheet flow
  high: {
    opacity: 0.90,
    features: [
      // Columbia — catastrophic
      { name: "Columbia River System", flow_km3: 32000, dissipation: "Maximum Missoula-scale discharge — Columbia Gorge walls carved, Channeled Scablands fully active. Pacific sediment plume visible 500km offshore.", width: 3.6, coords: [
        [-117.4, 47.8], [-117.8, 47.4], [-118.2, 47.0], [-118.7, 46.6],
        [-119.1, 46.2], [-119.3, 45.9], [-119.7, 45.7], [-120.2, 45.7],
        [-120.8, 45.7], [-121.3, 45.7], [-121.7, 45.7], [-122.0, 45.6],
        [-122.3, 45.6], [-122.7, 45.5], [-123.1, 46.1], [-123.9, 46.2],
      ]},
      { name: "Channeled Scablands", flow_km3: 18000, dissipation: "Full Scabland flood — Moses Coulee, Grand Coulee, Cheney-Palouse tract all active. Coulees carved in days.", width: 2.8, coords: [
        [-117.5, 48.2], [-117.9, 47.7], [-118.3, 47.2], [-118.7, 46.8],
        [-119.0, 46.5], [-119.1, 46.2],
      ]},
      { name: "Willamette Backflood", flow_km3: 5800, dissipation: "Lake Allison at maximum — Willamette Valley inundated to ~120m. Portland area under 30m of water.", width: 2.4, coords: [
        [-122.7, 45.5], [-123.0, 45.1], [-123.1, 44.6],
        [-123.1, 44.1], [-122.9, 43.8], [-122.6, 43.4],
      ]},
      // Missouri at maximum
      { name: "Missouri River Sheet", flow_km3: 28000, dissipation: "Missouri at peak — overbank flooding across Great Plains 50-100km wide. Kansas City and St Louis under 15-40m.", width: 3.2, coords: [
        [-112.5, 47.5], [-110.5, 47.8], [-107.0, 47.8],
        [-104.0, 47.1], [-100.4, 46.9], [-97.4, 46.9],
        [-96.5, 46.0], [-98.0, 44.5], [-99.3, 43.5],
        [-101.2, 42.9], [-97.5, 41.2], [-96.2, 41.5],
        [-95.5, 39.9], [-94.6, 39.1], [-92.5, 38.8], [-91.7, 38.8],
      ]},
      // Great Plains sheet flow
      { name: "Great Plains Inundation", flow_km3: 16000, dissipation: "Overland sheet flow across flat Great Plains — no confining valley. Broad shallow flood 2-15m deep covering thousands of km².", width: 4.0, coords: [
        [-100.0, 49.0], [-100.5, 47.5], [-100.0, 46.0],
        [-99.5, 44.5], [-99.0, 43.0], [-98.5, 41.5],
        [-98.0, 40.0], [-97.5, 38.5], [-97.0, 37.0],
      ]},
      // Mississippi at full capacity
      { name: "Lower Mississippi / Gulf", flow_km3: 42000, dissipation: "Peak combined discharge — all N American drainages converging. Gulf of Mexico freshwater lid killed marine life for centuries. Primary AMOC shutdown mechanism.", width: 4.0, coords: [
        [-93.1, 44.9], [-91.5, 43.5], [-90.6, 41.6],
        [-90.0, 39.5], [-89.6, 38.5], [-89.1, 37.1],
        [-89.5, 36.0], [-90.4, 34.2], [-91.1, 33.2],
        [-91.5, 32.3], [-91.2, 30.4], [-89.5, 29.2],
        [-88.8, 30.0],
      ]},
      // Ohio
      { name: "Ohio River Overflow", flow_km3: 7800, dissipation: "Ohio valley at maximum — Cincinnati under 25m. Joins Mississippi adding massive discharge pulse.", width: 2.0, coords: [
        [-80.5, 40.6], [-82.9, 40.4], [-84.2, 39.1],
        [-86.8, 37.9], [-88.1, 37.2], [-89.1, 37.1],
      ]},
      // Missouri → Mississippi confluence
      { name: "Missouri-Mississippi Confluence", flow_km3: 8500, dissipation: "Missouri meets Mississippi at St Louis — combined 500,000 m³/s overwhelms valley 150km wide.", width: 2.4, coords: [
        [-91.7, 38.8], [-91.4, 38.5], [-91.1, 38.2],
        [-90.8, 37.9], [-90.4, 37.5], [-89.9, 37.2], [-89.1, 37.1],
      ]},
      // Appalachian overflow — Ohio east to Atlantic
      { name: "Appalachian Overflow", flow_km3: 4500, dissipation: "Proglacial lakes overflow Appalachian gaps — Susquehanna, Potomac, Delaware all at maximum flood stage.", width: 1.8, coords: [
        [-80.5, 40.6], [-79.5, 40.3], [-78.5, 40.1],
        [-77.5, 40.2], [-77.0, 39.9], [-76.5, 39.6],
        [-76.0, 39.2], [-75.7, 38.8], [-75.3, 38.4],
      ]},
      // Finger Lakes → Chemung / Susquehanna drainage — westernmost channels
      { name: "Chemung River Outflow", flow_km3: 1800, dissipation: "Seneca and Chemung lake overflow drains south through Chemung valley into Susquehanna.", width: 1.4, coords: [
        [-76.9, 42.9], [-76.9, 42.4], [-77.0, 42.0],
        [-76.9, 41.5], [-76.8, 41.0], [-76.5, 40.5], [-76.3, 40.0],
      ]},
      // Cayuga / Seneca outlet south
      { name: "Cayuga Outlet", flow_km3: 1600, dissipation: "Cayuga Lake overflow — drains south through valleys carved by retreating ice margin.", width: 1.3, coords: [
        [-76.5, 42.8], [-76.4, 42.3], [-76.3, 41.8],
        [-76.2, 41.3], [-76.0, 40.8], [-75.8, 40.2],
      ]},
      // Oneida / Mohawk corridor south
      { name: "Mohawk-Susquehanna", flow_km3: 2200, dissipation: "Mohawk valley overflow cuts south through Catskill gaps into Susquehanna — massive proglacial lake drainage.", width: 1.5, coords: [
        [-75.5, 43.1], [-75.3, 42.6], [-75.1, 42.1],
        [-75.0, 41.6], [-75.0, 41.1], [-74.9, 40.7], [-74.8, 40.2],
      ]},
      // Delaware River corridor
      { name: "Delaware Outflow", flow_km3: 1900, dissipation: "Delaware River at maximum — Philadelphia region under 15-25m. Drains to Delaware Bay and Atlantic.", width: 1.4, coords: [
        [-74.8, 42.5], [-74.9, 42.0], [-75.0, 41.5],
        [-75.1, 41.0], [-75.1, 40.5], [-74.9, 40.0],
        [-75.1, 39.7], [-75.2, 39.3], [-75.4, 39.0],
      ]},
      // Hudson River — direct Atlantic outlet
      { name: "Hudson River Megaflood", flow_km3: 3200, dissipation: "Hudson at 50x modern discharge — New York Harbor under 40m. Continental shelf exposed by glacial low stand now reflooding from both directions.", width: 1.7, coords: [
        [-73.9, 43.8], [-73.9, 43.3], [-73.9, 42.8],
        [-73.9, 42.2], [-73.9, 41.7], [-74.0, 41.2],
        [-74.0, 40.7], [-74.1, 40.5], [-74.0, 40.2],
      ]},
      // Connecticut / Rhode Island coastal flooding
      { name: "New England Coast", flow_km3: 1400, dissipation: "Coastal flooding from Atlantic sea level rise + proglacial lake drainage. Long Island Sound fully inundated.", width: 1.2, coords: [
        [-73.5, 41.5], [-72.8, 41.4], [-72.0, 41.4],
        [-71.5, 41.5], [-71.0, 41.6], [-70.5, 41.8],
        [-70.0, 42.0], [-69.8, 41.7],
      ]},
      // Chicago outlet — Lake Michigan → Illinois → Mississippi
      { name: "Chicago Outlet", flow_km3: 5200, dissipation: "Lake Michigan overflows Chicago outlet into Illinois River — ancient glacial drainage route, reactivated.", width: 2.0, coords: [
        [-87.8, 41.8], [-88.0, 41.4], [-88.5, 41.0],
        [-89.0, 40.5], [-89.5, 40.0], [-90.0, 39.4],
        [-90.4, 38.8], [-90.5, 38.2], [-89.8, 37.2],
      ]},
      // Great Lakes + Agassiz full flood
      { name: "Lake Agassiz Overflow", flow_km3: 24000, dissipation: "Catastrophic Lake Agassiz outburst — largest lake in N American history. Eastern outlet flooded St Lawrence, Arctic outlet flooded Mackenzie. AMOC shutdown within decades.", width: 3.6, coords: [
        [-99.0, 52.0], [-97.0, 50.5], [-96.5, 49.5],
        [-96.8, 48.5], [-96.8, 47.5], [-96.5, 46.5],
        [-96.8, 46.0], [-93.0, 46.5], [-90.0, 46.0],
        [-88.0, 45.5], [-87.0, 44.5], [-86.0, 43.5],
        [-85.0, 43.0], [-84.0, 42.5], [-83.0, 42.2],
        [-82.0, 42.5], [-81.0, 42.8], [-80.0, 43.0],
        [-79.5, 43.3], [-79.1, 43.9], [-77.5, 44.1],
      ]},
      // Finger Lakes megaflood — all lakes overflow simultaneously
      { name: "Finger Lakes Megaflood", flow_km3: 5800, dissipation: "All 11 Finger Lakes overflow simultaneously — Mohawk corridor 80m deep. Hudson canyon fully inundated to Manhattan.", width: 2.0, coords: [
        [-77.3, 42.5], [-77.0, 42.6], [-76.5, 42.8], [-76.0, 43.0],
        [-75.4, 43.1], [-74.7, 43.0], [-74.2, 42.9], [-73.7, 42.7],
        [-73.7, 42.2], [-73.8, 41.5], [-73.9, 41.0], [-74.0, 40.7],
        [-74.0, 40.5], [-74.0, 40.3],
      ]},
      // St Lawrence at maximum
      { name: "St Lawrence / Atlantic", flow_km3: 28000, dissipation: "Maximum Atlantic freshwater injection — Lake Agassiz + Great Lakes combined. Salinity drop of 3-5ppt across N Atlantic. Younger Dryas onset within 1-3 years of peak discharge.", width: 3.2, coords: [
        [-79.1, 43.3], [-77.5, 43.0], [-76.0, 43.2], [-75.0, 43.6],
        [-74.3, 44.5], [-73.8, 45.5], [-73.5, 46.5],
        [-72.5, 46.8], [-71.2, 46.8], [-69.5, 47.4],
        [-67.5, 47.9], [-65.5, 48.4], [-64.0, 48.8],
        [-62.5, 48.5], [-61.5, 47.3],
      ]},
      // Mackenzie at maximum
      { name: "Mackenzie Arctic Outlet", flow_km3: 14000, dissipation: "Lake Agassiz northern spillway — Beaufort Sea freshwater spike. Arctic sea ice formation disrupted for centuries.", width: 2.8, coords: [
        [-113.5, 56.0], [-117.0, 58.5], [-120.5, 61.5],
        [-122.5, 63.5], [-126.0, 65.0], [-128.5, 67.0],
        [-132.0, 68.5], [-134.5, 69.2],
      ]},
      // Hudson Bay drainage
      { name: "Hudson Bay Outlet", flow_km3: 9500, dissipation: "Laurentide ice margin retreat opened Hudson Bay — massive meltwater pulse to Labrador Sea and N Atlantic.", width: 2.6, coords: [
        [-85.0, 56.0], [-83.5, 58.0], [-82.5, 60.0],
        [-82.0, 62.0], [-82.5, 64.0], [-83.0, 66.0],
      ]},
      // Atlantic coastal flooding
      { name: "Atlantic Seaboard", flow_km3: 4200, dissipation: "Coastal inundation from sea level rise + storm surge amplification. Continental shelf exposed during glacial low stand now reflooding.", width: 2.4, coords: [
        [-75.5, 35.5], [-75.2, 37.0], [-74.8, 38.5],
        [-74.2, 40.0], [-73.8, 41.5], [-72.5, 42.5],
        [-71.0, 43.5], [-70.0, 44.5], [-68.0, 46.5],
      ]},
    ]
  }
};

// Real Last Glacial Maximum ice sheet extents as lat/lng polygons
// Pulled back slightly from maximum extent to show Finger Lakes region and ice-free corridor
const YDI_ICE_SHEETS = [
  {
    name: "Laurentide Ice Sheet",
    color: "#bfdbfe",
    // Southern margin pulled north ~2-3° to show Finger Lakes, Erie, Ontario ice-free
    coords: [
      [-76.5, 43.0],  // Finger Lakes / upstate NY southern limit
      [-79.0, 42.5],  // Lake Erie south shore
      [-82.5, 41.5],  // NW Ohio
      [-85.5, 41.5],  // Indiana/Ohio border
      [-87.5, 41.8],  // Chicago area
      [-90.0, 42.5],  // Wisconsin
      [-93.0, 43.5],  // Minnesota
      [-96.5, 45.0],  // N Dakota border
      [-99.5, 46.5],  // N Dakota
      [-102.0, 47.5], // N Dakota/Montana
      [-106.0, 48.5], // Montana
      [-109.0, 49.0], // Montana/Alberta border
      [-112.0, 49.0], // Alberta south — ice-free corridor starts here
      // Ice-free corridor (Mackenzie) — indent eastward
      [-113.5, 51.0], // Corridor west edge
      [-113.0, 53.5], // Corridor narrows
      [-113.5, 56.0], // N Alberta corridor
      [-116.0, 58.0], // NE BC — rejoins ice
      [-118.0, 59.5], // Northern BC
      [-120.0, 61.0], // Yukon border
      // Arctic extent
      [-125.0, 63.0],
      [-130.0, 65.0],
      [-135.0, 68.0],
      [-130.0, 70.0],
      [-120.0, 72.0],
      [-105.0, 73.0],
      [-90.0,  73.5],
      [-80.0,  74.0],
      [-72.0,  74.5],
      [-65.0,  73.0],
      [-60.0,  70.0],
      [-57.0,  65.0],
      [-59.0,  60.0],
      [-63.0,  57.0],
      [-66.0,  52.0],
      [-69.0,  48.0],
      [-71.0,  46.0],
      [-73.5,  44.5],
      [-76.5,  43.0],  // back to start
    ]
  },
  {
    name: "Cordilleran Ice Sheet",
    color: "#bfdbfe",
    // Stays west of ice-free corridor — doesn't reach Alberta plains
    coords: [
      [-113.5, 49.0],  // BC/Alberta border — eastern limit
      [-115.0, 48.0],  // N Idaho limit
      [-117.0, 47.0],  // Washington
      [-119.5, 46.5],  // Central Washington
      [-121.0, 45.5],  // Columbia River
      [-122.0, 45.0],  // Portland area — southern limit
      [-123.5, 45.5],  // Oregon coast
      [-124.0, 47.0],  // Olympic Peninsula
      [-123.5, 48.5],  // Puget Sound
      [-124.0, 50.0],  // Vancouver Island north
      [-125.0, 52.0],  // BC coast
      [-127.0, 54.0],  // BC north coast
      [-129.0, 56.0],  // SE Alaska
      [-132.0, 57.5],
      [-135.0, 59.0],
      [-138.0, 60.5],
      [-141.0, 61.5],  // Alaska border
      [-140.0, 63.0],  // Yukon
      [-136.0, 63.5],
      [-133.0, 62.5],
      [-129.0, 61.0],
      [-125.0, 60.0],
      [-121.0, 59.0],
      [-118.0, 57.5],  // BC interior
      [-116.0, 55.5],
      [-114.5, 53.0],
      [-113.5, 51.0],  // Ice-free corridor east edge
      [-113.5, 49.0],  // back to start
    ]
  }
];

const WILDFIRE_ZONES = [
  // 1.5°C zones — current trajectory
  { name: "California", center: [-120.5, 37.5], major_km: 500, minor_km: 280, bearing: 150, minLevel: 1.5, color: "#f97316" },
  { name: "Oregon/Washington", center: [-121.0, 45.5], major_km: 380, minor_km: 200, bearing: 160, minLevel: 1.5, color: "#f97316" },
  { name: "S. Australia", center: [144.0, -36.0], major_km: 600, minor_km: 320, bearing: 70, minLevel: 1.5, color: "#f97316" },
  { name: "Mediterranean", center: [-5.0, 38.5], major_km: 900, minor_km: 280, bearing: 80, minLevel: 1.5, color: "#f97316" },
  { name: "Portugal/Spain", center: [-7.5, 39.5], major_km: 400, minor_km: 180, bearing: 30, minLevel: 1.5, color: "#f97316" },
  { name: "British Columbia", center: [-123.0, 51.5], major_km: 420, minor_km: 220, bearing: 150, minLevel: 1.5, color: "#f97316" },
  { name: "Greece/Turkey", center: [28.0, 38.5], major_km: 500, minor_km: 220, bearing: 70, minLevel: 1.5, color: "#f97316" },

  // 2°C zones — new additions
  { name: "Amazon S. Fringe", center: [-58.0, -12.0], major_km: 700, minor_km: 350, bearing: 80, minLevel: 2.0, color: "#ef4444" },
  { name: "Central Chile", center: [-71.0, -34.0], major_km: 350, minor_km: 160, bearing: 170, minLevel: 2.0, color: "#ef4444" },
  { name: "S. Africa Cape", center: [20.0, -33.0], major_km: 400, minor_km: 200, bearing: 60, minLevel: 2.0, color: "#ef4444" },
  { name: "W. Siberia", center: [68.0, 57.0], major_km: 800, minor_km: 380, bearing: 90, minLevel: 2.0, color: "#ef4444" },
  { name: "SE Australia", center: [149.0, -33.0], major_km: 500, minor_km: 260, bearing: 60, minLevel: 2.0, color: "#ef4444" },
  { name: "SW USA", center: [-111.0, 34.0], major_km: 600, minor_km: 300, bearing: 120, minLevel: 2.0, color: "#ef4444" },

  // 3°C zones — new additions
  { name: "C. Europe", center: [12.0, 47.5], major_km: 700, minor_km: 300, bearing: 80, minLevel: 3.0, color: "#dc2626" },
  { name: "Kazakhstan", center: [68.0, 47.0], major_km: 600, minor_km: 280, bearing: 90, minLevel: 3.0, color: "#dc2626" },
  { name: "Alaska S.", center: [-151.0, 62.0], major_km: 500, minor_km: 250, bearing: 100, minLevel: 3.0, color: "#dc2626" },
  { name: "N. India/Pakistan", center: [72.0, 28.0], major_km: 600, minor_km: 280, bearing: 80, minLevel: 3.0, color: "#dc2626" },
  { name: "E. Australia", center: [150.0, -28.0], major_km: 650, minor_km: 320, bearing: 50, minLevel: 3.0, color: "#dc2626" },
  { name: "Amazon C.", center: [-55.0, -5.0], major_km: 800, minor_km: 400, bearing: 80, minLevel: 3.0, color: "#dc2626" },

  // 4°C zones — new additions
  { name: "Amazon Core", center: [-62.0, -3.0], major_km: 1200, minor_km: 600, bearing: 80, minLevel: 4.0, color: "#b91c1c" },
  { name: "Congo Fringe", center: [22.0, 2.0], major_km: 700, minor_km: 350, bearing: 70, minLevel: 4.0, color: "#b91c1c" },
  { name: "Scandinavia", center: [18.0, 64.0], major_km: 600, minor_km: 280, bearing: 30, minLevel: 4.0, color: "#b91c1c" },
  { name: "UK/Ireland", center: [-3.0, 53.5], major_km: 400, minor_km: 180, bearing: 50, minLevel: 4.0, color: "#b91c1c" },
  { name: "NZ South Island", center: [170.0, -44.5], major_km: 350, minor_km: 160, bearing: 40, minLevel: 4.0, color: "#b91c1c" },
  { name: "C. Canada", center: [-105.0, 54.0], major_km: 900, minor_km: 450, bearing: 90, minLevel: 4.0, color: "#b91c1c" },
  { name: "C. Asia", center: [58.0, 40.0], major_km: 700, minor_km: 320, bearing: 80, minLevel: 4.0, color: "#b91c1c" },
];

const WILDFIRE_SOURCE = "wildfire-source";
const WILDFIRE_PREFIX = "wildfire-zone";

const CLIMATE_PRESETS = [
  // Warming scenarios
  { label: "1.5°C Target", sub: "+0.3m · Paris Goal", level: 0.3, category: "warming" },
  { label: "2°C Scenario", sub: "+0.5m · Moderate", level: 0.5, category: "warming" },
  { label: "3°C Scenario", sub: "+1.0m · High", level: 1.0, category: "warming" },
  { label: "4°C Scenario", sub: "+1.5m · Extreme", level: 1.5, category: "warming" },
  // IPCC projections
  { label: "2050 Low", sub: "+0.3m · SSP1-2.6", level: 0.3, category: "ipcc" },
  { label: "2050 High", sub: "+0.6m · SSP5-8.5", level: 0.6, category: "ipcc" },
  { label: "2100 Low", sub: "+0.6m · SSP1-2.6", level: 0.6, category: "ipcc" },
  { label: "2100 High", sub: "+1.1m · SSP5-8.5", level: 1.1, category: "ipcc" },
  { label: "2100 Extreme", sub: "+2.0m · Worst Case", level: 2.0, category: "ipcc" },
  // Ice sheet collapse
  { label: "W. Antarctic", sub: "+3.3m · Collapse", level: 3.3, category: "ice" },
  { label: "Greenland", sub: "+7m · Full Melt", level: 7, category: "ice" },
  { label: "Both Sheets", sub: "+10m · Catastrophic", level: 10, category: "ice" },
];

const IMPACT_PRESETS = [
  // Historical events
  { label: "Chelyabinsk", sub: "2013 · Russia", diameter: 20, category: "historical",
    wiki: "<h4>Chelyabinsk 2013</h4><p>A ~20m asteroid airburst over Russia on Feb 15, 2013. Energy: ~500 kt. Shockwave injured 1,500 people, shattered windows across 6 cities. Largest recorded atmospheric impact since Tunguska. Arrived undetected — came from sun's direction.</p><p><strong>Probability:</strong> Events this size occur every 10-50 years globally.</p>" },
  { label: "Tunguska", sub: "1908 · Siberia", diameter: 60, category: "historical",
    wiki: "<h4>Tunguska 1908</h4><p>~60m comet/asteroid airburst over remote Siberia, June 30, 1908. Energy: ~10-15 Mt. Flattened ~2,000 km² of forest — 80 million trees. No crater formed. If over a city, millions would have died. Largest impact in recorded history.</p><p><strong>Probability:</strong> Events this size occur every 500-1,000 years.</p>" },
  { label: "Barringer", sub: "50,000 BP · Arizona", diameter: 50, category: "historical",
    wiki: "<h4>Barringer Crater (Meteor Crater)</h4><p>~50m iron meteorite struck Arizona ~50,000 BP. Energy: ~10 Mt. Created 1.2km wide, 170m deep crater. Iron meteorites survive atmosphere better than stony ones — rarer but more destructive per size.</p><p><strong>Location:</strong> Winslow, Arizona. Best-preserved impact crater on Earth.</p>" },
  { label: "Chicxulub", sub: "66M BP · K-Pg", diameter: 12000, category: "historical",
    wiki: "<h4>Chicxulub Impact — K-Pg Extinction</h4><p>~10-12km asteroid struck Yucatán, Mexico, 66 million years ago. Energy: ~100 trillion Mt. Created 180km crater now buried under Gulf of Mexico. Triggered mass extinction — killed 75% of all species including non-avian dinosaurs.</p><p>Global firestorms, decade-long impact winter, ocean acidification. Evidence: global iridium layer, shocked quartz, spherules.</p>" },
  // Near-Earth threats
  { label: "2024 YR4", sub: "2032 threat · 1:83", diameter: 65, category: "threat",
    wiki: "<h4>2024 YR4 — Active Threat</h4><p>Discovered December 2024. ~65m diameter asteroid with 1-in-83 chance of Earth impact on December 22, 2032 — highest impact probability ever recorded for a known asteroid of this size.</p><p>Energy if impact: ~500 Mt. City-scale destruction. Impact probability being refined as observations continue. NASA/ESA tracking closely.</p>" },
  { label: "Apophis", sub: "2029 flyby", diameter: 370, category: "threat",
    wiki: "<h4>Apophis — 2029 Close Flyby</h4><p>~370m asteroid will pass within 31,000km of Earth on April 13, 2029 — closer than geostationary satellites. Visible to naked eye. Initial 2004 calculations suggested 2.7% impact probability; now ruled out for 2029 and 2036.</p><p>Energy if impact: ~1,200 Mt. Regional devastation. A key test of planetary defense capabilities.</p>" },
  { label: "Bennu", sub: "2182 threat", diameter: 490, category: "threat",
    wiki: "<h4>Bennu — 2182 Threat</h4><p>~490m carbonaceous asteroid. NASA OSIRIS-REx returned samples in 2023. Cumulative 1-in-2,700 impact probability through 2300, with peak risk September 24, 2182.</p><p>Energy if impact: ~1,200 Mt. Would cause continental-scale devastation and global effects. Carbonaceous composition suggests ancient solar system material.</p>" },
  // Scale references
  { label: "City Killer", sub: "~150m", diameter: 150, category: "scale",
    wiki: "<h4>City Killer — ~150m</h4><p>150m asteroids occur every 10,000-20,000 years. Energy: ~1,000 Mt — enough to destroy a major city or cause large tsunamis if ocean impact.</p><p><strong>Annual probability:</strong> ~0.005%. Currently ~25,000 known near-Earth asteroids over 140m, with ~40% still undetected.</p>" },
  { label: "Regional", sub: "~1km", diameter: 1000, category: "scale",
    wiki: "<h4>Regional Devastation — ~1km</h4><p>1km asteroids occur every 500,000 years. Energy: ~100,000 Mt. Would devastate a continent, trigger global dust veil lasting years, cause regional extinction-level effects.</p><p>~900 known near-Earth objects over 1km. Considered threshold for civilization-threatening impact. ~95% of these have been catalogued.</p>" },
  { label: "Global", sub: "~10km", diameter: 10000, category: "scale",
    wiki: "<h4>Global Extinction — ~10km</h4><p>10km+ asteroids occur every 100 million years. Energy: Chicxulub-scale — >100 trillion Mt. Mass extinction certain. Global firestorms, decade of impact winter, ocean acidification.</p><p>No known near-Earth objects of this size pose a threat for the foreseeable future. Next major extinction-level impact expected in ~500 million years statistically.</p>" },
];

const NUKE_PRESETS = [
  { label: "Tactical", yield_kt: 1,
    wiki: "<h4>Tactical Nuclear Weapon — ~1 kt</h4><p>Sub-kiloton to low-kiloton yields designed for battlefield use. Examples: B61-12 (variable 0.3-50kt), Russian 9M729 cruise missile warhead.</p><p><strong>Effects at 1kt:</strong> Fireball 150m, lethal overpressure 500m, thermal burns 1km. Comparable to ~67 Hiroshima bombs at scale.</p><p><strong>Doctrine:</strong> NATO and Russia maintain thousands of tactical warheads. Low yield lowers the threshold for use — major proliferation concern.</p>" },
  { label: "Hiroshima", yield_kt: 15,
    wiki: "<h4>Little Boy — Hiroshima, 1945 (15kt)</h4><p>Gun-type uranium fission bomb. Detonated 580m above Hiroshima, August 6, 1945. 140,000 deaths by year's end. Destroyed 13 km².</p><p><strong>Effects:</strong> Fireball 300m, overpressure kills to 1.7km, thermal burns to 11km. Modern equivalent warheads are 20-100x more powerful.</p><p><strong>Legacy:</strong> One of only two nuclear weapons ever used in war. Led to Japanese surrender and the nuclear age.</p>" },
  { label: "B61", yield_kt: 340,
    wiki: "<h4>B61 Nuclear Gravity Bomb — 340kt</h4><p>Primary US tactical/strategic nuclear bomb. Variable yield 0.3-340kt. Deployed on B-2, F-35, and NATO dual-capable aircraft. ~480 in US stockpile.</p><p><strong>Effects at 340kt:</strong> Fireball 1km, severe overpressure to 5km, moderate damage to 12km, thermal burns to 30km.</p><p><strong>B61-12 upgrade:</strong> Added precision guidance, making it more usable — critics argue this lowers threshold for nuclear use.</p>" },
  { label: "B83 (1.2Mt)", yield_kt: 1200,
    wiki: "<h4>B83 — 1.2 Megaton</h4><p>Largest nuclear weapon in US active stockpile. Gravity bomb for hardened target destruction. ~50 believed in active stockpile.</p><p><strong>Effects at 1.2Mt:</strong> Fireball 2km, lethal overpressure to 8km, moderate damage to 20km, third-degree burns to 50km.</p><p><strong>Targets:</strong> Underground command bunkers, missile silos, hardened military facilities requiring deep earth-penetrating blast.</p>" },
  { label: "Tsar Bomba", yield_kt: 50000,
    wiki: "<h4>Tsar Bomba — 50 Megatons</h4><p>Largest nuclear weapon ever detonated. Soviet hydrogen bomb tested October 30, 1961 over Novaya Zemlya, Arctic. Originally designed for 100Mt but tamper reduced to limit fallout.</p><p><strong>Effects:</strong> Fireball 8km visible 1,000km away. Complete destruction to 35km. Windows broken in Finland and Norway. Seismic wave circled Earth three times.</p><p><strong>No modern equivalent:</strong> Too large for missile delivery. Modern strategy uses MIRVed warheads — multiple smaller warheads more effective than one giant bomb.</p>" },
];

// ── Yellowstone eruption data ─────────────────────────────────────────────────
// Based on USGS geological studies of the three caldera-forming eruptions.
// Ash zones are approximate ellipses centered on Yellowstone caldera (44.4°N, 110.6°W)
// Each zone: [major_km, minor_km, bearing_deg] — ash disperses ENE with jet stream

const YELLOWSTONE_CENTER = [-110.6, 44.4];

const YELLOWSTONE_PRESETS = [
  {
    label: "640k BP", wiki: "<h4>Lava Creek Eruption — 640,000 BP</h4><p>Largest of Yellowstone's three caldera-forming eruptions. Ejected ~1,000 km³ of material (VEI 8). Created the current 85km × 45km Yellowstone caldera.</p><p><strong>Global effects:</strong> Nuclear winter for 3+ years. North American agriculture destroyed. Ash blanketed entire continent. The cycle interval suggests the next eruption is 'overdue' — though USGS notes eruptions are not clockwork.</p><p><strong>Current status:</strong> Magma chamber partially molten at 5-15km depth. Ground uplift of ~20cm since 2000s, likely hydrothermal not magmatic.</p>",
    name: "Lava Creek (640,000 BP)",
    desc: "Largest known — 1,000 km³ ejecta",
    vei: 8,
    color: "#ef4444",
    blackout_pct: 70, blackout_duration_months: 36, blackout_severity: "Nuclear winter — mass starvation",
    zones: [
      { name: "Kill Zone", desc: "Total devastation, pyroclastic flows", survival: "0%", survivalNote: "Pyroclastic flows, 1000°C+. No survival possible.", ash_m: 100, major_km: 200, minor_km: 120, color: "#fef08a", opacity: 0.85 },
      { name: "Heavy Ash (>1m)", desc: "Structures collapse, crops destroyed", survival: "2-5%", survivalNote: "Roof collapse, water contamination, no food. Survival only with immediate evacuation.", ash_m: 1, major_km: 800, minor_km: 400, color: "#b91c1c", opacity: 0.55 },
      { name: "Moderate Ash (10cm+)", desc: "Uninhabitable, total crop failure", survival: "30-50%", survivalNote: "Survivable with evacuation. Infrastructure destroyed for years. Nuclear winter effects.",  ash_cm: 10, major_km: 1800, minor_km: 800, color: "#ea580c", opacity: 0.30 },
      { name: "Trace Ash (1cm+)", desc: "Air travel disrupted, health risk", survival: "85-95%", survivalNote: "Most survive with preparation. Respiratory masks essential. Economic disruption for months.",  ash_cm: 1, major_km: 3500, minor_km: 1600, color: "#92400e", opacity: 0.18 },
    ],
  },
  {
    label: "1.3M BP", wiki: "<h4>Mesa Falls Eruption — 1.3 Million BP</h4><p>Second caldera-forming eruption. Ejected ~280 km³ (VEI 8). Created the Henry's Fork caldera in Idaho, now largely obscured by subsequent lava flows.</p><p><strong>Scale:</strong> Smaller than Lava Creek but still ~280× the volume of the 1980 Mt. St. Helens eruption. Global dimming and crop failures would last 1-2 years.</p>",
    name: "Mesa Falls (1.3M BP)",
    desc: "Mid-size — 280 km³ ejecta",
    vei: 8,
    color: "#f97316",
    blackout_pct: 40, blackout_duration_months: 18, blackout_severity: "Global dimming — crop failures likely",
    zones: [
      { name: "Kill Zone", desc: "Total devastation", survival: "0%", survivalNote: "Pyroclastic flows, 1000°C+. No survival possible.", ash_m: 50, major_km: 120, minor_km: 70, color: "#fef08a", opacity: 0.85 },
      { name: "Heavy Ash (>1m)", desc: "Structures collapse", survival: "2-5%", survivalNote: "Roof collapse, water contamination, no food. Survival only with immediate evacuation.", ash_m: 1, major_km: 450, minor_km: 220, color: "#b91c1c", opacity: 0.55 },
      { name: "Moderate Ash (10cm+)", desc: "Uninhabitable", survival: "30-50%", survivalNote: "Survivable with evacuation. Infrastructure destroyed for years. Nuclear winter effects.",  ash_cm: 10, major_km: 1100, minor_km: 500, color: "#ea580c", opacity: 0.30 },
      { name: "Trace Ash (1cm+)", desc: "Health risk", survival: "85-95%", survivalNote: "Most survive with preparation. Respiratory masks essential. Economic disruption for months.",  ash_cm: 1, major_km: 2200, minor_km: 900, color: "#92400e", opacity: 0.18 },
    ],
  },
  {
    label: "2.1M BP", wiki: "<h4>Huckleberry Ridge Eruption — 2.1 Million BP</h4><p>Largest of the three Yellowstone supereruptions. Ejected ~2,450 km³ — 2.5× Lava Creek. Created original Island Park caldera, much of which is now buried.</p><p><strong>Context:</strong> This eruption deposited ash as far as Louisiana and California. At this scale, North American civilization would effectively end. Nuclear winter lasting 3-5 years minimum.</p>",
    name: "Huckleberry Ridge (2.1M BP)",
    desc: "First eruption — 2,450 km³ ejecta",
    vei: 8,
    color: "#a855f7",
    blackout_pct: 70, blackout_duration_months: 36, blackout_severity: "Nuclear winter — mass starvation",
    zones: [
      { name: "Kill Zone", desc: "Total devastation", survival: "0%", survivalNote: "Pyroclastic flows, 1000°C+. No survival possible.", ash_m: 200, major_km: 300, minor_km: 180, color: "#fef08a", opacity: 0.85 },
      { name: "Heavy Ash (>1m)", desc: "Structures collapse", survival: "2-5%", survivalNote: "Roof collapse, water contamination, no food. Survival only with immediate evacuation.", ash_m: 1, major_km: 1200, minor_km: 600, color: "#b91c1c", opacity: 0.55 },
      { name: "Moderate Ash (10cm+)", desc: "Uninhabitable", survival: "30-50%", survivalNote: "Survivable with evacuation. Infrastructure destroyed for years. Nuclear winter effects.",  ash_cm: 10, major_km: 2800, minor_km: 1200, color: "#ea580c", opacity: 0.30 },
      { name: "Trace Ash (1cm+)", desc: "Health risk", survival: "85-95%", survivalNote: "Most survive with preparation. Respiratory masks essential. Economic disruption for months.",  ash_cm: 1, major_km: 5000, minor_km: 2200, color: "#92400e", opacity: 0.18 },
    ],
  },
];

// Build ash ellipse GeoJSON — jet stream blows ENE so bearing ~70° from Yellowstone
// Centered ellipse for wind zones — no bearing offset, oriented N/S
const buildWindEllipse = (centerLng, centerLat, majorKm, minorKm, steps = 96) => {
  const kpLat = 110.574;
  const kpLng = 111.32 * Math.cos((centerLat * Math.PI) / 180);
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const nKm = Math.cos(t) * majorKm;
    const eKm = Math.sin(t) * minorKm;
    coords.push([centerLng + eKm / Math.max(kpLng, 0.0001), centerLat + nKm / kpLat]);
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} };
};

const buildAshEllipse = (centerLng, centerLat, majorKm, minorKm, bearingDeg = 70, steps = 96) => {
  const kpLat = 110.574;
  const kpLng = 111.32 * Math.cos((centerLat * Math.PI) / 180);
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const dNorth = Math.cos(bearingRad);
  const dEast  = Math.sin(bearingRad);
  // Shift center downwind so Yellowstone sits at upwind edge
  const cLat = centerLat + (dNorth * majorKm * 0.3) / kpLat;
  const cLng = centerLng + (dEast  * majorKm * 0.3) / Math.max(kpLng, 0.0001);
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const along = Math.cos(t) * majorKm;
    const perp  = Math.sin(t) * minorKm;
    const nKm = dNorth * along - dEast * perp;
    const eKm = dEast  * along + dNorth * perp;
    coords.push([cLng + eKm / Math.max(kpLng, 0.0001), cLat + nKm / kpLat]);
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} };
};

// ── Toba supervolcano data ──────────────────────────────────────────────────
const TOBA_CENTER = [98.83, 2.68]; // Sumatra, Indonesia

const TOBA_PRESETS = [
  {
    label: "74k BP",
    name: "Toba (74,000 BP)",
    desc: "Largest eruption in 2M years — 2,800 km³ ejecta",
    vei: 8,
    color: "#ef4444",
    blackout_pct: 80, blackout_duration_months: 48, blackout_severity: "Extinction winter — photosynthesis collapse",
    zones: [
      { name: "Kill Zone", desc: "Total devastation, pyroclastic flows", survival: "0%", survivalNote: "Pyroclastic flows 1000°C+. No survival possible.", major_km: 400, minor_km: 250, color: "#fef08a", opacity: 0.85 },
      { name: "Heavy Ash (>1m)", desc: "Structures collapse, crops destroyed", survival: "2-5%", survivalNote: "Roof collapse, water contamination. Evacuation only hope.", major_km: 1600, minor_km: 900, color: "#b91c1c", opacity: 0.55 },
      { name: "Moderate Ash (10cm+)", desc: "Uninhabitable, total crop failure", survival: "30-50%", survivalNote: "Survivable with evacuation. Years of infrastructure loss.", major_km: 3500, minor_km: 1800, color: "#ea580c", opacity: 0.30 },
      { name: "Trace Ash (1cm+)", desc: "Air travel disrupted, health risk", survival: "85-95%", survivalNote: "Most survive. Respiratory masks essential.", major_km: 6000, minor_km: 3000, color: "#92400e", opacity: 0.18 },
    ],
  },
];

// ── Campi Flegrei data ───────────────────────────────────────────────────────
const CAMPI_CENTER = [14.14, 40.83]; // Naples, Italy

const CAMPI_PRESETS = [
  {
    label: "Full",
    name: "Campi Flegrei (Full Eruption)",
    desc: "Caldera collapse — ~500 km³ ejecta, Naples direct hit",
    vei: 8,
    color: "#f97316",
    blackout_pct: 45, blackout_duration_months: 24, blackout_severity: "Global dimming — crop failures likely",
    zones: [
      { name: "Kill Zone", desc: "Total devastation — Naples destroyed", survival: "0%", survivalNote: "Pyroclastic flows obliterate Naples and surrounding area.", major_km: 150, minor_km: 100, color: "#fef08a", opacity: 0.85 },
      { name: "Heavy Ash (>1m)", desc: "Structures collapse across Italy", survival: "2-5%", survivalNote: "Roof collapse, water contamination. Immediate evacuation required.", major_km: 600, minor_km: 350, color: "#b91c1c", opacity: 0.55 },
      { name: "Moderate Ash (10cm+)", desc: "Uninhabitable, Mediterranean disruption", survival: "30-50%", survivalNote: "Survivable with evacuation. Years of crop failure across S. Europe.", major_km: 1400, minor_km: 700, color: "#ea580c", opacity: 0.30 },
      { name: "Trace Ash (1cm+)", desc: "Air travel across Europe disrupted", survival: "85-95%", survivalNote: "Most survive. Aviation halted across Europe for months.", major_km: 3000, minor_km: 1400, color: "#92400e", opacity: 0.18 },
    ],
  },
];

const YELLOWSTONE_SOURCE_ID = "yellowstone-source";
const YELLOWSTONE_LAYER_PREFIX = "yellowstone-layer";

// ── Mega-Tsunami scenario data ────────────────────────────────────────────────
// Based on NOAA, Ward & Day (2001), Løvholt et al. (2008), and Cascadia studies
// Wave propagation ellipses represent travel-time isochrones from source

const TSUNAMI_SOURCES = [
  {
    label: "La Palma",
    name: "La Palma Collapse",
    desc: "Cumbre Vieja western flank — 500km³ into Atlantic",
    origin: [-17.8, 28.6],  // Canary Islands
    bearing: 270,            // waves propagate west toward Americas
    spreadAngle: 75,         // wide spread — Atlantic basin
    color: "#0ea5e9",
    threat: "US East Coast, Caribbean, NW Africa, W Europe",
    maxWaveM: 100,
    bbox: { minLat: 5, maxLat: 65, minLng: -85, maxLng: 20 },
    rings: [
      { hours: 1,  major_km: 540,  minor_km: 346,  waveM: 100, label: "1 hr" },
      { hours: 2,  major_km: 1080, minor_km: 691,  waveM: 40, label: "2 hr" },
      { hours: 4,  major_km: 2160, minor_km: 1382, waveM: 25,  label: "4 hr" },
      { hours: 8,  major_km: 3780, minor_km: 2419, waveM: 10,  label: "8 hr" },
    ],
    inundation_km: 3,   // avg km inland at target coasts
  },
  {
    label: "Cumbre Vieja",
    name: "Cumbre Vieja Eruption",
    desc: "Full volcanic flank collapse — 1,500km³ ejecta",
    origin: [-17.84, 28.57],
    bearing: 265,
    spreadAngle: 75,
    color: "#06b6d4",
    threat: "US East Coast, Brazil, Iberian Peninsula",
    maxWaveM: 650,
    bbox: { minLat: -35, maxLat: 65, minLng: -80, maxLng: 15 },
    rings: [
      { hours: 1,  major_km: 648,  minor_km: 410,  waveM: 650, label: "1 hr" },
      { hours: 2,  major_km: 1296, minor_km: 821,  waveM: 80, label: "2 hr" },
      { hours: 4,  major_km: 2592, minor_km: 1642, waveM: 40, label: "4 hr" },
      { hours: 9,  major_km: 3888, minor_km: 2462, waveM: 15,  label: "9 hr" },
    ],
    inundation_km: 8,
  },
  {
    label: "Cascadia",
    name: "Cascadia Subduction Zone",
    desc: "Mw 9.2 megathrust — entire 1,000km fault rupture",
    origin: [-125.0, 45.0],
    bearing: 250,
    spreadAngle: 60,
    color: "#3b82f6",
    threat: "US/Canada West Coast, Hawaii, Japan, Alaska",
    maxWaveM: 30,
    bbox: { minLat: 15, maxLat: 72, minLng: 130, maxLng: -110 },
    rings: [
      { hours: 0.5, major_km: 324,  minor_km: 216,  waveM: 30, label: "30 min" },
      { hours: 1,   major_km: 648,  minor_km: 432,  waveM: 20, label: "1 hr" },
      { hours: 3,   major_km: 1944, minor_km: 1296, waveM: 10, label: "3 hr" },
      { hours: 9,   major_km: 5832, minor_km: 3888, waveM: 5,  label: "9 hr" },
    ],
    inundation_km: 5,
  },
  {
    label: "Alaska",
    name: "Alaska / Aleutian Collapse",
    desc: "Anak Krakatau-scale submarine collapse — Gulf of Alaska",
    origin: [-152.0, 58.0],
    bearing: 200,
    spreadAngle: 55,
    color: "#8b5cf6",
    threat: "Hawaii, US West Coast, Japan, Pacific Islands",
    maxWaveM: 50,
    bbox: { minLat: -5, maxLat: 72, minLng: 120, maxLng: -100 },
    rings: [
      { hours: 1,  major_km: 540,  minor_km: 378,  waveM: 50, label: "1 hr" },
      { hours: 2,  major_km: 1080, minor_km: 756,  waveM: 30, label: "2 hr" },
      { hours: 5,  major_km: 2700, minor_km: 1890, waveM: 15,  label: "5 hr" },
      { hours: 10, major_km: 5400, minor_km: 3780, waveM: 5,  label: "10 hr" },
    ],
    inundation_km: 2,
  },
];

const TSUNAMI_SOURCE_ID = "tsunami-source";
const TSUNAMI_LAYER_PREFIX = "tsunami-layer";

const buildTsunamiEllipse = (originLng, originLat, majorKm, minorKm, bearingDeg, steps = 96, spreadAngle = 65) => {
  // Wedge/sector: tip at origin, arc at majorKm radius, spreadAngle degrees each side
  const kpLat = 110.574;
  const kpLng = 111.32 * Math.cos((originLat * Math.PI) / 180);
  const coords = [];
  // Tip at origin
  coords.push([originLng, originLat]);
  // Arc at majorKm from origin, from (bearing-spread) to (bearing+spread)
  for (let i = 0; i <= steps; i++) {
    const angleDeg = (bearingDeg - spreadAngle) + (spreadAngle * 2) * (i / steps);
    const angleRad = angleDeg * Math.PI / 180;
    const eKm = Math.sin(angleRad) * majorKm;
    const nKm = Math.cos(angleRad) * majorKm;
    coords.push([originLng + eKm / Math.max(kpLng, 0.0001), originLat + nKm / kpLat]);
  }
  // Close back to tip
  coords.push([originLng, originLat]);
  // Keep coords continuous — prevent jumps > 180 between consecutive points
  // This tells Mapbox to draw across the antimeridian correctly
  for (let i = 1; i < coords.length; i++) {
    const diff = coords[i][0] - coords[i-1][0];
    if (diff > 180) coords[i][0] -= 360;
    else if (diff < -180) coords[i][0] += 360;
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} };
};

const safely = (fn) => {
  try { return fn(); } catch (e) { console.warn("Map operation skipped:", e); return null; }
};

export default function HomePage() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const elevPopupRef = useRef(null);

  const impactPulseFrameRef = useRef(null);
  const impactRequestRef = useRef(null);
  const impactTimeoutRef = useRef(null);

  const seaLevelRef = useRef(0);
  const viewModeRef = useRef("map");
  const scenarioModeRef = useRef(null);
  const impactDiameterRef = useRef(1000);
  const impactVelocityRef = useRef(20);
  const floodEngineUrlRef = useRef(FLOOD_ENGINE_PROXY_PATH);

  const impactPointRef = useRef(null);       // last placed point (compat)
  const impactPointsRef = useRef([]);         // [{lng, lat, marker, result}] multi-impact
  const impactResultRef = useRef(null);
  const activeFloodLevelRef = useRef(null);
  const initialViewAppliedRef = useRef(false);
  const impactRunSeqRef = useRef(0);
  const impactCountRef = useRef(0);
  const impactDrawingRef = useRef(false); // true while runImpact is drawing results
  const impactFloodLayersRef = useRef([]); // [{sourceId, layerId}] cumulative flood tiles

  const [inputLevel, setInputLevel] = useState(0);
  const [inputText, setInputText] = useState("0");
  const [seaLevel, setSeaLevel] = useState(0);
  const [viewMode, setViewMode] = useState("map");
  const [scenarioMode, setScenarioMode] = useState(null);
  const [impactDiameter, setImpactDiameter] = useState(1000);
  const [impactVelocity, setImpactVelocity] = useState(20); // km/s
  const [nukeYield, setNukeYield] = useState(15);
  const nukeStrikesRef = useRef([]); // array of { lat, lng, marker }
  const [nukeStrikes, setNukeStrikes] = useState([]); // mirror for UI
  const MAX_NUKE_STRIKES = 5;
  const [yellowstonePreset, setYellowstonePreset] = useState(0);
  const [volcanoType, setVolcanoType] = useState("yellowstone"); // "yellowstone" | "toba" | "campi"
  const volcanoTypeRef = useRef("yellowstone");
  // Mega-Tsunami state
  const [tsunamiSource, setTsunamiSource] = useState(0);
  const tsunamiSourceRef = useRef(0);
  const [tsunamiActive, setTsunamiActive] = useState(false);
  const [cataclysmModel, setCataclysmModel] = useState("davidson"); // "davidson" | "tes"
  const [cataclysmActive, setCataclysmActive] = useState(false);
  const [cataclysmAnimating, setCataclysmAnimating] = useState(false);
  const cataclysmModelRef = useRef("davidson");
  const cataclysmOverlayRef = useRef("flood");
  const proTierRef = useRef("free");
  const [cataclysmOverlay, setCataclysmOverlay] = useState("flood"); // "flood" | "wind" | "both"
  const cataclysmSpinRef = useRef(null);
  const cataclysmRunRef = useRef(0);
  const [ydiIntensity, setYdiIntensity] = useState("medium"); // "low"|"medium"|"high"
  const ydiIntensityRef = useRef("medium");
  const ydiRunRef = useRef(0);
  const ydiIceFrameRef = useRef(null);
  const [tsunamiResult, setTsunamiResult] = useState(null);
  const [tsunamiFloodLevel, setTsunamiFloodLevel] = useState(null);
  const tsunamiPopupRef = useRef(null); // 0=640k, 1=1.3M, 2=2.1M
  const yellowstonePresetRef = useRef(0);
  const [yellowstoneActive, setYellowstoneActive] = useState(false);
  const [yellowstoneResult, setYellowstoneResult] = useState(null);
  const yellowstonePopupRef = useRef(null);
  const impactZonePopupRef = useRef(null);
  const nukeZonePopupRef = useRef(null);
  // Paywall: track free popup clicks per session (resets on mode clear)
  const impactPopupClickCountRef = useRef(0);
  const nukePopupClickCountRef   = useRef(0);
  const [nukeBurst, setNukeBurst] = useState("airburst");
  const [nukeWindDeg, setNukeWindDeg] = useState(270);
  const [nukeSubMode, setNukeSubMode] = useState("detonate"); // "detonate" | "emp"
  const nukeSubModeRef = useRef("detonate");
  const [empAltitudeKm, setEmpAltitudeKm] = useState(400);
  const [empResult, setEmpResult] = useState(null);
  const [empLoading, setEmpLoading] = useState(false);
  const [megalithOn, setMegalithOn] = useState(false);
  const megalithOnRef = useRef(false);
  const [megalithLoading, setMegalithLoading] = useState(false);
  const [faultLinesOn, setFaultLinesOn] = useState(false);
  const faultLinesOnRef = useRef(false);
  const [volcanoOn, setVolcanoOn] = useState(false);
  const volcanoOnRef = useRef(false);
  const [airportOn, setAirportOn] = useState(false);
  const airportOnRef = useRef(false);
  const [unescoOn, setUnescoOn] = useState(false);
  const unescoOnRef = useRef(false);
  const [nuclearOn, setNuclearOn] = useState(false);
  const nuclearOnRef = useRef(false);
  const [fireOn, setFireOn] = useState(false);
  const fireOnRef = useRef(false);
  const overlayLoadingRef = useRef(new Set()); // tracks in-flight fetches
  const [wikiPanel, setWikiPanel] = useState(null);
  const megalithPopupRef = useRef(null);
  const overlayPopupRef = useRef(null);
  const [nukeResult, setNukeResult] = useState(null);
  const nukeResultRef = useRef(null);
  const [nukeLoading, setNukeLoading] = useState(false);
  const [nukeError, setNukeError] = useState("");
  const nukePointRef = useRef(null); // kept for compatibility, points to last strike
  const [nukePointSet, setNukePointSet] = useState(false);
  const [impactResult, setImpactResult] = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState("");
  const [impactPoints, setImpactPoints] = useState([]); // mirror of impactPointsRef for UI re-render
  const [unitMode, setUnitMode] = useState("m");
  const [floodDisplaced, setFloodDisplaced] = useState(null);
  const [status, setStatus] = useState("Loading map...");
  const [floodEngineUrl, setFloodEngineUrl] = useState(FLOOD_ENGINE_PROXY_PATH);

  // ── Tier + paywall state ─────────────────────────────────────────────────
  const { user, isSignedIn } = useUser();

  // Derive tier: Clerk metadata (signed in) > localStorage (legacy) > free
  const getEffectiveTier = () => {
    if (isSignedIn && user?.publicMetadata?.tier) {
      return user.publicMetadata.tier;
    }
    return getProTier(); // localStorage fallback
  };

  const [proTier, setProTier] = useState("free");
  const [scenarioWiki, setScenarioWiki] = useState(null);
  const [eqMag,     setEqMag]     = useState(7.5);
  const [eqDepthId, setEqDepthId] = useState("shallow");
  const [eqFaultId, setEqFaultId] = useState("thrust");
  const [eqResult,  setEqResult]  = useState(null);
  const [eqView,    setEqView]    = useState("rings"); // "rings" | "tsunami"
  const [eqStrike,  setEqStrike]  = useState(0);
  const [eqDip,     setEqDip]     = useState(15);
  const [eqRake,    setEqRake]    = useState(90);
  const eqStrikeRef = useRef(0);
  const eqDipRef    = useRef(15);
  const eqRakeRef   = useRef(90);
  const [eqPoint,   setEqPoint]   = useState(null);
  const eqMagRef   = useRef(7.5);
  const eqDepthRef = useRef("shallow");
  const eqFaultRef = useRef("thrust");
  const eqPointRef = useRef(null);
  const eqMarker   = useRef(null);
  const eqLayers   = useRef([]);
  const [surgeOn,        setSurgeOn]        = useState(false);
  const [surgeTrackMode, setSurgeTrackMode]  = useState(false); // Pro: multi-point track
  const [surgeTrackPts,  setSurgeTrackPts]   = useState([]);    // [{lat,lng}] max 3
  const surgeTrackPtsRef  = useRef([]);
  const surgeTrackLayers  = useRef([]);  // [{sourceId,layerId,markerEl}]
  const surgeTrackLine    = useRef(null); // GeoJSON line source/layer ids
  const [surgeM,      setSurgeM]      = useState(3.0);
  const [surgePreset, setSurgePreset] = useState(null);
  const [surgeMode,   setSurgeMode]   = useState("place");
  const [surgePoint,  setSurgePoint]  = useState(null);
  const surgeOnRef    = useRef(false);
  const surgePresetRef = useRef(null);
  const surgeRef      = useRef(3.0);
  const surgeModeRef  = useRef("place");
  const surgePointRef = useRef(null);
  const surgeMarker   = useRef(null);
  const surgePopupRef = useRef(null); // set after mount in useEffect
  // keep ref in sync
  useEffect(() => { proTierRef.current = proTier; }, [proTier]);
  useEffect(() => { cataclysmOverlayRef.current = cataclysmOverlay; }, [cataclysmOverlay]);
  const [paywallModal, setPaywallModal] = useState(null); // null | "pro" | "ultra" | "ratelimit"
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [supportFormOpen, setSupportFormOpen] = useState(false);
  // Onboarding — shown once on first /map visit, suppressed by localStorage flag
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingPage, setOnboardingPage] = useState(0); // 0 | 1 | 2
  const [supportMsg, setSupportMsg] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [activeWarmingLevel, setActiveWarmingLevel] = useState(null);
  const activeWarmingLevelRef = useRef(null);
  const [rlStatus, setRlStatus] = useState(() => getRLStatus());

  // Mobile-only UI state — purely cosmetic, zero effect on map/engine logic
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [desktopStatsOpen, setDesktopStatsOpen] = useState(true);
  // Lazy initializer: correct on first render, no flash of wrong layout
  const [isMobile, setIsMobile] = useState(false);

  // Sync tier from Clerk when auth state changes
  useEffect(() => {
    const effective = getEffectiveTier();
    setProTier(effective);
    if (isSignedIn && user?.publicMetadata?.tier) {
      try { localStorage.setItem("dm_pro_tier", user.publicMetadata.tier); } catch {}
    }
  }, [isSignedIn, user]);

  // Simple pro unlock: if ?pro=1 in URL after Stripe redirect, set pro and prompt sign-in
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pro") === "1") {
      try { localStorage.setItem("dm_pro_tier", "pro"); } catch(e) {}
      setProTier("pro");
      proTierRef.current = "pro";
      window.history.replaceState({}, "", window.location.pathname);
      setStatus("✓ Pro unlocked! Sign in to save access across devices.");
      setTimeout(() => setStatus(""), 6000);
    }
  }, []);



  // Set isMobile after mount (avoids SSR hydration mismatch) + keep in sync on resize
  useEffect(() => {
    setIsMobile(window.innerWidth <= 640);
    const check = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", check);

    // ── Mobile browser-bar autohide ──────────────────────────────────────────
    // On mobile, scroll 1px then back — this signals the browser it can hide
    // its chrome, maximising the visible viewport (works on Chrome/Android,
    // Safari respects dvh independently once the page is interaction-locked).
    if (window.innerWidth <= 640) {
      // Longer delay ensures full paint + interaction lock before nudge
      const t = setTimeout(() => {
        try {
          document.documentElement.scrollTop = 1;
          requestAnimationFrame(() => { document.documentElement.scrollTop = 0; });
        } catch (_) {
          try {
            window.scrollTo({ top: 1, behavior: "instant" });
            requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
          } catch (_2) {}
        }
      }, 800);
      return () => { clearTimeout(t); window.removeEventListener("resize", check); };
    }

    return () => window.removeEventListener("resize", check);
  }, []);

  // ── First-visit onboarding ────────────────────────────────────────────────
  useEffect(() => {
    try {
      if (!localStorage.getItem("dm_onboarding_v1")) {
        const t = setTimeout(() => setShowOnboarding(true), 800);
        return () => clearTimeout(t);
      }
    } catch(_) {}
  }, []);

  const dismissOnboarding = (dontShowAgain = false) => {
    setShowOnboarding(false);
    setOnboardingPage(0);
    if (dontShowAgain) {
      try { localStorage.setItem("dm_onboarding_v1", "1"); } catch(_) {}
    }
  };

  useEffect(() => { seaLevelRef.current = seaLevel; }, [seaLevel]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { surgeOnRef.current    = surgeOn;     }, [surgeOn]);
  useEffect(() => { eqMagRef.current   = eqMag;     }, [eqMag]);
  const applyEqView = (view) => {
    const map = mapRef.current;
    if (!map) return;
    const showRings = view === "rings";
    eqLayers.current.forEach(({ layerId }) => {
      if (!layerId) return;
      const isTsunami = layerId === "eq-tsunami-layer" || layerId.startsWith("eq-ts-flood");
      const isLiq = layerId.startsWith("eq-liq");
      const isRing = layerId.startsWith("eq-ring");
      try {
        if (isTsunami) map.setLayoutProperty(layerId, "visibility", showRings ? "none" : "visible");
        if (isRing || isLiq) map.setLayoutProperty(layerId, "visibility", showRings ? "visible" : "none");
      } catch(e) {}
    });
  };
  useEffect(() => { eqDepthRef.current = eqDepthId; }, [eqDepthId]);
  useEffect(() => { eqFaultRef.current = eqFaultId; }, [eqFaultId]);
  useEffect(() => { eqPointRef.current = eqPoint;   }, [eqPoint]);
  useEffect(() => { surgePresetRef.current = surgePreset; }, [surgePreset]);
  useEffect(() => { surgeRef.current     = surgeM;     }, [surgeM]);
  useEffect(() => { surgeModeRef.current = surgeMode;  }, [surgeMode]);
  useEffect(() => { surgePointRef.current= surgePoint; }, [surgePoint]);
  useEffect(() => { scenarioModeRef.current = scenarioMode; }, [scenarioMode]);
  useEffect(() => { impactDiameterRef.current = impactDiameter; }, [impactDiameter]);
  useEffect(() => { impactVelocityRef.current = impactVelocity; }, [impactVelocity]);
  useEffect(() => { impactResultRef.current = impactResult; }, [impactResult]);
  useEffect(() => { nukeResultRef.current = nukeResult; }, [nukeResult]);
  useEffect(() => { floodEngineUrlRef.current = floodEngineUrl; }, [floodEngineUrl]);
  useEffect(() => { megalithOnRef.current = megalithOn; }, [megalithOn]);
  useEffect(() => { airportOnRef.current = airportOn; }, [airportOn]);
  useEffect(() => { unescoOnRef.current = unescoOn; }, [unescoOn]);
  useEffect(() => { nuclearOnRef.current = nuclearOn; }, [nuclearOn]);
  useEffect(() => { fireOnRef.current = fireOn; }, [fireOn]);

  // ── Generic at-risk overlay system ───────────────────────────────────────────
  // Config: type → { src, layer, color, subColor, icon, label, proOnly }
  const OVL = {
    megaliths: { src: "dm-megaliths-src", layer: "dm-megaliths-layer", color: "#d97706", subColor: "#3b82f6", icon: "🗿", label: "Megaliths",      proOnly: false },
    unesco:    { src: "dm-unesco-src",    layer: "dm-unesco-layer",    color: "#a855f7", subColor: "#6366f1", icon: "🌍", label: "UNESCO Sites",   proOnly: false },
    airports:  { src: "dm-airports-src",  layer: "dm-airports-layer",  color: "#22d3ee", subColor: "#0ea5e9", icon: "✈️", label: "Airports",       proOnly: true  },
    nuclear:   { src: "dm-nuclear-src",   layer: "dm-nuclear-layer",   color: "#4ade80", subColor: "#16a34a", icon: "☢️", label: "Nuclear Plants", proOnly: true  },
    fires:     { src: "dm-fires-src",     layer: "dm-fires-layer",     color: "#ff4500", subColor: "#ff8c00", icon: "🔥", label: "Live Fires",      proOnly: false },
  };

  const removeOverlayLayer = (type) => {
    const map = mapRef.current;
    const c = OVL[type];
    if (!map || !c) return;
    try { if (map.getLayer(c.layer + "-count"))    map.removeLayer(c.layer + "-count");    } catch(e){}
    try { if (map.getLayer(c.layer + "-clusters")) map.removeLayer(c.layer + "-clusters"); } catch(e){}
    try { if (map.getLayer(c.layer))               map.removeLayer(c.layer);               } catch(e){}
    try { if (map.getSource(c.src))                map.removeSource(c.src);                } catch(e){}
  };

  const addOverlayLayer = async (type, level = 0) => {
    if (type === "megaliths") setMegalithLoading(true);
    const map = mapRef.current;
    const c = OVL[type];
    if (!map || !c || !map.isStyleLoaded()) return;
    // In-flight guard — prevent concurrent fetches for same type
    if (overlayLoadingRef.current.has(type)) return;
    overlayLoadingRef.current.add(type);
    // Bulletproof double-add guard — remove layer then source explicitly
    { const m = mapRef.current; if (m) {
      try { if (m.getLayer(c.layer + "-count")) m.removeLayer(c.layer + "-count"); } catch(e){}
      try { if (m.getLayer(c.layer + "-clusters")) m.removeLayer(c.layer + "-clusters"); } catch(e){}
      try { if (m.getLayer(c.layer)) m.removeLayer(c.layer); } catch(e){}
      try { if (m.getSource(c.src))  m.removeSource(c.src);  } catch(e){}
    }}
    try {
      // Fires use a dedicated endpoint; all others use /at-risk
      const url = type === "fires"
        ? `${floodEngineUrlRef.current}/active-fires?pro=${proTierRef.current !== "free"}`
        : `${floodEngineUrlRef.current}/at-risk?level=${level}&type=${type}`;
      // Cache megaliths in sessionStorage (129k features, slow to re-fetch)
      let data;
      const cacheKey = `overlay_${type}_${level}`;
      if (type === "megaliths") {
        try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) { data = JSON.parse(cached); }
        } catch {}
      }
      if (!data) {
        const res = await fetch(url, { cache: type === "megaliths" ? "force-cache" : "no-store" });
        if (!res.ok) { if (type === "megaliths") setMegalithLoading(false); return; }
        data = await res.json();
        if (type === "megaliths") {
          try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
        }
      }
      if (type === "megaliths") setMegalithLoading(false);
      if (!data.features?.length) return;
      const isMegalith = type === "megaliths";
      map.addSource(c.src, {
        type: "geojson", data,
        ...(isMegalith ? { cluster: false } : {}),
      });



      const isFire = type === "fires";
      map.addLayer({
        id: c.layer, type: "circle", source: c.src,
        paint: {
          "circle-color": isFire ? "#ff4500" : [
            "case",
            ["==", ["get", "already_submerged"], true], c.subColor,
            ["==", ["get", "flooded"], true],            c.subColor,
            c.color,
          ],
          "circle-stroke-width": isFire ? 0.5 : [
            "case", ["any",
              ["==", ["get", "flooded"], true],
              ["==", ["get", "already_submerged"], true]
            ], 2.5, 1.5
          ],
          "circle-stroke-color": isFire ? "#ff8c00" : "#ffffff",
          "circle-opacity": isFire ? 0.85 : [
            "case", ["any",
              ["==", ["get", "flooded"], true],
              ["==", ["get", "already_submerged"], true]
            ], 1.0, 0.75
          ],
          "circle-radius": isFire
            ? (proTierRef.current !== "free"
                ? ["interpolate", ["linear"], ["coalesce", ["get", "frp"], 5], 5, 3, 50, 6, 200, 10, 500, 16]
                : ["interpolate", ["linear"], ["zoom"], 2, 3, 6, 5, 10, 7])
            : isMegalith
              ? ["interpolate", ["linear"], ["zoom"], 2, 1.5, 5, 2.5, 8, 4, 11, 6, 14, 8]
              : ["interpolate", ["linear"], ["zoom"], 2, 4, 6, 7, 10, 11],
        },
      });
      map.on("mouseenter", c.layer, () => { try { map.getCanvas().style.cursor = "pointer"; } catch {} });
      map.on("mouseleave", c.layer, () => { map.getCanvas().style.cursor = "crosshair"; });
      safely(() => map.triggerRepaint());
    } catch(e) { console.warn(`[overlay:${type}]`, e); }
    finally { overlayLoadingRef.current.delete(type); }
  };

  const reloadActiveOverlays = (level, includeFiresReload = false) => {
    if (megalithOnRef.current) addOverlayLayer("megaliths", level);
    if (unescoOnRef.current)   addOverlayLayer("unesco",    level);
    if (airportOnRef.current)  addOverlayLayer("airports",  level);
    if (nuclearOnRef.current)  addOverlayLayer("nuclear",   level);
    if (fireOnRef.current && includeFiresReload) addOverlayLayer("fires", 0);
  };

  const addFaultLines = async () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    try {
      if (map.getLayer("fault-lines-layer")) map.removeLayer("fault-lines-layer");
      if (map.getSource("fault-lines-src")) map.removeSource("fault-lines-src");
    } catch(e) {}
    try {
      const res = await fetch(`${floodEngineUrlRef.current}/fault-lines`, { cache: "force-cache" });
      if (!res.ok) return;
      const data = await res.json();
      map.addSource("fault-lines-src", { type: "geojson", data });
      map.addLayer({
        id: "fault-lines-layer", type: "line", source: "fault-lines-src",
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 2, 1.5, 6, 3.5, 10, 6],
          "line-opacity": 0.85,
        }
      });
      // Click fault line — rich info popup with action buttons
      map.on("click", "fault-lines-layer", (e) => {
        const p = e.features[0].properties;
        const lngLat = e.lngLat;

        // Recurrence interval estimate from slip rate
        // Assumes characteristic earthquake releases ~4m of slip
        // Recurrence (yrs) ≈ slip_per_event_mm / slip_rate_mm_yr
        let recurrenceHtml = "";
        if (p.slip_rate && p.slip_rate > 0) {
          const slipPerEvent = p.slip_type && p.slip_type.toLowerCase().includes("strike") ? 3000 : 4000; // mm
          const recurrence = Math.round(slipPerEvent / p.slip_rate);
          const lastBig = recurrence < 500 ? "Frequent" : recurrence < 2000 ? "Moderate" : "Infrequent";
          const risk = p.slip_rate > 10 ? "#ef4444" : p.slip_rate > 2 ? "#f97316" : "#fbbf24";
          recurrenceHtml = `
            <tr><td style="color:#94a3b8;padding:3px 8px 3px 0">Slip rate</td><td style="font-weight:700">${p.slip_rate.toFixed(1)} mm/yr</td></tr>
            <tr><td style="color:#94a3b8;padding:3px 8px 3px 0">Est. recurrence</td><td style="font-weight:700;color:${risk}">~${recurrence.toLocaleString()} yrs</td></tr>
            <tr><td style="color:#94a3b8;padding:3px 8px 3px 0">Activity</td><td style="font-weight:700;color:${risk}">${lastBig}</td></tr>`;
        }

        const depthHtml = (p.upper_depth != null && p.lower_depth != null)
          ? `<tr><td style="color:#94a3b8;padding:3px 8px 3px 0">Seis. depth</td><td style="font-weight:700">${p.upper_depth}–${p.lower_depth} km</td></tr>` : "";

        const typeColor = p.color || "#94a3b8";
        const tsunamiWarning = p.fault_id === "thrust"
          ? `<div style="color:#38bdf8;font-size:11px;margin:8px 0 4px;padding:6px 8px;background:rgba(56,189,248,0.1);border-radius:6px;border:1px solid rgba(56,189,248,0.2)">🌊 Reverse/thrust fault — tsunami risk if offshore</div>` : "";

        const popupId = "fault-popup-" + Date.now();
        const html = `<div id="${popupId}" style="font-family:Arial,sans-serif;font-size:13px;min-width:240px">
          <div style="color:${typeColor};font-weight:700;font-size:14px;margin-bottom:8px">⚡ ${p.name || "Unnamed Fault"}</div>
          <table style="font-size:12px;width:100%;border-collapse:collapse;margin-bottom:6px">
            <tr><td style="color:#94a3b8;padding:3px 8px 3px 0">Type</td><td style="font-weight:700;color:${typeColor}">${p.slip_type || "—"}</td></tr>
            ${p.dip != null ? `<tr><td style="color:#94a3b8;padding:3px 8px 3px 0">Dip</td><td style="font-weight:700">${Math.round(p.dip)}°</td></tr>` : ""}
            ${p.rake != null ? `<tr><td style="color:#94a3b8;padding:3px 8px 3px 0">Rake</td><td style="font-weight:700">${Math.round(p.rake)}°</td></tr>` : ""}
            ${depthHtml}
            ${recurrenceHtml}
            ${p.catalog ? `<tr><td style="color:#475569;padding:3px 8px 3px 0;font-size:10px">Source</td><td style="font-size:10px;color:#475569">${p.catalog}</td></tr>` : ""}
          </table>
          ${tsunamiWarning}
          <div style="display:flex;gap:6px;margin-top:8px">
            <button onclick="window.__dmFaultSetQuake&&window.__dmFaultSetQuake(${lngLat.lat},${lngLat.lng},'${p.fault_id||"strikeslip"}',${p.dip||45},${p.rake||90})" 
              style="flex:1;padding:7px;background:#f97316;color:white;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-size:12px;font-family:Arial,sans-serif">
              🌍 Set Quake Here
            </button>
            <button onclick="window.__dmFaultClear&&window.__dmFaultClear()"
              style="flex:1;padding:7px;background:transparent;color:#475569;border:1px solid #334155;border-radius:7px;cursor:pointer;font-size:12px;font-family:Arial,sans-serif">
              Clear
            </button>
          </div>
        </div>`;

        new mapboxgl.Popup({ closeButton: true, maxWidth: "300px", className: "elev-popup" })
          .setLngLat(lngLat)
          .setHTML(html)
          .addTo(map);
      });
      map.on("mouseenter", "fault-lines-layer", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "fault-lines-layer", () => { map.getCanvas().style.cursor = "crosshair"; });
    } catch(e) { console.warn("Fault lines error:", e); }
  };

  const addVolcanoes = async () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    try {
      if (map.getLayer("volcano-layer")) map.removeLayer("volcano-layer");
      if (map.getLayer("volcano-super-layer")) map.removeLayer("volcano-super-layer");
      if (map.getSource("volcano-src")) map.removeSource("volcano-src");
    } catch(e) {}
    try {
      const res = await fetch(`${floodEngineUrlRef.current}/volcanoes`, { cache: "force-cache" });
      if (!res.ok) return;
      const data = await res.json();
      map.addSource("volcano-src", { type:"geojson", data });

      // Regular volcanoes
      map.addLayer({ id:"volcano-layer", type:"circle", source:"volcano-src",
        filter:["!=",["get","is_super"],true],
        paint:{
          "circle-color":["get","color"],
          "circle-radius":["interpolate",["linear"],["zoom"],2,3,6,5,10,8],
          "circle-opacity":0.85,
          "circle-stroke-width":1,"circle-stroke-color":"#000","circle-stroke-opacity":0.4,
        }
      });

      // Supervolcanoes — larger, pulsing orange ring
      map.addLayer({ id:"volcano-super-layer", type:"circle", source:"volcano-src",
        filter:["==",["get","is_super"],true],
        paint:{
          "circle-color":"#ff4500",
          "circle-radius":["interpolate",["linear"],["zoom"],2,7,6,12,10,18],
          "circle-opacity":0.95,
          "circle-stroke-width":3,"circle-stroke-color":"#fff","circle-stroke-opacity":0.9,
        }
      });

      // Click handler
      const handleVolcanoClick = (e) => {
        const p = e.features[0].properties;
        const lastEr = p.last_eruption > 0 ? p.last_eruption : (p.last_eruption < 0 ? `${Math.abs(p.last_eruption)} BCE` : "Unknown");
        const superBadge = p.is_super ? `<div style="background:#ff4500;color:white;fontSize:10px;fontWeight:700;padding:2px 8px;borderRadius:8px;display:inline-block;marginBottom:8px;letterSpacing:0.08em">⚠ SUPERVOLCANO</div><br/>` : "";
        const actColor = {"active":"#ef4444","recent":"#f97316","holocene":"#fbbf24","supervolcano":"#ff4500","dormant":"#64748b"}[p.activity]||"#94a3b8";
        new mapboxgl.Popup({ closeButton:true, maxWidth:"320px", className:"elev-popup" })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font-family:Arial,sans-serif;font-size:13px">
            ${superBadge}
            <div style="font-weight:700;font-size:15px;color:#e2e8f0;margin-bottom:6px">🌋 ${p.name}</div>
            <table style="font-size:11px;width:100%;border-collapse:collapse;margin-bottom:8px">
              <tr><td style="color:#94a3b8;padding:2px 8px 2px 0">Type</td><td style="font-weight:700;color:#e2e8f0">${p.type||"—"}</td></tr>
              <tr><td style="color:#94a3b8;padding:2px 8px 2px 0">Country</td><td>${p.country||"—"}</td></tr>
              <tr><td style="color:#94a3b8;padding:2px 8px 2px 0">Elevation</td><td>${p.elevation!=null?p.elevation+"m":"—"}</td></tr>
              <tr><td style="color:#94a3b8;padding:2px 8px 2px 0">Last eruption</td><td style="font-weight:700">${lastEr}</td></tr>
              <tr><td style="color:#94a3b8;padding:2px 8px 2px 0">Activity</td><td style="color:${actColor};font-weight:700">${p.activity}</td></tr>
              <tr><td style="color:#94a3b8;padding:2px 8px 2px 0">Risk</td><td style="color:${actColor}">${p.risk||"—"}</td></tr>
              <tr><td style="color:#94a3b8;padding:2px 8px 2px 0">Tectonic</td><td style="font-size:10px">${(p.tectonic||"").split("/")[0]}</td></tr>
            </table>
            ${p.summary ? `<div style="color:#64748b;font-size:10px;line-height:1.5;margin-bottom:8px">${p.summary}${p.summary.length>=400?"…":""}</div>` : ""}
            ${p.photo ? `<img src="${p.photo}" style="width:100%;border-radius:6px;margin-bottom:8px" onerror="this.style.display='none'"/>` : ""}
            <button onclick="window.__dmEruptVolcano&&window.__dmEruptVolcano(${e.lngLat.lat},${e.lngLat.lng},'${(p.name||"").replace(/'/g,"")}','${(p.type||"").replace(/'/g,"")}',${!!p.is_super})" style="width:100%;padding:10px;background:${p.is_super ? '#ff4500' : '#ea580c'};color:white;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;font-family:Arial,sans-serif">Simulate Eruption</button>
          </div>`)
          .addTo(map);
      };

      map.on("click","volcano-layer", handleVolcanoClick);
      map.on("click","volcano-super-layer", handleVolcanoClick);
      map.on("mouseenter","volcano-layer",()=>{ map.getCanvas().style.cursor="crosshair"; });
      map.on("mouseleave","volcano-layer",()=>{ map.getCanvas().style.cursor=""; });
      map.on("mouseenter","volcano-super-layer",()=>{ map.getCanvas().style.cursor="crosshair"; });
      map.on("mouseleave","volcano-super-layer",()=>{ map.getCanvas().style.cursor=""; });

    } catch(e) { console.warn("Volcano overlay error:", e); }
  };

  const removeVolcanoes = () => {
    const map = mapRef.current;
    if (!map) return;
    ["volcano-layer","volcano-super-layer"].forEach(l => { try { if(map.getLayer(l)) map.removeLayer(l); } catch(e){} });
    try { if(map.getSource("volcano-src")) map.removeSource("volcano-src"); } catch(e) {}
  };

  const removeFaultLines = () => {
    const map = mapRef.current;
    if (!map) return;
    try { if (map.getLayer("fault-lines-layer")) map.removeLayer("fault-lines-layer"); } catch(e) {}
    try { if (map.getSource("fault-lines-src")) map.removeSource("fault-lines-src"); } catch(e) {}
  };

  const toggleOverlay = (type) => {
    const onRef = { megaliths: megalithOnRef, unesco: unescoOnRef, airports: airportOnRef, nuclear: nuclearOnRef, fires: fireOnRef }[type];
    const setter = { megaliths: setMegalithOn, unesco: setUnescoOn, airports: setAirportOn, nuclear: setNuclearOn, fires: setFireOn }[type];
    if (!onRef || !setter) return;
    const next = !onRef.current;
    onRef.current = next; // set ref immediately so re-renders read correct value
    setter(next);         // trigger re-render (useEffect syncs ref again but idempotent)
    if (!next) {
      removeOverlayLayer(type);
      if (overlayPopupRef.current) { overlayPopupRef.current.remove(); overlayPopupRef.current = null; }
    } else {
      addOverlayLayer(type, seaLevelRef.current);
    }
  };

  const openWikiPanel = async (name, wikiUrl, wikidataId, mpId) => {
    if (proTierRef.current === "free") {
      setWikiPanel({ proGate: true, title: name });
      return;
    }
    setWikiPanel({ title: name, extract: null, thumbnail: null, url: wikiUrl, loading: true });
    if (!mpId && wikiUrl && wikiUrl.includes("gem.wiki")) {
      setWikiPanel({ title: name, extract: null, thumbnail: null, url: wikiUrl, loading: false, gemWiki: true });
      return;
    }
    if (mpId) {
      try {
        const cacheKey = `mp_${mpId}`;
        let mpData = null;
        try { const cached = sessionStorage.getItem(cacheKey); if (cached) mpData = JSON.parse(cached); } catch {}
        if (!mpData) {
          const res = await fetch(`${floodEngineUrlRef.current}/megalith-info?id=${mpId}`);
          mpData = res.ok ? await res.json() : null;
          try { if (mpData) sessionStorage.setItem(cacheKey, JSON.stringify(mpData)); } catch {}
        }
        const imgUrl = mpData?.image ? `${floodEngineUrlRef.current}/megalith-image?url=${encodeURIComponent(mpData.image)}` : null;
        setWikiPanel({
          title:      mpData?.title || name,
          extract:    mpData?.description || null,
          thumbnail:  imgUrl,
          url:        `https://www.megalithic.co.uk/article.php?sid=${mpId}`,
          mpUrl:      `https://www.megalithic.co.uk/article.php?sid=${mpId}`,
          mpSubtitle: mpData?.subtitle || null,
          loading:    false,
        });
      } catch {
        setWikiPanel({ title: name, extract: null, thumbnail: null, url: wikiUrl, loading: false });
      }
      return;
    }
    try {
      const slug = encodeURIComponent(name.replace(/ /g, "_"));
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`);
      if (res.ok) {
        const d = await res.json();
        setWikiPanel({ title: d.title || name, extract: d.extract || null, thumbnail: d.thumbnail?.source || null, url: d.content_urls?.desktop?.page || wikiUrl, wikidataId, loading: false });
      } else {
        setWikiPanel({ title: name, extract: null, thumbnail: null, url: wikiUrl, wikidataId, loading: false });
      }
    } catch {
      setWikiPanel({ title: name, extract: null, thumbnail: null, url: wikiUrl, wikidataId, loading: false });
    }
  };



  // Star field animation
  useEffect(() => {
    const canvas = document.getElementById("star-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    const stars = Array.from({ length: 300 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.4 + 0.3,
      alpha: Math.random() * 0.7 + 0.3,
      speed: Math.random() * 0.004 + 0.001,
      phase: Math.random() * Math.PI * 2,
    }));
    const draw = (t) => {
      const W = canvas.width = canvas.offsetWidth;
      const H = canvas.height = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#00001a";
      ctx.fillRect(0, 0, W, H);
      stars.forEach((s) => {
        const a = s.alpha * (0.6 + 0.4 * Math.sin(t * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  useEffect(() => {
    if (!CONFIGURED_FLOOD_ENGINE_URL) { setFloodEngineUrl(FLOOD_ENGINE_PROXY_PATH); return; }
    if (typeof window !== "undefined" && window.location.protocol === "https:" && CONFIGURED_FLOOD_ENGINE_URL.startsWith("http://")) {
      setFloodEngineUrl(FLOOD_ENGINE_PROXY_PATH); return;
    }
    setFloodEngineUrl(CONFIGURED_FLOOD_ENGINE_URL.replace(/\/+$/, ""));
  }, []);

  const metersToFeet = (m) => m * 3.28084;
  const feetToMeters = (f) => f / 3.28084;
  const formatNumericText = (v, d = 2) => String(Number(v.toFixed(d)));
  const formatInputTextFromMeters = (m, unit = unitMode) =>
    unit === "ft" ? formatNumericText(metersToFeet(m), 2) : formatNumericText(m, 2);

  const parseDisplayLevelToMeters = (text, unit = unitMode) => {
    const t = String(text ?? "").trim();
    if (["", "-", "+", ".", "-.", "+."].includes(t)) return null;
    const p = parseFloat(t);
    if (Number.isNaN(p)) return null;
    return unit === "ft" ? feetToMeters(p) : p;
  };

  const commitInputText = (text = inputText, unit = unitMode) => {
    const m = parseDisplayLevelToMeters(text, unit);
    if (m === null) return null;
    setInputLevel(m);
    setInputText(formatInputTextFromMeters(m, unit));
    return m;
  };

  useEffect(() => {
    setInputText(formatInputTextFromMeters(inputLevel, unitMode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitMode]);

  const formatLevelForDisplay = (meters, unit = unitMode) => {
    if (unit === "ft") { const f = Math.round(metersToFeet(meters)); return `${f > 0 ? "+" : ""}${f} ft`; }
    return `${meters > 0 ? "+" : ""}${Math.round(meters)} m`;
  };

  const formatCompactCount = (v) => {
    const n = Number(v);
    return !Number.isFinite(n) || n < 0 ? "--" : Math.round(n).toLocaleString();
  };

  const floodAllowedInCurrentView = () =>
    ["map", "satellite", "globe"].includes(viewModeRef.current);

  const isMapReady = () => !!mapRef.current && mapRef.current.isStyleLoaded();

  const cancelPendingImpactRequest = () => {
    if (impactTimeoutRef.current) { clearTimeout(impactTimeoutRef.current); impactTimeoutRef.current = null; }
    if (impactRequestRef.current) { impactRequestRef.current.abort(); impactRequestRef.current = null; }
  };

  const closeElevPopup = () => {
    if (elevPopupRef.current) {
      elevPopupRef.current.remove();
      elevPopupRef.current = null;
    }
  };

  const showElevPopup = async (lng, lat) => {
    const map = mapRef.current;
    if (!map) return;
    closeElevPopup();

    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      className: "elev-popup",
      maxWidth: "220px",
    });

    popup.setLngLat([lng, lat])
      .setHTML(`
        <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;padding:2px 4px">
          <div style="color:#94a3b8;font-size:11px;margin-bottom:4px">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
          <div style="color:#cbd5e1">Loading elevation...</div>
        </div>
      `)
      .addTo(map);

    elevPopupRef.current = popup;

    try {
      const res = await fetch(
        `${floodEngineUrlRef.current}/elevation?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Elevation fetch failed");
      const data = await res.json();
      const elevM = data.elevation_m;

      if (elevPopupRef.current !== popup) return;

      const currentSeaLevel = seaLevelRef.current;
      const diff = elevM - currentSeaLevel;

      const elevDisplay = unitMode === "ft"
        ? `${Math.round(metersToFeet(elevM))} ft`
        : `${elevM} m`;

      let waterStatus = "";
      if (currentSeaLevel !== 0) {
        if (diff >= 0) {
          const aboveDisplay = unitMode === "ft"
            ? `${Math.round(metersToFeet(diff))} ft`
            : `${diff.toFixed(1)} m`;
          waterStatus = `<div style="color:#86efac;margin-top:4px">Above water by ${aboveDisplay}</div>`;
        } else {
          const belowDisplay = unitMode === "ft"
            ? `${Math.round(metersToFeet(Math.abs(diff)))} ft`
            : `${Math.abs(diff).toFixed(1)} m`;
          waterStatus = `<div style="color:#f87171;margin-top:4px">Underwater by ${belowDisplay}</div>`;
        }
      }

      popup.setHTML(`
        <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;padding:2px 4px">
          <div style="color:#94a3b8;font-size:11px;margin-bottom:4px">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
          <div style="color:#e2e8f0">Elevation: <b>${elevDisplay}</b></div>
          ${waterStatus}
        </div>
      `);
    } catch (e) {
      if (elevPopupRef.current !== popup) return;
      popup.setHTML(`
        <div style="font-family:Arial,sans-serif;font-size:13px;padding:2px 4px">
          <div style="color:#94a3b8;font-size:11px;margin-bottom:4px">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
          <div style="color:#f87171">Elevation unavailable</div>
        </div>
      `);
    }
  };

  // ── Storm Surge ──────────────────────────────────────────────────────────────
  const applySurge = (point, surgeHeight, baseLevel, reachM) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    try { if (map.getLayer(SURGE_LAYER))  map.removeLayer(SURGE_LAYER);  } catch(e) {}
    try { if (map.getSource(SURGE_SOURCE)) map.removeSource(SURGE_SOURCE); } catch(e) {}
    if (!point || surgeHeight <= 0) return;
    const totalLevel = baseLevel + surgeHeight;
    const url = `${floodEngineUrlRef.current}/flood-region/${encodeURIComponent(totalLevel)}/${encodeURIComponent(point.lat)}/${encodeURIComponent(point.lng)}/${encodeURIComponent(reachM)}/{z}/{x}/{y}.png?v=${FLOOD_TILE_VERSION}`;
    map.addSource(SURGE_SOURCE, { type: "raster", tiles: [url], tileSize: 256, minzoom: 0, maxzoom: 12 });
    map.addLayer({ id: SURGE_LAYER, type: "raster", source: SURGE_SOURCE,
      paint: { "raster-opacity": 0.72, "raster-opacity-transition": { duration: 400 } } });
    map.triggerRepaint();
  };

  const clearSurge = () => {
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) {
      try { if (map.getLayer(SURGE_LAYER))  map.removeLayer(SURGE_LAYER);  } catch(e) {}
      try { if (map.getSource(SURGE_SOURCE)) map.removeSource(SURGE_SOURCE); } catch(e) {}
    }
    if (surgeMarker.current) { surgeMarker.current.remove(); surgeMarker.current = null; }
    if (surgePopupRef.current) { surgePopupRef.current.remove(); surgePopupRef.current = null; }
    clearSurgeTrack();
    setSurgeOn(false); surgeOnRef.current = false;
    setSurgePoint(null); surgePointRef.current = null;
    setSurgeMode("place"); surgeModeRef.current = "place";
    setSurgePreset(null); surgePresetRef.current = null;
  };

  const getSurgeReach = () => {
    if (surgePreset) {
      const p = SURGE_PRESETS.find(p => p.id === surgePreset);
      return p ? p.reach : surgeRef.current * 20000;
    }
    return surgeRef.current * 20000;
  };

  const selectSurgePreset = (preset) => {
    setSurgePreset(preset.id); surgePresetRef.current = preset.id;
    setSurgeM(preset.height); surgeRef.current = preset.height;
    if (surgePointRef.current) {
      applySurge(surgePointRef.current, preset.height, seaLevelRef.current, preset.reach);
    }
  };

  const activateSurge = () => {
    // Called by Trigger button — arms surge placement mode
    const isPro = proTierRef.current !== "free";
    if (!isPro) { setPaywallModal("pro"); return; }
    setSurgeOn(true); surgeOnRef.current = true;
    setSurgeMode("place"); surgeModeRef.current = "place";
    window.__dmClearSurge = clearSurge;
  };
  if (typeof window !== "undefined") window.__dmClearSurge = surgeOnRef.current ? clearSurge : null;

  const placeSurgePoint = (lat, lng) => {
    if (surgeMarker.current) { surgeMarker.current.remove(); surgeMarker.current = null; }
    const map = mapRef.current;
    if (!map) return;
    const el = document.createElement("div");
    el.style.cssText = "width:22px;height:22px;border-radius:50%;background:#38bdf8;border:2.5px solid #fff;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.5);";
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (surgeMarker.current) { surgeMarker.current.remove(); surgeMarker.current = null; }
      setSurgePoint(null); surgePointRef.current = null;
      setSurgeMode("place"); surgeModeRef.current = "place";
      clearSurge();
    });
    const marker = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat([lng, lat]).addTo(map);
    surgeMarker.current = marker;
    setSurgePoint({ lat, lng }); surgePointRef.current = { lat, lng };
    setSurgeMode("active"); surgeModeRef.current = "active";
    window.__dmClearSurge = clearSurge;
    applySurge({ lat, lng }, surgeRef.current, seaLevelRef.current, getSurgeReach());
  };

  // ── Storm Track (Pro) ────────────────────────────────────────────────────────
  const clearSurgeTrack = () => {
    const map = mapRef.current;
    // Remove flood layers
    surgeTrackLayers.current.forEach(({ sourceId, layerId, marker }) => {
      if (layerId) try { if (map && map.getLayer(layerId))  map.removeLayer(layerId);  } catch(e) {}
      if (sourceId) try { if (map && map.getSource(sourceId)) map.removeSource(sourceId); } catch(e) {}
      if (marker) marker.remove();
    });
    surgeTrackLayers.current = [];
    // Remove track line and arrows
    if (map) {
      try { if (map.getLayer("surge-track-line"))   map.removeLayer("surge-track-line");   } catch(e) {}
      try { if (map.getLayer("surge-track-arrows")) map.removeLayer("surge-track-arrows"); } catch(e) {}
      try { if (map.getSource("surge-track-src"))   map.removeSource("surge-track-src");   } catch(e) {}

      surgeTrackLine.current = null;
    }
    setSurgeTrackPts([]); surgeTrackPtsRef.current = [];
  };

  const updateTrackLine = (pts) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || pts.length < 2) return;
    const coords = pts.map(p => [p.lng, p.lat]);
    const lineGeo = { type:"FeatureCollection", features:[
      { type:"Feature", geometry:{ type:"LineString", coordinates:coords } }] };
    try {
      try { map.removeLayer("surge-track-line"); } catch(e) {}
      try { map.removeSource("surge-track-src"); } catch(e) {}
      map.addSource("surge-track-src", { type:"geojson", data:lineGeo });
      map.addLayer({ id:"surge-track-line", type:"line", source:"surge-track-src",
        paint:{ "line-color":"#38bdf8", "line-width":3, "line-dasharray":[4,2], "line-opacity":0.9 } });
      surgeTrackLine.current = true;
    } catch(e) {}
  };

  const addTrackPoint = (lat, lng) => {
    const map = mapRef.current;
    const pts = surgeTrackPtsRef.current;
    if (pts.length >= 3) return;

    // Add numbered marker only — no flood tiles yet
    const el = document.createElement("div");
    const idx = pts.length;
    el.style.cssText = `width:28px;height:28px;border-radius:50%;background:#38bdf8;border:2.5px solid #fff;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#0f172a;`;
    el.textContent = idx + 1;
    const marker = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat([lng, lat]).addTo(map);

    const newPts = [...pts, { lat, lng }];
    surgeTrackLayers.current.push({ sourceId: null, layerId: null, marker });
    surgeTrackPtsRef.current = newPts;
    setSurgeTrackPts([...newPts]);
    updateTrackLine(newPts);
  };

  const triggerSurgeTrack = () => {
    // Render flood layers for all placed track points
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const pts = surgeTrackPtsRef.current;
    if (pts.length === 0) return;
    const preset = SURGE_PRESETS.find(p => p.id === surgePresetRef.current);
    const reachM = preset ? preset.reach : surgeRef.current * 20000;
    const totalLevel = seaLevelRef.current + surgeRef.current;
    // Remove old flood layers but keep markers
    surgeTrackLayers.current.forEach(({ sourceId, layerId }) => {
      if (layerId) try { map.removeLayer(layerId); } catch(e) {}
      if (sourceId) try { map.removeSource(sourceId); } catch(e) {}
    });
    // Add fresh flood layers for each point
    surgeTrackLayers.current = surgeTrackLayers.current.map((entry, idx) => {
      const pt = pts[idx];
      const sourceId = `surge-flood-src-${idx}`;
      const layerId  = `surge-flood-layer-${idx}`;
      const url = `${floodEngineUrlRef.current}/flood-region/${encodeURIComponent(totalLevel)}/${encodeURIComponent(pt.lat)}/${encodeURIComponent(pt.lng)}/${encodeURIComponent(reachM)}/{z}/{x}/{y}.png?v=${FLOOD_TILE_VERSION}`;
      try {
        map.addSource(sourceId, { type: "raster", tiles: [url], tileSize: 256, minzoom: 0, maxzoom: 12 });
        map.addLayer({ id: layerId, type: "raster", source: sourceId,
          paint: { "raster-opacity": 0.72, "raster-opacity-transition": { duration: 400 } } });
      } catch(e) {}
      return { ...entry, sourceId, layerId };
    });
    map.triggerRepaint();
  };

  const showSurgePopup = (lng, lat) => {
    const map = mapRef.current;
    if (!map) return;
    if (surgePopupRef.current) { surgePopupRef.current.remove(); surgePopupRef.current = null; }
    const preset = SURGE_PRESETS.find(p => p.id === surgePresetRef.current) || null;

    // Check if click is within surge reach radius
    const sp = surgePointRef.current;
    if (sp) {
      const R = 6371000; // Earth radius m
      const dLat = (lat - sp.lat) * Math.PI / 180;
      const dLng = (lng - sp.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(sp.lat*Math.PI/180) * Math.cos(lat*Math.PI/180) * Math.sin(dLng/2)**2;
      const distM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const reachM = preset ? preset.reach : surgeRef.current * 20000;
      if (distM > reachM) {
        const popup = new mapboxgl.Popup({ closeButton: true, maxWidth: "220px", className: "dm-dark-popup" })
          .setLngLat([lng, lat])
          .setHTML(`<div style="font-family:Arial,sans-serif;background:#0f172a;color:#94a3b8;padding:4px;font-size:12px">📍 Outside surge zone<br/><span style="font-size:11px;color:#475569">${Math.round(distM/1000)}km from origin · reach ${Math.round(reachM/1000)}km</span></div>`)
          .addTo(map);
        surgePopupRef.current = popup;
        return;
      }
    }

    const cat = preset ? preset.label : "Custom";
    const windKmh = preset ? preset.wind_kmh : "—";
    const windMph = preset ? preset.wind_mph : "—";
    const example = preset ? preset.example : "";
    const color = preset ? preset.color : "#38bdf8";
    const rows = [
      ["Surge Height", `+${surgeRef.current} m`],
      ["Wind Speed",   `${windKmh} km/h`],
      ["Wind (mph)",   `${windMph} mph`],
      ["Reach Radius", `${preset ? (preset.reach/1000).toFixed(0) : "—"} km`],
    ];
    const html = `<div style="font-family:Arial,sans-serif;min-width:220px;max-width:280px">
      <div style="font-size:14px;font-weight:700;color:${color};margin-bottom:8px">🌀 ${cat} Storm Surge</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px">
        ${rows.map(([k,v]) => `<tr><td style="padding:2px 8px 2px 0;color:#94a3b8">${k}</td><td style="font-weight:700">${v}</td></tr>`).join("")}
      </table>
      ${example ? `<div style="font-size:11px;color:#64748b;border-top:1px solid #334155;padding-top:6px;line-height:1.4;margin-bottom:8px">${example}</div>` : ""}
      <button onclick="window.__dmClearSurge&&window.__dmClearSurge()" style="width:100%;padding:6px;background:transparent;border:1px solid #334155;border-radius:6px;cursor:pointer;font-size:11px">✕ Clear Surge</button>
    </div>`;
    const popup = new mapboxgl.Popup({ closeButton: true, maxWidth: "300px",
      className: "dm-dark-popup" })
      .setLngLat([lng, lat])
      .setHTML(html)
      .addTo(map);
    surgePopupRef.current = popup;
  };

  // ── Earthquake simulation ────────────────────────────────────────────────────
  const clearEarthquake = () => {
    const map = mapRef.current;
    // Remove line layer first (it depends on liq source)
    try { if (map && map.getLayer("eq-liq-layer-line")) map.removeLayer("eq-liq-layer-line"); } catch(e) {}
    eqLayers.current.forEach(({ sourceId, layerId }) => {
      if (layerId) try { if (map && map.getLayer(layerId))  map.removeLayer(layerId);  } catch(e) {}
      if (sourceId) try { if (map && map.getSource(sourceId)) map.removeSource(sourceId); } catch(e) {}
    });
    eqLayers.current = [];
    // Also explicitly clear tsunami layers in case added async
    try { if (map && map.getLayer("eq-tsunami-layer")) map.removeLayer("eq-tsunami-layer"); } catch(e) {}
    try { if (map && map.getSource("eq-tsunami-src")) map.removeSource("eq-tsunami-src"); } catch(e) {}
    // Clear flood tiles per impact point
    for (let i = 0; i < 12; i++) {
      try { if (map && map.getLayer(`eq-ts-flood-layer-${i}`)) map.removeLayer(`eq-ts-flood-layer-${i}`); } catch(e) {}
      try { if (map && map.getSource(`eq-ts-flood-src-${i}`)) map.removeSource(`eq-ts-flood-src-${i}`); } catch(e) {}
    }
    if (eqMarker.current) { eqMarker.current.remove(); eqMarker.current = null; }
    setEqResult(null);
    setEqPoint(null); eqPointRef.current = null;
  };

  const runEarthquake = (lat, lng, mag, depthId, faultId) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    clearEarthquake();

    const depthType = EQ_DEPTH_TYPES.find(d => d.id === depthId) || EQ_DEPTH_TYPES[0];
    const faultType = EQ_FAULT_TYPES.find(f => f.id === faultId) || EQ_FAULT_TYPES[0];
    const strike = eqStrikeRef.current;
    const dip    = eqDipRef.current;
    const rake   = eqRakeRef.current;
    const rings = eqIntensityRings(mag, depthType.depth, faultId);
    const liqRadiusKm = eqLiquefactionRadius(mag, depthType.depth);
    const casualties = eqCasualtyEstimate(mag, depthType.depth);

    const newLayers = [];

    // Draw rings largest → smallest so smaller ones render on top
    [...rings].reverse().forEach((ring, ri) => {
      const sourceId = `eq-ring-src-${ri}`;
      const layerId  = `eq-ring-layer-${ri}`;
      const geo = eqRingGeoJSON(lat, lng, ring.radiusKm);
      try {
        map.addSource(sourceId, { type: "geojson", data: geo });
        map.addLayer({ id: layerId, type: "fill", source: sourceId,
          paint: { "fill-color": ring.color, "fill-opacity": ring.opacity } });
        newLayers.push({ sourceId, layerId });
      } catch(e) {}
    });

    // Liquefaction overlay — teal hatch approximation
    const liqSourceId = "eq-liq-src";
    const liqLayerId  = "eq-liq-layer";
    const liqGeo = eqRingGeoJSON(lat, lng, liqRadiusKm);
    try {
      map.addSource(liqSourceId, { type: "geojson", data: liqGeo });
      map.addLayer({ id: liqLayerId, type: "fill", source: liqSourceId,
        paint: { "fill-color": "#0d9488", "fill-opacity": 0.22, "fill-outline-color": "#0d9488" } });
      // Add outline ring
      map.addLayer({ id: liqLayerId + "-line", type: "line", source: liqSourceId,
        paint: { "line-color": "#0d9488", "line-width": 2, "line-dasharray": [3, 3], "line-opacity": 0.7 } });
      newLayers.push({ sourceId: liqSourceId, layerId: liqLayerId });
      newLayers.push({ sourceId: null, layerId: liqLayerId + "-line" }); // line layer — source already tracked
    } catch(e) {}

    eqLayers.current = newLayers;
    setEqView("rings"); // always start on rings view
    setEqPoint({ lat, lng }); eqPointRef.current = { lat, lng };

    // Auto-trigger tsunami if M7.5+ thrust/normal fault
    const isPro = proTierRef.current !== "free";
    const tsunamiRisk = faultType.tsunami && mag >= 7.5;
    if (tsunamiRisk && isPro) {
      const depthKm = depthType.depth;
      const tSrcId = "eq-tsunami-src";
      const tLayerId = "eq-tsunami-layer";

      // Use hardcoded historical data for known presets, fall back to engine otherwise
      const presetKey = EQ_PRESETS.find(p => Math.abs(p.lat - lat) < 0.1 && Math.abs(p.lng - lng) < 0.1)?.label;
      const hardcoded = presetKey && PRESET_TSUNAMI_IMPACTS[presetKey];

      const processResult = (tsResult) => {
          console.log("🌊 Tsunami result:", tsResult?.tsunami_impacts?.length, "impacts, error:", tsResult?.error);
          if (!tsResult || tsResult.error) { console.warn("Tsunami sim error:", tsResult?.error, tsResult?.trace); return; }
          const mapNow = mapRef.current;
          if (!mapNow || !mapNow.isStyleLoaded()) return;
          const features = (tsResult.tsunami_impacts || []).map((imp) => ({
            type:"Feature",
            geometry:{ type:"Point", coordinates:[imp.lng, imp.lat] },
            properties:{
              arrival_min: imp.arrival_min,
              wave_height: imp.wave_height_m,
              color: imp.band_color,
              label: imp.band_label,
              warning: imp.warning,
              distance_km: imp.distance_km,
            }
          }));
          if (features.length === 0) return;
          // Dots layer
          try {
            if (mapNow.getLayer(tLayerId)) mapNow.removeLayer(tLayerId);
            if (mapNow.getSource(tSrcId)) mapNow.removeSource(tSrcId);
            mapNow.addSource(tSrcId, { type:"geojson", data:{ type:"FeatureCollection", features } });
            mapNow.addLayer({ id:tLayerId, type:"circle", source:tSrcId, paint:{
              "circle-radius":["interpolate",["linear"],["zoom"],2,5,6,9,10,14],
              "circle-color":["get","color"],
              "circle-opacity":0.9,
              "circle-stroke-width":1.5,
              "circle-stroke-color":"#fff",
              "circle-stroke-opacity":0.6,
            }});
            eqLayers.current.push({ sourceId:tSrcId, layerId:tLayerId });
            mapNow.on("click", tLayerId, (e) => {
              const p = e.features[0].properties;
              const arrFmt = p.arrival_min < 60
                ? `${Math.round(p.arrival_min)} min`
                : `${(p.arrival_min/60).toFixed(1)} hrs`;
              new mapboxgl.Popup({ closeButton:true, maxWidth:"260px", className:"dm-dark-popup" })
                .setLngLat(e.lngLat)
                .setHTML(`<div style="font-family:Arial,sans-serif">
                  <div style="font-size:13px;font-weight:700;color:${p.color};margin-bottom:8px">🌊 ${p.label}</div>
                  <table style="font-size:11px;width:100%;border-collapse:collapse">
                    <tr><td style="color:#94a3b8;padding:2px 8px 2px 0">Arrival time</td><td style="font-weight:700">${arrFmt}</td></tr>
                    <tr><td style="color:#94a3b8;padding:2px 8px 2px 0">Wave height</td><td style="font-weight:700">~${p.wave_height} m</td></tr>
                    <tr><td style="color:#94a3b8;padding:2px 8px 2px 0">Distance</td><td style="font-weight:700">${Math.round(p.distance_km)} km</td></tr>
                    <tr><td style="color:#94a3b8;padding:2px 8px 2px 0">Alert level</td><td style="font-weight:700">${p.warning}</td></tr>
                  </table>
                </div>`)
                .addTo(mapNow);
            });
            mapNow.on("mouseenter", tLayerId, () => { mapNow.getCanvas().style.cursor="pointer"; });
            mapNow.on("mouseleave", tLayerId, () => { mapNow.getCanvas().style.cursor=""; });
          } catch(e) { console.warn("Tsunami dots error:", e); }

          // flood-bbox ellipse derived from fault geometry
          try {
            // Single flood tile centered on epicenter — elevation pyramid stops it at terrain
            // Use max wave height for flood level, furthest impact for reach
            const impacts = tsResult.tsunami_impacts || [];
            if (impacts.length > 0) {
              const maxWave = Math.max(...impacts.map(i => i.wave_height_m));
              const maxReachM = Math.max(...impacts.map(i => i.distance_km * 1000));
              const floodLevel = Math.max(3, Math.min(maxWave * 0.5, 25));
              const reachM = Math.min(maxReachM * 1.2, 3000000); // 20% buffer, max 3000km
              const fSrc = "eq-ts-flood-src-0", fLay = "eq-ts-flood-layer-0";
              const tUrl = `${floodEngineUrlRef.current}/flood-region/${encodeURIComponent(floodLevel)}/${encodeURIComponent(lat)}/${encodeURIComponent(lng)}/${encodeURIComponent(reachM)}/{z}/{x}/{y}.png?v=204`;
              try {
                if (mapNow.getLayer(fLay)) mapNow.removeLayer(fLay);
                if (mapNow.getSource(fSrc)) mapNow.removeSource(fSrc);
                mapNow.addSource(fSrc, { type:"raster", tiles:[tUrl], tileSize:256, minzoom:0, maxzoom:12 });
                mapNow.addLayer({ id:fLay, type:"raster", source:fSrc, layout:{visibility:"visible"}, paint:{"raster-opacity":0.7,"raster-opacity-transition":{duration:500}} });
                eqLayers.current.push({ sourceId:fSrc, layerId:fLay });
              } catch(e) { console.warn("flood tile add error:", e); }
            }
          } catch(e) { console.warn("EQ flood tile error:", e); }

          // Switch to tsunami view to show flood tiles
          setEqView("tsunami");
          mapNow.triggerRepaint();
      };  // end processResult

      // Dispatch: use hardcoded preset data or hit the engine
      if (hardcoded) {
        console.log("🌊 Using hardcoded data for:", presetKey);
        // Dots first
        const synth = { tsunami_impacts: hardcoded.impacts };
        processResult(synth);
        // Per-dot flood tiles after dots render
        setTimeout(() => {
          const mapNow = mapRef.current;
          if (!mapNow || !mapNow.isStyleLoaded()) return;
          // Single tile from epicenter — covers all impacted coasts, elevation stops inland spread
          const maxWave = Math.max(...hardcoded.impacts.map(i => i.wave_height_m));
          const maxReachM = Math.max(...hardcoded.impacts.map(i => i.distance_km * 1000));
          const floodLevel = Math.max(3, Math.min(maxWave * 0.5, 25));
          const reachM = Math.min(maxReachM * 1.2, 3000000);
          const fSrc = "eq-ts-flood-src-0", fLay = "eq-ts-flood-layer-0";
          const tUrl = `${floodEngineUrlRef.current}/flood-region/${encodeURIComponent(floodLevel)}/${encodeURIComponent(lat)}/${encodeURIComponent(lng)}/${encodeURIComponent(reachM)}/{z}/{x}/{y}.png?v=204`;
          try {
            if (mapNow.getLayer(fLay)) mapNow.removeLayer(fLay);
            if (mapNow.getSource(fSrc)) mapNow.removeSource(fSrc);
            mapNow.addSource(fSrc, { type:"raster", tiles:[tUrl], tileSize:256, minzoom:0, maxzoom:12 });
            mapNow.addLayer({ id:fLay, type:"raster", source:fSrc, layout:{visibility:"visible"}, paint:{"raster-opacity":0.7,"raster-opacity-transition":{duration:500}} });
            eqLayers.current.push({ sourceId:fSrc, layerId:fLay });
          } catch(e) { console.warn("hardcoded flood tile error:", e); }
        }, 300);
      } else {
        const tsUrl = `${floodEngineUrlRef.current}/tsunami-simulate?lat=${lat}&lng=${lng}&mag=${mag}&strike=${strike}&dip=${dip}&rake=${rake}&depth_km=${depthKm}&n_rays=120`;
        console.log("🌊 Tsunami fetch:", tsUrl);
        fetch(tsUrl)
          .then(r => r.json())
          .then(processResult)
          .catch(e => console.warn("Tsunami fetch error:", e));
      }
    }

    setEqResult({ mag, depthType, faultType, rings, casualties, tsunamiRisk, isPro, liqRadiusKm });
    map.triggerRepaint();
  };

  const triggerEarthquake = () => {
    if (!eqPointRef.current) return;
    const { lat, lng } = eqPointRef.current;
    runEarthquake(lat, lng, eqMagRef.current, eqDepthRef.current, eqFaultRef.current);
  };

  const loadEqPreset = (preset) => {
    setEqMag(preset.mag); eqMagRef.current = preset.mag;
    setEqDepthId(preset.depthId); eqDepthRef.current = preset.depthId;
    setEqFaultId(preset.faultId); eqFaultRef.current = preset.faultId;
    if (preset.strike != null) { setEqStrike(preset.strike); eqStrikeRef.current = preset.strike; }
    if (preset.dip    != null) { setEqDip(preset.dip);       eqDipRef.current    = preset.dip;    }
    if (preset.rake   != null) { setEqRake(preset.rake);     eqRakeRef.current   = preset.rake;   }
    setScenarioMode("earthquake"); scenarioModeRef.current = "earthquake";
    const map = mapRef.current;
    if (!map) return;
    // Clear old state
    clearEarthquake();
    // Place marker immediately
    const el = document.createElement("div");
    el.style.cssText = "width:24px;height:24px;background:#fbbf24;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 3px #f59e0b,0 2px 8px rgba(0,0,0,0.5);cursor:pointer;";
    eqMarker.current = new mapboxgl.Marker({ element: el, anchor:"center" }).setLngLat([preset.lng, preset.lat]).addTo(map);
    setEqPoint({ lat: preset.lat, lng: preset.lng }); eqPointRef.current = { lat: preset.lat, lng: preset.lng };
    map.flyTo({ center: [preset.lng, preset.lat], zoom: 7, duration: 1200 });
    // Run after fly completes
    setTimeout(() => runEarthquake(preset.lat, preset.lng, preset.mag, preset.depthId, preset.faultId), 1500);
  };

  const applyProjectionForMode = (mode) => {
    const map = mapRef.current;
    if (!map) return;
    // Always globe projection — never mercator
    safely(() => map.setProjection("globe"));
    safely(() => map.setPitch(0)); safely(() => map.setBearing(0));
    // Globe view (Pro) enables free rotate; standard/satellite locks it
    if (mode === "globe") {
      safely(() => map.dragRotate.enable());
      safely(() => map.touchZoomRotate.enableRotation());
    } else {
      safely(() => map.dragRotate.disable());
      safely(() => map.touchZoomRotate.disableRotation());
    }
  };

  const removeImpactFloodLayers = () => {
    const map = mapRef.current;
    impactFloodLayersRef.current.forEach(({ sourceId, layerId }) => {
      try { if (map && map.getLayer(layerId)) map.removeLayer(layerId); } catch(e){}
      try { if (map && map.getSource(sourceId)) map.removeSource(sourceId); } catch(e){}
    });
    impactFloodLayersRef.current = [];
  };

  const removeFloodLayer = () => {
    const map = mapRef.current;
    if (!map) { activeFloodLevelRef.current = null; return; }
    try {
      if (map.getLayer(FLOOD_LAYER_ID)) map.removeLayer(FLOOD_LAYER_ID);
      if (map.getSource(FLOOD_SOURCE_ID)) map.removeSource(FLOOD_SOURCE_ID);
    } catch (e) { console.warn("Failed removing flood layer:", e); }
    activeFloodLevelRef.current = null;
    // Also clear any cumulative impact flood layers
    removeImpactFloodLayers();
  };

  const removeImpactPreviewLayers = () => {
    const map = mapRef.current;
    if (!map) return;
    if (impactPulseFrameRef.current) { cancelAnimationFrame(impactPulseFrameRef.current); impactPulseFrameRef.current = null; }
    // Base layer IDs (single impact or idx=0)
    const baseIds = [
      `${IMPACT_CRATER_LAYER_ID}-pulse`, `${IMPACT_CRATER_LAYER_ID}-inner`,
      `${IMPACT_CRATER_LAYER_ID}-rim`, `${IMPACT_CRATER_LAYER_ID}-ejecta`,
      `${IMPACT_CRATER_LAYER_ID}-ejecta-line`,
      `${IMPACT_BLAST_LAYER_ID}-fill`, IMPACT_THERMAL_LAYER_ID,
      `${IMPACT_THERMAL_LAYER_ID}-line`,
      IMPACT_BLAST_LAYER_ID, IMPACT_CRATER_LAYER_ID,
    ];
    // Also remove indexed variants for multi-impact (up to 3)
    const indexedIds = [];
    for (let i = 0; i < 3; i++) {
      indexedIds.push(
        `${IMPACT_THERMAL_LAYER_ID}-${i}`, `${IMPACT_THERMAL_LAYER_ID}-line-${i}`,
        `${IMPACT_BLAST_LAYER_ID}-fill-${i}`, `${IMPACT_BLAST_LAYER_ID}-${i}`,
        `${IMPACT_CRATER_LAYER_ID}-ejecta-${i}`, `${IMPACT_CRATER_LAYER_ID}-ejecta-line-${i}`,
        `${IMPACT_CRATER_LAYER_ID}-rim-${i}`, `${IMPACT_CRATER_LAYER_ID}-${i}`,
        `${IMPACT_CRATER_LAYER_ID}-inner-${i}`, `${IMPACT_CRATER_LAYER_ID}-pulse-${i}`,
        // Ocean marker layers (distinct prefix to avoid land layer collisions)
        `impact-ocean-marker-${i}`, `impact-ocean-marker-pulse-${i}`,
      );
    }
    try {
      [...baseIds, ...indexedIds].forEach((id) => { try { if (map.getLayer(id)) map.removeLayer(id); } catch(e){} });
      if (map.getSource(IMPACT_PREVIEW_SOURCE_ID)) map.removeSource(IMPACT_PREVIEW_SOURCE_ID);
      for (let i = 0; i < 3; i++) {
        const srcId = `${IMPACT_PREVIEW_SOURCE_ID}-${i}`;
        try { if (map.getSource(srcId)) map.removeSource(srcId); } catch(e){}
        // Ocean marker sources
        try { if (map.getSource(`impact-ocean-source-${i}`)) map.removeSource(`impact-ocean-source-${i}`); } catch(e){}
      }
    } catch (e) { console.warn("Failed clearing impact preview layers:", e); }
  };

  const clearImpactPreview = () => { removeFloodLayer(); removeImpactPreviewLayers(); removeImpactFloodLayers(); impactDrawingRef.current = false; };

  const removeImpactPoint = () => {
    const map = mapRef.current;
    // Remove all multi-impact markers
    impactPointsRef.current.forEach(p => { try { p.marker && p.marker.remove(); } catch(e){} });
    impactPointsRef.current = [];
    setImpactPoints([]);
    if (!map) { impactPointRef.current = null; return; }
    try {
      if (map.getLayer(IMPACT_LAYER_ID)) map.removeLayer(IMPACT_LAYER_ID);
      if (map.getSource(IMPACT_SOURCE_ID)) map.removeSource(IMPACT_SOURCE_ID);
    } catch (e) { console.warn("Failed removing impact point:", e); }
    clearImpactPreview();
    impactPointRef.current = null;
  };

  const drawImpactPoint = (lng, lat) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const data = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] } }] };
    try {
      if (!map.getSource(IMPACT_SOURCE_ID)) {
        map.addSource(IMPACT_SOURCE_ID, { type: "geojson", data });
        map.addLayer({ id: IMPACT_LAYER_ID, type: "circle", source: IMPACT_SOURCE_ID, paint: { "circle-radius": 8, "circle-color": "#ef4444", "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" } });
      } else { map.getSource(IMPACT_SOURCE_ID).setData(data); }
      impactPointRef.current = { lng, lat };
      safely(() => map.triggerRepaint());
    } catch (e) { console.error("Failed to draw impact point", e); }
  };

  const kmCircle = (lng, lat, radiusKm, steps = 96) => {
    const coords = [];
    const kpLat = 110.574;
    const kpLng = 111.32 * Math.cos((lat * Math.PI) / 180);
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      coords.push([lng + (Math.cos(t) * radiusKm) / Math.max(kpLng, 0.0001), lat + (Math.sin(t) * radiusKm) / kpLat]);
    }
    return { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} };
  };

  const startImpactPulseAnimation = () => {
    const map = mapRef.current;
    if (!map) return;
    if (impactPulseFrameRef.current) { cancelAnimationFrame(impactPulseFrameRef.current); impactPulseFrameRef.current = null; }
    const layerId = `${IMPACT_CRATER_LAYER_ID}-pulse`;
    const start = performance.now();
    const tick = (now) => {
      if (!mapRef.current || !mapRef.current.getLayer(layerId)) { impactPulseFrameRef.current = null; return; }
      const pulse = (Math.sin(((now - start) / 1000) * 2.6) + 1) / 2;
      safely(() => {
        const layer = mapRef.current.getLayer(layerId);
        if (!layer) return;
        if (layer.type === "line") {
          mapRef.current.setPaintProperty(layerId, "line-width", 2.5 + pulse * 1.2);
          mapRef.current.setPaintProperty(layerId, "line-opacity", 0.72 + pulse * 0.2);
        }
        if (layer.type === "circle") {
          mapRef.current.setPaintProperty(layerId, "circle-radius", 20 + pulse * 14);
          mapRef.current.setPaintProperty(layerId, "circle-stroke-opacity", 0.45 + pulse * 0.35);
        }
      });
      impactPulseFrameRef.current = requestAnimationFrame(tick);
    };
    impactPulseFrameRef.current = requestAnimationFrame(tick);
  };

  const getImpactPreviewRadiiKm = (d) => {
    const dm = Math.max(50, Math.min(20000, Number(d) || 1000));
    return { crater: Math.max(0.25, dm * 0.0006), blast: Math.max(1, dm * 0.006), thermal: Math.max(2, dm * 0.012) };
  };

  const drawImpactPreview = (lng, lat, diameterM) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    clearImpactPreview();
    const r = getImpactPreviewRadiiKm(diameterM);
    const data = { type: "FeatureCollection", features: [
      { ...kmCircle(lng, lat, r.crater), properties: { kind: "crater" } },
      { ...kmCircle(lng, lat, r.blast), properties: { kind: "blast" } },
      { ...kmCircle(lng, lat, r.thermal), properties: { kind: "thermal" } },
    ]};
    try {
      map.addSource(IMPACT_PREVIEW_SOURCE_ID, { type: "geojson", data });
      // Preview: colored zones with dashed borders to distinguish from final result
      map.addLayer({ id: IMPACT_THERMAL_LAYER_ID, type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "thermal"], paint: { "fill-color": "#f97316", "fill-opacity": 0.10 } });
      map.addLayer({ id: `${IMPACT_THERMAL_LAYER_ID}-line`, type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "thermal"], paint: { "line-color": "#f97316", "line-width": 2, "line-opacity": 0.6, "line-dasharray": [4, 3] } });
      map.addLayer({ id: IMPACT_BLAST_LAYER_ID, type: "line", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "blast"], paint: { "line-color": "#ef4444", "line-width": 2.5, "line-opacity": 0.7, "line-dasharray": [4, 3] } });
      map.addLayer({ id: IMPACT_CRATER_LAYER_ID, type: "fill", source: IMPACT_PREVIEW_SOURCE_ID, filter: ["==", ["get", "kind"], "crater"], paint: { "fill-color": "#000000", "fill-opacity": 0.40 } });
      safely(() => map.triggerRepaint());
    } catch (e) { console.error("Failed to draw impact preview", e); }
  };

  const drawLandImpactFromResult = (lng, lat, result, idx = null) => {
    const map = mapRef.current;
    if (!map || !result) return;
    const craterKm = Number(result.crater_diameter_m ?? 0) / 2000;
    const blastKm = Number(result.blast_radius_m ?? 0) / 1000;
    const thermalKm = Number(result.thermal_radius_m ?? 0) / 1000;
    const data = { type: "FeatureCollection", features: [
      { ...kmCircle(lng, lat, thermalKm), properties: { kind: "thermal" } },
      { ...kmCircle(lng, lat, blastKm), properties: { kind: "blast-fill" } },
      { ...kmCircle(lng, lat, blastKm), properties: { kind: "blast" } },
      { ...kmCircle(lng, lat, craterKm * 1.55), properties: { kind: "ejecta" } },
      { ...kmCircle(lng, lat, craterKm * 1.08), properties: { kind: "crater-rim" } },
      { ...kmCircle(lng, lat, craterKm), properties: { kind: "crater" } },
      { ...kmCircle(lng, lat, craterKm * 0.72), properties: { kind: "crater-inner" } },
    ]};
    // Use indexed IDs for multi-impact so layers accumulate rather than replace
    const srcId  = idx != null ? `${IMPACT_PREVIEW_SOURCE_ID}-${idx}` : IMPACT_PREVIEW_SOURCE_ID;
    const thId   = idx != null ? `${IMPACT_THERMAL_LAYER_ID}-${idx}`  : IMPACT_THERMAL_LAYER_ID;
    const blFId  = idx != null ? `${IMPACT_BLAST_LAYER_ID}-fill-${idx}` : `${IMPACT_BLAST_LAYER_ID}-fill`;
    const blId   = idx != null ? `${IMPACT_BLAST_LAYER_ID}-${idx}`   : IMPACT_BLAST_LAYER_ID;
    const ejId   = idx != null ? `${IMPACT_CRATER_LAYER_ID}-ejecta-${idx}` : `${IMPACT_CRATER_LAYER_ID}-ejecta`;
    const ejLId  = idx != null ? `${IMPACT_CRATER_LAYER_ID}-ejecta-line-${idx}` : `${IMPACT_CRATER_LAYER_ID}-ejecta-line`;
    const rimId  = idx != null ? `${IMPACT_CRATER_LAYER_ID}-rim-${idx}` : `${IMPACT_CRATER_LAYER_ID}-rim`;
    const crId   = idx != null ? `${IMPACT_CRATER_LAYER_ID}-${idx}`  : IMPACT_CRATER_LAYER_ID;
    const crInId = idx != null ? `${IMPACT_CRATER_LAYER_ID}-inner-${idx}` : `${IMPACT_CRATER_LAYER_ID}-inner`;
    const pulId  = idx != null ? `${IMPACT_CRATER_LAYER_ID}-pulse-${idx}` : `${IMPACT_CRATER_LAYER_ID}-pulse`;
    const thLId  = idx != null ? `${IMPACT_THERMAL_LAYER_ID}-line-${idx}` : `${IMPACT_THERMAL_LAYER_ID}-line`;
    try {
      // Clean up this specific indexed set if re-drawing (clearing is done by caller)
      if (idx != null) {
        [thId, thLId, blFId, blId, ejId, ejLId, rimId, crId, crInId, pulId].forEach(id => {
          try { if (map.getLayer(id)) map.removeLayer(id); } catch(e){}
        });
        try { if (map.getSource(srcId)) map.removeSource(srcId); } catch(e){}
      }
      map.addSource(srcId, { type: "geojson", data });
      map.addLayer({ id: thId,   type: "fill", source: srcId, filter: ["==", ["get", "kind"], "thermal"],    paint: { "fill-color": "#f97316", "fill-opacity": 0.15 } });
      map.addLayer({ id: thLId,  type: "line", source: srcId, filter: ["==", ["get", "kind"], "thermal"],    paint: { "line-color": "#f97316", "line-width": 2, "line-opacity": 0.9 } });
      map.addLayer({ id: blFId,  type: "fill", source: srcId, filter: ["==", ["get", "kind"], "blast-fill"], paint: { "fill-color": "#ef4444", "fill-opacity": 0.25 } });
      map.addLayer({ id: blId,   type: "line", source: srcId, filter: ["==", ["get", "kind"], "blast"],      paint: { "line-color": "#ef4444", "line-width": 3, "line-opacity": 1 } });
      map.addLayer({ id: ejId,   type: "fill", source: srcId, filter: ["==", ["get", "kind"], "ejecta"],     paint: { "fill-color": "#92400e", "fill-opacity": 0.30 } });
      map.addLayer({ id: ejLId,  type: "line", source: srcId, filter: ["==", ["get", "kind"], "ejecta"],     paint: { "line-color": "#b45309", "line-width": 2, "line-opacity": 0.8 } });
      map.addLayer({ id: rimId,  type: "fill", source: srcId, filter: ["==", ["get", "kind"], "crater-rim"], paint: { "fill-color": "#7f1d1d", "fill-opacity": 0.50 } });
      map.addLayer({ id: crId,   type: "fill", source: srcId, filter: ["==", ["get", "kind"], "crater"],     paint: { "fill-color": "#000000", "fill-opacity": 0.90 } });
      map.addLayer({ id: crInId, type: "fill", source: srcId, filter: ["==", ["get", "kind"], "crater-inner"], paint: { "fill-color": "#000000", "fill-opacity": 0.70 } });
      map.addLayer({ id: pulId,  type: "line", source: srcId, filter: ["==", ["get", "kind"], "crater-rim"], paint: { "line-color": "#fde047", "line-width": 3, "line-opacity": 0.95 } });
      safely(() => map.triggerRepaint());
      startImpactPulseAnimation();
    } catch (e) { console.error("Failed to draw land impact result", e); }
  };

  const drawOceanImpactMarker = (lng, lat, idx = null) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return false;
    // Use a distinct "ocean-marker" prefix so these IDs never collide with land impact layer IDs
    const srcId  = idx != null ? `impact-ocean-source-${idx}`       : IMPACT_PREVIEW_SOURCE_ID;
    const crId   = idx != null ? `impact-ocean-marker-${idx}`       : IMPACT_CRATER_LAYER_ID;
    const pulId  = idx != null ? `impact-ocean-marker-pulse-${idx}` : `${IMPACT_CRATER_LAYER_ID}-pulse`;
    try {
      if (idx != null) {
        [crId, pulId].forEach(id => { try { if (map.getLayer(id)) map.removeLayer(id); } catch(e){} });
        try { if (map.getSource(srcId)) map.removeSource(srcId); } catch(e){}
      } else {
        // Single-point fallback: remove base layers only
        const baseIds = [`${IMPACT_CRATER_LAYER_ID}-pulse`, `${IMPACT_CRATER_LAYER_ID}-inner`,
          `${IMPACT_CRATER_LAYER_ID}-rim`, `${IMPACT_CRATER_LAYER_ID}-ejecta`,
          `${IMPACT_CRATER_LAYER_ID}-ejecta-line`, `${IMPACT_BLAST_LAYER_ID}-fill`,
          IMPACT_THERMAL_LAYER_ID, `${IMPACT_THERMAL_LAYER_ID}-line`,
          IMPACT_BLAST_LAYER_ID, IMPACT_CRATER_LAYER_ID];
        baseIds.forEach(id => { try { if (map.getLayer(id)) map.removeLayer(id); } catch(e){} });
        try { if (map.getSource(IMPACT_PREVIEW_SOURCE_ID)) map.removeSource(IMPACT_PREVIEW_SOURCE_ID); } catch(e){}
      }
      map.addSource(srcId, { type: "geojson", data: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: { kind: "impact-core" } }] } });
      map.addLayer({ id: crId,  type: "circle", source: srcId, filter: ["==", ["get", "kind"], "impact-core"], paint: { "circle-radius": 10, "circle-color": "#ef4444", "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" } });
      map.addLayer({ id: pulId, type: "circle", source: srcId, filter: ["==", ["get", "kind"], "impact-core"], paint: { "circle-radius": 28, "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 2, "circle-stroke-color": "#ef4444", "circle-stroke-opacity": 0.9 } });
      safely(() => map.triggerRepaint());
      startImpactPulseAnimation();
      return true;
    } catch (e) { console.error("DRAW OCEAN MARKER ERROR", e); return false; }
  };

  const addFloodLayer = (level, opts = {}) => {
    const map = mapRef.current;
    if (!map || !floodAllowedInCurrentView()) return false;
    const normalizedLevel = Number(level);
    if (!Number.isFinite(normalizedLevel) || normalizedLevel === 0) return false;

    const { impactLat, impactLng, reachM, impactIdx } = opts;
    const isRegional = impactLat != null && impactLng != null && reachM != null && reachM > 0;
    // impactIdx: if set, add as cumulative indexed layer (impact mode multi-point)
    const isIndexed = impactIdx != null;
    const sourceId = isIndexed ? `flood-source-impact-${impactIdx}` : FLOOD_SOURCE_ID;
    const layerId  = isIndexed ? `flood-layer-impact-${impactIdx}`  : FLOOD_LAYER_ID;

    const tileUrl = isRegional
      ? `${floodEngineUrlRef.current}/flood-region/${encodeURIComponent(normalizedLevel)}/${encodeURIComponent(impactLat)}/${encodeURIComponent(impactLng)}/${encodeURIComponent(reachM)}/{z}/{x}/{y}.png?v=${FLOOD_TILE_VERSION}`
      : `${floodEngineUrlRef.current}/flood/${encodeURIComponent(normalizedLevel)}/{z}/{x}/{y}.png?v=${FLOOD_TILE_VERSION}`;

    try {
      if (!isIndexed) {
        if (
          activeFloodLevelRef.current === normalizedLevel &&
          map.getLayer(FLOOD_LAYER_ID) &&
          map.getSource(FLOOD_SOURCE_ID)
        ) return true;
        if (map.getLayer(FLOOD_LAYER_ID)) map.removeLayer(FLOOD_LAYER_ID);
        if (map.getSource(FLOOD_SOURCE_ID)) map.removeSource(FLOOD_SOURCE_ID);
      } else {
        // Remove existing indexed layer if already exists (re-run)
        try { if (map.getLayer(layerId)) map.removeLayer(layerId); } catch(e){}
        try { if (map.getSource(sourceId)) map.removeSource(sourceId); } catch(e){}
      }
      map.addSource(sourceId, { type: "raster", tiles: [tileUrl], tileSize: 256, minzoom: 0, maxzoom: 12 });
      map.addLayer({ id: layerId, type: "raster", source: sourceId, paint: { "raster-opacity": 0.82, "raster-opacity-transition": { duration: 400 } } });
      if (!isIndexed) {
        activeFloodLevelRef.current = normalizedLevel;
      } else {
        // Track indexed layer for cleanup
        impactFloodLayersRef.current = impactFloodLayersRef.current.filter(l => l.layerId !== layerId);
        impactFloodLayersRef.current.push({ sourceId, layerId });
      }
      safely(() => map.triggerRepaint());
      if (DEBUG_FLOOD) console.log("FLOOD LAYER ADDED", { level: normalizedLevel, isRegional, isIndexed, tileUrl });
      return true;
    } catch (e) {
      console.error("Failed to add flood layer", e);
      if (!isIndexed) activeFloodLevelRef.current = null;
      return false;
    }
  };

  const applyOceanImpactFlood = (result, lng, lat, impactIdx = null) => {
    const waveHeight = Number(result.wave_height_m ?? 0);
    const reachM = Number(result.estimated_wave_reach_m ?? result.tsunami_radius_m ?? 0);
    if (waveHeight <= 0) return false;
    if (waveHeight >= EXTINCTION_WAVE_HEIGHT_M) {
      // Extinction-scale — still pass origin so tile server can centre the flood correctly
      const extinctionReach = reachM > 0 ? reachM : 20000000; // ~half Earth circumference
      const ok = addFloodLayer(waveHeight, { impactLat: lat, impactLng: lng, reachM: extinctionReach, impactIdx });
      if (!ok) setTimeout(() => { addFloodLayer(waveHeight, { impactLat: lat, impactLng: lng, reachM: extinctionReach, impactIdx }); }, 50);
      return true;
    }
    // Cap reach to prevent bleeding into a de-facto global flood for large-but-sub-extinction impacts
    // If backend didn't return a reach, derive one from wave height (~1km reach per metre of wave height, capped)
    const effectiveReach = reachM > 0 ? reachM : Math.min(waveHeight * 1000, 5000000);
    const cappedReach = Math.min(effectiveReach, 10000000); // 10,000 km max regional reach
    const ok = addFloodLayer(waveHeight, { impactLat: lat, impactLng: lng, reachM: cappedReach, impactIdx });
    if (!ok) {
      setTimeout(() => { addFloodLayer(waveHeight, { impactLat: lat, impactLng: lng, reachM: cappedReach, impactIdx }); }, 50);
    }
    return true;
  };

  const syncFloodScenario = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (scenarioModeRef.current !== "flood") return;
    if (!floodAllowedInCurrentView()) { removeFloodLayer(); return; }
    const level = Number(seaLevelRef.current);
    if (!Number.isFinite(level) || level === 0) { removeFloodLayer(); return; }
    addFloodLayer(level);
  };

  const applyStyleMode = (mode) => {
    const map = mapRef.current;
    if (!map) return;
    const isSat  = mode === "satellite";
    const isGlobe = mode === "globe";
    map.setStyle(isSat ? SATELLITE_STYLE_URL : MAP_STYLE_URL);
    map.once("style.load", () => {
      try { map.setProjection("globe"); } catch(e) {}
      map.easeTo({
        center: isGlobe ? [0, 20] : [-80.19, 25.76],
        zoom:   isGlobe ? 1.6 : 6.2,
        duration: 250, essential: true,
      });
      setTimeout(() => reloadActiveOverlays(seaLevelRef.current, true), 150);
    });
  };

  const executeFlood = () => {
    const rl = checkAndIncrementRL(proTierRef.current !== "free");
    if (!rl.allowed) { setPaywallModal("ratelimit"); setRlStatus(getRLStatus()); return; }
    setRlStatus(getRLStatus());
    cancelPendingImpactRequest();
    impactRunSeqRef.current += 1;
    setImpactLoading(false);
    const parsedLevel = scenarioModeRef.current === "climate"
      ? String(seaLevelRef.current)
      : commitInputText(inputText, unitMode);
    if (parsedLevel === null) { setStatus("Enter a valid sea level first"); return; }
    const level = Number(parsedLevel);
    setSeaLevel(level); seaLevelRef.current = level; setInputLevel(level);
    if (scenarioModeRef.current !== "climate") setScenarioMode("flood");
    if (!floodAllowedInCurrentView()) { removeFloodLayer(); setStatus("Switch to a supported view mode"); return; }
    if (level === 0) { removeFloodLayer(); safely(() => clearIceSheets(mapRef.current)); setStatus("Flood cleared"); return; }
    if (!mapRef.current) { setStatus("Map not ready"); return; }
    if (!mapRef.current.isStyleLoaded()) { setStatus("Map style still loading..."); return; }
    removeImpactPoint(); setImpactResult(null); setImpactError("");
    closeElevPopup();
    setStatus(`Loading flood tiles at ${formatLevelForDisplay(level)}...`);
    if (!addFloodLayer(level)) setStatus("Flood layer failed to attach");
    // Ice Age ice sheets — draw if level ≤ -100m, clear otherwise
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) {
      if (level <= -100) {
        setTimeout(() => safely(() => drawIceSheets(map)), 200);
      } else {
        safely(() => clearIceSheets(map));
      }
    }
    // Flood displaced — Pro only
    setFloodDisplaced(null);
    if (proTier !== "free") {
      fetch(`${floodEngineUrlRef.current}/flood-population?level=${encodeURIComponent(level)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => { if (d.flood_displaced != null) setFloodDisplaced(d.flood_displaced); })
        .catch(() => {});
    }
  };

  const runImpact = async () => {
    impactPopupClickCountRef.current = 0; // reset per-run popup counter
    if (impactPointsRef.current.length === 0 && !impactPointRef.current) { setStatus("Place impact point first"); return; }
    const points = impactPointsRef.current.length > 0 ? impactPointsRef.current : [impactPointRef.current];
    // Rate limit check
    const rl = checkAndIncrementRL(proTier !== "free");
    if (!rl.allowed) {
      setPaywallModal("ratelimit");
      setRlStatus(getRLStatus());
      return;
    }
    setRlStatus(getRLStatus());
    cancelPendingImpactRequest();
    removeImpactFloodLayers();
    removeImpactPreviewLayers(); // clear all before drawing fresh set
    const runSeq = impactRunSeqRef.current + 1;
    impactRunSeqRef.current = runSeq;
    const controller = new AbortController();
    impactRequestRef.current = controller;
    impactTimeoutRef.current = setTimeout(() => { controller.abort(); }, 30000);
    try {
      setImpactLoading(true); setImpactError(""); setImpactResult(null);
      setStatus(`Running ${points.length} impact simulation${points.length > 1 ? "s" : ""}...`);

      // Run all points in parallel
      const results = await Promise.all(points.map(async (pt, i) => {
        const res = await fetch(
          `${floodEngineUrlRef.current}/impact?lat=${pt.lat}&lng=${pt.lng}&diameter=${impactDiameterRef.current}&velocity_km_s=${impactVelocityRef.current}&_=${Date.now()}_${i}`,
          { signal: controller.signal, cache: "no-store" }
        );
        if (!res.ok) throw new Error(`Impact request ${i+1} failed`);
        return res.json();
      }));

      if (impactRunSeqRef.current !== runSeq) return;
      if (scenarioModeRef.current !== "impact") return;

      // Store results on points for redraw on style change
      results.forEach((data, i) => { if (points[i]) points[i].result = data; });

      // Aggregate stats
      const totalDeaths = results.reduce((s, d) => s + (d.estimated_deaths || 0), 0);
      const totalExposed = results.reduce((s, d) => s + (d.population_exposed || 0), 0);
      // Worst-case blackout (most severe single impact dominates atmosphere)
      const worstBlackout = results.reduce((best, d) => {
        return (d.blackout_pct || 0) > (best.blackout_pct || 0) ? d : best;
      }, results[0]);
      // Combined result for stats panel
      const combinedResult = {
        ...results[0],
        _count: results.length,
        _results: results,
        estimated_deaths: totalDeaths,
        population_exposed: totalExposed,
        blackout_pct: worstBlackout?.blackout_pct || 0,
        blackout_duration_months: worstBlackout?.blackout_duration_months || 0,
        blackout_severity: worstBlackout?.blackout_severity || "None",
        famine_deaths_estimate: worstBlackout?.famine_deaths_estimate || 0,
      };
      setImpactResult(combinedResult);
      impactResultRef.current = combinedResult;

      // Draw each impact — set flag so handleStyleLoad doesn't interfere
      impactDrawingRef.current = true;
      results.forEach((data, i) => {
        const pt = points[i];
        if (!pt) return;
        const drawIdx = pt.idx ?? i; // prefer stored idx; fallback to loop position
        if (data.is_ocean_impact === true && Number(data.wave_height_m ?? 0) > 0) {
          drawOceanImpactMarker(pt.lng, pt.lat, drawIdx);
          applyOceanImpactFlood(data, pt.lng, pt.lat, drawIdx);
        } else {
          drawLandImpactFromResult(pt.lng, pt.lat, data, drawIdx);
        }
      });
      impactDrawingRef.current = false;

      const hasOcean = results.some(d => d.is_ocean_impact);
      if (results.length > 1) {
        setStatus(`${results.length} impacts — ${totalDeaths.toLocaleString()} est. deaths`);
      } else if (hasOcean) {
        const wh = Math.round(Number(results[0].wave_height_m));
        const reach = Math.round(Number(results[0].estimated_wave_reach_m ?? 0) / 1000);
        setStatus(wh >= EXTINCTION_WAVE_HEIGHT_M ? `Extinction scale — ${wh}m global wave` : `Ocean impact — ${wh}m wave, ${reach}km reach`);
      } else {
        setStatus("Impact simulation complete — click map for zone details");
      }
    } catch (err) {
      if (impactRunSeqRef.current !== runSeq) return;
      console.error(err);
      removeImpactFloodLayers();
      if (err?.name === "AbortError") { setImpactError("Impact simulation timed out"); setStatus("Impact simulation timed out"); }
      else { setImpactError("Impact simulation failed"); setStatus("Impact simulation failed"); }
    } finally {
      if (impactTimeoutRef.current) { clearTimeout(impactTimeoutRef.current); impactTimeoutRef.current = null; }
      if (impactRequestRef.current === controller) impactRequestRef.current = null;
      if (impactRunSeqRef.current === runSeq) setImpactLoading(false);
    }
  };

  const runEmp = async () => {
    if (nukeStrikesRef.current.length === 0) { setStatus("Place EMP detonation point first"); return; }
    const strike = nukeStrikesRef.current[0]; // EMP uses single point
    setEmpLoading(true);
    setEmpResult(null);
    setStatus("Computing EMP footprint...");
    try {
      const res = await fetch(
        `${floodEngineUrlRef.current}/emp?lat=${strike.lat}&lng=${strike.lng}&yield_kt=${nukeYield.toFixed(3)}&altitude_km=${empAltitudeKm}&_=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("EMP request failed");
      const data = await res.json();
      setEmpResult(data);
      // Draw EMP ring on map
      const map = mapRef.current;
      if (map && map.isStyleLoaded()) {
        clearNukeLayers(map);
        const empKm = data.emp_r_km;
        const features = [{ ...kmCircle(strike.lng, strike.lat, empKm), properties: { kind: "emp" } }];
        map.addSource(NUKE_SRC, { type: "geojson", data: { type: "FeatureCollection", features } });
        map.addLayer({ id: "nuke-emp", type: "fill", source: NUKE_SRC, filter: ["==", ["get", "kind"], "emp"], paint: { "fill-color": "#7c3aed", "fill-opacity": 0.08 } });
        map.addLayer({ id: "nuke-emp-line", type: "line", source: NUKE_SRC, filter: ["==", ["get", "kind"], "emp"], paint: { "line-color": "#7c3aed", "line-width": 2, "line-opacity": 0.8, "line-dasharray": [6, 3] } });
        safely(() => map.triggerRepaint());
      }
      setStatus(`EMP footprint: ${Math.round(data.emp_r_km).toLocaleString()} km radius · ${(data.population_at_risk/1e6).toFixed(1)}M at risk`);
    } catch (e) {
      setStatus("EMP simulation failed");
    } finally {
      setEmpLoading(false);
    }
  };

  const runNuke = async () => {
    nukePopupClickCountRef.current = 0; // reset per-run popup counter
    if (nukeStrikesRef.current.length === 0) { setStatus("Place at least one strike point first"); return; }
    const rl = checkAndIncrementRL(proTier !== "free");
    if (!rl.allowed) { setPaywallModal("ratelimit"); setRlStatus(getRLStatus()); return; }
    setRlStatus(getRLStatus());
    setNukeLoading(true); setNukeError(""); setNukeResult(null);
    setStatus(`Detonating ${nukeStrikesRef.current.length} strike${nukeStrikesRef.current.length > 1 ? "s" : ""}...`);
    try {
      const yieldKt = Number(nukeYield).toFixed(3);
      const burst = nukeBurst;
      const windDeg = Number(nukeWindDeg).toFixed(1);
      const strikes = [...nukeStrikesRef.current];
      const results = await Promise.all(strikes.map((strike, idx) =>
        fetch(`${floodEngineUrlRef.current}/nuke?lat=${strike.lat}&lng=${strike.lng}&yield_kt=${yieldKt}&burst_type=${burst}&wind_deg=${windDeg}&_=${Date.now()}_${idx}`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : null)
          .then(data => data ? { ...data, _lat: strike.lat, _lng: strike.lng } : null)
          .catch(() => null)
      ));
      const valid = results.filter(Boolean);
      console.log(`[nuke] ${strikes.length} fired, ${valid.length} valid results`);
      if (valid.length === 0) throw new Error("All detonations failed");
      drawAllNukeResults(valid);
      const totalDeaths = valid.reduce((s, d) => s + (d.estimated_deaths || 0), 0);
      const totalExposed = valid.reduce((s, d) => s + (d.population_exposed || 0), 0);
      const combined = { ...valid[0], deaths: totalDeaths, exposed: totalExposed, _count: valid.length };
      setNukeResult(combined);
      setStatus(`${valid.length} detonation${valid.length > 1 ? "s" : ""} — ${(totalDeaths/1e6).toFixed(1)}M killed, ${(totalExposed/1e6).toFixed(1)}M exposed · click map for zone details`);
    } catch (err) {
      setNukeError("Detonation failed"); setStatus("Detonation failed");
    } finally {
      setNukeLoading(false);
    }
  };

  const NUKE_SRC = "nuke-combined-source";
  const NUKE_LAYERS = ["nuke-emp","nuke-emp-line","nuke-thermal","nuke-thermal-line",
    "nuke-blast-light","nuke-blast-light-line","nuke-blast-moderate","nuke-blast-moderate-line",
    "nuke-blast-heavy","nuke-blast-heavy-line","nuke-fireball","nuke-fireball-line",
    "nuke-radiation","nuke-fallout","nuke-fallout-line"];

  const clearNukeLayers = (map) => {
    NUKE_LAYERS.forEach(id => { try { if (map.getLayer(id)) map.removeLayer(id); } catch(e){} });
    try { if (map.getSource(NUKE_SRC)) map.removeSource(NUKE_SRC); } catch(e){}
    try { if (map.getSource(IMPACT_PREVIEW_SOURCE_ID)) map.removeSource(IMPACT_PREVIEW_SOURCE_ID); } catch(e){}
  };

  const drawAllNukeResults = (dataArr) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    clearNukeLayers(map);
    const features = [];
    dataArr.forEach(data => {
      const lng = data._lng, lat = data._lat;
      // EMP ring intentionally not drawn — radius is continental scale and not visually useful
      features.push({ ...kmCircle(lng, lat, data.thermal_r_m/1000), properties: { kind: "thermal" } });
      features.push({ ...kmCircle(lng, lat, data.blast_light_r_m/1000), properties: { kind: "blast-light" } });
      features.push({ ...kmCircle(lng, lat, data.blast_moderate_r_m/1000), properties: { kind: "blast-moderate" } });
      features.push({ ...kmCircle(lng, lat, data.blast_heavy_r_m/1000), properties: { kind: "blast-heavy" } });
      features.push({ ...kmCircle(lng, lat, data.fireball_r_m/1000), properties: { kind: "fireball" } });
      if (data.radiation_r_m > 0) features.push({ ...kmCircle(lng, lat, data.radiation_r_m/1000), properties: { kind: "radiation" } });
      if (data.fallout_major_km > 0) features.push({ ...buildFalloutEllipse(lng, lat, data.fallout_major_km, data.fallout_minor_km, data.fallout_direction_deg), properties: { kind: "fallout" } });
    });
    const hasRad = dataArr.some(d => d.radiation_r_m > 0);
    const hasFallout = dataArr.some(d => d.fallout_major_km > 0);
    try {
      map.addSource(NUKE_SRC, { type: "geojson", data: { type: "FeatureCollection", features } });
      const L = (id, type, filter, paint) => map.addLayer({ id, type, source: NUKE_SRC, filter: ["==", ["get", "kind"], filter], paint });
      // EMP layers not drawn
      L("nuke-thermal","fill","thermal",{"fill-color":"#f97316","fill-opacity":0.18});
      L("nuke-thermal-line","line","thermal",{"line-color":"#f97316","line-width":2,"line-opacity":0.9});
      L("nuke-blast-light","fill","blast-light",{"fill-color":"#fbbf24","fill-opacity":0.20});
      L("nuke-blast-light-line","line","blast-light",{"line-color":"#f59e0b","line-width":2,"line-opacity":0.9});
      L("nuke-blast-moderate","fill","blast-moderate",{"fill-color":"#ef4444","fill-opacity":0.30});
      L("nuke-blast-moderate-line","line","blast-moderate",{"line-color":"#ef4444","line-width":2.5,"line-opacity":1.0});
      L("nuke-blast-heavy","fill","blast-heavy",{"fill-color":"#991b1b","fill-opacity":0.55});
      L("nuke-blast-heavy-line","line","blast-heavy",{"line-color":"#dc2626","line-width":3,"line-opacity":1.0});
      L("nuke-fireball","fill","fireball",{"fill-color":"#ffffff","fill-opacity":0.98});
      L("nuke-fireball-line","line","fireball",{"line-color":"#fde047","line-width":3,"line-opacity":1.0});
      if (hasRad) L("nuke-radiation","line","radiation",{"line-color":"#4ade80","line-width":3,"line-opacity":1.0,"line-dasharray":[5,3]});
      if (hasFallout) { L("nuke-fallout","fill","fallout",{"fill-color":"#84cc16","fill-opacity":0.15}); L("nuke-fallout-line","line","fallout",{"line-color":"#84cc16","line-width":2.5,"line-opacity":0.9,"line-dasharray":[6,3]}); }
      safely(() => map.triggerRepaint());
    } catch(e) { console.error("Failed to draw nuke results", e); }
  };

  // Single-strike wrapper for style reload redraws
  const drawNukeResult = (lng, lat, data) => drawAllNukeResults([{ ...data, _lng: lng, _lat: lat }]);

  const buildFalloutEllipse = (lng, lat, majorKm, minorKm, directionDeg, steps = 64) => {
    // directionDeg = compass bearing fallout travels TO (0=N,90=E,180=S,270=W)
    const kpLat = 110.574;
    const kpLng = 111.32 * Math.cos((lat * Math.PI) / 180);
    const compassRad = (directionDeg * Math.PI) / 180;
    const dNorth = Math.cos(compassRad);
    const dEast  = Math.sin(compassRad);
    // Shift center downwind so detonation point sits at the upwind edge
    const centerLat = lat + (dNorth * majorKm * 0.5) / kpLat;
    const centerLng = lng + (dEast  * majorKm * 0.5) / Math.max(kpLng, 0.0001);
    const coords = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const along = Math.cos(t) * majorKm;
      const perp  = Math.sin(t) * minorKm;
      const northKm = dNorth * along - dEast  * perp;
      const eastKm  = dEast  * along + dNorth * perp;
      coords.push([
        centerLng + eastKm  / Math.max(kpLng, 0.0001),
        centerLat + northKm / kpLat,
      ]);
    }
    return { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} };
  };

  const clearTsunami = () => {
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) {
      for (let i = 0; i < 4; i++) {
        [`${TSUNAMI_LAYER_PREFIX}-fill-${i}`, `${TSUNAMI_LAYER_PREFIX}-line-${i}`,
         `${TSUNAMI_LAYER_PREFIX}-label-${i}`].forEach(id => {
          try { if (map.getLayer(id)) map.removeLayer(id); } catch(e){}
        });
      }
      [`${TSUNAMI_SOURCE_ID}`, `${TSUNAMI_SOURCE_ID}-labels`].forEach(id => {
        try { if (map.getSource(id)) map.removeSource(id); } catch(e){}
      });
    }
    if (tsunamiPopupRef.current) { tsunamiPopupRef.current.remove(); tsunamiPopupRef.current = null; }
    if (map && map.isStyleLoaded()) {
      try { if (map.getLayer("tsunami-flood-layer")) map.removeLayer("tsunami-flood-layer"); } catch(e){}
      try { if (map.getSource("tsunami-flood-source")) map.removeSource("tsunami-flood-source"); } catch(e){}
      try { if (map.getLayer("tsunami-flood-layer-2")) map.removeLayer("tsunami-flood-layer-2"); } catch(e){}
      try { if (map.getSource("tsunami-flood-source-2")) map.removeSource("tsunami-flood-source-2"); } catch(e){}
    }
    setTsunamiActive(false);
    setTsunamiResult(null);
    setTsunamiFloodLevel(null);
    setStatus("Tsunami cleared");
    safely(() => {
      map.dragPan.enable();
      map.scrollZoom.enable();
      map.doubleClickZoom.enable();
      map.touchZoomRotate.enable();
      map.setMinZoom(0);
      map.setMaxZoom(22);
    });
  };

  const drawTsunami = (sourceIdx) => {
    const rl = checkAndIncrementRL(proTierRef.current !== "free");
    if (!rl.allowed) { setPaywallModal("ratelimit"); setRlStatus(getRLStatus()); return; }
    setRlStatus(getRLStatus());
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    clearTsunami();

    tsunamiSourceRef.current = sourceIdx;
    const src = TSUNAMI_SOURCES[sourceIdx];
    const [oLng, oLat] = src.origin;

    // Build rings largest first (outermost renders underneath)
    const features = [...src.rings].reverse().map((ring, i) => ({
      ...buildTsunamiEllipse(oLng, oLat, ring.major_km, ring.minor_km, src.bearing, 96, src.spreadAngle || 65),
      properties: { ringIdx: src.rings.length - 1 - i, hours: ring.hours, waveM: ring.waveM, label: ring.label },
    }));

    // Origin marker feature
    const originFeature = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [oLng, oLat] },
      properties: { type: "origin" },
    };

    try {
      map.addSource(TSUNAMI_SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });

      // Add fill + line layers for each ring
      src.rings.forEach((ring, i) => {
        const actualIdx = src.rings.length - 1 - i;
        const opacity = 0.08 + (src.rings.length - actualIdx) * 0.04;
        map.addLayer({
          id: `${TSUNAMI_LAYER_PREFIX}-fill-${actualIdx}`,
          type: "fill",
          source: TSUNAMI_SOURCE_ID,
          filter: ["==", ["get", "ringIdx"], actualIdx],
          paint: { "fill-color": src.color, "fill-opacity": opacity },
        });
        map.addLayer({
          id: `${TSUNAMI_LAYER_PREFIX}-line-${actualIdx}`,
          type: "line",
          source: TSUNAMI_SOURCE_ID,
          filter: ["==", ["get", "ringIdx"], actualIdx],
          paint: {
            "line-color": src.color,
            "line-width": actualIdx === 0 ? 2.5 : 1.5,
            "line-opacity": 0.7,
            "line-dasharray": [4, 2],
          },
        });
      });

      // Fly to origin
      // Zoom out to fit entire outermost ring, then lock zoom
      const outerKm = src.rings[src.rings.length - 1].major_km;
      const fitZoom = Math.max(0.8, Math.log2(40075 / (outerKm * 2.8)));
      // Fly to center of outermost ellipse, not the origin/collapse point
      const [oLngF, oLatF] = src.origin;
      const bearRad = (src.bearing * Math.PI) / 180;
      const shiftKm = outerKm * 0.85 * 0.5;
      const R = 6371;
      const d = shiftKm / R;
      const lat1 = oLatF * Math.PI / 180;
      const lng1 = oLngF * Math.PI / 180;
      const lat2 = Math.asin(Math.sin(lat1)*Math.cos(d) + Math.cos(lat1)*Math.sin(d)*Math.cos(bearRad));
      const lng2 = lng1 + Math.atan2(Math.sin(bearRad)*Math.sin(d)*Math.cos(lat1), Math.cos(d)-Math.sin(lat1)*Math.sin(lat2));
      const ellipseCenter = [lng2 * 180/Math.PI, lat2 * 180/Math.PI];
      safely(() => map.flyTo({ center: ellipseCenter, zoom: fitZoom, duration: 1200 }));
      // Free users: allow pan but lock zoom so they can't zoom in to explore
      if ((proTierRef.current ?? "free") === "free") {
        safely(() => {
          map.setMinZoom(isMobileView ? 0.5 : fitZoom - 0.5);
          map.setMaxZoom(fitZoom + 0.3);
          // Enable pan only on mobile so they can see full extent
          if (isMobileView) {
            map.dragPan.enable();
          }
        });
      }
      safely(() => map.triggerRepaint());
      setTsunamiActive(true);

      // Ellipse-masked flood tiles — same shape as outermost wave ring
      const outerRing = src.rings[src.rings.length - 1];
      const outerWave = outerRing.waveM;
      const [oLng, oLat] = src.origin;
      const floodParams = `origin_lat=${oLat}&major_km=${outerRing.major_km}&minor_km=${outerRing.minor_km}&bearing_deg=${src.bearing}&shift=0.85`;
      // Primary source — covers origin side of antimeridian
      const floodUrl = `${floodEngineUrlRef.current}/flood-bbox/${outerWave}/{z}/{x}/{y}.png?origin_lng=${oLng}&${floodParams}`;
      // Secondary source — shifted +360° to cover the other side of the antimeridian
      const floodUrl2 = `${floodEngineUrlRef.current}/flood-bbox/${outerWave}/{z}/{x}/{y}.png?origin_lng=${oLng + 360}&${floodParams}`;
      setTsunamiFloodLevel(outerWave);

      try {
        if (map.getSource("tsunami-flood-source")) {
          map.getSource("tsunami-flood-source").setTiles([floodUrl]);
        } else {
          map.addSource("tsunami-flood-source", { type: "raster", tiles: [floodUrl], tileSize: 256 });
          map.addLayer({ id: "tsunami-flood-layer", type: "raster", source: "tsunami-flood-source",
            paint: { "raster-opacity": 0.75 } });
        }
        // Second source for antimeridian coverage
        if (map.getSource("tsunami-flood-source-2")) {
          map.getSource("tsunami-flood-source-2").setTiles([floodUrl2]);
        } else {
          map.addSource("tsunami-flood-source-2", { type: "raster", tiles: [floodUrl2], tileSize: 256 });
          map.addLayer({ id: "tsunami-flood-layer-2", type: "raster", source: "tsunami-flood-source-2",
            paint: { "raster-opacity": 0.75 } });
        }
      } catch(e) { console.warn("Tsunami flood layer error", e); }
      setStatus(`${src.name} — ${src.desc}`);

      // Fetch casualties
      setTsunamiResult(null);
      fetch(`${floodEngineUrlRef.current}/tsunami?source=${sourceIdx}`, { cache: "no-store" })
        .then(r => r.json())
        .then(d => { if (d.total_deaths != null) setTsunamiResult(d); })
        .catch(e => console.warn("Tsunami population fetch failed", e));

      // Free tier: lock interaction, show upgrade modal on interact
      const isFree = (proTierRef.current ?? proTier ?? "free") === "free";
      if (isFree) {
        safely(() => {
          map.dragPan.disable();
          map.scrollZoom.disable();
          map.doubleClickZoom.disable();
          map.touchZoomRotate.disable();
        });
        const tsunamiUpgrade = () => {
          map.off("mousedown", tsunamiUpgrade);
          map.off("touchstart", tsunamiUpgrade);
          map.off("wheel", tsunamiUpgrade);
          setPaywallModal("pro");
        };
        map.on("mousedown", tsunamiUpgrade);
        map.on("touchstart", tsunamiUpgrade);
        map.on("wheel", tsunamiUpgrade);
      }

    } catch(e) { console.error("Tsunami draw error", e); }
  };

  // Re-enable all map controls (called when switching modes)
  const unlockMapControls = () => {
    const map = mapRef.current;
    if (!map) return;
    safely(() => {
      map.dragPan.enable();
      map.scrollZoom.enable();
      map.doubleClickZoom.enable();
      map.touchZoomRotate.enable();
      map.setMinZoom(0);
      map.setMaxZoom(22);
      map.setRenderWorldCopies(true);
    });
  };

  const showTsunamiPopup = (lng, lat) => {
    const map = mapRef.current;
    if (!map) return;
    if (tsunamiPopupRef.current) { tsunamiPopupRef.current.remove(); tsunamiPopupRef.current = null; }

    const src = TSUNAMI_SOURCES[tsunamiSourceRef.current];
    const [oLng, oLat] = src.origin;
    const kpLat = 110.574;
    const kpLng = 111.32 * Math.cos((oLat * Math.PI) / 180);
    const bearingRad = (src.bearing * Math.PI) / 180;
    const dNorth = Math.cos(bearingRad);
    const dEast  = Math.sin(bearingRad);

    // Iterate outermost→innermost so distant clicks get far-travel low-height ring
    let ringInfo = null;
    const spreadAngle = src.spreadAngle || 65;
    const dLatKmBase = (lat - oLat) * kpLat;
    const dLngKmBase = (lng - oLng) * Math.max(kpLng, 0.0001);
    const distKm = Math.sqrt(dLatKmBase * dLatKmBase + dLngKmBase * dLngKmBase);
    const clickAngleDeg = Math.atan2(dLngKmBase, dLatKmBase) * 180 / Math.PI;
    let angleDiff = ((clickAngleDeg - src.bearing) + 360) % 360;
    if (angleDiff > 180) angleDiff -= 360;
    const inCone = Math.abs(angleDiff) <= spreadAngle * 3.9;
    if (inCone) {
      // Find correct ring by distance — outermost first, use first ring that fits
      for (let i = src.rings.length - 1; i >= 0; i--) {
        if (distKm <= src.rings[i].major_km * 12) {
          ringInfo = src.rings[i];
          break;
        }
      }
      // If within innermost ring, use innermost
      if (!ringInfo && distKm <= src.rings[0].major_km * 12) ringInfo = src.rings[0];
    }

    const content = ringInfo
      ? `<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;padding:2px 4px">
          <div style="color:${src.color};font-weight:700;margin-bottom:4px">🌊 ${src.name}</div>
          <div style="color:#e2e8f0;margin-bottom:4px">Wave arrives in <b>${ringInfo.label}</b></div>
          <div style="color:#94a3b8;margin-bottom:4px">Est. wave height: <b style="color:#e2e8f0">${ringInfo.waveM}m</b></div>
          <div style="color:#64748b;font-size:11px;font-style:italic">${ringInfo.waveM >= 100 ? "Unsurvivable near source. Total destruction." : ringInfo.waveM >= 20 ? "Unsurvivable. Evacuate immediately." : ringInfo.waveM >= 10 ? "Extremely dangerous. Evacuation essential." : ringInfo.waveM >= 5 ? "Deadly for coastal areas. Move inland now." : "Dangerous for coast. Move to high ground."}</div>
          <div style="color:#94a3b8;font-size:10px;margin-top:5px;font-style:italic">⚠ Worst-case scenario — actual heights may be lower</div>
        </div>`
      : `<div style="font-family:Arial,sans-serif;font-size:13px;padding:2px 4px">
          <div style="color:#94a3b8">Outside propagation zone</div>
        </div>`;

    const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, className: "elev-popup", maxWidth: "260px" });
    popup.setLngLat([lng, lat]).setHTML(content).addTo(map);
    tsunamiPopupRef.current = popup;
  };

  const clearYellowstone = () => {
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) {
      // Remove yellowstone preset layers
      for (let i = 0; i < 8; i++) {
        const id = `${YELLOWSTONE_LAYER_PREFIX}-${i}`;
        const lineId = `${YELLOWSTONE_LAYER_PREFIX}-line-${i}`;
        try { if (map.getLayer(id)) map.removeLayer(id); } catch(e){}
        try { if (map.getLayer(lineId)) map.removeLayer(lineId); } catch(e){}
      }
      try { if (map.getSource(YELLOWSTONE_SOURCE_ID)) map.removeSource(YELLOWSTONE_SOURCE_ID); } catch(e){}
      // Remove generic volcano eruption layers
      for (let i = 0; i < 8; i++) {
        try { if (map.getLayer(`verupt-layer-${i}`)) map.removeLayer(`verupt-layer-${i}`); } catch(e){}
        try { if (map.getSource(`verupt-src-${i}`)) map.removeSource(`verupt-src-${i}`); } catch(e){}
      }
    }
    document.querySelectorAll(".mapboxgl-popup").forEach(p => p.remove());
    if (yellowstonePopupRef.current) { yellowstonePopupRef.current.remove(); yellowstonePopupRef.current = null; }
    window.__dmLastEruptResult = null;
    setYellowstoneActive(false);
    setYellowstoneResult(null);
    setStatus("Cleared");
  };

  const drawYellowstone = (presetIdx) => {
    const rl = checkAndIncrementRL(proTierRef.current !== "free");
    if (!rl.allowed) { setPaywallModal("ratelimit"); setRlStatus(getRLStatus()); return; }
    setRlStatus(getRLStatus());
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    clearYellowstone();

    yellowstonePresetRef.current = presetIdx;
    // Select correct data based on active volcano type
    const vType = volcanoTypeRef.current;
    const activePresets = vType === "toba" ? TOBA_PRESETS : vType === "campi" ? CAMPI_PRESETS : YELLOWSTONE_PRESETS;
    const activeCenter = vType === "toba" ? TOBA_CENTER : vType === "campi" ? CAMPI_CENTER : YELLOWSTONE_CENTER;
    const preset = activePresets[Math.min(presetIdx, activePresets.length - 1)];
    const [cLng, cLat] = activeCenter;

    // Build features largest to smallest — each inner zone renders on top
    const features = preset.zones.map((zone, i) => ({
      ...buildAshEllipse(cLng, cLat, zone.major_km, zone.minor_km),
      properties: { zoneIdx: i, ...zone },
    }));

    try {
      map.addSource(YELLOWSTONE_SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features } });

      // Add layers largest first so smaller inner zones render on top
      preset.zones.forEach((zone, i) => {
        map.addLayer({
          id: `${YELLOWSTONE_LAYER_PREFIX}-${i}`,
          type: "fill",
          source: YELLOWSTONE_SOURCE_ID,
          filter: ["==", ["get", "zoneIdx"], i],
          paint: { "fill-color": zone.color, "fill-opacity": zone.opacity },
        });
        map.addLayer({
          id: `${YELLOWSTONE_LAYER_PREFIX}-line-${i}`,
          type: "line",
          source: YELLOWSTONE_SOURCE_ID,
          filter: ["==", ["get", "zoneIdx"], i],
          paint: { "line-color": zone.color, "line-width": i === 0 ? 2.0 : 1.2, "line-opacity": 0.8 },
        });
      });

      // Fly to Yellowstone
      safely(() => map.flyTo({ center: activeCenter, zoom: volcanoType === 'campi' ? 5 : 3.5, duration: 1200 }));
      safely(() => map.triggerRepaint());
      setYellowstoneActive(true);
      setYellowstoneResult(null);
      setStatus(`${preset.name} — ${preset.desc}`);

      // Fetch population impact
      fetch(`${floodEngineUrlRef.current}/yellowstone?preset=${presetIdx}`, { cache: "no-store" })
        .then(r => r.json())
        .then(d => { if (d.total_deaths != null) setYellowstoneResult(d); })
        .catch(e => console.warn("Yellowstone population fetch failed", e));

    } catch(e) { console.error("Yellowstone draw error", e); }
  };

  // Click handler for ash zone info popup
  const showYellowstonePopup = (lng, lat) => {
    const map = mapRef.current;
    if (!map) return;
    if (yellowstonePopupRef.current) { yellowstonePopupRef.current.remove(); yellowstonePopupRef.current = null; }

    const vType = volcanoTypeRef.current;
    const activePresets = vType === "toba" ? TOBA_PRESETS : vType === "campi" ? CAMPI_PRESETS : YELLOWSTONE_PRESETS;
    const activeCenter = vType === "toba" ? TOBA_CENTER : vType === "campi" ? CAMPI_CENTER : YELLOWSTONE_CENTER;
    const preset = activePresets[Math.min(yellowstonePresetRef.current, activePresets.length - 1)];
    const [cLng, cLat] = activeCenter;


    // Point-in-ellipse test — same bearing and center shift as buildAshEllipse
    const kpLat = 110.574;
    const kpLng = 111.32 * Math.cos((cLat * Math.PI) / 180);
    const bearingDeg = 70;
    const bearingRad = (bearingDeg * Math.PI) / 180;
    const dNorth = Math.cos(bearingRad);
    const dEast  = Math.sin(bearingRad);

    let zoneInfo = null;
    // Check smallest zone first (innermost = highest severity)
    for (let i = 0; i < preset.zones.length; i++) {
      const z = preset.zones[i];
      // Ellipse center shifted downwind by 0.3 * major axis (matching buildAshEllipse)
      const eCLat = cLat + (dNorth * z.major_km * 0.3) / kpLat;
      const eCLng = cLng + (dEast  * z.major_km * 0.3) / Math.max(kpLng, 0.0001);
      // Vector from ellipse center to click point in km
      const dLatKm = (lat - eCLat) * kpLat;
      const dLngKm = (lng - eCLng) * Math.max(kpLng, 0.0001);
      // Rotate into ellipse coordinate frame
      const along = dNorth * dLatKm + dEast * dLngKm;
      const perp  = -dEast * dLatKm + dNorth * dLngKm;
      // Standard ellipse equation: (along/a)² + (perp/b)² <= 1
      const inside = (along / z.major_km) ** 2 + (perp / z.minor_km) ** 2 <= 1;
      if (inside) { zoneInfo = z; break; }
    }

    const content = zoneInfo
      ? `<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;padding:2px 4px">
          <div style="color:${zoneInfo.color};font-weight:700;margin-bottom:4px">🌋 ${zoneInfo.name}</div>
          <div style="color:#e2e8f0;margin-bottom:4px">${zoneInfo.desc}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="color:#94a3b8;font-size:11px">Survival odds:</span>
            <span style="color:${zoneInfo.survival === '0%' ? '#ef4444' : zoneInfo.survival.startsWith('2') ? '#f97316' : zoneInfo.survival.startsWith('3') ? '#fbbf24' : '#4ade80'};font-weight:700;font-size:13px">${zoneInfo.survival}</span>
          </div>
          <div style="color:#64748b;font-size:11px;font-style:italic">${zoneInfo.survivalNote}</div>
          <div style="color:#475569;font-size:10px;margin-top:4px">${preset.name}</div>
        </div>`
      : `<div style="font-family:Arial,sans-serif;font-size:13px;padding:2px 4px">
          <div style="color:#94a3b8">Outside ash fall zone</div>
          <div style="color:#64748b;font-size:11px">${preset.name}</div>
        </div>`;

    const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, className: "elev-popup", maxWidth: "240px" });
    popup.setLngLat([lng, lat]).setHTML(content).addTo(map);
    yellowstonePopupRef.current = popup;
  };

  const showImpactZonePopup = (lng, lat) => {
    const map = mapRef.current;
    if (!map) return;
    if (impactZonePopupRef.current) { impactZonePopupRef.current.remove(); impactZonePopupRef.current = null; }

    const result = impactResultRef.current;
    if (!result) return;

    // Use haversine to find distance from each impact point, pick closest
    const pts = impactPointsRef.current.length > 0 ? impactPointsRef.current : (impactPointRef.current ? [impactPointRef.current] : []);
    if (pts.length === 0) return;

    const haversineKm = (lat1, lng1, lat2, lng2) => {
      const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
      return R * 2 * Math.asin(Math.sqrt(a));
    };

    // Find closest impact point and use its result
    let closestPt = pts[0];
    let closestResult = pts[0].result || result;
    let closestDist = haversineKm(lat, lng, pts[0].lat, pts[0].lng);
    for (const pt of pts) {
      const d = haversineKm(lat, lng, pt.lat, pt.lng);
      if (d < closestDist) { closestDist = d; closestPt = pt; closestResult = pt.result || result; }
    }

    const distKm = haversineKm(lat, lng, closestPt.lat, closestPt.lng);
    const craterR  = (closestResult.crater_diameter_m ?? 0) / 2000;
    const blastR   = (closestResult.blast_radius_m ?? 0) / 1000;
    const thermalR = (closestResult.thermal_radius_m ?? 0) / 1000;

    let zone = null;
    if (distKm <= craterR) {
      zone = { name: "Crater Zone", color: "#fde047", survival: "0%",
        desc: `Direct impact — ${Math.round(closestResult.crater_diameter_m ?? 0).toLocaleString()}m diameter crater`,
        note: "Total vaporisation. No survival possible within crater radius." };
    } else if (distKm <= blastR) {
      const pct = Math.max(0, Math.round((1 - (distKm - craterR) / (blastR - craterR)) * 100));
      zone = { name: "Blast Zone", color: "#ef4444", survival: "~5-15%",
        desc: `${Math.round(closestResult.blast_radius_m ?? 0).toLocaleString()}m blast radius · ${Math.round(distKm).toLocaleString()}km from impact`,
        note: "Lethal overpressure. Reinforced underground shelter only. Most buildings destroyed." };
    } else if (distKm <= thermalR) {
      zone = { name: "Thermal Zone", color: "#f97316", survival: "~40-60%",
        desc: `${Math.round(closestResult.thermal_radius_m ?? 0).toLocaleString()}m thermal radius · ${Math.round(distKm).toLocaleString()}km from impact`,
        note: "Severe burns, fires ignite. Shelter underground or in concrete structure. Evacuate if possible." };
    } else {
      zone = { name: "Outside effect zones", color: "#94a3b8", survival: "High",
        desc: `${Math.round(distKm).toLocaleString()}km from nearest impact`,
        note: "Seismic effects possible. Monitor emergency broadcasts." };
    }

    const energyMt = Number(closestResult.energy_mt_tnt ?? closestResult.energy_mt ?? 0).toFixed(1);
    const content = `<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;padding:2px 4px">
      <div style="color:${zone.color};font-weight:700;margin-bottom:4px">💥 ${zone.name}</div>
      <div style="color:#e2e8f0;margin-bottom:4px">${zone.desc}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="color:#94a3b8;font-size:11px">Survival odds:</span>
        <span style="color:${zone.survival === '0%' ? '#ef4444' : zone.survival === 'High' ? '#4ade80' : '#fbbf24'};font-weight:700;font-size:13px">${zone.survival}</span>
      </div>
      <div style="color:#64748b;font-size:11px;font-style:italic">${zone.note}</div>
      <div style="color:#475569;font-size:10px;margin-top:4px">${closestResult.severity_class ?? ""} · ${energyMt} Mt</div>
    </div>`;

    const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, className: "elev-popup", maxWidth: "260px" });
    popup.setLngLat([lng, lat]).setHTML(content).addTo(map);
    impactZonePopupRef.current = popup;
  };

  const showNukeZonePopup = (lng, lat) => {
    const map = mapRef.current;
    if (!map) return;
    if (nukeZonePopupRef.current) { nukeZonePopupRef.current.remove(); nukeZonePopupRef.current = null; }

    const result = nukeResultRef.current;
    if (!result) return;

    // Find closest strike point
    const strikes = nukeStrikesRef.current;
    if (strikes.length === 0) return;

    const haversineKm = (lat1, lng1, lat2, lng2) => {
      const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
      return R * 2 * Math.asin(Math.sqrt(a));
    };

    // Find the closest strike's result data
    let closestStrike = strikes[0];
    let closestDist = haversineKm(lat, lng, strikes[0].lat, strikes[0].lng);
    for (const s of strikes) {
      const d = haversineKm(lat, lng, s.lat, s.lng);
      if (d < closestDist) { closestDist = d; closestStrike = s; }
    }

    // Use the first result (all strikes same yield) — nukeResult is combined
    const r = result;
    const distKm = haversineKm(lat, lng, closestStrike.lat, closestStrike.lng);
    const fireballR  = (r.fireball_r_m ?? 0) / 1000;
    const heavyR     = (r.blast_heavy_r_m ?? 0) / 1000;
    const moderateR  = (r.blast_moderate_r_m ?? 0) / 1000;
    const lightR     = (r.blast_light_r_m ?? 0) / 1000;
    const thermalR   = (r.thermal_r_m ?? 0) / 1000;

    const NUKE_ZONES = [
      { name: "Fireball", maxR: fireballR,  color: "#ffffff", survival: "0%",
        psi: ">200 psi", desc: "Nuclear fireball — total vaporisation",
        note: "Everything within this radius ceases to exist. Temperatures exceed the surface of the sun briefly." },
      { name: "Heavy Blast", maxR: heavyR,  color: "#dc2626", survival: "~0-2%",
        psi: "20 psi", desc: "Severe structural damage — reinforced concrete destroyed",
        note: "Only deep underground bunkers survive. All above-ground structures obliterated." },
      { name: "Moderate Blast", maxR: moderateR, color: "#ef4444", survival: "~5-15%",
        psi: "5 psi", desc: "Moderate blast — most buildings collapse",
        note: "Reinforced concrete may survive. Injuries from debris near-universal. Immediate evacuation essential." },
      { name: "Light Blast", maxR: lightR,  color: "#f59e0b", survival: "~40-60%",
        psi: "1 psi", desc: "Light blast — windows shatter, doors blown off",
        note: "Equivalent to strong hurricane. Shelter in sturdy building away from windows. Flying glass is main hazard." },
      { name: "Thermal Zone", maxR: thermalR, color: "#f97316", survival: "~50-70%",
        psi: "<1 psi", desc: "Thermal radiation — severe burns",
        note: "Third-degree burns on exposed skin. Seek shelter immediately, cover skin. Fire risk." },
    ];

    let zone = null;
    for (const z of NUKE_ZONES) {
      if (distKm <= z.maxR) { zone = z; break; }
    }
    if (!zone) {
      zone = { name: "Outside blast zones", color: "#94a3b8", survival: "High", psi: "<0.5 psi",
        desc: `${Math.round(distKm).toLocaleString()}km from nearest detonation`,
        note: "Possible fallout depending on wind direction. Monitor emergency broadcasts." };
    }

    const yieldStr = r.yield_kt >= 1000 ? `${(r.yield_kt/1000).toFixed(1)}Mt` : `${r.yield_kt}kt`;
    const content = `<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;padding:2px 4px">
      <div style="color:${zone.color};font-weight:700;margin-bottom:4px">☢️ ${zone.name}</div>
      <div style="color:#e2e8f0;margin-bottom:4px">${zone.desc}</div>
      <div style="display:flex;gap:12px;margin-bottom:4px">
        <div><span style="color:#94a3b8;font-size:11px">Overpressure: </span><span style="color:#e2e8f0;font-weight:700;font-size:12px">${zone.psi}</span></div>
        <div><span style="color:#94a3b8;font-size:11px">Survival: </span><span style="color:${zone.survival === '0%' ? '#ef4444' : zone.survival === '~0-2%' ? '#ef4444' : zone.survival === 'High' ? '#4ade80' : '#fbbf24'};font-weight:700;font-size:12px">${zone.survival}</span></div>
      </div>
      <div style="color:#64748b;font-size:11px;font-style:italic">${zone.note}</div>
      <div style="color:#475569;font-size:10px;margin-top:4px">${yieldStr} ${r.burst_type ?? "airburst"} · ${Math.round(distKm).toLocaleString()}km from detonation</div>
    </div>`;

    const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, className: "elev-popup", maxWidth: "270px" });
    popup.setLngLat([lng, lat]).setHTML(content).addTo(map);
    nukeZonePopupRef.current = popup;
  };

  // Wind kill zone data — centered on max displacement point and new equator midpoint
  const CATACLYSM_WIND = {
    davidson: {
      // Center 1: Max rotational velocity — mid-latitude for ellipse appearance
      center1: [-90, -35],
      // Center 2: Secondary — opposite side
      center2: [90, 35],
      // Wind speeds from 90° rotation in 12hrs: ~3,700 km/h peak at equator
      zones: [
        { name: "Instant Death", speedLabel: "3,700+ km/h", desc: "Hypersonic winds — total annihilation", survival: "0%", survivalNote: "No structure survives. Ground-level pressure wave equivalent to multiple nuclear detonations.", major_km: 2000, minor_km: 1200, color: "#ef4444", opacity: 0.55 },
        { name: "Severe", speedLabel: "1,500-3,700 km/h", desc: "Supersonic winds — catastrophic", survival: "1-3%", survivalNote: "Only deepest underground bunkers. Complete surface destruction.", major_km: 4500, minor_km: 2700, color: "#f97316", opacity: 0.30 },
        { name: "Dangerous", speedLabel: "500-1,500 km/h", desc: "Extreme winds — reinforced shelter required", survival: "10-20%", survivalNote: "Underground or heavily reinforced structure required. Most buildings destroyed.", major_km: 7500, minor_km: 4500, color: "#fbbf24", opacity: 0.18 },
        { name: "Hazardous", speedLabel: "150-500 km/h", desc: "Super-hurricane force winds", survival: "30-55%", survivalNote: "Strong shelter needed. Equivalent to EF5 tornado. Widespread structural damage.", major_km: 12000, minor_km: 7200, color: "#a3e635", opacity: 0.10 },
        { name: "Survivable", speedLabel: "50-150 km/h", desc: "Severe storm-force winds", survival: "60-80%", survivalNote: "Most people survive in sturdy buildings. Flying debris is main hazard.", major_km: 18000, minor_km: 10800, color: "#38bdf8", opacity: 0.06 },
      ],
    },
    tes: {
      // Center 1: Max rotational velocity — mid-latitude for ellipse appearance
      center1: [-59, -35],
      // Center 2: Pacific basin resonance
      center2: [121, 35],
      // TES 104° rotation in 10.5hrs along 31°E meridian
      zones: [
        { name: "Instant Death", speedLabel: "5,800+ km/h", desc: "Hypersonic winds — total annihilation", survival: "0%", survivalNote: "Complete atmospheric scouring. No survival possible.", major_km: 2500, minor_km: 1500, color: "#ef4444", opacity: 0.55 },
        { name: "Severe", speedLabel: "2,500-5,800 km/h", desc: "Supersonic winds — catastrophic", survival: "1-2%", survivalNote: "Only deepest underground bunkers. All surface structures obliterated.", major_km: 5500, minor_km: 3300, color: "#f97316", opacity: 0.30 },
        { name: "Dangerous", speedLabel: "800-2,500 km/h", desc: "Extreme winds — reinforced shelter required", survival: "5-15%", survivalNote: "Only deepest underground bunkers. Mountain barriers offer partial protection.", major_km: 9000, minor_km: 5400, color: "#fbbf24", opacity: 0.18 },
        { name: "Hazardous", speedLabel: "200-800 km/h", desc: "Super-hurricane force winds", survival: "20-40%", survivalNote: "Strong underground shelter needed. Equivalent to multiple EF5 tornadoes simultaneously.", major_km: 14000, minor_km: 8400, color: "#a3e635", opacity: 0.10 },
        { name: "Survivable", speedLabel: "50-200 km/h", desc: "Severe storm-force winds", survival: "50-70%", survivalNote: "Sturdy buildings provide shelter. Flying debris and flooding are main hazards.", major_km: 20000, minor_km: 12000, color: "#38bdf8", opacity: 0.06 },
      ],
    },
  };

  const CATACLYSM_WIND_SOURCE = "cataclysm-wind-source";
  const CATACLYSM_WIND_PREFIX = "cataclysm-wind";

  const buildNewEquator = (poleLat, poleLng, steps = 120) => {
    const pLat = poleLat * Math.PI / 180;
    const pLng = poleLng * Math.PI / 180;
    const px = Math.cos(pLat) * Math.cos(pLng);
    const py = Math.cos(pLat) * Math.sin(pLng);
    const pz = Math.sin(pLat);
    const arb = Math.abs(px) < 0.9 ? [1,0,0] : [0,1,0];
    let v1x = arb[1]*pz - arb[2]*py, v1y = arb[2]*px - arb[0]*pz, v1z = arb[0]*py - arb[1]*px;
    const mag = Math.sqrt(v1x**2 + v1y**2 + v1z**2);
    v1x /= mag; v1y /= mag; v1z /= mag;
    const v2x = py*v1z - pz*v1y, v2y = pz*v1x - px*v1z, v2z = px*v1y - py*v1x;
    const coords = [];
    for (let i = 0; i <= steps; i++) {
      const t = 2 * Math.PI * i / steps;
      const x = Math.cos(t)*v1x + Math.sin(t)*v2x;
      const y = Math.cos(t)*v1y + Math.sin(t)*v2y;
      const z = Math.cos(t)*v1z + Math.sin(t)*v2z;
      const lat = Math.asin(Math.max(-1, Math.min(1, z))) * 180 / Math.PI;
      const lng = Math.atan2(y, x) * 180 / Math.PI;
      coords.push([lng, lat]);
    }
    for (let i = 1; i < coords.length; i++) {
      const diff = coords[i][0] - coords[i-1][0];
      if (diff > 180) coords[i][0] -= 360;
      else if (diff < -180) coords[i][0] += 360;
    }
    return coords;
  };

  const drawNewEquator = (map, poleLat, poleLng) => {
    try { if (map.getLayer("cataclysm-equator")) map.removeLayer("cataclysm-equator"); } catch(e){}
    try { if (map.getSource("cataclysm-equator-src")) map.removeSource("cataclysm-equator-src"); } catch(e){}
    const coords = buildNewEquator(poleLat, poleLng);
    try {
      map.addSource("cataclysm-equator-src", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} }
      });
      map.addLayer({
        id: "cataclysm-equator",
        type: "line",
        source: "cataclysm-equator-src",
        paint: { "line-color": "#ef4444", "line-width": 2.5, "line-opacity": 0.9, "line-dasharray": [6, 3] }
      });
    } catch(e) { console.warn("Equator draw error", e); }
  };

  const clearCataclysm = () => {
    const map = mapRef.current;
    setCataclysmActive(false);
    setCataclysmAnimating(false);
    clearYDI(); // also cleans up YDI flood layers and ice sheets
    if (window._cataclysmPoleMarker) { try { window._cataclysmPoleMarker.remove(); } catch(e){} window._cataclysmPoleMarker = null; }
    setViewMode("map");
    // Stop spin animation
    if (cataclysmSpinRef.current) { cancelAnimationFrame(cataclysmSpinRef.current); cataclysmSpinRef.current = null; }
    if (map && map.isStyleLoaded()) {
      // Re-enable map interaction in case it was locked for free tier
      try { map.dragPan.enable(); map.scrollZoom.enable(); map.doubleClickZoom.enable(); map.touchZoomRotate.enable(); } catch(e){}
      // Reset bearing and pitch first, then switch projection and style after
      safely(() => map.jumpTo({ bearing: 0, pitch: 0 }));
      safely(() => {
        map.setProjection("globe");
        map.setStyle("mapbox://styles/mapbox/streets-v12");
      });
      // Fly to default view after style loads
      map.once("style.load", () => {
        safely(() => map.flyTo({ center: [-80.19, 25.76], zoom: 2.5, bearing: 0, pitch: 0, duration: 800 }));
      });
      try { if (map.getLayer("cataclysm-layer")) map.removeLayer("cataclysm-layer"); } catch(e){}
      try { if (map.getSource("cataclysm-source")) map.removeSource("cataclysm-source"); } catch(e){}
      try { if (map.getLayer("cataclysm-pole-marker")) map.removeLayer("cataclysm-pole-marker"); } catch(e){}
      try { if (map.getSource("cataclysm-pole-marker-src")) map.removeSource("cataclysm-pole-marker-src"); } catch(e){}
      // Clear wind layers
      [0, 1].forEach(ci => {
        [0,1,2,3,4].forEach(ri => {
          try { if (map.getLayer(`${CATACLYSM_WIND_PREFIX}-${ci}-fill-${ri}`)) map.removeLayer(`${CATACLYSM_WIND_PREFIX}-${ci}-fill-${ri}`); } catch(e){}
          try { if (map.getLayer(`${CATACLYSM_WIND_PREFIX}-${ci}-line-${ri}`)) map.removeLayer(`${CATACLYSM_WIND_PREFIX}-${ci}-line-${ri}`); } catch(e){}
          try { if (map.getLayer(`${CATACLYSM_WIND_PREFIX}-${ci}-label-${ri}`)) map.removeLayer(`${CATACLYSM_WIND_PREFIX}-${ci}-label-${ri}`); } catch(e){}
        });
        try { if (map.getSource(`${CATACLYSM_WIND_SOURCE}-${ci}`)) map.removeSource(`${CATACLYSM_WIND_SOURCE}-${ci}`); } catch(e){}
      });
    }
  };

  // ── Younger Dryas Impact ─────────────────────────────────────────────────
  const clearYDI = () => {
    if (ydiIceFrameRef.current) { cancelAnimationFrame(ydiIceFrameRef.current); ydiIceFrameRef.current = null; }
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) {
      // Flood corridor layers
      ["ydi-flood-halo", "ydi-flood-mid", "ydi-flood-core"].forEach(id => {
        try { if (map.getLayer(id)) map.removeLayer(id); } catch(e){}
      });
      try { if (map.getSource("ydi-flood-source")) map.removeSource("ydi-flood-source"); } catch(e){}
      // Source node markers
      YDI_SOURCE_NODES.forEach(n => {
        try { if (map.getLayer(`ydi-node-${n.id}`)) map.removeLayer(`ydi-node-${n.id}`); } catch(e){}
        try { if (map.getSource(`ydi-node-src-${n.id}`)) map.removeSource(`ydi-node-src-${n.id}`); } catch(e){}
      });
      // Ice sheets
      try { if (map.getLayer(`${ICE_SHEET_PREFIX}-fill`)) map.removeLayer(`${ICE_SHEET_PREFIX}-fill`); } catch(e){}
      try { if (map.getLayer(`${ICE_SHEET_PREFIX}-line`)) map.removeLayer(`${ICE_SHEET_PREFIX}-line`); } catch(e){}
      try { if (map.getLayer(`${ICE_SHEET_PREFIX}-label`)) map.removeLayer(`${ICE_SHEET_PREFIX}-label`); } catch(e){}
      try { if (map.getSource(ICE_SHEET_SOURCE)) map.removeSource(ICE_SHEET_SOURCE); } catch(e){}
    }
  };

  const triggerYDI = (intensity = ydiIntensityRef.current) => {
    const map = mapRef.current;
    if (!map) return;
    clearYDI();
    const run = ++ydiRunRef.current;
    setStatus("☄️ Younger Dryas Impact — Laurentide ice collapse initiating…");
    safely(() => map.setProjection("mercator"));

    // Fly to North America
    safely(() => map.flyTo({ center: [-96, 50], zoom: 3.2, duration: 1400, essential: true }));

    // Phase 1: animate pulsing ice sheets (500ms after fly starts)
    setTimeout(() => {
      if (ydiRunRef.current !== run) return;
      const features = YDI_ICE_SHEETS.map((sheet, i) => ({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[...sheet.coords, sheet.coords[0]].map(([lng, lat]) => [lng, lat])]
        },
        properties: { name: sheet.name, color: sheet.color, idx: i },
      }));
      const fc = { type: "FeatureCollection", features };
      try {
        if (map.getSource(ICE_SHEET_SOURCE)) {
          map.getSource(ICE_SHEET_SOURCE).setData(fc);
        } else {
          map.addSource(ICE_SHEET_SOURCE, { type: "geojson", data: fc });
          map.addLayer({ id: `${ICE_SHEET_PREFIX}-fill`, type: "fill", source: ICE_SHEET_SOURCE,
            paint: { "fill-color": ["get", "color"], "fill-opacity": 0.0 } });
          map.addLayer({ id: `${ICE_SHEET_PREFIX}-line`, type: "line", source: ICE_SHEET_SOURCE,
            paint: { "line-color": "#93c5fd", "line-width": 1.8, "line-opacity": 0.0 } });
        }
      } catch(e) {}
      setStatus("☄️ Younger Dryas — Laurentide & Cordilleran ice sheets at maximum extent");

      // Fade ice sheets in
      let t = 0;
      const fadeIn = () => {
        if (ydiRunRef.current !== run) return;
        t += 0.03;
        const op = Math.min(t, 1);
        try { map.setPaintProperty(`${ICE_SHEET_PREFIX}-fill`, "fill-opacity", op * 0.5); } catch(e){}
        try { map.setPaintProperty(`${ICE_SHEET_PREFIX}-line`, "line-opacity", op * 0.9); } catch(e){}
        if (t < 1) { ydiIceFrameRef.current = requestAnimationFrame(fadeIn); }
        else { ydiIceFrameRef.current = null; }
      };
      ydiIceFrameRef.current = requestAnimationFrame(fadeIn);
    }, 600);

    // Phase 2: pulse ice sheets 3 times then release floods (3s)
    setTimeout(() => {
      if (ydiRunRef.current !== run) return;
      let pulseCount = 0;
      const maxPulses = 3;
      let pulsing = true;
      const pulse = (timestamp) => {
        if (ydiRunRef.current !== run || !pulsing) return;
        const cycle = (Math.sin(timestamp / 280) + 1) / 2; // 0→1 pulse
        try { map.setPaintProperty(`${ICE_SHEET_PREFIX}-fill`, "fill-opacity", 0.25 + cycle * 0.45); } catch(e){}
        try { map.setPaintProperty(`${ICE_SHEET_PREFIX}-line`, "line-opacity", 0.5 + cycle * 0.5); } catch(e){}
        ydiIceFrameRef.current = requestAnimationFrame(pulse);
      };
      ydiIceFrameRef.current = requestAnimationFrame(pulse);

      // Add source node markers
      YDI_SOURCE_NODES.forEach(n => {
        try {
          if (!map.getSource(`ydi-node-src-${n.id}`)) {
            map.addSource(`ydi-node-src-${n.id}`, { type: "geojson", data: {
              type: "Feature", geometry: { type: "Point", coordinates: [n.lng, n.lat] }, properties: {}
            }});
            map.addLayer({ id: `ydi-node-${n.id}`, type: "circle", source: `ydi-node-src-${n.id}`,
              paint: { "circle-radius": 8, "circle-color": "#38bdf8", "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff", "circle-opacity": 0.0, "circle-stroke-opacity": 0.0 } });
          }
        } catch(e){}
      });

      // Fade nodes in
      let nt = 0;
      const fadeNodes = () => {
        if (ydiRunRef.current !== run) return;
        nt = Math.min(nt + 0.05, 1);
        YDI_SOURCE_NODES.forEach(n => {
          try { map.setPaintProperty(`ydi-node-${n.id}`, "circle-opacity", nt); } catch(e){}
          try { map.setPaintProperty(`ydi-node-${n.id}`, "circle-stroke-opacity", nt); } catch(e){}
        });
        if (nt < 1) requestAnimationFrame(fadeNodes);
      };
      requestAnimationFrame(fadeNodes);
      setStatus("☄️ Younger Dryas — meltwater surge initiating…");
    }, 2200);

    // Phase 3: release floods (5.5s after trigger)
    setTimeout(() => {
      if (ydiRunRef.current !== run) return;
      // Stop pulse, settle ice at medium opacity
      if (ydiIceFrameRef.current) { cancelAnimationFrame(ydiIceFrameRef.current); ydiIceFrameRef.current = null; }
      try { map.setPaintProperty(`${ICE_SHEET_PREFIX}-fill`, "fill-opacity", 0.35); } catch(e){}
      try { map.setPaintProperty(`${ICE_SHEET_PREFIX}-line`, "line-opacity", 0.7); } catch(e){}

      // Draw flood corridors — split each into segments with tapering width
      // Width starts at 100% at source, tapers to 30% at terminus (hydrologically correct)
      const corridorData = YDI_FLOOD_CORRIDORS[intensity] || YDI_FLOOD_CORRIDORS.medium;

      // Calculate total flow volume across all corridors
      const totalFlow = corridorData.features.reduce((sum, c) => sum + (c.flow_km3 || 0), 0);
      const totalFlowStr = totalFlow > 0 ? totalFlow.toLocaleString() : "";
      setStatus(`☄️ Younger Dryas — ${intensity.toUpperCase()} flood release · ~${totalFlowStr} km³ total meltwater`);
      const features = [];
      corridorData.features.forEach((corridor, fi) => {
        const n = corridor.coords.length;
        if (n < 2) return;
        // Split into segments, each with its own width based on position along corridor
        for (let i = 0; i < n - 1; i++) {
          const t0 = i / (n - 1);           // 0 = source, 1 = terminus
          const t1 = (i + 1) / (n - 1);
          const tMid = (t0 + t1) / 2;
          // Taper: starts wide, narrows toward end (100% → 30%)
          const taper = 1.0 - (tMid * 0.7);
          features.push({
            type: "Feature",
            geometry: { type: "LineString", coordinates: [corridor.coords[i], corridor.coords[i+1]] },
            properties: {
              name: corridor.name,
              width: corridor.width * taper,
              idx: fi,
              flow_km3: corridor.flow_km3 || 0,
              dissipation: corridor.dissipation || "",
              seg: i,
            }
          });
        }
      });
      const fc = { type: "FeatureCollection", features };
      const srcId  = "ydi-flood-source";
      const haloId = "ydi-flood-halo";
      const coreId = "ydi-flood-core";
      try {
        [haloId, coreId].forEach(id => { try { if (map.getLayer(id)) map.removeLayer(id); } catch(e){} });
        try { if (map.getSource(srcId)) map.removeSource(srcId); } catch(e){}
        map.addSource(srcId, { type: "geojson", data: fc });
        // Zoom-interpolated widths — corridors scale with map so they don't shrink on zoom
        // Base multipliers: halo=4x, mid=2x, core=1x relative to width property
        // Zoom-interpolated widths — doubled for visibility
        const zoomWidth = (base) => ["interpolate", ["linear"], ["zoom"],
          2,  ["*", ["get", "width"], base * 4],
          4,  ["*", ["get", "width"], base * 12],
          6,  ["*", ["get", "width"], base * 32],
          8,  ["*", ["get", "width"], base * 80],
          10, ["*", ["get", "width"], base * 180],
        ];

        // Outer halo — 4x core, lightest blue, 150% per side fringe, semi-transparent
        map.addLayer({ id: haloId, type: "line", source: srcId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#bfdbfe",
            "line-width": zoomWidth(4),
            "line-opacity": 0.32,
            "line-blur": 8,
          }
        });
        // Mid layer — 2x core, medium blue, semi-transparent
        map.addLayer({ id: "ydi-flood-mid", type: "line", source: srcId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#3b82f6",
            "line-width": zoomWidth(2),
            "line-opacity": 0.52,
            "line-blur": 2,
          }
        });
        // Core — solid dark blue, main channel
        map.addLayer({ id: coreId, type: "line", source: srcId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#1e40af",
            "line-width": zoomWidth(1),
            "line-opacity": 0.78,
            "line-blur": 0.5,
          }
        });
        // Click popup
        map.on("click", haloId, (e) => {
          if (scenarioModeRef.current !== "cataclysm" || cataclysmModelRef.current !== "ydi") return;
          const name = e.features?.[0]?.properties?.name || "Flood Corridor";
          const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: true, className: "elev-popup", maxWidth: "220px" });
          const props = e.features?.[0]?.properties || {};
          const intens = ydiIntensityRef.current;
          const depthCore = intens === "high" ? "150-300m" : intens === "medium" ? "80-150m" : "30-80m";
          const depthMid  = intens === "high" ? "50-150m"  : intens === "medium" ? "30-80m"  : "10-30m";
          const depthHalo = intens === "high" ? "10-50m"   : intens === "medium" ? "5-30m"   : "1-10m";
          const flowKm3   = props.flow_km3 ? `${(props.flow_km3).toLocaleString()} km³` : "—";
          const dissip    = props.dissipation || "Drains southward following terrain gradient";
          popup.setLngLat(e.lngLat).setHTML(`<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;padding:2px 4px">
            <div style="color:#38bdf8;font-weight:700;margin-bottom:4px">🌊 ${name}</div>
            <div style="color:#e2e8f0;font-size:11px;margin-bottom:6px">Younger Dryas Meltwater · ~12,900 BP</div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #1e2d45">
              <span style="font-size:11px;color:#94a3b8">Est. flow volume</span>
              <span style="font-size:12px;font-weight:700;color:#38bdf8">${flowKm3}</span>
            </div>
            <div style="margin-bottom:6px">
              <div style="display:flex;justify-content:space-between;margin-bottom:2px">
                <span style="font-size:11px;color:#1e3a8a;font-weight:700">■ Core channel</span>
                <span style="font-size:11px;color:#e2e8f0">${depthCore} deep</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:2px">
                <span style="font-size:11px;color:#2563eb;font-weight:700">■ Mid zone</span>
                <span style="font-size:11px;color:#e2e8f0">${depthMid} deep</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span style="font-size:11px;color:#60a5fa;font-weight:700">■ Shallow fringe</span>
                <span style="font-size:11px;color:#e2e8f0">${depthHalo} deep</span>
              </div>
            </div>
            <div style="font-size:11px;color:#64748b;font-style:italic;margin-bottom:4px;line-height:1.4">${dissip}</div>
            <div style="color:#ef4444;font-weight:700;font-size:11px">⚠ Inundated — high ground survival only</div>
          </div>`).addTo(map);
        });
        map.on("mouseenter", haloId, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", haloId, () => { map.getCanvas().style.cursor = "crosshair"; });
        safely(() => map.triggerRepaint());
      } catch(e) { console.error("YDI flood draw error", e); }

      // Zoom out to see full North American extent
      setTimeout(() => {
        if (ydiRunRef.current !== run) return;
        safely(() => map.flyTo({ center: [-96, 46], zoom: 2.8, duration: 2000, essential: true }));
      }, 800);

    }, 5500);
  };

  const drawIceSheets = (map) => {
    // Build features — zones with `rings` become MultiPolygon, others become Polygon
    const features = ICE_SHEET_ZONES.map((z, i) => {
      let geometry;
      if (z.rings) {
        // MultiPolygon — each ring is a separate polygon (e.g. Britain + Ireland)
        const closeRing = (r) => {
          const c = [...r];
          if (c[0][0] !== c[c.length-1][0] || c[0][1] !== c[c.length-1][1]) c.push(c[0]);
          return c;
        };
        geometry = { type: "MultiPolygon", coordinates: z.rings.map(r => [closeRing(r)]) };
      } else {
        const ring = z.coords;
        const closed = [...ring];
        if (closed[0][0] !== closed[closed.length-1][0] || closed[0][1] !== closed[closed.length-1][1]) closed.push(closed[0]);
        geometry = { type: "Polygon", coordinates: [closed] };
      }
      return { type: "Feature", geometry, properties: { name: z.name, color: z.color, idx: i } };
    });

    // Label points — centroid of bounding box of coords (or first ring)
    const labelFeatures = ICE_SHEET_ZONES.map((z, i) => {
      const coords = z.rings ? z.rings[0] : z.coords;
      const lngs = coords.map(c => c[0]);
      const lats = coords.map(c => c[1]);
      const cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [cLng, cLat] },
        properties: { name: z.name, color: z.color, idx: i },
      };
    });

    const fc      = { type: "FeatureCollection", features };
    const labelFc = { type: "FeatureCollection", features: labelFeatures };

    try {
      if (map.getSource(ICE_SHEET_SOURCE)) {
        map.getSource(ICE_SHEET_SOURCE).setData(fc);
        if (map.getSource(`${ICE_SHEET_SOURCE}-labels`)) {
          map.getSource(`${ICE_SHEET_SOURCE}-labels`).setData(labelFc);
        }
      } else {
        map.addSource(ICE_SHEET_SOURCE, { type: "geojson", data: fc });
        map.addSource(`${ICE_SHEET_SOURCE}-labels`, { type: "geojson", data: labelFc });
        map.addLayer({
          id: `${ICE_SHEET_PREFIX}-fill`, type: "fill", source: ICE_SHEET_SOURCE,
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.45 }
        });
        map.addLayer({
          id: `${ICE_SHEET_PREFIX}-line`, type: "line", source: ICE_SHEET_SOURCE,
          paint: { "line-color": "#93c5fd", "line-width": 1.5, "line-opacity": 0.9 }
        });
        map.addLayer({
          id: `${ICE_SHEET_PREFIX}-label`, type: "symbol",
          source: `${ICE_SHEET_SOURCE}-labels`,
          layout: {
            "text-field": ["get", "name"],
            "text-size": 11,
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-offset": [0, 0],
            "text-anchor": "center",
          },
          paint: { "text-color": "#bfdbfe", "text-halo-color": "#0a0f1e", "text-halo-width": 2 }
        });
      }
    } catch(e) { console.warn("Ice sheet error", e); }
  };

  const clearIceSheets = (map) => {
    try { if (map.getLayer(`${ICE_SHEET_PREFIX}-label`)) map.removeLayer(`${ICE_SHEET_PREFIX}-label`); } catch(e){}
    try { if (map.getLayer(`${ICE_SHEET_PREFIX}-line`)) map.removeLayer(`${ICE_SHEET_PREFIX}-line`); } catch(e){}
    try { if (map.getLayer(`${ICE_SHEET_PREFIX}-fill`)) map.removeLayer(`${ICE_SHEET_PREFIX}-fill`); } catch(e){}
    try { if (map.getSource(`${ICE_SHEET_SOURCE}-labels`)) map.removeSource(`${ICE_SHEET_SOURCE}-labels`); } catch(e){}
    try { if (map.getSource(ICE_SHEET_SOURCE)) map.removeSource(ICE_SHEET_SOURCE); } catch(e){}
  };

  const drawWildfireZones = (map, warmingLevel) => {
    // Show all zones up to and including current warming level (cumulative)
    const activeZones = WILDFIRE_ZONES.filter(z => z.minLevel <= warmingLevel);
    const features = activeZones.map((z, i) => ({
      ...buildAshEllipse(z.center[0], z.center[1], z.major_km, z.minor_km, z.bearing),
      properties: { name: z.name, color: z.color, idx: i },
    }));
    try {
      if (map.getSource(WILDFIRE_SOURCE)) {
        map.getSource(WILDFIRE_SOURCE).setData({ type: "FeatureCollection", features });
      } else {
        map.addSource(WILDFIRE_SOURCE, { type: "geojson", data: { type: "FeatureCollection", features } });
        map.addLayer({ id: `${WILDFIRE_PREFIX}-fill`, type: "fill", source: WILDFIRE_SOURCE,
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.25 } });
        map.addLayer({ id: `${WILDFIRE_PREFIX}-line`, type: "line", source: WILDFIRE_SOURCE,
          paint: { "line-color": ["get", "color"], "line-width": 1.5, "line-opacity": 0.8 } });
        map.addLayer({ id: `${WILDFIRE_PREFIX}-label`, type: "symbol", source: WILDFIRE_SOURCE,
          layout: { "symbol-placement": "line", "text-field": ["get", "name"],
                    "text-size": 11, "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                    "text-offset": [0, -0.8], "symbol-spacing": 400 },
          paint: { "text-color": ["get", "color"], "text-halo-color": "#0a0f1e", "text-halo-width": 2 } });
      }
    } catch(e) { console.warn("Wildfire zone error", e); }
  };

  const clearWildfireZones = (map) => {
    try { if (map.getLayer(`${WILDFIRE_PREFIX}-label`)) map.removeLayer(`${WILDFIRE_PREFIX}-label`); } catch(e){}
    try { if (map.getLayer(`${WILDFIRE_PREFIX}-line`)) map.removeLayer(`${WILDFIRE_PREFIX}-line`); } catch(e){}
    try { if (map.getLayer(`${WILDFIRE_PREFIX}-fill`)) map.removeLayer(`${WILDFIRE_PREFIX}-fill`); } catch(e){}
    try { if (map.getSource(WILDFIRE_SOURCE)) map.removeSource(WILDFIRE_SOURCE); } catch(e){}
  };

  const drawCataclysmWindZones = (map, model) => {
    const windData = CATACLYSM_WIND[model];
    if (!windData) return;
    const centers = [windData.center1, windData.center2];
    centers.forEach(([cLng, cLat], ci) => {
      const features = [...windData.zones].reverse().map((zone, i) => ({
        ...buildWindEllipse(cLng, cLat, zone.major_km, zone.minor_km),
        properties: { zoneIdx: windData.zones.length - 1 - i, ...zone },
      }));
      try {
        const srcId = `${CATACLYSM_WIND_SOURCE}-${ci}`;
        if (map.getSource(srcId)) {
          map.getSource(srcId).setData({ type: "FeatureCollection", features });
        } else {
          map.addSource(srcId, { type: "geojson", data: { type: "FeatureCollection", features } });
          windData.zones.forEach((zone, i) => {
            map.addLayer({ id: `${CATACLYSM_WIND_PREFIX}-${ci}-fill-${i}`, type: "fill", source: srcId,
              filter: ["==", ["get", "zoneIdx"], i],
              paint: { "fill-color": zone.color, "fill-opacity": zone.opacity } });
            map.addLayer({ id: `${CATACLYSM_WIND_PREFIX}-${ci}-line-${i}`, type: "line", source: srcId,
              filter: ["==", ["get", "zoneIdx"], i],
              paint: { "line-color": zone.color, "line-width": 1.5, "line-opacity": 0.9 } });
            map.addLayer({ id: `${CATACLYSM_WIND_PREFIX}-${ci}-label-${i}`, type: "symbol", source: srcId,
              filter: ["==", ["get", "zoneIdx"], i],
              layout: { "symbol-placement": "line", "text-field": ["get", "speedLabel"],
                        "text-size": 11, "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                        "text-offset": [0, -0.8], "symbol-spacing": 350 },
              paint: { "text-color": ["get", "color"], "text-halo-color": "#0a0f1e", "text-halo-width": 2 } });
          });
        }
      } catch(e) { console.warn("Wind zone error", e); }
    });
  };

  const applyCataclysmOverlay = (map, model, overlay) => {
    // Show/hide flood tiles
    const showFlood = overlay === "flood" || overlay === "both";
    const showWind  = overlay === "wind"  || overlay === "both";
    try { if (map.getLayer("cataclysm-layer")) map.setPaintProperty("cataclysm-layer", "raster-opacity", showFlood ? 0.82 : 0); } catch(e){}
    // Show/hide wind layers
    [0, 1].forEach(ci => {
      [0,1,2,3,4].forEach(ri => {
        ["fill","line","label"].forEach(t => {
          try { if (map.getLayer(`${CATACLYSM_WIND_PREFIX}-${ci}-${t}-${ri}`)) map.setLayoutProperty(`${CATACLYSM_WIND_PREFIX}-${ci}-${t}-${ri}`, "visibility", showWind ? "visible" : "none"); } catch(e){}
        });
      });
    });
  };

  const cataclysmWindPopupRef = useRef(null);

  const showCataclysmWindPopup = (lng, lat) => {
    const map = mapRef.current;
    if (!map) return;
    if (cataclysmWindPopupRef.current) { cataclysmWindPopupRef.current.remove(); cataclysmWindPopupRef.current = null; }
    const model = cataclysmModelRef.current;
    const windData = CATACLYSM_WIND[model];
    if (!windData) return;

    let zoneInfo = null;
    let centerLabel = null;

    // Check both centers
    const centers = [windData.center1, windData.center2];
    const centerNames = model === "davidson"
      ? ["Max Displacement Zone", "New Equator Zone"]
      : ["New Equator / S. Atlantic", "Pacific Basin Resonance"];

    for (let ci = 0; ci < centers.length && !zoneInfo; ci++) {
      const [cLng, cLat] = centers[ci];
      const kpLat = 110.574;
      const kpLng = 111.32 * Math.cos((cLat * Math.PI) / 180);
      const bearingRad = (70 * Math.PI) / 180;
      const dNorth = Math.cos(bearingRad);
      const dEast  = Math.sin(bearingRad);
      // Test ALL zones, keep the innermost (most severe) match
      // Iterate outermost→innermost — last match wins
      for (let i = windData.zones.length - 1; i >= 0; i--) {
        const z = windData.zones[i];
        const eCLat = cLat + (dNorth * z.major_km * 0.3) / kpLat;
        const eCLng = cLng + (dEast  * z.major_km * 0.3) / Math.max(kpLng, 0.0001);
        const dLatKm = (lat - eCLat) * kpLat;
        let rawDLng = lng - eCLng;
        while (rawDLng > 180) rawDLng -= 360;
        while (rawDLng < -180) rawDLng += 360;
        const dLngKm = rawDLng * Math.max(kpLng, 0.0001);
        const along = dNorth * dLatKm + dEast * dLngKm;
        const perp  = -dEast * dLatKm + dNorth * dLngKm;
        if ((along / z.major_km) ** 2 + (perp / z.minor_km) ** 2 <= 1.0) {
          zoneInfo = z;
          centerLabel = centerNames[ci];
          // keep going — inner zones may also match
        }
      }
    }

    const survivalColor = !zoneInfo ? "#94a3b8"
      : zoneInfo.survival === "0%" ? "#ef4444"
      : zoneInfo.survival.startsWith("1") ? "#f97316"
      : "#fbbf24";

    const modelLabel = model === "davidson" ? "Davidson Pole Shift" : "TES ECDO Theory";
    const content = zoneInfo
      ? `<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;padding:2px 4px">
          <div style="color:${zoneInfo.color};font-weight:700;margin-bottom:4px">💨 ${zoneInfo.name}</div>
          <div style="color:#e2e8f0;margin-bottom:4px">${zoneInfo.desc}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="color:#94a3b8;font-size:11px">Survival odds:</span>
            <span style="color:${survivalColor};font-weight:700;font-size:13px">${zoneInfo.survival}</span>
          </div>
          <div style="color:#64748b;font-size:11px;font-style:italic">${zoneInfo.survivalNote}</div>
          <div style="color:#475569;font-size:10px;margin-top:4px">${modelLabel} · ${centerLabel}</div>
        </div>`
      : `<div style="font-family:Arial,sans-serif;font-size:13px;padding:2px 4px">
          <div style="color:#94a3b8">Outside wind kill zone</div>
          <div style="color:#64748b;font-size:11px">${modelLabel}</div>
        </div>`;

    const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, className: "elev-popup", maxWidth: "260px" });
    popup.setLngLat([lng, lat]).setHTML(content).addTo(map);
    cataclysmWindPopupRef.current = popup;
  };

  const showCataclysmFloodPopup = async (lng, lat) => {
    const map = mapRef.current;
    if (!map) return;
    closeElevPopup();
    const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, maxWidth: "260px" });
    popup.setLngLat([lng, lat])
      .setHTML(`<div style="font-family:Arial,sans-serif;font-size:13px;padding:4px 6px;color:#94a3b8">Loading...</div>`)
      .addTo(map);
    elevPopupRef.current = popup;
    const model = cataclysmModelRef.current;
    const modelLabel = model === "davidson" ? "Ben Davidson 90°" : "TES ECDO 104°";
    try {
      const res = await fetch(
        `${floodEngineUrlRef.current}/elevation?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (elevPopupRef.current !== popup) return;
      const terrainM = data.elevation_m ?? 0;

      // Calculate flood depth client-side — same math as tile server
      const CPARAMS = {
        davidson: { npLat:22, npLng:90, maxF:1700, rotDeg:90, rotHrs:12, maxDyn:0 },
        tes:      { npLat:-13.5, npLng:31,   maxF:1200, rotDeg:104, rotHrs:10.5, maxDyn:1100 },
      };
      const p = CPARAMS[model];
      const latR = lat*Math.PI/180, lngR = lng*Math.PI/180;
      const cosD = Math.sin(latR)*Math.sin(p.npLat*Math.PI/180)+Math.cos(latR)*Math.cos(p.npLat*Math.PI/180)*Math.cos(lngR-p.npLng*Math.PI/180);
      const npDist = Math.acos(Math.max(-1,Math.min(1,cosD)))*180/Math.PI;
      const delta = Math.abs(npDist-90)-Math.abs(lat);
      const staticM = delta<0 ? Math.min(1,Math.abs(delta)/p.rotDeg)*p.maxF : 0;
      const vel = (p.rotDeg*Math.PI/180/(p.rotHrs*3600))*6371000*Math.cos(latR);
      let dynM = 0;
      if (p.maxDyn>0) {
        const le = ((lng%360)+360)%360;
        const b = le>=120&&le<=290?1.8:(le>=290||le<=20?1.3:(le>=20&&le<=80?1.1:1.0));
        dynM = Math.min(p.maxDyn, vel*0.75*b);
      } else { dynM = vel*0.15; }
      let surge = 0;
      if (model==="davidson") {
        if (lat<=15&&lng>=-90&&lng<=-35) surge+=1080;         // S America/Caribbean
        if (lat>=10&&lat<=30&&lng>=-100&&lng<=-60) surge+=720; // Gulf of Mexico
        if (lat>=30&&lat<=72&&lng>=-168&&lng<=-52) surge+=600; // N America
        if (lat>=35&&lat<=58&&lng>=-15&&lng<=25) surge+=450;   // N Atlantic/Europe
        if (lat>=15&&lat<=38&&lng>=-10&&lng<=40) surge+=600;   // Mediterranean
        if (lat>=-35&&lat<=15&&lng>=-20&&lng<=55) surge+=1050; // Africa
        if (lat>=5&&lat<=45&&lng>=55&&lng<=145) surge+=900;    // Asia
        if (lat>=-45&&lat<=-10&&lng>=113&&lng<=154) surge+=800; // Australia
      }
      if (model==="tes") {
        if (lat>=15&&lat<=72&&lng>=-168&&lng<=-52) surge+=600;  // N America
        if (lat>=-60&&lat<=15&&lng>=-82&&lng<=-34) surge+=1200; // S America
        if (lat>=-35&&lat<=38&&lng>=-20&&lng<=55) surge+=800;   // Africa
        if (lat>=38&&lat<=72&&lng>=-15&&lng<=45) surge+=1050;   // Europe
        if (lat>=5&&lat<=55&&lng>=45&&lng<=150) surge+=380;     // Asia
        if (lat>=-45&&lat<=-10&&lng>=113&&lng<=154) surge+=800; // Australia
      }
      const floodM = Math.min(2500,Math.max(0,staticM+dynM+surge));
      const waterM = Math.max(0,floodM-terrainM);
      const isFlooded = terrainM<=floodM && terrainM<1200;
      const col = isFlooded?"#f87171":"#86efac";

      popup.setHTML(`
        <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.7;padding:2px 6px">
          <div style="color:#94a3b8;font-size:11px;margin-bottom:6px">${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
          <div style="color:#e2e8f0;margin-bottom:2px">Elevation: <b>${Math.round(terrainM)} m</b></div>
          <div style="color:#e2e8f0;margin-bottom:6px">Inundation level: <b style="color:#38bdf8">${Math.round(floodM)} m</b></div>
          <div style="color:${col};font-weight:700">${isFlooded?"🌊":"✓"} ${isFlooded?`Flooded — ${Math.round(waterM)}m deep`:`Safe — ${Math.round(terrainM-floodM)}m above flood`}</div>
          <div style="color:#475569;font-size:10px;margin-top:6px">☄️ ${modelLabel}</div>
        </div>
      `);
    } catch(e) {
      if (elevPopupRef.current === popup) {
        popup.setHTML(`<div style="font-family:Arial,sans-serif;font-size:13px;padding:4px 6px;color:#94a3b8">Elevation unavailable</div>`);
      }
    }
  };

  const triggerCataclysm = () => {
    const rl = checkAndIncrementRL(proTierRef.current !== "free");
    if (!rl.allowed) { setPaywallModal("ratelimit"); setRlStatus(getRLStatus()); return; }
    setRlStatus(getRLStatus());
    const map = mapRef.current;
    if (!map) return;
    const model = cataclysmModelRef.current;
    const info = model === "davidson"
      ? { name: "Davidson / Suspicious Observers", flipBearing: 90, newPoleLat: 22, newPoleLng: 90, newPoleLabel: "New N. Pole (Bay of Bengal)", finalBearing: 90, startBearing: 0, snapLat: 22, snapLng: 0 }
      : { name: "The Ethical Skeptic ECDO", flipBearing: 110, newPoleLat: -13.5, newPoleLng: 31, newPoleLabel: "New N. Pole (S. Africa 31°E)", finalBearing: 110, startBearing: 0, snapLat: 20, snapLng: -20 };

    clearCataclysm();
    cataclysmRunRef.current += 1;
    const thisRun = cataclysmRunRef.current;
    setCataclysmAnimating(true);

    // Step 1: Switch to globe, fly out
    setViewMode("globe");
    const _isMobileCat = window.innerWidth <= 640;
    const _catZoom = _isMobileCat ? 0.8 : 1.5;
    safely(() => { map.setProjection("globe"); });
    // Use jumpTo immediately then flyTo — ensures zoom takes effect even on slow devices
    setTimeout(() => {
      safely(() => map.jumpTo({ zoom: _catZoom, pitch: 0, bearing: 0 }));
    }, 100);
    setTimeout(() => {
      safely(() => map.flyTo({ zoom: _catZoom, pitch: 0, bearing: 0, duration: 1200 }));
    }, 300);

    // Step 2: Natural Earth rotation — longitude moves W→E via setCenter
    let spinLng = (model === "tes") ? -170 : -90; // Davidson starts on NA, TES starts mid-Pacific
    let lastT = null;
    const spin = (t) => {
      if (lastT !== null) {
        spinLng -= (t - lastT) * 0.018; // W→E: longitude decreases
        safely(() => map.setCenter([spinLng, 20]));
      }
      lastT = t;
      cataclysmSpinRef.current = requestAnimationFrame(spin);
    };
    setTimeout(() => {
      if (cataclysmRunRef.current !== thisRun) return;
      // Hard reset to known start — bearing 0, pitch 0, correct start lng
      // Ensures consistent animation on retrigger/new mode/clear
      safely(() => map.jumpTo({ center: [spinLng, 20], bearing: 0, pitch: 0, zoom: _catZoom }));
      setStatus(`☄️ ${info.name} — crustal displacement initiating…`);
      cataclysmSpinRef.current = requestAnimationFrame(spin);
    }, 1600);

    // Step 3: Single rAF loop — bearing flip + longitude spin simultaneously
    // On completion: flyTo new pole centered, then bearing-spin post-flip
    setTimeout(() => {
      safely(() => map.easeTo({ bearing: info.startBearing, duration: 2000 }));
      if (cataclysmRunRef.current !== thisRun) return;
      setStatus(`☄️ ${info.name} — CRUSTAL DISPLACEMENT IN PROGRESS`);
      setTimeout(() => {
        if (cataclysmSpinRef.current) { cancelAnimationFrame(cataclysmSpinRef.current); cataclysmSpinRef.current = null; }
        const flipStart = performance.now();
        const flipDuration = 8000;
        const startBearing = map.getBearing();
        const targetBearing = info.flipBearing;
        const bearingDelta = targetBearing - startBearing;
        const easeInOut = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        let flipLng = map.getCenter().lng;
        let flipLastT = null;
        const startLat = 20;
        const flipLoop = (now) => {
          if (cataclysmRunRef.current !== thisRun) return;
          const elapsed = now - flipStart;
          const progress = Math.min(elapsed / flipDuration, 1);
          const eased = easeInOut(progress);
          const newBearing = startBearing + bearingDelta * eased;
          if (flipLastT !== null) flipLng -= (now - flipLastT) * 0.018;
          flipLastT = now;
          // For Davidson: shift lat toward new pole (22°N) so spin axis tracks with tilt
          // For TES: keep lat fixed at 20 — pole is southern hemisphere, lat shift causes chaos
          const centerLat = model === "davidson"
            ? startLat + (info.snapLat - startLat) * eased
            : 20;
          safely(() => map.jumpTo({ bearing: newBearing, center: [flipLng, centerLat] }));
          if (progress < 1) {
            cataclysmSpinRef.current = requestAnimationFrame(flipLoop);
          } else {
            cataclysmSpinRef.current = null;
            // Flip done — just stop, no snap
          }
        };
        cataclysmSpinRef.current = requestAnimationFrame(flipLoop);
      }, 2100);
    }, model === "tes" ? 5200 : 5600);

    // Step 4: Flip complete — render overlays and fly to new pole
    setTimeout(() => {
      if (cataclysmRunRef.current !== thisRun) return;
      setStatus(`☄️ ${info.name} — inundation calculated`);
      setCataclysmAnimating(false);
      setCataclysmActive(true);
      // Mobile zoom out only
      if (window.innerWidth <= 640) {
        safely(() => map.easeTo({ zoom: 0.8, duration: 600 }));
      }
      // Add new north pole marker
      try {
        const existingMarker = window._cataclysmPoleMarker;
        if (existingMarker) { existingMarker.remove(); window._cataclysmPoleMarker = null; }
        const el = document.createElement("div");
        el.style.cssText = "background:#ef4444;color:white;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;font-family:Arial,sans-serif;white-space:nowrap;border:1px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);pointer-events:none;";
        el.innerText = "⭐ " + info.newPoleLabel;
        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([info.newPoleLng, info.newPoleLat])
          .addTo(map);
        window._cataclysmPoleMarker = marker;
      } catch(e) { console.warn("Pole marker error", e); }

      // Draw new hypothetical equator
      try { drawNewEquator(map, info.newPoleLat, info.newPoleLng); } catch(e) { console.warn("Equator error", e); }

      const tileUrl = `${floodEngineUrlRef.current}/cataclysm/${model}/{z}/{x}/{y}.png`;

      safely(() => {
        // Flood tiles
        if (map.getSource("cataclysm-source")) {
          map.getSource("cataclysm-source").setTiles([tileUrl]);
        } else {
          map.addSource("cataclysm-source", { type: "raster", tiles: [tileUrl], tileSize: 256 });
          map.addLayer({ id: "cataclysm-layer", type: "raster", source: "cataclysm-source",
            paint: { "raster-opacity": 0, "raster-opacity-transition": { duration: 2000 } } });
          setTimeout(() => safely(() => map.setPaintProperty("cataclysm-layer", "raster-opacity", 0.82)), 100);
        }
        // Wind zones (ellipses)
        drawCataclysmWindZones(map, model);
        // Apply current overlay setting
        setTimeout(() => applyCataclysmOverlay(map, model, cataclysmOverlay), 500);

        // Pole marker removed — position unreliable after bearing flip
      });

      // Allow full globe navigation — remove lat restrictions
      safely(() => { map.setMaxBounds(null); });
      if (cataclysmSpinRef.current) { cancelAnimationFrame(cataclysmSpinRef.current); cataclysmSpinRef.current = null; }
      cataclysmSpinRef.current = null;

      // Enable interaction for pro, cap zoom for free
      const isFree = (proTierRef.current ?? proTier ?? "free") === "free";
      if (!isFree) {
        safely(() => {
          map.dragPan.enable();
          map.scrollZoom.enable();
          map.doubleClickZoom.enable();
          map.touchZoomRotate.enable();
          map.dragRotate.enable();
          map.setMinZoom(0);
          map.setMaxZoom(22);
          map.setMaxBounds(null);
        });
      } else {
        // Free: pan + limited zoom (can see hemisphere, can't drill into detail)
        safely(() => {
          map.dragPan.enable();
          map.scrollZoom.enable();
          map.doubleClickZoom.disable();
          map.touchZoomRotate.enable();
          map.dragRotate.enable();
          map.setMinZoom(0);
          map.setMaxZoom(3);
          map.setMaxBounds(null);
        });
        // Pop paywall if they hit the zoom cap
        try { map.on("zoomend", () => { if (map.getZoom() >= 2.9) setPaywallModal("pro"); }); } catch(e){}
      }

      // Stop spin on first interaction (pro: keep map, free: show paywall)
      const stopSpin = () => {
        try {
          spinActive = false;
          if (cataclysmSpinRef.current) { cancelAnimationFrame(cataclysmSpinRef.current); cataclysmSpinRef.current = null; }
          try { map.off("wheel", stopSpin); } catch(e){}
          try { map.off("zoomstart", stopSpin); } catch(e){}
          if ((proTierRef.current ?? proTier ?? "free") === "free") {
            // Keep zoom cap in place — no further changes needed
          } else {
            safely(() => {
              map.dragPan.enable();
              map.scrollZoom.enable();
              map.doubleClickZoom.enable();
              map.touchZoomRotate.enable();
            });
          }
        } catch(e) { console.warn("stopSpin error", e); }
      };
      try { map.on("wheel", stopSpin); } catch(e){}
      try { map.once("zoomstart", stopSpin); } catch(e){}
    }, 17500);
  };

  const clearNuke = () => {
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) {
      clearNukeLayers(map);
      try { if (map.getLayer(IMPACT_LAYER_ID)) map.removeLayer(IMPACT_LAYER_ID); } catch(e){}
      try { if (map.getSource(IMPACT_SOURCE_ID)) map.removeSource(IMPACT_SOURCE_ID); } catch(e){}
    }
    if (nukeZonePopupRef.current) { nukeZonePopupRef.current.remove(); nukeZonePopupRef.current = null; }
    nukeStrikesRef.current.forEach(s => { try { s.marker.remove(); } catch(e){} });
    nukeStrikesRef.current = [];
    setNukeStrikes([]);
    nukePointRef.current = null;
    setNukePointSet(false);
    setNukeResult(null);
    nukeResultRef.current = null;
    setNukeError("");
    setNukeLoading(false);
    setEmpResult(null);
    setStatus("Nuke cleared");
  };

  const clearFlood = () => {
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) { try { clearWildfireZones(map); } catch(e){} try { clearIceSheets(map); } catch(e){} } setActiveWarmingLevel(null); activeWarmingLevelRef.current = null;
    cancelPendingImpactRequest();
    impactRunSeqRef.current += 1;
    setImpactLoading(false);
    setInputLevel(0); setInputText("0"); setSeaLevel(0); seaLevelRef.current = 0;
    removeFloodLayer(); removeImpactPoint(); clearImpactPreview();
    setImpactResult(null); setImpactError("");
    if (scenarioModeRef.current !== "climate") setScenarioMode("flood");
    setFloodDisplaced(null);
    closeElevPopup();
    setStatus(scenarioModeRef.current === "climate" ? "Climate cleared" : "Flood cleared");
  };

  // Register service worker for tile caching
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // Read permalink params on load and auto-trigger scenario
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scenario = params.get("scenario");
    if (!scenario) return;
    // Store full query string in sessionStorage as backup
    try { sessionStorage.setItem("dm_permalink", window.location.search); } catch(e) {}
    // Clean URL immediately
    window.history.replaceState({}, "", window.location.pathname);
    // Store params for map-ready trigger
    window._permalinkParams = { scenario, params };
  }, []);

  useEffect(() => {
    if (mapRef.current || !floodEngineUrl) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE_URL,
      center: [-80.19, 25.76],
      zoom: 6.2,
      antialias: false,
      attributionControl: true,
      collectResourceTiming: false,
      preserveDrawingBuffer: true,
      renderWorldCopies: false,
      projection: "globe",
      transformRequest: (url) => ({ url }),
    });

    mapRef.current = map;
    // Zoom controls only on desktop — mobile uses pinch-to-zoom
    if (typeof window !== "undefined" && window.innerWidth > 640) {
      map.addControl(new mapboxgl.NavigationControl(), "top-right");
    }
    map.getCanvas().style.cursor = "crosshair";

    const handleError = (e) => {
      const msg = e?.error?.message || e?.message || "";
      if (DEBUG_FLOOD) console.log("Map error:", msg);
    };

    const handleStyleLoad = () => {
      applyProjectionForMode(viewModeRef.current);
      activeFloodLevelRef.current = null;
      if ((scenarioModeRef.current === "flood" || scenarioModeRef.current === "climate") && Number(seaLevelRef.current) !== 0 && floodAllowedInCurrentView()) {
        setTimeout(() => { syncFloodScenario(); }, 50);
      } else { removeFloodLayer(); }
      // Re-draw ice sheets if Ice Age sea level is active
      if ((scenarioModeRef.current === "flood" || scenarioModeRef.current === "climate") && seaLevelRef.current <= -100) {
        setTimeout(() => safely(() => drawIceSheets(mapRef.current)), 100);
      }
      // Re-add all active overlays on style reload
      setTimeout(() => reloadActiveOverlays(seaLevelRef.current, true), 100);
      if (scenarioModeRef.current === "impact" && impactResultRef.current && !impactDrawingRef.current) {
        const points = impactPointsRef.current.length > 0 ? impactPointsRef.current : (impactPointRef.current ? [impactPointRef.current] : []);
        setTimeout(() => {
          // If runImpact started drawing while we waited, skip — it owns the canvas
          if (impactDrawingRef.current) return;
          points.forEach((pt) => {
            if (!pt) return;
            const drawIdx = pt.idx ?? 0; // always use the point's own stable idx
            const result = pt.result || impactResultRef.current;
            if (!result) return;
            if (result.is_ocean_impact === true && Number(result.wave_height_m ?? 0) > 0) {
              drawOceanImpactMarker(pt.lng, pt.lat, drawIdx);
              setTimeout(() => { applyOceanImpactFlood(result, pt.lng, pt.lat, drawIdx); }, 50);
            } else {
              drawLandImpactFromResult(pt.lng, pt.lat, result, drawIdx);
            }
          });
        }, 50);
      }
    };

    const handleLoad = () => { setStatus("Map ready"); };

    let mouseDownPoint = null;

    const handleMouseDown = (e) => {
      mouseDownPoint = e.point;
    };

    const handleClick = (e) => {
      if (mouseDownPoint) {
        const dx = e.point.x - mouseDownPoint.x;
        const dy = e.point.y - mouseDownPoint.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) {
          mouseDownPoint = null;
          return;
        }
      }
      mouseDownPoint = null;

      const { lng, lat } = e.lngLat;

      // Storm surge
      if (scenarioModeRef.current === "surge") {
        const triggered = surgeTrackLayers.current.some(l => l.layerId);
        if (triggered) {
          // After trigger — show popup if clicking near a point
          const preset = SURGE_PRESETS.find(p => p.id === surgePresetRef.current);
          const reachM = preset ? preset.reach : surgeRef.current * 20000;
          const nearPt = surgeTrackPtsRef.current.find(sp => {
            const dLat = (lat - sp.lat) * 111000;
            const dLng = (lng - sp.lng) * 111000 * Math.cos(sp.lat * Math.PI / 180);
            return Math.sqrt(dLat*dLat + dLng*dLng) <= reachM * 1.2;
          });
          if (nearPt) { showSurgePopup(lng, lat); return; }
        } else {
          // Before trigger — add points
          const maxPts = proTierRef.current !== "free" ? 3 : 1;
          if (surgeTrackPtsRef.current.length < maxPts) {
            addTrackPoint(lat, lng);
          }
          return;
        }
      }
      // Single point surge popup
      if (surgeOnRef.current && surgeModeRef.current === "active" && surgePointRef.current) {
        const sp = surgePointRef.current;
        const preset = SURGE_PRESETS.find(p => p.id === surgePresetRef.current);
        const reachM = preset ? preset.reach : surgeRef.current * 20000;
        const dLat = (lat - sp.lat) * 111000;
        const dLng = (lng - sp.lng) * 111000 * Math.cos(sp.lat * Math.PI / 180);
        const distM = Math.sqrt(dLat*dLat + dLng*dLng);
        if (distM <= reachM * 1.2) {
          showSurgePopup(lng, lat);
          return;
        }
      }

      if (scenarioModeRef.current === "earthquake" && eqPointRef.current && eqLayers.current.some(l => l.layerId)) {
        const ep = eqPointRef.current;
        const depthType = EQ_DEPTH_TYPES.find(d => d.id === eqDepthRef.current) || EQ_DEPTH_TYPES[0];
        const rings = eqIntensityRings(eqMagRef.current, depthType.depth, eqFaultRef.current);
        const dLat = (lat - ep.lat) * 111.32;
        const dLng = (lng - ep.lng) * 111.32 * Math.cos(ep.lat * Math.PI / 180);
        const distKm = Math.sqrt(dLat*dLat + dLng*dLng);
        // Find innermost ring that contains the click point
        const ring = rings.find(r => distKm <= r.radiusKm) || rings[rings.length-1];
        new mapboxgl.Popup({ closeButton:true, maxWidth:"260px", className:"dm-dark-popup" })
          .setLngLat([lng, lat])
          .setHTML((() => {
            const mmiData = {
              "X+": { survival:"<5%",    color:"#7f1d1d", damage:"Total destruction — no structure survives. Ground rupture, landslides, permanent displacement.",       action:"No survivable action. Deep underground only." },
              "IX": { survival:"5-15%",  color:"#b91c1c", damage:"Most masonry and frame structures destroyed. Well-built structures severely damaged or collapsed.",   action:"Reinforced underground shelter only. Evacuate immediately if possible." },
              "VIII":{ survival:"20-40%",color:"#dc2626", damage:"Considerable damage to ordinary buildings, partial collapse. Heavy furniture overturned, walls crack.", action:"Get under sturdy table, away from windows. Evacuate after shaking stops." },
              "VII": { survival:"50-70%",color:"#ea580c", damage:"Negligible damage in good buildings, moderate in ordinary. Chimneys, parapets fall.",                  action:"Drop, cover, hold on. Move away from buildings after shaking." },
              "VI":  { survival:"75-90%",color:"#f97316", damage:"Felt by all. Furniture moves, minor damage to poorly built structures. Windows may break.",             action:"Drop, cover, hold on. Expect minor injuries from falling objects." },
              "V":   { survival:">95%",  color:"#ca8a04", damage:"Felt strongly. Sleepers wakened, small objects fall. No structural damage.",                            action:"Secure yourself. Minor hazard from loose objects." },
            };
            const d = mmiData[ring.intensity] || mmiData["V"];
            return `<div style="font-family:Arial,sans-serif;max-width:260px">
              <div style="font-size:13px;font-weight:700;color:${ring.color};margin-bottom:6px">MMI ${ring.intensity} — ${ring.label}</div>
              <table style="font-size:11px;width:100%;border-collapse:collapse;margin-bottom:8px">
                <tr><td style="color:#94a3b8;padding:2px 8px 2px 0">Distance</td><td style="font-weight:700">${distKm.toFixed(0)} km</td></tr>
                <tr><td style="color:#94a3b8;padding:2px 8px 2px 0">PGA</td><td style="font-weight:700">${ring.pga}</td></tr>
                <tr><td style="color:#94a3b8;padding:2px 8px 2px 0">Magnitude</td><td style="font-weight:700">M${eqMagRef.current.toFixed(1)}</td></tr>
                <tr><td style="color:#94a3b8;padding:2px 8px 2px 0">Survival odds</td><td style="font-weight:700;color:${d.color}">${d.survival}</td></tr>
              </table>
              <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;line-height:1.5"><b style="color:#e2e8f0">Damage:</b> ${d.damage}</div>
              <div style="font-size:11px;color:#fbbf24;line-height:1.5"><b>⚠ Action:</b> ${d.action}</div>
            </div>`;
          })())
          .addTo(mapRef.current);
        return;
      }

      if (scenarioModeRef.current === "earthquake") {
        // Just place marker — wait for Trigger
        if (eqMarker.current) { eqMarker.current.remove(); eqMarker.current = null; }
        const el = document.createElement("div");
        el.style.cssText = "width:24px;height:24px;background:#fbbf24;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 3px #f59e0b,0 2px 8px rgba(0,0,0,0.5);cursor:pointer;";
        eqMarker.current = new mapboxgl.Marker({ element: el, anchor:"center" }).setLngLat([lng, lat]).addTo(mapRef.current);
        setEqPoint({ lat, lng }); eqPointRef.current = { lat, lng };
        // Clear old rings
        eqLayers.current.forEach(({ sourceId, layerId }) => {
          try { if (mapRef.current.getLayer(layerId)) mapRef.current.removeLayer(layerId); } catch(e) {}
          try { if (sourceId && mapRef.current.getSource(sourceId)) mapRef.current.removeSource(sourceId); } catch(e) {}
        });
        eqLayers.current = [];
        setEqResult(null);
        return;
      }

      if (scenarioModeRef.current === "impact") {
        // If results exist, show zone popup; otherwise place a new impact point
        if (impactResultRef.current) {
          if (proTierRef.current === "free") {
            impactPopupClickCountRef.current += 1;
            if (impactPopupClickCountRef.current > 1) { setPaywallModal("pro"); return; }
          }
          showImpactZonePopup(lng, lat);
          return;
        }
        const MAX_IMPACT_POINTS = proTierRef.current !== "free" ? 3 : 1;
        if (impactPointsRef.current.length >= MAX_IMPACT_POINTS) {
          if (proTierRef.current === "free") {
            setPaywallModal("pro");
          } else {
            setStatus("Maximum 3 impact points — clear to reset");
          }
          return;
        }
        // Add new point as numbered marker
        const idx = impactPointsRef.current.length;
        const el = document.createElement("div");
        el.style.cssText = "width:26px;height:26px;border-radius:50%;background:#ef4444;border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.5);";
        el.innerText = idx + 1;
        const marker = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat([lng, lat]).addTo(mapRef.current);
        const point = { lng, lat, marker, idx, result: null };
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          point.marker.remove();
          // Remove indexed flood layer for this point
          const fl = impactFloodLayersRef.current.find(l => l.layerId === `flood-layer-impact-${idx}`);
          if (fl) {
            try { if (mapRef.current.getLayer(fl.layerId)) mapRef.current.removeLayer(fl.layerId); } catch(e){}
            try { if (mapRef.current.getSource(fl.sourceId)) mapRef.current.removeSource(fl.sourceId); } catch(e){}
            impactFloodLayersRef.current = impactFloodLayersRef.current.filter(l => l !== fl);
          }
          impactPointsRef.current = impactPointsRef.current.filter(p => p !== point);
          impactPointRef.current = impactPointsRef.current.length > 0 ? impactPointsRef.current[impactPointsRef.current.length - 1] : null;
          setImpactPoints([...impactPointsRef.current]);
          setImpactResult(null);
          setStatus(`Impact point removed`);
        });
        impactPointsRef.current.push(point);
        impactPointRef.current = point; // compat
        setImpactPoints([...impactPointsRef.current]);
        drawImpactPreview(lng, lat, impactDiameterRef.current);
        setImpactResult(null); setImpactError("");
        setStatus(impactPointsRef.current.length > 1 ? `${impactPointsRef.current.length} impact points placed — Run Impact` : "Impact point placed — Run Impact");
        return;
      }

      if (scenarioModeRef.current === "nuke") {
        // If detonation results exist, show zone popup on click
        if (nukeResultRef.current && nukeSubModeRef.current === "detonate") {
          if (proTierRef.current === "free") {
            nukePopupClickCountRef.current += 1;
            if (nukePopupClickCountRef.current > 1) { setPaywallModal("pro"); return; }
          }
          showNukeZonePopup(lng, lat);
          return;
        }
        // EMP mode: single point only
        if (nukeSubModeRef.current === "emp" && nukeStrikesRef.current.length >= 1) {
          setStatus("EMP mode uses a single detonation point — clear first to reposition");
          return;
        }
        // Multi-strike is pro only — free users get 1 strike
        const maxStrikes = (proTierRef.current !== "free") ? MAX_NUKE_STRIKES : 1;
        if (nukeStrikesRef.current.length >= maxStrikes) {
          if (proTierRef.current === "free") {
            setPaywallModal("pro");
          } else {
            setStatus(`Maximum ${MAX_NUKE_STRIKES} strike points reached`);
          }
          return;
        }
        const map = mapRef.current;
        // Create marker for this strike point
        const el = document.createElement("div");
        const idx = nukeStrikesRef.current.length;
        el.style.cssText = "width:22px;height:22px;border-radius:50%;background:#7c3aed;border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.5);";
        el.innerText = idx + 1;
        el.title = "Click to remove";
        const marker = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat([lng, lat]).addTo(map);
        const strike = { lat, lng, marker, idx };
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          strike.marker.remove();
          nukeStrikesRef.current = nukeStrikesRef.current.filter(s => s !== strike);
          setNukeStrikes([...nukeStrikesRef.current]);
          setNukePointSet(nukeStrikesRef.current.length > 0);
          nukePointRef.current = nukeStrikesRef.current.length > 0 ? nukeStrikesRef.current[nukeStrikesRef.current.length - 1] : null;
        });
        nukeStrikesRef.current.push(strike);
        nukePointRef.current = strike;
        setNukeStrikes([...nukeStrikesRef.current]);
        setNukePointSet(true);
        setNukeResult(null); setNukeError("");
        setStatus(`Strike ${idx + 1} placed — add more or detonate`);
        return;
      }

      // ── Overlay click handler (megaliths, unesco, airports, nuclear) ──
      {
        const activeLayers = Object.entries(OVL)
          .filter(([type]) => {
            const refs = { megaliths: megalithOnRef, unesco: unescoOnRef, airports: airportOnRef, nuclear: nuclearOnRef, fires: fireOnRef };
            return refs[type]?.current;
          })
          .map(([, c]) => c.layer)
          .filter(l => { try { return !!map.getLayer(l); } catch { return false; } });

        if (activeLayers.length > 0) {
          // Don't open dot popup if a cluster was clicked — cluster zoom handler takes it
          const clusterLayers = Object.entries(OVL)
            .filter(([type]) => { const refs = { megaliths: megalithOnRef, unesco: unescoOnRef, airports: airportOnRef, nuclear: nuclearOnRef, fires: fireOnRef }; return refs[type]?.current; })
            .map(([, c]) => c.layer + "-clusters")
            .filter(l => { try { return !!map.getLayer(l); } catch { return false; } });
          const clusterHit = clusterLayers.length > 0 && map.queryRenderedFeatures(e.point, { layers: clusterLayers }).length > 0;
          if (clusterHit) { /* cluster click handled separately */ }
          else {
          const feats = map.queryRenderedFeatures(e.point, { layers: activeLayers });
          if (feats.length > 0) {
            const p   = feats[0].properties;
            const kind = p.kind || "megalith";
            const cfg = Object.values(OVL).find(c => c.layer === feats[0].layer.id) || OVL.megaliths;
            if (overlayPopupRef.current) { overlayPopupRef.current.remove(); overlayPopupRef.current = null; }
            const wikiUrl = p.wiki_url
              ? p.wiki_url
              : p.wikipedia
                ? (p.wikipedia.startsWith("http") ? p.wikipedia : `https://en.wikipedia.org/wiki/${encodeURIComponent(p.wikipedia)}`)
                : (p.kind === "nuclear" || p.kind === "megalith") ? null
                : p.name ? `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(p.name)}&ns0=1` : null;
            const isSubmerged = p.already_submerged === true || p.already_submerged === "true";
            const isFlooded   = p.flooded === true || p.flooded === "true";
            const dotColor    = (isSubmerged || isFlooded) ? cfg.subColor : cfg.color;
            const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, className: "elev-popup", maxWidth: "300px" });
            const isFire = kind === "fire";
            popup.setLngLat([lng, lat]).setHTML(isFire ? `
              <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;padding:2px 4px">
                <div style="color:#ff4500;font-weight:700;font-size:14px;margin-bottom:6px">🔥 Active Fire Detection</div>
                ${p.frp ? `<div style="color:#e2e8f0;margin-bottom:3px">Intensity: <strong>${p.frp} MW</strong></div>` : '<div style="color:#94a3b8;margin-bottom:3px">High confidence detection</div>'}
                ${p.date ? `<div style="color:#94a3b8;font-size:11px;margin-bottom:3px">Detected: <strong>${p.date}</strong></div>` : ""}
                <div style="color:#64748b;font-size:11px;margin-top:4px">Source: NASA FIRMS VIIRS 24h</div>
              </div>
            ` : `
              <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;padding:2px 4px">
                <div style="color:${dotColor};font-weight:700;margin-bottom:4px">${cfg.icon} ${p.name || "Unnamed site"}</div>
                ${p.type || p.category ? `<div style="color:#e2e8f0;margin-bottom:3px"><b>${p.type || p.category}</b></div>` : ""}
                ${p.country ? `<div style="color:#94a3b8;font-size:11px;margin-bottom:3px">📍 ${p.country}</div>` : ""}
                ${p.iata ? `<div style="color:#94a3b8;font-size:11px;margin-bottom:3px">IATA: <b>${p.iata}</b></div>` : ""}
                ${p.status ? `<div style="color:#94a3b8;font-size:11px;margin-bottom:3px">Status: <b>${p.status}</b></div>` : ""}
                ${p.capacity ? `<div style="color:#94a3b8;font-size:11px;margin-bottom:3px">Capacity: <b>${p.capacity} MW</b></div>` : ""}
                ${p.reactor_type ? `<div style="color:#94a3b8;font-size:11px;margin-bottom:3px">Reactor: ${p.reactor_type}${p.model ? ' · ' + p.model : ''}</div>` : ""}
                ${p.operator ? `<div style="color:#94a3b8;font-size:11px;margin-bottom:3px">Operator: ${p.operator}</div>` : ""}
                ${p.start_year ? `<div style="color:#94a3b8;font-size:11px;margin-bottom:3px">Online: ${p.start_year}${p.retirement_year ? ' → retired ' + p.retirement_year : p.planned_retirement ? ' · retires ' + p.planned_retirement : ''}</div>` : ""}
                ${p.region ? `<div style="color:#64748b;font-size:10px;margin-bottom:3px">${p.region}</div>` : ""}
                ${p.elevation !== undefined ? `<div style="color:#64748b;font-size:11px;margin-bottom:3px">Elevation: ${Number(p.elevation).toFixed(0)} m</div>` : ""}
                ${isSubmerged
                  ? `<div style="color:#60a5fa;margin-bottom:4px">🌊 Currently underwater</div>`
                  : isFlooded
                    ? `<div style="color:#f87171;margin-bottom:4px">🌊 Flooded at this sea level</div>`
                    : seaLevelRef.current > 0
                      ? `<div style="color:#4ade80;margin-bottom:4px">✓ Safe at +${Math.round(seaLevelRef.current)} m</div>`
                      : ""}
                ${p.kind === 'megalith' && p.url ? `<button onclick="if(window.__dmWiki){window.__dmWiki(this.dataset.n,'','',this.dataset.m)}" data-n="${(p.name||'').replace(/"/g,'&quot;')}" data-m="${p.url||''}" style="margin-top:6px;font-size:11px;color:${dotColor};background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:4px 10px;cursor:pointer;font-family:Arial,sans-serif;">Megalithic Portal</button>` : wikiUrl ? `<button onclick="if(window.__dmWiki){window.__dmWiki(this.dataset.n,this.dataset.u,this.dataset.w)}" data-n="${(p.name||'').replace(/"/g,'&quot;')}" data-u="${(wikiUrl||'').replace(/"/g,'&quot;')}" data-w="${(p.wikidata||'').replace(/"/g,'&quot;')}" style="margin-top:6px;font-size:11px;color:${dotColor};background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:4px 10px;cursor:pointer;font-family:Arial,sans-serif;">Wikipedia</button>` : ""}
              </div>
            `).addTo(map);
            overlayPopupRef.current = popup;
            return;
          }
          } // end else (not cluster)
        }
      }

      if (scenarioModeRef.current === "yellowstone") {
        if (window.__dmLastEruptResult) {
          // Generic volcano eruption — show zone info based on click position
          const r = window.__dmLastEruptResult;
          const map = mapRef.current;
          // Find which zone was clicked by checking rendered features
          const veruptLayers = [];
          for (let i = 0; i < 8; i++) { try { if (map.getLayer(`verupt-layer-${i}`)) veruptLayers.push(`verupt-layer-${i}`); } catch(e){} }
          const hits = veruptLayers.length > 0 ? map.queryRenderedFeatures(e.point, { layers: veruptLayers }) : [];
          // verupt-layer-i maps directly to zones[i] (Kill Zone=0, outermost=n-1)
          const hitLayerId = hits[0]?.layer?.id;
          const zoneIdx = hitLayerId ? parseInt(hitLayerId.replace("verupt-layer-","")) : null;
          const zone = zoneIdx != null ? r.zones[zoneIdx] : r.zones[0];
          if (zone) {
            const zColors = ["#7f1d1d","#b91c1c","#dc2626","#ea580c","#f97316","#fbbf24"];
            const zColor = zColors[zoneIdx != null ? zoneIdx : 0] || "#f97316";
            new mapboxgl.Popup({ closeButton:true, maxWidth:"260px", className:"elev-popup" })
              .setLngLat([lng, lat])
              .setHTML(`<div style="font-family:Arial,sans-serif">
                <div style="color:${zColor};font-weight:700;font-size:13px;margin-bottom:4px">${zone.name}</div>
                <div style="font-size:12px;color:#94a3b8;margin-bottom:6px">${zone.desc||""}</div>
                <div style="display:flex;justify-content:space-between;font-size:12px">
                  <span style="color:#94a3b8">Survival</span>
                  <span style="font-weight:700;color:${zone.survival==="0%"?"#ef4444":"#4ade80"}">${zone.survival}</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:2px">
                  <span style="color:#94a3b8">Mortality</span>
                  <span style="font-weight:700">${zone.mortality_pct}%</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:2px">
                  <span style="color:#94a3b8">Est. deaths</span>
                  <span style="font-weight:700;color:#ef4444">${zone.deaths?.toLocaleString()||"—"}</span>
                </div>
              </div>`)
              .addTo(map);
          }
        } else {
          showYellowstonePopup(lng, lat);
        }
        return;
      }
      if (scenarioModeRef.current === "tsunami") {
        showTsunamiPopup(lng, lat);
        return;
      }
      if (scenarioModeRef.current === "cataclysm") {
        const overlay = cataclysmOverlayRef.current ?? "flood";
        if (overlay === "flood" || overlay === "both") {
          showCataclysmFloodPopup(lng, lat);
        }
        // wind only — no popup
        return;
      }
      // In climate mode, check if click is inside a wildfire zone
      if (scenarioModeRef.current === "climate" && activeWarmingLevelRef.current) {
        const wLevel = activeWarmingLevelRef.current;
        const activeZones = WILDFIRE_ZONES.filter(z => z.minLevel <= wLevel);
        const kpLat = 110.574;
        const bearingDeg = 70;
        const bearingRad = bearingDeg * Math.PI / 180;
        const dN = Math.cos(bearingRad), dE = Math.sin(bearingRad);
        let hitZone = null;
        for (const z of activeZones) {
          const kpLng = 111.32 * Math.cos(z.center[1] * Math.PI / 180);
          const cLat = z.center[1] + (dN * z.major_km * 0.3) / kpLat;
          const cLng = z.center[0] + (dE * z.major_km * 0.3) / Math.max(kpLng, 0.001);
          const dLatKm = (lat - cLat) * kpLat;
          const dLngKm = (lng - cLng) * Math.max(kpLng, 0.001);
          const along = dN * dLatKm + dE * dLngKm;
          const perp  = -dE * dLatKm + dN * dLngKm;
          if ((along / z.major_km) ** 2 + (perp / z.minor_km) ** 2 <= 1) { hitZone = z; break; }
        }
        if (hitZone) {
          closeElevPopup();
          const riskLabel = hitZone.minLevel >= 4 ? "Extreme — year-round fire risk" : hitZone.minLevel >= 3 ? "Severe — multi-month fire seasons" : hitZone.minLevel >= 2 ? "High — extended fire season" : "Elevated — worsening drought/fire";
          const riskColor = hitZone.minLevel >= 4 ? "#b91c1c" : hitZone.minLevel >= 3 ? "#dc2626" : hitZone.minLevel >= 2 ? "#ef4444" : "#f97316";
          const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, className: "elev-popup", maxWidth: "240px" });
          popup.setLngLat([lng, lat]).setHTML(`
            <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;padding:2px 4px">
              <div style="color:${riskColor};font-weight:700;margin-bottom:4px">🔥 ${hitZone.name}</div>
              <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                <span style="color:#94a3b8;font-size:11px">Activates at</span>
                <span style="color:#e2e8f0;font-weight:700">+${hitZone.minLevel}°C</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span style="color:#94a3b8;font-size:11px">Current risk level</span>
                <span style="color:${riskColor};font-weight:700">${wLevel}°C scenario</span>
              </div>
              <div style="color:${riskColor};font-size:11px;font-style:italic">${riskLabel}</div>
              <div style="color:#475569;font-size:10px;margin-top:4px">⚠ Worst-case projection — actual risk varies by local conditions</div>
            </div>`).addTo(map);
          elevPopupRef.current = popup;
          return;
        }
      }
      showElevPopup(lng, lat);
    };

    map.on("error", handleError);
    map.on("load", handleLoad);
    map.on("load", () => {
      // Auto-trigger from permalink
      // Check sessionStorage backup if _permalinkParams was cleared (e.g. SSR/hydration)
      let pp = window._permalinkParams;
      if (!pp) {
        try {
          const stored = sessionStorage.getItem("dm_permalink");
          if (stored) {
            const p2 = new URLSearchParams(stored);
            const s2 = p2.get("scenario");
            if (s2) pp = { scenario: s2, params: p2 };
            sessionStorage.removeItem("dm_permalink");
          }
        } catch(e) {}
      }
      if (!pp) return;
      window._permalinkParams = null;
      const { scenario, params } = pp;
      setTimeout(() => {
        try {
          // Restore map view if encoded in link
          const cx = parseFloat(params.get("cx")), cy = parseFloat(params.get("cy")), cz = parseFloat(params.get("cz"));
          if (!isNaN(cx) && !isNaN(cy) && !isNaN(cz)) {
            safely(() => map.jumpTo({ center: [cx, cy], zoom: cz }));
          }
          if (scenario === "flood") {
            const level = parseFloat(params.get("level") || "0");
            setInputLevel(level); setInputText(String(level)); setSeaLevel(level); seaLevelRef.current = level;
            setScenarioMode("flood"); scenarioModeRef.current = "flood";
            setTimeout(() => executeFlood(), 100);
          } else if (scenario === "climate") {
            const level = parseFloat(params.get("level") || "0");
            const warming = parseFloat(params.get("warming") || "0");
            setInputLevel(level); setInputText(String(level)); setSeaLevel(level); seaLevelRef.current = level;
            setScenarioMode("climate"); scenarioModeRef.current = "climate";
            if (warming) { setActiveWarmingLevel(warming); activeWarmingLevelRef.current = warming; }
            setTimeout(() => { executeFlood(); if (warming) setTimeout(() => safely(() => drawWildfireZones(mapRef.current, warming)), 600); }, 100);
          } else if (scenario === "impact") {
            setScenarioMode("impact"); scenarioModeRef.current = "impact";
            const diameter = Math.min(parseInt(params.get("diameter") || "1000"), proTierRef.current !== "free" ? PRO_MAX_IMPACT_DIAMETER : FREE_MAX_IMPACT_DIAMETER);
            setImpactDiameter(diameter); impactDiameterRef.current = diameter;
            const pointsStr = params.get("points");
            if (pointsStr) {
              // Multi-impact
              const pts = decodeURIComponent(pointsStr).split("|").map(s => { const [la, ln] = s.split(","); return { lat: parseFloat(la), lng: parseFloat(ln) }; }).filter(p => !isNaN(p.lat));
              pts.forEach((p, i) => { impactPointsRef.current.push({ lat: p.lat, lng: p.lng, idx: i, marker: null, result: null }); });
              impactPointRef.current = pts[pts.length - 1];
              setTimeout(() => runImpact(), 200);
            } else {
              const lat = parseFloat(params.get("lat")), lng = parseFloat(params.get("lng"));
              if (!isNaN(lat) && !isNaN(lng)) { impactPointRef.current = { lat, lng }; setTimeout(() => runImpact(), 200); }
            }
          } else if (scenario === "nuke") {
            setScenarioMode("nuke"); scenarioModeRef.current = "nuke";
            const yieldKt = Math.min(parseInt(params.get("yield") || "1000"), proTierRef.current !== "free" ? PRO_MAX_NUKE_YIELD_KT : FREE_MAX_NUKE_YIELD_KT);
            const burst = params.get("burst") || "airburst";
            setNukeYield(yieldKt); setNukeBurst(burst);
            const pointsStr = params.get("points");
            if (pointsStr) {
              const pts = decodeURIComponent(pointsStr).split("|").map(s => { const [la, ln] = s.split(","); return { lat: parseFloat(la), lng: parseFloat(ln) }; }).filter(p => !isNaN(p.lat));
              pts.forEach((p, i) => {
                const el = document.createElement("div");
                el.style.cssText = "width:14px;height:14px;background:#dc2626;border:2px solid #fff;border-radius:50%;cursor:pointer;";
                const marker = new mapboxgl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
                nukeStrikesRef.current.push({ lat: p.lat, lng: p.lng, marker, idx: i });
              });
              nukePointRef.current = pts[pts.length - 1]; setNukePointSet(true);
              setNukeStrikes([...nukeStrikesRef.current]);
              setTimeout(() => executeNuke(), 200);
            } else {
              const lat = parseFloat(params.get("lat")), lng = parseFloat(params.get("lng"));
              if (!isNaN(lat) && !isNaN(lng)) { nukePointRef.current = { lat, lng }; setNukePointSet(true); setTimeout(() => executeNuke(), 200); }
            }
          } else if (scenario === "volcano") {
            const type = params.get("type") || "yellowstone";
            const preset = parseInt(params.get("preset") || "0");
            setScenarioMode("yellowstone"); scenarioModeRef.current = "yellowstone";
            setVolcanoType(type); volcanoTypeRef.current = type; setYellowstonePreset(preset); yellowstonePresetRef.current = preset;
            setTimeout(() => drawYellowstone(preset), 200);
          } else if (scenario === "tsunami") {
            const source = parseInt(params.get("source") || "0");
            setScenarioMode("tsunami"); scenarioModeRef.current = "tsunami";
            setTsunamiSource(source); tsunamiSourceRef.current = source;
            setTimeout(() => drawTsunami(source), 200);
          } else if (scenario === "cataclysm") {
            const model = params.get("model") || "davidson";
            setScenarioMode("cataclysm"); scenarioModeRef.current = "cataclysm";
            setCataclysmModel(model); cataclysmModelRef.current = model;
            setTimeout(() => triggerCataclysm(), 500);
          }
        } catch(e) { console.warn("Permalink trigger failed", e); }

        // Show pro CTA if free user arrives at paywalled scenario via share link
        const isFreeUser = (proTierRef.current ?? "free") === "free";
        if (isFreeUser && ["impact", "nuke", "cataclysm"].includes(scenario)) {
          setTimeout(() => {
            setStatus("🔓 Viewing shared scenario — upgrade to Pro to run your own simulations & unlock full detail");
          }, 3000);
        }
      }, 800);
    });
    map.on("style.load", handleStyleLoad);
    map.on("mousedown", handleMouseDown);
    map.on("click", handleClick);

    return () => {
      cancelPendingImpactRequest();
      if (impactPulseFrameRef.current) { cancelAnimationFrame(impactPulseFrameRef.current); impactPulseFrameRef.current = null; }
      closeElevPopup();
      map.off("error", handleError);
      map.off("load", handleLoad);
      map.off("style.load", handleStyleLoad);
      map.off("mousedown", handleMouseDown);
      map.off("click", handleClick);
      map.remove();
      mapRef.current = null; activeFloodLevelRef.current = null;
      impactPointRef.current = null; initialViewAppliedRef.current = false;
    };
  }, [floodEngineUrl]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!initialViewAppliedRef.current) { initialViewAppliedRef.current = true; return; }
    applyStyleMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (scenarioMode === "impact") {
      removeFloodLayer();
      closeElevPopup();
      setStatus(impactPointRef.current ? "Impact preview ready" : "Click map to place impact point");
      return;
    }
    cancelPendingImpactRequest();
    impactRunSeqRef.current += 1;
    setImpactLoading(false);
    removeImpactPoint(); setImpactResult(null); setImpactError("");
    syncFloodScenario();
  }, [scenarioMode]);

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    if (scenarioMode !== "impact" || !impactResult) return;
    // Multi-impact: results are drawn inside runImpact, don't redraw here
    if (impactResult._count > 1) return;
    if (!impactPointRef.current) return;
    if (impactResult.is_ocean_impact === true && Number(impactResult.wave_height_m ?? 0) > 0) {
      drawOceanImpactMarker(impactPointRef.current.lng, impactPointRef.current.lat);
      setTimeout(() => { applyOceanImpactFlood(impactResult, impactPointRef.current.lng, impactPointRef.current.lat); }, 50);
      return;
    }
    drawLandImpactFromResult(impactPointRef.current.lng, impactPointRef.current.lat, impactResult);
  }, [impactResult, scenarioMode]);

  useEffect(() => {
    if (scenarioMode !== "impact") return;
    cancelPendingImpactRequest();
    impactRunSeqRef.current += 1;
    setImpactLoading(false); setImpactResult(null); setImpactError("");
    clearImpactPreview();
    if (impactPointRef.current && mapRef.current && mapRef.current.isStyleLoaded()) {
      drawImpactPoint(impactPointRef.current.lng, impactPointRef.current.lat);
      drawImpactPreview(impactPointRef.current.lng, impactPointRef.current.lat, impactDiameter);
      setStatus("Impact preview ready");
    }
  }, [impactDiameter, scenarioMode]);

  useEffect(() => {
    if (!isMapReady() || (scenarioModeRef.current !== "flood" && scenarioModeRef.current !== "climate")) return;
    syncFloodScenario();
  }, [seaLevel, viewMode, scenarioMode]);

  useEffect(() => {
    reloadActiveOverlays(seaLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seaLevel]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (scenarioMode === "impact") {
      const wh = Math.round(Number(impactResult?.wave_height_m ?? 0));
      const reach = Math.round(Number(impactResult?.estimated_wave_reach_m ?? 0) / 1000);
      const isExtinction = wh >= EXTINCTION_WAVE_HEIGHT_M;
      setStatus(
        impactPointRef.current
          ? impactLoading ? "Running impact simulation..."
            : impactResult
              ? impactResult.is_ocean_impact
                ? isExtinction
                  ? `Extinction scale impact — ${wh}m global wave`
                  : `Ocean impact — ${wh}m wave, ${reach}km reach`
                : "Land impact simulation complete"
              : "Impact preview ready"
          : "Click map to place impact point"
      );
      return;
    }
    if (scenarioMode === "tsunami") {
      setStatus(tsunamiActive ? TSUNAMI_SOURCES[tsunamiSource].name + " — click map for wave details" : "Click Trigger to show wave propagation");
      return;
    }
    if (scenarioMode === "yellowstone") {
      setStatus(yellowstoneActive ? `${(volcanoType === "toba" ? TOBA_PRESETS : volcanoType === "campi" ? CAMPI_PRESETS : YELLOWSTONE_PRESETS)[Math.min(yellowstonePreset, (volcanoType === "toba" ? TOBA_PRESETS : volcanoType === "campi" ? CAMPI_PRESETS : YELLOWSTONE_PRESETS).length - 1)].name} — click map for ash details` : "Click Erupt to show ash zones");
      return;
    }
    if (scenarioMode === "nuke") {
      if (nukeSubMode === "emp") {
        setStatus(nukePointSet
          ? empLoading ? "Computing EMP footprint..." : empResult ? `EMP footprint: ${Math.round(empResult.emp_r_km).toLocaleString()} km · ${(empResult.population_at_risk/1e6).toFixed(1)}M at risk` : "Place point then Launch EMP"
          : "Click map to place EMP detonation point"
        );
      } else {
        setStatus(nukePointSet
          ? nukeLoading ? "Detonating..." : nukeResult ? `${nukeResult._count > 1 ? nukeResult._count + " strikes" : nukeResult.severity_class === "Extinction scale" ? "Civilization ending" : nukeResult.severity_class} — ${nukeResult.yield_kt >= 1000 ? (nukeResult.yield_kt/1000).toFixed(1)+"Mt" : nukeResult.yield_kt+"kt"}` : `${nukeStrikes.length} strike${nukeStrikes.length !== 1 ? "s" : ""} placed — detonate`
          : "Click map to place strike points (up to 5)"
        );
      }
      return;
    }

    if (seaLevel === 0) { setStatus("Flood cleared"); return; }
    setStatus(`Flood tiles loaded at ${formatLevelForDisplay(seaLevel)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, seaLevel, unitMode, scenarioMode, impactLoading, impactResult, nukeLoading, nukeResult, nukePointSet]);

  // Expose openWikiPanel globally for popup HTML buttons
  useEffect(() => {
    window.__dmWiki = (name, url, wikidata, mpId) => openWikiPanel(name, url, wikidata, mpId);
    window.__dmFaultSetQuake = (lat, lng, faultId, dip, rake) => {
      setEqFaultId(faultId); eqFaultRef.current = faultId;
      setEqDip(Math.round(dip)); eqDipRef.current = Math.round(dip);
      setEqRake(Math.round(rake)); eqRakeRef.current = Math.round(rake);
      setScenarioMode("earthquake"); scenarioModeRef.current = "earthquake";
      if (eqMarker.current) { eqMarker.current.remove(); eqMarker.current = null; }
      const el = document.createElement("div");
      el.style.cssText = "width:24px;height:24px;background:#fbbf24;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 3px #f59e0b,0 2px 8px rgba(0,0,0,0.5);cursor:pointer;";
      const map = mapRef.current;
      if (map) {
        eqMarker.current = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat([lng, lat]).addTo(map);
        setEqPoint({ lat, lng }); eqPointRef.current = { lat, lng };
      }
      document.querySelectorAll(".mapboxgl-popup").forEach(p => p.remove());
      setStatus("Fault loaded — adjust magnitude and hit Trigger");
    };
    window.__dmFaultClear = () => {
      document.querySelectorAll(".mapboxgl-popup").forEach(p => p.remove());
    };
    window.__dmEruptVolcano = async (lat, lng, name, vtype, isSuper) => {
      document.querySelectorAll(".mapboxgl-popup").forEach(p => p.remove());
      const map = mapRef.current;
      if (!map) return;

      // Clear previous eruption layers
      for (let i = 0; i < 6; i++) {
        try { if (map.getLayer(`verupt-layer-${i}`)) map.removeLayer(`verupt-layer-${i}`); } catch(e){}
        try { if (map.getSource(`verupt-src-${i}`)) map.removeSource(`verupt-src-${i}`); } catch(e){}
      }

      setStatus("Simulating eruption...");

      try {
        const url = `${floodEngineUrlRef.current}/volcano-erupt?lat=${lat}&lng=${lng}&vtype=${encodeURIComponent(vtype||"")}&is_super=${!!isSuper}&name=${encodeURIComponent(name)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.error) { setStatus("Eruption sim error"); return; }

        // Build ellipse ring coords for each zone
        // Each zone rendered as a donut: outer ellipse minus inner ellipse (polygon with hole)
        const n = data.zones.length;
        const zoneColors = ["#7f1d1d","#b91c1c","#dc2626","#ea580c","#f97316","#fbbf24"];
        const zoneOpacity = [0.85, 0.75, 0.60, 0.45, 0.30, 0.20];

        const bearing = data.bearing_deg * Math.PI / 180;
        const dNorth = Math.cos(bearing), dEast = Math.sin(bearing);
        const KP_LAT = 110.574;
        const KP_LNG = 111.32 * Math.cos(lat * Math.PI / 180);

        const makeEllipseRing = (majorKm, minorKm) => {
          const cLat = lat + (dNorth * majorKm * 0.3) / KP_LAT;
          const cLng = lng + (dEast  * majorKm * 0.3) / KP_LNG;
          const steps = 64;
          const coords = [];
          for (let s = 0; s <= steps; s++) {
            const angle = (s / steps) * 2 * Math.PI;
            const pLat = cLat + (dNorth * majorKm * Math.cos(angle) - dEast  * minorKm * Math.sin(angle)) / KP_LAT;
            const pLng = cLng + (dEast  * majorKm * Math.cos(angle) + dNorth * minorKm * Math.sin(angle)) / KP_LNG;
            coords.push([pLng, pLat]);
          }
          return coords;
        };

        // zones[0]=Kill Zone (smallest), zones[n-1]=outermost
        // Draw as donuts: each zone = outer ring minus next inner ring
        data.zones.forEach((zone, i) => {
          const outerRing = makeEllipseRing(zone.major_km, zone.minor_km);
          // Hole = next inner zone (or tiny point for kill zone)
          const innerZone = i > 0 ? data.zones[i-1] : null;
          const holeRing = innerZone
            ? makeEllipseRing(innerZone.major_km, innerZone.minor_km).reverse()
            : null;
          const rings = holeRing ? [outerRing, holeRing] : [outerRing];
          const geo = { type:"Feature", geometry:{ type:"Polygon", coordinates: rings }, properties:{} };
          const srcId = `verupt-src-${i}`, layId = `verupt-layer-${i}`;
          try {
            map.addSource(srcId, { type:"geojson", data:{ type:"FeatureCollection", features:[geo] } });
            map.addLayer({ id:layId, type:"fill", source:srcId,
              paint:{ "fill-color": zoneColors[i] || "#fbbf24", "fill-opacity": zoneOpacity[i] || 0.20 }
            });
          } catch(e) {}
        });

        // Show result
        const fmt = n => n >= 1e9 ? (n/1e9).toFixed(1)+"B" : n >= 1e6 ? (n/1e6).toFixed(1)+"M" : n >= 1e3 ? (n/1e3).toFixed(0)+"K" : n;
        const blackoutLine = data.blackout_pct > 0
          ? `<div style="color:#fbbf24;font-size:11px;margin-top:6px">☁ ${data.blackout_pct}% sunlight blocked for ${data.blackout_months} months — ${data.blackout_severity}</div>` : "";
        new mapboxgl.Popup({ closeButton:true, maxWidth:"300px", className:"elev-popup" })
          .setLngLat([lng, lat])
          .setHTML(`<div style="font-family:Arial,sans-serif">
            <div style="font-weight:700;font-size:14px;color:#ef4444;margin-bottom:6px">💥 ${name} — VEI ${data.vei}</div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:8px">${data.vtype||"Unknown type"}</div>
            <table style="font-size:12px;width:100%;border-collapse:collapse;margin-bottom:6px">
              <tr><td style="color:#94a3b8;padding:2px 8px 2px 0">Est. deaths</td><td style="font-weight:700;color:#ef4444">${fmt(data.total_deaths)}</td></tr>
              <tr><td style="color:#94a3b8;padding:2px 8px 2px 0">Pop. affected</td><td style="font-weight:700">${fmt(data.total_population)}</td></tr>
            </table>
            ${data.zones.map((z,i) => `<div style="font-size:11px;color:${["#ef4444","#f97316","#fbbf24","#4ade80"][Math.min(i,3)]};margin-bottom:2px">${z.name}: ${fmt(z.deaths)} dead (${z.mortality_pct}% mortality · ${z.major_km}km)</div>`).join("")}
            ${blackoutLine}
          </div>`)
          .addTo(map);

        // Populate the stats panel — reuse yellowstoneResult format
        // Map generic zones to yellowstone zone format with survival % and desc
        const survivalMap = ["0%","15-30%","50-70%","85-95%","95-99%","99%+"];
        const descMap = [
          "Total destruction — pyroclastic flows and heavy ashfall",
          "Heavy ashfall >1m — building collapse, crop failure",
          "Moderate ash — air travel disrupted, health risk",
          "Trace ash — air quality impacts, disruption",
          "Light ash — minor disruption",
          "Detectable ash — minimal direct impact",
        ];
        const mappedZones = data.zones.map((z, i) => ({
          ...z,
          color: ["#7f1d1d","#b91c1c","#ea580c","#f97316","#fbbf24","#4ade80"][i] || "#4ade80",
          survival: survivalMap[i] || "99%+",
          desc: descMap[i] || z.name,
        }));
        // Build a result object matching yellowstoneResult shape
        const eruptResult = {
          ...data,
          zones: mappedZones,
          famine_deaths_estimate: data.blackout_pct > 0
            ? Math.round(8_100_000_000 * Math.pow(data.blackout_pct/100, 1.5) * (data.blackout_months/12) * 0.15) : 0,
        };
        setYellowstoneResult(eruptResult);
        setYellowstoneActive(true);
        // Override preset display with eruption data via a synthetic preset
        window.__dmLastEruptResult = eruptResult;

        setStatus(`${name} eruption simulated — VEI ${data.vei}`);
        map.flyTo({ center:[lng, lat], zoom: data.vei >= 7 ? 4 : data.vei >= 5 ? 6 : 8, duration:1500 });
      } catch(e) { console.warn("Erupt error:", e); setStatus("Eruption sim failed"); }
    };
    return () => { delete window.__dmWiki; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Derived display values for the collapsed strip ───────────────────────
  const stripLabel = scenarioMode === "impact"
    ? `💥 ${impactDiameter.toLocaleString()}m`
    : scenarioMode === "nuke"
    ? `☢️ ${nukeYield >= 1000 ? (nukeYield/1000).toFixed(1)+"Mt" : nukeYield+"kt"}`
    : formatLevelForDisplay(seaLevel);

  const stripModePill = scenarioMode === "impact" ? "Impact" : scenarioMode === "nuke" ? "Nuke" : "Flood";

  const handleStripCTA = (e) => {
    e.stopPropagation();
    if (scenarioMode === "impact") runImpact();
    else if (scenarioMode === "nuke") runNuke();
    else executeFlood();
  };

  // ─── Shared panel content (renders inside both desktop sidebar & mobile drawer) ──
  const panelContent = (
    <>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 12, paddingTop: 4 }}>
        <img src={LOGO_DATA} alt="Disaster Map" style={{ width: 90, height: 90, objectFit: "contain", marginBottom: 6 }} />
          <div style={{ fontSize: 10, color: "#facc15", letterSpacing: "0.1em", fontFamily: "Arial,sans-serif" }}>
            Something not looking right? Hard refresh: Ctrl+Shift+R / Cmd+Shift+R
          </div>
      </div>
      {/* Upgrade CTA */}
      {proTier === "free" ? (
        <div style={{ marginBottom: 14, borderRadius: 10, overflow: "hidden", border: "1px solid #1e3a5f" }}>
          <div style={{ background: "linear-gradient(135deg,#1e3a5f,#0f172a)", padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>FREE TIER</div>
            <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 8 }}>
              {rlStatus.dayCount}/{FREE_SIM_PER_DAY} simulations today
            </div>
            <button onClick={() => setPaywallModal("pro")}
              style={{ width: "100%", padding: "8px", background: "#f97316", color: "white", border: "none", borderRadius: 7, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              ⚡ $18.99 Lifetime — Going up to $24.99
            </button>

          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 10, background: "#0f2d1a", border: "1px solid #166534" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "#4ade80", fontWeight: 700 }}>
              ✓ Pro — {rlStatus.hourCount}/{PRO_SIM_PER_HOUR}/hr
            </div>
            <a href="https://billing.stripe.com/p/login/00w28rcyY4bM8Oy1b7a3u00" target="_blank"
              style={{ fontSize: 11, color: "#4ade80", opacity: 0.7, textDecoration: "none", cursor: "pointer" }}>
              Manage →
            </a>
          </div>
        </div>
      )}

      {/* Auth — sign in/up or user account */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, padding: "8px 12px", background: "#111827", borderRadius: 10, border: "1px solid #1e2d45" }}>
        {isSignedIn ? (
          <>
            <div style={{ fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
              {user?.firstName || user?.emailAddresses?.[0]?.emailAddress || "Account"}
              {proTier !== "free" && <span style={{ marginLeft: 6, color: "#f97316", fontWeight: 700 }}>✓</span>}
            </div>
            <UserButton afterSignOutUrl="/" />
          </>
        ) : (
          <>
            <span style={{ fontSize: 11, color: "#64748b" }}>Sync across devices</span>
            <div style={{ display: "flex", gap: 6 }}>
              <SignInButton mode="modal">
                <button style={{ background: "transparent", border: "1px solid #1e2d45", color: "#94a3b8", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "Arial,sans-serif" }}>
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button style={{ background: "#f97316", border: "none", color: "white", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "Arial,sans-serif" }}>
                  Sign Up
                </button>
              </SignUpButton>
            </div>
          </>
        )}
      </div>

      <hr style={{ margin: "0 0 16px 0", borderColor: "#1e2d45" }} />

      {/* ── SCENARIO MODE ── */}
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: "0.1em", color: "#f97316", textTransform: "uppercase" }}>Scenario Mode</div>
      <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => { clearSurge(); clearEarthquake(); clearNuke(); clearYellowstone(); clearTsunami(); clearCataclysm(); clearImpactPreview(); removeFloodLayer(); removeImpactPoint(); setImpactResult(null); setImpactError(""); setNukeResult(null); setNukeError(""); setNukeLoading(false); setNukePointSet(false); nukePointRef.current = null; setEmpResult(null); if (elevPopupRef.current) { elevPopupRef.current.remove(); elevPopupRef.current = null; } if (impactZonePopupRef.current) { impactZonePopupRef.current.remove(); impactZonePopupRef.current = null; } if (nukeZonePopupRef.current) { nukeZonePopupRef.current.remove(); nukeZonePopupRef.current = null; } unlockMapControls(); setScenarioMode("flood"); }}
          style={{ width: "100%", padding: "13px 14px", minHeight: 56, border: "1px solid #d1d5db", background: scenarioMode === "flood" ? "#1e3a5f" : "#111827", color: scenarioMode === "flood" ? "#60a5fa" : "#94a3b8", border: scenarioMode === "flood" ? "1px solid #3b82f6" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 12, fontWeight: 700, textAlign: "left" }}>
          <div style={{ fontSize: 15 }}>Flood</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>Sea level up / down</div>
        </button>
        <button
          onClick={() => { clearSurge(); clearEarthquake(); clearNuke(); clearYellowstone(); clearTsunami(); clearCataclysm(); clearImpactPreview(); removeFloodLayer(); removeImpactPoint(); setImpactResult(null); setImpactError(""); setNukeResult(null); setNukeError(""); setNukeLoading(false); setNukePointSet(false); nukePointRef.current = null; setEmpResult(null); if (elevPopupRef.current) { elevPopupRef.current.remove(); elevPopupRef.current = null; } if (impactZonePopupRef.current) { impactZonePopupRef.current.remove(); impactZonePopupRef.current = null; } if (nukeZonePopupRef.current) { nukeZonePopupRef.current.remove(); nukeZonePopupRef.current = null; } unlockMapControls(); setScenarioMode("impact"); }}
          style={{ width: "100%", padding: "13px 14px", minHeight: 56, border: "1px solid #d1d5db", background: scenarioMode === "impact" ? "#1e3a5f" : "#111827", color: scenarioMode === "impact" ? "#60a5fa" : "#94a3b8", border: scenarioMode === "impact" ? "1px solid #3b82f6" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 12, fontWeight: 700, textAlign: "left" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}><span style={{ fontSize: 15 }}>Impact</span><button onClick={(e) => { e.stopPropagation(); setScenarioWiki(SCENARIO_WIKI["impact"]); }} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:13, padding:"0 2px" }}>ℹ️</button></div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>Click map to place impact point</div>
        </button>
        <button
          onClick={() => {
            clearSurge();
            if (scenarioModeRef.current === "nuke") clearNuke();
            if (scenarioModeRef.current === "yellowstone") clearYellowstone();
            if (scenarioModeRef.current === "tsunami") clearTsunami();
            if (scenarioModeRef.current === "cataclysm") clearCataclysm();
            unlockMapControls();
            setScenarioMode("climate");
          }}
          style={{ width: "100%", padding: "13px 14px", minHeight: 56, background: scenarioMode === "climate" ? "#052e16" : "#111827", color: scenarioMode === "climate" ? "#4ade80" : "#94a3b8", border: scenarioMode === "climate" ? "1px solid #22c55e" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 12, fontWeight: 700, textAlign: "left" }}>
          <div style={{ fontSize: 15 }}>🌍 Climate Change</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>Sea level rise projections</div>
        </button>
        <button
          onClick={() => { clearSurge(); clearEarthquake(); clearNuke(); clearYellowstone(); clearTsunami(); clearCataclysm(); clearImpactPreview(); removeFloodLayer(); removeImpactPoint(); setImpactResult(null); setImpactError(""); setNukeResult(null); setNukeError(""); setNukeLoading(false); setNukePointSet(false); nukePointRef.current = null; setEmpResult(null); if (elevPopupRef.current) { elevPopupRef.current.remove(); elevPopupRef.current = null; } if (impactZonePopupRef.current) { impactZonePopupRef.current.remove(); impactZonePopupRef.current = null; } if (nukeZonePopupRef.current) { nukeZonePopupRef.current.remove(); nukeZonePopupRef.current = null; } unlockMapControls(); setScenarioMode("nuke"); }}
          style={{ width: "100%", padding: "13px 14px", minHeight: 56, border: "1px solid #d1d5db", background: scenarioMode === "nuke" ? "#4c1d95" : "#111827", color: scenarioMode === "nuke" ? "#c4b5fd" : "#94a3b8", border: scenarioMode === "nuke" ? "1px solid #7c3aed" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 12, fontWeight: 700, textAlign: "left" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}><span style={{ fontSize: 15 }}>☢️ Nuke</span><button onClick={(e) => { e.stopPropagation(); setScenarioWiki(SCENARIO_WIKI["nuke"]); }} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:13, padding:"0 2px" }}>ℹ️</button></div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>Click map to place detonation point</div>
        </button>
        <button
          onClick={() => { clearSurge(); clearEarthquake(); clearNuke(); clearYellowstone(); clearTsunami(); clearCataclysm(); clearImpactPreview(); removeFloodLayer(); removeImpactPoint(); setImpactResult(null); setImpactError(""); setNukeResult(null); setNukeError(""); setNukeLoading(false); setNukePointSet(false); nukePointRef.current = null; setEmpResult(null); if (elevPopupRef.current) { elevPopupRef.current.remove(); elevPopupRef.current = null; } if (impactZonePopupRef.current) { impactZonePopupRef.current.remove(); impactZonePopupRef.current = null; } if (nukeZonePopupRef.current) { nukeZonePopupRef.current.remove(); nukeZonePopupRef.current = null; } unlockMapControls(); setScenarioMode("yellowstone"); }}
          style={{ width: "100%", padding: "13px 14px", minHeight: 56, background: scenarioMode === "yellowstone" ? "#431407" : "#111827", color: scenarioMode === "yellowstone" ? "#fb923c" : "#94a3b8", border: scenarioMode === "yellowstone" ? "1px solid #ea580c" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 12, fontWeight: 700, textAlign: "left" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}><span style={{ fontSize: 15 }}>🌋 Volcanoes</span><button onClick={(e) => { e.stopPropagation(); setScenarioWiki(SCENARIO_WIKI["yellowstone"]); }} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:13, padding:"0 2px" }}>ℹ️</button></div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>Global volcanoes · eruption sims</div>
        </button>
        <button
          onClick={() => { clearSurge(); clearEarthquake(); clearNuke(); clearYellowstone(); clearTsunami(); clearCataclysm(); clearImpactPreview(); removeFloodLayer(); removeImpactPoint(); setImpactResult(null); setImpactError(""); setNukeResult(null); setNukeError(""); setNukeLoading(false); setNukePointSet(false); nukePointRef.current = null; setEmpResult(null); if (elevPopupRef.current) { elevPopupRef.current.remove(); elevPopupRef.current = null; } if (impactZonePopupRef.current) { impactZonePopupRef.current.remove(); impactZonePopupRef.current = null; } if (nukeZonePopupRef.current) { nukeZonePopupRef.current.remove(); nukeZonePopupRef.current = null; } unlockMapControls(); scenarioModeRef.current = "tsunami"; setScenarioMode("tsunami"); }}
          style={{ width: "100%", padding: "13px 14px", minHeight: 56, background: scenarioMode === "tsunami" ? "#0c2a4a" : "#111827", color: scenarioMode === "tsunami" ? "#38bdf8" : "#94a3b8", border: scenarioMode === "tsunami" ? "1px solid #0ea5e9" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 12, fontWeight: 700, textAlign: "left" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}><span style={{ fontSize: 15 }}>🌊 Mega-Tsunami</span><button onClick={(e) => { e.stopPropagation(); setScenarioWiki(SCENARIO_WIKI["tsunami"]); }} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:13, padding:"0 2px" }}>ℹ️</button></div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>Ocean collapse wave propagation</div>
        </button>
        <button
          onClick={() => { clearSurge(); clearEarthquake(); clearNuke(); clearYellowstone(); clearTsunami(); clearCataclysm(); clearImpactPreview(); removeFloodLayer(); removeImpactPoint(); setImpactResult(null); setImpactError(""); setNukeResult(null); setNukeError(""); setNukeLoading(false); setNukePointSet(false); nukePointRef.current = null; setEmpResult(null); if (elevPopupRef.current) { elevPopupRef.current.remove(); elevPopupRef.current = null; } if (impactZonePopupRef.current) { impactZonePopupRef.current.remove(); impactZonePopupRef.current = null; } if (nukeZonePopupRef.current) { nukeZonePopupRef.current.remove(); nukeZonePopupRef.current = null; } unlockMapControls(); scenarioModeRef.current = "cataclysm"; setScenarioMode("cataclysm"); }}
          style={{ width: "100%", padding: "13px 14px", minHeight: 56, background: scenarioMode === "cataclysm" ? "#1a0505" : "#111827", color: scenarioMode === "cataclysm" ? "#ef4444" : "#94a3b8", border: scenarioMode === "cataclysm" ? "1px solid #dc2626" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 12, fontWeight: 700, textAlign: "left" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}><span style={{ fontSize: 15 }}>☄️ Cataclysm</span><button onClick={(e) => { e.stopPropagation(); setScenarioWiki(SCENARIO_WIKI["cataclysm"]); }} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:13, padding:"0 2px" }}>ℹ️</button></div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>Pole shift inundation models</div>
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => { clearSurge(); setScenarioMode("surge"); scenarioModeRef.current = "surge"; setSurgeOn(true); surgeOnRef.current = true; window.__dmClearSurge = clearSurge; }}
            style={{ flex: 1, padding: "13px 14px", minHeight: 56, background: scenarioMode === "surge" ? "rgba(56,189,248,0.1)" : "#111827", color: scenarioMode === "surge" ? "#38bdf8" : "#94a3b8", border: scenarioMode === "surge" ? "1px solid #38bdf8" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 12, fontWeight: 700, textAlign: "left" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize: 15 }}>🌀 Storm Surge</span>
              {proTier === "free" && <span style={{ fontSize: 10, color: "#f97316" }}>PRO</span>}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>
              {surgeOn ? (surgePoint ? `Surge active: +${surgeM} m` : "Click map to place surge point") : "Localised coastal storm surge"}
            </div>
          </button>
          {(surgeOn || scenarioMode === "surge") && (
            <button onClick={() => { clearSurge(); setScenarioMode("flood"); scenarioModeRef.current = "flood"; }}
              style={{ padding: "13px 12px", minHeight: 56, background: "#111827", color: "#475569", border: "1px solid #1e2d45", cursor: "pointer", borderRadius: 12, fontWeight: 700, fontSize: 13 }}>
              Clear
            </button>
          )}
        </div>

        <button
          onClick={() => { clearSurge(); clearEarthquake(); clearNuke(); clearYellowstone(); clearTsunami(); clearCataclysm(); clearImpactPreview(); removeFloodLayer(); removeImpactPoint(); setImpactResult(null); setImpactError(""); setNukeResult(null); setNukeError(""); setNukeLoading(false); setNukePointSet(false); nukePointRef.current = null; setEmpResult(null); unlockMapControls(); setScenarioMode("earthquake"); scenarioModeRef.current = "earthquake"; }}
          style={{ width:"100%", padding:"13px 14px", minHeight:56, background: scenarioMode==="earthquake" ? "#1c1208" : "#111827", color: scenarioMode==="earthquake" ? "#fbbf24" : "#94a3b8", border: scenarioMode==="earthquake" ? "1px solid #f59e0b" : "1px solid #1e2d45", cursor:"pointer", borderRadius:12, fontWeight:700, textAlign:"left" }}>
          <div style={{ fontSize:15 }}>🌍 Earthquake</div>
          <div style={{ fontSize:12, opacity:0.7, marginTop:3 }}>Seismic intensity + tsunami trigger</div>
        </button>

      </div>

      {/* ── SURGE CONTROLS ── */}
      {scenarioMode === "surge" && (
        <div style={{ marginBottom: 16, padding: "12px", background: "rgba(56,189,248,0.05)", borderRadius: 10, border: "1px solid #1e2d45" }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: "0.1em", color: "#38bdf8", textTransform: "uppercase" }}>Storm Surge Settings</div>
          <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
            {SURGE_PRESETS.map(p => (
              <button key={p.id} onClick={() => selectSurgePreset(p)}
                title={`${p.wind_kmh} km/h · ${p.example}`}
                style={{ padding: "5px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "1px solid", background: surgePreset === p.id ? p.color : "transparent", borderColor: p.color, color: surgePreset === p.id ? "white" : p.color }}>
                <div>{p.label}</div>
                <div style={{ fontSize: 9, opacity: 0.8, fontWeight: 400 }}>{p.wind_kmh} km/h</div>
              </button>
            ))}
          </div>

          <input type="range" min={0.5} max={10} step={0.5} value={surgeM}
            onChange={e => { setSurgeM(parseFloat(e.target.value)); setSurgePreset(null); }}
            style={{ width: "100%", marginBottom: 4 }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginBottom: 8 }}>
            <span>0.5 m</span><span style={{ fontWeight: 700, color: "#38bdf8" }}>{surgeM} m</span><span>10 m</span>
          </div>
          {surgePreset && SURGE_PRESETS.find(p => p.id === surgePreset) && (
            <div style={{ fontSize: 11, color: "#38bdf8", marginBottom: 8, textAlign: "center" }}>
              💨 {SURGE_PRESETS.find(p => p.id === surgePreset).wind_kmh} km/h · {SURGE_PRESETS.find(p => p.id === surgePreset).wind_mph} mph
            </div>
          )}
          <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginBottom: 8 }}>
            {surgeTrackPts.length > 0
              ? `📍 ${surgeTrackPts.length}/3 points placed${surgeTrackPts.length < 3 ? " · click map to add more" : " · hit Trigger"}`
              : proTier !== "free" ? "👆 Click map to place up to 3 surge points" : "👆 Click map to place surge point"}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={() => {
                if (surgeTrackPts.length > 0) triggerSurgeTrack();
              }}
              disabled={surgeTrackPts.length === 0}
              style={{ flex: 1, padding: "10px", background: surgeTrackPts.length > 0 ? "#38bdf8" : "#1e2d45", color: surgeTrackPts.length > 0 ? "#0f172a" : "#475569", border: "none", borderRadius: 8, fontWeight: 700, cursor: surgeTrackPts.length > 0 ? "pointer" : "not-allowed", fontSize: 13 }}>
              {surgeTrackPts.length > 0 ? `🌀 Trigger (${surgeTrackPts.length} pt${surgeTrackPts.length>1?"s":""})` : "🌀 Click map to place"}
            </button>
            {surgeOn && <button onClick={clearSurge}
              style={{ flex: 1, padding: "10px", background: "transparent", color: "#475569", border: "1px solid #1e2d45", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              Clear
            </button>}
          </div>
        </div>
      )}

      {/* ── EARTHQUAKE CONTROLS ── */}
      {scenarioMode === "earthquake" && (
        <div style={{ marginBottom:16 }}>
          {/* Magnitude */}
          <div style={{ fontWeight:700, fontSize:12, marginBottom:8, letterSpacing:"0.1em", color:"#f59e0b", textTransform:"uppercase" }}>Magnitude</div>
          <input type="range" min={4} max={9.5} step={0.1} value={eqMag}
            onChange={e => { setEqMag(parseFloat(e.target.value)); eqMagRef.current = parseFloat(e.target.value); }}
            style={{ width:"100%", marginBottom:4 }} />
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#64748b", marginBottom:12 }}>
            <span>M4.0</span><span style={{ color:"#fbbf24", fontWeight:700 }}>M{eqMag.toFixed(1)}</span><span>M9.5</span>
          </div>

          {/* Depth type */}
          <div style={{ fontWeight:700, fontSize:12, marginBottom:6, letterSpacing:"0.1em", color:"#f59e0b", textTransform:"uppercase" }}>Depth</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4, marginBottom:12 }}>
            {EQ_DEPTH_TYPES.map(d => (
              <button key={d.id} onClick={() => { setEqDepthId(d.id); eqDepthRef.current = d.id; }}
                style={{ padding:"6px 8px", borderRadius:8, fontSize:11, fontWeight:600, cursor:"pointer", textAlign:"left",
                  background: eqDepthId===d.id ? "#451a03" : "#111827",
                  color: eqDepthId===d.id ? "#fbbf24" : "#64748b",
                  border: eqDepthId===d.id ? "1px solid #f59e0b" : "1px solid #1e2d45" }}>
                <div>{d.label}</div>
                <div style={{ fontSize:10, opacity:0.7 }}>{d.desc}</div>
              </button>
            ))}
          </div>

          {/* Fault type */}
          <div style={{ fontWeight:700, fontSize:12, marginBottom:6, letterSpacing:"0.1em", color:"#f59e0b", textTransform:"uppercase" }}>Fault Type</div>
          <div style={{ display:"flex", gap:4, marginBottom:12 }}>
            {EQ_FAULT_TYPES.map(f => (
              <button key={f.id} onClick={() => { setEqFaultId(f.id); eqFaultRef.current = f.id; }}
                style={{ flex:1, padding:"6px 4px", borderRadius:8, fontSize:11, fontWeight:600, cursor:"pointer",
                  background: eqFaultId===f.id ? "#451a03" : "#111827",
                  color: eqFaultId===f.id ? "#fbbf24" : "#64748b",
                  border: eqFaultId===f.id ? "1px solid #f59e0b" : "1px solid #1e2d45" }}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Presets */}
          <div style={{ fontWeight:700, fontSize:12, marginBottom:6, letterSpacing:"0.1em", color:"#f59e0b", textTransform:"uppercase" }}>Historic Events</div>
          <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:12 }}>
            {EQ_PRESETS.map(p => (
              <button key={p.label} onClick={() => loadEqPreset(p)}
                style={{ padding:"8px 10px", borderRadius:8, fontSize:11, fontWeight:600, cursor:"pointer", textAlign:"left",
                  background:"#111827", color:"#94a3b8", border:"1px solid #1e2d45" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ color:"#fbbf24" }}>{p.label}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ color:"#f59e0b" }}>M{p.mag}</span>
                    {p.wiki && <span onClick={(e) => { e.stopPropagation(); setScenarioWiki({ title: p.label, icon:"🌍", body: p.wiki }); }} style={{ fontSize:11, cursor:"pointer", opacity:0.7 }}>ℹ️</span>}
                  </div>
                </div>
                <div style={{ fontSize:10, opacity:0.6, marginTop:2 }}>{p.desc}</div>
              </button>
            ))}
          </div>

          <div style={{ fontSize:11, color:"#94a3b8", textAlign:"center", marginBottom:10 }}>
            {eqPoint ? "👆 Hit Trigger to run simulation" : "👆 Click map to place epicenter"}
          </div>

          {/* Fault Lines toggle — above trigger */}
          <div onClick={() => {
            if (proTierRef.current === "free") { setPaywallModal("pro"); return; }
            const next = !faultLinesOn;
            setFaultLinesOn(next); faultLinesOnRef.current = next;
            next ? addFaultLines() : removeFaultLines();
          }} style={{
            display:"flex", alignItems:"center", gap:10, padding:"9px 10px",
            marginBottom:8, borderRadius:9, cursor:"pointer",
            background: faultLinesOn ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.03)",
            border: faultLinesOn ? "1px solid #ef444455" : "1px solid #1e2d45",
          }}>
            <span style={{ fontSize:16 }}>⚡</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:700, color: faultLinesOn ? "#ef4444" : "#94a3b8" }}>
                Active Fault Lines
                {proTierRef.current === "free" && <span style={{ marginLeft:6, fontSize:10, color:"#f97316" }}>PRO</span>}
              </div>
              <div style={{ fontSize:10, color:"#475569", marginTop:1 }}>
                {faultLinesOn ? "Click fault for info + set quake here" : "16,000+ faults · slip rates · recurrence"}
              </div>
            </div>
            <div style={{ width:28, height:16, borderRadius:8, background: faultLinesOn ? "#ef4444" : "#1e2d45", position:"relative", flexShrink:0, transition:"background 0.2s" }}>
              <div style={{ position:"absolute", top:2, left: faultLinesOn ? 14 : 2, width:12, height:12, borderRadius:"50%", background:"white", transition:"left 0.2s" }} />
            </div>
          </div>

          <div style={{ display:"flex", gap:6, marginBottom: eqResult ? 8 : 0 }}>
            <button onClick={() => { if (eqPointRef.current) { setEqView("rings"); runEarthquake(eqPointRef.current.lat, eqPointRef.current.lng, eqMagRef.current, eqDepthRef.current, eqFaultRef.current); } }}
              disabled={!eqPoint}
              style={{ flex:1, padding:"10px", background: eqPoint ? "#f59e0b" : "#1e2d45", color: eqPoint ? "#0f172a" : "#475569", border:"none", borderRadius:8, fontWeight:700, cursor: eqPoint ? "pointer" : "not-allowed", fontSize:13 }}>
              🌍 Trigger
            </button>
            {eqPoint && <button onClick={clearEarthquake}
              style={{ flex:1, padding:"10px", background:"transparent", border:"1px solid #1e2d45", borderRadius:8, color:"#475569", cursor:"pointer", fontSize:13, fontWeight:700 }}>
              Clear
            </button>}
          </div>
          {eqResult && eqResult.tsunamiRisk && eqResult.isPro && (
            <div style={{ display:"flex", gap:4 }}>
              <button onClick={() => { setEqView("rings"); applyEqView("rings"); }}
                style={{ flex:1, padding:"7px", borderRadius:7, fontSize:12, fontWeight:700, cursor:"pointer", border:"1px solid",
                  background: eqView==="rings" ? "#451a03" : "transparent",
                  borderColor: eqView==="rings" ? "#f59e0b" : "#1e2d45",
                  color: eqView==="rings" ? "#fbbf24" : "#475569" }}>
                🔴 Intensity Rings
              </button>
              <button onClick={() => { setEqView("tsunami"); applyEqView("tsunami"); }}
                style={{ flex:1, padding:"7px", borderRadius:7, fontSize:12, fontWeight:700, cursor:"pointer", border:"1px solid",
                  background: eqView==="tsunami" ? "rgba(56,189,248,0.1)" : "transparent",
                  borderColor: eqView==="tsunami" ? "#38bdf8" : "#1e2d45",
                  color: eqView==="tsunami" ? "#38bdf8" : "#475569" }}>
                🌊 Tsunami
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── IMPACT CONTROLS ── */}
      {scenarioMode === "impact" && (
        <>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: "0.1em", color: "#f97316", textTransform: "uppercase" }}>Presets</div>
          {["historical", "threat", "scale"].map(cat => (
            <div key={cat}>
              <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase", marginBottom: 6 }}>
                {cat === "historical" ? "⚡ Historical" : cat === "threat" ? "⚠️ Known Threats" : "📏 Scale"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                {IMPACT_PRESETS.filter(p => p.category === cat).map(p => (
                  <button key={p.label}
                    onClick={() => { setImpactDiameter(p.diameter); }}
                    style={{ padding: "8px 10px", background: impactDiameter === p.diameter ? "#7f1d1d" : "#111827", color: impactDiameter === p.diameter ? "#fca5a5" : "#94a3b8", border: impactDiameter === p.diameter ? "1px solid #ef4444" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 10, fontWeight: 700, textAlign: "left", position: "relative" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ fontSize: 12 }}>{p.label}</div>
                      {p.wiki && <span onClick={(e) => { e.stopPropagation(); setScenarioWiki({ title: p.label, icon: "🌑", body: p.wiki }); }} style={{ fontSize: 11, color: "#475569", cursor: "pointer", lineHeight: 1 }}>ℹ️</span>}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{p.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {proTier !== "free" ? (<>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, marginTop: 4, letterSpacing: "0.1em", color: "#f97316", textTransform: "uppercase" }}>Custom Size</div>
            <input
              type="range" min="50" max="20000" step="50" value={impactDiameter}
              onChange={(e) => {
                const maxD = proTier !== "free" ? PRO_MAX_IMPACT_DIAMETER : FREE_MAX_IMPACT_DIAMETER;
                const val = Math.min(Number(e.target.value), maxD);
                if (proTier === "free" && Number(e.target.value) > FREE_MAX_IMPACT_DIAMETER) setPaywallModal("pro");
                setImpactDiameter(val);
              }}
              style={{ width: "100%", marginBottom: 10, height: 6, cursor: "pointer" }}
            />
            <input
              type="number" min="50" max="20000" step="50" value={impactDiameter}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                const maxD = proTier !== "free" ? PRO_MAX_IMPACT_DIAMETER : FREE_MAX_IMPACT_DIAMETER;
                if (proTier === "free" && n > FREE_MAX_IMPACT_DIAMETER) { setPaywallModal("pro"); setImpactDiameter(FREE_MAX_IMPACT_DIAMETER); return; }
                setImpactDiameter(Math.max(50, Math.min(maxD, n)));
              }}
              style={{ width: "100%", padding: "12px 14px", fontSize: 17, border: "1px solid #1e2d45", marginBottom: 10, boxSizing: "border-box", borderRadius: 8, minHeight: 48, background: "#111827", color: "#e2e8f0" }}
            />
            <div style={{ fontSize: 13, marginBottom: proTier === "free" ? 6 : 16, color: "#64748b" }}>
              Diameter: <b>{impactDiameter.toLocaleString()} m</b>
            </div>
            {proTier === "free" && (
              <div onClick={() => setPaywallModal("pro")} style={{ fontSize: 11, color: "#f97316", marginBottom: 12, cursor: "pointer", padding: "5px 8px", background: "#1a0d00", border: "1px solid #7c2d00", borderRadius: 6 }}>
                🔒 Free cap: 5,000 m — <span style={{ color: "#fb923c", textDecoration: "underline" }}>Pro unlocks 20,000 m</span>
              </div>
            )}
          </>) : (
            <button onClick={() => setPaywallModal("pro")} style={{ width: "100%", padding: "10px 14px", marginBottom: 16, marginTop: 4, background: "#0f172a", border: "1px solid #1e2d45", borderRadius: 8, color: "#475569", cursor: "pointer", textAlign: "left", fontSize: 12 }}>
              🔒 Custom size — <span style={{ color: "#7c3aed" }}>Pro</span>
            </button>
          )}

          {/* Velocity slider — Pro only */}
          {proTier !== "free" ? (
            <>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, marginTop: 4, letterSpacing: "0.1em", color: "#f97316", textTransform: "uppercase" }}>Impact Velocity</div>
              <input
                type="range" min="11" max="72" step="1" value={impactVelocity}
                onChange={(e) => { setImpactVelocity(Number(e.target.value)); impactVelocityRef.current = Number(e.target.value); }}
                style={{ width: "100%", marginBottom: 6, height: 6, cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11, color: "#475569" }}>
                <span>11 km/s (slow)</span>
                <span>72 km/s (comet)</span>
              </div>
              <div style={{ fontSize: 13, marginBottom: 4, color: "#64748b" }}>
                Velocity: <b>{impactVelocity} km/s</b>
                {impactVelocity <= 15 && <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: 6 }}>— slow asteroid</span>}
                {impactVelocity > 15 && impactVelocity <= 25 && <span style={{ color: "#f97316", fontSize: 11, marginLeft: 6 }}>— typical Apollo</span>}
                {impactVelocity > 25 && impactVelocity <= 45 && <span style={{ color: "#ef4444", fontSize: 11, marginLeft: 6 }}>— fast asteroid</span>}
                {impactVelocity > 45 && <span style={{ color: "#a78bfa", fontSize: 11, marginLeft: 6 }}>— cometary</span>}
              </div>
              <div style={{ fontSize: 11, color: "#475569", marginBottom: 14, lineHeight: 1.5 }}>
                KE scales as v² — doubling velocity quadruples energy, crater, blast &amp; tsunami.
              </div>
            </>
          ) : (
            <div onClick={() => setPaywallModal("pro")} style={{ fontSize: 11, color: "#f97316", marginBottom: 12, cursor: "pointer", padding: "5px 8px", background: "#1a0d00", border: "1px solid #7c2d00", borderRadius: 6 }}>
              🔒 Impact velocity (11–72 km/s) — <span style={{ color: "#fb923c", textDecoration: "underline" }}>Pro feature</span>
            </div>
          )}
          {proTier !== "free" ? (
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 8 }}>
              {impactPoints.length > 0 ? `${impactPoints.length}/3 impact points placed` : "Click map to place up to 3 impact points"}
            </div>
          ) : (
            <div onClick={() => setPaywallModal("pro")} style={{ fontSize: 11, color: "#f97316", marginBottom: 8, cursor: "pointer", padding: "5px 8px", background: "#1a0d00", border: "1px solid #7c2d00", borderRadius: 6 }}>
              🔒 Multiple impacts (up to 3) — <span style={{ color: "#fb923c", textDecoration: "underline" }}>Pro feature</span>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button onClick={runImpact} disabled={impactPoints.length === 0 && !impactPointRef.current || impactLoading}
              style={{ flex: 1, padding: "14px 10px", minHeight: 52, background: "#ef4444", color: "white", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 15, opacity: (impactPoints.length === 0 && !impactPointRef.current) || impactLoading ? 0.65 : 1 }}>
              {impactLoading ? "Running..." : impactPoints.length > 1 ? `Run ${impactPoints.length} Impacts` : "Run Impact"}
            </button>
            <button onClick={() => { clearImpactPreview(); removeImpactPoint(); setImpactResult(null); setImpactError(""); if (impactZonePopupRef.current) { impactZonePopupRef.current.remove(); impactZonePopupRef.current = null; } setStatus("Impact cleared"); }}
              style={{ flex: 1, padding: "14px 10px", minHeight: 52, background: "#1e293b", color: "#e2e8f0", border: "1px solid #1e2d45", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 15 }}>
              Clear
            </button>
          </div>
        </>
      )}

      {/* ── FLOOD CONTROLS — below scenario buttons ── */}
      {scenarioMode === "flood" && <>
        <hr style={{ margin: "0 0 16px 0", borderColor: "#1e2d45" }} />
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, letterSpacing: "0.1em", color: "#f97316", textTransform: "uppercase" }}>Sea Level</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: seaLevel > 0 ? "#3b82f6" : seaLevel < 0 ? "#f97316" : "#94a3b8" }}>
          {formatLevelForDisplay(seaLevel)}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button onClick={() => setUnitMode("m")}
            style={{ flex: 1, padding: "12px 8px", minHeight: 44, background: unitMode === "m" ? "#f97316" : "#1e293b", color: "white", border: unitMode === "m" ? "1px solid #f97316" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 15 }}>
            Meters
          </button>
          <button onClick={() => setUnitMode("ft")}
            style={{ flex: 1, padding: "12px 8px", minHeight: 44, background: unitMode === "ft" ? "#f97316" : "#1e293b", color: "white", border: unitMode === "ft" ? "1px solid #f97316" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 15 }}>
            Feet
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button onClick={() => { const cur = inputText.trim(); let next; if (cur.startsWith("-")) { next = cur.slice(1); } else if (cur === "" || cur === "0") { next = "-"; } else { next = "-" + cur; } setInputText(next); const c = commitInputText(next, unitMode); if (c !== null) { setInputLevel(c); setSeaLevel(c); seaLevelRef.current = c; } }} style={{ padding: "12px 16px", minHeight: 48, background: inputText.trim().startsWith("-") ? "#f97316" : "#1e293b", color: "white", border: inputText.trim().startsWith("-") ? "1px solid #f97316" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 8, fontWeight: 700, fontSize: 22, lineHeight: 1 }}>-</button>
          <input type="text" inputMode="decimal"
            placeholder={unitMode === "ft" ? "feet" : "meters"}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onBlur={() => { const c = commitInputText(inputText, unitMode); if (c !== null) setInputLevel(c); }}
            onKeyDown={(e) => { if (e.key === "Enter") executeFlood(); }}
            style={{ flex: 1, padding: "12px 14px", fontSize: 17, border: "1px solid #1e2d45", boxSizing: "border-box", borderRadius: 8, minHeight: 48, background: "#111827", color: "#e2e8f0" }}
          />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <button onClick={(e) => { e.stopPropagation(); executeFlood(); }}
            style={{ flex: 1, padding: "13px 10px", minHeight: 48, background: "#f97316", color: "white", border: "none", fontWeight: 700, cursor: "pointer", borderRadius: 8, fontSize: 15 }}>
            Execute Flood
          </button>
          <button onClick={clearFlood}
            style={{ flex: 1, padding: "13px 10px", minHeight: 48, background: "#1e293b", color: "#e2e8f0", border: "1px solid #1e2d45", fontWeight: 700, cursor: "pointer", borderRadius: 8, fontSize: 15 }}>
            Clear
          </button>
        </div>
        <div style={{ fontSize: 13, marginBottom: 16, color: "#475569" }}>
          Custom input supports positive and negative values in {unitMode === "ft" ? "feet" : "meters"}
        </div>
        {(proTierRef.current ?? proTier ?? "free") === "free" && seaLevel !== 0 && (
          <div onClick={() => setPaywallModal("pro")} style={{ background: "#111827", border: "1px solid #1e3a5f", borderRadius: 10, padding: "10px 14px", marginBottom: 12, cursor: "pointer" }}>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Displaced Population</div>
            <div style={{ fontSize: 14, color: "#334155", fontWeight: 700 }}>🔒 Unlock with Pro</div>
            <div style={{ fontSize: 11, color: "#1e3a5f", marginTop: 3 }}>See how many are displaced · $18.99 one-time</div>
          </div>
        )}
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: "0.1em", color: "#f97316", textTransform: "uppercase" }}>Presets</div>
        <div className={isMobile ? "fm-presets-mobile" : "fm-presets-desktop"}>
          {PRESETS.map((preset) => {
            const active = Math.round(inputLevel) === Math.round(preset.value);
            const lbl = unitMode === "ft"
              ? `${Math.round(metersToFeet(preset.value)) > 0 ? "+" : ""}${Math.round(metersToFeet(preset.value))}ft`
              : `${preset.value > 0 ? "+" : ""}${preset.value}m`;
            return (
              <button key={preset.label}
                onClick={() => {
                  setInputLevel(preset.value);
                  setInputText(formatInputTextFromMeters(preset.value, unitMode));
                  const map = mapRef.current;
                  if (map && map.isStyleLoaded()) {
                    if (preset.label === "Ice Age") {
                      // Draw ice sheets on whatever view the user is in — no forced globe switch
                      setTimeout(() => safely(() => drawIceSheets(map)), 200);
                    } else {
                      safely(() => clearIceSheets(map));
                    }
                  }
                }}
                style={{ padding: "12px 10px", minHeight: 56, background: active ? "#1e3a5f" : "#111827", color: active ? "#60a5fa" : "#94a3b8", border: active ? "1px solid #3b82f6" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                <div style={{ fontSize: 14 }}>{preset.label}</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>{lbl}</div>
              </button>
            );
          })}
        </div>
      </>}

      {/* ── CLIMATE CONTROLS — cloned from flood, green theme, preset-only ── */}
      {scenarioMode === "climate" && <>
        <hr style={{ margin: "0 0 16px 0", borderColor: "#1e2d45" }} />
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, letterSpacing: "0.1em", color: "#22c55e", textTransform: "uppercase" }}>Sea Level Rise</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: seaLevel > 0 ? "#4ade80" : "#94a3b8" }}>
          {seaLevel > 0 ? `+${seaLevel}m` : `${seaLevel}m`}
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button onClick={(e) => {
              e.stopPropagation();
              executeFlood();
              const warmingMap = { 0.3: 1.5, 0.5: 2.0, 1.0: 3.0, 1.5: 4.0 };
              const warmingLevel = warmingMap[inputLevel];
              const map = mapRef.current;
              if (map) {
                if (warmingLevel) {
                  setActiveWarmingLevel(warmingLevel); activeWarmingLevelRef.current = warmingLevel;
                  setTimeout(() => safely(() => drawWildfireZones(map, warmingLevel)), 400);
                } else {
                  setActiveWarmingLevel(null); activeWarmingLevelRef.current = null;
                  safely(() => clearWildfireZones(map));
                }
              }
            }}
            style={{ flex: 1, padding: "13px 10px", minHeight: 48, background: "#14532d", color: "white", border: "1px solid #22c55e", fontWeight: 700, cursor: "pointer", borderRadius: 8, fontSize: 15 }}>
            Apply
          </button>
          <button onClick={() => { clearFlood(); seaLevelRef.current = 0; setSeaLevel(0); setInputLevel(0); setInputText("0"); }}
            style={{ flex: 1, padding: "13px 10px", minHeight: 48, background: "#1e293b", color: "#e2e8f0", border: "1px solid #1e2d45", fontWeight: 700, cursor: "pointer", borderRadius: 8, fontSize: 15 }}>
            Clear
          </button>
        </div>
        {["warming", "ipcc", "ice"].map(cat => (
          <div key={cat}>
            <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "#64748b", textTransform: "uppercase", marginBottom: 6, marginTop: 4 }}>
              {cat === "warming" ? "🌡️ Warming Scenarios" : cat === "ipcc" ? "📊 IPCC Projections" : "🧊 Ice Sheet Collapse"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
              {CLIMATE_PRESETS.filter(p => p.category === cat).map(p => {
                const active = Math.abs((inputLevel || 0) - p.level) < 0.05;
                return (
                  <button key={p.label}
                    onClick={() => {
                      setInputLevel(p.level);
                      setInputText(String(p.level));
                      setSeaLevel(p.level);
                      seaLevelRef.current = p.level;
                      scenarioModeRef.current = "climate";
                      // Wildfire zones drawn on Apply, not on preset select
                    }}
                    style={{ padding: "10px 10px", minHeight: 52, background: active ? "#052e16" : "#111827", color: active ? "#4ade80" : "#94a3b8", border: active ? "1px solid #22c55e" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 12, fontWeight: 700, textAlign: "left" }}>
                    <div style={{ fontSize: 13 }}>{p.label}</div>
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{p.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {(proTierRef.current ?? proTier ?? "free") !== "free" && floodDisplaced !== null && (
          <div style={{ background: "#111827", border: "1px solid #22c55e", borderRadius: 10, padding: "10px 14px", marginBottom: 12, marginTop: 8 }}>
            <div style={{ fontSize: 11, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Displaced Population</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>{floodDisplaced.toLocaleString()}</div>
          </div>
        )}
        {(proTierRef.current ?? proTier ?? "free") === "free" && seaLevel !== 0 && (
          <div onClick={() => setPaywallModal("pro")} style={{ background: "#111827", border: "1px solid #1e3a5f", borderRadius: 10, padding: "10px 14px", marginBottom: 12, marginTop: 8, cursor: "pointer" }}>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Displaced Population</div>
            <div style={{ fontSize: 14, color: "#334155", fontWeight: 700 }}>🔒 Unlock with Pro</div>
            <div style={{ fontSize: 11, color: "#1e3a5f", marginTop: 3 }}>See how many are displaced · $18.99 one-time</div>
          </div>
        )}
      </>}

      <hr style={{ margin: "0 0 16px 0", borderColor: "#1e2d45" }} />

      {/* ── NUKE CONTROLS ── */}
      {scenarioMode === "nuke" && (
        <>
          {/* Sub-mode toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button onClick={() => { setNukeSubMode("detonate"); nukeSubModeRef.current = "detonate"; setEmpResult(null); }}
              style={{ flex: 1, padding: "10px 8px", minHeight: 44, background: nukeSubMode === "detonate" ? "#7c3aed" : "#111827", color: nukeSubMode === "detonate" ? "white" : "#94a3b8", border: nukeSubMode === "detonate" ? "1px solid #7c3aed" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              ☢️ Detonation
            </button>
            <button onClick={() => { setNukeSubMode("emp"); nukeSubModeRef.current = "emp"; setNukeResult(null); setNukeYield(475); }}
              style={{ flex: 1, padding: "10px 8px", minHeight: 44, background: nukeSubMode === "emp" ? "#7c3aed" : "#111827", color: nukeSubMode === "emp" ? "white" : "#94a3b8", border: nukeSubMode === "emp" ? "1px solid #7c3aed" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              ⚡ Strategic EMP
            </button>
          </div>

          {nukeSubMode === "emp" && (
            <div style={{ background: "#0f0a2a", border: "1px solid #4c1d95", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#a78bfa", marginBottom: 8, lineHeight: 1.5 }}>
                High-altitude detonation (~400km). No blast or thermal at ground level. EMP disables unshielded electronics across the footprint.
              </div>
              <div style={{ fontSize: 12, color: "#7c3aed", fontWeight: 700, marginBottom: 6 }}>Burst Altitude: {empAltitudeKm} km</div>
              <input type="range" min="200" max="600" step="10" value={empAltitudeKm}
                onChange={e => setEmpAltitudeKm(Number(e.target.value))}
                style={{ width: "100%", marginBottom: 10, cursor: "pointer" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", marginBottom: 4 }}>
                <span>200km (regional)</span><span>400km (optimal)</span><span>600km (global)</span>
              </div>
            </div>
          )}

          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: "0.1em", color: "#f97316", textTransform: "uppercase" }}>Yield</div>
          {nukeSubMode === "emp" ? (
            // EMP mode — presets only, no slider (yield affects E1 intensity, not footprint size)
            <>
            <div style={{ fontSize: 11, color: "#a78bfa", marginBottom: 8 }}>Yield affects E1 pulse intensity — what electronics survive.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {[
                { label: "Hiroshima · 15kt", e1: "~5 kV/m", effect: "Disrupts phones, computers, consumer electronics", yield_kt: 15 },
                { label: "W76 · 100kt",      e1: "~13 kV/m", effect: "Damages vehicle electronics, grid control systems", yield_kt: 100 },
                { label: "W88 · 475kt",      e1: "~29 kV/m", effect: "Destroys civilian infrastructure, unhardened military", yield_kt: 475 },
                { label: "B83 · 1.2Mt",      e1: "~46 kV/m", effect: "Damages lightly hardened military systems", yield_kt: 1200 },
                { label: "Tsar Bomba · 50Mt", e1: "~200 kV/m", effect: "Destroys hardened systems, Faraday-caged equipment", yield_kt: 50000 },
              ].map((p) => (
                <button key={p.label} onClick={() => {
                  setNukeYield(p.yield_kt);
                }}
                  style={{ padding: "9px 12px", background: nukeYield === p.yield_kt ? "#1e0a3c" : "#0f0a2a", border: nukeYield === p.yield_kt ? "1px solid #7c3aed" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 8, textAlign: "left", width: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: nukeYield === p.yield_kt ? "#c4b5fd" : "#94a3b8" }}>{p.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed" }}>{p.e1}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{p.effect}</div>
                </button>
              ))}
            </div>
            </>
          ) : (
            <>
              <div className={isMobile ? "fm-presets-mobile" : "fm-presets-desktop"} style={{ marginBottom: 12 }}>
                {NUKE_PRESETS.map((p) => (
                  <button key={p.label} onClick={() => { setNukeYield(p.yield_kt); }}
                    style={{ padding: "10px 8px", minHeight: 48, border: "1px solid #d1d5db", background: nukeYield === p.yield_kt ? "#7c3aed" : "white", color: nukeYield === p.yield_kt ? "white" : "#111827", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 13, position: "relative" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:4 }}>
                      <span style={{ whiteSpace:"nowrap" }}>{p.label}</span>
                      {p.wiki && <span onClick={(e) => { e.stopPropagation(); setScenarioWiki({ title: p.label, icon: "☢️", body: p.wiki }); }} style={{ fontSize: 11, cursor: "pointer", opacity: 0.7 }}>ℹ️</span>}
                    </div>
                  </button>
                ))}
              </div>
              {proTier !== "free" ? (<>
                <input type="range" min="0.001" max="50000" step="1" value={nukeYield}
                  onChange={(e) => {
                    const maxY = proTier !== "free" ? PRO_MAX_NUKE_YIELD_KT : FREE_MAX_NUKE_YIELD_KT;
                    const val = Number(e.target.value);
                    if (proTier === "free" && val > FREE_MAX_NUKE_YIELD_KT) { setPaywallModal("pro"); return; }
                    setNukeYield(Math.min(val, maxY));
                  }}
                  style={{ width: "100%", marginBottom: 6, cursor: "pointer" }} />
                <div style={{ fontSize: 13, marginBottom: proTier === "free" ? 4 : 12, color: "#64748b" }}>
                  Yield: <b>{nukeYield >= 1000 ? (nukeYield/1000).toFixed(2)+" Mt" : nukeYield+" kt"}</b>
                </div>
                {proTier === "free" && (
                  <div onClick={() => setPaywallModal("pro")} style={{ fontSize: 11, color: "#f97316", marginBottom: 10, cursor: "pointer", padding: "5px 8px", background: "#1a0d00", border: "1px solid #7c2d00", borderRadius: 6 }}>
                    🔒 Free cap: 1 Mt — <span style={{ color: "#fb923c", textDecoration: "underline" }}>Pro unlocks 100 Mt</span>
                  </div>
                )}
              </>) : (
                <button onClick={() => setPaywallModal("pro")} style={{ width: "100%", padding: "10px 14px", marginBottom: 12, background: "#0f172a", border: "1px solid #1e2d45", borderRadius: 8, color: "#475569", cursor: "pointer", textAlign: "left", fontSize: 12 }}>
                  🔒 Custom yield — <span style={{ color: "#7c3aed" }}>Pro</span>
                </button>
              )}
            </>
          )}

          {nukeSubMode === "detonate" && (<>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, letterSpacing: "0.1em", color: "#f97316", textTransform: "uppercase" }}>Burst Type</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button onClick={() => setNukeBurst("airburst")}
              style={{ flex: 1, padding: "11px 8px", minHeight: 44, border: "1px solid #d1d5db", background: nukeBurst === "airburst" ? "#7c3aed" : "#111827", color: nukeBurst === "airburst" ? "white" : "#94a3b8", border: nukeBurst === "airburst" ? "1px solid #7c3aed" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 14 }}>
              Airburst
            </button>
            <button onClick={() => setNukeBurst("surface")}
              style={{ flex: 1, padding: "11px 8px", minHeight: 44, border: "1px solid #d1d5db", background: nukeBurst === "surface" ? "#7c3aed" : "#111827", color: nukeBurst === "surface" ? "white" : "#94a3b8", border: nukeBurst === "surface" ? "1px solid #7c3aed" : "1px solid #1e2d45", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 14 }}>
              Surface
            </button>
          </div>

          {nukeBurst === "surface" && (
            <>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>WIND DIRECTION</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                {/* Compass arrow — rotates to show fallout direction (wind + 180) */}
                <div style={{ flexShrink: 0, width: 52, height: 52, borderRadius: "50%", background: "#0f172a", border: "2px solid #334155", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  {/* Cardinal labels */}
                  <span style={{ position: "absolute", top: 3, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#64748b", fontWeight: 700 }}>N</span>
                  <span style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#64748b", fontWeight: 700 }}>S</span>
                  <span style={{ position: "absolute", left: 3, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: "#64748b", fontWeight: 700 }}>W</span>
                  <span style={{ position: "absolute", right: 3, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: "#64748b", fontWeight: 700 }}>E</span>
                  {/* Arrow pointing in fallout direction */}
                  <div style={{
                    width: 0, height: 0,
                    transform: `rotate(${nukeWindDeg}deg)`,
                    transition: "transform 0.1s ease",
                    position: "relative", display: "flex", flexDirection: "column", alignItems: "center",
                  }}>
                    {/* Arrowhead (fallout direction = wind + 180, so arrow points FROM wind source) */}
                    <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "12px solid #84cc16" }} />
                    <div style={{ width: 2, height: 12, background: "#84cc16" }} />
                    <div style={{ width: 2, height: 4, background: "#ef4444" }} />
                    <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "8px solid #ef4444" }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#555" }}>Wind FROM <b style={{ color: "#111" }}>{nukeWindDeg}°</b></div>
                  <div style={{ fontSize: 12, color: "#84cc16", fontWeight: 700 }}>↑ Fallout → {Math.round((nukeWindDeg + 180) % 360)}°</div>
                </div>
              </div>
              <input type="range" min="0" max="359" step="1" value={nukeWindDeg}
                onChange={(e) => setNukeWindDeg(Number(e.target.value))}
                style={{ width: "100%", marginBottom: 14, cursor: "pointer" }} />
            </>
          )}
          </>)} {/* end nukeSubMode === "detonate" burst type section */}

          {/* Nuclear war presets — detonate mode only; multi-strike presets require pro */}
          {nukeSubMode === "detonate" && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, letterSpacing: "0.1em", color: "#7c3aed", textTransform: "uppercase" }}>⚡ Conflict Scenarios</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  {
                    label: "🇷🇺→🇺🇸 Russia First Strike",
                    sub: "RS-28 Sarmat MIRVs · 800kt each",
                    yield_kt: 800, burst: "airburst",
                    strikes: [
                      { lat: 38.87, lng: -77.15, name: "Pentagon" },
                      { lat: 41.07, lng: -95.91, name: "Offutt AFB" },
                      { lat: 40.71, lng: -74.01, name: "New York" },
                      { lat: 47.87, lng: -117.56, name: "Fairchild AFB" },
                      { lat: 34.05, lng: -118.24, name: "Los Angeles" },
                    ]
                  },
                  {
                    label: "🇺🇸→🇷🇺 US Retaliation",
                    sub: "W88 Trident MIRVs · 475kt each",
                    yield_kt: 475, burst: "airburst",
                    strikes: [
                      { lat: 55.75, lng: 37.62, name: "Moscow" },
                      { lat: 59.95, lng: 30.32, name: "St Petersburg" },
                      { lat: 56.85, lng: 60.60, name: "Yekaterinburg" },
                      { lat: 54.99, lng: 82.90, name: "Novosibirsk" },
                      { lat: 43.11, lng: 131.90, name: "Vladivostok" },
                    ]
                  },
                  {
                    label: "☢️ Full Annihilation",
                    sub: "Both sides · simultaneous · 475–800kt",
                    yield_kt: 600, burst: "airburst",
                    strikes: [
                      { lat: 55.75, lng: 37.62, name: "Moscow" },
                      { lat: 40.71, lng: -74.01, name: "New York" },
                      { lat: 38.91, lng: -77.04, name: "Washington DC" },
                      { lat: 59.95, lng: 30.32, name: "St Petersburg" },
                      { lat: 34.05, lng: -118.24, name: "Los Angeles" },
                    ]
                  },
                  {
                    label: "🇵🇰↔🇮🇳 Kashmir Escalation",
                    sub: "Shaheen-III / Agni-V · 45kt each",
                    yield_kt: 45, burst: "airburst",
                    strikes: [
                      { lat: 33.72, lng: 73.06, name: "Islamabad" },
                      { lat: 31.55, lng: 74.34, name: "Lahore" },
                      { lat: 28.61, lng: 77.21, name: "New Delhi" },
                      { lat: 19.08, lng: 72.88, name: "Mumbai" },
                      { lat: 22.57, lng: 88.36, name: "Kolkata" },
                    ]
                  },
                  {
                    label: "🇰🇵 NK Strikes Seoul & Tokyo",
                    sub: "Hwasong-17 · 250kt each",
                    yield_kt: 250, burst: "airburst",
                    strikes: [
                      { lat: 37.57, lng: 126.98, name: "Seoul" },
                      { lat: 37.45, lng: 126.89, name: "Incheon" },
                      { lat: 35.69, lng: 139.69, name: "Tokyo" },
                      { lat: 34.69, lng: 135.50, name: "Osaka" },
                      { lat: 37.39, lng: 127.05, name: "US Forces Korea" },
                    ]
                  },
                ].map(preset => (
                  <button key={preset.label} onClick={() => {
                    clearNuke();
                    setNukeYield(preset.yield_kt);
                    setNukeBurst(preset.burst);
                    const map = mapRef.current;
                    if (!map) return;
                    preset.strikes.forEach((s, i) => {
                      const el = document.createElement("div");
                      el.style.cssText = "width:22px;height:22px;border-radius:50%;background:#7c3aed;border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.5);";
                      el.innerText = i + 1;
                      const marker = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat([s.lng, s.lat]).addTo(map);
                      const strike = { lat: s.lat, lng: s.lng, marker, idx: i };
                      el.addEventListener("click", (ev) => {
                        ev.stopPropagation();
                        strike.marker.remove();
                        nukeStrikesRef.current = nukeStrikesRef.current.filter(x => x !== strike);
                        setNukeStrikes([...nukeStrikesRef.current]);
                        setNukePointSet(nukeStrikesRef.current.length > 0);
                      });
                      nukeStrikesRef.current.push(strike);
                    });
                    setNukeStrikes([...nukeStrikesRef.current]);
                    setNukePointSet(true);
                    setStatus(`${preset.strikes.length} targets loaded · ${preset.yield_kt >= 1000 ? (preset.yield_kt/1000).toFixed(1)+"Mt" : preset.yield_kt+"kt"} — detonate when ready`);
                  }}
                  style={{ padding: "8px 10px", fontWeight: 700, background: "#0f172a", color: "#a78bfa", border: "1px solid #312e81", borderRadius: 8, cursor: "pointer", textAlign: "left", lineHeight: 1.5 }}>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{preset.label}</div>
                    <div style={{ fontSize: 10, color: "#6d6d9e", marginTop: 1 }}>{preset.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Strike queue */}
          {nukeStrikes.length > 0 && (
            <div style={{ marginBottom: 12, padding: "8px 10px", background: "#0f172a", borderRadius: 8, border: "1px solid #1e2d45" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6, fontWeight: 700 }}>
                {nukeStrikes.length}/{nukeSubMode === "emp" ? 1 : proTier !== "free" ? MAX_NUKE_STRIKES : 1} STRIKE{nukeStrikes.length > 1 ? "S" : ""} QUEUED
              </div>
              {nukeStrikes.map((s, i) => (
                <div key={i} style={{ fontSize: 11, color: "#cbd5e1", display: "flex", justifyContent: "space-between" }}>
                  <span>#{i+1} {s.lat.toFixed(2)}°, {s.lng.toFixed(2)}°</span>
                  <span style={{ color: "#ef4444", cursor: "pointer" }} onClick={() => {
                    s.marker.remove();
                    nukeStrikesRef.current = nukeStrikesRef.current.filter(x => x !== s);
                    setNukeStrikes([...nukeStrikesRef.current]);
                    setNukePointSet(nukeStrikesRef.current.length > 0);
                  }}>✕</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button onClick={nukeSubMode === "emp" ? runEmp : runNuke}
              disabled={!nukePointSet || nukeLoading || empLoading}
              style={{ flex: 1, padding: "14px 10px", minHeight: 52, background: "#7c3aed", color: "white", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 15, opacity: !nukePointSet || nukeLoading || empLoading ? 0.65 : 1 }}>
              {nukeSubMode === "emp"
                ? (empLoading ? "Computing..." : "⚡ Launch EMP")
                : (nukeLoading ? "Detonating..." : `☢️ Detonate${nukeStrikes.length > 1 ? ` (${nukeStrikes.length})` : ""}`)}
            </button>
            <button onClick={clearNuke}
              style={{ flex: 1, padding: "14px 10px", minHeight: 52, background: "#1e293b", color: "#e2e8f0", border: "1px solid #1e2d45", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 15 }}>
              Clear
            </button>
          </div>

          {nukeError && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{nukeError}</div>}
        </>
      )}

      {/* Cataclysm controls */}
      {scenarioMode === "cataclysm" && (
        <>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: "0.1em", color: "#ef4444", textTransform: "uppercase" }}>Model</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { key: "davidson", label: "Ben Davidson", sub: "Suspicious Observers" },
              { key: "tes", label: "Ethical Skeptic", sub: "ECDO Theory" },
            ].map(({ key, label, sub }) => (
              <button key={key}
                onClick={() => { cataclysmModelRef.current = key; setCataclysmModel(key); clearCataclysm(); }}
                style={{ padding: "10px 8px", minHeight: 56, border: cataclysmModel === key ? "1px solid #dc2626" : "1px solid #1e2d45", background: cataclysmModel === key ? "#1a0505" : "#111827", color: cataclysmModel === key ? "#f87171" : "#94a3b8", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 11, textAlign: "center" }}>
                <div>{label}</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{sub}</div>
              </button>
            ))}
          </div>
          {/* Younger Dryas Impact */}
          <button
            onClick={() => { cataclysmModelRef.current = "ydi"; setCataclysmModel("ydi"); clearCataclysm(); }}
            style={{ width: "100%", padding: "10px 14px", minHeight: 52, marginBottom: 14, border: cataclysmModel === "ydi" ? "1px solid #0ea5e9" : "1px solid #1e2d45", background: cataclysmModel === "ydi" ? "#0c1a2e" : "#111827", color: cataclysmModel === "ydi" ? "#38bdf8" : "#94a3b8", borderRadius: 10, fontWeight: 700, fontSize: 12, textAlign: "left", cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>☄️ Younger Dryas Impact</span>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                {cataclysmModel === "ydi" && <span style={{ fontSize: 10, color: "#38bdf8", fontWeight: 700, background: "#0c1a2e", border: "1px solid #38bdf8", borderRadius: 6, padding: "2px 7px" }}>SELECTED</span>}
                <button onClick={(e) => { e.stopPropagation(); setScenarioWiki(SCENARIO_WIKI["ydi"]); }} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:13, padding:"0 2px" }}>ℹ️</button>
              </div>
            </div>
            <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>~12,900 BP · Laurentide collapse · Columbia Scablands</div>
          </button>
          {cataclysmModel !== "ydi" && (
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12, fontStyle: "italic", lineHeight: 1.5 }}>
                {cataclysmModel === "davidson"
                  ? "~90° crustal displacement. New pole: Bay of Bengal. Americas flood 500-800m. Himalayas become new polar region."
                  : "104° rotation along 31°E meridian. New pole: S. Africa. Global inundation 120-1200m. Based on TES ECDO Theory."}
              </div>
              <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, lineHeight: 1.4 }}>
                ⚠ Theoretical model. Globe rotates to show displacement, then flood tiles render.
              </div>
            </div>
          )}
          {cataclysmModel === "ydi" && (
            <div>
              <div style={{ fontSize: 11, color: "#38bdf8", marginBottom: 8, lineHeight: 1.5 }}>
                Laurentide & Cordilleran ice sheets at ~12,900 BP extent, with ice-free corridor visible. Flood corridors show meltwater drainage through Columbia Scablands, Mississippi basin, and St. Lawrence outlet.
              </div>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, letterSpacing: "0.1em", color: "#38bdf8", textTransform: "uppercase" }}>Flood Scale</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
                {[
                  { key: "low",    label: "Low",    sub: "~80m" },
                  { key: "medium", label: "Medium", sub: "~200m" },
                  { key: "high",   label: "High",   sub: "~400m" },
                ].map(({ key, label, sub }) => (
                  <button key={key}
                    onClick={() => { setYdiIntensity(key); ydiIntensityRef.current = key; }}
                    style={{ padding: "9px 6px", border: ydiIntensity === key ? "1px solid #0ea5e9" : "1px solid #1e2d45", background: ydiIntensity === key ? "#0c2a4a" : "#111827", color: ydiIntensity === key ? "#38bdf8" : "#94a3b8", cursor: "pointer", borderRadius: 8, fontWeight: 700, fontSize: 12, textAlign: "center" }}>
                    <div>{label}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>{sub}</div>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "#475569", marginBottom: 12, fontStyle: "italic" }}>
                Controls flood extent and basin fill. Not a physical water volume.
              </div>
            </div>
          )}

          {cataclysmActive && (
            <>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, letterSpacing: "0.1em", color: "#ef4444", textTransform: "uppercase" }}>Overlay</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
                {[
                  { key: "flood", label: "🌊 Flood", pro: false },
                  { key: "wind",  label: "💨 Wind",  pro: true  },
                  { key: "both",  label: "⚡ Both",  pro: true  },
                ].map(({ key, label, pro }) => (
                  <button key={key}
                    onClick={() => {
                      if (pro && proTier === "free") { setPaywallModal("pro"); return; }
                      setCataclysmOverlay(key);
                      const map = mapRef.current;
                      if (map) applyCataclysmOverlay(map, cataclysmModelRef.current, key);
                    }}
                    style={{ padding: "8px 4px", border: cataclysmOverlay === key ? "1px solid #dc2626" : "1px solid #1e2d45", background: cataclysmOverlay === key ? "#1a0505" : "#111827", color: cataclysmOverlay === key ? "#f87171" : pro && proTier === "free" ? "#4b5563" : "#64748b", cursor: "pointer", borderRadius: 8, fontWeight: 700, fontSize: 12, position: "relative" }}>
                    {pro && proTier === "free" ? "🔒 " : ""}{label}
                  </button>
                ))}
              </div>
            </>
          )}
          {cataclysmActive && proTier === "free" && (
            <div onClick={() => setPaywallModal("pro")} style={{ fontSize: 11, color: "#f97316", marginBottom: 8, textAlign: "center", padding: "6px 8px", border: "1px solid #431407", borderRadius: 6, background: "#1a0a02", cursor: "pointer" }}>
              🔒 <strong>Pro</strong> — unlock Wind &amp; Both overlays + zoom &amp; pan to explore the new world
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              onClick={cataclysmModel === "ydi" ? () => triggerYDI(ydiIntensityRef.current) : triggerCataclysm}
              disabled={cataclysmAnimating}
              style={{ flex: 1, padding: "13px 10px", minHeight: 48, background: cataclysmModel === "ydi" ? "#0369a1" : "#dc2626", color: "white", border: "none", fontWeight: 700, cursor: cataclysmAnimating ? "not-allowed" : "pointer", borderRadius: 8, fontSize: 15, opacity: cataclysmAnimating ? 0.65 : 1 }}>
              {cataclysmModel === "ydi" ? "🌊 Run Flood" : cataclysmAnimating ? "Displacing…" : "☄️ Trigger"}
            </button>
            <button
              onClick={clearCataclysm}
              style={{ padding: "13px 16px", minHeight: 48, background: "transparent", color: "#64748b", border: "1px solid #1e2d45", fontWeight: 700, cursor: "pointer", borderRadius: 8, fontSize: 15 }}>
              Clear
            </button>
          </div>
        </>
      )}

      {scenarioMode === "yellowstone" && (
        <>
          {/* Volcano overlay toggle */}
          <div onClick={() => {
            const next = !volcanoOn;
            setVolcanoOn(next); volcanoOnRef.current = next;
            next ? addVolcanoes() : removeVolcanoes();
          }} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 10px", marginBottom:12,
            borderRadius:9, cursor:"pointer",
            background: volcanoOn ? "rgba(255,69,0,0.12)" : "rgba(255,255,255,0.03)",
            border: volcanoOn ? "1px solid rgba(255,69,0,0.4)" : "1px solid #1e2d45",
          }}>
            <span style={{ fontSize:18 }}>🌋</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color: volcanoOn ? "#ff6600" : "#cbd5e1" }}>Show All Volcanoes</div>
              <div style={{ fontSize:10, color:"#475569", marginTop:1 }}>
                {volcanoOn ? "Click any volcano to simulate eruption" : "1,215 Holocene volcanoes · click to erupt"}
              </div>
            </div>
            <div style={{ width:28, height:16, borderRadius:8, background: volcanoOn ? "#ff4500" : "#1e2d45", position:"relative", flexShrink:0, transition:"background 0.2s" }}>
              <div style={{ position:"absolute", top:2, left: volcanoOn ? 14 : 2, width:12, height:12, borderRadius:"50%", background:"white", transition:"left 0.2s" }} />
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: "0.1em", color: "#ea580c", textTransform: "uppercase" }}>⚠ Supervolcano Presets</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            {[
              { key: "yellowstone", label: "Yellowstone", sub: "Wyoming" },
              { key: "toba", label: "Toba", sub: "Sumatra" },
              { key: "campi", label: "Campi Flegrei", sub: "Naples" },
            ].map(({ key, label, sub }) => (
              <button key={key} onClick={() => { volcanoTypeRef.current = key; setVolcanoType(key); setYellowstonePreset(0); clearYellowstone(); }}
                style={{ padding: "10px 6px", minHeight: 52, border: volcanoType === key ? "1px solid #ea580c" : "1px solid #1e2d45", background: volcanoType === key ? "#431407" : "#111827", color: volcanoType === key ? "#fb923c" : "#94a3b8", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 11, textAlign: "center" }}>
                <div>{label}</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{sub}</div>
              </button>
            ))}
          </div>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, letterSpacing: "0.1em", color: "#ea580c", textTransform: "uppercase" }}>Eruption</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            {(volcanoType === "yellowstone" ? YELLOWSTONE_PRESETS : volcanoType === "toba" ? TOBA_PRESETS : CAMPI_PRESETS).map((p, i) => (
              <button key={p.label} onClick={() => { setYellowstonePreset(i); clearYellowstone(); }}
                style={{ padding: "10px 6px", minHeight: 52, border: yellowstonePreset === i ? "1px solid #ea580c" : "1px solid #1e2d45", background: yellowstonePreset === i ? "#431407" : "#111827", color: yellowstonePreset === i ? "#fb923c" : "#94a3b8", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 12, textAlign: "center", position: "relative" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                  <span>{p.label}</span>
                  {p.wiki && <span onClick={(e) => { e.stopPropagation(); setScenarioWiki({ title: p.label + " — " + (p.name||""), icon: "🌋", body: p.wiki }); }} style={{ fontSize: 11, cursor: "pointer", opacity: 0.7 }}>ℹ️</span>}
                </div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>VEI {p.vei}</div>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <button onClick={() => { window.__dmLastEruptResult = null; drawYellowstone(yellowstonePreset); }}
              style={{ flex: 1, padding: "12px", background: "#ea580c", color: "white", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              🌋 Erupt
            </button>
            <button onClick={clearYellowstone}
              style={{ flex: 1, padding: "12px", background: "#1e293b", color: "#e2e8f0", border: "1px solid #1e2d45", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              Clear
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>Click map to see ash depth and survival context</div>
          <hr style={{ margin: "0 0 16px 0", borderColor: "#1e2d45" }} />
        </>
      )}

      {scenarioMode === "tsunami" && (
        <>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: "0.1em", color: "#0ea5e9", textTransform: "uppercase" }}>Wave Source</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {TSUNAMI_SOURCES.map((s, i) => (
              <button key={s.label} onClick={() => { setTsunamiSource(i); tsunamiSourceRef.current = i; clearTsunami(); }}
                style={{ padding: "10px 6px", minHeight: 52, border: tsunamiSource === i ? "1px solid #0ea5e9" : "1px solid #1e2d45", background: tsunamiSource === i ? "#0c2a4a" : "#111827", color: tsunamiSource === i ? "#38bdf8" : "#94a3b8", cursor: "pointer", borderRadius: 10, fontWeight: 700, fontSize: 12, textAlign: "center" }}>
                <div>{s.label}</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>Max {s.maxWaveM}m</div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>{TSUNAMI_SOURCES[tsunamiSource].threat}</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <button onClick={() => { tsunamiSourceRef.current = tsunamiSource; drawTsunami(tsunamiSource); }}
              style={{ flex: 1, padding: "12px", background: "#0ea5e9", color: "white", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              🌊 Trigger
            </button>
            <button onClick={clearTsunami}
              style={{ flex: 1, padding: "12px", background: "#1e293b", color: "#e2e8f0", border: "1px solid #1e2d45", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              Clear
            </button>
          </div>
          <div style={{ marginBottom: 14 }}>
            {TSUNAMI_SOURCES[tsunamiSource].rings.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>⏱ {r.label}</span>
                <span style={{ fontSize: 12, color: "#0ea5e9" }}>~{r.waveM}m waves</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>Click map for wave arrival time</div>
          <hr style={{ margin: "0 0 16px 0", borderColor: "#1e2d45" }} />
        </>
      )}

      {/* ── SUPPORT ── */}
      <div style={{ borderTop: "1px solid #1e2d45", paddingTop: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, letterSpacing: "0.1em", color: "#475569", textTransform: "uppercase" }}>Support</div>
        {!supportFormOpen ? (
          <div style={{ display: "flex", gap: 8 }}>
            <a href="https://x.com/grimerica" target="_blank"
              style={{ flex: 1, display: "block", textAlign: "center", padding: "8px", background: "#111827", color: "#94a3b8", border: "1px solid #1e2d45", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
              𝕏 @grimerica
            </a>
            <button onClick={() => setSupportFormOpen(true)}
              style={{ flex: 1, padding: "8px", background: "#111827", color: "#60a5fa", border: "1px solid #1e3a5f", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              ✉️ Contact
            </button>
          </div>
        ) : (
          <div>
            <input
              type="email"
              placeholder="Your email (required)"
              required
              value={supportEmail}
              onChange={e => setSupportEmail(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", background: "#111827", color: "#e2e8f0", border: `1px solid ${supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail) ? "#ef4444" : "#1e3a5f"}`, borderRadius: 8, fontSize: 12, boxSizing: "border-box", marginBottom: 8, fontFamily: "Arial,sans-serif" }}
            />
            <textarea placeholder="Describe your issue..."
              value={supportMsg} onChange={e => setSupportMsg(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", background: "#111827", color: "#e2e8f0", border: "1px solid #1e3a5f", borderRadius: 8, fontSize: 12, resize: "none", height: 80, boxSizing: "border-box", marginBottom: 8, fontFamily: "Arial,sans-serif" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={async () => {
                if (!supportEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) { setStatus("Please enter a valid email address"); setTimeout(() => setStatus(""), 3000); return; }
                if (!supportMsg.trim()) { setStatus("Please describe your issue"); setTimeout(() => setStatus(""), 3000); return; }
                try {
                  await fetch("https://formspree.io/f/xgopwayn", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: supportEmail, message: supportMsg, source: "DisasterMap app" })
                  });
                  setSupportMsg("");
                  setSupportEmail("");
                  setSupportFormOpen(false);
                  setStatus("Message sent! We'll get back to you.");
                  setTimeout(() => setStatus(""), 4000);
                } catch(e) {
                  setStatus("Failed to send — try 𝕏 @grimerica");
                  setTimeout(() => setStatus(""), 4000);
                }
              }} style={{ flex: 1, padding: "8px", background: "#1e3a5f", color: "#60a5fa", border: "1px solid #3b82f6", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Send
              </button>
              <button onClick={() => { setSupportFormOpen(false); setSupportMsg(""); setSupportEmail(""); }}
                style={{ padding: "8px 12px", background: "transparent", color: "#475569", border: "1px solid #1e2d45", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MAP OVERLAYS ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: "0.1em", color: "#d97706", textTransform: "uppercase" }}>Map Overlays</div>
        {Object.entries(OVL).map(([type, cfg]) => {
          const isOn = { megaliths: megalithOn, unesco: unescoOn, airports: airportOn, nuclear: nuclearOn, fires: fireOn }[type];
          const locked = cfg.proOnly && proTier === "free";
          return (
            <div key={type}
              onClick={() => {
                if (locked) { window.open("https://buy.stripe.com/8x23cv7eE9w62qa6vra3u09", "_blank"); return; }
                toggleOverlay(type);
              }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", marginBottom: 4, borderRadius: 9,
                cursor: "pointer",
                background: isOn ? `rgba(${type==="megaliths"?"217,119,6":type==="unesco"?"168,85,247":type==="airports"?"34,211,238":type==="nuclear"?"74,222,128":"255,69,0"},0.12)` : "rgba(255,255,255,0.03)",
                border: isOn ? `1px solid ${cfg.color}55` : "1px solid transparent",
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{cfg.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isOn ? cfg.color : locked ? "#4b5563" : "#cbd5e1" }}>
                  {cfg.label}{locked && <span style={{ marginLeft: 6, fontSize: 10, color: "#f97316" }}>PRO</span>}
                </div>
                <div style={{ fontSize: 10, color: locked ? "#374151" : "#475569", marginTop: 1 }}>
                  {type === "megaliths" && (megalithOn ? (megalithLoading ? "Loading 100k+ sites..." : "100,000+ sites · worldwide") : "100,000+ sites · worldwide")}
                  {type === "unesco"    && "World Heritage Sites"}
                  {type === "airports"  && (locked ? "Upgrade to Pro" : "Major & regional airports")}
                  {type === "nuclear"   && (locked ? "Upgrade to Pro" : "Active nuclear plants")}
                  {type === "fires"     && "NASA FIRMS VIIRS · updated 24h"}
                </div>
              </div>
              <div style={{ width: 28, height: 16, borderRadius: 8, background: isOn ? cfg.color : "#1e2d45", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                <div style={{ position: "absolute", top: 2, left: isOn ? 14 : 2, width: 12, height: 12, borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── VIEW MODE ── */}
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: "0.1em", color: "#f97316", textTransform: "uppercase" }}>View Mode</div>
      <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
        {[
          { key: "map", label: "Standard Map", sub: "Flood tiles active", pro: false },
          { key: "satellite", label: "Satellite View", sub: "Pro feature 🔒", pro: true },
        ].map(({ key, label, sub, pro }) => (
          <button
            key={key}
            onClick={() => { if (pro && proTier === "free") { setPaywallModal("pro"); return; } setViewMode(key); }}
            style={{ width: "100%", padding: "13px 14px", minHeight: 56, border: "1px solid #d1d5db", background: viewMode === key ? "#0f172a" : "white", color: viewMode === key ? "white" : "#111827", cursor: "pointer", borderRadius: 12, fontWeight: 700, textAlign: "left" }}>
            <div style={{ fontSize: 15 }}>{label}</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>{sub}</div>
          </button>
        ))}
      </div>
    </>
  );

  // ─── Stats panel content ───────────────────────────────────────────────────
  const statsContent = (
    <>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Current Scenario</div>
      <div style={{ color: "#facc15", fontWeight: 700 }}>Something not looking right? Hard refresh: Ctrl+Shift+R / Cmd+Shift+R</div>
      {(scenarioMode === "flood" || scenarioMode === "climate") && <div>Sea level: {formatLevelForDisplay(seaLevel)}</div>}
      {(scenarioMode === "flood" || scenarioMode === "climate") && seaLevel !== 0 && (
        <div style={{ fontWeight: 700, marginTop: 2 }}>
          {proTier !== "free"
            ? floodDisplaced != null
              ? <span style={{ color: "#fca5a5" }}>Displaced: {floodDisplaced.toLocaleString()}</span>
              : <span style={{ color: "#475569" }}>Displaced: loading...</span>
            : <span style={{ color: "#f97316", cursor: "pointer" }} onClick={() => setPaywallModal("pro")}>
                🔒 Displaced count — Pro only
              </span>
          }
        </div>
      )}
      <div>Mode: {viewMode === "map" ? "Standard Map" : viewMode === "satellite" ? "Satellite" : "Globe"}</div>
      <div>Status: {status}</div>
      <div>Scenario Mode: {scenarioMode}</div>
      {scenarioMode === "impact" && <div>Impact Point: {impactPointRef.current ? `${impactPointRef.current.lng.toFixed(3)}, ${impactPointRef.current.lat.toFixed(3)}` : "--"}</div>}
      {scenarioMode === "impact" && <div>Asteroid Diameter: {impactDiameter.toLocaleString()} m</div>}

      {/* Earthquake results in right panel */}
      {scenarioMode === "earthquake" && eqResult && (<>
        <hr style={{ margin:"10px 0", opacity:0.25 }} />
        <div style={{ fontWeight:700, marginBottom:4, color:"#fbbf24" }}>🌍 M{eqResult.mag.toFixed(1)} — {eqResult.depthType.label}</div>
        <div style={{ fontSize:11, color:"#64748b", marginBottom:8 }}>{eqResult.faultType.label} fault</div>
        {eqResult.rings.map(r => (
          <div key={r.intensity} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:r.color, flexShrink:0 }} />
            <span style={{ fontSize:11 }}><b style={{ color:r.color }}>MMI {r.intensity}</b> {r.label}</span>
            <span style={{ fontSize:10, color:"#475569", marginLeft:"auto" }}>~{Math.round(r.radiusKm)}km</span>
          </div>
        ))}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2, marginBottom:8 }}>
          <div style={{ width:10, height:10, borderRadius:2, background:"#0d9488", flexShrink:0 }} />
          <span style={{ fontSize:11, color:"#0d9488" }}>Liquefaction zone</span>
          <span style={{ fontSize:10, color:"#475569", marginLeft:"auto" }}>~{Math.round(eqResult.liqRadiusKm)}km</span>
        </div>
        <div style={{ fontSize:12, color:"#94a3b8" }}>💀 {(() => {
          const preset = EQ_PRESETS.find(p => Math.abs(p.lat - (eqPointRef.current?.lat||0)) < 0.1 && Math.abs(p.lng - (eqPointRef.current?.lng||0)) < 0.1);
          const historical = { "Tohoku 2011":"15,897 confirmed dead", "Indian Ocean 2004":"227,898 dead across 14 countries", "Valdivia 1960":"5,700 dead — Chile, Hawaii, Japan", "Cascadia (Scenario)":"FEMA est. 13,000+ dead" };
          const real = preset && historical[preset.label];
          return real ? <><b style={{ color:"#fbbf24" }}>{real}</b> <span style={{fontSize:10,color:"#475569"}}>(historical)</span></> : <>Est. casualties: <b style={{ color:"#fbbf24" }}>{eqResult.casualties}</b></>;
        })()}</div>
        {eqResult.tsunamiRisk && (
          <div style={{ marginTop:6, fontSize:11, color:"#38bdf8" }}>
            🌊 {eqResult.isPro ? "Tsunami inundation active" : "🔒 Tsunami — Pro only"}
          </div>
        )}
      </>)}

      {/* Wildfire legend in right panel — climate mode only */}
      {scenarioMode === "climate" && activeWarmingLevel && (
        <>
          <hr style={{ margin: "10px 0", opacity: 0.25 }} />
          <div style={{ fontWeight: 700, marginBottom: 6 }}>🔥 Wildfire Risk Zones</div>
          {[
            { color: "#f97316", label: "1.5°C", desc: "Current trajectory" },
            { color: "#ef4444", label: "2°C", desc: "Moderate warming" },
            { color: "#dc2626", label: "3°C", desc: "High warming" },
            { color: "#b91c1c", label: "4°C", desc: "Catastrophic" },
          ].filter(l => {
            const levelMap = { "#f97316": 1.5, "#ef4444": 2.0, "#dc2626": 3.0, "#b91c1c": 4.0 };
            return levelMap[l.color] <= (activeWarmingLevel || 0);
          }).map(l => (
            <div key={l.color} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: l.color, opacity: 0.8, flexShrink: 0 }} />
              <span><b style={{ color: l.color }}>{l.label}</b> — {l.desc}</span>
            </div>
          ))}
        </>
      )}

      {scenarioMode === "climate" && activeWarmingLevel && (() => {
        const CS = {
          1.5: { coral: "70-90%", arctic: "once per century", drought: "1.7×", flood: "100M+", species: "6%", label: "1.5°C — Paris Agreement limit" },
          2.0: { coral: "99%", arctic: "once per decade", drought: "2.4×", flood: "130M+", species: "13%", label: "2°C — significant ecosystem disruption" },
          3.0: { coral: "virtually all", arctic: "yearly summers", drought: "4×", flood: "280M+", species: "29%", label: "3°C — catastrophic irreversible changes" },
          4.0: { coral: "functionally extinct", arctic: "ice-free year-round", drought: "6×", flood: "600M+", species: "49%", label: "4°C — civilisation-level disruption" },
        };
        const s = CS[activeWarmingLevel];
        if (!s) return null;
        return (
          <>
            <hr style={{ margin: "10px 0", opacity: 0.25 }} />
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: "#22c55e" }}>🌡️ {s.label}</div>
            {[
              { label: "Coral reef loss", val: s.coral, color: "#f97316" },
              { label: "Ice-free Arctic", val: s.arctic, color: "#38bdf8" },
              { label: "Drought intensity", val: s.drought, color: "#f59e0b" },
              { label: "At-risk population", val: s.flood, color: "#3b82f6" },
              { label: "Species threatened", val: s.species, color: "#a78bfa" },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>{r.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{r.val}</span>
              </div>
            ))}
          </>
        );
      })()}

      {impactError && (
        <>
          <hr style={{ margin: "10px 0", opacity: 0.25 }} />
          <div style={{ color: "#fecaca", fontWeight: 700 }}>{impactError}</div>
        </>
      )}

      {impactResult && scenarioMode !== "tsunami" && (
        <>
          <hr style={{ margin: "10px 0", opacity: 0.25 }} />
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            💥 {impactResult._count > 1 ? `${impactResult._count} Impact Results` : "Impact Results"}
          </div>
          {impactResult._count > 1 ? (
            // Multi-impact: show per-impact summary
            impactResult._results.map((r, i) => (
              <div key={i} style={{ marginBottom: 6, padding: "6px 8px", background: "#0f0a0a", borderRadius: 6, border: "1px solid #3f1515" }}>
                <div style={{ fontSize: 11, color: "#f97316", fontWeight: 700, marginBottom: 2 }}>Impact {i+1} · {Number(r.energy_mt_tnt ?? 0).toFixed(1)} Mt · {r.severity_class}</div>
                {r.is_ocean_impact ? (
                  <div style={{ fontSize: 11, color: "#60a5fa" }}>🌊 Ocean · {Math.round(r.wave_height_m ?? 0).toLocaleString()}m wave · {Math.round((r.estimated_wave_reach_m ?? 0)/1000).toLocaleString()}km reach</div>
                ) : (
                  <div style={{ fontSize: 11, color: "#fde047" }}>🏔 Land · Crater {Math.round(r.crater_diameter_m ?? 0).toLocaleString()}m</div>
                )}
              </div>
            ))
          ) : (
            // Single impact: full detail
            <>
              <div>Energy: {Number(impactResult.energy_mt_tnt ?? impactResult.energy_mt ?? 0).toFixed(2)} Mt</div>
              <div style={{ color: "#fde047" }}>● Crater: {Math.round(Number(impactResult.crater_diameter_m ?? 0)).toLocaleString()} m dia</div>
              <div style={{ color: "#b45309" }}>● Ejecta: {Math.round(Number(impactResult.crater_diameter_m ?? 0) * 1.55).toLocaleString()} m</div>
              <div style={{ color: "#ef4444" }}>● Blast: {Math.round(Number(impactResult.blast_radius_m ?? 0)).toLocaleString()} m</div>
              <div style={{ color: "#f97316" }}>● Thermal: {Math.round(Number(impactResult.thermal_radius_m ?? 0)).toLocaleString()} m</div>
              {impactResult.is_ocean_impact === true && Number(impactResult.wave_height_m ?? 0) > 0 && (
                <>
                  <div>Wave Height: {Math.round(Number(impactResult.wave_height_m ?? 0)).toLocaleString()} m</div>
                  {Number(impactResult.wave_height_m ?? 0) < EXTINCTION_WAVE_HEIGHT_M && (
                    <div>Tsunami Reach: {Math.round(Number(impactResult.estimated_wave_reach_m ?? 0) / 1000).toLocaleString()} km</div>
                  )}
                </>
              )}
              <div>Severity: {impactResult.severity_class ?? "--"}</div>
            </>
          )}
          <hr style={{ margin: "8px 0", opacity: 0.2 }} />
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Casualties{impactResult._count > 1 ? " (Combined)" : ""}</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Population exposed</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{impactResult.population_exposed != null ? formatCompactCount(impactResult.population_exposed) : "—"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Estimated deaths</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>{impactResult.estimated_deaths != null ? formatCompactCount(impactResult.estimated_deaths) : "—"}</span>
          </div>
          {Number(impactResult.blackout_pct ?? 0) > 0 && (
            <div style={{ marginTop: 4, padding: "8px 10px", background: "#0a0a1a", borderRadius: 8, border: "1px solid #1e2d45" }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#a78bfa", marginBottom: 4 }}>🌑 Atmospheric Blackout</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Sunlight reduction</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa" }}>{impactResult.blackout_pct}%</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Duration</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa" }}>{impactResult.blackout_duration_months} months</span>
              </div>
              <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic" }}>{impactResult.blackout_severity}</div>
              {Number(impactResult.famine_deaths_estimate ?? 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTop: "1px solid #1e2d45" }}>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>Est. indirect famine deaths</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#f97316" }}>{formatCompactCount(impactResult.famine_deaths_estimate)}</span>
                </div>
              )}
            </div>
          )}
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>Confidence: low / rough estimate</div>
          {proTier === "free" && (
            <div onClick={() => setPaywallModal("pro")} style={{ fontSize: 11, color: "#f97316", marginTop: 8, cursor: "pointer", padding: "5px 8px", background: "#1a0d00", border: "1px solid #7c2d00", borderRadius: 6, textAlign: "center" }}>
              💥 1 free zone click · <span style={{ color: "#fb923c", textDecoration: "underline" }}>Pro unlocks unlimited</span>
            </div>
          )}
        </>
      )}

      {scenarioMode === "flood" && (
        <>
          <hr style={{ margin: "10px 0", opacity: 0.25 }} />
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Click map to see elevation</div>
        </>
      )}

        {scenarioMode === "cataclysm" && cataclysmActive && (
        <>
          <hr style={{ margin: "10px 0", opacity: 0.25 }} />
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            ☄️ {cataclysmModel === "davidson" ? "Davidson Pole Shift" : "TES ECDO Theory"}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>
            {cataclysmModel === "davidson"
              ? "~90° crustal displacement · New pole: Bay of Bengal · 12hr event"
              : "104° rotation along 31°E · New pole: S. Africa (26°S) · 10-11hr event"}
          </div>
          {CATACLYSM_WIND[cataclysmModel] && (
            <>
              {CATACLYSM_WIND[cataclysmModel].zones.map((z, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: z.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: z.color, fontWeight: 700 }}>{z.name}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: z.survival === "0%" ? "#ef4444" : "#f97316" }}>
                      {z.survival} survival
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2, paddingLeft: 16 }}>{z.speedLabel} — {z.desc}</div>
                </div>
              ))}
            </>
          )}
          <div style={{ fontSize: 11, color: "#475569", marginTop: 4, fontStyle: "italic" }}>
            ⚠ Theoretical model · Click map for zone details
          </div>
        </>
      )}

      {scenarioMode === "tsunami" && tsunamiActive && (
          <>
            <hr style={{ margin: "10px 0", opacity: 0.25 }} />
            <div style={{ fontWeight: 700, marginBottom: 4 }}>🌊 {TSUNAMI_SOURCES[tsunamiSource].name}</div>
            <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>{TSUNAMI_SOURCES[tsunamiSource].desc}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{TSUNAMI_SOURCES[tsunamiSource].threat}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, fontStyle: "italic" }}>⚠ Worst-case scenario estimates</div>
            {tsunamiFloodLevel && (
              <div style={{ fontSize: 12, color: "#0ea5e9", marginBottom: 6 }}>
                🌊 Flood tiles: {tsunamiFloodLevel}m inundation zone
              </div>
            )}
            {tsunamiResult ? (
              <div style={{ padding: "8px 10px", background: "#0c1a2e", borderRadius: 8, border: "1px solid #0ea5e9", marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>Est. deaths</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#ef4444" }}>{tsunamiResult.total_deaths.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>Population exposed</span>
                  <span style={{ fontSize: 12, color: "#cbd5e1" }}>{tsunamiResult.total_population.toLocaleString()}</span>
                </div>
                {tsunamiResult.zones && tsunamiResult.zones.map((z, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>{z.name}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{z.deaths.toLocaleString()} ({z.mortality_pct}%)</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "#475569", marginBottom: 8 }}>Calculating casualties...</div>
            )}
            <div style={{ fontSize: 11, color: "#475569" }}>Click map for wave arrival time</div>
          </>
        )}

      {scenarioMode === "yellowstone" && yellowstoneActive && yellowstoneResult && (() => {
        const _vPresets = volcanoType === "toba" ? TOBA_PRESETS : volcanoType === "campi" ? CAMPI_PRESETS : YELLOWSTONE_PRESETS;
        const _p = _vPresets[Math.min(yellowstonePreset, _vPresets.length - 1)];
        if (!_p) return null;
        // Famine deaths — prefer API result, fallback to frontend calc
        const _famineAPI = Number(yellowstoneResult?.famine_deaths_estimate ?? 0);
        const GLOBAL_POP = 8_100_000_000;
        const _famineFront = (_p.blackout_pct >= 5 && _p.blackout_duration_months >= 1)
          ? Math.round(GLOBAL_POP * Math.pow(_p.blackout_pct / 100, 1.5) * (_p.blackout_duration_months / 12) * 0.15) : 0;
        const _famine = _famineAPI > 0 ? _famineAPI : _famineFront;
        // Blackout data — prefer API result
        const _bPct = yellowstoneResult?.blackout_pct ?? _p.blackout_pct;
        const _bDur = yellowstoneResult?.blackout_duration_months ?? _p.blackout_duration_months;
        const _bSev = yellowstoneResult?.blackout_severity ?? _p.blackout_severity;
        return (
        <>
          <hr style={{ margin: "10px 0", opacity: 0.25 }} />
          <div style={{ fontWeight: 700, marginBottom: 4 }}>🌋 {yellowstoneResult?.name || _p.name}</div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>{yellowstoneResult?.vtype ? `${yellowstoneResult.vtype} — VEI ${yellowstoneResult.vei}` : _p.desc}</div>
          {(yellowstoneResult?.zones || _p.zones).map((z, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: z.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: z.color, fontWeight: 700 }}>{z.name}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: z.survival === "0%" ? "#ef4444" : (z.survival||"").startsWith("1") ? "#f97316" : (z.survival||"").startsWith("5") ? "#fbbf24" : "#4ade80" }}>
                  {z.survival} survival
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2, paddingLeft: 16 }}>{z.desc}</div>
            </div>
          ))}
          {yellowstoneResult ? (
            <div style={{ marginTop: 8, padding: "8px 10px", background: "#1a0a0a", borderRadius: 8, border: "1px solid #7f1d1d" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Est. deaths</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#ef4444" }}>{yellowstoneResult.total_deaths.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Population exposed</span>
                <span style={{ fontSize: 12, color: "#cbd5e1" }}>{yellowstoneResult.total_population.toLocaleString()}</span>
              </div>
              {yellowstoneResult.zones.map((z, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{z.name}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{z.deaths.toLocaleString()} deaths ({z.mortality_pct}%)</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>Calculating casualties...</div>
          )}
          {_bPct > 0 && (
            <div style={{ marginTop: 8, padding: "8px 10px", background: "#0a0a1a", borderRadius: 8, border: "1px solid #1e2d45" }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#a78bfa", marginBottom: 4 }}>🌑 Atmospheric Blackout</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Sunlight reduction</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa" }}>{_bPct}%</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Duration</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa" }}>{_bDur} months</span>
              </div>
              <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic" }}>{_bSev}</div>
              {_famine > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTop: "1px solid #1e2d45" }}>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>Est. indirect famine deaths</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#f97316" }}>{formatCompactCount(_famine)}</span>
                </div>
              )}
            </div>
          )}
          <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>Click map for zone details</div>
        </>
        );
      })()}

      {scenarioMode === "nuke" && empResult && (
        <>
          <hr style={{ margin: "10px 0", opacity: 0.25 }} />
          <div style={{ fontWeight: 700, marginBottom: 4 }}>⚡ Strategic EMP Results</div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>
            {empResult.yield_kt >= 1000 ? (empResult.yield_kt/1000).toFixed(1)+"Mt" : empResult.yield_kt+"kt"} · {empResult.burst_altitude_km}km altitude
          </div>
          <div style={{ color: "#a78bfa" }}>◌ Footprint radius: {Math.round(empResult.emp_r_km).toLocaleString()} km</div>
          <div style={{ color: "#a78bfa", marginTop: 2 }}>◌ E1 pulse: ~{empResult.e1_field_kvm} kV/m</div>
          <div style={{ marginTop: 6, padding: "8px 10px", background: "#0f0a2a", borderRadius: 8, border: "1px solid #4c1d95" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>Population at risk</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>{empResult.population_at_risk?.toLocaleString() ?? "—"}</span>
            </div>
            <div style={{ fontSize: 11, color: "#7c3aed", marginBottom: 3 }}>
              Footprint = geometric horizon only. No EMP beyond this line.
            </div>
            <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic", lineHeight: 1.5 }}>
              ⚠ No direct casualties — detonation is above the atmosphere. Grid collapse causes indirect deaths over weeks/months.
            </div>
          </div>
        </>
      )}

      {scenarioMode === "nuke" && nukeResult && (
        <>
          <hr style={{ margin: "10px 0", opacity: 0.25 }} />
          <div style={{ fontWeight: 700, marginBottom: 4 }}>☢️ {nukeResult._count > 1 ? `${nukeResult._count} Strikes` : "Detonation"} Results</div>
          {nukeResult._count > 1 ? (
            <>
              <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>
                {nukeResult._count} simultaneous detonations · {nukeResult.yield_kt >= 1000 ? (nukeResult.yield_kt/1000).toFixed(1)+"Mt" : nukeResult.yield_kt+"kt"} each
              </div>
              <hr style={{ margin: "8px 0", opacity: 0.2 }} />
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Per-Strike Zones</div>
              <div style={{ color: "#fde047" }}>● Fireball: {Math.round(nukeResult.fireball_r_m).toLocaleString()} m</div>
              <div style={{ color: "#dc2626" }}>● Heavy blast: {(Math.round(nukeResult.blast_heavy_r_m)/1000).toFixed(1)} km</div>
              <div style={{ color: "#f97316" }}>● Thermal (3rd°): {(Math.round(nukeResult.thermal_r_m)/1000).toFixed(1)} km</div>
              {nukeResult.radiation_r_m > 0 && <div style={{ color: "#4ade80" }}>◌ Radiation 500rem: {Math.round(nukeResult.radiation_r_m).toLocaleString()} m</div>}
              {nukeResult.fallout_major_km > 0 && <div style={{ color: "#84cc16" }}>◌ Fallout: {Math.round(nukeResult.fallout_major_km)} × {Math.round(nukeResult.fallout_minor_km)} km</div>}
              <hr style={{ margin: "8px 0", opacity: 0.2 }} />
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Combined Casualties</div>
              <div>Total exposed: {nukeResult.exposed != null ? nukeResult.exposed.toLocaleString() : "—"}</div>
              <div style={{ color: "#ef4444", fontWeight: 700 }}>Total deaths: {nukeResult.deaths != null ? nukeResult.deaths.toLocaleString() : "—"}</div>
              {nukeResult.radiation_deaths != null && nukeResult.radiation_deaths > 0 && (
                <div style={{ color: "#4ade80" }}>◌ Lethal radiation deaths: {(nukeResult.radiation_deaths * nukeResult._count).toLocaleString()}</div>
              )}
            </>
          ) : (
            <>
              <div>Yield: {nukeResult.yield_kt >= 1000 ? (nukeResult.yield_kt/1000).toFixed(2)+" Mt" : nukeResult.yield_kt+" kt"}</div>
              <div>Type: {nukeResult.burst_type}</div>
              <hr style={{ margin: "8px 0", opacity: 0.2 }} />
              <div style={{ color: "#fde047" }}>● Fireball: {Math.round(nukeResult.fireball_r_m).toLocaleString()} m</div>
              <div style={{ color: "#dc2626" }}>● Heavy blast: {(Math.round(nukeResult.blast_heavy_r_m)/1000).toFixed(1)} km</div>
              <div style={{ color: "#ef4444" }}>● Moderate blast: {(Math.round(nukeResult.blast_moderate_r_m)/1000).toFixed(1)} km</div>
              <div style={{ color: "#f97316" }}>● Thermal (3rd°): {(Math.round(nukeResult.thermal_r_m)/1000).toFixed(1)} km</div>
              <div style={{ color: "#f59e0b" }}>● Light blast: {(Math.round(nukeResult.blast_light_r_m)/1000).toFixed(1)} km</div>
              {nukeResult.radiation_r_m > 0 && <div style={{ color: "#4ade80" }}>◌ Radiation 500rem: {Math.round(nukeResult.radiation_r_m).toLocaleString()} m</div>}
              {/* EMP not shown here — use Strategic EMP mode for HEMP scenarios */}
              {nukeResult.fallout_major_km > 0 && <div style={{ color: "#84cc16" }}>◌ Fallout: {Math.round(nukeResult.fallout_major_km)} × {Math.round(nukeResult.fallout_minor_km)} km</div>}
              <hr style={{ margin: "8px 0", opacity: 0.2 }} />
              <div style={{ fontWeight: 700 }}>Casualties</div>
              <div>Exposed: {nukeResult.population_exposed != null ? nukeResult.population_exposed.toLocaleString() : "—"}</div>
              <div>Est. deaths: {nukeResult.estimated_deaths != null ? nukeResult.estimated_deaths.toLocaleString() : "—"}</div>
              {nukeResult.radiation_deaths != null && nukeResult.radiation_deaths > 0 && (
                <div style={{ color: "#4ade80" }}>◌ Lethal radiation deaths: {nukeResult.radiation_deaths.toLocaleString()}</div>
              )}
            </>
          )}
          {proTier === "free" && (
            <div onClick={() => setPaywallModal("pro")} style={{ fontSize: 11, color: "#f97316", marginTop: 8, cursor: "pointer", padding: "5px 8px", background: "#1a0d00", border: "1px solid #7c2d00", borderRadius: 6, textAlign: "center" }}>
              ☢️ 1 free zone click · <span style={{ color: "#fb923c", textDecoration: "underline" }}>Pro unlocks unlimited</span>
            </div>
          )}
        </>
      )}

      {/* ── Share helpers ── */}
      {(() => {
        window.buildPermalink = () => {
          const base = "https://www.disastermap.ca/map";
          const m = scenarioModeRef.current;
          const map = mapRef.current;
          // Include map center+zoom so link opens at same view
          const c = map ? map.getCenter() : null;
          const z = map ? map.getZoom().toFixed(1) : "3";
          const view = c ? `&cx=${c.lng.toFixed(4)}&cy=${c.lat.toFixed(4)}&cz=${z}` : "";
          if (m === "flood") return `${base}?scenario=flood&level=${seaLevel}${view}`;
          if (m === "climate") return `${base}?scenario=climate&level=${seaLevel}${activeWarmingLevel ? "&warming=" + activeWarmingLevel : ""}${view}`;
          if (m === "impact") {
            const pts = impactPointsRef.current;
            if (pts.length > 1) {
              // Multi-impact — encode all points
              const latlngs = pts.map(p => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");
              return `${base}?scenario=impact&points=${encodeURIComponent(latlngs)}&diameter=${impactDiameter}${view}`;
            }
            if (impactPointRef.current) return `${base}?scenario=impact&lat=${impactPointRef.current.lat.toFixed(4)}&lng=${impactPointRef.current.lng.toFixed(4)}&diameter=${impactDiameter}${view}`;
          }
          if (m === "nuke") {
            const strikes = nukeStrikesRef.current;
            if (strikes.length > 1) {
              const latlngs = strikes.map(s => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`).join("|");
              return `${base}?scenario=nuke&points=${encodeURIComponent(latlngs)}&yield=${nukeYield}&burst=${nukeBurst}${view}`;
            }
            if (nukePointRef.current) return `${base}?scenario=nuke&lat=${nukePointRef.current.lat.toFixed(4)}&lng=${nukePointRef.current.lng.toFixed(4)}&yield=${nukeYield}&burst=${nukeBurst}${view}`;
          }
          if (m === "yellowstone") return `${base}?scenario=volcano&type=${volcanoType}&preset=${yellowstonePreset}${view}`;
          if (m === "tsunami") return `${base}?scenario=tsunami&source=${tsunamiSource}${view}`;
          if (m === "cataclysm") return `${base}?scenario=cataclysm&model=${cataclysmModelRef.current}${view}`;
          return base;
        };
        window.saveScreenshot = () => {
          const map = mapRef.current;
          if (!map) return;
          // Preserve drawing buffer must be true (set in map init) for canvas capture
          map.getCanvas().toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const mode = scenarioModeRef.current || "map";
            const ts = new Date().toISOString().slice(0,10);
            a.download = `disastermap-${mode}-${ts}.png`;
            a.click();
            URL.revokeObjectURL(url);
          }, "image/png");
        };
        window.copyScreenshot = () => {
          const map = mapRef.current;
          if (!map) return;
          map.getCanvas().toBlob(async (blob) => {
            try {
              await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
              setStatus("Screenshot copied to clipboard!");
              setTimeout(() => setStatus(""), 2000);
            } catch(e) {
              // Fallback — just download
              window.saveScreenshot();
            }
          }, "image/png");
        };
        const buildPermalink = window.buildPermalink;
        const saveScreenshot = window.saveScreenshot;
        return null;
      })()}

      {(impactResult || nukeResult || empResult || (scenarioMode === "flood" && seaLevel !== 0) || (scenarioMode === "climate" && seaLevel !== 0) || (scenarioMode === "yellowstone" && yellowstoneActive) || (scenarioMode === "tsunami" && tsunamiActive) || (scenarioMode === "cataclysm" && cataclysmActive)) && (
        <>
          <hr style={{ margin: "10px 0", opacity: 0.2 }} />
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, letterSpacing: "0.1em", color: "#f97316" }}>SHARE</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="share-btn" onClick={() => {
              const url = window.buildPermalink();
              const impactPts = impactPointsRef.current;
              const buildMsg = (forCopy) => {
                const permalink = forCopy ? url : "";
                if (impactResult) {
                  const d = Number(impactResult.diameter_m ?? 0).toLocaleString();
                  const e = Number(impactResult.energy_mt ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
                  const deaths = Number(impactResult.estimated_deaths ?? 0).toLocaleString();
                  const crater = Math.round(Number(impactResult.crater_diameter_m ?? 0) / 1000);
                  const isOcean = impactResult.is_ocean_impact;
                  const wh = Math.round(Number(impactResult.wave_height_m ?? 0));
                  const reach = Math.round(Number(impactResult.estimated_wave_reach_m ?? 0) / 1000);
                  const vel = Math.round(Number(impactResult.velocity_m_s ?? 20000) / 1000);
                  const multi = impactPts && impactPts.length > 1 ? impactPts.length + " simultaneous impacts · " : "";
                  const oceanLine = isOcean && wh > 0 ? " · " + wh.toLocaleString() + "m wave · " + reach.toLocaleString() + "km reach" : "";
                  const blackout = Number(impactResult.blackout_pct ?? 0) > 10 ? " · " + Math.round(impactResult.blackout_pct) + "% atmospheric dimming" : "";
                  return "💥 " + multi + d + "m asteroid · " + vel + " km/s · " + e + " Mt · " + crater + "km crater" + oceanLine + blackout + " · " + deaths + " est. deaths\n\nSimulated on DisasterMap — try it: " + (forCopy ? permalink : "https://www.disastermap.ca");
                }
                if (nukeResult) {
                  const yld = nukeResult.yield_kt >= 1000 ? (nukeResult.yield_kt/1000).toFixed(1)+"Mt" : nukeResult.yield_kt+"kt";
                  const deaths = Math.round(Number(nukeResult.deaths ?? 0)).toLocaleString();
                  const blast = Math.round(Number(nukeResult.blast_moderate_r_m ?? 0) / 1000);
                  const thermal = Math.round(Number(nukeResult.thermal_r_m ?? 0) / 1000);
                  const burst = nukeResult.burst_type === "air" ? "airburst" : nukeResult.burst_type === "surface" ? "surface burst" : "subsurface";
                  return "☢️ " + yld + " " + burst + " · " + blast + "km blast · " + thermal + "km thermal · " + deaths + " est. deaths\n\nDisasterMap: " + (forCopy ? permalink : "https://www.disastermap.ca");
                }
                if (scenarioMode === "tsunami" && tsunamiActive) {
                  const src = TSUNAMI_SOURCES[tsunamiSource];
                  const deaths = tsunamiResult ? tsunamiResult.total_deaths.toLocaleString() : "";
                  return "🌊 " + src.name + " mega-tsunami · " + src.maxWaveM + "m wave · " + Math.round(src.rings[src.rings.length-1].major_km).toLocaleString() + "km reach" + (deaths ? " · " + deaths + " est. deaths" : "") + "\n\nDisasterMap: " + (forCopy ? permalink : "https://www.disastermap.ca");
                }
                if (scenarioMode === "yellowstone" && yellowstoneActive) {
                  const presets = volcanoType === "toba" ? TOBA_PRESETS : volcanoType === "campi" ? CAMPI_PRESETS : YELLOWSTONE_PRESETS;
                  const preset = presets[Math.min(yellowstonePreset, presets.length - 1)];
                  const deaths = yellowstoneResult ? yellowstoneResult.total_deaths.toLocaleString() : "";
                  return "🌋 " + preset.name + " supervolcano · " + (deaths ? deaths + " est. deaths" : "civilisation-ending") + "\n\nDisasterMap: " + (forCopy ? permalink : "https://www.disastermap.ca");
                }
                if (scenarioMode === "cataclysm" && cataclysmActive) {
                  if (cataclysmModel === "ydi") return "☄️ Younger Dryas Impact · ~12,900 BP · Laurentide ice collapse · Columbia Scablands meltwater surge\n\nDisasterMap: " + (forCopy ? permalink : "https://www.disastermap.ca");
                  if (cataclysmModel === "davidson") return "🌍 90° pole shift (Ben Davidson / Suspicious Observers) · New pole: Bay of Bengal · Americas flood 500-800m\n\nDisasterMap: " + (forCopy ? permalink : "https://www.disastermap.ca");
                  return "🌍 104° TES ECDO pole shift · New pole: South Africa 31°E · Global inundation 120-1,200m\n\nDisasterMap: " + (forCopy ? permalink : "https://www.disastermap.ca");
                }
                if (scenarioMode === "climate" && seaLevel !== 0) {
                  const displaced = floodDisplaced ? floodDisplaced.toLocaleString() : "";
                  const label = activeWarmingLevel ? "+" + activeWarmingLevel + "°C warming" : (seaLevel > 0 ? "+" : "") + Math.round(seaLevel) + "m sea level";
                  return "🌍 " + label + (displaced ? " · " + displaced + " people displaced" : "") + "\n\nDisasterMap: " + (forCopy ? permalink : "https://www.disastermap.ca");
                }
                const displaced = floodDisplaced ? floodDisplaced.toLocaleString() : "";
                const label = seaLevel < -50 ? Math.round(seaLevel) + "m — Ice Age · land bridges exposed" : (seaLevel > 0 ? "+" : "") + Math.round(seaLevel) + "m sea level";
                return "🌊 " + label + (displaced ? " · " + displaced + " people displaced" : "") + "\n\nDisasterMap: " + (forCopy ? permalink : "https://www.disastermap.ca");
              };
              window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(buildMsg(true)), "_blank");
            }} style={{ background: "#000", color: "#fff" }}>
              𝕏 Tweet
            </button>
            <button className="share-btn" onClick={() => {
              window.open("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(window.buildPermalink()), "_blank");
            }} style={{ background: "#1877f2", color: "#fff" }}>
              f Share
            </button>
            <button className="share-btn" onClick={() => {
              const url = window.buildPermalink();
              const impactPts = impactPointsRef.current;
              const buildMsg = (forCopy) => {
                const permalink = forCopy ? url : "";
                if (impactResult) {
                  const d = Number(impactResult.diameter_m ?? 0).toLocaleString();
                  const e = Number(impactResult.energy_mt ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
                  const deaths = Number(impactResult.estimated_deaths ?? 0).toLocaleString();
                  const crater = Math.round(Number(impactResult.crater_diameter_m ?? 0) / 1000);
                  const isOcean = impactResult.is_ocean_impact;
                  const wh = Math.round(Number(impactResult.wave_height_m ?? 0));
                  const reach = Math.round(Number(impactResult.estimated_wave_reach_m ?? 0) / 1000);
                  const vel = Math.round(Number(impactResult.velocity_m_s ?? 20000) / 1000);
                  const multi = impactPts && impactPts.length > 1 ? impactPts.length + " simultaneous impacts · " : "";
                  const oceanLine = isOcean && wh > 0 ? " · " + wh.toLocaleString() + "m wave · " + reach.toLocaleString() + "km reach" : "";
                  const blackout = Number(impactResult.blackout_pct ?? 0) > 10 ? " · " + Math.round(impactResult.blackout_pct) + "% atmospheric dimming" : "";
                  return "💥 " + multi + d + "m asteroid · " + vel + " km/s · " + e + " Mt · " + crater + "km crater" + oceanLine + blackout + " · " + deaths + " est. deaths\n\nSimulated on DisasterMap: " + url;
                }
                if (nukeResult) {
                  const yld = nukeResult.yield_kt >= 1000 ? (nukeResult.yield_kt/1000).toFixed(1)+"Mt" : nukeResult.yield_kt+"kt";
                  const deaths = Math.round(Number(nukeResult.deaths ?? 0)).toLocaleString();
                  const blast = Math.round(Number(nukeResult.blast_moderate_r_m ?? 0) / 1000);
                  const thermal = Math.round(Number(nukeResult.thermal_r_m ?? 0) / 1000);
                  const burst = nukeResult.burst_type === "air" ? "airburst" : nukeResult.burst_type === "surface" ? "surface burst" : "subsurface";
                  return "☢️ " + yld + " " + burst + " · " + blast + "km blast · " + thermal + "km thermal · " + deaths + " est. deaths\n\nDisasterMap: " + url;
                }
                if (scenarioMode === "tsunami" && tsunamiActive) {
                  const src = TSUNAMI_SOURCES[tsunamiSource];
                  const deaths = tsunamiResult ? tsunamiResult.total_deaths.toLocaleString() : "";
                  return "🌊 " + src.name + " mega-tsunami · " + src.maxWaveM + "m wave · " + Math.round(src.rings[src.rings.length-1].major_km).toLocaleString() + "km reach" + (deaths ? " · " + deaths + " est. deaths" : "") + "\n\nDisasterMap: " + url;
                }
                if (scenarioMode === "yellowstone" && yellowstoneActive) {
                  const presets = volcanoType === "toba" ? TOBA_PRESETS : volcanoType === "campi" ? CAMPI_PRESETS : YELLOWSTONE_PRESETS;
                  const preset = presets[Math.min(yellowstonePreset, presets.length - 1)];
                  const deaths = yellowstoneResult ? yellowstoneResult.total_deaths.toLocaleString() : "";
                  return "🌋 " + preset.name + " · " + (deaths ? deaths + " est. deaths" : "civilisation-ending") + "\n\nDisasterMap: " + url;
                }
                if (scenarioMode === "cataclysm" && cataclysmActive) {
                  if (cataclysmModel === "ydi") return "☄️ Younger Dryas Impact · ~12,900 BP · Laurentide collapse · Columbia Scablands\n\nDisasterMap: " + url;
                  if (cataclysmModel === "davidson") return "🌍 90° pole shift (Ben Davidson) · New pole: Bay of Bengal · Americas flood 500-800m\n\nDisasterMap: " + url;
                  return "🌍 104° TES ECDO · New pole: South Africa · Global inundation 120-1,200m\n\nDisasterMap: " + url;
                }
                if (scenarioMode === "climate" && seaLevel !== 0) {
                  const displaced = floodDisplaced ? floodDisplaced.toLocaleString() : "";
                  const label = activeWarmingLevel ? "+" + activeWarmingLevel + "°C warming" : (seaLevel > 0 ? "+" : "") + Math.round(seaLevel) + "m sea level";
                  return "🌍 " + label + (displaced ? " · " + displaced + " people displaced" : "") + "\n\nDisasterMap: " + url;
                }
                const displaced = floodDisplaced ? floodDisplaced.toLocaleString() : "";
                const label = seaLevel < -50 ? Math.round(seaLevel) + "m — Ice Age · land bridges exposed" : (seaLevel > 0 ? "+" : "") + Math.round(seaLevel) + "m sea level";
                return "🌊 " + label + (displaced ? " · " + displaced + " people displaced" : "") + "\n\nDisasterMap: " + url;
              };
              const msg = buildMsg(true);
              navigator.clipboard.writeText(msg).then(() => { setStatus("Copied!"); setTimeout(() => setStatus(""), 2000); });
            }} style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #1e2d45" }}>
              🔗 Copy Link
            </button>
            <button className="share-btn" onClick={window.saveScreenshot}
              style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #1e2d45" }}>
              📷 Save Image
            </button>
            <button className="share-btn" onClick={window.copyScreenshot}
              style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #1e2d45" }}>
              📋 Copy Image
            </button>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <a href="https://x.com/grimerica" target="_blank"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", background: "#000", color: "#fff", borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
              𝕏 @grimerica
            </a>
            <a href="https://formspree.io/f/xgopwayn" target="_blank"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", background: "#1e3a5f", color: "#60a5fa", borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
              ✉️ Support
            </a>
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="fm-map-root" style={{ width: "100%", height: "100dvh", position: "relative", overflow: "hidden" }}>
      <style>{`
        /* ── Mapbox popup ── */
        /* ── Dark panel theme ── */
        :root {
          --dm-bg: #0a0f1e;
          --dm-surface: #111827;
          --dm-border: #1e2d45;
          --dm-text: #e2e8f0;
          --dm-muted: #64748b;
          --dm-accent: #f97316;
          --dm-blue: #3b82f6;
          --dm-active: #1e3a5f;
        }
        /* ── Star field canvas ── */
        #star-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.8s ease;
        }
        #star-canvas.visible { opacity: 1; }
        /* ── Share buttons ── */
        .share-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          font-family: Arial, sans-serif;
          transition: opacity 0.15s;
        }
        .share-btn:hover { opacity: 0.85; }
        .elev-popup .mapboxgl-popup-content {
          background: #1e3a5f;
          color: white;
          border-radius: 10px;
          padding: 10px 12px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          min-width: 160px;
        }
        .elev-popup .mapboxgl-popup-close-button { color: #94a3b8; font-size: 16px; padding: 4px 8px; }
        .elev-popup .mapboxgl-popup-close-button:hover { color: white; }
        .elev-popup .mapboxgl-popup-tip { border-top-color: #1e3a5f; }

        /* ── Preset grid: 2-col on desktop, horizontal scroll on mobile ── */
        .fm-presets {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        /* ── Mobile drawer slide transition ── */
        .fm-drawer {
          transition: transform 0.32s cubic-bezier(0.4,0,0.2,1);
        }

        /* ── Stats panel slide transition ── */
        .fm-stats-sheet {
          transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
        }

        /* Presets: horizontal scroll on mobile, 2-col grid on desktop — driven by isMobile inline styles */
        .fm-presets-mobile {
          display: flex;
          flex-direction: row;
          overflow-x: auto;
          gap: 10px;
          padding-bottom: 4px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          margin-bottom: 24px;
        }
        .fm-presets-mobile::-webkit-scrollbar { display: none; }
        .fm-presets-mobile > button { flex: 0 0 auto; min-width: 110px; }
        .fm-presets-desktop {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 24px;
        }

        /* ── Mobile: autohide browser bar + full bleed ── */
        @media (max-width: 640px) {
          /* Use dynamic viewport units so layout shrinks when browser chrome hides */
          :root {
            --vh: 1dvh;
          }
          /* Prevent any scrolling that would re-show browser bar */
          html, body {
            overscroll-behavior: none !important;
            overscroll-behavior-y: none !important;
            touch-action: none;
          }
          /* Make the map container exploit full dynamic height */
          .fm-map-root {
            height: 100dvh !important;
          }
          /* Sliders: bigger touch targets on mobile */
          input[type="range"] {
            height: 28px !important;
            cursor: pointer;
            touch-action: pan-x;
          }
          input[type="range"]::-webkit-slider-thumb {
            width: 26px !important;
            height: 26px !important;
            border-radius: 50%;
          }
          input[type="range"]::-moz-range-thumb {
            width: 26px !important;
            height: 26px !important;
            border-radius: 50%;
          }
          /* Number inputs: full-width, comfortable tap height */
          input[type="number"] {
            min-height: 48px !important;
            font-size: 16px !important; /* prevents iOS zoom-on-focus */
          }
          /* Select dropdowns */
          select {
            min-height: 44px !important;
            font-size: 16px !important;
          }
          /* Buttons: min 44px tap target (Apple HIG / WCAG) */
          button {
            min-height: 44px;
          }
          /* Bottom drawer: use dvh so it doesn't overlap browser chrome */
          .dm-dark-popup .mapboxgl-popup-content {
            background: #0f172a !important;
            border: 1px solid #334155;
            border-radius: 10px;
            padding: 14px;
            color: #e2e8f0 !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
          }
          .dm-dark-popup .mapboxgl-popup-content * { color: inherit; }
          .dm-dark-popup .mapboxgl-popup-tip { border-top-color: #334155; border-bottom-color: #334155; }
          .dm-dark-popup .mapboxgl-popup-close-button { color: #64748b !important; font-size: 16px; background: none; }
          .fm-mobile-drawer {
            max-height: 80dvh !important;
          }
          /* Drawer scrollable area: allow touch scroll inside */
          .fm-drawer-scroll {
            touch-action: pan-y !important;
            -webkit-overflow-scrolling: touch;
          }
          /* Hide mapbox zoom +/- controls on mobile (use pinch) */
          .mapboxgl-ctrl-zoom-in,
          .mapboxgl-ctrl-zoom-out,
          .mapboxgl-ctrl-group {
            display: none !important;
          }
          /* Hide mapbox compass on mobile */
          .mapboxgl-ctrl-compass {
            display: none !important;
          }
          /* Stats pill: push below status bar / notch */
          .fm-mobile-stats-pill {
            top: max(10px, env(safe-area-inset-top, 10px)) !important;
          }
          /* Popups: limit width on narrow screens */
          .mapboxgl-popup-content {
            max-width: min(280px, 90vw) !important;
          }
        }
      `}</style>

      {/* ── Map canvas ── */}
      {/* ── Sign-in sync prompt ── */}
      {showSignInPrompt && !isSignedIn && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, width: 300,
          background: "#0c1a2e", border: "1px solid #1e3a5f", borderRadius: 14,
          padding: "20px", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>🔐</div>
          <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
            Save Pro across devices
          </div>
          <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
            Sign in to sync your Pro access. Without an account it only works on this browser.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SignInButton mode="modal">
              <button style={{ width: "100%", padding: "10px", background: "#f97316",
                color: "#fff", border: "none", borderRadius: 8,
                fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Sign In / Create Account
              </button>
            </SignInButton>
            <button onClick={() => {
              setShowSignInPrompt(false);
              try { localStorage.setItem("dm_signin_prompt_dismissed", "1"); } catch(e) {}
            }} style={{ width: "100%", padding: "8px", background: "transparent",
              color: "#475569", border: "1px solid #1e2d45", borderRadius: 8,
              fontSize: 13, cursor: "pointer" }}>
              Don't show again
            </button>
          </div>
        </div>
      )}

      {/* ── Onboarding modal ── */}
      {showOnboarding && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed", inset: 0, zIndex: 3000,
            background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <div style={{
            background: "#0a0f1e", border: "1px solid #1e2d45", borderRadius: 18,
            padding: "28px 28px 22px", maxWidth: 420, width: "92%",
            boxShadow: "0 24px 72px rgba(0,0,0,0.7)",
            display: "flex", flexDirection: "column", gap: 0,
            maxHeight: "90vh", overflowY: "auto", WebkitOverflowScrolling: "touch",
          }}>
            {/* Logo + title */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <img src={LOGO_DATA} alt="Disaster Map" style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 10 }} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#e2e8f0", lineHeight: 1.1 }}>DisasterMap.ca</div>
                <div style={{ fontSize: 12, color: "#f97316", fontWeight: 700, marginTop: 3, letterSpacing: "0.05em" }}>INTERACTIVE CATASTROPHE SIMULATOR</div>
              </div>
            </div>

            {/* Page dots */}
            <div style={{ display: "flex", gap: 6, marginBottom: 18, justifyContent: "center" }}>
              {[0,1,2].map(i => (
                <div key={i} onClick={() => setOnboardingPage(i)} style={{
                  width: i === onboardingPage ? 22 : 8, height: 8,
                  borderRadius: 4, cursor: "pointer",
                  background: i === onboardingPage ? "#f97316" : "#1e3a5f",
                  transition: "all 0.2s",
                }} />
              ))}
            </div>

            {/* Page 0 — What is this */}
            {onboardingPage === 0 && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#e2e8f0", marginBottom: 10 }}>
                  Welcome to the Disaster Simulator 🌍
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.65, marginBottom: 14 }}>
                  Explore real-world catastrophe scenarios on a live map. Flood any coastline, detonate nuclear weapons, simulate asteroid impacts, model ice ages, and more — all backed by real geophysical models.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 4 }}>
                  {[
                    { icon: "🌊", label: "Flood & Sea Rise", desc: "Drag sea level from −120 m to +70 m" },
                    { icon: "💥", label: "Asteroid Impact", desc: "From Chelyabinsk to Chicxulub" },
                    { icon: "☢️", label: "Nuclear Detonation", desc: "Tactical nukes to Tsar Bomba" },
                    { icon: "☄️", label: "Cataclysm", desc: "Pole shift & global displacement" },
                    { icon: "🌋", label: "Supervolcano", desc: "Yellowstone, Toba, Campi Flegrei" },
                    { icon: "🌡️", label: "Climate Change", desc: "Warming levels with wildfire zones" },
                  ].map(({ icon, label, desc }) => (
                    <div key={label} style={{ background: "#111827", border: "1px solid #1e2d45", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 18, marginBottom: 3 }}>{icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Page 1 — How to use */}
            {onboardingPage === 1 && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#e2e8f0", marginBottom: 10 }}>
                  How to use it 🗺️
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 4 }}>
                  {[
                    {
                      step: "1",
                      color: "#3b82f6",
                      title: isMobile ? "Tap ⌃ to open the control panel" : "Use the left panel to choose a scenario",
                      desc: isMobile
                        ? "The strip at the bottom is your control centre. Tap the chevron to open the full panel and choose a scenario."
                        : "Select Flood, Impact, Nuke, Yellowstone, Tsunami, Cataclysm, or Climate from the left sidebar.",
                    },
                    {
                      step: "2",
                      color: "#f97316",
                      title: "Configure your disaster",
                      desc: "Set sea level, asteroid diameter, nuke yield, or explosion point using the controls. Historical presets are available for each mode.",
                    },
                    {
                      step: "3",
                      color: "#ef4444",
                      title: "Click / tap the map",
                      desc: "For Impact and Nuke modes, tap the map to place a strike point. After running, tap any zone to see survival odds and damage details.",
                    },
                    {
                      step: "4",
                      color: "#22c55e",
                      title: "Share your scenario",
                      desc: "Use the Share button to copy a permalink. Anyone can open it and see exactly what you simulated.",
                    },
                  ].map(({ step, color, title, desc }) => (
                    <div key={step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "white" }}>{step}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>{title}</div>
                        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Page 2 — Pro CTA */}
            {onboardingPage === 2 && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#e2e8f0", marginBottom: 10 }}>
                  Free vs Pro ⚡
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                  {[
                    { free: "30 simulations / day",         pro: "200 simulations / day" },
                    { free: "Asteroid up to 5,000 m",       pro: "Asteroid up to 20,000 m" },
                    { free: "1 impact point",               pro: "Up to 3 simultaneous impacts" },
                    { free: "Fixed velocity (20 km/s)",     pro: "Velocity slider (11–72 km/s)" },
                    { free: "Nuke up to 1 Mt",              pro: "Nuke up to 100 Mt" },
                    { free: "1 nuke strike",                pro: "Up to 5 simultaneous strikes" },
                    { free: "Flood only in Cataclysm",      pro: "Wind + Both overlays" },
                    { free: "1 zone click popup",           pro: "Unlimited zone popups" },
                    { free: "Map view only",                pro: "Satellite + Globe view" },
                    { free: "—",                            pro: "Flood displaced counts" },
                    { free: "—",                            pro: "🌊 Mega-Tsunami" },
                  ].map(({ free, pro }, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <div style={{ background: "#0f172a", border: "1px solid #1e2d45", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: free === "—" ? "#334155" : "#64748b" }}>
                        {free !== "—" ? "✓ " : ""}{free}
                      </div>
                      <div style={{ background: "#1a0a00", border: "1px solid #7c2d12", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#fb923c", fontWeight: 600 }}>
                        ⚡ {pro}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ background: "#111827", border: "1px solid #f97316", borderRadius: 12, padding: "14px 16px", marginBottom: 4, position: "relative" }}>
                  <div style={{ position: "absolute", top: -10, right: 12, background: "#f97316", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, letterSpacing: "0.08em" }}>FOUNDERS PRICE</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 15 }}>⚡ Pro Lifetime</span>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ color: "#f97316", fontWeight: 800, fontSize: 17 }}>$18.99</span>
                      <span style={{ color: "#64748b", fontSize: 12, marginLeft: 4 }}>once</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#f97316", marginBottom: 10 }}>Price going to $24.99 soon — lock in now</div>
                  <button
                    onClick={() => { dismissOnboarding(true); window.open("https://buy.stripe.com/8x23cv7eE9w62qa6vra3u09", "_blank"); }}
                    style={{ width: "100%", padding: "11px", background: "#f97316", color: "white", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}
                  >
                    Unlock Pro — $18.99 →
                  </button>
                </div>
              </div>
            )}

            {/* Navigation footer */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
              {onboardingPage > 0 && (
                <button
                  onClick={() => setOnboardingPage(p => p - 1)}
                  style={{ padding: "10px 16px", background: "#111827", border: "1px solid #1e2d45", borderRadius: 8, color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                >
                  ← Back
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button
                onClick={() => dismissOnboarding(false)}
                style={{ padding: "10px 14px", background: "transparent", border: "none", color: "#475569", cursor: "pointer", fontSize: 12 }}
              >
                Skip
              </button>
              {onboardingPage < 2 ? (
                <button
                  onClick={() => setOnboardingPage(p => p + 1)}
                  style={{ padding: "10px 20px", background: "#f97316", border: "none", borderRadius: 8, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700 }}
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={() => dismissOnboarding(true)}
                  style={{ padding: "10px 20px", background: "#1e3a5f", border: "1px solid #3b82f6", borderRadius: 8, color: "#60a5fa", cursor: "pointer", fontSize: 13, fontWeight: 700 }}
                >
                  Start Exploring ✓
                </button>
              )}
            </div>

            {/* Don't show again */}
            <button
              onClick={() => dismissOnboarding(true)}
              style={{ marginTop: 10, background: "none", border: "none", color: "#334155", fontSize: 11, cursor: "pointer", textAlign: "center", textDecoration: "underline" }}
            >
              Don't show again
            </button>
          </div>
        </div>
      )}

      {/* ── Paywall modal ── */}
      {paywallModal && (
        <div style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(0,0,0,0.75)", fontFamily:"Arial,sans-serif" }}
          onClick={() => setPaywallModal(null)}>
          <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#0a0f1e",
            borderTop:"2px solid #f97316", borderRadius:"16px 16px 0 0", padding:"24px 20px 44px", zIndex:2001 }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:17, marginBottom:6, textAlign:"center" }}>
              {paywallModal === "ratelimit" ? "Simulation Limit Reached" : "🔒 Pro Feature"}
            </div>
            <div style={{ color:"#64748b", fontSize:13, textAlign:"center", marginBottom:16, lineHeight:1.4 }}>
              {paywallModal === "ratelimit"
                ? `${rlStatus.dayCount}/${FREE_SIM_PER_DAY} simulations used today.`
                : "Unlock Pro — $18.99 lifetime. No subscription ever."}
            </div>
            <button onClick={() => window.open("https://buy.stripe.com/8x23cv7eE9w62qa6vra3u09","_blank")}
              style={{ display:"block", width:"100%", padding:"14px", background:"#f97316", color:"#fff",
                border:"none", borderRadius:10, fontWeight:700, fontSize:15, cursor:"pointer", marginBottom:10 }}>
              Unlock Pro — $18.99 →
            </button>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setPaywallModal(null)}
                style={{ flex:1, padding:"12px", background:"transparent", color:"#94a3b8",
                  border:"1px solid #334155", borderRadius:10, cursor:"pointer", fontSize:14 }}>
                Continue Free
              </button>
              {!isSignedIn && (
                <SignInButton mode="modal">
                  <button style={{ flex:1, padding:"12px", background:"transparent", color:"#f97316",
                    border:"1px solid #f97316", borderRadius:10, fontWeight:700, fontSize:14, cursor:"pointer" }}>
                    Sign In
                  </button>
                </SignInButton>
              )}
            </div>
          </div>
        </div>
      )}

      <canvas id="star-canvas" className="" />
      <div ref={mapContainerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, touchAction: "none" }} />
      <style>{`html, body { overflow: hidden !important; height: 100% !important; overscroll-behavior: none; touch-action: none; }`}</style>
      {/* Disaster Map wordmark — top center, unobtrusive */}
      <div style={{
        position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
        zIndex: 500, pointerEvents: "none",
        background: "rgba(10,15,30,0.55)", backdropFilter: "blur(4px)",
        borderRadius: 20, padding: "4px 14px",
        fontSize: 13, fontWeight: 700, letterSpacing: "0.08em",
        color: "rgba(255,255,255,0.75)", fontFamily: "Arial, sans-serif",
        whiteSpace: "nowrap",
      }}>
        DISASTER MAP
      </div>

      {/* ═══════════════════════════════════════════════
          DESKTOP: left sidebar panel (unchanged from v50)
      ═══════════════════════════════════════════════ */}
      <div
        className="fm-desktop-panel"
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: isMobile ? "none" : "block",
          position: "absolute", top: 0, left: 0,
          width: 340, height: "100%",
          background: "#0a0f1e",
          borderRight: "1px solid #1e2d45",
          padding: 16,
          fontFamily: "Arial, sans-serif",
          zIndex: 1000,
          overflowY: "auto",
          pointerEvents: "auto",
          color: "#e2e8f0",
        }}
      >
        {panelContent}
      </div>

      {/* ═══════════════════════════════════════════════
          DESKTOP: right stats panel — collapsible slide-in
      ═══════════════════════════════════════════════ */}
      {!isMobile && (<>
        {/* Desktop stats pill — bottom right, mirrors mobile pill style */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setDesktopStatsOpen(v => !v); }}
          style={{
            position: "absolute", bottom: 32, right: 20,
            background: "#1e3a5f", color: "white",
            borderRadius: 20, padding: "7px 16px",
            fontSize: 13, fontWeight: 700,
            zIndex: 1100, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
            whiteSpace: "nowrap", userSelect: "none",
          }}
        >
          <span style={{ color: "#facc15" }}>{FRONTEND_BUILD_LABEL}</span>
          <span style={{ opacity: 0.7, margin: "0 2px" }}>·</span>
          <span>{formatLevelForDisplay(seaLevel)}</span>
          <span style={{ opacity: 0.7, margin: "0 2px" }}>·</span>
          <span style={{ opacity: 0.85 }}>{status.length > 28 ? status.slice(0, 26) + "…" : status}</span>
          <span style={{ marginLeft: 4, opacity: 0.7, fontSize: 11 }}>{desktopStatsOpen ? "▼" : "▲"}</span>
        </div>
        {/* Desktop stats expanded sheet — bottom right, above pill */}
        {desktopStatsOpen && (
          <div
            className="fm-desktop-stats"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute", bottom: 72, right: 20,
              background: "#1e3a5f", color: "white",
              padding: "14px 16px", borderRadius: 14,
              fontSize: 13, lineHeight: 1.5,
              zIndex: 1050, minWidth: 320,
              boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              maxHeight: "70dvh", overflowY: "auto",
            }}
          >
            {statsContent}
          </div>
        )}
      </>)}

      {/* ═══════════════════════════════════════════════
          MOBILE: stats pill — top center, tap to expand
      ═══════════════════════════════════════════════ */}
      <div
        className="fm-mobile-stats-pill"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setStatsExpanded((v) => !v); }}
        style={{
          display: isMobile ? "flex" : "none",
          position: "absolute", top: 10, left: "50%",
          transform: "translateX(-50%)",
          background: "#1e3a5f", color: "white",
          borderRadius: 20, padding: "7px 16px",
          fontSize: 13, fontWeight: 700,
          zIndex: drawerOpen ? 999 : 1100, cursor: "pointer",
          alignItems: "center", gap: 8,
          boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
          whiteSpace: "nowrap",
          userSelect: "none",
          pointerEvents: drawerOpen ? "none" : "auto",
        }}
      >
        <span style={{ color: "#facc15" }}>{FRONTEND_BUILD_LABEL}</span>
        <span style={{ opacity: 0.7, margin: "0 2px" }}>·</span>
        <span>{formatLevelForDisplay(seaLevel)}</span>
        <span style={{ opacity: 0.7, margin: "0 2px" }}>·</span>
        <span style={{ opacity: 0.85 }}>{status.length > 28 ? status.slice(0, 26) + "…" : status}</span>
        <span style={{ marginLeft: 4, opacity: 0.7, fontSize: 11 }}>{statsExpanded ? "▲" : "▼"}</span>
      </div>

      {/* MOBILE: stats expanded sheet */}
      <div
        className="fm-stats-sheet"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: (isMobile && statsExpanded) ? "block" : "none",
          position: "absolute", top: 48, left: 10, right: 10,
          background: "#1e3a5f", color: "white",
          padding: "14px 16px", borderRadius: 14,
          fontSize: 13, lineHeight: 1.5,
          zIndex: 1050,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          maxHeight: "55dvh", overflowY: "auto",
        }}
      >
        {statsContent}
      </div>

      {/* ═══════════════════════════════════════════════
          MOBILE: bottom drawer (full panel content)
      ═══════════════════════════════════════════════ */}
      <div
        className="fm-mobile-drawer fm-drawer"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: isMobile ? "flex" : "none",
          flexDirection: "column",
          position: "fixed", bottom: 0, left: 0, right: 0,
          height: "80dvh",
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)",
          background: "#0a0f1e",
          borderTop: "1px solid #1e2d45",
          borderRadius: "18px 18px 0 0",
          zIndex: 1002,
          transform: drawerOpen ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.32s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.18)",
          pointerEvents: drawerOpen ? "auto" : "none",
        }}
      >
        {/* Drawer handle bar */}
        <div
          onPointerDown={(e) => { e.stopPropagation(); setDrawerOpen(false); }}
          style={{ flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "10px 0 8px 0", cursor: "pointer", gap: 4 }}
        >
          <div style={{ width: 40, height: 4, background: "#334155", borderRadius: 4 }} />
          <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.05em" }}>tap to close</div>
        </div>

        {/* Scrollable panel content inside drawer */}
        <div className="fm-drawer-scroll" style={{ flex: 1, overflowY: "auto", padding: "4px 16px 32px 16px" }}>
          {panelContent}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          MOBILE: collapsed bottom strip (always visible)
      ═══════════════════════════════════════════════ */}
      <div
        className="fm-mobile-strip"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: isMobile ? "flex" : "none",
          position: "fixed", bottom: 0, left: 0, right: 0,
          minHeight: 72,
          paddingTop: 0,
          paddingLeft: 12,
          paddingRight: 12,
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)",
          background: "#0a0f1e",
          borderTop: "1px solid #1e2d45",
          borderRadius: "14px 14px 0 0",
          zIndex: 1001,
          alignItems: "center",
          gap: 10,
          boxShadow: "0 -2px 12px rgba(0,0,0,0.1)",
          fontFamily: "Arial, sans-serif",
          color: "#e2e8f0",
          transform: drawerOpen ? "translateY(100%)" : "translateY(0)",
          transition: "transform 0.32s cubic-bezier(0.4,0,0.2,1)",
          pointerEvents: drawerOpen ? "none" : "auto",
        }}
      >
        {/* Left: current level + mode pill */}
        <div
          onPointerDown={(e) => { e.stopPropagation(); setDrawerOpen(true); }}
          style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, cursor: "pointer", minWidth: 0 }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: seaLevel > 0 ? "#3b82f6" : seaLevel < 0 ? "#f97316" : "#e2e8f0", lineHeight: 1 }}>
            {stripLabel}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ background: scenarioMode === "impact" ? "#ef4444" : "#0f172a", color: "white", fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 7px" }}>
              {stripModePill}
            </span>
            <span style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {status.length > 22 ? status.slice(0, 20) + "…" : status}
            </span>
          </div>
        </div>

        {/* Center: big CTA button */}
        <button
          onClick={handleStripCTA}
          disabled={(scenarioMode === "impact" && impactLoading) || (scenarioMode === "nuke" && (nukeLoading || !nukePointSet))}
          style={{
            flexShrink: 0,
            padding: "0 20px",
            height: 48,
            background: scenarioMode === "impact" ? "#ef4444" : scenarioMode === "nuke" ? "#7c3aed" : scenarioMode === "yellowstone" ? "#ea580c" : scenarioMode === "tsunami" ? "#0ea5e9" : scenarioMode === "cataclysm" ? "#dc2626" : "#f97316",
            color: "white",
            border: "none",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
            opacity: (scenarioMode === "impact" && impactLoading) ? 0.65 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {scenarioMode === "impact"
            ? (impactLoading ? "Running…" : "Run Impact")
            : scenarioMode === "nuke"
            ? (nukeLoading ? "Detonating…" : "☢️ Detonate")
            : scenarioMode === "yellowstone"
            ? "🌋 Erupt"
            : scenarioMode === "tsunami"
            ? (proTier === "free" ? "🔒 Pro Only" : "🌊 Trigger")
            : scenarioMode === "cataclysm"
            ? (cataclysmAnimating ? "Displacing…" : "☄️ Trigger")
            : "Execute Flood"}
        </button>

        {/* Right: chevron toggle to open drawer */}
        <button
          onPointerDown={(e) => { e.stopPropagation(); setDrawerOpen((v) => !v); }}
          style={{ flexShrink: 0, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid #1e2d45", borderRadius: 10, cursor: "pointer", fontSize: 18, color: "#94a3b8" }}
        >
          {drawerOpen ? "⌄" : "⌃"}
        </button>
      </div>

      {/* ── Wikipedia slide-in panel ── */}
      {wikiPanel && (
        <div style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(420px, 100vw)",
          background: "#0a0f1e",
          borderLeft: "1px solid rgba(217,119,6,0.25)",
          zIndex: 2000,
          display: "flex", flexDirection: "column",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.6)",
          fontFamily: "Arial,sans-serif",
          animation: "dmWikiSlideIn .25s ease",
        }}>
          <style>{`@keyframes dmWikiSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(217,119,6,0.15)",
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.3, flex: 1, marginRight: 12 }}>
              🗿 {wikiPanel.title}
            </div>
            <button
              onClick={() => setWikiPanel(null)}
              style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 4 }}
            >✕</button>
          </div>
          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            {wikiPanel.proGate ? (
              <div style={{ paddingTop: 24, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📖</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>Wikipedia Panel</div>
                <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, marginBottom: 20 }}>
                  Read full site summaries, see photos, and explore history — included with Pro.
                </div>
                <button
                  onClick={() => window.open("https://buy.stripe.com/8x23cv7eE9w62qa6vra3u09", "_blank")}
                  style={{ width: "100%", padding: "11px", background: "linear-gradient(135deg,#d97706,#b45309)", border: "none", borderRadius: 9, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}
                >
                  🔓 Upgrade to Pro
                </button>
                <button onClick={() => setWikiPanel(null)} style={{ width: "100%", padding: "8px", background: "transparent", border: "1px solid #1e2d45", borderRadius: 9, color: "#64748b", fontSize: 13, cursor: "pointer" }}>
                  Close
                </button>
              </div>
            ) : wikiPanel.loading ? (
              <div style={{ color: "#64748b", fontSize: 13, fontStyle: "italic", paddingTop: 20 }}>Loading…</div>
            ) : (
              <>
                {wikiPanel.thumbnail && (
                  <img src={wikiPanel.thumbnail} alt={wikiPanel.title}
                    style={{ width: "100%", borderRadius: 8, marginBottom: 16, maxHeight: 220, objectFit: "cover" }} />
                )}
                {wikiPanel.mpSubtitle && (
                  <p style={{ fontSize: 11, color: "#64748b", marginBottom: 10, marginTop: -4 }}>{wikiPanel.mpSubtitle}</p>
                )}
                {wikiPanel.extract ? (
                  <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7, fontWeight: 300 }}>{wikiPanel.extract}</p>
                ) : (
                  <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
                    {wikiPanel.gemWiki ? "Click below to view full plant data on GEM Wiki." : "No description available."}
                  </p>
                )}
                {wikiPanel.wikidataId && (
                  <div style={{ marginTop: 14, padding: "8px 12px", background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.2)", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "#92400e", marginBottom: 2 }}>Wikidata</div>
                    <a href={`https://www.wikidata.org/wiki/${wikiPanel.wikidataId}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "#d97706", textDecoration: "none" }}>
                      {wikiPanel.wikidataId} ↗
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
          {/* Footer */}
          {!wikiPanel.proGate && wikiPanel.url && (
            <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(217,119,6,0.15)", flexShrink: 0 }}>
              <a href={wikiPanel.url} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "block", padding: "10px", textAlign: "center",
                  background: "rgba(217,119,6,0.1)", border: "1px solid rgba(217,119,6,0.3)",
                  borderRadius: 8, color: "#d97706", fontSize: 13, fontWeight: 600,
                  textDecoration: "none",
                }}>
                {wikiPanel.mpUrl ? "View on Megalithic Portal" : wikiPanel.gemWiki ? "View on GEM Wiki" : "Open full article on Wikipedia →"}
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── SCENARIO WIKI PANEL ── */}
      {scenarioWiki && (
        <div style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(420px, 100vw)",
          background: "#0a0f1e",
          borderLeft: "1px solid rgba(248,113,113,0.25)",
          zIndex: 2001,
          display: "flex", flexDirection: "column",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.6)",
          fontFamily: "Arial,sans-serif",
          animation: "dmWikiSlideIn .25s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #1e2d45" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>{scenarioWiki.icon}</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{scenarioWiki.title}</div>
            </div>
            <button onClick={() => setScenarioWiki(null)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20, padding: 4 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px", color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: scenarioWiki.body }} />
          <div style={{ padding: "12px 20px", borderTop: "1px solid #1e2d45", fontSize: 11, color: "#374151", textAlign: "center" }}>
            DisasterMap — Educational content
          </div>
        </div>
      )}
    </div>
  );
}
