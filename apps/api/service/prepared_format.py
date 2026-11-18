"""Versioned safe interchange contract shared by Colab and the serving adapter."""
import hashlib
import json
import re

SOURCE_REPO = 'divarofficial/real_estate_ads'
SOURCE_REVISION = 'e9446ee97b8e6eb9bd62bdfd7548f1bc8973be85'
TARGET_REPO = 'thevel0per/AMLAAAK-Real-Estate-Data'
SCHEMA_VERSION = 1
SORTS = ('price_value', 'building_size', 'city_slug', 'price_per_sqm')
SAFE_FIELDS = {
    'id', 'city_slug', 'cat3_slug', 'neighborhood_slug', 'building_size', 'price_value',
    'price_per_sqm', 'rooms_count', 'floor', 'total_floors_count', 'construction_year',
    'has_parking', 'has_elevator', 'has_balcony', 'has_warehouse', 'created_at_month',
    'source_identity', 'source_row_index', 'source_revision',
}


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def file_hash(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def group_key(city=None, category=None):
    return (city or '*') + '|' + (category or '*')


def valid_slug(value, maximum=100):
    return isinstance(value, str) and len(value) <= maximum and bool(re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', value))


def validate_record(row):
    from .schemas import Property
    if set(row) - SAFE_FIELDS or not valid_slug(row.get('city_slug'), 80):
        raise ValueError('Unexpected/private field or invalid city slug')
    if row.get('neighborhood_slug') is not None and not valid_slug(row['neighborhood_slug']):
        raise ValueError('Invalid neighborhood slug')
    if not re.fullmatch(r'[a-f0-9]{16}', row.get('id', '')):
        raise ValueError('Invalid record identity')
    return Property.model_validate(row)


def validate_manifest(manifest):
    if (manifest.get('schema_version') != SCHEMA_VERSION or manifest.get('source_repo') != SOURCE_REPO
            or manifest.get('source_revision') != SOURCE_REVISION or manifest.get('license') != 'odbl-1.0'):
        raise ValueError('Unsupported prepared dataset source, schema, or license')
    files = manifest.get('files', {})
    if not files or len(files) > 30000:
        raise ValueError('Invalid manifest file inventory')
    for path, info in files.items():
        if not re.fullmatch(r'[a-zA-Z0-9_./-]+', path) or '..' in path.split('/') or path.startswith('/'):
            raise ValueError('Unsafe manifest path')
        if not re.fullmatch(r'[a-f0-9]{64}', info.get('sha256', '')) or not 0 < info.get('bytes', 0) <= 32 * 1024 * 1024:
            raise ValueError('Invalid file checksum or size')
    if 'catalog.json' not in files:
        raise ValueError('Catalog missing')
    sources=manifest.get('source_files',[])
    if (not sources or len({p['source_path'] for p in sources})!=len(sources)
            or sum(p['processed_rows'] for p in sources)!=manifest['total_source_rows']
            or sum(p['expected_rows'] for p in sources)!=manifest['expected_source_rows']
            or not 0<manifest['total_prepared_rows']<=manifest['total_source_rows']):
        raise ValueError('Source inventory totals are inconsistent')
    if manifest.get('full_source_verified') and (
        manifest['total_source_rows'] != manifest['expected_source_rows']
        or not manifest['source_files']
        or any(p['processed_rows'] != p['expected_rows'] for p in manifest['source_files'])
    ):
        raise ValueError('Unverified source completeness claim')
    return manifest


def validate_catalog(manifest, catalog):
    """Reject missing indexes and contradictory totals instead of returning empty pages."""
    files=manifest['files']
    cities=catalog['cities']
    groups=catalog['groups']
    categories=('apartment-sell','house-villa-sell')
    if (len(cities)!=manifest['total_cities'] or len(cities)!=len(set(cities))
            or any(not valid_slug(city,80) for city in cities)
            or groups['*|*']['count']!=manifest['total_prepared_rows']
            or sum(groups[group_key(city)]['count'] for city in cities)!=manifest['total_prepared_rows']):
        raise ValueError('Prepared catalog geographic totals mismatch')
    expected={p for p,info in files.items() if info['kind']=='partition'}
    if len(catalog['partitions'])!=len(set(catalog['partitions'])) or set(catalog['partitions'])!=expected:
        raise ValueError('Prepared partition index is incomplete')
    counts={}
    for path in expected:
        info=files[path]
        key=group_key(info['city'],info['category'])
        counts[key]=counts.get(key,0)+info['rows']
    if sum(counts.values())!=manifest['total_prepared_rows']:
        raise ValueError('Prepared partition count mismatch')
    for city in [None]+cities:
        total=groups[group_key(city)]['count']
        if sum(groups[group_key(city,category)]['count'] for category in categories)!=total:
            raise ValueError('Prepared category statistics mismatch')
        if city and any(counts.get(group_key(city,category),0)!=groups[group_key(city,category)]['count'] for category in categories):
            raise ValueError('Prepared city/category partition totals mismatch')
        views=catalog['city_views'][city] if city else catalog['views']
        for sort in SORTS:
            paths=views[sort]
            if len(paths)!=len(set(paths)) or sum(files[p]['rows'] for p in paths)!=total:
                raise ValueError('Prepared sorted index is incomplete')
            for path in paths:
                info=files[path]
                if (info['kind']!='view' or info['sort']!=sort or info.get('city')!=city
                        or sum(info['category_counts'].values())!=info['rows']):
                    raise ValueError('Prepared sorted index schema mismatch')
            for category in categories:
                if sum(files[p]['category_counts'].get(category,0) for p in paths)!=groups[group_key(city,category)]['count']:
                    raise ValueError('Prepared sorted category index mismatch')
    return catalog
