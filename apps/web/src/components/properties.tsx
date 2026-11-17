'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownUp, ArrowUpRight, Building2, ChevronLeft, ChevronRight, Database, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { propertyPageSchema, propertySchema, queryString } from '@/lib/contracts';
import { useWorkspace, useAnalytics } from './workspace';
import { FiltersBar } from './filters';
import { DetailDialog } from './ui/dialog';
import { Button } from './ui/button';
import { EmptyState, ErrorState, LoadingState } from './status';
import { compact, propertyLabel, title } from '@/lib/utils';
export function PropertiesPage(){
  const {filters}=useWorkspace();
  return <><div className="page-heading"><div><span className="eyebrow">THE RECORDS BEHIND THE NUMBERS</span><h1>Property explorer<span className="heading-period">.</span></h1><p>Structured, privacy-conscious records. All figures in original source units.</p></div><span className="dataset-badge"><Database size={12}/>READ ONLY</span></div><FiltersBar/><PropertyTable key={queryString(filters)}/></>;
}
function PropertyTable(){
  const {filters,setFilters}=useWorkspace();
  const {summary}=useAnalytics();
  const [page,setPage]=useState(1),[sort,setSort]=useState('price_value'),[order,setOrder]=useState('desc'),[size,setSize]=useState(5),[selected,setSelected]=useState<string|null>(null);
  const query=queryString(filters)+`&page=${page}&page_size=${size}&sort=${sort}&order=${order}`;
  const records=useQuery({queryKey:['properties',query],queryFn:()=>api(`properties?${query}`,propertyPageSchema)});
  const detail=useQuery({queryKey:['property',selected],queryFn:()=>api(`properties/${selected}`,propertySchema),enabled:!!selected});
  if(records.isError)return <ErrorState message={records.error.message} retry={()=>records.refetch()}/>;
  if(!records.data)return <LoadingState/>;
  const data=records.data;
  return <><div className="records-banner"><span className="status-dot"/><strong>{data.total} eligible records</strong><span>{summary.data?.provenance.kind==='illustrative'?'Illustrative fixture · not live advertisements':'Prepared source snapshot'}</span></div>
    <section className="table-panel"><div className="table-toolbar"><h2>Residential sales</h2><div><label>Sort by<select aria-label="Sort properties" value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="price_value">Asking price</option><option value="price_per_sqm">Price / m²</option><option value="building_size">Area</option><option value="city_slug">City</option></select></label><Button variant="ghost" size="icon" aria-label={order==='desc'?'Sort ascending':'Sort descending'} onClick={()=>{setOrder(order==='desc'?'asc':'desc');setPage(1);}}><ArrowDownUp size={14}/></Button></div></div>
      {!data.total?<EmptyState reset={()=>setFilters({})}/>:<div className="table-scroll"><table><thead><tr><th>Property</th><th>City</th><th>Area</th><th>Rooms</th><th>Built</th><th>Asking price</th><th>Price / m²</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>{data.items.map(p=><tr key={p.id}><td><span className="property-type"><span><Building2 size={17}/></span><div><strong>{propertyLabel(p.cat3_slug)}</strong><small>{p.id.slice(0,8)}</small></div></span></td><td><span className="table-city"><MapPin size={12}/>{title(p.city_slug)}</span></td><td>{p.building_size} <small>m²</small></td><td>{p.rooms_count??'—'}</td><td>{p.construction_year??'—'}</td><td className="price-cell" title={p.price_value.toLocaleString('en')}>{compact(p.price_value)}</td><td>{compact(p.price_per_sqm)}</td><td><button className="detail-link" aria-label={`View ${p.id} details`} onClick={()=>setSelected(p.id)}><ArrowUpRight size={17}/></button></td></tr>)}</tbody></table></div>}
      <div className="table-pagination"><label>Rows<select aria-label="Rows per page" value={size} onChange={e=>{setSize(Number(e.target.value));setPage(1);}}><option value={5}>5</option><option value={10}>10</option><option value={25}>25</option></select></label><span>{data.total?`${(page-1)*size+1}–${Math.min(page*size,data.total)}`:'0'} of {data.total}</span><Button variant="ghost" size="icon" aria-label="Previous page" disabled={page===1} onClick={()=>setPage(page-1)}><ChevronLeft size={16}/></Button><Button variant="ghost" size="icon" aria-label="Next page" disabled={page*size>=data.total} onClick={()=>setPage(page+1)}><ChevronRight size={16}/></Button></div>
    </section><p className="privacy-caption">No listing titles, descriptions, advertiser contacts, or precise property coordinates are exposed.</p>
    <DetailDialog open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}} title="Property details">{detail.isLoading?<p>Loading record…</p>:detail.error?<p role="alert">{detail.error.message}</p>:detail.data&&<><span className="dataset-badge sample">{summary.data?.provenance.kind==='illustrative'?'ILLUSTRATIVE RECORD':'SNAPSHOT RECORD'}</span><dl className="detail-fields">{Object.entries(detail.data).map(([key,value])=><div key={key}><dt>{title(key.replaceAll('_',' '))}</dt><dd>{typeof value==='boolean'?(value?'Yes':'No'):value===null?'Unknown':typeof value==='number'?value.toLocaleString('en',{maximumFractionDigits:2}):String(value)}</dd></div>)}</dl></>}</DetailDialog>
  </>;
}
