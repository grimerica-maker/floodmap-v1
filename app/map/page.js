'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';

const API = '/api/ufo';
const DMAP_API = '/api/dmap';
const LS = 'ufomap_filters_v1';

// ── Shape colours ─────────────────────────────────────────────────────────────
const SHAPE_RGB = {
  'Light':[0,255,255],'Triangle':[168,85,247],'Circle':[34,211,238],
  'Fireball':[249,115,22],'Disk':[16,185,129],'Sphere':[59,130,246],
  'Cylinder':[236,72,153],'Cigar':[234,179,8],'Diamond':[96,165,250],
  'Chevron':[244,63,94],'Egg':[132,204,22],'Teardrop':[251,146,60],
  'Cross':[232,121,249],'Cone':[45,212,191],'Rectangle':[251,191,36],
  'Other':[148,163,184],'Unknown':[71,85,105],
};
const SHAPE_HEX = Object.fromEntries(
  Object.entries(SHAPE_RGB).map(([k,[r,g,b]])=>[k,`#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`])
);
function getShapeHex(shape){
  if(!shape) return '#64748b';
  const k=Object.keys(SHAPE_HEX).find(k=>shape.toLowerCase().includes(k.toLowerCase()));
  return k?SHAPE_HEX[k]:'#64748b';
}

// ── Timeline tick labels ──────────────────────────────────────────────────────
const NAMED_EVENTS=[
  {year:1947,label:'ROSWELL'},{year:1952,label:'WASH FLAP'},
  {year:1961,label:'HILL'},{year:1980,label:'RENDLESHAM'},
  {year:1997,label:'PHOENIX'},{year:2004,label:'TIC-TAC'},
  {year:2021,label:'UAP RPT'},{year:2023,label:'GRUSCH'},
];

// ── Famous event markers ──────────────────────────────────────────────────────
const FAMOUS_EVENTS=[
  {year:1947,label:'ROSWELL',lat:33.3943,lng:-104.523,wiki:'https://en.m.wikipedia.org/wiki/Roswell_incident',desc:'Crash of unidentified object near Roswell, NM. USAF initially reported "flying disc" before retracting.'},
  {year:1952,label:'WASH FLAP',lat:38.9072,lng:-77.0369,wiki:'https://en.m.wikipedia.org/wiki/1952_Washington,_D.C._UFO_incident',desc:'UFOs tracked on radar over Washington D.C. for two consecutive weekends.'},
  {year:1961,label:'HILL ABDUCTION',lat:44.2601,lng:-71.5562,wiki:'https://en.m.wikipedia.org/wiki/Barney_and_Betty_Hill_incident',desc:'Betty and Barney Hill reported abduction near Lancaster, NH. First widely publicized abduction case.'},
  {year:1964,label:'SOCORRO',lat:34.0584,lng:-106.8914,wiki:'https://en.m.wikipedia.org/wiki/Lonnie_Zamora_incident',desc:'Police officer Lonnie Zamora witnessed egg-shaped craft and occupants in Socorro, NM.'},
  {year:1975,label:'TRAVIS WALTON',lat:34.2623,lng:-110.0071,wiki:'https://en.m.wikipedia.org/wiki/Travis_Walton_UFO_incident',desc:'Logger Travis Walton allegedly abducted near Snowflake, AZ. Witnessed by 6 coworkers.'},
  {year:1980,label:'RENDLESHAM',lat:52.088,lng:1.4429,wiki:'https://en.m.wikipedia.org/wiki/Rendlesham_Forest_incident',desc:'USAF personnel encountered unexplained lights in Rendlesham Forest, UK.'},
  {year:1986,label:'JAL 1628',lat:64.2008,lng:-153.4937,wiki:'https://en.m.wikipedia.org/wiki/Japan_Air_Lines_cargo_flight_1628',desc:'JAL cargo flight tracked massive UFO over Alaska for 50 minutes. FAA confirmed on radar.'},
  {year:1997,label:'PHOENIX LIGHTS',lat:33.4484,lng:-112.074,wiki:'https://en.m.wikipedia.org/wiki/Phoenix_Lights',desc:'Massive V-shaped craft seen by thousands across Phoenix, AZ.'},
  {year:2004,label:'TIC-TAC',lat:30.5,lng:-117.5,wiki:'https://en.m.wikipedia.org/wiki/USS_Nimitz_UFO_incident',aaro:'https://www.aaro.mil/Portals/136/PDFs/AARO_Historical_Record_Report_Vol_1_2024.pdf',desc:'USS Nimitz pilots intercepted Tic-Tac shaped object off Baja. FLIR video released by Pentagon.'},
  {year:2006,label:"O'HARE",lat:41.9742,lng:-87.9073,wiki:"https://en.m.wikipedia.org/wiki/2006_O%27Hare_International_Airport_UFO_sighting",desc:"United Airlines employees observed metallic disc at Gate C17 at O'Hare."},
  {year:2015,label:'GIMBAL',lat:30.0,lng:-80.0,wiki:'https://en.m.wikipedia.org/wiki/Pentagon_UFO_videos',aaro:'https://www.aaro.mil/Portals/136/PDFs/AARO_Historical_Record_Report_Vol_1_2024.pdf',desc:'US Navy pilots tracked rotating object off Florida. One of three Pentagon-released UAP videos.'},
  {year:2021,label:'UAP REPORT',lat:38.9072,lng:-77.0369,wiki:'https://en.m.wikipedia.org/wiki/Pentagon_UAP_Task_Force',aaro:'https://www.aaro.mil/Portals/136/PDFs/AARO_Historical_Record_Report_Vol_1_2024.pdf',desc:'US Intelligence Community acknowledged 143 unexplained UAP incidents.'},
  {year:2023,label:'GRUSCH',lat:38.9072,lng:-77.0369,wiki:'https://en.m.wikipedia.org/wiki/David_Grusch_UFO_whistleblower_claims',aaro:'https://www.aaro.mil/Portals/136/PDFs/AARO_Historical_Record_Report_Vol_1_2024.pdf',desc:'Intel officer David Grusch testified before Congress about non-human craft.'},
];

// ── Bulk binary store ─────────────────────────────────────────────────────────
const POINTS={ready:false,count:0,id:null,lat:null,lng:null,year:null,sourceIdx:null,shapeIdx:null,quality:null,flags:null,sources:[],shapes:[]};
const ROW_SIZE=18;

function deserializeBulk(buf,meta){
  const N=meta.count,dv=new DataView(buf);
  POINTS.id=new Uint32Array(N);POINTS.lat=new Float32Array(N);POINTS.lng=new Float32Array(N);
  POINTS.year=new Uint16Array(N);POINTS.sourceIdx=new Uint8Array(N);POINTS.shapeIdx=new Uint8Array(N);
  POINTS.quality=new Uint8Array(N);POINTS.flags=new Uint8Array(N);
  for(let i=0;i<N;i++){
    const o=i*ROW_SIZE;
    POINTS.id[i]=dv.getUint32(o,true);POINTS.lat[i]=dv.getFloat32(o+4,true);POINTS.lng[i]=dv.getFloat32(o+8,true);
    POINTS.year[i]=dv.getUint16(o+12,true);POINTS.sourceIdx[i]=dv.getUint8(o+14);
    POINTS.shapeIdx[i]=dv.getUint8(o+15);POINTS.quality[i]=dv.getUint8(o+16);POINTS.flags[i]=dv.getUint8(o+17);
  }
  POINTS.sources=meta.sources||[];POINTS.shapes=meta.shapes||[];POINTS.count=N;POINTS.ready=true;
  console.log(`[ufomap] ${N.toLocaleString()} points loaded`);
}

function applyFilter(shapeF,sourceF,yearMin,yearMax,qualityMin,hasDesc=false){
  if(!POINTS.ready) return {lat:[],lng:[],id:[],shape:[],year:[],count:0};
  const wantShape=shapeF?POINTS.shapes.indexOf(shapeF):-1;
  const wantSource=sourceF?POINTS.sources.indexOf(sourceF):-1;
  const outLat=[],outLng=[],outId=[],outShape=[],outYear=[];
  for(let i=0;i<POINTS.count;i++){
    const y=POINTS.year[i];
    if(y&&(y<yearMin||y>yearMax)) continue;
    if(wantShape!==-1&&POINTS.shapeIdx[i]!==wantShape) continue;
    if(wantSource!==-1&&POINTS.sourceIdx[i]!==wantSource) continue;
    if(qualityMin>0&&POINTS.quality[i]<qualityMin&&POINTS.quality[i]!==255) continue;
    if(hasDesc&&!(POINTS.flags[i]&1)) continue;
    outLat.push(POINTS.lat[i]);outLng.push(POINTS.lng[i]);outId.push(POINTS.id[i]);
    outShape.push(POINTS.shapes[POINTS.shapeIdx[i]]||null);outYear.push(y);
  }
  return {lat:outLat,lng:outLng,id:outId,shape:outShape,year:outYear,count:outLat.length};
}

function buildGeoJSON(f){
  return{type:'FeatureCollection',features:f.lat.map((lat,i)=>({
    type:'Feature',geometry:{type:'Point',coordinates:[f.lng[i],lat]},
    properties:{id:f.id[i],shape:f.shape[i]||'Unknown',year:f.year[i],color:getShapeHex(f.shape[i])}
  }))};
}

// ── True hexagon grid ────────────────────────────────────────────────────────
function buildHexGrid(filtered,sizeDeg=2){
  const cells={};
  const h=sizeDeg,w=sizeDeg*1.1547; // hex width
  for(let i=0;i<filtered.count;i++){
    const col=Math.floor(filtered.lng[i]/w);
    const row=Math.floor(filtered.lat[i]/h);
    const key=`${col},${row}`;
    cells[key]=(cells[key]||0)+1;
  }
  const features=Object.entries(cells).map(([key,count])=>{
    const[col,row]=key.split(',').map(Number);
    const cx=col*w+w/2,cy=row*h+h/2;
    const pts=[];
    for(let a=0;a<6;a++){
      const ang=(Math.PI/180)*(60*a-30);
      pts.push([cx+sizeDeg*Math.cos(ang),cy+sizeDeg*Math.sin(ang)]);
    }
    pts.push(pts[0]);
    return{type:'Feature',geometry:{type:'Polygon',coordinates:[pts]},properties:{count,cx,cy}};
  });
  return{type:'FeatureCollection',features};
}

// ── Haversine distance (km) ──────────────────────────────────────────────────
function haversineKm(lat1,lng1,lat2,lng2){
  const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// ── Encode/decode URL state ──────────────────────────────────────────────────
function encodeState(filters,timeWindow,viewMode){
  const p=new URLSearchParams();
  if(filters.shape) p.set('shape',filters.shape);
  if(filters.source) p.set('source',filters.source);
  if(filters.quality_min>0) p.set('q',filters.quality_min);
  if(filters.has_desc) p.set('hd','1');
  p.set('y0',timeWindow[0]);p.set('y1',timeWindow[1]);
  p.set('v',viewMode);
  return p.toString();
}
function decodeState(){
  if(typeof window==='undefined') return null;
  const p=new URLSearchParams(window.location.search);
  return{
    shape:p.get('shape')||'',source:p.get('source')||'',
    quality_min:+(p.get('q')||0),has_desc:p.get('hd')==='1',
    timeWindow:[+(p.get('y0')||1947),+(p.get('y1')||2026)],
    viewMode:p.get('v')||'points',
  };
}

// ── localStorage helpers ─────────────────────────────────────────────────────
function loadLS(){
  try{const d=localStorage.getItem(LS);return d?JSON.parse(d):null;}catch{return null;}
}
function saveLS(v){try{localStorage.setItem(LS,JSON.stringify(v));}catch{}}

// ── Styles ───────────────────────────────────────────────────────────────────
const lbl={color:'#475569',fontSize:10,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:5};
const sel={width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:4,color:'#e2e8f0',padding:'5px 8px',fontSize:11,outline:'none'};
const panelStyle={position:'absolute',top:76,right:52,width:340,zIndex:20,background:'rgba(5,3,8,0.97)',border:'1px solid rgba(168,85,247,0.3)',borderRadius:8,color:'#e2e8f0',fontSize:12,maxHeight:'calc(100vh - 160px)',display:'flex',flexDirection:'column'};
const panelHdr={padding:'12px 14px 10px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexShrink:0};
const panelBody={padding:'12px 14px',overflowY:'auto',flex:1};
const closeBtn={background:'none',border:'none',color:'#475569',cursor:'pointer',fontSize:20,lineHeight:1,padding:0};
const actionBtn=(active)=>({display:'block',width:'100%',padding:'8px 0',marginTop:8,background:active?'rgba(168,85,247,0.15)':'rgba(168,85,247,0.08)',border:'1px solid rgba(168,85,247,0.3)',borderRadius:5,color:'#c084fc',fontSize:11,cursor:'pointer',textAlign:'center'});

export default function UFOMap(){
  const mapContainer=useRef(null);
  const mapRef=useRef(null);
  const nearMeMarkerRef=useRef(null);
  const nearMeCircleRef=useRef(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [mapLoaded,setMapLoaded]=useState(false);
  const [bulkLoaded,setBulkLoaded]=useState(false);
  const [bulkProgress,setBulkProgress]=useState('Downloading sightings database...');
  const [count,setCount]=useState(0);
  const [totalCount,setTotalCount]=useState(0);

  // Saved state from URL or LS
  const savedState=()=>{
    const url=decodeState();
    const ls=loadLS();
    return url||ls||null;
  };
  const initSaved=savedState();

  const [filters,setFilters]=useState(initSaved?{shape:initSaved.shape,source:initSaved.source,quality_min:initSaved.quality_min,has_desc:initSaved.has_desc}:{shape:'',source:'',quality_min:0,has_desc:false});
  const [timeWindow,setTimeWindow]=useState(initSaved?.timeWindow||[1947,2026]);
  const [viewMode,setViewMode]=useState(initSaved?.viewMode||'points');

  const [shapeOptions,setShapeOptions]=useState([]);
  const [sourceOptions,setSourceOptions]=useState([]);

  const [panelOpen,setPanelOpen]=useState(true);
  const [overlays,setOverlays]=useState({nuclear:false,military:false,bigfoot:false,events:true,missing411:false,charley:false,doe:false});

  const [selectedId,setSelectedId]=useState(null);
  const [sightingDetail,setSightingDetail]=useState(null);
  const [nearbySightings,setNearbySightings]=useState([]);
  const [selectedEvent,setSelectedEvent]=useState(null);
  const [selectedBigfoot,setSelectedBigfoot]=useState(null);
  const [iframeUrl,setIframeUrl]=useState(null);

  const [playing,setPlaying]=useState(false);
  const playRef=useRef(null);

  const [nearMeActive,setNearMeActive]=useState(false);
  const [nearMeLat,setNearMeLat]=useState(null);
  const [nearMeLng,setNearMeLng]=useState(null);
  const [nearMeRadius,setNearMeRadius]=useState(50);

  const [showStats,setShowStats]=useState(false);
  const [stats,setStats]=useState(null);

  const [darkMode,setDarkMode]=useState(true);
  const [copied,setCopied]=useState(false);

  // ── Persist to LS whenever filters change ─────────────────────────────────
  useEffect(()=>{
    saveLS({shape:filters.shape,source:filters.source,quality_min:filters.quality_min,has_desc:filters.has_desc,timeWindow,viewMode});
  },[filters,timeWindow,viewMode]);

  // ── Load bulk data ─────────────────────────────────────────────────────────
  useEffect(()=>{
    Promise.all([
      fetch(`${API}/ufo-bulk?meta=1`).then(r=>r.json()),
      fetch(`${API}/ufo-bulk`).then(r=>r.arrayBuffer()),
    ]).then(([meta,buf])=>{
      deserializeBulk(buf,meta);
      setTotalCount(meta.count);
      setShapeOptions(meta.shapes.filter(Boolean));
      setSourceOptions(meta.sources.filter(Boolean));
      setBulkLoaded(true);setBulkProgress('');
    }).catch(e=>setBulkProgress(`Error: ${e.message}`));
  },[]);

  // ── Init Mapbox ────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!mapContainer.current||mapRef.current) return;
    import('mapbox-gl').then(({default:mapboxgl})=>{
      mapboxgl.accessToken=process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const map=new mapboxgl.Map({
        container:mapContainer.current,
        style:darkMode?'mapbox://styles/mapbox/satellite-streets-v12':'mapbox://styles/mapbox/light-v11',
        center:[-98,40],zoom:2.5,projection:'globe',
      });
      map.on('load',()=>{
        if(darkMode) map.setFog({color:'rgb(2,6,14)','high-color':'rgb(8,16,40)','horizon-blend':0.03,'space-color':'rgb(1,2,8)','star-intensity':0.8});

        // UFO sources
        map.addSource('ufo',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
        map.addLayer({id:'ufo-points',type:'circle',source:'ufo',layout:{visibility:'visible'},
          paint:{'circle-radius':['interpolate',['linear'],['zoom'],2,2.5,6,5,10,8],'circle-color':['coalesce',['get','color'],'#64748b'],'circle-opacity':0.85,'circle-stroke-width':['interpolate',['linear'],['zoom'],3,0,7,0.5],'circle-stroke-color':'rgba(255,255,255,0.2)'}});
        map.addLayer({id:'ufo-heat',type:'heatmap',source:'ufo',layout:{visibility:'none'},
          paint:{'heatmap-intensity':['interpolate',['linear'],['zoom'],0,0.6,9,2],'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(0,0,0,0)',0.1,'#312e81',0.3,'#7c3aed',0.5,'#a855f7',0.7,'#e879f9',1,'#fff'],'heatmap-radius':['interpolate',['linear'],['zoom'],0,10,6,20,10,35],'heatmap-opacity':0.85}});

        // Hex grid
        map.addSource('ufo-hex',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
        map.addLayer({id:'ufo-hex-layer',type:'fill',source:'ufo-hex',layout:{visibility:'none'},
          paint:{'fill-color':['interpolate',['linear'],['get','count'],1,'#312e81',10,'#6d28d9',50,'#a855f7',200,'#e879f9',1000,'#fff'],'fill-opacity':0.75,'fill-outline-color':'rgba(168,85,247,0.2)'}});
        map.on('click','ufo-hex-layer',e=>{
          const p=e.features[0]?.properties;
          if(!p) return;
          map.flyTo({center:[p.cx,p.cy],zoom:(map.getZoom()||3)+2});
          setTimeout(()=>setViewMode('points'),600);
        });

        // Near-me circle source
        map.addSource('near-me-circle',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
        map.addLayer({id:'near-me-circle-layer',type:'fill',source:'near-me-circle',layout:{visibility:'none'},
          paint:{'fill-color':'rgba(168,85,247,0.08)','fill-outline-color':'rgba(168,85,247,0.5)'}});

        // Nuclear
        map.addSource('nuclear',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
        map.addLayer({id:'nuclear-layer',type:'circle',source:'nuclear',layout:{visibility:'none'},
          paint:{'circle-radius':6,'circle-color':'#22c55e','circle-stroke-width':1.5,'circle-stroke-color':'#86efac','circle-opacity':0.9}});

        // Military
        map.addSource('military',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
        map.addLayer({id:'military-layer',type:'fill',source:'military',layout:{visibility:'none'},
          paint:{'fill-color':'#ef4444','fill-opacity':0.15,'fill-outline-color':'#fca5a5'}});

        // Bigfoot
        map.addSource('bigfoot',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
        map.addLayer({id:'bigfoot-layer',type:'circle',source:'bigfoot',layout:{visibility:'none'},
          paint:{'circle-radius':['interpolate',['linear'],['zoom'],2,3,8,7],'circle-color':'#92400e','circle-stroke-width':1.5,'circle-stroke-color':'#d97706','circle-opacity':0.85}});

        // Famous events
        map.addSource('events',{type:'geojson',data:{type:'FeatureCollection',features:FAMOUS_EVENTS.map(e=>({type:'Feature',geometry:{type:'Point',coordinates:[e.lng,e.lat]},properties:{...e}}))}});
        map.addLayer({id:'events-layer',type:'circle',source:'events',layout:{visibility:'visible'},
          paint:{'circle-radius':8,'circle-color':'#f59e0b','circle-stroke-width':2,'circle-stroke-color':'#fbbf24','circle-opacity':0.95}});
        map.addLayer({id:'events-labels',type:'symbol',source:'events',layout:{visibility:'visible','text-field':['get','label'],'text-size':9,'text-offset':[0,1.5],'text-anchor':'top'},
          paint:{'text-color':'#fbbf24','text-halo-color':'rgba(0,0,0,0.8)','text-halo-width':1}});

        // Click handlers
        map.on('click','ufo-points',e=>{
          const p=e.features[0]?.properties;if(!p?.id) return;
          setSelectedId(p);setSelectedEvent(null);setSelectedBigfoot(null);setIframeUrl(null);setSightingDetail(null);setNearbySightings([]);
          fetch(`${API}/ufo-sighting/${p.id}`).then(r=>r.json()).then(d=>{
            setSightingDetail(d);
            // nearby sightings
            if(d.lat&&d.lng){
              const nearby=[];
              for(let i=0;i<POINTS.count;i++){
                if(POINTS.id[i]===p.id) continue;
                const dist=haversineKm(d.lat,d.lng,POINTS.lat[i],POINTS.lng[i]);
                if(dist<50) nearby.push({id:POINTS.id[i],dist:Math.round(dist),shape:POINTS.shapes[POINTS.shapeIdx[i]]||'Unknown',year:POINTS.year[i]});
                if(nearby.length>=10) break;
              }
              setNearbySightings(nearby.sort((a,b)=>a.dist-b.dist));
            }
          }).catch(console.error);
        });
        map.on('click','events-layer',e=>{
          const p=e.features[0]?.properties;if(!p) return;
          setSelectedEvent(p);setSelectedId(null);setSelectedBigfoot(null);setIframeUrl(null);
        });
        map.on('click','bigfoot-layer',e=>{
          const p=e.features[0]?.properties;if(!p) return;
          setSelectedBigfoot(p);setSelectedId(null);setSelectedEvent(null);setIframeUrl(null);
        });
        ['ufo-points','events-layer','bigfoot-layer','ufo-hex-layer'].forEach(id=>{
          map.on('mouseenter',id,()=>{map.getCanvas().style.cursor='pointer';});
          map.on('mouseleave',id,()=>{map.getCanvas().style.cursor='';});
        });

        // Missing 411 clusters
        map.addSource('missing411',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
        map.addLayer({id:'missing411-layer',type:'circle',source:'missing411',layout:{visibility:'none'},
          paint:{'circle-radius':['interpolate',['linear'],['zoom'],2,6,8,14],'circle-color':'#dc2626','circle-stroke-width':2,'circle-stroke-color':'#fca5a5','circle-opacity':0.85}});

        // Charley Project
        map.addSource('charley',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
        map.addLayer({id:'charley-layer',type:'circle',source:'charley',layout:{visibility:'none'},
          paint:{'circle-radius':4,'circle-color':'#f97316','circle-stroke-width':1,'circle-stroke-color':'#fed7aa','circle-opacity':0.8}});

        // Doe Network
        map.addSource('doe',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
        map.addLayer({id:'doe-layer',type:'circle',source:'doe',layout:{visibility:'none'},
          paint:{'circle-radius':4,'circle-color':'#6b7280','circle-stroke-width':1,'circle-stroke-color':'#d1d5db','circle-opacity':0.8}});

        map.addControl(new mapboxgl.NavigationControl(),'top-right');
        map.addControl(new mapboxgl.ScaleControl(),'bottom-right');
        mapRef.current=map;
        setMapLoaded(true);
      });
    });
    return()=>{if(mapRef.current){mapRef.current.remove();mapRef.current=null;}};
  },[]);

  // ── Render filtered points ─────────────────────────────────────────────────
  const renderPoints=useCallback(()=>{
    if(!mapRef.current||!mapLoaded||!bulkLoaded) return;
    const filtered=applyFilter(filters.shape,filters.source,timeWindow[0],timeWindow[1],filters.quality_min,filters.has_desc);
    mapRef.current.getSource('ufo')?.setData(buildGeoJSON(filtered));
    mapRef.current.getSource('ufo-hex')?.setData(buildHexGrid(filtered));
    setCount(filtered.count);

    // Dynamic stats
    if(showStats){
      const byShape={},bySource={},byYear={};
      for(let i=0;i<filtered.count;i++){
      const shapeCounts={},sourceCounts={};
      for(let i=0;i<filtered.count;i++){
        const sh=filtered.shape[i]||'Unknown';
        shapeCounts[sh]=(shapeCounts[sh]||0)+1;
      }
      // source counts from POINTS directly
      for(let i=0;i<POINTS.count;i++){
        if(POINTS.year[i]&&(POINTS.year[i]<timeWindow[0]||POINTS.year[i]>timeWindow[1])) continue;
        const src=POINTS.sources[POINTS.sourceIdx[i]]||'?';
        sourceCounts[src]=(sourceCounts[src]||0)+1;
      }
      const topShapes=Object.entries(shapeCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
      const topSources=Object.entries(sourceCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
      setStats({total:filtered.count,topShapes,topSources});
    }
  },[mapLoaded,bulkLoaded,filters,timeWindow,showStats]);

  useEffect(()=>{renderPoints();},[renderPoints]);

  // ── View mode ──────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!mapRef.current||!mapLoaded) return;
    mapRef.current.setLayoutProperty('ufo-points','visibility',viewMode==='points'?'visible':'none');
    mapRef.current.setLayoutProperty('ufo-heat','visibility',viewMode==='heat'?'visible':'none');
    mapRef.current.setLayoutProperty('ufo-hex-layer','visibility',viewMode==='hex'?'visible':'none');
  },[viewMode,mapLoaded]);

  // ── Nuclear overlay ────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!mapRef.current||!mapLoaded) return;
    mapRef.current.setLayoutProperty('nuclear-layer','visibility',overlays.nuclear?'visible':'none');
    if(overlays.nuclear){
      fetch(`${API}/nuclear-plants`).then(r=>r.json()).then(data=>{
        mapRef.current?.getSource('nuclear')?.setData({type:'FeatureCollection',
          features:(data.plants||[]).map(p=>({type:'Feature',geometry:{type:'Point',coordinates:[p.lng,p.lat]},properties:{name:p.name}}))});
      }).catch(console.error);
    }
  },[overlays.nuclear,mapLoaded]);

  // ── Military overlay ───────────────────────────────────────────────────────
  useEffect(()=>{
    if(!mapRef.current||!mapLoaded) return;
    mapRef.current.setLayoutProperty('military-layer','visibility',overlays.military?'visible':'none');
    if(overlays.military){
      const q=`[out:json][timeout:25];(way["landuse"="military"];relation["landuse"="military"];);out geom;`;
      fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`).then(r=>r.json()).then(data=>{
        const features=(data.elements||[]).filter(el=>el.geometry).map(el=>({type:'Feature',geometry:{type:'Polygon',coordinates:[el.geometry.map(p=>[p.lon,p.lat])]},properties:{name:el.tags?.name||'Military'}}));
        mapRef.current?.getSource('military')?.setData({type:'FeatureCollection',features});
      }).catch(console.error);
    }
  },[overlays.military,mapLoaded]);

  // ── Bigfoot overlay ────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!mapRef.current||!mapLoaded) return;
    mapRef.current.setLayoutProperty('bigfoot-layer','visibility',overlays.bigfoot?'visible':'none');
    if(overlays.bigfoot){
      fetch(`${API}/bigfoot-sightings`).then(r=>r.json()).then(data=>{
        mapRef.current?.getSource('bigfoot')?.setData({type:'FeatureCollection',
          features:(data.sightings||[]).map(s=>({type:'Feature',geometry:{type:'Point',coordinates:[s.lng,s.lat]},properties:s}))});
      }).catch(console.error);
    }
  },[overlays.bigfoot,mapLoaded]);

  // ── Events overlay ─────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!mapRef.current||!mapLoaded) return;
    ['events-layer','events-labels'].forEach(id=>mapRef.current.setLayoutProperty(id,'visibility',overlays.events?'visible':'none'));
  },[overlays.events,mapLoaded]);

  // ── Near Me ────────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!mapRef.current||!mapLoaded) return;
    if(!nearMeActive){
      mapRef.current.setLayoutProperty('near-me-circle-layer','visibility','none');
      if(nearMeMarkerRef.current){nearMeMarkerRef.current.remove();nearMeMarkerRef.current=null;}
      return;
    }
    navigator.geolocation?.getCurrentPosition(pos=>{
      const{latitude:lat,longitude:lng}=pos.coords;
      setNearMeLat(lat);setNearMeLng(lng);
      mapRef.current.flyTo({center:[lng,lat],zoom:8});
      import('mapbox-gl').then(({default:mapboxgl})=>{
        if(nearMeMarkerRef.current) nearMeMarkerRef.current.remove();
        nearMeMarkerRef.current=new mapboxgl.Marker({color:'#a855f7'}).setLngLat([lng,lat]).addTo(mapRef.current);
      });
    },err=>console.error(err));
  },[nearMeActive,mapLoaded]);

  // Update near-me circle when radius or location changes
  useEffect(()=>{
    if(!mapRef.current||!mapLoaded||!nearMeActive||!nearMeLat) return;
    const steps=64,R=nearMeRadius/111.32;
    const coords=Array.from({length:steps},(_,i)=>{
      const a=(i/steps)*2*Math.PI;
      return[nearMeLng+R*Math.cos(a)/Math.cos(nearMeLat*Math.PI/180),nearMeLat+R*Math.sin(a)];
    });
    coords.push(coords[0]);
    mapRef.current.getSource('near-me-circle')?.setData({type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Polygon',coordinates:[coords]}}]});
    mapRef.current.setLayoutProperty('near-me-circle-layer','visibility','visible');
    // Filter to nearby
    setFilters(f=>({...f})); // trigger re-render
  },[nearMeRadius,nearMeLat,nearMeLng,nearMeActive,mapLoaded]);

  // ── Timeline playback ──────────────────────────────────────────────────────
  useEffect(()=>{
    if(playing){
      playRef.current=setInterval(()=>{
        setTimeWindow(([min,max])=>{const n=max>=2026?1950:max+1;return[Math.max(1900,n-10),n];});
      },400);
    }else clearInterval(playRef.current);
    return()=>clearInterval(playRef.current);
  },[playing]);

  // ── Share URL ──────────────────────────────────────────────────────────────
  const handleShare=()=>{
    const qs=encodeState(filters,timeWindow,viewMode);
    const url=`${window.location.origin}${window.location.pathname}?${qs}`;
    navigator.clipboard.writeText(url).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  };

  const yearPct=y=>((y-1900)/(2026-1900))*100;
  const formatDate=d=>d?String(d).substring(0,10):'–';
  const s=selectedId;

  return(
    <div style={{width:'100vw',height:'100vh',background:darkMode?'#010208':'#f1f5f9',overflow:'hidden',position:'relative',fontFamily:'system-ui,sans-serif'}}>
      <div ref={mapContainer} style={{width:'100%',height:'100%'}}/>

      {/* Loading */}
      {bulkProgress&&(
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:50,background:'rgba(1,5,15,0.97)',border:'1px solid rgba(168,85,247,0.3)',borderRadius:8,padding:'24px 36px',textAlign:'center'}}>
          <div style={{fontSize:28,marginBottom:8}}>🛸</div>
          <div style={{color:'#c084fc',fontWeight:700,fontSize:13,marginBottom:6}}>UFOMAP</div>
          <div style={{color:'#475569',fontSize:12}}>{bulkProgress}</div>
        </div>
      )}

      {/* Header */}
      <div style={{position:'absolute',top:0,left:0,right:0,zIndex:20,pointerEvents:'none',background:'linear-gradient(to bottom,rgba(1,2,8,0.92),transparent)',padding:'10px 16px 20px',display:'flex',alignItems:'center',gap:10}}>
        <span style={{fontSize:18}}>🛸</span>
        <span style={{color:'#c084fc',fontWeight:800,fontSize:14,letterSpacing:'0.12em',textShadow:'0 0 16px rgba(168,85,247,0.5)'}}>UFOMAP</span>
        <span style={{color:'#334155',fontSize:9,letterSpacing:'0.06em'}}>ANOMALY DATABASE</span>
        <span style={{color:'#334155',fontSize:9,marginLeft:4}}>{totalCount.toLocaleString()} records</span>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,pointerEvents:'all'}}>
          <button onClick={handleShare} style={{background:'rgba(168,85,247,0.1)',border:'1px solid rgba(168,85,247,0.25)',borderRadius:4,color:copied?'#22c55e':'#c084fc',padding:'3px 10px',cursor:'pointer',fontSize:10}}>
            {copied?'✓ COPIED':'⬡ SHARE'}
          </button>
          <button onClick={()=>setShowStats(s=>!s)} style={{background:showStats?'rgba(168,85,247,0.15)':'rgba(168,85,247,0.08)',border:'1px solid rgba(168,85,247,0.25)',borderRadius:4,color:'#c084fc',padding:'3px 10px',cursor:'pointer',fontSize:10}}>
            ◈ STATS
          </button>
          <a href="https://nuforc.org/report-a-ufo/" target="_blank" rel="noopener noreferrer" style={{background:'rgba(168,85,247,0.08)',border:'1px solid rgba(168,85,247,0.25)',borderRadius:4,color:'#c084fc',padding:'3px 10px',fontSize:10,textDecoration:'none'}}>
            + REPORT
          </a>
          <button onClick={()=>setDarkMode(d=>!d)} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:4,color:'#64748b',padding:'3px 8px',cursor:'pointer',fontSize:10}}>
            {darkMode?'☀':'🌙'}
          </button>
          <span style={{color:'#22d3ee',fontSize:11,fontWeight:600}}>{count.toLocaleString()} in view</span>
        </div>
      </div>

      {/* Filter toggle */}
      <button onClick={()=>setPanelOpen(p=>!p)} style={{position:'absolute',top:46,left:12,zIndex:30,background:'rgba(1,5,15,0.9)',border:'1px solid rgba(168,85,247,0.25)',borderRadius:5,color:'#c084fc',padding:'5px 10px',cursor:'pointer',fontSize:10,letterSpacing:'0.08em'}}>
        {panelOpen?'◀ FILTERS':'▶ FILTERS'}
      </button>

      {/* Left panel */}
      {panelOpen&&(
        <div style={{position:'absolute',top:78,left:12,width:224,zIndex:20,background:'rgba(1,5,15,0.95)',border:'1px solid rgba(168,85,247,0.15)',borderRadius:8,padding:'14px',color:'#e2e8f0',fontSize:12,maxHeight:'calc(100vh - 160px)',overflowY:'auto'}}>

          {/* View mode */}
          <div style={{marginBottom:14}}>
            <div style={lbl}>View</div>
            <div style={{display:'flex',gap:3}}>
              {[['points','● Points'],['heat','◎ Heat'],['hex','⬡ Hex']].map(([m,l])=>(
                <button key={m} onClick={()=>setViewMode(m)} style={{flex:1,padding:'5px 0',borderRadius:4,cursor:'pointer',fontSize:10,background:viewMode===m?'rgba(168,85,247,0.18)':'rgba(255,255,255,0.04)',border:`1px solid ${viewMode===m?'rgba(168,85,247,0.5)':'rgba(255,255,255,0.07)'}`,color:viewMode===m?'#c084fc':'#64748b'}}>{l}</button>
              ))}
            </div>
          </div>

          {/* Shape */}
          <div style={{marginBottom:10}}>
            <div style={lbl}>Shape</div>
            <select value={filters.shape} onChange={e=>setFilters(f=>({...f,shape:e.target.value}))} style={sel}>
              <option value="">All shapes</option>
              {shapeOptions.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Source */}
          <div style={{marginBottom:10}}>
            <div style={lbl}>Source</div>
            <select value={filters.source} onChange={e=>setFilters(f=>({...f,source:e.target.value}))} style={sel}>
              <option value="">All sources</option>
              {sourceOptions.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Quality */}
          <div style={{marginBottom:10}}>
            <div style={lbl}>Min Quality: {filters.quality_min}</div>
            <input type="range" min={0} max={100} value={filters.quality_min} onChange={e=>setFilters(f=>({...f,quality_min:+e.target.value}))} style={{width:'100%',accentColor:'#a855f7'}}/>
          </div>

          {/* Has description */}
          <div style={{marginBottom:14}}>
            <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:11,color:filters.has_desc?'#c084fc':'#64748b'}}>
              <input type="checkbox" checked={filters.has_desc} onChange={e=>setFilters(f=>({...f,has_desc:e.target.checked}))} style={{accentColor:'#a855f7'}}/>
              Has report text
            </label>
          </div>

          {/* Near Me */}
          <div style={{marginBottom:14}}>
            <div style={lbl}>Near Me</div>
            <button onClick={()=>setNearMeActive(a=>!a)} style={{...actionBtn(nearMeActive),marginTop:0}}>
              {nearMeActive?'◎ Near Me Active':'◎ Find Nearby'}
            </button>
            {nearMeActive&&(
              <div style={{marginTop:8}}>
                <div style={{...lbl,marginBottom:3}}>Radius: {nearMeRadius} km</div>
                <input type="range" min={10} max={500} value={nearMeRadius} onChange={e=>setNearMeRadius(+e.target.value)} style={{width:'100%',accentColor:'#a855f7'}}/>
              </div>
            )}
          </div>

          {/* Overlays */}
          <div style={{marginBottom:14}}>
            <div style={lbl}>Overlays</div>
            {[['events','★ Famous Events','#f59e0b'],['nuclear','⚛ Nuclear Plants','#22c55e'],['bigfoot','🦶 Bigfoot (4,104)','#d97706'],['military','✦ Military Bases','#ef4444'],
              ['missing411','☠ Missing 411 Clusters','#dc2626'],
              ['charley','👤 Charley Project','#f97316'],
              ['doe','🦴 Doe Network','#6b7280']].map(([key,label,color])=>(
              <label key={key} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',marginBottom:5,fontSize:11,color:overlays[key]?color:'#64748b'}}>
                <input type="checkbox" checked={overlays[key]} onChange={e=>setOverlays(o=>({...o,[key]:e.target.checked}))} style={{accentColor:color}}/>
                {label}
              </label>
            ))}
          </div>

          {/* Legend */}
          <div style={{borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:10}}>
            <div style={lbl}>Legend</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:'3px 8px'}}>
              {Object.entries(SHAPE_HEX).filter(([k])=>!['Other','Unknown'].includes(k)).map(([shape,color])=>(
                <div key={shape} style={{display:'flex',alignItems:'center',gap:3,fontSize:9,color:'#94a3b8'}}>
                  <span style={{width:6,height:6,borderRadius:'50%',background:color,display:'inline-block',flexShrink:0}}/>
                  {shape}
                </div>
              ))}
              <div style={{display:'flex',alignItems:'center',gap:3,fontSize:9,color:'#94a3b8',marginTop:2}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:'#92400e',display:'inline-block',flexShrink:0}}/>Bigfoot
              </div>
              <div style={{display:'flex',alignItems:'center',gap:3,fontSize:9,color:'#94a3b8'}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:'#f59e0b',display:'inline-block',flexShrink:0}}/>Famous Event
              </div>
              <div style={{display:'flex',alignItems:'center',gap:3,fontSize:9,color:'#94a3b8',marginTop:2}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:'#dc2626',display:'inline-block',flexShrink:0}}/>Missing 411
              </div>
              <div style={{display:'flex',alignItems:'center',gap:3,fontSize:9,color:'#94a3b8'}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:'#f97316',display:'inline-block',flexShrink:0}}/>Charley Project
              </div>
              <div style={{display:'flex',alignItems:'center',gap:3,fontSize:9,color:'#94a3b8'}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:'#6b7280',display:'inline-block',flexShrink:0}}/>Doe Network (Unidentified)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats panel */}
      {showStats&&stats&&(
        <div style={{position:'absolute',top:78,left:panelOpen?248:12,width:200,zIndex:20,background:'rgba(1,5,15,0.95)',border:'1px solid rgba(168,85,247,0.15)',borderRadius:8,padding:'14px',color:'#e2e8f0',fontSize:11}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <span style={{color:'#c084fc',fontWeight:700,fontSize:12}}>◈ STATS</span>
            <button onClick={()=>setShowStats(false)} style={closeBtn}>×</button>
          </div>
          <div style={{color:'#475569',fontSize:10,marginBottom:4}}>TOTAL IN VIEW</div>
          <div style={{color:'#e2e8f0',fontSize:20,fontWeight:700,marginBottom:12}}>{stats.total.toLocaleString()}</div>
          <div style={{color:'#475569',fontSize:10,marginBottom:6}}>TOP SHAPES</div>
          {stats.topShapes.map(([shape,cnt])=>(
            <div key={shape} style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
              <div style={{display:'flex',alignItems:'center',gap:4}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:getShapeHex(shape),display:'inline-block'}}/>
                <span style={{color:'#94a3b8'}}>{shape}</span>
              </div>
              <span style={{color:'#64748b'}}>{cnt.toLocaleString()}</span>
            </div>
          ))}
          <div style={{color:'#475569',fontSize:10,margin:'10px 0 6px'}}>TOP SOURCES</div>
          {stats.topSources.map(([src,cnt])=>(
            <div key={src} style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
              <span style={{color:'#94a3b8'}}>{src}</span>
              <span style={{color:'#64748b'}}>{cnt.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* UFO Sighting Detail */}
      {s&&(
        <div style={panelStyle}>
          <div style={panelHdr}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:3}}>
                <span style={{width:10,height:10,borderRadius:'50%',background:getShapeHex(s.shape),display:'inline-block'}}/>
                <span style={{fontWeight:700,fontSize:13,color:getShapeHex(s.shape)}}>{s.shape||'Unknown'}</span>
                {sightingDetail?.has_media&&<span style={{fontSize:9,background:'rgba(59,130,246,0.2)',color:'#93c5fd',padding:'1px 5px',borderRadius:3}}>MEDIA</span>}
              </div>
              <div style={{color:'#64748b',fontSize:11}}>{[sightingDetail?.city,sightingDetail?.state,sightingDetail?.country].filter(Boolean).join(', ')||'–'}</div>
            </div>
            <button onClick={()=>setSelectedId(null)} style={closeBtn}>×</button>
          </div>
          <div style={panelBody}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:10}}>
              {[['Date',formatDate(sightingDetail?.date_event)],['Source',sightingDetail?.source_name],sightingDetail?.duration&&['Duration',sightingDetail.duration],sightingDetail?.hynek&&['Hynek',sightingDetail.hynek],sightingDetail?.vallee&&['Vallee',sightingDetail.vallee],sightingDetail?.quality_score!=null&&['Quality',`${sightingDetail.quality_score}/100`]].filter(Boolean).map(([label,val])=>val&&(
                <div key={label} style={{background:'rgba(255,255,255,0.03)',borderRadius:5,padding:'6px 8px'}}>
                  <div style={{color:'#475569',fontSize:10,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:1}}>{label}</div>
                  <div style={{fontSize:11,color:['Hynek','Vallee'].includes(label)?'#a78bfa':'#e2e8f0'}}>{val}</div>
                </div>
              ))}
            </div>
            {sightingDetail?.quality_score>0&&(
              <div style={{marginBottom:10}}>
                <div style={{height:3,background:'rgba(255,255,255,0.07)',borderRadius:2}}>
                  <div style={{height:'100%',width:`${sightingDetail.quality_score}%`,borderRadius:2,background:sightingDetail.quality_score>60?'#22c55e':sightingDetail.quality_score>30?'#f59e0b':'#ef4444'}}/>
                </div>
              </div>
            )}
            {sightingDetail?.description?(
              <div style={{marginBottom:12}}>
                <div style={{color:'#475569',fontSize:10,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:5}}>Report</div>
                <div style={{fontSize:11,lineHeight:1.65,color:'#94a3b8'}}>{sightingDetail.description}</div>
              </div>
            ):sightingDetail?(
              <div style={{color:'#334155',fontSize:11,marginBottom:12}}>No report text available.</div>
            ):(
              <div style={{color:'#334155',fontSize:11,marginBottom:12}}>Loading…</div>
            )}
            {sightingDetail?.report_url&&(
              <button onClick={()=>setIframeUrl(sightingDetail.report_url)} style={actionBtn(false)}>VIEW NUFORC REPORT →</button>
            )}
            {nearbySightings.length>0&&(
              <div style={{marginTop:14}}>
                <div style={{color:'#475569',fontSize:10,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Nearby Sightings (50km)</div>
                {nearbySightings.map(n=>(
                  <div key={n.id} onClick={()=>{
                    setSelectedId({id:n.id,shape:n.shape});setSightingDetail(null);setNearbySightings([]);
                    fetch(`${API}/ufo-sighting/${n.id}`).then(r=>r.json()).then(setSightingDetail).catch(console.error);
                  }} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 8px',marginBottom:3,background:'rgba(255,255,255,0.03)',borderRadius:4,cursor:'pointer',border:'1px solid transparent'}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(168,85,247,0.3)'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='transparent'}>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <span style={{width:6,height:6,borderRadius:'50%',background:getShapeHex(n.shape),display:'inline-block',flexShrink:0}}/>
                      <span style={{color:'#94a3b8',fontSize:11}}>{n.shape}</span>
                      <span style={{color:'#475569',fontSize:10}}>{n.year||'–'}</span>
                    </div>
                    <span style={{color:'#475569',fontSize:10}}>{n.dist}km</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Famous Event Panel */}
      {selectedEvent&&(
        <div style={panelStyle}>
          <div style={panelHdr}>
            <div>
              <div style={{color:'#f59e0b',fontWeight:700,fontSize:14,letterSpacing:'0.08em'}}>★ {selectedEvent.label}</div>
              <div style={{color:'#78716c',fontSize:11,marginTop:2}}>{selectedEvent.year}</div>
            </div>
            <button onClick={()=>setSelectedEvent(null)} style={closeBtn}>×</button>
          </div>
          <div style={panelBody}>
            <div style={{fontSize:12,lineHeight:1.7,color:'#d4d0c8',marginBottom:14}}>{selectedEvent.desc}</div>
            <div style={{display:'flex',gap:6}}>
              {selectedEvent.wiki&&<button onClick={()=>setIframeUrl(selectedEvent.wiki)} style={{flex:1,padding:'8px 0',background:'rgba(168,85,247,0.1)',border:'1px solid rgba(168,85,247,0.3)',borderRadius:5,color:'#c084fc',fontSize:11,cursor:'pointer'}}>📖 Wikipedia</button>}
              {selectedEvent.aaro&&<button onClick={()=>setIframeUrl(selectedEvent.aaro)} style={{flex:1,padding:'8px 0',background:'rgba(168,85,247,0.1)',border:'1px solid rgba(168,85,247,0.3)',borderRadius:5,color:'#c084fc',fontSize:11,cursor:'pointer'}}>🏛 AARO Report</button>}
            </div>
          </div>
        </div>
      )}

      {/* Bigfoot Panel */}
      {selectedBigfoot&&(
        <div style={panelStyle}>
          <div style={panelHdr}>
            <div>
              <div style={{color:'#d97706',fontWeight:700,fontSize:13}}>🦶 {selectedBigfoot.classification||'Bigfoot Sighting'}</div>
              <div style={{color:'#78716c',fontSize:11,marginTop:3}}>
                {[selectedBigfoot.county,selectedBigfoot.state].filter(Boolean).join(', ')}
                {selectedBigfoot.date?` · ${selectedBigfoot.date.substring(0,4)}`:''}
                {selectedBigfoot.season?` · ${selectedBigfoot.season}`:''}
              </div>
            </div>
            <button onClick={()=>setSelectedBigfoot(null)} style={closeBtn}>×</button>
          </div>
          <div style={panelBody}>
            {selectedBigfoot.title&&<div style={{fontSize:12,color:'#c084fc',marginBottom:10,fontWeight:600}}>{selectedBigfoot.title}</div>}
            {selectedBigfoot.observed&&<div style={{fontSize:12,lineHeight:1.7,color:'#d4d0c8',marginBottom:14}}>{selectedBigfoot.observed}</div>}
            <button onClick={()=>setIframeUrl(`https://www.bfro.net/GDB/show_report.asp?id=${selectedBigfoot.id}`)} style={actionBtn(false)}>VIEW BFRO REPORT →</button>
          </div>
        </div>
      )}

      {/* Iframe overlay */}
      {iframeUrl&&(
        <div style={{position:'absolute',top:0,right:0,bottom:0,width:'60%',zIndex:40,background:'rgba(1,2,8,0.98)',border:'1px solid rgba(168,85,247,0.2)',display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderBottom:'1px solid rgba(255,255,255,0.08)',background:'rgba(0,0,0,0.5)',flexShrink:0}}>
            <span style={{color:'#64748b',fontSize:11,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{iframeUrl}</span>
            <a href={iframeUrl} target="_blank" rel="noopener noreferrer" style={{color:'#c084fc',fontSize:10,textDecoration:'none',whiteSpace:'nowrap',padding:'3px 8px',border:'1px solid rgba(168,85,247,0.3)',borderRadius:4}}>↗ open in tab</a>
            <button onClick={()=>setIframeUrl(null)} style={{background:'none',border:'none',color:'#475569',cursor:'pointer',fontSize:20,lineHeight:1,padding:'0 0 0 8px'}}>×</button>
          </div>
          {iframeUrl.includes('aaro.mil')?(
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32,textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:16}}>🏛</div>
              <div style={{color:'#c084fc',fontWeight:700,fontSize:14,marginBottom:8}}>AARO — All-domain Anomaly Resolution Office</div>
              <div style={{color:'#64748b',fontSize:12,lineHeight:1.7,marginBottom:24}}>The AARO website blocks embedding. Click below to open the historical record report in a new tab.</div>
              <a href={iframeUrl} target="_blank" rel="noopener noreferrer" style={{padding:'10px 24px',background:'rgba(168,85,247,0.15)',border:'1px solid rgba(168,85,247,0.4)',borderRadius:6,color:'#c084fc',fontSize:13,textDecoration:'none'}}>Open AARO Report ↗</a>
            </div>
          ):(
            <div style={{flex:1,overflow:'hidden',position:'relative'}}>
              <iframe src={iframeUrl} style={{position:'absolute',top:0,left:0,width:'133%',height:'100%',border:'none',background:'#fff',transformOrigin:'top left',transform:'scale(0.75)'}} sandbox="allow-scripts allow-same-origin allow-popups allow-forms"/>
            </div>
          )}
        </div>
      )}

      {/* Bottom timeline */}
      <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:20,background:'linear-gradient(to top,rgba(1,2,8,0.97),rgba(1,2,8,0.6))',padding:'8px 60px 12px 16px'}}>
        <div style={{position:'relative',height:28,marginBottom:3}}>
          {NAMED_EVENTS.map(ev=>(
            <div key={ev.label} style={{position:'absolute',left:`${yearPct(ev.year)}%`,transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',pointerEvents:'none'}}>
              <div style={{width:1,height:14,background:'rgba(168,85,247,0.3)'}}/>
              <span style={{fontSize:7,color:'rgba(192,132,252,0.5)',letterSpacing:'0.04em',whiteSpace:'nowrap',marginTop:1}}>{ev.label}</span>
            </div>
          ))}
          <div style={{position:'absolute',top:'40%',left:0,right:0,height:2,background:'rgba(255,255,255,0.07)',borderRadius:1}}>
            <div style={{position:'absolute',height:'100%',borderRadius:1,background:'rgba(168,85,247,0.5)',left:`${yearPct(timeWindow[0])}%`,width:`${yearPct(timeWindow[1])-yearPct(timeWindow[0])}%`}}/>
          </div>
          <input type="range" min={1900} max={2026} value={timeWindow[0]} onChange={e=>setTimeWindow(([,max])=>[Math.min(+e.target.value,max-1),max])} style={{position:'absolute',top:0,left:0,width:'100%',opacity:0,cursor:'pointer',zIndex:2}}/>
          <input type="range" min={1900} max={2026} value={timeWindow[1]} onChange={e=>setTimeWindow(([min])=>[min,Math.max(+e.target.value,min+1)])} style={{position:'absolute',top:0,left:0,width:'100%',opacity:0,cursor:'pointer',zIndex:3}}/>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button onClick={()=>setPlaying(p=>!p)} style={{background:playing?'rgba(168,85,247,0.15)':'rgba(255,255,255,0.05)',border:`1px solid ${playing?'rgba(168,85,247,0.4)':'rgba(255,255,255,0.08)'}`,borderRadius:4,color:playing?'#c084fc':'#64748b',padding:'4px 10px',cursor:'pointer',fontSize:10,letterSpacing:'0.06em'}}>{playing?'⏸ PAUSE':'▶ PLAY'}</button>
          <span style={{color:'#c084fc',fontSize:12,fontWeight:600,letterSpacing:'0.04em'}}>{timeWindow[0]} — {timeWindow[1]}</span>
          <button onClick={()=>{setTimeWindow([1947,2026]);setPlaying(false);}} style={{background:'none',border:'1px solid rgba(255,255,255,0.07)',borderRadius:4,color:'#475569',padding:'4px 8px',cursor:'pointer',fontSize:10}}>RESET</button>
          <span style={{marginLeft:'auto',color:'#334155',fontSize:10}}>🛸 {count.toLocaleString()} · NUFORC · UFOCAT · MUFON · UPDB</span>
        </div>
      </div>
    </div>
  );
}
