# E4 Module contracts and eval

← [User Story Map](../User-Story-Map.md)

## Background

Modules expose routes and health, but input/output contracts and degraded
health meaning are not written as Preferred Terms. Eval dashboard (US-12)
is still planned; after it ships, fixture-run results need a clear compare
path for quality gates.

Related: [US-12 Eval dashboard](./E3-operator-console.md#us-12-eval-dashboard) (E3, Planned).

---

## US-13 Module I/O and health contracts in Glossary

**As a** sibling API developer  
**I want** Glossary entries for each module’s inputs, outputs, and health semantics  
**So that** BFFs integrate against documented contracts, not only sample calls

### Acceptance criteria

1. **Scenario** Per-module contract rows  
   **GIVEN** `docs/Glossary.md`  
   **WHEN** recommendation, vision, RAG, speech, image, and video modules are listed  
   **THEN** each has Preferred Terms for primary request/response concepts  
   **AND** `ok` / `degraded` / `error` health meaning is defined

2. **Scenario** Matches live health  
   **GIVEN** the unified app `/health` payload  
   **WHEN** compared with Glossary health terms  
   **THEN** status values and fields align with the documented vocabulary

### Status

Planned

---

## US-14 Fixture eval compare for quality gates

**As a** model-test engineer  
**I want** to compare fixture-run eval results in the console after the eval dashboard exists  
**So that** quality gates use the same numbers the team reviews

### Acceptance criteria

1. **Scenario** Compare two fixture runs  
   **GIVEN** US-12 eval dashboard is available and at least two fixture runs exist  
   **WHEN** the engineer opens the compare view (or equivalent)  
   **THEN** metric differences between runs are visible without exporting raw files by hand

2. **Scenario** Gate-oriented summary  
   **GIVEN** a run that fails an agreed threshold  
   **WHEN** results are shown  
   **THEN** the failing metric is identifiable for a go/no-go decision

### Status

Planned
