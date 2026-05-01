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

Build the focus argument by concatenating three layers:

1. **Plugin-level review guidance.** Read the file at `prompts/review-guidance.md` inside this plugin (locate it with `Glob` for `**/hyperworker/prompts/review-guidance.md` if you don't have an absolute path). It captures plugin-wide rules around module/function size, complexity, and unit-test expectations.
2. **PRD reference.** `Review against the PRD at plans/<branch>-prd.md so Codex reviews against intent rather than just the code in isolation.`
3. **Phase-specific focus.** `(a) every Functional Requirement (FR-1..FR-N) is enforced by the code, not merely present; (b) cross-task integration points (API ↔ worker ↔ DB; UI ↔ API; infra ↔ deploy); (c) security, data integrity, idempotency, rollback safety per the codex adversarial bar.`

Concatenate the three into a single focus string and invoke:

```
/codex:adversarial-review --base main "<concatenated focus argument>"
```

If the change is large (>5 files or >300 LOC), append `--background` so the review runs in a Claude background task; poll with `/codex:status` and retrieve with `/codex:result`.

### Step 2: Capture the structured output

Codex returns JSON matching the codex plugin's `review-output` schema. Fields used here:

- `verdict` — `"approve"` or `"needs-attention"`
- `findings[]` — each with `severity` (`critical` / `high` / `medium` / `low`), `confidence` (0..1), `file`, `line_start`, `line_end`, `title`, `body`, `recommendation`
- `summary` — terse ship/no-ship assessment
- `next_steps[]` — Codex's suggested follow-ups

Append the **full** Codex JSON output to `plans/progress.txt` under a `## Phase 5 Codex Review` section so the original review is auditable after fixes land.

### Step 3: Triage findings

| severity | confidence | action |
|---|---|---|
| `critical` or `high` | ≥ 0.7 | **Block.** Resolve in Step 4. |
| `critical` or `high` | < 0.7 | Surface to user with a `low-confidence` label; ask whether to block before resolving. |
| `medium` | any | Advisory — surface, do not auto-resolve. |
| `low` | any | Drop. Filter unless the user explicitly asks for them. |

### Step 4: Resolve blocking findings inline

Group blocking findings by file or by tightly-related logical cluster. For each group, dispatch ONE **fix agent** via the Task tool. Run them in parallel.

Each fix agent receives:
- The full Codex finding(s) for its group — title, body, severity, confidence, file, lines, recommendation
- Instructions to:
  - Read the affected file(s) and the surrounding context the finding cites
  - Fix the finding inline, scoped to the affected lines, **without redesigning surrounding code or expanding scope** beyond what the finding calls out
  - Commit with message `[<branch>-fix-NN] <finding title>`
- Permission to consult the original Task list (`TaskList`) and `git blame` to understand which Task introduced the code, but no requirement to coordinate with other fix agents

Fix agents do NOT re-enter Phase 4, do NOT share state with each other, and do NOT have license to fix issues Codex didn't flag.

### Step 5: Decide

After all fix agents finish, **proceed to Phase 6**. **Do NOT re-run Codex.** Adversarial reviewers tend to surface fresh concerns on every pass, so re-running creates a perpetual no-ship loop. The single Codex pass plus Phase 6's per-Task verifier is the bounded-cost design — Phase 6 catches anything the fix agents broke.

If Codex's initial verdict was `approve` or only advisory findings remained after Step 3, skip Step 4 and proceed directly to Phase 6.

### Calibration

Track the blocking-finding rate over time. If Codex flags blocking issues on <10% of PRDs, the cost is well-spent. If >30%, your PRD acceptance criteria or the review-guidance file are noisy — tighten the focus argument, revisit Phase 2's task structure, or update `prompts/review-guidance.md` to ban the categories that keep firing.

## Phase 6: Acceptance Testing

After Phase 5 clears, run end-to-end acceptance testing. Goal: confirm every Task's claimed completion is reflected in the **live runtime**, not merely in the diff — and that the assembled feature satisfies the PRD's Functional Requirements and Success Metrics.

Verification is **adversarial**. Default to skepticism. Implementer agents routinely commit code without running it, write manifests without applying them, leave TODOs / FIXMEs / "user should manually" notes, and stop at permission prompts while claiming completion. Treat any of these as a verification failure.

### Architecture: per-Task verifier agents

For every Task that completed in Phase 4, dispatch one **verifier agent** in parallel — same fan-out pattern as Phase 4 implementers. Each verifier independently audits ONE Task, attempts to fix any gaps it finds, re-verifies, and reports a terminal verdict. Verifiers do not share state with each other or with the original implementer.

Use the Task tool to spawn each verifier with the **Verifier Agent Prompt** (below) plus the Task ID.

### The four-axis verification rubric (stack-agnostic)

For every Acceptance criterion in the Task, check all four axes in order:

| Axis | Question |
|---|---|
| **Present** | Is the change committed in the repo? |
| **Applied** | Has the change been pushed to its real runtime by whatever means is canonical for this stack — deploy / apply / push / publish / migrate? |
| **Observable** | Does querying the runtime now return the new state? |
| **Behaves** | Does exercising the change end-to-end produce the expected result? |

The verifier infers what "the runtime" means by reading the Acceptance criteria — UI criteria → the deployed web app, cluster criteria → the K8s cluster, API criteria → the live endpoint, infra criteria → the cloud provider console. The prompt deliberately does not enumerate stacks; the verifier picks the right tooling per Task.

### Deferral signals

Audit the implementer's progress log entry and final commit message explicitly for:

- **Linguistic markers**: `"user should"`, `"manually apply"`, `"awaiting merge"`, `"left for follow-up"`, `"TODO"`, `"FIXME"`, `"in a future PR"`, `"you can now"`. Quote the offending phrase verbatim into the verifier output.
- **Tool-call audit**: did the implementer invoke a runtime-mutating action (apply / deploy / push / migrate / exec / run / publish), or only file-write tools? File-only with a runtime-axis criterion is a strong deferral signal.
- **Diff/runtime mismatch**: diff claims version V2; runtime reports V1.

### Browser-based verification

This pipeline runs Claude Code in `--chrome` mode. For any **Behaves** axis check involving a web UI (clicking buttons, observing visual state, exercising forms), use the `mcp__claude-in-chrome__*` tools — `navigate`, `read_page`, `find`, `form_input`, `get_screenshot`, etc. Do not approximate UI verification by reading source code.

If the Chrome MCP tools are not visible at runtime and a UI verification is required, stop and instruct the user to relaunch Claude Code with the `--chrome` flag. Do not proceed with a synthetic verdict.

### Verifier fixes inline

If a verification fails, the verifier **fixes the gap inline** rather than handing off to a fresh agent. The verifier has already built up the relevant context — the Task spec, the diff, the runtime state, and the precise failure mode. Handing off discards that context.

**The verifier may fix:**
- Deferred runtime actions: apply / deploy / push / publish / migrate / exec / run
- Implementation gaps revealed by the verification (missing edge case, wrong field name, off-by-one, etc.) — scoped to the failed Acceptance criterion

**The verifier MUST NOT:**
- Silently elevate permissions
- Take destructive actions (drop tables, delete resources, force-push) without explicit user approval
- Re-design the Task or expand its scope beyond the failed Acceptance criteria

After each fix, re-run the four-axis check for the affected criterion. Loop until verified or until you hit a hard blocker.

### Hard blockers

When you cannot fix because of missing access, missing creds, or a destructive action that needs approval, do NOT silently elevate. Stop and emit a structured blocker:

```json
{
  "required_action": "what would unblock the verification",
  "command_or_step": "the literal command or UI step",
  "reason_blocked": "permission | missing-creds | requires-human-approval | requires-destructive-action",
  "suggested_role": "human | elevated-agent"
}
```

The Team Lead routes blockers to the user.

### Verifier output

Each verifier returns JSON shaped like:

```json
{
  "task_id": "<branch>-NN",
  "verdict": "verified" | "unverifiable",
  "summary": "one-line ship/no-ship assessment",
  "axis_results": [
    {
      "axis": "present|applied|observable|behaves",
      "status": "pass|fail|fixed|blocked",
      "evidence": "command + observed output / query + result / UI exercise + observation",
      "claim_quote": "verbatim snippet from implementer's progress log or commit",
      "fix_applied": "what the verifier did to bring this axis to pass, if anything"
    }
  ],
  "blockers": []
}
```

Every `evidence` field is a citation of an actual command/query/exercise + observed output, not a summary. Every `claim_quote` is a verbatim quote from the implementer's progress log or commit, not a paraphrase.

The verdict is binary: `verified` (every axis passes after any inline fixes) or `unverifiable` (a hard blocker stopped the verifier from reaching `verified`). The richer "deferred" / "broken" distinction is captured per-axis in `status` and `fix_applied`.

### Team Lead decision

After all verifier agents finish:

- **Every Task `verified`** → mark the team complete. Output a one-paragraph completion summary: PRD title, total Tasks dispatched, Phase 5/6 cycle count, link to `tasks/progress.txt`.
- **Any Task `unverifiable`** → escalate the structured blockers from those Tasks to the user. Pause until they're resolved.

**The team is not done until every Task verifies cleanly.** Per-task `done` from Phase 4 is necessary but not sufficient — the integrated feature must actually work in its real runtime.

---

## Verifier Agent Prompt

You are a runtime verification agent. Your job is to confirm that a code-change Task has been **effectively applied to its real runtime** — not merely present in the diff.

You are NOT reviewing the code. You are checking whether the world has changed.

### Inputs

- The Task ID (passed to you when spawned). Retrieve the Task via `TaskGet`.
- The implementer agent's diff (read via `git log` / `git show` for the Task's commit).
- The implementer agent's progress log entry at `plans/progress.txt`.
- Access to whatever runtime the Task targets (cluster, deployed app, cloud provider, database, API).

### Default stance

Default to skepticism. Implementer agents routinely:
- Commit code without running it
- Write manifests without applying them
- Mark a task done while waiting for human approval
- Leave TODOs / FIXMEs / "user should manually" notes
- Stop at a permission prompt and claim completion anyway

Treat any of these as a verification failure.

### Method

For each Acceptance criterion in the Task, check all four axes (Present / Applied / Observable / Behaves) as defined in the parent skill. Translate each axis into the right tooling for this Task's runtime — you decide what "the runtime" means by reading the Acceptance criteria, not from a stack-keyed table.

For UI criteria, use the `mcp__claude-in-chrome__*` tools to actually drive the browser. If those tools are not visible, stop and tell the user to relaunch with `--chrome`.

If any axis fails, **fix the gap inline** within the bounds defined in the parent skill (deferred runtime actions and implementation gaps scoped to the failed criterion; never destructive actions without approval, never silent privilege elevation). Re-verify after each fix.

### Output

Return only valid JSON matching the verifier output schema in the parent skill. Be concrete:
- Every `evidence` field cites a real command + its observed output, a query + its result, or a UI exercise + the observed outcome.
- Every `claim_quote` is a verbatim snippet from the implementer's progress log or commit message.
- `fix_applied` describes what you changed and shows the post-fix evidence.

If you hit a hard blocker, set `verdict: unverifiable`, populate `blockers`, and stop. Do not produce a synthetic `verified` verdict to avoid the blocker.

Append your full verification record (axis results + evidence + any fixes) to `plans/progress.txt` under a `## Phase 6 Verification — <Task ID>` section before exiting.

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
