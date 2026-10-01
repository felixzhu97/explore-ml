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
| ML app (`python_ml/main.py`, all six modules) | `:8000` |
| Model Test UI (`ng serve`) | `:4200` |

The UI reaches the app through the dev-server proxy at `/ml` (prefix
stripped, WebSocket on). The target lives in `ui/proxy.conf.json`. Sibling
product APIs point their one loopback upstream at the same port.

## What each diagram shows

- **C1** — the ML app and UI as one system, with the external systems they
  call: Qdrant, Ollama or OpenAI, the rerank sidecar, the content API,
  recommendation stores, local weights and the Hugging Face Hub.
- **C2** — the single ML app container, the UI and its `/ml` proxy, and the
  external containers the RAG and recommendation modules depend on.
- **C3** — the app shell (`server.py`, module contract), the RAG
  module's layers (routers, `XService` classes, `ChunkIndexer`, domain
  dataclasses, infra adapters, error handlers) and the UI's `shared/`,
  D3 charts, and per-module page and service.
- **Deployment** — one uvicorn process, the UI dev server, embedded
  Qdrant, Ollama, and weights under `~/Codes/models` outside the repo.
