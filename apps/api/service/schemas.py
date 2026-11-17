from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Contract(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)


class Provenance(Contract):
    kind: Literal['illustrative', 'divar']
    source_url: str
    source_sha256: str | None
    revision: str
    input_rows: int
    eligible_rows: int
    units: str = 'Original price_value units (currency unverified)'
    note: str
    provider: str = 'snapshot'
    coverage: 'Coverage | None' = None
    fetched_at: str | None = None
    period_start: str | None = None
    period_end: str | None = None


class Coverage(Contract):
    records_examined: int
    normalized_records: int
    eligible_records: int
    upstream_matching_rows: int | None = None
    exhaustive: bool
    bounded: bool
    sampled: bool = False
    statistics_full_population: bool
    remote_filter_supported: bool
    remote_sort_supported: bool = False
    sorting_scope: str = 'retrieved_records'
    method: str
    limitations: list[str] = Field(default_factory=list)
    source_processing_complete: bool | None = None


class Property(Contract):
    id: str
    city_slug: str
    cat3_slug: Literal['apartment-sell', 'house-villa-sell']
    building_size: float = Field(gt=0)
    price_value: float = Field(gt=0)
    price_per_sqm: float = Field(gt=0)
    rooms_count: float | None
    floor: float | None
    total_floors_count: float | None
    construction_year: float | None
    has_parking: bool | None
    has_elevator: bool | None
    has_balcony: bool | None
    has_warehouse: bool | None
    neighborhood_slug: str | None = Field(default=None, exclude_if=lambda v: v is None)
    created_at_month: str | None = Field(default=None, exclude_if=lambda v: v is None)
    source_identity: str | None = Field(default=None, exclude_if=lambda v: v is None)
    source_row_index: int | None = Field(default=None, exclude_if=lambda v: v is None)
    source_revision: str | None = Field(default=None, exclude_if=lambda v: v is None)


class Snapshot(Contract):
    provenance: Provenance
    properties: list[Property]


class Filters(Contract):
    city: str | None = Field(default=None, max_length=80)
    neighborhood: str | None = Field(default=None, max_length=100)
    bedrooms_min: int | None = Field(default=None, ge=0, le=20)
    bedrooms_max: int | None = Field(default=None, ge=0, le=20)
    property_type: Literal['apartment-sell', 'house-villa-sell'] | None = None
    area_min: float | None = Field(default=None, ge=0)
    area_max: float | None = Field(default=None, ge=0)
    price_min: float | None = Field(default=None, ge=0)
    price_max: float | None = Field(default=None, ge=0)
    year_min: int | None = Field(default=None, ge=1200, le=1500)
    year_max: int | None = Field(default=None, ge=1200, le=1500)
    search: str = Field(default='', max_length=80)

    @model_validator(mode='after')
    def valid_ranges(self):
        for name in ('area', 'price', 'year', 'bedrooms'):
            low, high = getattr(self, name + '_min'), getattr(self, name + '_max')
            if low is not None and high is not None and low > high:
                raise ValueError(f'{name}_min must not exceed {name}_max')
        return self


class ModelStatus(Contract):
    available: bool
    mode: Literal['unavailable', 'illustrative', 'trained']
    name: str = 'Random Forest'
    version: str | None = None
    message: str
    source_revision: str | None = None


class PropertyFilters(Filters):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=10, ge=1, le=100)
    sort: Literal['price_value', 'building_size', 'city_slug', 'price_per_sqm'] = 'price_value'
    order: Literal['asc', 'desc'] = 'desc'


class Summary(Contract):
    count: int
    median_price: float | None
    average_price: float | None
    median_price_per_sqm: float | None
    cities_count: int
    available_cities: list[str]
    provenance: Provenance
    model: ModelStatus


class City(Contract):
    city: str
    count: int
    median_price: float
    median_price_per_sqm: float
    latitude: float | None
    longitude: float | None
    coverage: Coverage | None = None
    source_revision: str | None = None


class Bin(Contract):
    label: str
    lower: float
    upper: float
    count: int


class Count(Contract):
    label: str
    count: int


class Amenity(Contract):
    label: str
    present: int
    known: int
    percent: float | None


class Distributions(Contract):
    price: list[Bin]
    area: list[Bin]
    year: list[Bin]
    property_types: list[Count]
    amenities: list[Amenity]
    price_area: list[dict[str, float | str]]
    missing_years: int
    coverage: Coverage | None = None


class PropertyPage(Contract):
    items: list[Property]
    total: int
    page: int
    page_size: int
    coverage: Coverage | None = None
    provenance: Provenance | None = None


class Scores(Contract):
    mae: float
    rmse: float
    r2: float


class Metrics(Contract):
    status: ModelStatus
    scores: dict[str, Scores] | None = None
    train_rows: int | None = None
    test_rows: int | None = None
    input_rows: int | None = None
    eligible_rows: int | None = None
    seed: int | None = None
    test_size: float | None = None
    features: list[str] = Field(default_factory=list)
    source_sha256: str | None = None
    versions: dict[str, str] = Field(default_factory=dict)
    residuals_available: bool = False
    validation_rows: int | None = None
    validation_metrics: Scores | None = None
    split_method: str | None = None
    source_revision: str | None = None
    city_metrics: dict = Field(default_factory=dict)


class PredictionInput(Contract):
    city_slug: str = Field(min_length=1, max_length=80, pattern=r'^[a-z0-9-]+$')
    neighborhood_slug: str | None = Field(default=None, max_length=100)
    cat3_slug: Literal['apartment-sell', 'house-villa-sell']
    building_size: float = Field(gt=0, le=10000)
    rooms_count: int = Field(ge=0, le=20)
    floor: int = Field(ge=-5, le=100)
    total_floors_count: int = Field(ge=1, le=100)
    construction_year: int = Field(ge=1200, le=1500)
    has_parking: bool
    has_elevator: bool
    has_balcony: bool
    has_warehouse: bool

    @model_validator(mode='after')
    def floor_in_building(self):
        if self.floor > self.total_floors_count:
            raise ValueError('Floor cannot exceed total floors')
        return self


class Prediction(Contract):
    predicted_price: float
    price_per_sqm: float
    units: str
    model: ModelStatus
    warnings: list[str]


class Health(Contract):
    status: Literal['ok', 'degraded']
    dataset_ready: bool
    model_available: bool
    provider: str = 'snapshot'
    upstream_checked: bool = False


class Comparable(Contract):
    property: Property
    similarity_score: float = Field(ge=0, le=100)
    reasons: list[str]


class Valuation(Contract):
    model: ModelStatus
    prediction: Prediction | None
    provenance: Provenance
    coverage: Coverage
    comparables: list[Comparable]
    comparable_median_price: float | None
    comparable_median_price_per_sqm: float | None
    prediction_vs_comparable_percent: float | None
    limitations: list[str]
    label: str = 'Best matching properties among retrieved historical records.'


class Facets(Contract):
    cities: list[str]
    neighborhoods: list[str]
    provenance: Provenance
    coverage: Coverage


class ErrorDetail(Contract):
    code: str
    message: str


class ErrorResponse(Contract):
    error: ErrorDetail
