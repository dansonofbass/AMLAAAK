"""Bounded Hugging Face Dataset Server access. No full dataset download or database."""
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
import threading
import time
from email.utils import parsedate_to_datetime
import httpx
from .analytics import Repository
from .normalization import normalize_sale
from .schemas import Snapshot, Property, Provenance, Coverage, Filters

DATASET = 'divarofficial/real_estate_ads'
SERVER = 'https://datasets-server.huggingface.co'
SOURCE = f'https://huggingface.co/datasets/{DATASET}'


class UpstreamUnavailable(RuntimeError):
    pass


class HuggingFaceDataProvider:
    """A maximum 2,000 source rows/query; 8 populations/worker, TTL 120s.

    Filter queries are capability-probed. Failed filters fall back to the same
    bounded unfiltered prefix and ALWAYS record that limitation. No global sort
    or market-wide count is inferred from a prefix. Concurrent pages are read
    only after a first page establishes revision and available row count.
    """
    def __init__(self, max_records=300, ttl=120, client=None, sleep=time.sleep, use_remote_filter=True):
        self.max_records = max(100, min(2000, int(max_records)))
        headers = {'User-Agent': 'AMLAAAK/0.2 historical-real-estate-research'}
        if os.getenv('HF_TOKEN'):
            headers['Authorization'] = f'Bearer {os.environ["HF_TOKEN"]}'
        self.client = client or httpx.Client(timeout=httpx.Timeout(4, connect=2), headers=headers)
        self.sleep, self.ttl = sleep, ttl
        self.cache = OrderedDict()
        self.lock = threading.RLock()
        self.filter_disabled_until = 0 if use_remote_filter else float('inf')
        self.filter_error = None if use_remote_filter else 'Explicit rows-only retrieval for reproducibility'
        self.revision = None
        self.checked = False
        self.has_population = False

    def request(self, endpoint, params, attempts=2):
        for attempt in range(attempts):
            try:
                response = self.client.get(SERVER + endpoint, params=params)
                if response.status_code in (429, 500, 502, 503, 504):
                    if attempt + 1 == attempts:
                        raise UpstreamUnavailable(f'Hugging Face {endpoint} returned HTTP {response.status_code}')
                    try:
                        requested_delay=max(0., float(response.headers.get('retry-after', '0')))
                    except ValueError:
                        try:
                            requested_delay=max(0.,parsedate_to_datetime(response.headers['retry-after']).timestamp()-time.time())
                        except (ValueError,TypeError,KeyError):
                            requested_delay=0
                    if response.status_code==429 and requested_delay>2:
                        raise UpstreamUnavailable('Hugging Face is rate limited; retry later after the upstream waiting period')
                    retry_after=min(2.,requested_delay)
                    self.sleep(max(retry_after, 0.25 * 2 ** attempt))
                    continue
                if not response.is_success:
                    raise UpstreamUnavailable(f'Hugging Face {endpoint} returned HTTP {response.status_code}')
                if len(response.content) > 8 * 1024 * 1024:
                    raise UpstreamUnavailable('Upstream page exceeds the 8 MB response guard')
                data = response.json()
                return data, response.headers.get('x-revision')
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                if attempt + 1 == attempts:
                    raise UpstreamUnavailable('Hugging Face request timed out or connection failed') from exc
                self.sleep(0.25 * 2 ** attempt)
            except (ValueError, KeyError) as exc:
                raise UpstreamUnavailable('Hugging Face returned an invalid response') from exc
        raise UpstreamUnavailable('Upstream request failed')

    @staticmethod
    def where(filters):
        def literal(value):
            return "'" + value.replace("'", "''") + "'"
        conditions = ['"cat2_slug"=\'residential-sell\'',
                      '("cat3_slug"=\'apartment-sell\' OR "cat3_slug"=\'house-villa-sell\')',
                      '"price_value">0', '"building_size">0']
        for field, value in [('city_slug', filters.city), ('neighborhood_slug', filters.neighborhood), ('cat3_slug', filters.property_type)]:
            if value:
                conditions.append(f'"{field}"={literal(value)}')
        # Only genuinely numeric source columns: room/year strings are filtered after normalization.
        for field, low, high in [('building_size', filters.area_min, filters.area_max), ('price_value', filters.price_min, filters.price_max)]:
            if low is not None:
                conditions.append(f'"{field}">={low}')
            if high is not None:
                conditions.append(f'"{field}"<={high}')
        return ' AND '.join(conditions)

    def population(self, filters):
        with self.lock:  # Single flight and bounded cache mutations per worker.
            # Probe/retry unsupported filter operations once per five minutes.
            use_filter = time.monotonic() >= self.filter_disabled_until
            key = self.where(filters) if use_filter else 'unfiltered-prefix'
            cached = self.cache.get(key)
            if cached and time.monotonic() - cached[0] < self.ttl:
                self.cache.move_to_end(key)
                return cached[1]
            base = {'dataset': DATASET, 'config': 'default', 'split': 'train', 'offset': 0, 'length': 100}
            if not self.checked:
                splits, revision = self.request('/splits', {'dataset': DATASET})
                if not any(s.get('config') == 'default' and s.get('split') == 'train' for s in splits.get('splits', [])):
                    raise UpstreamUnavailable('Required default/train split is unavailable')
                self.revision, self.checked = revision, True
            endpoint = '/filter' if use_filter else '/rows'
            if use_filter:
                base['where'] = self.where(filters)
                try:
                    first, revision = self.request(endpoint, base, attempts=1)
                except UpstreamUnavailable as exc:
                    self.filter_disabled_until = time.monotonic() + 300
                    self.filter_error = str(exc)
                    base.pop('where')
                    endpoint, key = '/rows', 'unfiltered-prefix'
                    cached = self.cache.get(key)
                    if cached and time.monotonic() - cached[0] < self.ttl:
                        return cached[1]
                    first, revision = self.request(endpoint, base)
            else:
                first, revision = self.request(endpoint, base)
            if not revision:
                raise UpstreamUnavailable('Upstream omitted dataset revision; refusing unverifiable records')
            total = first.get('num_rows_total')
            if not isinstance(total, int) or not isinstance(first.get('rows'), list):
                raise UpstreamUnavailable('Upstream omitted row counts or records')
            pages = [(first, revision)]
            offsets = range(100, min(total, self.max_records), 100)
            def read_page(offset):
                return self.request(endpoint, {**base, 'offset': offset, 'length': min(100, self.max_records - offset)})
            with ThreadPoolExecutor(max_workers=3) as pool:
                pages.extend(pool.map(read_page, offsets))
            if any(r != revision for _, r in pages):
                raise UpstreamUnavailable('Dataset revision changed between pages; retry the query')
            records = [row for page, _ in pages for row in page.get('rows', [])]
            partial = any(page.get('partial', False) for page, _ in pages)
            properties, seen = [], set()
            for item in records:
                raw = item.get('row', {})
                row = normalize_sale(raw)
                if row is None:
                    continue
                fingerprint = json.dumps(row, sort_keys=True)
                if fingerprint in seen:
                    continue
                seen.add(fingerprint)
                index = item.get('row_idx')
                if not isinstance(index, int):
                    continue
                identity = f'hf://datasets/{DATASET}@{revision}/default/train/row/{index}'
                row['city_slug'] = row['city_slug'] or 'unknown'
                properties.append(Property(id=hashlib.sha256(identity.encode()).hexdigest()[:16], **row,
                    price_per_sqm=row['price_value']/row['building_size'], source_identity=identity,
                    source_row_index=index, source_revision=revision))
            exhaustive = len(records) >= total and not partial
            limitations = ['Historical asking prices, not active advertisements or completed sales.',
                           'Sorting and statistical summaries apply only to records actually retrieved.',
                           'Dataset Server does not provide a transactional market database.']
            if endpoint == '/rows':
                limitations.append(f'Remote filtering unavailable ({self.filter_error or "disabled"}); filters run within an unfiltered source prefix.')
            if not exhaustive:
                limitations.append(f'Examined {len(records)} of {total} upstream rows. No claim of complete filtered-market coverage.')
            if partial:
                limitations.append('Upstream reports a partial index.')
            coverage = Coverage(records_examined=len(records), normalized_records=len(properties), eligible_records=len(properties),
                upstream_matching_rows=total, exhaustive=exhaustive, bounded=not exhaustive, statistics_full_population=exhaustive,
                remote_filter_supported=endpoint == '/filter', method=endpoint + '_prefix', limitations=limitations)
            periods = [p.created_at_month for p in properties if p.created_at_month]
            provenance = Provenance(kind='divar', provider='huggingface', source_url=SOURCE, source_sha256=None, revision=revision,
                input_rows=len(records), eligible_rows=len(properties), coverage=coverage,
                fetched_at=datetime.now(timezone.utc).isoformat(), period_start=min(periods) if periods else None,
                period_end=max(periods) if periods else None,
                note='Genuine Divar historical records retrieved from Hugging Face. Bounded coverage; not a live housing feed.')
            repository = Repository.__new__(Repository)
            repository.snapshot = Snapshot(provenance=provenance, properties=properties)
            self.revision = revision
            self.has_population = True
            self.cache[key] = (time.monotonic(), repository)
            self.cache.move_to_end(key)
            while len(self.cache) > 8:
                self.cache.popitem(last=False)
            return repository

    def find(self, identifier):
        with self.lock:
            for _, repository in reversed(list(self.cache.values())):
                for row in repository.rows:
                    if row.id == identifier:
                        return row
        return None
