'use client';
import { useEffect, useState } from 'react';
import { MapContainer, GeoJSON, CircleMarker, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import type { FeatureCollection } from 'geojson';
import type { City } from '@/lib/contracts';
import { compact, title } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';
function MapSync({ selected, cities, reset }: { selected?: string; cities: City[]; reset: number }) {
  const map = useMap();
  useEffect(() => {
    const city = cities.find(c=>c.city===selected);
    if (city?.latitude && city?.longitude) map.setView([city.latitude, city.longitude], 6, { animate: false });
    else map.fitBounds([[24.5,44],[40,63.5]], { padding:[12,12], maxZoom:5, animate:false });
  }, [selected, cities, map, reset]);
  useEffect(() => { const observer = new ResizeObserver(()=>map.invalidateSize()); observer.observe(map.getContainer()); return ()=>observer.disconnect(); }, [map]);
  return null;
}
export default function IranMap({ cities, selected, onSelect, reset = 0 }: { cities: City[]; selected?: string; onSelect: (city: string) => void; reset?: number }) {
  const [geometry, setGeometry] = useState<FeatureCollection | null>(null);
  const [error,setError] = useState(false);
  useEffect(() => { fetch('/region.geojson').then(r=>{if(!r.ok)throw new Error(); return r.json();}).then(setGeometry).catch(()=>setError(true)); }, []);
  return <div className="map-surface" aria-label="Interactive Iran city aggregation map">
    <MapContainer center={[32.5,54.5]} zoom={5} minZoom={4} maxZoom={9} zoomControl={false} scrollWheelZoom={false} attributionControl>
      <ZoomControl position="topright"/><MapSync selected={selected} cities={cities} reset={reset}/>
      {geometry && <GeoJSON data={geometry} style={f=>({ color: f?.properties.name === 'Iran' ? '#499ba6' : '#3b4453', weight: 1, fillColor: f?.properties.name === 'Iran' ? '#205663' : '#202632', fillOpacity: f?.properties.name === 'Iran' ? 0.8 : 0.7 })} attribution='<a href="https://www.naturalearthdata.com/">Natural Earth</a> · City centers only'/>}
      {cities.filter(c=>c.latitude!==null&&c.longitude!==null).map((city,i)=><CircleMarker key={city.city} center={[city.latitude!, city.longitude!]} radius={7 + Math.sqrt(city.count)*5} pathOptions={{ color: i%2 ? '#4ee0df' : '#b3a1ff', fillColor: i%2 ? '#24c6d2' : '#8970ed', fillOpacity: 0.48, weight: 2 }} eventHandlers={{ click:()=>onSelect(city.city) }}><Tooltip permanent={!cities.slice(0,i).some(c=>c.latitude!==null&&c.longitude!==null&&Math.abs(c.latitude-city.latitude!)<0.7&&Math.abs(c.longitude-city.longitude!)<0.7)} direction="top" offset={[0,-12]} className="city-map-label"><strong>{title(city.city)}</strong><span>{city.count} sale{city.count===1?'':'s'} · {compact(city.median_price_per_sqm)}/m²</span></Tooltip></CircleMarker>)}
    </MapContainer>
    {error && <div className="map-error">Country boundaries could not load. City markers remain available.</div>}
    <span className="map-country-label">I R A N</span><span className="map-sea-label">PERSIAN GULF</span>
  </div>;
}
