---
name: write-stories
description: BA kit step 4 — turn the reviewed requirements and BA decisions into a dev-ready backlog — epics, INVEST stories with Gherkin acceptance criteria, A/B variants with a switch story, deferred items listed but not built, cut line and coverage matrix. Writes docs/03-backlog/. Use from /ba-continue (step stories) or when the BA asks to write or rewrite the backlog.
---

# Step 4 — write stories

You are a senior business analyst writing a backlog a developer can build from without asking questions. Load `ba-rules` first and follow it — especially golden rules 2 (trace), 3 (never invent) and 5 (PoC, not production), and the decision rules (§3). Read `ba-project.yaml`.

## Gate
- `steps.conflicts.status` is `reviewed` or `approved`, **and** no conflict in `analysis-log.md` is `Open`. Otherwise stop and tell the BA which conflicts are open.
- If `backlog.md` exists: `Draft` with a `review.md` → do not regenerate (changes go through `review-backlog`); `Reviewed`/`Approved` → changes go through `/ba-sync`.

## Inputs
`docs/01-requirements/requirements.md`, `docs/02-analysis/analysis-log.md`, `docs/00-source/README.md` (source keys), `ba-project.yaml` (`project.deadline`, `stack.deploy.profile`, `decisions.max_ab`).

## What may become a story
| Row | Story? |
|---|---|
| `Confirmed` REQ/NFR | yes |
| `Proposed` REQ/NFR whose source is a BA-made `DEC` or an `ASM` | yes — values from an `ASM` are marked `ASSUMPTION — not validated` in the story |
| `Proposed` wish of one stakeholder without a DEC | no — list it in backlog §7 as an open question |
| `Derived — needs BA confirmation` (not confirmed) | no — list it in backlog §7 |
| `OOS-xxx`, `Superseded by …`, `Removed …` | never |

Decision outcomes:
- **(a) Decided** — stories for the chosen option only.
- **(b) Prototype both (A/B)** — stories for **both** variants (`Variant: A` / `Variant: B`, tracing to the same DEC) plus **one story for the switch** the sponsor toggles at the demo. Show the group in backlog §4.
- **(c) Deferred — sponsor decision** — **no** stories; list the item in backlog §5 with its DEC/CON.

The deploy profile is a given: stories never assume storage, servers or services beyond `stack.deploy.profile` and the architect-rule DEC. If a story cannot be built within the profile, stop and tell the BA (it is a missed architect-rule case, `ba-rules` §7) — do not write the story around it.

## Output
- `docs/03-backlog/backlog.md` from `templates/backlog.md` in this skill's directory: header, epics, stories table, cut line and build order, A/B groups, deferred items, **coverage matrix** (every Must/Should REQ and NFR → stories; uncovered rows flagged), open questions raised while writing (`OQ-n`).
- `docs/03-backlog/stories/US-xxx.md` — one file per story from `templates/story.md`.

## Story rules
- **INVEST:** independent where possible; small enough for ≤ 1 day of build with AI; valuable on its own. Add a small technical enabler story only if a story cannot be built without it.
- **Context and business rules:** numbered, each with exact values (limits, time windows, texts) and the ID or `[KEY · Section]` they come from. Exact values only from sources, `DEC` or `ASM` — cite which; never invent a value.
- **Acceptance criteria (Gherkin):** happy path; every business rule; boundaries (exactly at the limit, limit + 1); negative and error cases; the **state effect** of every action (what changes in counts, statuses, availability — from the state-effect REQs); privacy rules where relevant; what the user sees after a page reload. Concrete example data (fictional names, real-looking dates). No vague words ("fast", "easy", "appropriate").
- **UI notes:** fields, states, messages — only what requirements or decisions define.
- **Definition of Ready** checkboxes: traces to a source · AC testable · no open questions · size agreed. A story with an open question is `Ready: No` and the question goes to backlog §7.
- **Cut line:** "Core demo" (the definition of done end to end), "Next", "Drop first"; consider `project.deadline`.
- Priority comes from the traced rows (highest Must/Should/Could among them); size S/M/L.

## Open questions while writing (decision point H3)
Collect `OQ-n` in backlog §7. When done, show them to the BA one by one with options and `Claude's recommendation`. Record each answer as a `DEC` in `analysis-log.md` (section "Decisions on backlog open questions") and, if it adds a rule, a `Proposed` row in `requirements.md` with source `[DEC-xxx]`; then update the affected stories. Unanswered questions stay in §7 and keep their stories `Ready: No`.

## Quality bar (check before finishing; report failures)
- Every Must/Should REQ and NFR that may become a story is covered, or flagged in the coverage matrix with a reason.
- No story without a trace; no story for an OOS, deferred or unconfirmed item.
- Every A/B group has both variants and one switch story.
- Every value in a business rule is traced; every action has a state-effect scenario.
- IDs continuous, never reused.

## Finish
1. `ba-project.yaml`: `steps.stories = {status: draft, source_version: <source.version>, updated: <today>}`.
2. Append to `docs/run-log.md`: epics, stories by priority and cut-line band, coverage gaps, OQ count and how many the BA answered.
3. Reply in the chat language: counts, coverage gaps, stories `Ready: No`, proposed commit `step 4: backlog v1`. The backlog stays `Draft`: next is `review-backlog` — the independent critic reviews the draft, the BA decides on the findings, and only then the backlog becomes `Reviewed` (as in the reference project). Do not ask the BA to mark the backlog reviewed now.
