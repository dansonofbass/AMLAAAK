import numpy as np
import pandas as pd
import pytest
from amlaaak.preprocessing import number, year, boolean, prepare, FEATURES, AMENITIES
from amlaaak.data import load_data, ingest, read_csv
from amlaaak.training import train, create_pipeline
import joblib


@pytest.mark.parametrize('raw,expected', [('۱۲۳',123),('١٢٣',123),('۱٬۲۳۴٫۵',1234.5),('1,234.50',1234.5),('دو',2),('بدون اتاق',0),('همکف',0),('-1',-1),('3.0',3)])
def test_number(raw, expected):
    assert number(raw) == expected


@pytest.mark.parametrize('raw', [None, '', '12-14', '5+', 'nan', 'inf', '1,23', 'قبل از ۱۳۷۰'])
def test_ambiguous_number(raw):
    assert np.isnan(number(raw))


def test_year_and_boolean():
    assert year('۱۳۹۵') == 1395
    assert np.isnan(year('قبل از ۱۳۷۰'))
    assert np.isnan(year(2024))
    assert boolean(' TRUE ') == 1
    assert boolean(False) == 0
    assert np.isnan(boolean('ندارد'))
    assert np.isnan(boolean(None))


def test_sample_and_filter():
    raw = load_data('sample database.csv')
    assert raw.shape == (10, 60)
    prepared = prepare(raw)
    assert len(prepared) == 8
    assert set(FEATURES).issubset(prepared)
    raw.loc[0, 'price_value'] = '0'
    raw.loc[1, 'price_mode'] = 'توافقی'
    raw.loc[2, 'building_size'] = '-5'
    assert len(prepare(raw)) == 5
    rental = raw.iloc[[3]].copy()
    rental['price_value'] = '12345'
    assert prepare(rental).empty


def test_sqlite_equivalence_and_no_overwrite(tmp_path):
    db = tmp_path / 'sample.db'
    assert ingest('sample database.csv', db) == 10
    pd.testing.assert_frame_equal(prepare(load_data(db)), prepare(load_data('sample database.csv')))
    with pytest.raises(ValueError, match='already exists'):
        ingest('sample database.csv', db)
    with pytest.raises(ValueError, match='does not exist'):
        load_data(tmp_path / 'missing.db')


def test_bad_csv(tmp_path):
    path = tmp_path / 'bad.csv'
    path.write_text('cat2_slug,cat3_slug,price_mode,price_value,building_size\nsell,foo,bar,5\n')
    with pytest.raises(ValueError, match='expected 5'):
        read_csv(path)


def test_pipeline_imputation_and_unknowns():
    data = prepare(load_data('sample database.csv'))
    X = data[FEATURES].iloc[:5].copy()
    X.loc[:, 'has_balcony'] = np.nan
    X.loc[0, 'rooms_count'] = np.nan
    pipeline = create_pipeline()
    pipeline.fit(X, data.price_value.iloc[:5])
    numeric = pipeline.named_steps['preprocessor'].named_transformers_['numeric']
    assert numeric.statistics_[1] == X.rooms_count.median()
    test = X.iloc[[0]].copy()
    test['city_slug'] = 'never-seen-city'
    test['rooms_count'] = 1000
    assert np.isfinite(pipeline.predict(test)).all()
    names = pipeline.named_steps['preprocessor'].get_feature_names_out()
    assert all('numeric__' + feature in names for feature in AMENITIES)


def test_training_roundtrip_and_reproducibility(tmp_path):
    first = train('sample database.csv', tmp_path / 'first')
    second = train('sample database.csv', tmp_path / 'second')
    assert first['metrics'] == second['metrics']
    assert first['train_rows'] == 6 and first['test_rows'] == 2
    assert first['valid_distinct_sale_rows'] == 8
    model = joblib.load(tmp_path / 'first' / 'model.joblib')
    X = prepare(load_data('sample database.csv'))[FEATURES]
    assert np.isfinite(model.predict(X)).all()
    with pytest.raises(ValueError, match='empty'):
        train('sample database.csv', tmp_path / 'first')


def test_insufficient_data_and_duplicates(tmp_path):
    raw = load_data('sample database.csv')
    assert len(prepare(pd.concat([raw, raw]))) == 8
    path = tmp_path / 'tiny.csv'
    raw.iloc[:2].to_csv(path, index=False)
    with pytest.raises(ValueError, match='At least 8'):
        train(path, tmp_path / 'out')
