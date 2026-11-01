# E1 Modular services

← [User Story Map](../User-Story-Map.md)

## Background

Each ML capability (recommendation, vision, RAG, speech, image, video) is a
module with a flat package layout. Sibling services call stable routes; model
operations stay inside Explore ML.

---

## US-01 Flat per-module layout

**As a** platform engineer  
**I want** each module under `controller/`, `service/`, `domain/`, `infra/`  
**So that** one capability can change without editing the others

### Acceptance criteria

1. **Scenario** Module matches layer layout  
   **GIVEN** the Explore ML app source tree  
   **WHEN** a module under `python_ml/` is opened  
   **THEN** it follows `controller` → `service` → `domain` ← `infra`

### Status

Done

---

## US-02 RAG export vectors

**As a** sibling API developer  
**I want** to export document vectors via `documents:exportVectors`  
**So that** upstream apps reuse embeddings without re-ingesting files

### Acceptance criteria

1. **Scenario** Export document vectors  
   **GIVEN** the RAG module is loaded and fixture documents exist  
   **WHEN** the export-vectors route is called  
   **THEN** the response contains vectors for the requested documents

### Status

Done

---

## US-03 Streaming ASR over WebSocket

**As a** sibling API developer  
**I want** streaming ASR on `/ws/v1/audios:transcribe`  
**So that** voice clients receive partial transcripts without HTTP polling

### Acceptance criteria

1. **Scenario** Stream transcript frames  
   **GIVEN** the speech module is loaded  
   **WHEN** a client streams audio on the WebSocket  
   **THEN** partial and final transcript frames are returned

### Status

Done

---

## US-04 Fine-tuning scripts

**As a** platform engineer  
**I want** `training/` scripts in every module except video  
**So that** local retraining can run against fixture data

### Acceptance criteria

1. **Scenario** Training scripts listed  
   **GIVEN** a non-video module  
   **WHEN** `training/` is listed  
   **THEN** fine-tuning entry scripts are present and documented

### Status

Done
