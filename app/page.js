"use client";
// DisasterMap.ca — Homepage
// Place at: app/page.js  |  Move map to: app/map/page.js

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

// ── JSON-LD structured data ───────────────────────────────────────────────────
const JSONLD_WEBAPP = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Disaster Map",
  alternateName: ["DisasterMap", "DisasterMap.ca", "Global Catastrophe Simulator"],
  url: "https://www.disastermap.ca",
  description:
    "Interactive global catastrophe simulator. Model asteroid impacts, nuclear detonations, mega-tsunamis, supervolcano eruptions, sea level rise, and crustal displacement pole shift events on a real-time 3D globe using peer-reviewed physics models and ETOPO1 terrain data.",
  applicationCategory: "EducationApplication",
  applicationSubCategory: "Science Simulation",
  operatingSystem: "Web Browser",
  inLanguage: "en",
  isAccessibleForFree: true,
  featureList: [
    "Asteroid impact simulation with crater, blast, thermal, EMP, and tsunami modeling",
    "Nuclear detonation radius calculator with EMP, fallout, and multiple simultaneous strikes",
    "Sea level rise flood mapping from -11000m to +3048m with pixel-accurate ETOPO1 terrain",
    "Volcano simulation: 1,215 Holocene volcanoes, VEI-scaled eruption zones, Smithsonian GVP data",
    "Supervolcano eruption ash zone modeling (Yellowstone, Toba, Campi Flegrei) with global casualties",
    "Earthquake simulation with MMI intensity rings, active fault line overlay, and tsunami trigger",
    "16,000+ active fault lines from GEM Global dataset with slip rates and recurrence intervals",
    "Mega-tsunami wave propagation (La Palma, Cumbre Vieja, Cascadia, Alaska) with arrival times",
    "Storm surge modeling from tropical storm through Category 5",
    "Pole shift inundation models (Ben Davidson 90 degree, TES ECDO 104 degree)",
    "Real-time 3D globe rendering with WebGL, satellite view, and globe projection",
    "Population exposure and casualty estimation using GPW v4",
  ],
  offers: [
    { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free" },
    { "@type": "Offer", price: "18.99", priceCurrency: "USD", name: "Pro", description: "One-time payment" },
    { "@type": "Offer", price: "18.99", priceCurrency: "USD", name: "Pro", description: "One-time payment, no subscription" },
  ],
  author: { "@type": "Person", name: "Grimerica", url: "https://x.com/grimerica", sameAs: ["https://x.com/grimerica"] },
  dateCreated: "2025-01-01",
  keywords: "asteroid impact, nuclear blast, flood map, sea level rise, supervolcano, mega-tsunami, pole shift, ECDO, cataclysm, disaster simulation",
};

const JSONLD_FAQ = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "How accurate is Disaster Map's flood simulation?", acceptedAnswer: { "@type": "Answer", text: "Flood inundation is calculated in real time using ETOPO1 global elevation data (NOAA, 1 arc-minute resolution). Each map tile calculates terrain elevation versus requested sea level, yielding pixel-accurate static inundation. Dynamic effects like storm surge or erosion are not modeled." } },
    { "@type": "Question", name: "What physics model is used for asteroid impacts?", acceptedAnswer: { "@type": "Answer", text: "Crater scaling uses Melosh (1989) impact cratering laws. Blast and thermal radii derive from Collins et al. (2005) Earth Impact Effects Program. Tsunami generation uses geometric spreading decay from Satake (2012)." } },
    { "@type": "Question", name: "What is the ECDO pole shift theory?", acceptedAnswer: { "@type": "Answer", text: "ECDO (Exothermic Core-Mantle Decoupling Oscillation) is a theoretical model by The Ethical Skeptic proposing a 104 degree crustal displacement event. Ben Davidson (Suspicious Observers) proposes a 90 degree displacement linked to solar micronova cycles. Both are theoretical, clearly labeled, and simulated as presented by their authors." } },
    { "@type": "Question", name: "Is Disaster Map free to use?", acceptedAnswer: { "@type": "Answer", text: "Yes. The free tier allows 10 simulations per hour and 30 per day across all 9 scenarios. Pro starts at $15.99/year or $29.99 lifetime — unlocking higher limits, globe view, satellite mode, and full map interaction." } },
    { "@type": "Question", name: "How are casualty estimates calculated?", acceptedAnswer: { "@type": "Answer", text: "Casualty estimates use GPW v4 (Gridded Population of the World, CIESIN 2018). Deaths are estimated by applying zone-specific mortality rates against exposed population counts within each impact zone." } },
  ],
};

// ── Scenario data ─────────────────────────────────────────────────────────────
const SCENARIOS = [
  { emoji: "🌍", name: "Climate Change", tagline: "1.5°C to 4°C · Sea Rise · Wildfires · Ice Collapse", color: "#22c55e", desc: "Model IPCC sea level projections from Paris 1.5°C target through 4°C catastrophic warming. Cumulative wildfire risk zones across California, Amazon, Mediterranean, Siberia and more. West Antarctic and Greenland ice sheet collapse. Auto-flies to at-risk cities.", science: "IPCC AR6 · ETOPO1 · GPW v4" },
  { emoji: "🌊", name: "Sea Level Change", tagline: "−11,000m to +3,048m", color: "#3b82f6", desc: "Visualize coastal flooding at any sea level from deep ocean trenches to full ice melt. Model ice age glaciation, modern IPCC projections, or complete ice sheet collapse. Real ETOPO1 terrain, pixel-accurate inundation.", science: "ETOPO1 · IPCC AR6 · GPW v4" },
  { emoji: "💥", name: "Asteroid Impact", tagline: "50m to 20km diameter · 11–72 km/s", color: "#ef4444", desc: "Drop any asteroid anywhere on Earth. Calculate crater diameter, blast radius, thermal zone, EMP range, and ocean tsunami generation. Adjust velocity, composition, and angle. Multiple simultaneous impacts for Pro.", science: "Melosh 1989 · Collins et al. 2005 · Satake 2012" },
  { emoji: "☢️", name: "Nuclear Detonation", tagline: "1kt to 100Mt yield", color: "#a78bfa", desc: "Detonate any nuclear device from tactical warhead to Tsar Bomba scale. Models fireball, blast zones, thermal radiation, EMP radius, and fallout plume. Up to 5 simultaneous strikes for Pro users.", science: "Glasstone & Dolan 1977" },
  { emoji: "🌋", name: "Volcanoes", tagline: "1,215 Holocene Volcanoes · Supervolcano Sims", color: "#f97316", desc: "Browse all 1,215 Holocene volcanoes from the Smithsonian GVP dataset. Click any to see eruption history, VEI rating, tectonic setting, and simulate an eruption. Supervolcano presets (Yellowstone, Toba, Campi Flegrei) with full ash zone modeling and global casualty estimates.", science: "GVP Smithsonian · Mastin et al. 2009 · Self 2006 · Ambrose 1998" },
  { emoji: "🌍", name: "Earthquake + Tsunami", tagline: "MMI rings · Active Fault Lines · Tsunami trigger", color: "#fbbf24", desc: "Place any earthquake with custom magnitude, depth, fault type and strike. Seismic intensity rings with survival odds and action advice. 16,000+ active fault lines from GEM Global dataset — click to load fault parameters. M7.5+ thrust faults auto-trigger tsunami simulation with coastal impact dots.", science: "USGS ShakeMap · GEM Global Faults · Wells & Coppersmith 1994" },
  { emoji: "🌊", name: "Mega-Tsunami", tagline: "La Palma · Cascadia · Alaska · Cumbre Vieja", color: "#0ea5e9", desc: "Four catastrophic wave sources: La Palma, Cumbre Vieja, Cascadia M9+ subduction, and Alaska Aleutian collapse. Wave propagation ellipses with height estimates, arrival times, and inundation zones. Click within the wave zone for arrival time and height estimates.", science: "Ward & Day 2001 · Satake 2012 · USGS" },
  { emoji: "🌀", name: "Storm Surge", tagline: "T.Storm to Cat 5 · Localised coastal surge", color: "#38bdf8", desc: "Model localised coastal storm surge from any tropical cyclone category. Place surge points along coastlines and calculate inundation from T.Storm through Category 5 conditions. Based on NHC storm surge classifications.", science: "NHC Storm Surge · ETOPO1" },
  { emoji: "☄️", name: "Pole Shift / ECDO", tagline: "Ben Davidson 90° · TES ECDO 104°", color: "#dc2626", desc: "Two theoretical crustal displacement models. 3D globe animation shows the displacement event, then renders inundation zones accounting for equatorial bulge shift and regional ocean surge. Clearly labeled theoretical.", science: "Ben Davidson · The Ethical Skeptic · Hapgood 1958" },
];

// ── Full source list ──────────────────────────────────────────────────────────
const SOURCES = [
  {
    category: "Climate Change & Wildfire",
    color: "#22c55e",
    items: [
      { name: "IPCC AR6 WG1 (2021)", title: "Climate Change 2021: The Physical Science Basis — Sea Level Rise", publisher: "Intergovernmental Panel on Climate Change", use: "SSP1-2.6 and SSP5-8.5 sea level projections for 2050 and 2100. 1.5°C, 2°C, 3°C, 4°C warming scenario sea level estimates used for climate mode presets.", url: "https://www.ipcc.ch/report/ar6/wg1/" },
      { name: "Bamber et al. (2019)", title: "Ice sheet contributions to future sea-level rise from structured expert judgment", publisher: "PNAS 116(23), 11195–11200", use: "West Antarctic Ice Sheet collapse (+3.3m) and Greenland full melt (+7m) estimates for ice sheet collapse presets.", url: "https://doi.org/10.1073/pnas.1817205116" },
      { name: "Abatzoglou & Williams (2016)", title: "Impact of anthropogenic climate change on wildfire across western US forests", publisher: "PNAS 113(42), 11770–11775", use: "Warming-level wildfire risk zone calibration for western North America. Documented doubling of fire-affected area per degree of warming.", url: "https://doi.org/10.1073/pnas.1607171113" },
      { name: "Jones et al. (2022)", title: "Global and regional trends and drivers of fire under climate change", publisher: "Reviews of Geophysics 60(3)", use: "Global wildfire expansion zones by warming level — Amazon, Mediterranean, Siberia, Australia — used to calibrate 1.5°C through 4°C wildfire ellipse placement.", url: "https://doi.org/10.1029/2022RG000798" },
    ],
  },
  {
    category: "Impact & Nuclear Physics",
    color: "#ef4444",
    items: [
      { name: "Melosh, H.J. (1989)", title: "Impact Cratering: A Geologic Process", publisher: "Oxford University Press", use: "Crater diameter scaling laws: D = f(KE, target strength, gravity). Transient-to-final diameter collapse ratios.", url: "https://ui.adsabs.harvard.edu/abs/1989icgp.book.....M" },
      { name: "Collins et al. (2005)", title: "Earth Impact Effects Program", publisher: "Meteoritics & Planetary Science 40(6), 817–840", use: "Blast overpressure zones, thermal fluence, seismic magnitude, tsunami height from impactor energy, velocity, and composition.", url: "https://doi.org/10.1111/j.1945-5100.2005.tb00157.x" },
      { name: "Glasstone & Dolan (1977)", title: "The Effects of Nuclear Weapons, 3rd Ed.", publisher: "U.S. Dept. of Defense / ERDA", use: "Fireball radius, blast overpressure zones (5 psi / 2 psi), thermal radiation, EMP radius — all scaled to yield in kilotons/megatons.", url: "https://www.dtic.mil/dtic/tr/fulltext/u2/a087568.pdf" },
    ],
  },
  {
    category: "Terrain, Sea Level & Population",
    color: "#3b82f6",
    items: [
      { name: "ETOPO1 (NOAA, 2009)", title: "1 Arc-Minute Global Relief Model of Earth's Surface", publisher: "NOAA National Centers for Environmental Information", use: "Base terrain and bathymetry for all flood inundation tile calculations. 1 arc-minute (~1.8km) global resolution.", url: "https://www.ngdc.noaa.gov/mgg/global/" },
      { name: "IPCC AR6 (2021)", title: "Climate Change 2021: The Physical Science Basis", publisher: "Intergovernmental Panel on Climate Change", use: "Sea level rise projection framing and scenario context for flood level presets.", url: "https://www.ipcc.ch/report/ar6/wg1/" },
      { name: "GPW v4 (CIESIN, 2018)", title: "Gridded Population of the World, Version 4", publisher: "Columbia University SEDAC", use: "Population density raster for all casualty and displacement estimates. Applied per zone using zone-specific mortality rates.", url: "https://sedac.ciesin.columbia.edu/data/collection/gpw-v4" },
    ],
  },
  {
    category: "Volcanology",
    color: "#f97316",
    items: [
      { name: "Mastin et al. (2009)", title: "A multidisciplinary effort to assign realistic source parameters to models of volcanic ash-cloud transport and deposition", publisher: "Journal of Volcanology and Geothermal Research 186(1–2)", use: "Ash dispersal ellipse geometry: major axis scaled to VEI, minor axis at 0.6×, oriented at 70° prevailing jet stream bearing.", url: "https://doi.org/10.1016/j.jvolgeores.2009.01.006" },
      { name: "Self, S. (2006)", title: "The effects and consequences of very large explosive volcanic eruptions", publisher: "Philosophical Transactions of the Royal Society A 364(1845)", use: "Supervolcano climate impact thresholds and survival zone mortality estimates for Yellowstone/Toba scale events.", url: "https://doi.org/10.1098/rsta.2005.1728" },
      { name: "Ambrose, S.H. (1998)", title: "Late Pleistocene human population bottlenecks, volcanic winter, and differentiation of modern humans", publisher: "Journal of Human Evolution 34(6)", use: "Toba (VEI-8) eruption calibration for population survival thresholds in the Toba preset.", url: "https://doi.org/10.1006/jhev.1998.0219" },
    ],
  },
  {
    category: "Earthquake & Fault Lines",
    color: "#fbbf24",
    items: [
      { name: "Wells & Coppersmith (1994)", title: "New empirical relationships among magnitude, rupture length, rupture width, rupture area, and surface displacement", publisher: "Bulletin of the Seismological Society of America 84(4)", use: "Fault length from magnitude scaling (log L = 0.59M - 2.44) used for earthquake tsunami ellipse geometry and rupture zone estimation.", url: "https://doi.org/10.1785/BSSA0840041153" },
      { name: "GEM Global Active Faults (2019)", title: "GEM Global Active Faults Database", publisher: "GEM Foundation / OpenQuake", use: "16,195 active fault traces worldwide. Properties include slip type, average dip, rake, slip rate, seismogenic depth used for fault line overlay and earthquake parameter auto-population.", url: "https://github.com/GEMScienceTools/gem-global-active-faults" },
      { name: "USGS ShakeMap (Worden et al. 2020)", title: "ShakeMap Manual: Technical Manual, Users Guide, and Software Guide", publisher: "U.S. Geological Survey", use: "MMI intensity ring calibration: M9.1 Tohoku observed zones (X+~60km, IX~110km, V~1000km) used to calibrate attenuation formula.", url: "https://usgs.github.io/shakemap/" },
      { name: "Smithsonian GVP (2023)", title: "Global Volcanism Program — Volcanoes of the World", publisher: "Smithsonian Institution", use: "1,215 Holocene volcano locations with type, last eruption year, evidence category, tectonic setting and photos. Powers the volcano overlay and eruption simulation.", url: "https://volcano.si.edu/" },
    ],
  },
  {
    category: "Tsunami & Wave Physics",
    color: "#0ea5e9",
    items: [
      { name: "Ward & Day (2001)", title: "Cumbre Vieja Volcano — potential collapse and tsunami at La Palma, Canary Islands", publisher: "Geophysical Research Letters 28(17)", use: "Source parameters and wave height estimates for La Palma and Cumbre Vieja mega-tsunami scenarios.", url: "https://doi.org/10.1029/2001GL013374" },
      { name: "Satake, K. (2012)", title: "Tsunamis: Seismic Generation, Energy Propagation, Run-Up, and Inundation", publisher: "Annual Review of Earth and Planetary Sciences 40", use: "Geometric spreading decay model: H(r) = H₀ × (r₀/r)^0.5. Applied to all tsunami wave height falloff calculations.", url: "https://doi.org/10.1146/annurev-earth-042711-105343" },
      { name: "USGS Cascadia Subduction Zone", title: "M9+ Rupture Scenarios and Pacific Wave Modeling", publisher: "United States Geological Survey", use: "Source geometry, ellipse orientation, and wave height parameters for the Cascadia tsunami scenario.", url: "https://www.usgs.gov/programs/earthquake-hazards/science/cascadia-subduction-zone" },
    ],
  },
  {
    category: "Pole Shift / ECDO — Theoretical Models",
    color: "#dc2626",
    items: [
      { name: "Ben Davidson — Suspicious Observers", title: "Solar Micronova & 90° Crustal Displacement Model", publisher: "Suspicious0bservers / Space Weather News (YouTube)", use: "90° shift bearing, new pole at S. Atlantic, 12-hour event. Davidson model flood zones and regional surge for Mediterranean, Europe, S. America.", url: "https://www.youtube.com/@SuspiciousObservers" },
      { name: "The Ethical Skeptic (TES)", title: "ECDO Theory: Exothermic Core-Mantle Decoupling Oscillation", publisher: "theethicalskeptic.com", use: "104° rotation bearing, new pole at S. Pacific, 8-hour event. TES model inundation zones, Pacific basin resonance multiplier, global dynamic surge.", url: "https://theethicalskeptic.com" },
      { name: "Hapgood, C.H. (1958)", title: "Earth's Shifting Crust: A Key to Some Basic Problems of Earth Science", publisher: "Pantheon Books (foreword by Albert Einstein)", use: "Foundational crustal displacement hypothesis — geological evidence framework referenced by both Davidson and TES models.", url: "https://archive.org/details/earthsshiftingcr00happ" },
      { name: "Velikovsky, I. (1950)", title: "Worlds in Collision", publisher: "Macmillan", use: "Catastrophism literature context — historical record of rapid geophysical events.", url: "https://archive.org/details/worldsincollisio00veli" },
    ],
  },
  {
    category: "Computation & Infrastructure",
    color: "#a78bfa",
    items: [
      { name: "Mapbox GL JS v3", title: "WebGL Map Rendering Engine", publisher: "Mapbox Inc.", use: "Real-time 3D globe, raster tile layer rendering, camera animation, bearing/projection control for all scenarios.", url: "https://docs.mapbox.com/mapbox-gl-js/" },
      { name: "NumPy / SciPy", title: "Scientific Python Stack", publisher: "Open Source", use: "ETOPO1 terrain raster processing, flood depth grid calculation, ellipse geometry for zone modeling across all scenarios.", url: "https://numpy.org" },
      { name: "FastAPI (Python)", title: "Tile Server Backend", publisher: "Open Source", use: "Real-time PNG tile generation endpoint. Computes flood, impact, ash, and cataclysm inundation at each requested zoom/x/y.", url: "https://fastapi.tiangolo.com" },
    ],
  },
];

// ── Key equations ─────────────────────────────────────────────────────────────
const EQUATIONS = [
  { name: "Crater Diameter", eq: "D = 1.56 × (KE / σ)^0.294", desc: "Melosh (1989). KE = kinetic energy, σ = target strength. Applies to transient crater; final diameter scaled by gravitational collapse ratio." },
  { name: "Nuclear Blast (5 psi)", eq: "r₅ = 0.28 × Y^(1/3) km", desc: "Glasstone & Dolan (1977). Y = yield in megatons. Overpressure zones scale as cube root of yield. Light blast ~2.4 km/Mt^⅓." },
  { name: "Tsunami Wave Decay", eq: "H(r) = H₀ × (r₀ / r)^0.5", desc: "Satake (2012). Geometric spreading in open ocean. H₀ = initial wave height at source r₀. Shoaling amplification not modeled." },
  { name: "Pole Shift Flood Depth", eq: "d = f(Δθ) × H_max", desc: "Equatorial bulge redistribution. Angular displacement Δθ from point to new equatorial belt determines flood fraction of H_max." },
  { name: "Ash Ellipse Major Axis", eq: "R = C × 10^(0.22 × VEI) km", desc: "Mastin et al. (2009). VEI-scaled empirical formula. Minor axis = 0.6 × major. Ellipse at 70° bearing for prevailing jet stream." },
  { name: "Population Exposure", eq: "N = Σ GPW(x,y) × A(x,y)", desc: "Sum of GPW v4 population density × cell area over all grid cells within impact footprint. Zone mortality rates applied per ring." },
];

// ── FAQ ───────────────────────────────────────────────────────────────────────
const FAQS = [
  { q: "What climate change scenarios are modeled?", a: "Climate mode uses IPCC AR6 sea level projections — from the 1.5°C Paris target (+0.3m) through 4°C catastrophic warming (+1.5m), plus 2050 and 2100 low/high scenarios. Cumulative wildfire risk zones appear for warming presets, sourced from Abatzoglou & Williams (2016) and Jones et al. (2022). Ice sheet collapse presets include West Antarctic (+3.3m), Greenland full melt (+7m), and both combined (+10m)." },
  { q: "How accurate is the flood simulation?", a: "Flood inundation uses ETOPO1 terrain data (NOAA, 1 arc-minute resolution — roughly 1.8km cells globally). Each tile calculates terrain elevation versus requested sea level, producing pixel-accurate static inundation. Dynamic effects like storm surge, erosion, or groundwater are not modeled. Best for large-scale scenario visualization, not engineering-grade coastal assessment." },
  { q: "What physics model powers the asteroid impact calculator?", a: "Crater scaling uses Melosh (1989) transient-to-final diameter ratios. Blast and thermal radii use Collins et al. (2005) Earth Impact Effects Program methodology. Casualty estimates combine GPW v4 population data with zone-specific mortality rates (100% fireball, declining through blast and thermal zones)." },
  { q: "What is the ECDO / pole shift theory?", a: "ECDO (Exothermic Core-Mantle Decoupling Oscillation) is a theoretical model by The Ethical Skeptic proposing a 104° crustal displacement event driven by core-mantle thermal dynamics. Ben Davidson (Suspicious Observers) proposes a 90° displacement linked to solar micronova cycles. Both are theoretical — clearly labeled throughout the app — and simulated as presented by their authors. Disaster Map does not endorse or refute these theories." },
  { q: "How are casualty estimates calculated?", a: "Population exposure uses GPW v4 (Gridded Population of the World v4, CIESIN 2018). Deaths are estimated by applying zone-specific mortality rates against exposed population counts. These are rough educational approximations — not suitable for emergency planning or public health use." },
  { q: "Is Disaster Map free to use?", a: "Yes. The free tier provides access to all 9 scenarios including browsing 1,215 volcanoes, earthquake simulation, and fault line viewing — with 10 simulations per hour and 30 per day. The map locks after triggering a catastrophe. Pro starts at $15.99/year or $29.99 lifetime — unlocking globe view, satellite mode, active fault line overlay, full volcano eruption simulation, and higher limits." },
  { q: "What supervolcano and volcano data is used?", a: "All 1,215 Holocene volcanoes use the Smithsonian Global Volcanism Program (GVP) dataset. Ash dispersal ellipses use VEI-scaled major axis lengths from Mastin et al. (2009). VEI is estimated from volcano type: supervolcanoes and calderas (VEI 7-8), stratovolcanoes (VEI 6), shield volcanoes (VEI 3). Survival thresholds calibrate to Self (2006) and Ambrose (1998)." },
  { q: "How does the earthquake and fault line simulation work?", a: "Earthquakes use USGS ShakeMap-calibrated attenuation for MMI intensity rings (M9.1 Tohoku observed zones used for calibration). The active fault line overlay uses GEM Global Active Faults (16,195 faults) with slip type, dip, rake, and slip rate. Clicking a fault loads its parameters automatically. M7.5+ thrust/reverse faults trigger a tsunami simulation with coastal impact dots and ellipse-shaped inundation zones derived from fault geometry." },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function Homepage() {
  const canvasRef = useRef(null);
  const [openFaq, setOpenFaq] = useState(null);
  const { isSignedIn } = useUser();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    const stars = Array.from({ length: 500 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.4 + 0.2,
      base: Math.random() * 0.55 + 0.15,
      speed: Math.random() * 0.0007 + 0.0002,
      phase: Math.random() * Math.PI * 2,
    }));
    let t = 0;
    const draw = () => {
      t++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        const a = s.base * (0.6 + 0.4 * Math.sin(t * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${a})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  const S = { fontFamily: "'Georgia','Times New Roman',serif", background: "#020817", color: "#e2e8f0", minHeight: "100vh" };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD_WEBAPP) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD_FAQ) }} />

      <div style={S}>
        <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", zIndex: 0, pointerEvents: "none", opacity: 0.75 }} />

        <div style={{ position: "relative", zIndex: 1, minHeight: "100vh" }}>

          {/* NAV */}
          <nav style={{ position: "sticky", top: 0, zIndex: 100, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 40px", background: "rgba(2,8,23,0.88)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: "0.08em", color: "#fff" }}>☄️&nbsp;DISASTER MAP</div>
            <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
              {[["Scenarios","#scenarios"],["Science","#science"],["Pricing","#pricing"],["FAQ","#faq"]].map(([l,h]) => (
                <a key={l} href={h} style={{ color: "#94a3b8", textDecoration: "none", fontSize: 14 }}
                  onMouseEnter={e=>e.currentTarget.style.color="#e2e8f0"} onMouseLeave={e=>e.currentTarget.style.color="#94a3b8"}>{l}</a>
              ))}
              {isSignedIn
                ? <UserButton afterSignOutUrl="/" />
                : <SignInButton mode="modal" afterSignInUrl="/map" afterSignUpUrl="/map">
                    <button style={{ background: "transparent", color: "#94a3b8", border: "1px solid #64748b", padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", marginRight: 8 }}>
                      Sign In
                    </button>
                  </SignInButton>
              }
              <Link href="/map" style={{ background: "#f97316", color: "#fff", padding: "9px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 14 }}>Launch App →</Link>
            </div>
          </nav>

          {/* HERO */}
          <section style={{ maxWidth: 960, margin: "0 auto", padding: "110px 40px 80px", textAlign: "center" }}>
            <div style={{ display: "inline-block", fontSize: 11, letterSpacing: "0.25em", color: "#f97316", textTransform: "uppercase", marginBottom: 24, padding: "6px 16px", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 20 }}>
              Interactive Global Catastrophe Simulator
            </div>
            <h1 style={{ fontSize: "clamp(44px,8vw,88px)", fontWeight: 700, lineHeight: 1.05, margin: "0 0 28px", color: "#fff", fontStyle: "italic", letterSpacing: "-0.02em" }}>
              Simulate Earth's<br />Greatest Threats
            </h1>
            <p style={{ fontSize: 20, color: "#94a3b8", maxWidth: 640, margin: "0 auto 44px", lineHeight: 1.8 }}>
              Climate change. Asteroid impacts. Nuclear detonations. Mega-tsunamis. Volcanoes. Earthquakes.
              Sea level rise. Storm surge. Crustal displacement. All on a live 3D globe —
              powered by IPCC projections, peer-reviewed physics and real terrain data.
            </p>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/map" style={{ background: "#f97316", color: "#fff", padding: "17px 44px", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: 18, boxShadow: "0 0 40px rgba(249,115,22,0.35)" }}>
                Launch Free →
              </Link>
              <a href="#scenarios" style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#64748b", padding: "17px 44px", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: 18 }}>
                Explore Scenarios
              </a>
            </div>
            {!isSignedIn && (
              <div style={{ marginTop: 20, fontSize: 14, color: "#64748b", fontFamily: "sans-serif" }}>
                Already have Pro?{" "}
                <SignInButton mode="modal" afterSignInUrl="/map" afterSignUpUrl="/map">
                  <span style={{ color: "#f97316", cursor: "pointer", fontWeight: 700, textDecoration: "underline" }}>
                    Sign in to restore access →
                  </span>
                </SignInButton>
              </div>
            )}
          </section>

          {/* AD SLOT 1 */}
          <div style={{ maxWidth: 728, margin: "0 auto 48px", padding: "0 40px", textAlign: "center", minHeight: 90 }}>
            {/* Ad Unit: Top Leaderboard 728×90 */}
          </div>

          {/* TRUST BAR */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.015)" }}>
            <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 40px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 24, textAlign: "center" }}>
              {[["9","Disaster Scenarios"],["1,215","Holocene Volcanoes"],["16,000+","Active Fault Lines"],["ETOPO1","Global Terrain"],["GPW v4","Population Data"],["Free","To Start"]].map(([v,l]) => (
                <div key={v}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#f97316", fontStyle: "italic" }}>{v}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* SCENARIOS */}
          <section id="scenarios" style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 40px" }}>
            <h2 style={{ fontSize: 38, fontWeight: 700, textAlign: "center", marginBottom: 10, fontStyle: "italic" }}>Nine Catastrophe Scenarios</h2>
            <p style={{ textAlign: "center", color: "#64748b", marginBottom: 56, fontSize: 16, lineHeight: 1.7 }}>
              Each model uses peer-reviewed science, real terrain data, and published casualty frameworks.
              Theoretical models are clearly labeled.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 20 }}>
              {SCENARIOS.map(s => (
                <Link key={s.name} href="/map" style={{ textDecoration: "none" }}>
                  <article style={{ border: `1px solid ${s.color}18`, borderLeft: `3px solid ${s.color}`, background: "rgba(255,255,255,0.018)", borderRadius: 12, padding: "24px", cursor: "pointer", transition: "all 0.18s", height: "100%", boxSizing: "border-box" }}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.048)";e.currentTarget.style.transform="translateY(-2px)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.018)";e.currentTarget.style.transform="none";}}>
                    <div style={{ fontSize: 34, marginBottom: 14 }}>{s.emoji}</div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>{s.name}</h3>
                    <div style={{ fontSize: 11, color: s.color, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>{s.tagline}</div>
                    <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.75, margin: "0 0 14px" }}>{s.desc}</p>
                    <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.04em" }}>📚 {s.science}</div>
                  </article>
                </Link>
              ))}
            </div>
          </section>

          {/* AD SLOT 2 */}
          <div style={{ maxWidth: 728, margin: "0 auto 48px", padding: "0 40px", textAlign: "center", minHeight: 90 }}>
            {/* Ad Unit: Mid Leaderboard 728×90 */}
          </div>

          {/* SCIENCE & SOURCES */}
          <section id="science" style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 40px" }}>
              <h2 style={{ fontSize: 38, fontWeight: 700, textAlign: "center", marginBottom: 10, fontStyle: "italic" }}>Models, Papers & Sources</h2>
              <p style={{ textAlign: "center", color: "#64748b", marginBottom: 8, fontSize: 16, maxWidth: 640, margin: "0 auto 8px" }}>
                Disaster Map is built on peer-reviewed science, established datasets, and clearly-labeled theoretical models.
                Full source list below for transparency and reproducibility.
              </p>
              <p style={{ textAlign: "center", color: "#475569", marginBottom: 56, fontSize: 13 }}>
                This page is structured for indexing by search engines and AI systems to accurately represent our scientific methodology.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 48 }}>
                {SOURCES.map(cat => (
                  <div key={cat.category}>
                    <div style={{ fontSize: 11, letterSpacing: "0.18em", color: cat.color, textTransform: "uppercase", marginBottom: 20, fontWeight: 700, paddingBottom: 10, borderBottom: `1px solid ${cat.color}22` }}>
                      {cat.category}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      {cat.items.map(item => (
                        <div key={item.name} style={{ paddingLeft: 16, borderLeft: "2px solid #0f1e30" }}>
                          <a href={item.url} target="_blank" rel="noopener noreferrer"
                            style={{ color: "#c7d2e0", fontWeight: 700, fontSize: 14, textDecoration: "none", display: "block", marginBottom: 2 }}
                            onMouseEnter={e=>e.currentTarget.style.color=cat.color}
                            onMouseLeave={e=>e.currentTarget.style.color="#c7d2e0"}>
                            {item.name} ↗
                          </a>
                          <div style={{ fontSize: 13, color: "#64748b", fontStyle: "italic", marginBottom: 4 }}>{item.title}</div>
                          <div style={{ fontSize: 12, color: "#475569" }}>{item.publisher}</div>
                          <div style={{ fontSize: 12, color: "#475569", marginTop: 6, lineHeight: 1.6 }}>
                            <strong style={{ color: "#60a5fa" }}>Used for:</strong> {item.use}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Equations */}
              <div style={{ marginTop: 64 }}>
                <h3 style={{ fontSize: 24, fontWeight: 700, textAlign: "center", marginBottom: 32, color: "#64748b", fontStyle: "italic" }}>Key Equations</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18 }}>
                  {EQUATIONS.map(m => (
                    <div key={m.name} style={{ background: "#040a14", border: "1px solid #0f1e30", borderRadius: 10, padding: "18px 20px" }}>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>{m.name}</div>
                      <code style={{ fontSize: 15, color: "#f97316", fontFamily: "'Courier New',monospace", display: "block", marginBottom: 10 }}>{m.eq}</code>
                      <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.65 }}>{m.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div style={{ marginTop: 40, padding: "20px 24px", background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)", borderRadius: 10 }}>
                <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.85 }}>
                  <strong style={{ color: "#dc2626" }}>⚠ Disclaimer:</strong> The Pole Shift / ECDO scenarios are <strong>theoretical models</strong> presented for educational and exploratory purposes, clearly labeled as theoretical throughout the application. They are reproduced as presented by Ben Davidson (Suspicious Observers) and The Ethical Skeptic. Disaster Map does not endorse or refute these theories. All other scenarios use peer-reviewed physics and verified terrain data. Casualty estimates are rough educational approximations only — not suitable for emergency planning, insurance, or engineering use.
                </p>
              </div>
            </div>
          </section>

          {/* PRICING */}
          <section id="pricing" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 40px" }}>
            <h2 style={{ fontSize: 38, fontWeight: 700, textAlign: "center", marginBottom: 10, fontStyle: "italic" }}>Simple Pricing</h2>
            <p style={{ textAlign: "center", color: "#64748b", marginBottom: 52, fontSize: 16 }}>Start free with all 9 scenarios. Upgrade to explore without limits.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20 }}>
              {[
                { tier: "Free", price: "$0", period: "forever", color: "#64748b", features: ["All 9 disaster scenarios","10 simulations / hour","30 simulations / day","Browse all 1,215 volcanoes","Supervolcano eruption sims","Earthquake + fault line viewer","Standard map view","Casualty estimates"], cta: null, ctaLabel: "Launch Free" },
                { tier: "Pro Yearly", price: "$15.99", period: "per year", color: "#60a5fa", features: ["All 9 disaster scenarios","50 simulations / hour","200 simulations / day","Globe + Satellite view","Full pan, zoom & explore","Active fault lines overlay","Simulate any volcano eruption","Cancel anytime"], cta: "https://buy.stripe.com/5kQ00jdD2gYy1m62fba3u0s", ctaLabel: "Start Yearly" },
                { tier: "Pro Lifetime", price: "$29.99", period: "one-time · forever", color: "#f97316", badge: "BEST VALUE", features: ["Everything in Yearly","Pay once, forever","No subscription","Priority email support","All future Pro features included"], cta: "https://buy.stripe.com/dRm28rdD2bEec0KaLHa3u0u", ctaLabel: "Unlock Lifetime" },
                { tier: "Developer Kit", price: "Soon", period: "", color: "#a78bfa", badge: null, features: ["Self-hosted backend","All scenario APIs","Your Mapbox key","Your server, your costs","Single license"], cta: null, ctaLabel: "Coming Soon" },
              ].map(p => (
                <div key={p.tier} style={{ border: `1px solid ${p.tier === "Pro Lifetime" ? p.color : p.color + "33"}`, borderRadius: 14, padding: "30px 24px", background: p.tier === "Pro Lifetime" ? "rgba(249,115,22,0.06)" : "rgba(255,255,255,0.018)", display: "flex", flexDirection: "column", position: "relative" }}>
                  {p.badge && <div style={{ position: "absolute", top: -11, left: 26, background: p.color, color: "white", fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 10, letterSpacing: "0.08em" }}>{p.badge}</div>}
                  <div style={{ fontSize: 11, letterSpacing: "0.15em", color: p.color, textTransform: "uppercase", marginBottom: 10 }}>{p.tier}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 24 }}>
                    <span style={{ fontSize: 32, fontWeight: 700, color: "#fff", fontStyle: "italic" }}>{p.price}</span>
                    <span style={{ fontSize: 13, color: "#64748b" }}>{p.period}</span>
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", flex: 1, display: "flex", flexDirection: "column", gap: 11 }}>
                    {p.features.map(f => (
                      <li key={f} style={{ fontSize: 14, color: "#94a3b8", display: "flex", gap: 10, alignItems: "flex-start", lineHeight: 1.5 }}>
                        <span style={{ color: p.color, flexShrink: 0, marginTop: 1 }}>✓</span>{f}
                      </li>
                    ))}
                  </ul>
                  {p.tier === "Pro Lifetime" && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase", marginBottom: 10, fontWeight: 700 }}>Free vs Pro</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {[
                          { free: "30 simulations / day",      pro: "200 simulations / day" },
                          { free: "Asteroid up to 5,000 m",    pro: "Asteroid up to 20,000 m" },
                          { free: "Nuke up to 1 Mt",           pro: "Nuke up to 100 Mt" },
                          { free: "Browse volcanoes free",     pro: "Simulate any eruption" },
                          { free: "Eq. intensity rings",       pro: "Active fault lines overlay" },
                          { free: "Map view only",             pro: "Satellite + Globe view" },
                          { free: "1 zone click popup",        pro: "Unlimited zone popups" },
                          { free: "—",                         pro: "Displaced population count" },
                          { free: "—",                         pro: "🌊 Mega-Tsunami" },
                        ].map(({ free, pro }, i) => (
                          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, fontSize: 12 }}>
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1e2d45", borderRadius: 6, padding: "5px 8px", color: free === "—" ? "#334155" : "#64748b" }}>
                              {free !== "—" ? "✓ " : ""}{free}
                            </div>
                            <div style={{ background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 6, padding: "5px 8px", color: "#fb923c", fontWeight: 600 }}>
                              ⚡ {pro}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {p.cta
                    ? <>
                        <a href={p.cta} target="_blank" rel="noopener noreferrer" style={{ display: "block", background: p.color, color: "#fff", padding: "13px", borderRadius: 8, textAlign: "center", textDecoration: "none", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{p.ctaLabel} →</a>
                        {!isSignedIn && (
                          <SignInButton mode="modal" afterSignInUrl="/map" afterSignUpUrl="/map">
                            <button style={{ width: "100%", padding: "10px", background: "transparent", color: "#94a3b8", border: "1px solid #475569", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "sans-serif" }}>
                              Already purchased? Sign in →
                            </button>
                          </SignInButton>
                        )}
                      </>
                    : <Link href="/map" style={{ display: "block", border: `1px solid ${p.color}44`, color: p.color, padding: "13px", borderRadius: 8, textAlign: "center", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>{p.ctaLabel} →</Link>
                  }
                </div>
              ))}
            </div>
          </section>

          {/* AD SLOT 3 */}
          <div style={{ maxWidth: 728, margin: "0 auto 48px", padding: "0 40px", textAlign: "center", minHeight: 90 }}>
            {/* Ad Unit: Pre-FAQ Leaderboard 728×90 */}
          </div>

          {/* FAQ */}
          <section id="faq" style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ maxWidth: 740, margin: "0 auto", padding: "80px 40px" }}>
              <h2 style={{ fontSize: 38, fontWeight: 700, textAlign: "center", marginBottom: 48, fontStyle: "italic" }}>Frequently Asked Questions</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {FAQS.map((faq, i) => (
                  <div key={i} style={{ border: "1px solid #0f1e30", borderRadius: 10, overflow: "hidden" }}>
                    <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      style={{ width: "100%", padding: "18px 22px", background: openFaq === i ? "#040a14" : "transparent", border: "none", color: "#c7d2e0", textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 15, fontWeight: 600, fontFamily: "inherit", lineHeight: 1.4 }}>
                      <span>{faq.q}</span>
                      <span style={{ color: "#f97316", fontSize: 22, flexShrink: 0, marginLeft: 16 }}>{openFaq === i ? "−" : "+"}</span>
                    </button>
                    {openFaq === i && (
                      <div style={{ padding: "4px 22px 20px", fontSize: 14, color: "#94a3b8", lineHeight: 1.85 }}>{faq.a}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <section style={{ maxWidth: 720, margin: "0 auto", padding: "80px 40px", textAlign: "center" }}>
            <h2 style={{ fontSize: 42, fontWeight: 700, marginBottom: 18, fontStyle: "italic", color: "#fff", lineHeight: 1.1 }}>Ready to Simulate<br />the Apocalypse?</h2>
            <p style={{ color: "#64748b", marginBottom: 40, fontSize: 18, lineHeight: 1.75 }}>Free to start. No account required.<br />Drop an asteroid, flood a continent, or watch a pole shift unfold.</p>
            <Link href="/map" style={{ background: "#f97316", color: "#fff", padding: "19px 56px", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: 20, boxShadow: "0 0 60px rgba(249,115,22,0.4)", display: "inline-block" }}>
              Launch Disaster Map →
            </Link>
          </section>

          {/* FOOTER */}
          <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "36px 40px", textAlign: "center" }}>
            <div style={{ marginBottom: 14, fontWeight: 700, fontSize: 16, letterSpacing: "0.08em", color: "#334155" }}>☄️ DISASTER MAP</div>
            <div style={{ color: "#334155", fontSize: 13, marginBottom: 18 }}>
              © 2025 DisasterMap.ca · Built by <a href="https://x.com/grimerica" target="_blank" rel="noopener noreferrer" style={{ color: "#f97316", textDecoration: "none" }}>@grimerica</a>
            </div>
            <div style={{ display: "flex", gap: 28, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
              {[["Launch App","/map"],["Privacy Policy","/privacy"],["Terms of Use","/terms"],["Contact","https://formspree.io/f/xgopwayn"],["Manage Billing","https://billing.stripe.com/p/login/00w28rcyY4bM8Oy1b7a3u00"]].map(([l,h]) => (
                <a key={l} href={h} style={{ color: "#475569", fontSize: 13, textDecoration: "none" }}
                  onMouseEnter={e=>e.currentTarget.style.color="#f97316"} onMouseLeave={e=>e.currentTarget.style.color="#475569"}>{l}</a>
              ))}
            </div>
            {/* Donate */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: "#334155", marginBottom: 10 }}>Like the project? Help keep the servers running.</div>
              <a
                href="https://www.paypal.com/donate/?hosted_button_id=D7GYDV9ETEPX6"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "#0070ba", color: "#fff",
                  padding: "10px 22px", borderRadius: 8,
                  textDecoration: "none", fontWeight: 700, fontSize: 14,
                  fontFamily: "sans-serif",
                  boxShadow: "0 2px 12px rgba(0,112,186,0.35)",
                }}
                onMouseEnter={e=>e.currentTarget.style.background="#005ea6"}
                onMouseLeave={e=>e.currentTarget.style.background="#0070ba"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <path d="M7.144 19.532l1.049-5.751c.11-.604.699-1.038 1.316-.948 1.65.237 5.543.48 7.369-2.34 2.195-3.393-.44-7.077-5.123-7.077H6.584a1.33 1.33 0 0 0-1.316 1.13L3.1 18.42a.776.776 0 0 0 .766.897h2.545c.377 0 .688-.267.733-.785zm9.012-12.94c.96 1.38.894 3.42-.334 5.28-1.458 2.197-4.213 2.65-6.63 2.463l-.74 4.063h-1.99l1.03-5.674c1.989.218 6.305.187 8.143-3.11.47-.849.693-1.728.52-3.022z"/>
                </svg>
                Donate via PayPal
              </a>
            </div>
          </footer>

        </div>
      </div>
    </>
  );
}
