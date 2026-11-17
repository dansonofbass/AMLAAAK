"""Canonical stateless Divar parsing shared by serving and offline training."""
import math
import re
from datetime import datetime

NUMERIC = ['building_size', 'rooms_count', 'total_floors_count', 'floor', 'construction_year']
AMENITIES = ['has_parking', 'has_elevator', 'has_balcony', 'has_warehouse']
CATEGORICAL = ['city_slug', 'cat3_slug']
FEATURES = NUMERIC + AMENITIES + CATEGORICAL
WORDS = dict(zip(['صفر','یک','دو','سه','چهار','پنج','شش','هفت','هشت','نه','ده','یازده','دوازده','سیزده','چهارده','پانزده','شانزده','هفده','هجده','نوزده','بیست'], range(21)))
WORDS.update({'بدون اتاق': 0, 'همکف': 0, 'زیرزمین': -1})
DIGITS = str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩يك', '01234567890123456789یک')
NAN = float('nan')


def text(value):
    if value is None or (isinstance(value, float) and not math.isfinite(value)):
        return ''
    result = str(value).translate(DIGITS).strip().lower()
    return '' if result in ('nan', 'null', 'none', '<na>', 'nat') else result


def number(value):
    if isinstance(value,(int,float)) and not isinstance(value,bool):
        result=float(value)
        return result if math.isfinite(result) else NAN
    value = text(value)
    if value in WORDS:
        return float(WORDS[value])
    value = value.replace('٬', ',').replace('٫', '.')
    if not re.fullmatch(r'[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?', value):
        return NAN
    result = float(value.replace(',', ''))
    return result if math.isfinite(result) else NAN


def boolean(value):
    return {'true': 1., 'false': 0., '1': 1., '0': 0., '1.0': 1., '0.0': 0.}.get(text(value), NAN)


def year(value):
    result = number(value)
    return result if 1200 <= result <= 1500 and result.is_integer() else NAN


def month(value):
    value = text(value)[:7]
    try:
        return datetime.strptime(value, '%Y-%m').strftime('%Y-%m')
    except ValueError:
        return None


def normalize_sale(row):
    """Return safe modeled/context fields or None. No personal text or coordinates."""
    if (text(row.get('cat2_slug')) != 'residential-sell'
            or text(row.get('cat3_slug')) not in ('apartment-sell', 'house-villa-sell')
            or text(row.get('price_mode')) != 'مقطوع'):
        return None
    price, size = number(row.get('price_value')), number(row.get('building_size'))
    if not (price > 0 and size > 0):
        return None
    result = {}
    for col in NUMERIC:
        value = year(row.get(col)) if col == 'construction_year' else number(row.get(col))
        if col != 'construction_year' and value < (-5 if col == 'floor' else 0):
            value = NAN
        result[col] = value if math.isfinite(value) else None
    for col in AMENITIES:
        value = boolean(row.get(col))
        result[col] = bool(value) if math.isfinite(value) else None
    for col in CATEGORICAL:
        result[col] = text(row.get(col)) or None
    result.update(price_value=price, neighborhood_slug=text(row.get('neighborhood_slug')) or None,
                  created_at_month=month(row.get('created_at_month')))
    return result
