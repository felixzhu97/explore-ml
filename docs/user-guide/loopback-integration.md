# Loopback integration

← [User guide home](README.md)

Connect your product API to Explore ML the easy way: one base URL per helper,
timeouts on the server, contracts from OpenAPI. Call helpers only from the
back channel. Never expose helper ports to browsers or mobile clients.

This page is a **target integration guide**. Field names and folder layouts may
change; keep the wiring shape and align code over time.

## Before you start

1. At least one helper is up ([Operator setup](operator-setup.md)).
2. The helper answers:

```bash
curl -s "$HELPER/health"         # recommendation, vision, RAG
curl -s "$HELPER/openapi.json"   # image playground, speech, video
```

3. You opened `$HELPER/docs` and know which `/api/v1` method you need.

## Wire base URLs

Set one upstream string per helper you use. These are the names the
`ui/` proxy reads; reuse them in your product API. Local defaults for a full
stack:

```bash
export RECOMMENDATION_URL=http://localhost:8000
export VISION_URL=http://localhost:8001
export RAG_URL=http://localhost:8002
export IMAGE_URL=http://localhost:8003
export SPEECH_URL=http://localhost:8004
export VIDEO_URL=http://localhost:8005
```

For a single feature, set **only** that helper’s URL. Keep model roots and
secrets on the helper side—never in the client bundle.

```mermaid
flowchart TB
  subgraph product [Product API config]
    Env[One_env_per_helper]
    Timeout[Connect_and_read_timeouts]
    Fallback[Degrade_when_down]
  end
  subgraph ml [Helpers]
    HTTP["/health and /api/v1"]
  end
  Env --> HTTP
  Timeout --> HTTP
  Fallback -.-> HTTP
```

```mermaid
sequenceDiagram
  participant Client
  participant API as Product_API
  participant ML as Helper
  Client->>API: product request
  API->>ML: HTTP loopback
  ML->>API: JSON, URL, or job id
  API->>Client: product response
```

## Prove one route (easiest path)

Copy a request from `$HELPER/docs`. Smoke it with curl against the helper,
then call the same path from your API client.

### Recommendation — rank a short list

```bash
curl -s -X POST "$RECOMMENDATION_URL/api/v1/feeds:rank" \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"demo","candidate_ids":["1","2","3"]}'
# {"items":[{"id":"2","score":0.91}, ...]}
```

`limit` defaults to 50. `feeds:recall` takes `{user_id, limit}` (default 100)
and returns the same `items` shape.

Prefer separate recall and rank when you own candidate generation (see
[Guideline](../Guideline.md) two-stage ranking).

### Vision — moderate a file

```bash
curl -s -X POST "$VISION_URL/api/v1/images:moderate" \
  -F "file=@sample.jpg"
```

Keep `images:predict` for labels and `images:moderate` for policy decisions.

### RAG — ingest then ask

```bash
curl -s -X POST "$RAG_URL/api/v1/documents" \
  -F "file=@./notes.md"

curl -s -X POST "$RAG_URL/api/v1/documents:query" \
  -H 'Content-Type: application/json' \
  -d '{"query":"What should I do first?","top_k":5}'
```

Stream long answers with `documents:streamQuery` when the UI needs tokens.
It sends Server-Sent Events (`data: ...` frames) and ends with
`data: [DONE]`.

```mermaid
flowchart LR
  Ingest[Ingest]
  Ask[Query]
  Answer[Grounded_answer]
  Ingest --> Ask --> Answer
```

### Speech — results come back directly

Speech does not use jobs. Synthesis returns the audio URL and transcription
returns the text in the same response.

```bash
curl -s -X POST "$SPEECH_URL/api/v1/voices:synthesize" \
  -H 'Content-Type: application/json' \
  -d '{"text":"Hello from Explore ML"}'
# {"audio_url":"http://localhost:8004/output/voice/<id>.wav"}
# (.mp3 when VOICE_BACKEND=edge)

curl -s -X POST "$SPEECH_URL/api/v1/audios:transcribe" \
  -F "file=@sample.wav"
# {"text":"...","language":"en"}
```

For live captions, open the WebSocket `/ws/v1/audios:transcribe` and stream
PCM audio; it sends `partial` and `final` events.

### Image Playground / Video — generate then poll

```bash
curl -s -X POST "$IMAGE_URL/api/v1/images:generate" \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"a quiet desk lamp"}'
# {"job_id":"<id>"}

curl -s "$IMAGE_URL/api/v1/imageJobs/<id>"
# {"name":"imageJobs/<id>","status":"succeeded",
#  "image_url":"http://localhost:8003/output/image/<id>.png"}

curl -s -X POST "$VIDEO_URL/api/v1/videos:generate" \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"a calm pan across a desk"}'

curl -s "$VIDEO_URL/api/v1/videoJobs/<id>"
```

Treat heavy work as a job: store the `job_id`, poll
`GET /api/v1/{imageJobs,videoJobs}/{id}` until `status` is `succeeded`, then
return `image_url` or `video_url` to the client. `status` is `pending`,
`succeeded` or `failed`; a failed job carries `error`. Unknown ids return 404.

Swap backends with env (`IMAGE_BACKEND`, `VOICE_BACKEND`, model ids)—keep the
same routes.

```mermaid
sequenceDiagram
  participant API as Product_API
  participant IP as Image_Playground
  API->>IP: images:generate
  IP-->>API: job_id
  loop until succeeded or failed
    API->>IP: GET imageJobs/{id}
    IP-->>API: status
  end
  IP-->>API: image_url
```

## Integration rules

1. Call helpers only from the product API (or another trusted server).
2. Own timeouts and fallbacks in the API. Degrade the feature when a helper is
   down.
3. Treat `/docs` + `/api/v1/...` as the contract.
4. Change a port only when you update both the helper and every upstream.
5. Prefer loopback or private network URLs—not public ingress.

## Checklist

1. Set one base URL per helper you use.
2. Confirm `GET /health` (or `GET /openapi.json` for image, speech, video).
3. Smoke one `/api/v1` route with curl.
4. Call the same route from the product API.
5. Stop the helper and confirm the product fails gracefully.

## Smoke test

1. Start one helper ([Operator setup](operator-setup.md)).
2. `curl "$HELPER/health"` (or `/openapi.json`).
3. Run one curl example above.
4. Point the product env at `$HELPER`.
5. Repeat the action once through the product.

## Related

[Operator setup](operator-setup.md)

[Model download](model-download.md)

[User guide home](README.md)

[Guideline](../Guideline.md)
