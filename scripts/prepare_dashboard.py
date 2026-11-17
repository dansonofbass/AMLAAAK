"""Export a bounded, privacy-conscious serving snapshot; never downloads data."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pandas as pd
from amlaaak.data import load_data
from amlaaak.preprocessing import prepare, FEATURES, AMENITIES
from amlaaak.training import file_hash
from apps.api.service.schemas import Property, Snapshot, Provenance


def export(source, destination, kind, revision, model_source=None, model_destination=None):
    source, destination = Path(source), Path(destination)
    if destination.exists():
        raise ValueError('Snapshot destination already exists; choose a new path')
    digest = file_hash(source)
    fixture = Path(__file__).resolve().parents[1] / 'sample database.csv'
    if digest == file_hash(fixture) and kind != 'illustrative':
        raise ValueError('The repository fixture must be labeled illustrative')
    raw = load_data(source)
    normalized = prepare(raw, include_context=True)
    if kind != 'illustrative' and normalized[FEATURES + ['price_value']].equals(prepare(load_data(fixture))):
        raise ValueError('The repository fixture must be labeled illustrative, including SQLite copies')
    if len(normalized) > 50000:
        raise ValueError('Serving snapshot is limited to 50,000 records; prepare a documented subset or database adapter')
    properties = []
    for row in normalized.to_dict(orient='records'):
        cleaned = {k: None if pd.isna(v) else v for k, v in row.items()}
        if cleaned['city_slug'] is None:
            cleaned['city_slug'] = 'unknown'
        for col in AMENITIES:
            cleaned[col] = bool(cleaned[col]) if cleaned[col] is not None else None
        identifier = hashlib.sha256(json.dumps(cleaned, sort_keys=True).encode()).hexdigest()[:16]
        properties.append(Property(id=identifier, **cleaned, price_per_sqm=cleaned['price_value']/cleaned['building_size']))
    snapshot = Snapshot(provenance=Provenance(kind=kind, source_url='https://huggingface.co/datasets/divarofficial/real_estate_ads',
        source_sha256=digest, revision=revision, input_rows=len(raw), eligible_rows=len(properties),
        note='Illustrative repository fixture, not verified Divar observations.' if kind == 'illustrative'
        else 'Operator-prepared Divar subset. No listing text, advertiser data, or precise coordinates included.'), properties=properties)
    if model_source:
        if not model_destination:
            raise ValueError('--model-output is required with --model-source')
        src, dest = Path(model_source), Path(model_destination)
        if dest.exists():
            raise ValueError('Model output already exists; choose a new path')
        metadata = json.loads((src / 'metadata.json').read_text(encoding='utf-8'))
        if metadata['source_sha256'] != digest:
            raise ValueError('Model training source does not match the snapshot source')
        if metadata['features'] != FEATURES:
            raise ValueError('Model features differ from the current feature contract')
        if (src / 'model.joblib').stat().st_size > 100 * 1024 * 1024:
            raise ValueError('Model exceeds the 100 MB local export guard; use a dedicated inference host')
        dest.mkdir(parents=True)
        for name in ('model.joblib', 'metadata.json'):
            shutil.copyfile(src / name, dest / name)
        manifest = {'kind': kind, 'model_sha256': file_hash(dest / 'model.joblib'),
                    'metadata_sha256': file_hash(dest / 'metadata.json')}
        (dest / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(snapshot.model_dump_json(indent=2), encoding='utf-8')
    return len(properties)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', default='sample database.csv')
    parser.add_argument('--output', default='apps/api/assets/sample.json')
    parser.add_argument('--kind', required=True, choices=['illustrative', 'divar'])
    parser.add_argument('--revision', required=True, help='Source revision or fixture commit')
    parser.add_argument('--model-source')
    parser.add_argument('--model-output')
    args = parser.parse_args()
    print(f'Exported {export(args.source, args.output, args.kind, args.revision, args.model_source, args.model_output)} eligible records')
