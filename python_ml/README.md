# Machine learning helpers

Optional Python FastAPI services used by sibling Explore APIs over loopback:

| Service | Port | Role |
| --- | --- | --- |
| `recommendation` | 8000 | Feed / Explore / Reels rank & recall |
| `vision` | 8001 | Image labels & moderation |
| `rag` | 8002 | Document / post RAG Q&A |
| `image-playground` | 8003 | Image generation (Image Playground) |
| `speech` | 8004 | ASR + TTS (Speech) |
| `video` | 8005 | Video generation |

Layout: [`docs/developer/python-services.md`](../../docs/developer/python-services.md).
