'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Activity, ArrowUpRight, BarChart3, Building2, ChevronDown, ChevronLeft, ChevronRight, Command, Database, Fingerprint, Globe2, LayoutDashboard, MapPin, PanelLeftClose, PanelLeftOpen, Search, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { useAnalytics, useWorkspace } from './workspace';
import { Button } from './ui/button';
import { compact, title } from '@/lib/utils';
const nav = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/analytics', label: 'Market analytics', icon: BarChart3 },
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/predict', label: 'Price prediction', icon: Sparkles },
  { href: '/model', label: 'Model performance', icon: Activity },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [insights, setInsights] = useState<boolean | null>(null);
  const toggleInsights = () => setInsights(value => value === null ? window.matchMedia('(max-width:1050px)').matches : !value);
  const { filters, setFilters } = useWorkspace();
  const { summary, cities } = useAnalytics();
  const data = summary.data;
  const active = nav.find(n => n.href === pathname) || nav[0];
  return <div className="app-frame">
    <header className="app-header"><Link href="/" className="brand"><span className="brand-mark"><Building2 size={18}/></span>AMLAAAK<span className="brand-dot">.</span></Link>
      <div className="header-breadcrumb"><span className="header-divider"/> <Globe2 size={15}/><span>Real estate intelligence</span><ChevronRight size={12}/><strong>{active.label}</strong></div>
      <div className="header-end"><span className="environment"><i/>Research workspace</span><button className="avatar" onClick={toggleInsights} aria-label="Toggle insights panel">A</button></div>
    </header>
    <div className={`app-body ${expanded ? 'nav-expanded' : ''} ${insights === false ? 'insights-hidden' : ''} ${insights === true ? 'insights-open' : ''}`}>
      <aside className="navigation"><button className="nav-toggle" onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}>{expanded ? <PanelLeftClose size={18}/> : <PanelLeftOpen size={18}/>}</button>
        <nav aria-label="Main navigation">{nav.map(item => <Link key={item.href} href={item.href} className={`nav-item ${pathname === item.href ? 'active' : ''}`} title={item.label} aria-current={pathname === item.href ? 'page' : undefined}><item.icon size={19}/><span>{item.label}</span></Link>)}</nav>
        <div className="nav-bottom"><a href="https://huggingface.co/datasets/divarofficial/real_estate_ads" target="_blank" rel="noreferrer" className="nav-item" title="Official dataset"><Database size={18}/><span>Data source</span></a><span className="nav-version">v1.0</span></div>
      </aside>
      <main id="main-content" className="workspace">
        <div className="workspace-toolbar"><div className="view-tab"><active.icon size={15}/>{active.label}<ChevronDown size={12}/></div>
          <div className="toolbar-actions"><label className="search-box"><Search size={14}/><input aria-label="Search listings" placeholder="Search city or property…" value={filters.search || ''} onChange={e => setFilters({ ...filters, search: e.target.value })}/><Command size={12}/></label>
            <label className="city-select"><MapPin size={13}/><select aria-label="Selected city" value={filters.city || ''} onChange={e => setFilters({ ...filters, city: e.target.value || undefined })}><option value="">All cities</option>{data?.available_cities.map(city => <option key={city} value={city}>{title(city)}</option>)}</select></label>
            <button className="insights-toggle" onClick={toggleInsights} aria-label="Toggle insights"><SlidersHorizontal size={17}/></button>
          </div>
        </div>
        <div className="page-content">{children}</div>
        <footer className="workspace-footer"><span><i/> {data ? (data.provenance.kind === 'illustrative' ? 'Illustrative sample · Not live market data' : 'Prepared Divar snapshot') : 'Connecting to data source'}</span><span>Original source units · Currency unverified</span></footer>
      </main>
      {insights !== false && <aside className="insights-panel" aria-label="Contextual insights"><header><span className="insight-symbol"><Sparkles size={18}/></span><strong>Market lens</strong><span className="rule-badge">RULE BASED</span><button aria-label="Close insights" onClick={() => setInsights(false)}><X size={15}/></button></header>
        <div className="insights-content"><div className="insight-intro"><span className="eyebrow">CONTEXTUAL INSIGHTS</span><h2>A clearer view of<br/>your property data.</h2><p>Calculated from the current selection.<br/>No generative AI or market forecasts.</p></div>
          <section className="insight-card"><div className="insight-card-heading"><span className="status-dot"/>Selection summary<ChevronDown size={13}/></div>
            {data ? <><div className="insight-number">{data.count}<span>eligible listings</span></div><p>{filters.city ? title(filters.city) : `${data.cities_count} cities`} · {filters.property_type ? (filters.property_type === 'apartment-sell' ? 'Apartments' : 'Houses / villas') : 'Residential sales'}</p>
              <div className="mini-city-bars">{cities.data?.slice(0,4).map((city, i) => <button key={city.city} onClick={() => setFilters({ ...filters, city: city.city })}><span>{title(city.city)}</span><div><i style={{ width: `${city.count / Math.max(1,...(cities.data || []).map(c=>c.count)) * 100}%`, background: i === 0 ? '#8c7bfa' : '#3cbccc' }}/></div><b>{city.count}</b></button>)}</div></> : <p>{summary.isError ? 'Data source unavailable. Review the dashboard error.' : 'Loading verified aggregates…'}</p>}
          </section>
          {data && <section className="observation"><span className="insight-icon"><BarChart3 size={15}/></span><h3>Asking price snapshot</h3><p>The median asking price is <strong>{compact(data.median_price)}</strong>, with a median of <strong>{compact(data.median_price_per_sqm)}</strong> per m² in original source units.</p><span className="small-note">{data.count < 30 ? 'Small sample. No statistical market inference.' : 'Descriptive snapshot, not a market forecast.'}</span></section>}
          <section className="provenance-card"><ShieldCheck size={18}/><h3>Know what you’re looking at</h3><p>{data?.provenance.note || 'Data provenance is unavailable until the backend connects.'}</p><div className="provenance-line"><span>Model</span><b>{data?.model.available ? (data.model.mode === 'illustrative' ? 'Demo artifact' : 'Loaded') : 'Unavailable'}</b></div><div className="provenance-line"><span>Source revision</span><code>{data?.provenance.revision || '—'}</code></div><Link href="/model">Inspect model provenance <ArrowUpRight size={12}/></Link></section>
          <div className="suggested-actions"><span className="eyebrow">EXPLORE FURTHER</span><Link href="/analytics">Compare city asking prices <ChevronRight size={13}/></Link><Link href="/predict">Explore the price model <ChevronRight size={13}/></Link><Button variant="ghost" size="sm" onClick={() => setFilters({})}>Reset all filters <ChevronLeft size={12}/></Button></div>
          <div className="insight-disclaimer"><Fingerprint size={16}/><p>Privacy first. No advertiser details, listing descriptions, or exact property locations.</p></div>
        </div>
      </aside>}
    </div>
  </div>;
}
