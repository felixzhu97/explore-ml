# ui

The model test UI is a local Angular app for exercising the helpers under
`../python_ml/`. Each helper module gets one page, and every endpoint of that
module can be called from its page. Controls come from
[NG-ZORRO](https://ng.ant.design/), layout uses inline
[Tailwind CSS](https://tailwindcss.com/) classes, and score charts use
[d3](https://d3js.org/).

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

| Route      | Endpoints you can call                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| `#/`       | Health of every module, with a d3 latency chart.                                                             |
| `#/rec`    | `{feeds,explores,reels}:rank`, `feeds:recall`                                                                |
| `#/vision` | `images:predict`, `images:moderate`, `videos:moderate` (file upload or URL)                                  |
| `#/rag`    | collections, documents (upload, list, get, delete), query, stream query, export vectors, scrape, crawl, sync |
| `#/image`  | `images:generate`, then polls `imageJobs/{id}` and shows the image                                           |
| `#/speech` | `voices:synthesize`, `audios:transcribe`, live ASR over `WS /ws/v1/audios:transcribe`                        |
| `#/video`  | `videos:generate`, then polls `videoJobs/{id}` and plays the video                                           |

Every module page starts with a health check and lists one card per endpoint:
the form, the elapsed time, any error, and the raw JSON response. Image, speech
and video have no health route, so their check reads `/openapi.json`.

## Checks

```bash
npm test        # Vitest unit tests via ng test
npm run build   # production build with template type-checking
```

CI runs both on every pull request.

## Layout

```text
src/app/
├── core/      helper registry, /svc proxy rules, typed API clients, Call state
├── charts/    d3 bar chart
├── ui/        module page frame, endpoint card, file picker
└── pages/     home plus one page per module
```

## Theme

The app follows the Apple design tokens: one accent colour (`#0066cc`), 17px
body text, pill buttons, no shadows and no gradients. To change the theme,
edit variables rather than component styles:

| File                    | Controls                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/theme/tokens.less` | NG-ZORRO Less variables: colours, font, 44px control height, radii, pill buttons, shadows, neutral error state |
| `src/styles.css`        | Tailwind `@theme` tokens: colours, fonts, type scale (`text-display-lg`, `text-tagline`, …), radii, page width |

Keep the shared colour values in both files in sync. `src/theme/antd.less`
compiles NG-ZORRO with `tokens.less` inside the `antd` cascade layer. That
layer sits above Tailwind's preflight and below its utilities, so inline
Tailwind classes still win. The d3 charts read the same CSS variables
(`var(--color-primary)` and so on).
