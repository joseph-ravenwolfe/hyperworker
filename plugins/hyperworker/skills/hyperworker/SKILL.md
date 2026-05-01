---
name: hyperworker
description: "Acts as a Team Lead skill: converts a PRD into tasks, sets dependencies, and dispatches autonomous coding agents to execute them in parallel. Use after a PRD exists to turn it into running work. Triggers on: ship this prd, work this prd, hyperworker, dispatch agents, run the tasks. Returns results only. Do not run in plan mode."
user-invocable: true
---

You will be the Team Lead for an Agent Team. You will act as the delegator and work supervisor. You will not perform any work on tasks yourself.

## Phase 0: Identify the PRD

Derive the `<branch>` name from the PRD file being processed:

1. **If you already know the PRD from the current session** (e.g., `/prd` was just run, or the PRD file path is in context), use that file directly.
2. **Otherwise**, list the most recently modified `plans/*-prd.md` files and use **AskUserQuestion** with a multiple-choice list so the user can pick which PRD to operate on.
3. Derive `<branch>` by stripping the `-prd.md` suffix from the chosen filename (e.g., `plans/20260415-ambient-mesh-prd.md` → `<branch>` = `20260415-ambient-mesh`).
4. **Sanity check:** Run `git branch --show-current`. If the result does not match `<branch>`, warn the user and use **AskUserQuestion** to confirm whether to continue or pause so they can check out the right branch. If they pause, STOP here.

## Phase 1: Create the Agent Team

Call `TeamCreate` with:
- `team_name`: `<branch>`
- `description`: a short string derived from the PRD title (e.g., the H1 heading or the Introduction/Overview's first sentence).

All subsequent `TaskCreate` calls in this skill will be automatically associated with this team's task list. Do NOT call `TaskCreate` before `TeamCreate`.

## Phase 2: Convert PRD to Tasks

Read the PRD and create one `TaskCreate` call per Task listed under each Outcome.

### TaskCreate arguments

For each Task in the PRD:

- **Subject:** The task ID + title, exactly as written in the PRD. Example: `20260415-notifications-01: Provision notification infrastructure via Terraform`

- **Description:** The full Task body, copied **verbatim** from the PRD:
  - The `**Description:**` paragraph
  - The `**Approach:**` paragraph
  - The `**Acceptance criteria:**` checklist

  Preserve the structure exactly. Do NOT summarize, condense, or paraphrase — agents rely on the wording.

### Order

Create tasks in **dependency order**: earlier tasks must not depend on later ones. The Task IDs in the PRD (`<branch>-01`, `<branch>-02`, …) are already ordered by intent; create them in that order by default.

If you spot an ordering bug (e.g., `<branch>-04` references something built in `<branch>-05`), surface it to the user before continuing.

### Functional Requirements cross-check

After extracting Tasks, cross-check against the PRD's **Functional Requirements** section:

1. Read every numbered FR (`FR-1`, `FR-2`, …) in the PRD.
2. For each FR, verify it is traceable to at least one Task's Approach + Acceptance criteria.
3. If an FR is **not covered**:
   - If it fits naturally into an existing Task, extend that Task's Approach and Acceptance criteria (and update the PRD on disk to keep it in sync).
   - Otherwise, create a new Task for that FR following the standard Description / Approach / Acceptance criteria format.
4. After all tasks are created, list the FR → Task mapping so traceability is visible.

**Every functional requirement must be implemented. If a Task doesn't cover it, no agent will.**

### Splitting oversized Tasks

If a Task is too big to fit in a single agent iteration (one context window), split it before calling `TaskCreate`. Update the PRD on disk to match so the artifact stays in sync with the task list.

Rule of thumb: if you cannot describe the change in a single Approach paragraph, or the work spans multiple stacks/components that genuinely need different expertise to ship, it is too big.

### Create the symlink

Once all `TaskCreate` calls have completed, create the symlink so the user can browse task artifacts under `plans/<branch>/`:

```
ln -sf ~/.claude/tasks/<branch> plans/<branch>
```

## Phase 3: Set Task Dependencies

After all tasks are created via `TaskCreate`, use `TaskUpdate` to explicitly set the dependencies between them.

### Step 1: Build the dependency tree

1. Gather the full set of just-created tasks (their IDs and Subjects).
2. For each Task, determine which other Tasks it `blocks` (must finish before another can start) and which it `is_blocked_by` (must wait for another to finish).
3. Apply the **single stack-owning worker** mental model: whoever claims a Task owns its full implementation slice — code, config, tests, QA. No handoffs. So only add a dependency if the work **genuinely cannot begin** before another finishes (i.e., waiting is necessary for correctness, not for organizational process or review).
4. Prefer the smallest necessary set of gates so the DAG can fan out as wide as possible.

Examples:
- A schema-creation Task blocks a Task that writes to that schema.
- A Terraform-provisioning Task blocks a deploy Task that consumes the provisioned resources.
- A docs/README Task usually does NOT need to block implementation — same worker can do both in one slice.
- Two Tasks touching different stacks (e.g., DB migration and frontend skeleton) usually have no dependency.

### Step 2: Update task records

For each Task, call `TaskUpdate` with `blocks` and `is_blocked_by` fields based on the tree from Step 1.

Example: if `<branch>-01` must finish before `<branch>-02` can begin:
- `TaskUpdate(<branch>-01, blocks=["<branch>-02"])`
- `TaskUpdate(<branch>-02, is_blocked_by=["<branch>-01"])`

Set dependencies only after **all** Tasks have been created.

### Step 3: Record the DAG

Output the final dependency mapping (Task ID → `blocks` / `is_blocked_by`) so the user can see it before dispatch.

## Phase 4: Dispatch Agents

Use `TaskList` to retrieve the full set of tasks (with their dependencies). Print the DAG as a condensed ASCII tree to the user (informational — do NOT wait for approval).

Then immediately spawn agents:

1. For every currently unblocked Task, use the Task tool to spawn an agent. No parallelism cap — fan out as wide as the DAG allows.
2. Pass the Agent Prompt below as each agent's instructions, along with the Task ID.
3. Name agents after the Task `<branch>-01`, `<branch>-02`, `<branch>-03`, ...
4. When an agent finishes, ensure it's shut down, then re-evaluate the DAG (some tasks may have become unblocked) and dispatch the next batch.

Continue until every Task in the team is `done` or until the user pauses.

**Preserve completed tasks.** Do NOT call `TaskStop`, delete tasks, or delete the team after completion. Completed tasks remain in the team's task list as the durable audit trail for what was done, by which agent, and when. The user can browse them at any time under `plans/<branch>/`.

## Phase 5: Code Review (Codex)

After all Tasks are `done`, run an adversarial code review using the Codex plugin. Goal: catch issues no single agent could see — cross-task inconsistencies, weak invariants, security smells, missed edge cases — by deliberately using a *different model family* (Codex / GPT-5-Codex) than the one that wrote the code.

This phase requires the `codex` plugin to be installed; it is declared as a dependency in this plugin's `plugin.json`.

### Step 1: Invoke the review

Invoke `/codex:adversarial-review` with the focus argument set to the PRD context, so Codex reviews against intent rather than just the code in isolation:

```
/codex:adversarial-review --base main Review against the PRD at plans/<branch>-prd.md. Focus on: (1) every Functional Requirement (FR-1..FR-N) is enforced by the code, not merely present; (2) cross-task integration points (API ↔ worker ↔ DB; UI ↔ API; infra ↔ deploy); (3) security, data integrity, idempotency, and rollback safety per the codex adversarial bar.
```

If the change is large (>5 files or >300 LOC), append `--background` so the review runs in a Claude background task; poll with `/codex:status` and retrieve via `/codex:result`.

### Step 2: Parse the structured output

Codex returns JSON matching the codex plugin's `review-output` schema. Fields used here:

- `verdict` — `"approve"` or `"needs-attention"`
- `findings[]` — each with `severity` (`critical` / `high` / `medium` / `low`), `confidence` (0..1), `file`, `line_start`, `line_end`, `title`, `body`, `recommendation`
- `summary` — terse ship/no-ship assessment
- `next_steps[]` — Codex's suggested follow-ups

### Step 3: Triage findings

Apply this rule (tunable):

| severity | confidence | action |
|---|---|---|
| `critical` or `high` | ≥ 0.7 | **Block.** Create a follow-up Task per finding (see below). |
| `critical` or `high` | < 0.7 | Surface to user with a `low-confidence` label; let them decide whether to block. |
| `medium` | any | Advisory — surface, but do not auto-create Tasks. |
| `low` | any | Drop. Usually nitpicks; filter unless the user explicitly asks for them. |

For each blocking finding, call `TaskCreate` with:
- **Subject:** `<branch>-fix-NN: <finding.title>`
- **Description:** finding `body` + `file` + `line_start`-`line_end` + `recommendation`, framed in the standard Description / Approach / Acceptance criteria structure.

Do not set up a parallel fanout for fix Tasks — they typically need to land before re-review.

### Step 4: Decide

- **Any blocking Tasks created** → loop back to **Phase 4: Dispatch Agents** to work them, then re-run Phase 5.
- **Verdict is `approve`** or **only advisory findings remain** → proceed to **Phase 6: Acceptance Testing**.

### Calibration

Track the disagree rate over time. If Codex flags blocking issues on <10% of PRDs, the cost is well-spent. If >30%, your prompt or PRD acceptance criteria are too noisy — tighten the focus argument or revisit how Phase 2 specifies Approach + Acceptance criteria.

## Phase 6: Acceptance Testing

After Phase 5 clears, run end-to-end acceptance testing against the PRD's **Functional Requirements** and **Success Metrics**. Goal: confirm the assembled feature actually works as a whole — not just that each Task passed its own per-task acceptance criteria.

### Step 1: Build the verification matrix

Read the PRD's Functional Requirements (`FR-1`, `FR-2`, …) and Success Metrics sections. For each item, determine the verification method using the same domain table the prd skill uses:

| Domain | Verification |
|---|---|
| Web UI | Exercise the feature in a browser — happy path + at least one edge case |
| Kubernetes | `kubectl get/describe` confirms expected state; reconcile is clean |
| Terraform | Resource exists in the provider console; `terraform plan` is empty |
| Database | Query returns expected results; migrations apply + rollback cleanly |
| API | Endpoint responds with correct status and payload |

If a domain is not listed, derive an equivalent: **actually run the thing, observe the result, confirm it matches the requirement.**

### Step 2: Run the verifications

Walk every FR and Success Metric. For each:

1. Run the verification in the real (staging) environment.
2. Record the result (pass / fail) with concrete evidence — command + output, screenshot, query result, or equivalent.
3. Append the evidence to `tasks/progress.txt` under a `## Phase 6 Acceptance Verification` section.

This phase is integration-focused — exercise the cross-task seams (API → worker → DB; UI → API; Terraform → K8s deployment). The per-task QA covered each unit; this covers the assembly.

### Step 3: Triage failures

For each failed FR or Success Metric, call `TaskCreate` with:
- **Subject:** `<branch>-accept-NN: <FR ID> — <what failed>`
- **Description:** the verification step that failed, observed vs. expected behavior, and the relevant FR text from the PRD — in the standard Description / Approach / Acceptance criteria structure.

### Step 4: Decide

- **Any acceptance Tasks created** → loop back to **Phase 4** to dispatch them, then re-run Phase 6.
- **All FRs and Success Metrics pass** → mark the team complete. Output a one-paragraph completion summary: PRD title, total Tasks dispatched, Phase 5/6 cycle count, and a link to `tasks/progress.txt`.

**The team is not done until Phase 6 passes cleanly.** Per-task `done` status is necessary but not sufficient — the integrated feature must actually work.

---

## Agent Prompt

You are an autonomous coding agent working on a software project.

## Your Task

1. You have been assigned the following task. Work on this task and this task only:

```
TaskGet tool call
```

2. Read the progress log at `plans/progress.txt` (check codebase patterns first)
3. Implement only this Task
4. Run quality checks (e.g., typecheck, lint, test - use whatever your project requires)
5. Update CLAUDE.md only if you discover reusable patterns (see below)
6. If checks pass, commit ALL changes with message: `[Task ID] - [Task Title]`
7. Mark the task as complete
8. Append your progress to `plans/progress.txt` - Do not pick up another Task!

## Progress Report Format

APPEND to progress.txt (never replace, always append):

```
## [Date/Time] - [Task ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered (e.g., "this codebase uses X for Y")
  - Gotchas encountered (e.g., "don't forget to update Z when changing W")
  - Useful context (e.g., "the evaluation panel is in component X")
---
```

The learnings section is critical — it helps future iterations avoid repeating mistakes and understand the codebase better.

## Consolidate Patterns

If you discover a **reusable pattern** that future iterations should know, add it to the `## Codebase Patterns` section at the TOP of progress.txt (create it if it doesn't exist). This section should consolidate the most important learnings — conventions, gotchas, and non-obvious requirements that span multiple tasks.

Only add patterns that are **general and reusable**, not task-specific details.

## Update CLAUDE.md Files

Before committing, check if any edited files have learnings worth preserving in nearby CLAUDE.md files:

1. **Identify directories with edited files** - Look at which directories you modified
2. **Check for existing CLAUDE.md** - Look for CLAUDE.md in those directories or parent directories
3. **Add valuable learnings** - If you discovered something future developers/agents should know:
   - API patterns or conventions specific to that module
   - Gotchas or non-obvious requirements
   - Dependencies between files
   - Testing approaches for that area
   - Configuration or environment requirements

**Examples of good CLAUDE.md additions:**
- "When modifying X, also update Y to keep them in sync"
- "This module uses pattern Z for all API calls"
- "Tests require the dev server running on PORT 3000"
- "Field names must match the template exactly"

**Do NOT add:**
- Task-specific implementation details
- Temporary debugging notes
- Information already in progress.txt

Only update CLAUDE.md if you have **genuinely reusable knowledge** that would help future work in that directory.

## Quality Requirements

- ALL commits must pass your project's quality checks (typecheck, lint, test)
- Do NOT commit broken code
- Keep changes focused and minimal
- Follow existing code patterns

## Important

- Work on *ONLY* your ONE Task
- Commit frequently
- Keep CI green
- Read the Codebase Patterns section in progress.txt before starting
