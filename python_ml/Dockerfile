FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /bin/uv

COPY requirements.txt overrides.txt ./
COPY recommendation/requirements.txt recommendation/
COPY vision/requirements.txt vision/
COPY rag/requirements.txt rag/
COPY image_playground/requirements.txt image_playground/
COPY speech/requirements.txt speech/
COPY video/requirements.txt video/
RUN uv pip install --system --no-cache -r requirements.txt --override overrides.txt

COPY . .

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
