# Full-stack validation — 2026-11-17

## Implemented and exercised

- Five integrated Next.js pages: overview, market analytics, properties, prediction and model performance; contextual rule-based insights available across the workspace.
- Reference image inspected before implementation. Desktop floating widgets, map composition, cyan/violet chart styling and separate insights rail adapted to real-estate data. Mobile stacking and zero document overflow verified at 390 × 844.
- Read-only FastAPI snapshot serving, typed Pydantic responses, Zod frontend boundaries, Next.js server proxy, source provenance, safe optional bearer authentication, server pagination/search/sort and filters.
- Existing training/preprocessing code reused for snapshot export. Ten fixture records yield eight eligible distinct residential sales. No full Divar download, raw text publication or private coordinates.
- Real sklearn prediction executed through browser → Next proxy → FastAPI → trusted model. The model is fitted on six illustrative training records and is labeled demo, with source-unit caveats. Default unconfigured state returns no estimate and no fabricated metrics.
- Actual artifact metrics shown only when metadata is loaded. No residual visualization or LLM claims.

## Results

| Check | Verified result |
| --- | --- |
| Python `pytest -q` | 52 passed |
| `pip check` | No broken requirements |
| Frontend Vitest | 9 passed across two files |
| Playwright / headless Microsoft Edge | 8 passed against the optimized production server; actual backend success paths including prediction |
| TypeScript strict typecheck | Passed |
| ESLint | Passed, no lint errors or warnings |
| Next production build | Passed; five page routes and API proxy compiled |
| API OpenAPI generation | 9 application paths generated |
| Lean default process | Health/analytics work without importing sklearn |
| Runtime npm audit | 0 reported vulnerabilities (`--omit=dev`) |
| Source checks | Existing six-commit history preserved; generated data/models/environment ignored |

Environment: Windows, Python 3.14.7, Node 24.18.0, Next.js 16.4.6, React 19.3.1. `apps/web/package-lock.json` locks frontend dependencies. ML runtime pins and metadata remain intact. API direct runtime dependencies are pinned separately. Python tests produce one upstream Starlette warning about future `httpx2` migration; current `httpx` TestClient tests pass. This is a dependency deprecation, not a hidden application failure.

The first browser run found ambiguous alert selectors (Next's own route announcer also has role alert). Tests were scoped to application alerts, then all eight passed. Visual review caught chart animation timing and colliding nearby city labels; deterministic chart renders and collision-aware persistent labels repaired those issues. Final UI data is not hardcoded successful responses; tests inject only an explicit failed response to verify the error state.

## Remaining verification limits

The system browser bridge was unavailable, so visual verification used screenshots from the explicitly requested Playwright test workflow. Desktop, mobile and prediction screenshots were inspected. They remain ignored under `apps/web/test-results/` and can be regenerated.

Vercel configuration was checked against official documentation, not a live deployment. The backend is self-contained under `apps/api` with a native entrypoint and Python version declaration; the frontend is self-contained under `apps/web`. Vercel model dependency footprint/cold starts and cross-project deployment protection require validation in the operator's account. Docker CLI was present but its daemon was unavailable, so the Docker/Render fallback was implemented and documented but not run. No hosting resources were created, deployment settings changed, Git pushes attempted or historical commits rewritten.

This remains an illustrative research application. No real-data market performance, calibrated uncertainty, production scale, time-series forecast, private-data authorization layer or production-readiness certification is claimed.
