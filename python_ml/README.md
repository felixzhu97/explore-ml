# Machine learning helpers

Optional Python FastAPI services used by sibling Explore APIs over loopback:

| Service | Port | Role | Health check |
| --- | --- | --- | --- |
| `recommendation` | 8000 | Feed / Explore / Reels rank & recall | `GET /health` |
| `vision` | 8001 | Image labels & moderation | `GET /health` |
| `rag` | 8002 | Document / post RAG Q&A | `GET /health/ready` |
| `image-playground` | 8003 | Image generation (Image Playground) | `GET /openapi.json` |
| `speech` | 8004 | ASR + TTS (Speech) | `GET /openapi.json` |
| `video` | 8005 | Video generation | `GET /openapi.json` |

Layout: [`docs/developer/python-services.md`](../docs/developer/python-services.md).
