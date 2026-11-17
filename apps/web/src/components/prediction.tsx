'use client';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, Check, CircleAlert, FlaskConical, Info, Layers3, LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { modelSchema, predictionInputSchema, predictionSchema, type PredictionInput } from '@/lib/contracts';
import { useAnalytics } from './workspace';
import { Button } from './ui/button';
import { compact, title } from '@/lib/utils';
export function PredictionPage() {
  const {summary}=useAnalytics();
  const status=useQuery({queryKey:['model-status'],queryFn:()=>api('model/status',modelSchema)});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [dirty,setDirty]=useState(false);
  const mutation=useMutation({mutationFn:(body:PredictionInput)=>api('predict',predictionSchema,{method:'POST',body:JSON.stringify(body)})});
  const submit=(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const input={city_slug:String(form.get('city_slug')||''),cat3_slug:String(form.get('cat3_slug')||''),
      ...Object.fromEntries(['building_size','rooms_count','floor','total_floors_count','construction_year'].map(k=>[k,form.get(k)===''?NaN:Number(form.get(k))])),
      ...Object.fromEntries(['has_parking','has_elevator','has_balcony','has_warehouse'].map(k=>[k,form.get(k)==='on']))};
    const parsed=predictionInputSchema.safeParse(input);
    if(!parsed.success){setErrors(Object.fromEntries(parsed.error.issues.map(issue=>[String(issue.path[0]),issue.message])));return;}
    setErrors({});setDirty(false);mutation.mutate(parsed.data);
  };
  const result=mutation.data;
  return <><div className="page-heading"><div><span className="eyebrow">FROM PROPERTY FEATURES TO AN ESTIMATE</span><h1>Price prediction<span className="heading-period">.</span></h1><p>A transparent Random Forest baseline. No invented certainty.</p></div><span className="dataset-badge sample"><FlaskConical size={12}/>RESEARCH PROTOTYPE</span></div>
    <div className={`model-notice ${status.data?.available?'':'unavailable'}`}><Info size={17}/><div><strong>{status.data?.available?(status.data.mode==='illustrative'?'Illustrative model connected':'Trained model connected'):'Model unavailable'}</strong><p>{status.error?.message||status.data?.message||'Checking model status…'}</p></div><Button variant="ghost" size="sm" onClick={()=>status.refetch()}>Refresh status</Button></div>
    <div className="prediction-grid"><form className="prediction-form" noValidate onSubmit={submit} onChange={()=>{setDirty(true);}}>
      <div className="section-heading"><span className="section-icon"><Building2 size={18}/></span><div><h2>Describe the property</h2><p>Residential sale listings only</p></div><span className="step-number">01 / 02</span></div>
      <div className="form-grid"><label>City slug<input name="city_slug" list="city-options" defaultValue="tehran" placeholder="e.g. tehran" aria-invalid={!!errors.city_slug} aria-describedby="city-help"/><datalist id="city-options">{summary.data?.available_cities.map(c=><option key={c} value={c}>{title(c)}</option>)}</datalist><small id="city-help">Use the source city slug. Unseen cities have no learned city effect.</small>{errors.city_slug&&<span className="form-error">{errors.city_slug}</span>}</label>
        <label>Property type<select name="cat3_slug"><option value="apartment-sell">Apartment</option><option value="house-villa-sell">House / villa</option></select></label>
        {[
          {name:'building_size',label:'Building area',unit:'m²',value:90,min:1,max:10000,step:'any'},
          {name:'rooms_count',label:'Rooms',unit:'rooms',value:2,min:0,max:20},
          {name:'floor',label:'Floor',unit:'level',value:2,min:-5,max:100},
          {name:'total_floors_count',label:'Total floors',unit:'floors',value:5,min:1,max:100},
          {name:'construction_year',label:'Construction year',unit:'Solar Hijri',value:1395,min:1200,max:1500},
        ].map(field=><label key={field.name}>{field.label}<div className="input-with-unit"><input name={field.name} type="number" defaultValue={field.value} min={field.min} max={field.max} step={field.step||1} aria-invalid={!!errors[field.name]}/><span>{field.unit}</span></div>{errors[field.name]&&<span className="form-error">{errors[field.name]}</span>}</label>)}
      </div><fieldset className="amenity-inputs"><legend>Property amenities</legend>{['parking','elevator','balcony','warehouse'].map(feature=><label key={feature}><input name={`has_${feature}`} type="checkbox" defaultChecked={feature==='parking'||feature==='elevator'}/><span className="checkbox-indicator"><Check size={12}/></span>{title(feature)}</label>)}</fieldset>
      <div className="form-note"><ShieldCheck size={15}/><p>No address, contact information, or personal data is requested or stored.</p></div>
      <Button type="submit" disabled={!status.data?.available||mutation.isPending} className="predict-button">{mutation.isPending?<LoaderCircle size={16} className="loading-icon"/>:<Sparkles size={16}/>}Estimate asking price <ArrowRight size={16}/></Button>
      {Object.keys(errors).length>0&&<p role="alert" className="form-error">Please correct the highlighted property fields.</p>}
      {mutation.error&&<p role="alert" className="form-error">{mutation.error.message}</p>}
    </form>
    <div className="prediction-results"><div className="section-heading"><span className="section-icon"><Layers3 size={18}/></span><div><h2>Your estimate</h2><p>Calculated by the configured model</p></div><span className="step-number">02 / 02</span></div>
      {result?<div className={`result-card ${dirty?'result-stale':''}`} aria-live="polite"><span className="eyebrow">{result.model.mode==='illustrative'?'ILLUSTRATIVE MODEL OUTPUT':'MODEL ESTIMATE'}</span><strong className="prediction-number">{compact(result.predicted_price)}</strong><p>{result.units}</p><div className="result-per-sqm"><span>Asking price / m²</span><strong>{compact(result.price_per_sqm)}</strong></div><div className="exact-estimate">Exact output: {result.predicted_price.toLocaleString('en',{maximumFractionDigits:2})}</div>{dirty&&<p className="form-error">Inputs changed. Run the model again to update this estimate.</p>}<div className="model-signature"><span>Random Forest</span><code>{result.model.version}</code></div></div>:<div className="result-placeholder"><div className="orbit-icon"><Sparkles size={28}/></div><h3>{status.data?.available?'Ready when you are.':'Waiting for a model.'}</h3><p>{status.data?.available?'Set the property features and run an estimate. Results are returned by the Python model.':'Analytics work without a model. Configure a trusted artifact bundle to enable real inference.'}</p><span className="empty-price">— <small>source units</small></span></div>}
      <div className="prediction-caveats"><CircleAlert size={17}/><h3>Read before using an estimate</h3><ul>{(result?.warnings||['Asking prices are not completed-sale prices.','Illustrative models do not establish market accuracy.','No confidence interval or investment recommendation is provided.','Currency units remain unverified.']).map(w=><li key={w}>{w}</li>)}</ul></div>
    </div></div>
  </>;
}
