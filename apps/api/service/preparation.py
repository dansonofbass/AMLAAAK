"""Offline, disk-backed preparation. Never imported by the HTTP runtime.

Only normalized structured sales enter the staging database. SQLite here is an
ephemeral Colab work file, not a deployed database or a service dependency.
"""
from collections import Counter
from datetime import datetime, timezone
import gzip
import json
from pathlib import Path
import math
import sqlite3

from .normalization import normalize_sale, text
from .prepared_format import (SOURCE_REPO, SOURCE_REVISION, SCHEMA_VERSION, SORTS,
                              encode, sha256, file_hash, group_key, valid_slug, validate_record, validate_manifest)

REQUIRED = {'cat2_slug', 'cat3_slug', 'price_mode', 'price_value', 'building_size', 'city_slug'}
SOURCE_FIELDS = REQUIRED | {'rooms_count', 'floor', 'total_floors_count', 'construction_year',
    'has_parking', 'has_elevator', 'has_balcony', 'has_warehouse', 'neighborhood_slug', 'created_at_month'}


def source_batches(path):
    """Read pinned Parquet directly or the original CSV with HF Datasets streaming."""
    import pyarrow as pa
    import pyarrow.parquet as pq
    path=Path(path)
    if path.suffix=='.parquet':
        source=pq.ParquetFile(path)
        columns=set(source.schema_arrow.names)
        if not REQUIRED<=columns:
            raise ValueError('Source schema missing required fields')
        yield from source.iter_batches(batch_size=1024,columns=sorted(SOURCE_FIELDS & columns))
    elif path.suffix=='.csv':
        import csv
        from datasets import load_dataset, Features, Value
        with path.open(encoding='utf-8-sig',newline='') as stream:
            header=next(csv.reader(stream))
        if len(set(header))!=len(header) or not REQUIRED<=set(header):
            raise ValueError('Source CSV schema missing or duplicated fields')
        source=load_dataset('csv',data_files={'train':str(path)},split='train',streaming=True,
                            features=Features({name:Value('string') for name in header}))
        source=source.select_columns(sorted(SOURCE_FIELDS & set(header)))
        for batch in source.iter(batch_size=1024):
            yield pa.RecordBatch.from_pydict(batch)
    else:
        raise ValueError('Unsupported source partition format')


def inspect_source(path):
    # An independent complete streaming pass verifies readable EOF and source row
    # counts before the normalization pass; no source record is retained.
    return sum(batch.num_rows for batch in source_batches(path))


def build_dataset(source_parts, output, *, chunk_rows=2000, progress=print):
    """Each part: path(local), source_path, sha256, expected_rows from a pinned file.

    All source parts must be supplied. No max-row option is provided. Completeness
    is relative to this verified inventory, not active listings or the market.
    """
    import pyarrow as pa
    import pyarrow.parquet as pq
    if not source_parts or len({p['source_path'] for p in source_parts}) != len(source_parts):
        raise ValueError('Expected source partition inventory is empty or duplicated')
    if not 1 <= chunk_rows <= 2000:
        raise ValueError('Chunk size must be between 1 and 2000')
    output = Path(output)
    if output.exists() and any(output.iterdir()):
        raise ValueError('Use a new empty output folder; previous data is preserved')
    output.mkdir(parents=True, exist_ok=True)
    stage = output.parent / (output.name + '-staging.sqlite')
    if stage.exists():
        raise ValueError('Staging file exists; choose a fresh output name')
    db = sqlite3.connect(stage)
    db.execute('PRAGMA temp_store=FILE')
    db.execute('PRAGMA cache_size=-8192')
    db.execute('CREATE TABLE listings (id TEXT PRIMARY KEY, city_slug TEXT, cat3_slug TEXT, neighborhood_slug TEXT, '
               'price_value REAL, building_size REAL, price_per_sqm REAL, payload TEXT) WITHOUT ROWID')
    counts, inventory = Counter(), []
    db.execute('CREATE TABLE lookup (id TEXT PRIMARY KEY, path TEXT) WITHOUT ROWID')
    files, partitions = {}, []

    def save(path, data, kind, **attributes):
        target = output / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        files[path] = dict(sha256=sha256(data), bytes=len(data), kind=kind, **attributes)
        return path

    def save_chunk(rows, path, kind, **attrs):
        records = [json.loads(row[0]) for row in rows]
        for record in records:
            validate_record(record)
        save(path, gzip.compress(encode(records), mtime=0), kind, rows=len(records), **attrs)
        if kind == 'view':
            files[path]['category_counts'] = dict(Counter(p['cat3_slug'] for p in records))
        return records

    try:
        for part in source_parts:
            path = Path(part['path'])
            if file_hash(path) != part['sha256']:
                raise ValueError('Source file hash mismatch')
            processed = 0
            for batch in source_batches(path):
                for raw in batch.to_pylist():
                    index = counts['source_rows']
                    counts['source_rows'] += 1
                    processed += 1
                    if text(raw.get('cat2_slug')) == 'residential-rent':
                        counts['rental_rows_excluded'] += 1
                        continue
                    normalized = normalize_sale(raw)
                    if normalized is None:
                        counts['other_ineligible_rows'] += 1
                        continue
                    if not math.isfinite(normalized['price_value']/normalized['building_size']):
                        counts['invalid_price_per_sqm'] += 1
                        continue
                    if not valid_slug(normalized['city_slug'], 80):
                        counts['invalid_city_rows'] += 1
                        continue
                    if normalized['neighborhood_slug'] and not valid_slug(normalized['neighborhood_slug']):
                        normalized['neighborhood_slug'] = None
                        counts['invalid_neighborhood_values'] += 1
                    # Safe-field equivalence, not a claim that different homes are the same.
                    signature = encode(normalized)
                    identity = sha256(signature)[:16]
                    counts['eligible_before_dedup'] += 1
                    normalized.update(id=identity, price_per_sqm=normalized['price_value']/normalized['building_size'],
                        source_revision=SOURCE_REVISION, source_row_index=index,
                        source_identity=f'hf://datasets/{SOURCE_REPO}@{SOURCE_REVISION}/{part["source_path"]}#row={processed-1}')
                    validate_record(normalized)
                    inserted = db.execute('INSERT OR IGNORE INTO listings VALUES (?,?,?,?,?,?,?,?)',
                        (identity, normalized['city_slug'], normalized['cat3_slug'], normalized['neighborhood_slug'],
                         normalized['price_value'], normalized['building_size'], normalized['price_per_sqm'], encode(normalized).decode()))
                    if inserted.rowcount==0:
                        existing=json.loads(db.execute('SELECT payload FROM listings WHERE id=?',(identity,)).fetchone()[0])
                        if {k:existing[k] for k in json.loads(signature)}!=json.loads(signature):
                            raise ValueError('Record identity hash collision; preparation stopped')
                db.commit()
                progress(f'Processed {counts["source_rows"]:,} source rows')
            if processed != part['expected_rows']:
                raise ValueError('Source partition was not processed completely')
            inventory.append({k: part[k] for k in ('source_path', 'sha256', 'expected_rows') } | {'processed_rows': processed})

        total = db.execute('SELECT count(*) FROM listings').fetchone()[0]
        if not total:
            raise ValueError('No eligible prepared sales')
        counts['duplicates_removed'] = counts['eligible_before_dedup'] - total
        db.execute('CREATE INDEX geographic ON listings(city_slug,cat3_slug,neighborhood_slug)')
        for sort in SORTS:
            db.execute(f'CREATE INDEX sort_{sort} ON listings({sort},id)')
        cities = [r[0] for r in db.execute('SELECT DISTINCT city_slug FROM listings ORDER BY city_slug')]
        categories = ['apartment-sell', 'house-villa-sell']

        def clause(city, category):
            pairs = [(k, v) for k, v in [('city_slug', city), ('cat3_slug', category)] if v]
            return (' WHERE ' + ' AND '.join(k+'=?' for k,v in pairs) if pairs else ''), tuple(v for k,v in pairs)

        def aggregate(city, category):
            where, params = clause(city, category)
            n, avg = db.execute('SELECT count(*),avg(price_value) FROM listings'+where, params).fetchone()
            def median(field):
                if not n:
                    return None
                values = db.execute(f'SELECT {field} FROM listings{where} ORDER BY {field} LIMIT ? OFFSET ?',
                                    params + (2 if n % 2 == 0 else 1, (n-1)//2)).fetchall()
                return sum(v[0] for v in values)/len(values)
            # Stream to a tiny SQL aggregate table rather than constructing all Property objects.
            amenities = []
            for feature in ('has_parking','has_elevator','has_balcony','has_warehouse'):
                present, known = db.execute(f"SELECT sum(json_extract(payload,'$.{feature}')), count(json_extract(payload,'$.{feature}')) FROM listings"+where,params).fetchone()
                present = present or 0
                amenities.append(dict(label=feature.removeprefix('has_'),present=present,known=known,percent=100*present/known if known else None))
            def histogram(field):
                expression = field if field in ('price_value','building_size') else f"json_extract(payload,'$.{field}')"
                lo, hi = db.execute(f'SELECT min({expression}),max({expression}) FROM listings'+where,params).fetchone()
                if lo is None:
                    return []
                if lo == hi:
                    count = db.execute(f'SELECT count({expression}) FROM listings'+where,params).fetchone()[0]
                    return [dict(label=f'{lo:g}',lower=lo,upper=hi,count=count)]
                width = (hi-lo)/6
                buckets = dict(db.execute(f'SELECT min(5,cast(({expression}-?)/? AS INTEGER)),count(*) FROM listings'+where+
                    (' AND ' if where else ' WHERE ')+f'{expression} IS NOT NULL GROUP BY 1', (lo,width)+params).fetchall())
                return [dict(label=f'{lo+i*width:.3g}–{lo+(i+1)*width:.3g}',lower=lo+i*width,upper=lo+(i+1)*width,count=buckets.get(i,0)) for i in range(6)]
            sample = [json.loads(r[0]) for r in db.execute('SELECT payload FROM listings'+where+' ORDER BY id LIMIT 20', params)]
            city_list = [r[0] for r in db.execute('SELECT DISTINCT city_slug FROM listings'+where+' ORDER BY city_slug',params)]
            neighborhoods = [r[0] for r in db.execute('SELECT DISTINCT neighborhood_slug FROM listings'+where+
                (' AND ' if where else ' WHERE ')+'neighborhood_slug IS NOT NULL ORDER BY neighborhood_slug', params)] if city else []
            types = [dict(label=k,count=db.execute('SELECT count(*) FROM listings'+where+(' AND ' if where else ' WHERE ')+'cat3_slug=?',params+(k,)).fetchone()[0]) for k in categories]
            return dict(count=n,average_price=avg,median_price=median('price_value'),median_price_per_sqm=median('price_per_sqm'),
                cities_count=len(city_list),available_cities=city_list,neighborhoods=neighborhoods,
                distributions=dict(price=histogram('price_value'),area=histogram('building_size'),year=histogram('construction_year'),
                    property_types=types,amenities=amenities,
                    missing_years=db.execute("SELECT count(*) FROM listings"+where+(' AND ' if where else ' WHERE ')+"json_extract(payload,'$.construction_year') IS NULL",params).fetchone()[0],
                    price_area=[dict(id=p['id'],city=p['city_slug'],area=p['building_size'],price=p['price_value']) for p in sample]))

        groups = {}
        for city in [None]+cities:
            for category in [None]+categories:
                groups[group_key(city,category)] = aggregate(city,category)
        progress(f'Built exact aggregate statistics for {len(cities)} represented cities')
        # Fixed schema permits an entirely missing amenity/year column in a chunk.
        from .schemas import Property
        schema = pa.schema([(name, pa.string() if name in ('id','city_slug','cat3_slug','neighborhood_slug','created_at_month','source_identity','source_revision')
            else pa.bool_() if name.startswith('has_') else pa.int64() if name=='source_row_index' else pa.float64()) for name in Property.model_fields])
        for city, category in db.execute('SELECT DISTINCT city_slug,cat3_slug FROM listings ORDER BY 1,2').fetchall():
            cursor = db.execute('SELECT payload FROM listings WHERE city_slug=? AND cat3_slug=? ORDER BY neighborhood_slug,id',(city,category))
            chunk = 0
            while rows := cursor.fetchmany(chunk_rows):
                stem = f'data/{city}/{category}/{chunk:05d}'
                records = save_chunk(rows, stem+'.json.gz','partition',city=city,category=category)
                partitions.append(stem+'.json.gz')
                target = output/(stem+'.parquet')
                pq.write_table(pa.Table.from_pylist(records,schema=schema),target,compression='zstd')
                files[stem+'.parquet'] = dict(sha256=file_hash(target),bytes=target.stat().st_size,kind='parquet',rows=len(records),city=city,category=category)
                files[stem+'.json.gz']['neighborhoods'] = sorted({p['neighborhood_slug'] for p in records if p.get('neighborhood_slug')})
                for p in records:
                    db.execute('INSERT INTO lookup VALUES (?,?)',(p['id'],stem+'.json.gz'))
                chunk += 1
        for prefix in (f'{i:02x}' for i in range(256)):
            mapping = dict(db.execute('SELECT id,path FROM lookup WHERE id>=? AND id<?',(prefix,prefix+'g')))
            if mapping:
                save('lookup/'+prefix+'.json.gz',gzip.compress(encode(mapping),mtime=0),'lookup')
        views, city_views = {}, {}
        for city in [None]+cities:
            current={}
            for sort in SORTS:
                paths = []
                where,params=clause(city,None)
                cursor = db.execute(f'SELECT payload FROM listings{where} ORDER BY {sort},id',params)
                chunk = 0
                while rows := cursor.fetchmany(chunk_rows):
                    path = f'views/{"city-"+city if city else "global"}/{sort}/{chunk:05d}.json.gz'
                    save_chunk(rows,path,'view',sort=sort,city=city)
                    paths.append(path)
                    chunk += 1
                current[sort]=paths
            if city:
                city_views[city]=current
            else:
                views=current
        periods = db.execute("SELECT min(json_extract(payload,'$.created_at_month')), max(json_extract(payload,'$.created_at_month')) FROM listings").fetchone()
        save('catalog.json',encode(dict(cities=cities,groups=groups,partitions=partitions,views=views,city_views=city_views,
                                       period_start=periods[0],period_end=periods[1])),'catalog')
        manifest = dict(schema_version=SCHEMA_VERSION,source_repo=SOURCE_REPO,source_revision=SOURCE_REVISION,license='odbl-1.0',
            created_at=datetime.now(timezone.utc).isoformat(),total_source_rows=counts['source_rows'],
            expected_source_rows=sum(p['expected_rows'] for p in source_parts),total_prepared_rows=total,total_cities=len(cities),
            full_source_verified=True,source_files=inventory,counts=dict(counts),files=files,
            duplicate_policy='Identical normalized safe fields, including city, neighborhood and advertisement month; may merge different homes.',
            source_scope='All CSV/Parquet data files in the pinned source repository inventory; not active listings or the entire housing market.')
        validate_manifest(manifest)
        (output/'manifest.json').write_bytes(encode(manifest))
        validate_output(output)
        progress(f'FINISHED: {counts["source_rows"]:,} source rows; {total:,} prepared sales; {len(cities)} cities')
        return manifest
    finally:
        db.close()  # Keep staging file for diagnostics/recovery; it is not uploaded.


def validate_output(output):
    """Re-read every output, checking file integrity, privacy, types and record counts."""
    import pyarrow.parquet as pq
    output = Path(output)
    if (output/'manifest.json').stat().st_size>8*1024*1024:
        raise ValueError('Manifest exceeds the 8 MiB serverless serving guard')
    manifest = validate_manifest(json.loads((output/'manifest.json').read_bytes()))
    rows = 0
    for path, info in manifest['files'].items():
        target = output/path
        if target.stat().st_size != info['bytes'] or file_hash(target) != info['sha256']:
            raise ValueError('Generated file failed integrity validation')
        if info['kind'] in ('partition','view'):
            records = json.loads(gzip.decompress(target.read_bytes()))
            if len(records) != info['rows']:
                raise ValueError('Prepared row count mismatch')
            for record in records:
                validate_record(record)
            if info['kind']=='partition':
                rows += len(records)
        elif info['kind']=='parquet':
            source=pq.ParquetFile(target)
            if source.metadata.num_rows != info['rows']:
                raise ValueError('Parquet count mismatch')
            for batch in source.iter_batches(batch_size=1024):
                for record in batch.to_pylist():
                    validate_record(record)
    if rows != manifest['total_prepared_rows']:
        raise ValueError('Prepared partition inventory is incomplete')
    return manifest
