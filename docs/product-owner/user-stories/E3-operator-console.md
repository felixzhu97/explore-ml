# E3 Operator console

← [User Story Map](../User-Story-Map.md)

## Background

Model-test engineers need one page per ML module with charts so they can
validate routes before sibling products wire BFFs.

---

## US-09 Module pages

**As a** model-test engineer  
**I want** UI pages for recommendation, vision, RAG, image, speech, and video  
**So that** I can exercise each module from the operator console

### Acceptance criteria

1. **Scenario** Pages exist  
   **GIVEN** the `ui/` app on :4200  
   **WHEN** I open each module route  
   **THEN** I can submit a fixture request and see a structured result

### Status

Done

---

## US-10 D3 charts on every module page

**As a** model-test engineer  
**I want** D3 charts on every module page  
**So that** scores and series are readable without raw JSON only

### Acceptance criteria

1. **Scenario** Chart renders  
   **GIVEN** a successful module response with numeric series  
   **WHEN** the page renders  
   **THEN** a D3 chart visualizes the result

### Status

Done

---

## US-11 Embedding atlas on RAG

**As a** model-test engineer  
**I want** a PCA embedding atlas on the RAG page  
**So that** I can spot cluster shape in exported vectors

### Acceptance criteria

1. **Scenario** Atlas scatter  
   **GIVEN** RAG vectors are available  
   **WHEN** I open the RAG page atlas  
   **THEN** a PCA scatter plot is shown

### Status

Done

---

## US-12 Eval dashboard

**As a** model-test engineer  
**I want** an eval dashboard in `ui/`  
**So that** I can compare module quality over fixture runs

### Acceptance criteria

1. **Scenario** Dashboard entry  
   **GIVEN** the operator console  
   **WHEN** eval is shipped  
   **THEN** a dashboard page summarizes fixture eval metrics

### Status

Planned
