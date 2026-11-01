# E2 Unified app

← [User Story Map](../User-Story-Map.md)

## Background

One loopback process on a single base URL exposes all modules and aggregated
health. Secrets stay in environment files, not committed defaults.

---

## US-05 Single app and aggregated health

**As a** platform engineer  
**I want** one FastAPI app on port 8000 with aggregated `/health`  
**So that** boot and readiness checks cover every loaded module

### Acceptance criteria

1. **Scenario** Aggregated module health  
   **GIVEN** the unified app is running  
   **WHEN** `GET /health`  
   **THEN** each loaded module reports `status` and `latency_ms`

2. **Scenario** Single install and process  
   **GIVEN** a fresh clone  
   **WHEN** root requirements and `.env.example` are used  
   **THEN** all modules start from one process

### Status

Done

---

## US-06 Secrets only in `.env`

**As a** platform engineer  
**I want** non-secret settings inline and secrets only in `.env`  
**So that** credentials are not committed while local boot stays documented

### Acceptance criteria

1. **Scenario** Secrets stay in env  
   **GIVEN** the app configuration  
   **WHEN** defaults and `.env.example` are inspected  
   **THEN** secrets are env-only and non-secrets may be inline defaults

### Status

Done

---

## US-07 Vision scores and video moderation

**As a** sibling API developer  
**I want** vision prediction scores and per-frame video moderation  
**So that** product BFFs can apply thresholds on structured scores

### Acceptance criteria

1. **Scenario** Vision label scores  
   **GIVEN** the vision module is loaded  
   **WHEN** an image is submitted for prediction  
   **THEN** the response includes per-label scores

2. **Scenario** Per-frame video moderation  
   **GIVEN** the video module is loaded  
   **WHEN** a short clip is submitted  
   **THEN** moderation results are returned per frame

### Status

Done

---

## US-08 UI proxy and per-module health

**As a** model-test engineer  
**I want** the `ui/` console to use a single `/ml` proxy and show module health  
**So that** modules can be exercised without six separate origins

### Acceptance criteria

1. **Scenario** Health via `/ml` proxy  
   **GIVEN** the UI is running against the loopback app  
   **WHEN** the console is opened  
   **THEN** per-module health is visible through the `/ml` proxy

### Status

Done
