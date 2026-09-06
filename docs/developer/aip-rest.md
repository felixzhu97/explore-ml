# AIP REST contract (Explore ML)

Breaking cutover under prefix `/api/v1` (no `api/v2`, no dual envelope).

## Normative AIPs

| Topic                    | AIP                                                                   | Shape                                              |
| ------------------------ | --------------------------------------------------------------------- | -------------------------------------------------- |
| Resource-oriented design | [121](https://google.aip.dev/121) / [122](https://google.aip.dev/122) | Noun collections; child resources under parents    |
| Standard methods         | [131](https://google.aip.dev/131)–[135](https://google.aip.dev/135)   | Get/List/Create/Update/Delete; Update prefers PATCH|
| Custom methods           | [136](https://google.aip.dev/136)                                     | `POST …/{resource}:verb`                           |
| Pagination               | [158](https://google.aip.dev/158)                                     | `page_size` + opaque `page_token` → `next_page_token` |
| Errors                   | [193](https://google.aip.dev/193)                                     | HTTP status + `{ code, message, details[] }`       |
| Versioning               | [180](https://google.aip.dev/180)                                     | Keep `api/v1` prefix; semantics redefined          |

## Success bodies

Return the resource or list object directly. Do **not** wrap in
`{ success, data, message }`.

## Errors

```json
{
  "code": "NOT_FOUND",
  "message": "Document not found",
  "details": []
}
```

## Python helpers under `python_ml/`

Same AIP rules apply to FastAPI helpers under
`python_ml/{recommendation,vision,rag,media-gen}`.
Sibling APIs call these over loopback with **snake_case** JSON.

| Service        | Legacy                          | AIP                                   |
| -------------- | ------------------------------- | ------------------------------------- |
| recommendation | `POST /v1/feed/rank`            | `POST /api/v1/feeds:rank`             |
| recommendation | `POST /v1/explore/rank`         | `POST /api/v1/explores:rank`          |
| recommendation | `POST /v1/reels/rank`           | `POST /api/v1/reels:rank`             |
| recommendation | `POST /v1/feed/recall`          | `POST /api/v1/feeds:recall`           |
| vision         | `POST /predict`                 | `POST /api/v1/images:predict`         |
| vision         | `POST /moderate`                | `POST /api/v1/images:moderate`        |
| vision         | `POST /moderate-video`          | `POST /api/v1/videos:moderate`        |
| media-gen      | `POST /image/generate`          | `POST /api/v1/images:generate`        |
| media-gen      | `GET /image/generate/{id}`      | `GET /api/v1/imageJobs/{image_job}`   |
| media-gen      | `POST /video/generate`          | `POST /api/v1/videos:generate`        |
| media-gen      | `GET /video/generate/{id}`      | `GET /api/v1/videoJobs/{video_job}`   |
| media-gen      | `POST /voice/synthesize`        | `POST /api/v1/voices:synthesize`      |
| rag            | `POST /api/v1/documents/upload` | `POST /api/v1/documents`              |
| rag            | list `skip`/`limit`             | `page_size` / `page_token`            |
| rag            | `POST /api/v1/query`            | `POST /api/v1/documents:query`        |
| rag            | `POST /api/v1/crawler/scrape`   | `POST /api/v1/webpages:scrape`        |
| rag            | `POST /api/v1/sync/posts`       | `POST /api/v1/posts:sync`             |

Each helper ships `aip/` (`rpc_status`, exception handlers, `page_token` for
RAG lists). `/health` and `/metrics` stay unversioned.

## Validation

```bash
bash scripts/check-aip-rest.sh
```

## References

- [AIP-121](https://google.aip.dev/121)
- [AIP-136](https://google.aip.dev/136)
- [AIP-193](https://google.aip.dev/193)
- [FastAPI](https://fastapi.tiangolo.com/)
