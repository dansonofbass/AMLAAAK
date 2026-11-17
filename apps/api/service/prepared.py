"""Pinned private prepared-data serving; no Dataset Server /rows calls.

Precomputed global aggregates and sorted page chunks avoid full-population loads.
Arbitrary combined filters require a city; guarded city partitions are exhaustive
within the prepared archive or fail explicitly, never silently truncate.
"""
from collections import OrderedDict
from datetime import datetime, timezone
import gzip
import io
import json
import os
import re
import threading
import time

import httpx
from .analytics import Repository, CITY_CENTERS
from .huggingface import UpstreamUnavailable
from .prepared_format import validate_manifest, validate_record, sha256, group_key
from .schemas import (Snapshot, Provenance, Coverage, Summary, City, Distributions,
                      Facets, PropertyPage, Filters)


class PreparedDataProvider:
    provider_name = 'prepared'
    def __init__(self, repo=None, revision=None, manifest_hash=None, token=None, client=None):
        self.repo = repo or os.getenv('AMLAAAK_PREPARED_DATA_REPO', '')
        self.revision = revision or os.getenv('AMLAAAK_PREPARED_DATA_REVISION', '')
        self.manifest_hash = manifest_hash or os.getenv('AMLAAAK_PREPARED_DATA_MANIFEST_SHA256', '')
        self.token = token or os.getenv('HF_TOKEN')
        if (not re.fullmatch(r'[\w.-]+/[\w.-]+', self.repo) or not re.fullmatch(r'[a-f0-9]{40}', self.revision)
                or not re.fullmatch(r'[a-f0-9]{64}', self.manifest_hash) or not self.token):
            raise ValueError('Prepared mode needs repository, immutable revision, trusted manifest hash and server-side HF_TOKEN')
        self.client = client or httpx.Client(timeout=httpx.Timeout(8,connect=3),follow_redirects=True)
        self.manifest = self.catalog = None
        self.checked = self.has_population = False
        self.lock = threading.RLock()
        self.cache = OrderedDict()
        self.cache_bytes = 0
        self.fetched_at = None

    def _download(self, path, expected, maximum, size=None):
        url = f'https://huggingface.co/datasets/{self.repo}/resolve/{self.revision}/prepared/{path}'
        try:
            # Only the initial trusted HF host receives credentials. httpx strips
            # Authorization on cross-origin redirects to the signed file CDN.
            with self.client.stream('GET',url,headers={'Authorization':'Bearer '+self.token},follow_redirects=True) as response:
                if response.status_code != 200:
                    raise UpstreamUnavailable(f'Prepared data request failed (HTTP {response.status_code}); check backend dataset access')
                data = bytearray()
                for block in response.iter_bytes():
                    data.extend(block)
                    if len(data)>maximum:
                        raise UpstreamUnavailable('Prepared file exceeds its serving size guard')
            if (size is not None and len(data)!=size) or sha256(data)!=expected:
                raise UpstreamUnavailable('Prepared file integrity verification failed')
            return bytes(data)
        except (httpx.HTTPError, ValueError) as exc:
            raise UpstreamUnavailable('Prepared dataset unavailable; no fallback data was substituted') from exc

    def _ensure(self):
        with self.lock:
            self.checked = True
            if self.manifest is not None:
                return
            try:
                manifest = validate_manifest(json.loads(self._download('manifest.json',self.manifest_hash,8*1024*1024)))
                self.manifest = manifest
                catalog = self._file('catalog.json')
                if (catalog['groups']['*|*']['count'] != manifest['total_prepared_rows']
                        or len(catalog['cities']) != manifest['total_cities']
                        or sum(manifest['files'][p]['rows'] for p in catalog['partitions']) != manifest['total_prepared_rows']):
                    raise ValueError('Prepared catalog count mismatch')
                self.catalog = catalog
                self.fetched_at = datetime.now(timezone.utc).isoformat()
                self.has_population = True
            except (ValueError, KeyError, TypeError) as exc:
                self.manifest = self.catalog = None
                raise UpstreamUnavailable('Prepared manifest/catalog validation failed') from exc
            except UpstreamUnavailable:
                self.manifest = self.catalog = None
                raise

    def _file(self, path):
        try:
            return self._read_file(path)
        except (ValueError, KeyError, TypeError, OSError, EOFError) as exc:
            raise UpstreamUnavailable('Prepared file failed schema or decompression validation') from exc

    def _read_file(self, path):
        with self.lock:
            cached = self.cache.get(path)
            if cached and time.monotonic()-cached[0] < 120:
                self.cache.move_to_end(path)
                return json.loads(cached[1])
            info = self.manifest['files'].get(path)
            if info is None:
                raise UpstreamUnavailable('Requested file is absent from the trusted inventory')
            raw = self._download(path,info['sha256'],min(info['bytes'],32*1024*1024),info['bytes'])
            if path.endswith('.gz'):
                with gzip.GzipFile(fileobj=io.BytesIO(raw)) as stream:
                    raw = stream.read(8*1024*1024+1)
                if len(raw)>8*1024*1024:
                    raise UpstreamUnavailable('Prepared chunk exceeds decompressed size guard')
            value = json.loads(raw)
            if info['kind'] in ('view','partition'):
                if len(value)!=info['rows'] or len(value)>2000:
                    raise UpstreamUnavailable('Prepared chunk row count mismatch')
                for row in value:
                    validate_record(row)
            if cached:
                self.cache_bytes -= len(self.cache.pop(path)[1])
            # Cache serialized bytes, not unbounded Python object graphs.
            while self.cache and (self.cache_bytes+len(raw)>24*1024*1024 or len(self.cache)>=32):
                _,old = self.cache.popitem(last=False)
                self.cache_bytes -= len(old[1])
            if len(raw)<=24*1024*1024:
                self.cache[path]=(time.monotonic(),raw)
                self.cache_bytes+=len(raw)
            return value

    @staticmethod
    def dynamic(filters):
        return any(value not in (None,'') for key,value in filters.model_dump().items()
                   if key not in ('city','property_type','page','page_size','sort','order'))

    def provenance(self, count, examined=0, method='prepared_precomputed_aggregates'):
        m = self.manifest
        return Provenance(kind='divar',provider='prepared',
            source_url=f'https://huggingface.co/datasets/{self.repo}',source_sha256=self.manifest_hash,
            revision=self.revision,input_rows=m['total_source_rows'],eligible_rows=m['total_prepared_rows'],
            fetched_at=self.fetched_at,period_start=self.catalog['period_start'],period_end=self.catalog['period_end'],
            note='Prepared historical sales archive. Search coverage is separate from the unchanged model training population.',
            coverage=Coverage(records_examined=examined,normalized_records=m['total_prepared_rows'],eligible_records=count,
                upstream_matching_rows=m['total_prepared_rows'],exhaustive=True,bounded=False,statistics_full_population=True,
                remote_filter_supported=False,remote_sort_supported=True,sorting_scope='complete_prepared_query',method=method,
                source_processing_complete=m['full_source_verified'],
                limitations=[
                    'Exhaustive for the configured prepared archive/query, not active advertisements or the housing market.',
                    f'Source processing: {m["total_source_rows"]} rows; full pinned-source inventory verified: {m["full_source_verified"]}.',
                    'Sales only; rental prices are excluded. Original currency units remain unverified.',
                    'Additional searchable records were not used to retrain the approved model.',
                    'Combined numeric/search filters require a city; oversized city queries fail rather than truncate.',
                ]))

    def group(self, filters):
        self._ensure()
        return self.catalog['groups'].get(group_key(filters.city,filters.property_type),
            dict(count=0,median_price=None,average_price=None,median_price_per_sqm=None,cities_count=0,
                 available_cities=[],neighborhoods=[],distributions=None))

    def population(self, filters):
        self._ensure()
        if not filters.city:
            raise UpstreamUnavailable('Select a city for combined numeric, neighborhood or text filters; global unfiltered statistics and pages remain available')
        paths = [p for p in self.catalog['partitions'] if self.manifest['files'][p]['city']==filters.city
                 and (not filters.property_type or self.manifest['files'][p]['category']==filters.property_type)
                 and (not filters.neighborhood or filters.neighborhood in self.manifest['files'][p]['neighborhoods'])]
        if (sum(self.manifest['files'][p]['rows'] for p in paths)>150000
                or sum(self.manifest['files'][p]['bytes'] for p in paths)>32*1024*1024):
            raise UpstreamUnavailable('City query exceeds the safe request budget; select a property category or neighborhood')
        try:
            records = []
            started = time.monotonic()
            for path in paths:
                if time.monotonic()-started > 25:
                    raise UpstreamUnavailable('Prepared city query exceeded its time budget; narrow the category or neighborhood')
                records.extend(validate_record(row) for row in self._file(path))
            result = object.__new__(Repository)
            result.snapshot = Snapshot(provenance=self.provenance(len(records),len(records),'prepared_city_partitions'),properties=records)
            return result
        except (ValueError, KeyError, OSError, EOFError) as exc:
            raise UpstreamUnavailable('Prepared partition failed validation') from exc

    def summary(self, filters, model):
        if self.dynamic(filters):
            return None
        group = self.group(filters)
        return Summary(**{k:v for k,v in group.items() if k not in ('neighborhoods','distributions')},
                       provenance=self.provenance(group['count']),model=model)

    def cities(self, filters):
        if self.dynamic(filters):
            return None
        self._ensure()
        values=[]
        for city in self.catalog['cities']:
            if filters.city and city!=filters.city:
                continue
            group=self.group(Filters(city=city,property_type=filters.property_type))
            if group['count']:
                lat,lon=CITY_CENTERS.get(city,(None,None))
                values.append(City(city=city,count=group['count'],median_price=group['median_price'],
                    median_price_per_sqm=group['median_price_per_sqm'],latitude=lat,longitude=lon,
                    coverage=self.provenance(group['count']).coverage,source_revision=self.revision))
        return sorted(values,key=lambda v:(-v.count,v.city))

    def distribution(self, filters):
        if self.dynamic(filters):
            return None
        group=self.group(filters)
        if group['distributions'] is None:
            from .analytics import distributions
            return distributions([]).model_copy(update={'coverage':self.provenance(0).coverage})
        return Distributions(**group['distributions'],coverage=self.provenance(group['count']).coverage)

    def facets(self, city):
        group=self.group(Filters(city=city))
        provenance=self.provenance(group['count'])
        return Facets(cities=self.catalog['cities'],neighborhoods=group['neighborhoods'],
                      provenance=provenance,coverage=provenance.coverage)

    def page(self, filters):
        if self.dynamic(filters):
            if not filters.city:
                raise UpstreamUnavailable('Select a city to filter the property table')
            return None
        self._ensure()
        total=self.group(filters)['count']
        low=(filters.page-1)*filters.page_size
        high=min(total,low+filters.page_size)
        if filters.order=='desc':
            low,high=max(0,total-high),max(0,total-low)
        offset=0
        rows=[]
        views=self.catalog['city_views'].get(filters.city,{}) if filters.city else self.catalog['views']
        for path in views.get(filters.sort,[]):
            info=self.manifest['files'][path]
            size=info['category_counts'].get(filters.property_type,0) if filters.property_type else info['rows']
            if offset<high and offset+size>low:
                records=self._file(path)
                if filters.property_type:
                    records=[r for r in records if r['cat3_slug']==filters.property_type]
                rows.extend(validate_record(r) for r in records[max(0,low-offset):min(size,high-offset)])
            offset+=size
        if filters.order=='desc':
            rows.reverse()
        provenance=self.provenance(total,len(rows),'prepared_sorted_page_index')
        return PropertyPage(items=rows,total=total,page=filters.page,page_size=filters.page_size,
                            provenance=provenance,coverage=provenance.coverage)

    def find(self, property_id):
        self._ensure()
        if not re.fullmatch(r'[a-f0-9]{16}',property_id):
            return None
        path='lookup/'+property_id[:2]+'.json.gz'
        if path not in self.manifest['files']:
            return None
        target=self._file(path).get(property_id)
        return next((validate_record(row) for row in self._file(target) if row['id']==property_id),None) if target else None
