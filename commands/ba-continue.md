---
description: Run the next BA kit step up to the next BA decision point (minimal router, kit iteration 1)
argument-hint: [step]
---

Load the `ba-rules` skill first and follow it. Reply in the chat language.

This is the **minimal router** (kit design §12 K-2): it picks the next step from `ba-project.yaml`, runs it if its skill is implemented, and stops at the next BA decision point. Steps not implemented yet are reported honestly — never imitated.

## 1. Read the project
- No `ba-project.yaml` in the project root → tell the BA to run `/ba-new <confluence-url>` and stop.
- Read `steps.*` (order: `ingest`, `requirements`, `conflicts`, `stories`, `review`, `spec`, `build`, `deploy`, `jira`).

## 2. Pick the step
- **With an argument** (`/ba-continue requirements`): use that step key; unknown key → list the valid keys and stop.
- **Without an argument**: the first step whose status is not `reviewed`, `approved` or `skipped`.
  - If that step is `draft` (and is not `ingest`): it is waiting for the BA's review. Say so (artifact path, what to check, the words that move it on: "reviewed" / "OK") and **stop** — do not re-run it.
  - If it is `stale`: say which source version made it stale and that re-running it goes through `/ba-sync` (iteration 3); stop.
  - All steps done → say so and suggest `/ba-status`.

## 3. Check the gate (`ba-rules` §4)
- `ingest`: no gate.
- `requirements`: `steps.ingest.status` is `draft` or later (ingest has no BA decision point).
- Every other step: the previous step is `reviewed` or `approved`.
- Gate not met → name the blocking step and its status, and stop.

## 4. Run or report
| Step | Implemented | Action |
|---|---|---|
| `ingest` | yes | run the `ingest-confluence` skill |
| `requirements` | yes | run the `requirements` skill |
| `conflicts`, `stories`, `review`, `spec`, `build`, `deploy`, `jira` | no | say: "Шаг `<key>` (skill `<skill>`) ещё не реализован — появится в итерации 2 кита." Do not run anything, do not write files, do not change `ba-project.yaml`. Stop. |

## 5. Continue or stop
- After `ingest`: it has no BA decision point → show its short report, then continue with `requirements` in the same run (gate in §3).
- After `requirements`: **stop** — decision point H1 (BA review → `reviewed`). Show the skill's finish report.
- Never move a step to `reviewed`/`approved` yourself; never continue past a decision point in the same run.

## 6. Log
Append one line to `docs/run-log.md`: date, `/ba-continue`, steps run, where it stopped and why.
