"""Explicit bounded acquisition; no full download and no listing text retained."""
import argparse
import hashlib
import csv
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from apps.api.service.huggingface import HuggingFaceDataProvider
from apps.api.service.schemas import Filters


def acquire(destination, revision, max_records=2000):
    destination = Path(destination)
    sidecar = destination.with_suffix('.provenance.json')
    if destination.exists() or sidecar.exists():
        raise ValueError('Choose new acquisition output paths')
    provider = HuggingFaceDataProvider(max_records=max_records,use_remote_filter=False)
    population = provider.population(Filters())
    provenance = population.snapshot.provenance
    if provenance.revision != revision:
        raise ValueError(f'Expected revision {revision}, received {provenance.revision}; refusing revision drift')
    rows = []
    for p in population.rows:
        row = p.model_dump(exclude={'id','price_per_sqm','source_identity','source_row_index','source_revision'})
        row.update(cat2_slug='residential-sell', price_mode='مقطوع')
        rows.append(row)
    if not rows:
        raise ValueError('No eligible source rows retrieved')
    destination.parent.mkdir(parents=True, exist_ok=True)
    fields = sorted({key for row in rows for key in row})
    with destination.open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    provenance=provenance.model_copy(update={'source_sha256':hashlib.sha256(destination.read_bytes()).hexdigest()})
    sidecar.write_text(provenance.model_dump_json(indent=2), encoding='utf-8')
    return len(rows)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    parser.add_argument('--revision', required=True)
    parser.add_argument('--max-records', type=int, default=2000, choices=range(100,2001), metavar='100..2000')
    args = parser.parse_args()
    print(f'Acquired {acquire(args.output,args.revision,args.max_records)} genuine eligible records (bounded, not market-complete)')
