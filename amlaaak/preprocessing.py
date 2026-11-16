"""Stateless parsing only: no dataset-level statistics are computed here."""
import re
import numpy as np
import pandas as pd

NUMERIC = ['building_size', 'rooms_count', 'total_floors_count', 'floor', 'construction_year']
AMENITIES = ['has_parking', 'has_elevator', 'has_balcony', 'has_warehouse']
CATEGORICAL = ['city_slug', 'cat3_slug']
FEATURES = NUMERIC + AMENITIES + CATEGORICAL
WORDS = dict(zip(['صفر','یک','دو','سه','چهار','پنج','شش','هفت','هشت','نه','ده','یازده','دوازده','سیزده','چهارده','پانزده','شانزده','هفده','هجده','نوزده','بیست'], range(21)))
WORDS.update({'بدون اتاق': 0, 'همکف': 0, 'زیرزمین': -1})
DIGITS = str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩يك', '01234567890123456789یک')


def text(value):
    return '' if pd.isna(value) else str(value).translate(DIGITS).strip().lower()


def number(value):
    value = text(value)
    if value in WORDS:
        return float(WORDS[value])
    value = value.replace('٬', ',').replace('٫', '.')
    if not re.fullmatch(r'[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?', value):
        return np.nan
    result = float(value.replace(',', ''))
    return result if np.isfinite(result) else np.nan


def boolean(value):
    return {'true': 1., 'false': 0., '1': 1., '0': 0., '1.0': 1., '0.0': 0.}.get(text(value), np.nan)


def year(value):
    # Censored labels such as "before 1370" are unknown, not exact years.
    result = number(value)
    return result if 1200 <= result <= 1500 and result.is_integer() else np.nan


def prepare(frame):
    required = {'cat2_slug', 'cat3_slug', 'price_mode', 'price_value', 'building_size'}
    if not required.issubset(frame):
        raise ValueError('Missing required columns: ' + ', '.join(sorted(required - set(frame))))
    frame = frame.copy()
    target = frame['price_value'].map(number)
    size = frame['building_size'].map(number)
    valid = (frame.cat2_slug.map(text).eq('residential-sell')
             & frame.cat3_slug.map(text).isin(['apartment-sell', 'house-villa-sell'])
             & frame.price_mode.map(text).eq('مقطوع') & target.gt(0) & size.gt(0))
    frame = frame.loc[valid].copy()
    for col in FEATURES:
        if col not in frame:
            frame[col] = np.nan
    for col in NUMERIC:
        frame[col] = frame[col].map(year if col == 'construction_year' else number)
        if col != 'construction_year':
            low = -5 if col == 'floor' else 0
            frame.loc[frame[col] < low, col] = np.nan
    for col in AMENITIES:
        frame[col] = frame[col].map(boolean)
    for col in CATEGORICAL:
        frame[col] = frame[col].map(lambda v: text(v) or np.nan).astype(object)
    frame['price_value'] = target.loc[valid]
    # Remove identical modeling records before splitting to limit exact duplicate leakage.
    return frame[FEATURES + ['price_value']].drop_duplicates().reset_index(drop=True)
