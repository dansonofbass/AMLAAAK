FROM python:3.14-slim
WORKDIR /app
ARG WITH_INFERENCE=false
COPY requirements.txt ./requirements.txt
COPY apps/api/requirements*.txt ./apps/api/
RUN if [ "$WITH_INFERENCE" = "true" ]; then \
      pip install --no-cache-dir -r apps/api/requirements-inference.txt; \
    else pip install --no-cache-dir -r apps/api/requirements.txt; fi
COPY apps/api ./apps/api
ENV PYTHONUNBUFFERED=1
CMD ["sh", "-c", "python -m uvicorn apps.api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
