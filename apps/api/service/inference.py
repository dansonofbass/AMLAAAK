"""Optional, explicitly configured trusted joblib bundle. Never train on a request."""
import hashlib
import importlib.metadata
import json
import logging
import math
from pathlib import Path
from .schemas import ModelStatus, Metrics, Prediction

logger = logging.getLogger('amlaaak.api')


class Inference:
    def __init__(self, directory: str | None):
        self.model = None
        self.metadata = None
        self.manifest = None
        self.status = ModelStatus(available=False, mode='unavailable', message='No trusted model bundle configured. Analytics remain available.')
        if directory is None:
            try:
                from .artifacts import provision_model
                directory = provision_model()
            except Exception:
                logger.exception('remote_artifact_provisioning_failed')
                self.status.message = 'Remote model provisioning failed verification; see server logs.'
        if not directory:
            return
        try:
            root = Path(directory)
            manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
            metadata = json.loads((root / 'metadata.json').read_text(encoding='utf-8'))
            if manifest['kind'] not in ('illustrative', 'divar'):
                raise ValueError('Unknown bundle kind')
            if hashlib.sha256((root / 'model.joblib').read_bytes()).hexdigest() != manifest['model_sha256']:
                raise ValueError('Model checksum mismatch')
            if hashlib.sha256((root / 'metadata.json').read_bytes()).hexdigest() != manifest['metadata_sha256']:
                raise ValueError('Metadata checksum mismatch')
            for package in ('numpy', 'pandas', 'scikit-learn', 'joblib'):
                if importlib.metadata.version(package) != metadata['versions'][package]:
                    raise ValueError('Inference dependency versions must match training')
            import joblib
            model = joblib.load(root / 'model.joblib')  # Only operator-provided, trusted files.
            if list(model.feature_names_in_) != metadata['features']:
                raise ValueError('Model feature contract mismatch')
            self.model, self.metadata, self.manifest = model, metadata, manifest
            self.status = ModelStatus(available=True, mode='illustrative' if manifest['kind'] == 'illustrative' else 'trained',
                                      version=manifest['model_sha256'][:12],
                                      source_revision=metadata.get('source_revision'),
                                      message='Illustrative smoke-test model; not market accuracy.' if manifest['kind'] == 'illustrative'
                                      else 'Trained artifact loaded. Validate suitability before using estimates.')
        except Exception:
            logger.exception('model_bundle_load_failed')
            self.status.message = 'Configured model could not be verified or loaded. See server logs.'

    def metrics(self):
        if self.metadata is None:
            return Metrics(status=self.status)
        m = self.metadata
        return Metrics(status=self.status, scores=m['metrics'], train_rows=m['train_rows'], test_rows=m['test_rows'],
                       input_rows=m['input_rows'], eligible_rows=m['valid_distinct_sale_rows'], seed=m['seed'],
                       test_size=m['test_size'], features=m['features'], versions=m['versions'], source_sha256=m['source_sha256'],
                       validation_rows=m.get('validation_rows'),validation_metrics=m.get('validation_metrics'),
                       split_method=m.get('split_method'),source_revision=m.get('source_revision'),city_metrics=m.get('city_metrics',{}))

    def predict(self, request):
        import pandas as pd
        frame = pd.DataFrame([request.model_dump()])[self.metadata['features']]
        estimate = float(self.model.predict(frame)[0])
        if not math.isfinite(estimate) or estimate <= 0:
            raise ValueError('Model returned an invalid estimate')
        warnings = ['Asking price estimate, not a completed-sale valuation.',
                    'No calibrated confidence interval is available.', 'Currency units have not been independently verified.']
        if (self.metadata.get('source_provenance') or {}).get('coverage', {}).get('bounded'):
            warnings.append('Model trained on a bounded historical source prefix, not representative of the entire market.')
        try:
            categories=self.model.named_steps['preprocessor'].named_transformers_['categorical'].named_steps['onehot'].categories_[0]
            if request.city_slug not in categories:
                warnings.append('This city was absent from training; no learned city effect is available.')
        except (AttributeError,KeyError,IndexError):
            pass
        if self.status.mode == 'illustrative':
            warnings.insert(0, f'DEMO: fitted on {self.metadata["train_rows"]} illustrative training records; do not use for decisions.')
        return Prediction(predicted_price=estimate, price_per_sqm=estimate / request.building_size,
                          units='Original price_value units (currency unverified)', model=self.status, warnings=warnings)
