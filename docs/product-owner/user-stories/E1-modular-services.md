# E1 Modular services

← [User Story Map](../User-Story-Map.md)

## Background

Platform engineers need each ML capability (recommendation, vision, RAG,
speech, image, video) as a clear module with a flat layout so siblings can
call stable routes without owning model ops.

---

## US-01 Flat per-module layout

**As a** platform engineer  
**I want** each module under `controller/`, `service/`, `domain/`, `infra/`  
**So that** I can extend one capability without touching the others

### Acceptance criteria

1. **Scenario** Layout is discoverable  
   **GIVEN** the Explore ML app source tree  
   **WHEN** I open a module under `python_ml/`  
   **THEN** I see the flat `controller` → `service` → `domain` ← `infra` layout

### Status

Done

---

## US-02 RAG export vectors

**As a** sibling API developer  
**I want** to export document vectors via `documents:exportVectors`  
**So that** upstream apps can reuse embeddings without re-ingesting files

### Acceptance criteria

1. **Scenario** Export succeeds  
   **GIVEN** the RAG module is loaded and fixture documents exist  
   **WHEN** I call the export-vectors route  
   **THEN** the response contains vectors for the requested documents

### Status

Done

---

## US-03 Streaming ASR over WebSocket

**As a** sibling API developer  
**I want** streaming ASR on `/ws/v1/audios:transcribe`  
**So that** voice clients can receive partial transcripts without HTTP polling

### Acceptance criteria

1. **Scenario** WebSocket transcript  
   **GIVEN** the speech module is loaded  
   **WHEN** a client streams audio on the WebSocket  
   **THEN** partial and final transcript frames are returned

### Status

Done

---

## US-04 Fine-tuning scripts

**As a** platform engineer  
**I want** `training/` scripts in every module except video  
**So that** I can retrain locally against fixture data

### Acceptance criteria

1. **Scenario** Scripts present  
   **GIVEN** a non-video module  
   **WHEN** I list `training/`  
   **THEN** fine-tuning entry scripts are present and documented

### Status

Done
