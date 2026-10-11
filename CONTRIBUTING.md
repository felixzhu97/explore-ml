# Contributing

Thanks for your interest in Explore ML.

## Development

Requires Python 3.11+ and Git. The optional model-test UI needs Node.js
22.22+ or 24.15+. See the project README for module-specific dependencies.

```bash
cd python_ml
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt --override overrides.txt
cp .env.example .env
uvicorn main:app --port 8000
```

Useful checks:

```bash
cd python_ml && pytest -q tests
```

For the UI: `npm test` and `npm run build` under `ui/`.

## Pull requests

1. Branch from `main` using a single English kebab-case slug.
2. Keep changes focused; keep Glossary and C4 in sync when module boundaries
   change.
3. Ensure relevant pytest (and UI checks when touching `ui/`) pass before
   opening a PR.
4. Open a PR against `main` with a clear why and References.

## Code of Conduct

Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).
