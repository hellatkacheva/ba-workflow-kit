---
description: Run the next BA kit step up to the next BA decision point
argument-hint: [step]
---

Load the `ba-rules` skill first and follow it. Reply in the chat language.

Router (kit design §1.2, §12 K-2): picks the next step from `ba-project.yaml`, runs it if its skill is implemented, and stops at the next BA decision point. Steps not implemented yet are reported honestly — never imitated.

## 1. Read the project
- No `ba-project.yaml` in the project root → tell the BA to run `/ba-new <confluence-url>` and stop.
- Read `steps.*` (order: `ingest`, `requirements`, `conflicts`, `stories`, `review`, `spec`, `build`, `deploy`, `jira`).

## 2. Pick the step
- **With an argument** (`/ba-continue conflicts`): use that step key; unknown key → list the valid keys and stop.
- **Without an argument**: the first step whose status is not `reviewed`, `approved` or `skipped`.
  - If that step is `draft` (and is not `ingest`):
    - `conflicts` with a conflict `Open` or a gap without a BA answer in `analysis-log.md`, or `review` with findings without a BA outcome in `review.md` → **resume** that step's skill (it continues its BA decisions from the first open item).
    - `stories` → its review is the next step: go to `review` (the critic reviews the draft backlog; the backlog becomes `reviewed` only at the end of `review`).
    - Otherwise it is waiting for the BA's review. Say so (artifact path, what to check, the words that move it on: "reviewed" / "OK") and **stop** — do not re-run it.
  - If it is `stale`: say which source version made it stale and that re-running it goes through `/ba-sync` (iteration 3); stop.
  - All steps done → say so and suggest `/ba-status`.

## 3. Check the gate (`ba-rules` §4)
- `ingest`: no gate.
- `requirements`: `steps.ingest.status` is `draft` or later (ingest has no BA decision point).
- `stories`: `conflicts` is `reviewed`/`approved` **and** no conflict in `analysis-log.md` is `Open`.
- `review`: `stories` is `draft` or later (no BA review of the backlog before the critic).
- Every other step: the previous step is `reviewed` or `approved`.
- Gate not met → name the blocking step and its status, and stop.

## 4. Run or report
| Step | Implemented | Skill |
|---|---|---|
| `ingest` | yes | `ingest-confluence` |
| `requirements` | yes | `requirements` |
| `conflicts` | yes | `analyze-conflicts` |
| `stories` | yes | `write-stories` |
| `review` | yes | `review-backlog` (delegates to the `backlog-reviewer` agent) |
| `spec`, `build`, `deploy`, `jira` | no | say: "Шаг `<key>` (skill `<skill>`) ещё не реализован — появится в итерации 2b кита." Do not run anything, do not write files, do not change `ba-project.yaml`. Stop. |

## 5. Continue or stop
| After | Next |
|---|---|
| `ingest` | no BA decision point → show its short report, then continue with `requirements` in the same run (gate in §3) |
| `requirements` | **stop** — H1: BA review → `reviewed` (incl. confirming `Derived` rows) |
| `conflicts` | the skill itself holds H2 (the BA decides each conflict and gap in this run); then **stop** — BA review of `analysis-log.md` → `reviewed` |
| `stories` | the skill asks the BA its open questions (H3). If every OQ is answered → continue with `review` in the same run (it first asks to commit step 4); otherwise **stop** with the open OQs |
| `review` | the skill holds H4 (the BA accepts / rejects each finding in this run); then **stop** — BA says "reviewed" → backlog and review both `reviewed` |

Never move a step to `reviewed`/`approved` yourself; never continue past a decision point into the next step in the same run.

## 6. Log
Append one line to `docs/run-log.md`: date, `/ba-continue`, steps run, where it stopped and why.
