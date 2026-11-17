"""DataFrame adapter for canonical stateless parsing. No fitted statistics."""
import numpy as np
import pandas as pd
from apps.api.service.normalization import (
    NUMERIC, AMENITIES, CATEGORICAL, FEATURES, WORDS, DIGITS,
    text, number, boolean, year, normalize_sale,
)


def prepare(frame, include_context=False):
    required = {'cat2_slug', 'cat3_slug', 'price_mode', 'price_value', 'building_size'}
    if not required.issubset(frame):
        raise ValueError('Missing required columns: ' + ', '.join(sorted(required - set(frame))))
    cols = FEATURES + ['price_value']
    if include_context:
        cols += ['neighborhood_slug', 'created_at_month']
    records = [normalized for row in frame.to_dict(orient='records')
               if (normalized := normalize_sale(row)) is not None]
    result = pd.DataFrame(records, columns=cols)
    for col in NUMERIC + AMENITIES + ['price_value']:
        result[col] = pd.to_numeric(result[col], errors='coerce').astype(float)
    for col in CATEGORICAL:
        result[col] = result[col].map(lambda v: v if v is not None else np.nan).astype(object)
    return result.drop_duplicates(subset=FEATURES + ['price_value']).reset_index(drop=True)
