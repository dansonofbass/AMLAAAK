"""Strict local CSV loading and explicit, transactional SQLite ingestion."""
import argparse
import csv
from pathlib import Path
import sqlite3
import pandas as pd

REQUIRED = {'cat2_slug', 'cat3_slug', 'price_mode', 'price_value', 'building_size'}


def read_csv(path, chunksize=None):
    with open(path, encoding='utf-8-sig', newline='') as stream:
        rows = csv.reader(stream, strict=True)
        header = next(rows, [])
        if len(header) != len(set(header)) or not REQUIRED.issubset(header):
            raise ValueError('CSV needs unique Divar column names: ' + ', '.join(sorted(REQUIRED)))
        for line, row in enumerate(rows, 2):
            if len(row) != len(header):
                raise ValueError(f'CSV record {line}: expected {len(header)} fields, got {len(row)}')
    return pd.read_csv(path, encoding='utf-8-sig', dtype=str, chunksize=chunksize)


def load_data(path):
    path = Path(path)
    if not path.is_file():
        raise ValueError(f'Input does not exist: {path}')
    if path.suffix.lower() == '.csv':
        return read_csv(path)
    with sqlite3.connect(f'{path.resolve().as_uri()}?mode=ro', uri=True) as conn:
        return pd.read_sql_query('SELECT * FROM real_estate', conn)


def ingest(source, database):
    database = Path(database)
    if database.exists():
        raise ValueError('Output already exists; choose a new database path.')
    chunks = read_csv(source, chunksize=10000)
    database.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with sqlite3.connect(database) as conn:
        schema = Path(__file__).resolve().parents[1] / 'Schema.sql'
        conn.executescript(schema.read_text())
        allowed = {r[1] for r in conn.execute('PRAGMA table_info(real_estate)')}
        for chunk in chunks:
            if not set(chunk).issubset(allowed):
                raise ValueError('Unexpected CSV columns: ' + ', '.join(sorted(set(chunk) - allowed)))
            columns = ', '.join('"' + c + '"' for c in chunk.columns)
            placeholders = ', '.join('?' for _ in chunk.columns)
            values = chunk.astype(object).where(pd.notna(chunk), None)
            conn.executemany(f'INSERT INTO real_estate ({columns}) VALUES ({placeholders})',
                             values.itertuples(index=False, name=None))
            count += len(chunk)
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--csv', required=True)
    parser.add_argument('--database', required=True)
    args = parser.parse_args()
    print(f'Imported {ingest(args.csv, args.database)} records')


if __name__ == '__main__':
    main()
