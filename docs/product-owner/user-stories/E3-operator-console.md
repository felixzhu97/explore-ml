# E3 Operator console

← [User Story Map](../User-Story-Map.md)

## Background

The `ui/` console provides one page per ML module with charts so routes can be
checked before sibling products attach BFFs.

---

## US-09 Module pages

**As a** model-test engineer  
**I want** UI pages for recommendation, vision, RAG, image, speech, and video  
**So that** each module can be exercised from the operator console

### Acceptance criteria

1. **Scenario** Submit fixture per module  
   **GIVEN** the `ui/` app on :4200  
   **WHEN** each module route is opened  
   **THEN** a fixture request can be submitted and a structured result shown

### Status

Done

---

## US-10 D3 charts on every module page

**As a** model-test engineer  
**I want** D3 charts on every module page  
**So that** numeric scores and series are readable without relying on raw JSON

### Acceptance criteria

1. **Scenario** Chart for numeric series  
   **GIVEN** a successful module response with numeric series  
   **WHEN** the page renders  
   **THEN** a D3 chart visualizes the result

### Status

Done

---

## US-11 Embedding atlas on RAG

**As a** model-test engineer  
**I want** a PCA embedding atlas on the RAG page  
**So that** cluster shape in exported vectors is visible

### Acceptance criteria

1. **Scenario** PCA scatter on RAG  
   **GIVEN** RAG vectors are available  
   **WHEN** the RAG page atlas is opened  
   **THEN** a PCA scatter plot is shown

### Status

Done

---

## US-12 Eval dashboard

**As a** model-test engineer  
**I want** an eval dashboard in `ui/`  
**So that** fixture-run quality metrics can be compared across modules

### Acceptance criteria

1. **Scenario** Eval metrics summary  
   **GIVEN** the operator console  
   **WHEN** eval is shipped  
   **THEN** a dashboard page summarizes fixture eval metrics

### Status

Planned
