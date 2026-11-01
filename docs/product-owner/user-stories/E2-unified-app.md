# E2 Unified app

← [User Story Map](../User-Story-Map.md)

## Background

Sibling APIs need one loopback base URL with aggregated health instead of
six separate ports, while secrets stay out of committed defaults.

---

## US-05 Single app and aggregated health

**As a** platform engineer  
**I want** one FastAPI app on port 8000 with aggregated `/health`  
**So that** boot and readiness checks cover every loaded module

### Acceptance criteria

1. **Scenario** Aggregated health  
   **GIVEN** the unified app is running  
   **WHEN** I `GET /health`  
   **THEN** each loaded module reports `status` and `latency_ms`

2. **Scenario** Single dependency surface  
   **GIVEN** a fresh clone  
   **WHEN** I install from the root requirements and `.env.example`  
   **THEN** I can start all modules from one process

### Status

Done

---

## US-06 Secrets only in `.env`

**As a** platform engineer  
**I want** non-secret settings inline and secrets only in `.env`  
**So that** local boot stays simple without committing credentials

### Acceptance criteria

1. **Scenario** Env split  
   **GIVEN** the app configuration  
   **WHEN** I inspect defaults vs `.env.example`  
   **THEN** secrets are env-only and non-secrets may be inline defaults

### Status

Done

---

## US-07 Vision scores and video moderation

**As a** sibling API developer  
**I want** vision prediction scores and per-frame video moderation  
**So that** product BFFs can gate unsafe media with structured scores

### Acceptance criteria

1. **Scenario** Vision scores  
   **GIVEN** the vision module is loaded  
   **WHEN** I submit an image for prediction  
   **THEN** the response includes per-label scores

2. **Scenario** Video frames  
   **GIVEN** the video module is loaded  
   **WHEN** I submit a short clip  
   **THEN** moderation results are returned per frame

### Status

Done

---

## US-08 UI proxy and per-module health

**As a** model-test engineer  
**I want** the `ui/` console to use a single `/ml` proxy and show module health  
**So that** I can exercise modules without opening six origins

### Acceptance criteria

1. **Scenario** Proxy health  
   **GIVEN** the UI is running against the loopback app  
   **WHEN** I open the console  
   **THEN** per-module health is visible through the `/ml` proxy

### Status

Done
