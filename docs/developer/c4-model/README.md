# C4 model — Explore ML

PlantUML sources for system context, containers, components, and local
deployment. Render:

```bash
cd docs/developer/c4-model && docker run --rm -v "$PWD":/data plantuml/plantuml -tpng -o png '*.puml'
```

| Diagram | File |
| ------- | ---- |
| C1 Context | [C1-Context.puml](./C1-Context.puml) |
| C2 Container | [C2-Container.puml](./C2-Container.puml) |
| C3 Component | [C3-Component.puml](./C3-Component.puml) |
| Deployment | [C4-Deployment.puml](./C4-Deployment.puml) |

## Runtime defaults

| Surface | Port |
| ------- | ---- |
| recommendation | `:8000` |
| vision | `:8001` |
| rag | `:8002` |
| image-playground | `:8003` |
| speech | `:8004` |
| video | `:8005` |
| Model Test UI (`ng serve`) | `:4200` |

The UI reaches every helper through the dev-server proxy at `/svc/<id>`
(`image` for Image Playground). Override a target with `RECOMMENDATION_URL`,
`VISION_URL`, `RAG_URL`, `IMAGE_URL`, `SPEECH_URL` or `VIDEO_URL`.

Sibling product APIs keep their own loopback upstream URLs pointed at these
ports.

## What each diagram shows

- **C1** — the helpers and UI as one system, with the external systems they
  call: Qdrant, Ollama or OpenAI, the rerank sidecar, the content API,
  recommendation stores, local weights and the Hugging Face Hub.
- **C2** — one container per helper, the UI and its `/svc` proxy, and the
  external containers RAG and recommendation depend on.
- **C3** — the RAG helper's layers (routers, `XService` classes,
  `ChunkIndexer`, domain dataclasses, infra adapters, error handlers) and the
  UI's `shared/` plus per-module page and service.
- **Deployment** — local processes, embedded Qdrant, Ollama, and weights
  under `~/Codes/models` outside the repo.
