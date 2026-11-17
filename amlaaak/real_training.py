"""Offline train/validation/test evaluation for acquired or manually prepared Divar data."""
import argparse
import json
from pathlib import Path
import platform
import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from .data import load_data
from .preprocessing import prepare, FEATURES
from .training import create_pipeline, file_hash


def scores(y, prediction):
    return {'mae':float(mean_absolute_error(y,prediction)),
            'rmse':float(np.sqrt(mean_squared_error(y,prediction))), 'r2':float(r2_score(y,prediction))}


def train_real(source, output, revision, seed=42):
    source, output = Path(source), Path(output)
    if output.exists():
        raise ValueError('Choose a new artifact directory')
    raw = load_data(source)
    data = prepare(raw, include_context=True)
    input_rows, eligible_rows = len(raw), len(data)
    # Conservatively group near-identical property specifications even if asking prices/months differ.
    # This is a heuristic, not verified property identity; it can merge different homes.
    data['_area_group'] = (data.building_size/5).round()
    signature = ['city_slug','cat3_slug','neighborhood_slug','_area_group','rooms_count','construction_year','floor']
    data = data.sort_values('created_at_month', na_position='first').drop_duplicates(subset=signature, keep='last').drop(columns='_area_group')
    if len(data) < 30:
        raise ValueError('Real-data evaluation requires at least 30 distinct eligible records')
    dates = sorted(data.created_at_month.dropna().unique())
    if len(dates) >= 3 and data.created_at_month.notna().all():
        # Whole-month boundaries prevent the same advertisement period crossing splits.
        first = max(1,min(len(dates)-2,int(len(dates)*.6)))
        second = max(first+1,min(len(dates)-1,int(len(dates)*.8)))
        training = data[data.created_at_month.isin(dates[:first])]
        validation = data[data.created_at_month.isin(dates[first:second])]
        test = data[data.created_at_month.isin(dates[second:])]
        method = 'chronological_whole_months_approx_60_20_20'
    else:
        training, remaining = train_test_split(data,test_size=.4,random_state=seed)
        validation, test = train_test_split(remaining,test_size=.5,random_state=seed)
        method = 'seeded_60_20_20_dates_insufficient'
    if min(map(len,[training,validation,test])) < 2:
        raise ValueError('Each temporal partition needs at least two records; provide more periods/data')
    trials = []
    for leaf in (1, 3):
        model = create_pipeline(RandomForestRegressor(n_estimators=100,min_samples_leaf=leaf,random_state=seed,n_jobs=1))
        model.fit(training[FEATURES],training.price_value)
        validation_scores = scores(validation.price_value,model.predict(validation[FEATURES]))
        trials.append((validation_scores['mae'],model,validation_scores,leaf))
    _, model, validation_scores, leaf = min(trials,key=lambda trial:trial[0])
    baseline = create_pipeline(DummyRegressor(strategy='median'))
    baseline.fit(training[FEATURES],training.price_value)
    metrics = {'random_forest':scores(test.price_value,model.predict(test[FEATURES])),
               'median_baseline':scores(test.price_value,baseline.predict(test[FEATURES]))}
    city_scores = {}
    for city, group in test.groupby('city_slug'):
        if len(group) >= 30:
            city_scores[city] = {'test_rows':len(group), **scores(group.price_value,model.predict(group[FEATURES]))}
    provenance_path = source.with_suffix('.provenance.json')
    source_provenance = json.loads(provenance_path.read_text(encoding='utf-8')) if provenance_path.exists() else None
    if source_provenance and source_provenance['revision'] != revision:
        raise ValueError('Acquisition provenance does not match requested revision')
    metadata = {'source':str(source), 'source_sha256':file_hash(source), 'source_revision':revision,
        'input_rows':input_rows,'valid_distinct_sale_rows':len(data),'train_rows':len(training),
        'validation_rows':len(validation),'test_rows':len(test),'seed':seed,'test_size':len(test)/len(data),
        'features':FEATURES,'transformed_features':model.named_steps['preprocessor'].get_feature_names_out().tolist(),
        'target':'price_value','price_unit':'Original source units; currency unverified',
        'metrics':metrics,'validation_metrics':validation_scores,'selected_min_samples_leaf':leaf,
        'split_method':method,'source_provenance':source_provenance,'city_metrics_min_test_rows':30,'city_metrics':city_scores,
        'periods':{name:[str(part.created_at_month.min()),str(part.created_at_month.max())]
                   for name,part in [('train',training),('validation',validation),('test',test)]},
        'near_duplicate_rows_removed':eligible_rows-len(data),
        'versions':{'python':platform.python_version(),'numpy':np.__version__,'pandas':pd.__version__,
                    'scikit-learn':sklearn.__version__,'joblib':joblib.__version__},
        'estimator_parameters':model.named_steps['regressor'].get_params(),
        'limitations':['Bounded historical source subset, not representative market validation.',
                       'Near-duplicate specification grouping can merge different homes.',
                       'Neighborhood is used for duplicate grouping/comparables, not a model feature; no ablation improvement claimed.',
                       'No confidence interval; asking prices are not completed-sale prices.']}
    output.mkdir(parents=True)
    joblib.dump(model,output/'model.joblib')
    joblib.dump(baseline,output/'baseline.joblib')
    (output/'metadata.json').write_text(json.dumps(metadata,indent=2,ensure_ascii=False,allow_nan=False),encoding='utf-8')
    return metadata


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data',required=True)
    parser.add_argument('--output-dir',required=True)
    parser.add_argument('--revision',required=True)
    parser.add_argument('--seed',type=int,default=42)
    args=parser.parse_args()
    print(json.dumps(train_real(args.data,args.output_dir,args.revision,args.seed),indent=2))
