---
title: Explore ML - User Story Map
---

# User Story Map

> Jeff Patton story map + Mermaid journey + GWT epics in files.  
> Index only; details in [user-stories/](./user-stories/).

## Personas

| Role | Description |
| ---- | ----------- |
| Platform engineer | Starts the loopback ML app locally and mounts fixture data |
| Sibling API developer | Calls recommendation / vision / rag / image_playground / speech / video routes on one base URL |
| Model-test engineer | Exercises each module from the `ui/` operator console on :4200 |

## Journey overview

### Local loopback

```mermaid
journey
    title Local loopback
    section Boot
        Install dependencies and start the app: 5: Platform engineer
        Aggregated health passes: 5: Platform engineer
    section Try
        Exercise modules from the ui console: 4: Model-test engineer
        Read results as D3 charts: 4: Model-test engineer
    section Integrate
        Sibling API calls loopback: 5: Sibling API developer
```

Health means `GET /health` on port 8000: one entry per loaded module with
`status` (`ok`, `degraded` or `error`) and `latency_ms`.

## Backbone story map

| Modular services | Unified app | Operator console |
| ---------------- | ----------- | ---------------- |
| [US-01](./user-stories/E1-modular-services.md#us-01-flat-per-module-layout) Flat layout | [US-05](./user-stories/E2-unified-app.md#us-05-single-app-and-aggregated-health) Single app + health | [US-09](./user-stories/E3-operator-console.md#us-09-module-pages) Module pages |
| [US-02](./user-stories/E1-modular-services.md#us-02-rag-export-vectors) RAG export vectors | [US-06](./user-stories/E2-unified-app.md#us-06-secrets-only-in-env) Secrets in `.env` | [US-10](./user-stories/E3-operator-console.md#us-10-d3-charts-on-every-module-page) D3 charts |
| [US-03](./user-stories/E1-modular-services.md#us-03-streaming-asr-over-websocket) Streaming ASR | [US-07](./user-stories/E2-unified-app.md#us-07-vision-scores-and-video-moderation) Vision / video | [US-11](./user-stories/E3-operator-console.md#us-11-embedding-atlas-on-rag) Embedding atlas |
| [US-04](./user-stories/E1-modular-services.md#us-04-fine-tuning-scripts) Fine-tuning scripts | [US-08](./user-stories/E2-unified-app.md#us-08-ui-proxy-and-per-module-health) UI `/ml` proxy | [US-12](./user-stories/E3-operator-console.md#us-12-eval-dashboard) Eval dashboard |

## Epic index

| Epic | File | Stories | Status |
| ---- | ---- | ------- | ------ |
| E1 Modular services | [E1-modular-services.md](./user-stories/E1-modular-services.md) | US-01 – US-04 | Done |
| E2 Unified app | [E2-unified-app.md](./user-stories/E2-unified-app.md) | US-05 – US-08 | Done |
| E3 Operator console | [E3-operator-console.md](./user-stories/E3-operator-console.md) | US-09 – US-12 | Done (US-12 Planned) |

## Related

- [User Story Mapping — Jeff Patton](https://www.jpattonassociates.com/user-story-mapping/)
- [Domain Glossary](../Glossary.md)
