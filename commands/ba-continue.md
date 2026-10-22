---
description: Run the next BA kit step up to the next BA decision point
argument-hint: [step]
---

Load the `ba-rules` skill first and follow it. Reply in the chat language.

Router (kit design §1.2, §12 K-2): picks the next step from `ba-project.yaml`, runs its skill, and stops at the next BA decision point.

## 1. Read the project
- No `ba-project.yaml` in the project root → tell the BA to run `/ba-new <confluence-url>` and stop.
- Read `steps.*` (order: `ingest`, `requirements`, `conflicts`, `stories`, `review`, `spec`, `build`, `deploy`, `jira`) and `stack.deploy.profile`.

## 2. Pick the step
- **With an argument** (`/ba-continue conflicts`): use that step key; unknown key → list the valid keys and stop.
- **Without an argument**: the first step whose status is not `reviewed`, `approved` or `skipped`.
  - `stack.deploy.profile` is `none` and the step is `spec`, `build` or `deploy` → say that these steps are skipped for profile `none`; on the BA's OK set them to `skipped` (append to `approvals`) and go on with `jira`.
  - If that step is `draft` (and is not `ingest`):
    - `conflicts` with a conflict `Open` or a gap without a BA answer in `analysis-log.md`, `review` with findings without a BA outcome in `review.md`, or `spec` with an open spec question (`OQ-Sn`) in `architecture.md` → **resume** that step's skill (it continues its BA decisions from the first open item).
    - `stories` → its review is the next step: go to `review` (the critic reviews the draft backlog; the backlog becomes `reviewed` only at the end of `review`).
    - `build` → **resume** `build`: it builds the next story if the last one is accepted by the BA, otherwise it shows what waits for acceptance and stops.
    - Otherwise it is waiting for the BA's review. Say so (artifact path, what to check, the words that move it on: "reviewed" / "OK") and **stop** — do not re-run it.
  - If it is `stale`: say which source version made it stale and that re-running it goes through `/ba-sync` (iteration 3); stop.
  - All steps done → say so and suggest `/ba-status`.

## 3. Check the gate (`ba-rules` §4)
- `ingest`: no gate.
- `requirements`: `steps.ingest.status` is `draft` or later (ingest has no BA decision point).
- `stories`: `conflicts` is `reviewed`/`approved` **and** no conflict in `analysis-log.md` is `Open`.
- `review`: `stories` is `draft` or later (no BA review of the backlog before the critic).
- `spec`: `review` is `reviewed`/`approved`.
- `build`: `spec` is `reviewed`/`approved`.
- `deploy`: `spec` is `reviewed`/`approved` **and** every Core demo story in `docs/04-spec/build-status.md` is accepted by the BA (build may still be `draft`).
- `jira`: `review` is `reviewed`/`approved` (spec, build and deploy are not required).
- Gate not met → name the blocking step and its status, and stop.

## 4. Run
| Step | Skill |
|---|---|
| `ingest` | `ingest-confluence` |
| `requirements` | `requirements` |
| `conflicts` | `analyze-conflicts` |
| `stories` | `write-stories` |
| `review` | `review-backlog` (delegates to the `backlog-reviewer` agent) |
| `spec` | `spec` |
| `build` | `build` (one story per run) |
| `deploy` | `deploy` |
| `jira` | `jira-sync` |

## 5. Continue or stop
| After | Next |
|---|---|
| `ingest` | no BA decision point → show its short report, then continue with `requirements` in the same run (gate in §3) |
| `requirements` | **stop** — H1: BA review → `reviewed` (incl. confirming `Derived` rows) |
| `conflicts` | the skill itself holds H2 (overview table first, then the BA decides each conflict and gap in this run); then **stop** — BA review of `analysis-log.md` → `reviewed` |
| `stories` | the skill asks the BA its open questions (H3). If every OQ is answered → continue with `review` in the same run (it first asks to commit step 4); otherwise **stop** with the open OQs |
| `review` | the skill holds H4 (the BA accepts / rejects each finding in this run); then **stop** — BA says "reviewed" → backlog and review both `reviewed` |
| `spec` | the skill asks its spec questions (H5) and the architect-rule re-check may raise a CON (H5a — stop until decided); then **stop** — BA + tech review → `reviewed` |
| `build` | **stop after each story** — H6: the BA checks and accepts it; "continue" / "next story" → next story |
| `deploy` | the skill stops before publishing for the BA's explicit OK (H7); after the smoke test **stop** |
| `jira` | the skill stops on the plan for the BA's OK before any write (H8); after the sync **stop** |

Never move a step to `reviewed`/`approved` yourself; never continue past a decision point into the next step in the same run.

## 6. Log
Append one line to `docs/run-log.md`: date, `/ba-continue`, steps run, where it stopped and why.
