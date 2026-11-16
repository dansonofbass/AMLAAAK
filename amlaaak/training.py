"""Reproducible holdout evaluation and persisted fitted pipelines."""
import argparse
import hashlib
import json
import platform
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from .data import load_data
from .preprocessing import NUMERIC, AMENITIES, CATEGORICAL, FEATURES, prepare


def create_pipeline(regressor=None):
    numeric = SimpleImputer(strategy='median', keep_empty_features=True, add_indicator=True)
    categorical = Pipeline([
        ('imputer', SimpleImputer(strategy='constant', fill_value='unknown', keep_empty_features=True)),
        ('onehot', OneHotEncoder(handle_unknown='ignore')),
    ])
    transform = ColumnTransformer([
        ('numeric', numeric, NUMERIC + AMENITIES),
        ('categorical', categorical, CATEGORICAL),
    ])
    return Pipeline([
        ('preprocessor', transform),
        ('regressor', regressor if regressor is not None else RandomForestRegressor(
            n_estimators=100, random_state=42, n_jobs=1)),
    ])


def train(source, output, test_size=0.25, seed=42):
    if not 0 < test_size < 1:
        raise ValueError('test_size must be between zero and one')
    output = Path(output)
    if output.exists() and any(output.iterdir()):
        raise ValueError('Output directory must be empty to preserve previous runs')
    raw = load_data(source)
    data = prepare(raw)
    if len(data) < 8:
        raise ValueError('At least 8 distinct valid sale records are required; sample metrics are smoke checks only')
    X_train, X_test, y_train, y_test = train_test_split(
        data[FEATURES], data.price_value, test_size=test_size, random_state=seed)
    if min(len(X_train), len(X_test)) < 2:
        raise ValueError('Split must contain at least 2 training and 2 test records')
    model = create_pipeline(RandomForestRegressor(n_estimators=100, random_state=seed, n_jobs=1))
    baseline = create_pipeline(DummyRegressor(strategy='median'))
    scores = {}
    for name, pipeline in [('random_forest', model), ('median_baseline', baseline)]:
        pipeline.fit(X_train, y_train)
        prediction = pipeline.predict(X_test)
        scores[name] = {'mae': float(mean_absolute_error(y_test, prediction)),
                        'rmse': float(np.sqrt(mean_squared_error(y_test, prediction))),
                        'r2': float(r2_score(y_test, prediction))}
    metadata = {
        'source': str(source), 'source_sha256': file_hash(source),
        'input_rows': len(raw), 'valid_distinct_sale_rows': len(data),
        'train_rows': len(X_train), 'test_rows': len(X_test),
        'seed': seed, 'test_size': test_size, 'features': FEATURES,
        'transformed_features': model.named_steps['preprocessor'].get_feature_names_out().tolist(),
        'target': 'price_value', 'price_unit': 'source units; not independently verified',
        'construction_year': 'Solar Hijri year; censored labels treated as missing',
        'versions': {'python': platform.python_version(), 'numpy': np.__version__,
                     'pandas': pd.__version__, 'scikit-learn': sklearn.__version__, 'joblib': joblib.__version__},
        'estimator_parameters': model.named_steps['regressor'].get_params(),
        'metrics': scores,
    }
    output.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, output / 'model.joblib')
    joblib.dump(baseline, output / 'baseline.joblib')
    (output / 'metadata.json').write_text(json.dumps(metadata, indent=2, ensure_ascii=False, allow_nan=False), encoding='utf-8')
    return metadata


def file_hash(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', default='sample database.csv')
    parser.add_argument('--output-dir', default='artifacts/sample')
    parser.add_argument('--test-size', type=float, default=0.25)
    parser.add_argument('--seed', type=int, default=42)
    args = parser.parse_args()
    result = train(args.data, args.output_dir, args.test_size, args.seed)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
