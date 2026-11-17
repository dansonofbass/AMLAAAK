"""Chronological splitting and metadata verified without network dependencies."""
import json
import pytest
from amlaaak.real_training import train_real
from amlaaak.data import load_data


def test_temporal_workflow_and_grouping(tmp_path):
    base=load_data('sample database.csv').iloc[[0]].copy()
    frames=[]
    import pandas as pd
    for month in range(1,7):
        for n in range(8):
            row=base.copy()
            row['created_at_month']=f'2024-{month:02d}'
            row['building_size']=str(50+month*100+n*6)
            row['price_value']=str(1000000000+month*100000000+n*1000000)
            frames.append(row)
    source=tmp_path/'synthetic-test-only.csv'
    pd.concat(frames).to_csv(source,index=False)
    result=train_real(source,tmp_path/'model','test-revision')
    assert result['split_method'].startswith('chronological')
    assert result['periods']['train'][1]<result['periods']['validation'][0]
    assert result['periods']['validation'][1]<result['periods']['test'][0]
    assert result['validation_rows']>=2 and result['test_rows']>=2
    assert result['features'] and result['source_revision']=='test-revision'
    assert (tmp_path/'model'/'model.joblib').is_file()
    assert result['city_metrics']=={}  # Fewer than 30 test records per city.
    with pytest.raises(ValueError,match='new artifact'):
        train_real(source,tmp_path/'model','test-revision')
