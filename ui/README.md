# ui

The model test UI is a local Angular app for exercising the modules of the
Explore ML app under `../python_ml/`. Each module gets one page, and every
endpoint of that module can be called from its page. Controls come from
[NG-ZORRO](https://ng.ant.design/), layout uses inline
[Tailwind CSS](https://tailwindcss.com/) classes, and charts use
[D3](https://d3js.org/).

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

This serves the app at <http://localhost:4200>. Start the Python app first
(`cd python_ml && uvicorn main:app --port 8000`); the overview page shows
which modules are up.

## Backend proxy

The browser only talks to the UI origin. The dev server proxies `/ml/*` to
the Python app with the prefix stripped, WebSockets included, so the app needs
no CORS setup.

| Proxy path | Default target          | Override env     |
| ---------- | ----------------------- | ---------------- |
| `/ml`      | `http://127.0.0.1:8000` | `EXPLORE_ML_URL` |

For example, to point the UI at a GPU box:

```bash
EXPLORE_ML_URL=http://gpu-box:8000 npm start
```

The proxy only runs under `ng serve`. If you host the `npm run build` output
elsewhere, put the same `/ml` rewrite in front of it.

## Pages

| Route              | Endpoints you can call | Charts |
| ------------------ | ---------------------- | ------ |
| `#/`               | `GET /health` every 15 s | Status per module with a self-check sparkline, browser round trip over time, latest `latency_ms` bars |
| `#/recommendation` | `{feeds,explores,reels}:rank`, `feeds:recall` | Slope chart from input order to ranked order, score bars, recall score histogram |
| `#/vision`         | `images:predict`, `images:moderate`, `videos:moderate` (file or URL) | Label probability bars, category scores with per-category threshold ticks, per-frame moderation timeline |
| `#/rag`            | collections, documents (upload, list, get, delete), query, stream query, export vectors, scrape, crawl, sync | Points per collection, source relevance bars, token arrival over time with time to first token, zoomable PCA vector map grouped by type or document |
| `#/image`          | `images:generate`, then polls `imageJobs/{id}` | Job status timeline with poll ticks, RGB histogram of the result |
| `#/speech`         | `voices:synthesize`, `audios:transcribe`, live ASR over `WS /ws/v1/audios:transcribe` | Waveforms of synthesized and uploaded audio, live microphone level with sentence markers |
| `#/video`          | `videos:generate`, then polls `videoJobs/{id}` | Job status timeline with poll ticks |

Every module page starts with a health check and lists one card per endpoint:
the form, the elapsed time, any error, the charts and the raw JSON response.
The health check reads the module's entry from the app's aggregated
`GET /health`; a module the app was started without shows as disabled.

## Checks

```bash
npm test        # Vitest unit tests via ng test
npm run build   # production build with template type-checking
```

CI runs both on every pull request and every push to `main` (Node 22).

## Layout

```text
src/app/
├── shared/    helpers.ts (HELPERS registry, mlUrl, toProxyUrl),
│              proxy.ts (used by proxy.conf.mjs), health.ts
│              (HealthService, parseHealthReport), call.ts (Call state),
│              sse.ts, poll.ts, job-trace.ts, audio.ts, error-message.ts,
│              observe-width.ts, module-page.ts, endpoint.ts, file-pick.ts
│              chart-math.ts   pure chart helpers (bins, rank shifts, PCA,
│                              envelopes, histograms, status spans)
│              scales.ts, bar-chart.ts, line-chart.ts, slope-chart.ts,
│              histogram-chart.ts, scatter-chart.ts, job-timeline.ts,
│              waveform.ts     D3 chart components
├── home/      home.page.ts (no service; uses HealthService)
└── <module>/  recommendation, vision, rag, image, speech, video
               <module>.page.ts     page; injects the service with inject()
               <module>.service.ts  @Service() class calling the app over
                                    HttpClient, plus its request and
                                    response types
speech/live-transcription.ts        WebSocket client for live ASR
```

Each folder holds flat files only; specs sit next to the file they test.
Service specs use `HttpTestingController` instead of a real backend; every
module service has one except `video`. Chart logic lives in `chart-math.ts`
so it can be unit-tested without a DOM; the components only bind data to
SVG.

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
Tailwind classes still win. The D3 charts read the same CSS variables
(`var(--color-primary)` and so on). They keep to the single accent: the
series or group in focus uses it, and everything else is grey with distinct
dash patterns or symbols.
