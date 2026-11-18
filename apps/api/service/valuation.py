"""Explainable comparisons. Model estimates and comparable medians stay separate."""
from statistics import median
from heapq import nsmallest
import logging
from .schemas import Comparable, Valuation, Filters, Provenance, Coverage
from .huggingface import UpstreamUnavailable, SOURCE


class UnavailableComparableSource:
    """Preserve valuation inference if dataset configuration could not initialize."""
    def __init__(self, provider_name, repo, revision):
        self.provider_name, self.repo, self.revision = provider_name, repo, revision

    def population(self, filters):
        raise UpstreamUnavailable('Comparable data is unavailable; verify backend provider settings and credentials')


def rank_comparables(subject, candidates, limit=8):
    dates=[p.created_at_month for p in candidates if p.created_at_month]
    reference=max(dates) if dates else None
    def scored():
        for row in candidates:
            if row.city_slug != subject.city_slug or row.cat3_slug != subject.cat3_slug:
                continue
            score, total = 0., 0.
            reasons = ['Same city', 'Same residential sale category']
            def add(weight, match):
                nonlocal score, total
                total += weight
                score += weight * match
            gap = abs(row.building_size - subject.building_size) / max(row.building_size, subject.building_size)
            add(30, max(0, 1-gap))
            reasons.append(f'Area differs by {abs(row.building_size-subject.building_size):g} m²')
            add(15, 1/(1+abs(row.rooms_count-subject.rooms_count)) if row.rooms_count is not None else 0)
            reasons.append(f'{row.rooms_count:g} bedrooms' if row.rooms_count is not None else 'Bedrooms unknown')
            if subject.construction_year is not None:
                add(10, max(0, 1-abs(row.construction_year-subject.construction_year)/40) if row.construction_year else 0)
            if row.construction_year and subject.construction_year is not None:
                reasons.append(f'Construction year differs by {abs(row.construction_year-subject.construction_year):g}')
            if subject.floor is not None:
                add(5, max(0, 1-abs(row.floor-subject.floor)/10) if row.floor is not None else 0)
            if subject.neighborhood_slug:
                match = row.neighborhood_slug == subject.neighborhood_slug
                add(20, float(match))
                reasons.append('Same neighborhood' if match else 'Different or unknown neighborhood')
            for feature in ('has_parking','has_elevator','has_balcony','has_warehouse'):
                if getattr(subject,feature) is None:
                    continue
                value = getattr(row, feature)
                matches = value is not None and value == getattr(subject, feature)
                add(5, float(matches))
                if matches:
                    reasons.append(feature.removeprefix('has_').capitalize() + ' matches')
            if reference:
                if row.created_at_month:
                    y,m=map(int,row.created_at_month.split('-'))
                    ry,rm=map(int,reference.split('-'))
                    gap=abs((ry-y)*12+rm-m)
                    add(5,max(0,1-gap/12))
                    reasons.append(f'Advertisement {gap} month(s) from latest retrieved candidate period ({reference})')
                else:
                    add(5,0)
                    reasons.append('Advertisement period unknown')
            yield Comparable(property=row, similarity_score=round(100*score/total, 2), reasons=reasons)
    # Preserve exact score/ID ordering while retaining only the requested top matches.
    return nsmallest(limit, scored(), key=lambda c:(-c.similarity_score,c.property.id))


def valuate(subject, store, inference):
    filters = Filters(city=subject.city_slug, property_type=subject.cat3_slug)
    status=inference.status.model_copy()
    prediction=None
    if status.available:
        try:
            prediction=inference.predict(subject)
        except Exception:
            logging.getLogger('amlaaak.api').exception('valuation_inference_failed')
            status=status.model_copy(update={'available':False,'mode':'unavailable','message':'Model inference failed; comparable search remains available.'})
    try:
        population = store.population(filters)
        candidates = population.select(filters)
        provenance = population.provenance_for(candidates)
    except UpstreamUnavailable as exc:
        candidates=[]
        provider_name=getattr(store,'provider_name','huggingface')
        source_url=f'https://huggingface.co/datasets/{store.repo}' if provider_name=='prepared' else SOURCE
        provenance=Provenance(kind='divar',provider=provider_name,source_url=source_url,source_sha256=None,
            revision=getattr(store,'revision',None) or 'unavailable',input_rows=0,eligible_rows=0,
            note='Comparable data is unavailable. No substitute observations were generated.',
            coverage=Coverage(records_examined=0,normalized_records=0,eligible_records=0,
                exhaustive=False,bounded=True,statistics_full_population=False,remote_filter_supported=False,
                method='upstream_unavailable',limitations=[str(exc)]))
    comparables = rank_comparables(subject, candidates)
    midpoint = median(c.property.price_value for c in comparables) if comparables else None
    psm = median(c.property.price_per_sqm for c in comparables) if comparables else None
    limitations = list(provenance.coverage.limitations)
    limitations += ['Similarity is a transparent heuristic, not a calibrated probability.',
                    'Comparable median is descriptive and is not the ML prediction.',
                    'No verified listing URL, photograph or current availability is provided.',
                    'Advertisement month is displayed; no current-market recency is implied.']
    if not status.available:
        limitations.append(status.message)
    return Valuation(model=status, prediction=prediction, provenance=provenance, coverage=provenance.coverage,
        comparables=comparables, comparable_median_price=midpoint, comparable_median_price_per_sqm=psm,
        prediction_vs_comparable_percent=100*(prediction.predicted_price/midpoint-1) if prediction and midpoint else None,
        limitations=limitations)
