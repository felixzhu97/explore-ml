# ui

The model test UI is a local Angular app for exercising the helpers under
`../python_ml/`. You can check helper health, call each helper from a
playground, explore RAG embeddings on a 2-D map, and compare fine-tuning eval
reports. Charts use [d3](https://d3js.org/). The embedding map uses
[embedding-atlas](https://github.com/apple/embedding-atlas).

Keep this directory a sibling of `python_ml/`. Do not nest the UI under the
API tree.

## Get started

You need Node.js 22.22+ or 24.15+, the versions Angular 22 supports.
`ng serve` loads `proxy.conf.mjs`, which imports TypeScript directly; those
Node versions strip the types natively.

```bash
cd ui
npm ci
npm start
```

This serves the app at <http://localhost:4200>. Start any helpers you want to
test first; the overview page shows which ones are reachable.

## Helper proxy

The browser only talks to the UI origin. The dev server proxies
`/svc/<name>/*` to each helper with the prefix stripped, so the helpers need no
CORS setup. That matters for vision and recommendation, which ship without
CORS.

| Proxy path    | Helper           | Default target          | Override env |
| ------------- | ---------------- | ----------------------- | ------------ |
| `/svc/rec`    | recommendation   | `http://127.0.0.1:8000` | `REC_URL`    |
| `/svc/vision` | vision           | `http://127.0.0.1:8001` | `VISION_URL` |
| `/svc/rag`    | rag              | `http://127.0.0.1:8002` | `RAG_URL`    |
| `/svc/image`  | image-playground | `http://127.0.0.1:8003` | `IMAGE_URL`  |
| `/svc/speech` | speech           | `http://127.0.0.1:8004` | `SPEECH_URL` |
| `/svc/video`  | video            | `http://127.0.0.1:8005` | `VIDEO_URL`  |

For example, to point RAG at a GPU box:

```bash
RAG_URL=http://gpu-box:8002 npm start
```

The proxy only runs under `ng serve`. If you host the `npm run build` output
elsewhere, put the same `/svc/<name>` rewrites in front of it.

## Pages

| Route                 | What it does                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#/`                  | Polls every helper's health endpoint and charts the latency.                                                                                                        |
| `#/playground/<name>` | One playground per helper: ranking, image or video moderation, RAG upload and streaming Q&A, image and video jobs, TTS, and file or live ASR with a waveform.       |
| `#/atlas`             | Exports RAG vectors (`POST /api/v1/documents:exportVectors`), projects them with UMAP in the browser, highlights query hits, and lists nearest neighbours on click. |
| `#/evaluation`        | Drop JSON from `python_ml/*/training/eval_*.py` (or click **加载示例报告**) to compare fine-tuned and base results.                                                 |

The atlas keeps all computation in the browser. When a store holds more than
2000 points, the page draws a deterministic sample and shows a "已抽样" notice.

## Checks

```bash
npm test        # Vitest unit tests via ng test
npm run build   # production build with template type-checking
```

CI runs both on every pull request.

## Layout

```text
src/app/
├── core/      helper registry, /svc proxy rules, typed API clients, report parsing
├── charts/    d3 components (bars, grouped bars, confusion matrix, waveform)
└── pages/     overview, playground, atlas, evaluation
public/samples/  example eval reports
```

Styling follows the Apple design tokens in `src/styles.css`: one accent colour
(`#0066cc`), 17px body text, pill buttons, no shadows and no gradients.
