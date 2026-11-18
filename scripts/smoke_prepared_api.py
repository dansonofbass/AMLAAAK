"""Read-only acceptance checks against a prepared backend or the Next proxy.

No listing data is written. Report contains only aggregate counts and timings.
Requires the explicitly selected release; a healthy old provider is not success.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import time
import httpx

ROOT=Path(__file__).resolve().parents[1]


def require(condition, message='Prepared API contract or release expectation failed'):
    if not condition:
        raise ValueError(message)


def smoke(base_url, *, token=None):
    release=json.loads((ROOT/'apps/api/prepared-release.json').read_text())
    headers={'Authorization':'Bearer '+token} if token else {}
    timings={}
    with httpx.Client(base_url=base_url.rstrip('/'),headers=headers,timeout=60,follow_redirects=False) as client:
        def call(path,body=None):
            started=time.perf_counter()
            response=client.post('/api/v1/'+path,json=body) if body is not None else client.get('/api/v1/'+path)
            if response.status_code!=200:
                raise ValueError(f'Acceptance request failed: {path.split("?")[0]} HTTP {response.status_code}')
            key=path.split('?')[0]
            if key.startswith('properties/'):
                key='properties/detail'
            timings[key]=round(time.perf_counter()-started,3)
            return response.json()
        status=call('model/status')
        require(status['available'] and status['mode']=='trained' and status['version']=='267eff7c36f3')
        summary=call('dashboard/summary')
        require(summary['provenance']['provider']=='prepared', 'Expected prepared provider; activate the backend prepared mode and redeploy')
        require(summary['provenance']['revision']==release['revision'])
        require(summary['provenance']['source_sha256']==release['manifest_sha256'])
        require(summary['count']==release['expected_prepared_rows'] and summary['cities_count']==release['expected_cities'])
        require(summary['provenance']['coverage']['source_processing_complete'])
        cities=call('analytics/cities')
        require(len(cities)==release['expected_cities'] and sum(c['count'] for c in cities)==summary['count'])
        distribution=call('analytics/distributions')
        require(sum(b['count'] for b in distribution['price'])==summary['count'])
        facets=call('data/facets?city=tehran')
        require(len(facets['cities'])==release['expected_cities'] and facets['neighborhoods'])
        first=call('properties?page=1&page_size=5&sort=price_value&order=asc')
        second=call('properties?page=2&page_size=5&sort=price_value&order=asc')
        require(first['total']==summary['count'] and len(first['items'])==len(second['items'])==5)
        require(not {p['id'] for p in first['items']} & {p['id'] for p in second['items']})
        require([p['price_value'] for p in first['items']+second['items']]==sorted(p['price_value'] for p in first['items']+second['items']))
        require(call('properties/'+first['items'][0]['id'])['id']==first['items'][0]['id'])
        city=call('properties?city=tehran&page_size=5&sort=building_size&order=desc')
        require(city['items'] and all(p['city_slug']=='tehran' for p in city['items']))
        require([p['building_size'] for p in city['items']]==sorted((p['building_size'] for p in city['items']),reverse=True))
        example=city['items'][0]
        # Tight bounds around a genuine retrieved record. Neighborhood cuts cold
        # filtering to relevant chunks rather than requiring a global scan.
        params={'city':'tehran','area_min':example['building_size'],'area_max':example['building_size'],
                'price_min':example['price_value'],'price_max':example['price_value']}
        if example.get('neighborhood_slug'):
            params['neighborhood']=example['neighborhood_slug']
        from urllib.parse import urlencode
        filtered=call('properties?'+urlencode(params))
        require(filtered['total']>0)
        require(all(p['building_size']==example['building_size'] and p['price_value']==example['price_value'] for p in filtered['items']))
        body=dict(city_slug='tehran',cat3_slug='apartment-sell',building_size=90,rooms_count=2,floor=2,
            total_floors_count=5,construction_year=1395,has_parking=True,has_elevator=True,has_balcony=False,has_warehouse=False)
        prediction=call('predict',body)
        require(prediction['predicted_price']>0 and prediction['model']['version']=='267eff7c36f3')
        valuation=call('valuation',body)
        require(valuation['prediction']['predicted_price']==prediction['predicted_price'])
        require(valuation['provenance']['provider']=='prepared' and valuation['comparables'])
        require(valuation['coverage']['exhaustive'] and all(c['property']['source_identity'].startswith('hf://datasets/divarofficial/') for c in valuation['comparables']))
        health=call('health')
        require(health['provider']=='prepared' and health['dataset_ready'] and health['model_available'])
    return dict(checked_at=datetime.now(timezone.utc).isoformat(),base_url=base_url,
        provider='prepared',revision=release['revision'],prepared_sales=summary['count'],cities=len(cities),
        tehran_records=city['total'],tehran_neighborhoods=len(facets['neighborhoods']),
        comparable_candidates=valuation['coverage']['eligible_records'],comparables=len(valuation['comparables']),
        model_version=status['version'],predicted_price=prediction['predicted_price'],
        pagination_filtering_sorting_statistics_details_passed=True,timings_seconds=timings)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url',required=True)
    parser.add_argument('--output',type=Path,default=ROOT/'data/prepared-api-smoke.json')
    args=parser.parse_args()
    try:
        report=smoke(args.base_url,token=os.getenv('AMLAAAK_API_TOKEN') or os.getenv('API_TOKEN'))
    except (AssertionError,ValueError,httpx.HTTPError,KeyError) as exc:
        message=str(exc) if isinstance(exc,ValueError) and not isinstance(exc,httpx.HTTPError) else type(exc).__name__
        raise SystemExit(f'Prepared API acceptance failed: {message}; inspect provider, authentication and deployment logs.') from None
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,indent=2))
