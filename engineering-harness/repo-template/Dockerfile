# Pin the base image by digest once you have chosen it:
#   docker buildx imagetools inspect python:3.12-slim
FROM python:3.12-slim AS build
WORKDIR /src
COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir --prefix=/install .

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8080
RUN useradd --system --uid 10001 --no-create-home app
COPY --from=build /install /usr/local
USER 10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request,os;urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/healthz')"
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
