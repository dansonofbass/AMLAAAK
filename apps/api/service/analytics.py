"""Bounded, read-only prepared snapshots; no raw listing text or coordinates."""
import hashlib
import json
from pathlib import Path
from statistics import mean, median
from .schemas import Snapshot, Filters, Property, City, Bin, Count, Amenity, Distributions, Coverage

# Approximate public city centers, NOT listing coordinates. Unmapped cities remain in tables.
CITY_CENTERS = {'tehran': (35.69, 51.39), 'karaj': (35.83, 50.99),
                'esfahan': (32.65, 51.67), 'shiraz': (29.61, 52.53),
                'mashhad': (36.30, 59.60), 'tabriz': (38.08, 46.29),
                'ahvaz': (31.32, 48.67), 'rasht': (37.28, 49.58),
                'qom': (34.64, 50.88), 'kermanshah': (34.31, 47.07),
                'yazd': (31.90, 54.37), 'bandar-abbas': (27.18, 56.27)}
CITY_CENTERS['isfahan'] = CITY_CENTERS['esfahan']  # Observed official slug; preserve legacy fixture slug too.


class Repository:
    def __init__(self, path: Path):
        if path.stat().st_size > 50 * 1024 * 1024:
            raise ValueError('Snapshot exceeds 50 MB. Use a database-backed adapter for larger datasets.')
        self.snapshot = Snapshot.model_validate_json(path.read_text(encoding='utf-8'))
        if self.snapshot.provenance.eligible_rows != len(self.snapshot.properties):
            raise ValueError('Snapshot row count does not match provenance')
        ids = [p.id for p in self.snapshot.properties]
        if len(ids) != len(set(ids)):
            raise ValueError('Duplicate property IDs')

    @property
    def rows(self):
        return self.snapshot.properties

    def select(self, f: Filters) -> list[Property]:
        result = []
        for row in self.rows:
            if f.city and row.city_slug != f.city:
                continue
            if f.property_type and row.cat3_slug != f.property_type:
                continue
            if f.neighborhood and row.neighborhood_slug != f.neighborhood:
                continue
            if f.search.lower() not in f'{row.city_slug} {row.cat3_slug} {row.id}'.lower():
                continue
            rejected = False
            for name, value in [('area', row.building_size), ('price', row.price_value), ('year', row.construction_year), ('bedrooms', row.rooms_count)]:
                low, high = getattr(f, name + '_min'), getattr(f, name + '_max')
                if (low is not None or high is not None) and value is None:
                    rejected = True
                elif value is not None and ((low is not None and value < low) or (high is not None and value > high)):
                    rejected = True
            if not rejected:
                result.append(row)
        return result

    def population(self, filters):
        return self

    def provenance_for(self, rows):
        source = self.snapshot.provenance
        coverage = source.coverage.model_copy(deep=True) if source.coverage else Coverage(
            records_examined=source.input_rows, normalized_records=len(self.rows), eligible_records=len(rows),
            upstream_matching_rows=source.input_rows, exhaustive=True, bounded=False,
            statistics_full_population=True, remote_filter_supported=False, method='complete_local_snapshot',
            limitations=['Exhaustive only for the configured local snapshot, not the Divar market.'])
        coverage.eligible_records = len(rows)
        return source.model_copy(update={'coverage': coverage})


def city_aggregates(rows):
    groups = {}
    for row in rows:
        groups.setdefault(row.city_slug, []).append(row)
    return [City(city=city, count=len(group), median_price=median(p.price_value for p in group),
                 median_price_per_sqm=median(p.price_per_sqm for p in group),
                 latitude=CITY_CENTERS.get(city, (None, None))[0],
                 longitude=CITY_CENTERS.get(city, (None, None))[1])
            for city, group in sorted(groups.items(), key=lambda item: (-len(item[1]), item[0]))]


def histogram(values, bins=6):
    values = [v for v in values if v is not None]
    if not values:
        return []
    low, high = min(values), max(values)
    if low == high:
        return [Bin(label=f'{low:g}', lower=low, upper=high, count=len(values))]
    width = (high - low) / bins
    counts = [0] * bins
    for value in values:
        counts[min(int((value - low) / width), bins - 1)] += 1
    return [Bin(label=f'{low + i * width:.3g}–{low + (i+1)*width:.3g}',
                lower=low + i * width, upper=low + (i + 1) * width, count=n)
            for i, n in enumerate(counts)]


def distributions(rows):
    amenities = []
    for feature in ('has_parking', 'has_elevator', 'has_balcony', 'has_warehouse'):
        known = [getattr(p, feature) for p in rows if getattr(p, feature) is not None]
        present = sum(known)
        amenities.append(Amenity(label=feature.removeprefix('has_'), present=present, known=len(known),
                                percent=100 * present / len(known) if known else None))
    return Distributions(
        price=histogram([p.price_value for p in rows]), area=histogram([p.building_size for p in rows]),
        year=histogram([p.construction_year for p in rows]),
        property_types=[Count(label=kind, count=sum(p.cat3_slug == kind for p in rows))
                        for kind in ('apartment-sell', 'house-villa-sell')],
        amenities=amenities, missing_years=sum(p.construction_year is None for p in rows),
        # Bounded scatter points. Table pagination is the interface for individual records.
        price_area=[{'id': p.id, 'city': p.city_slug, 'area': p.building_size, 'price': p.price_value}
                    for p in rows[:200]])
