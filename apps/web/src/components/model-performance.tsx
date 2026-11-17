'use client';
import { useQuery } from '@tanstack/react-query';
import { Activity, Braces, FlaskConical, GitBranch, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { metricsSchema } from '@/lib/contracts';
import { compact } from '@/lib/utils';
import { ErrorState, LoadingState } from './status';
import { Button } from './ui/button';
export function ModelPerformance(){
  const query=useQuery({queryKey:['model-metrics'],queryFn:()=>api('model/metrics',metricsSchema)});
  if(query.isError)return <ErrorState message={query.error.message} retry={()=>query.refetch()}/>;
  if(!query.data)return <LoadingState/>;
  const m=query.data;
  return <><div className="page-heading"><div><span className="eyebrow">EVIDENCE BEFORE CONFIDENCE</span><h1>Model performance<span className="heading-period">.</span></h1><p>Verified artifact metadata and holdout evaluation.</p></div><span className="dataset-badge"><Activity size={12}/>{m.status.available?'ARTIFACT CONNECTED':'NO ARTIFACT'}</span></div>
    <div className="model-notice"><FlaskConical size={20}/><div><strong>{m.status.mode==='illustrative'?'Smoke-test evaluation only':'Model provenance'}</strong><p>{m.status.message}{m.status.mode==='illustrative'?' Two illustrative test records cannot establish real-world accuracy.':''}</p></div></div>
    {!m.scores?<div className="state-card"><Braces size={30}/><h2>No verified evaluation artifact</h2><p>Configure a trusted model bundle with metadata to inspect its metrics. Scores are never substituted from static examples.</p><Button variant="outline" onClick={()=>query.refetch()}>Check again</Button></div>:<>
      <div className="kpi-grid">{[{label:'Training records',v:m.train_rows},{label:'Test records',v:m.test_rows},{label:'Eligible sales',v:m.eligible_rows},{label:'Split seed',v:m.seed}].map(k=><div className="kpi-card" key={k.label}><div className="kpi-label">{k.label}<GitBranch size={14}/></div><strong>{k.v}</strong><div className="kpi-detail">Holdout {m.test_size!==null?m.test_size*100:'—'}%</div></div>)}</div>
      <section className="table-panel metrics-table"><div className="table-toolbar"><h2>Random Forest vs. median baseline</h2><span className="small-note">Same held-out test partition</span></div><div className="table-scroll"><table><thead><tr><th>Estimator</th><th>MAE ↓</th><th>RMSE ↓</th><th>R² ↑</th></tr></thead><tbody>{Object.entries(m.scores).map(([name,scores])=><tr key={name}><td><span className={`model-dot ${name==='random_forest'?'forest':''}`}/><strong>{name==='random_forest'?'Random Forest':'Training-median baseline'}</strong></td><td title={String(scores.mae)}>{compact(scores.mae)}</td><td title={String(scores.rmse)}>{compact(scores.rmse)}</td><td>{scores.r2.toFixed(6)}</td></tr>)}</tbody></table></div><p className="metric-footnote">MAE and RMSE retain source price units. Lower is better. R² may be negative; these scores describe this split only.</p></section>
      <div className="model-info-grid"><section className="info-panel"><h2><ShieldCheck size={17}/>Artifact provenance</h2><dl><dt>Model version</dt><dd><code>{m.status.version}</code></dd><dt>Input records</dt><dd>{m.input_rows}</dd><dt>Source SHA-256</dt><dd><code className="hash-text">{m.source_sha256}</code></dd>{Object.entries(m.versions).map(([name,v])=><div className="version-row" key={name}><dt>{name}</dt><dd>{v}</dd></div>)}</dl></section><section className="info-panel"><h2><Braces size={17}/>Feature contract</h2><div className="feature-chips">{m.features.map(f=><code key={f}>{f}</code>)}</div><p>Imputation and encoding are fitted within the training pipeline. The artifact retains its training-partition fit.</p></section></div>
      <div className="source-strip"><Activity size={18}/><div><strong>Residuals are not available</strong><p>No verified per-record evaluation artifact was exported. A residual plot is intentionally omitted.</p></div></div>
    </>}
  </>;
}
