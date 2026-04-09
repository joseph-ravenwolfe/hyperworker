---
name: prd-tasks
description: "Convert PRDs to tasks using Claude's TaskCreate tool for autonomous agent execution. Use when you have an existing PRD and need to create tasks from it. Triggers on: convert this prd, turn this into tasks, create tasks from this, prd to tasks."
user-invocable: true
---

# PRD Task Creator

Converts existing PRDs into tasks via Claude's `TaskCreate` tool for autonomous agent execution.

---

## The Job

> **Placeholders used below:**
> - `<branch>` — the value of `CLAUDE_CODE_TASK_LIST_ID` from `.claude/settings.json` (set by the PRD skill), e.g. `APP-1234-task-status`
>
> Substitute this placeholder with its actual value everywhere it appears.

### Phase 0: Pre-Flight Validation

Before doing anything else, run these checks in order. **Stop and surface each issue as you encounter it.**

#### Step 1 — Validate the symlink
1. Read `.claude/settings.json` and extract the value of `env.CLAUDE_CODE_TASK_LIST_ID` → this is `<branch>`.
2. Check that `plans/<branch>` exists **and** is a symlink pointing to `~/.claude/tasks/<branch>`.
3. Determine the currently checked-out git branch (`git branch --show-current`).
4. Compare the git branch name to `<branch>`:
   - **If they match** — proceed to Step 2.
   - **If they do NOT match** — tell the user:
     > The current git branch (`<actual-git-branch>`) does not match the task list branch (`<branch>`).
     > Would you like to continue anyway, or pause so you can check out a different branch?
   - Use **AskUserQuestion** and wait for their response. If they say pause, **stop here** — do not continue.

#### Step 2 — Validate branch name vs Claude settings
1. Confirm that `<branch>` in `.claude/settings.json` matches the branch name embedded in the PRD file (e.g. the `branchName` field or the branch slug used in story IDs).
2. **If they do not match**, warn the user:
   > ⚠️ The `CLAUDE_CODE_TASK_LIST_ID` in `.claude/settings.json` (`<branch>`) does not appear to match the PRD's branch context. You may need to update settings or re-run the PRD skill.

#### Step 3 — Warn about stale Claude Code session
1. If the **PRD skill** (`prd`) was invoked earlier in this same Claude Code session (i.e., `.claude/settings.json` was updated during this session), the running session may still be using the **old** `CLAUDE_CODE_TASK_LIST_ID` value.
2. In that case, warn the user:
   > ⚠️ It looks like the PRD skill was run during this session, which updated `.claude/settings.json`. You need to **restart your Claude Code session** so the tasks agent picks up the new `CLAUDE_CODE_TASK_LIST_ID` value. Please restart and re-invoke this skill.
3. Use **AskUserQuestion** to confirm whether the user wants to continue or restart. If they say restart, **stop here**.

Once all three steps pass, proceed to Phase 1.

---

### Phase 1: Convert PRD to Tasks

Take a PRD (markdown file or text) and create one task per user story using `TaskCreate`.

---

## TaskCreate Arguments

For each user story extracted from the PRD, call `TaskCreate` with these arguments:

### Subject
The ticket ID and the story title, combined:
```
APP-1234-01: Add priority field to data model
```

### Description
Load the **entire story description and all acceptance criteria** into this field. Format it as a single block of text:

```
As a developer, I need to store task priority locally so it persists across app launches.

Acceptance Criteria:
- Add `priority` property to Task model with enum type (high / medium / low) defaulting to medium
- Update local persistence (Core Data / Room / AsyncStorage) with migration
- Migration runs successfully without data loss
- Build succeeds on all target platforms
```

---

## Story Size: The Number One Rule

**Each story must be completable in ONE autonomous agent iteration (one context window).**

Each iteration spawns a fresh agent instance with no memory of previous work. If a story is too big, the agent runs out of context before finishing and produces broken code.

### Right-sized stories (mobile app examples):
- Add a property to the data model and update local persistence
- Add a new UI screen or view with static content
- Connect an existing screen to a ViewModel / data source
- Add a network request and response parsing for one endpoint
- Add a filter or sort control to an existing list
- Create a reusable UI component (badge, card, picker)

### Too big (split these):
- "Build the entire settings screen" – Split into: data model, individual setting sections, each toggle/control
- "Add authentication" – Split into: data model, login screen UI, network auth calls, session management, biometric unlock
- "Add offline sync" – Split into: local persistence, queue management, conflict resolution, sync trigger
- "Build the onboarding flow" – Split into one story per screen/step

**Rule of thumb:** If you cannot describe the change in 2-3 sentences, it is too big.

---

## Story Ordering: Dependencies First

Stories should be created in dependency order. Earlier stories must not depend on later ones.

**Correct order:**
1. Data model / schema changes (Core Data entities, Room entities, models)
2. Networking / API integration (request/response parsing)
3. Business logic / ViewModels
4. UI screens and components that consume the data
5. Polish / animations / accessibility

**Wrong order:**
1. UI screen (depends on ViewModel that doesn't exist yet)
2. ViewModel (depends on model that doesn't exist yet)

---

## Required Final Criteria

When creating tasks, append these criteria to every story's acceptance criteria:

- **All stories:** "Have objective and testable acceptance criteria, build succeeds on all target platforms"
- **Stories that change UI:** Do NOT add per-story simulator QA criteria. Simulator QA is handled by the dedicated final E2E QA story (see below).

If you need to write **new** stories (e.g., to cover an uncovered functional requirement), follow the acceptance criteria guidance in the PRD skill (`prd`) — criteria must be concrete, testable, and indicate the "how."

---

## Simulator QA: Final E2E Pass (Not Per-Task)

**Individual task agents do not manually open the simulator for ad-hoc QA.** They run platform-appropriate quality checks (build, lint, test) and any automated UI tests (e.g., Maestro, XCUITest, Espresso) that exist in the repo.

Simulator QA is performed **once** after all implementation tasks are complete, by a dedicated E2E QA agent. This avoids:

- Parallel agents fighting over the simulator (blocking/stuck agents)
- Redundant build/launch cycles per task (expensive in time and tokens)
- Dependent tasks blocked while an agent is stuck in the sim

### Mandatory final QA task

Every PRD that includes UI stories **must** have a final task created for E2E simulator QA. This task should:

- Be **blocked by** all other tasks (it runs last)
- Have acceptance criteria covering every UI flow from the PRD
- Require screenshots and/or video recordings saved to `plans/artifacts/`
- Require a **QA proof summary** at `plans/artifacts/qa-proof-summary.md` with:
  - Every screen/flow tested, with artifact filenames
  - Pass/fail per acceptance criterion
  - Any mismatches, bugs, or open questions for the human engineer
- Be reviewed by the Team Lead before sign-off — if issues are found, they are documented in the summary or raised to the human engineer

### What this proves to the human engineer:

- The feature works end-to-end beyond unit/integration tests
- Visual/navigation behavior matches the PRD's acceptance criteria
- Reviewable evidence exists (screenshots, video, summary) without needing to run the app themselves

---

## Conversion Rules

1. **Each user story becomes one `TaskCreate` call**
2. **IDs**: Sequential `<ticket>-01`, `<ticket>-02`, etc. (zero-padded, two-digit) — used in the Subject
3. **Create tasks in dependency order** (data model → networking → ViewModels → UI screens → polish)
4. **Subject**: `<ticket>-##: [Story title]`
5. **Description**: Full story description + all acceptance criteria

---

## Functional Requirements Cross-Check

After extracting stories from the PRD, cross-check against the **Functional Requirements** section (if present):

1. Read every numbered FR (e.g., `FR-1`, `FR-2`, …) in the PRD
2. For each FR, verify it is traceable to at least one story's acceptance criteria
3. If an FR is **not covered** by any story:
   - If it fits naturally as acceptance criteria on an existing story, add it there
   - Otherwise, create a new story specifically for that FR
4. After all tasks are created, list the FR → story mapping so traceability is visible

**Every functional requirement must be implemented. If a story doesn't cover it, no agent will.**

---

## Splitting Large PRDs

If a PRD has big features, split them:

**Original:**
> "Add user notification system"

**Split into separate `TaskCreate` calls:**
1. APP-1234-01: Add notification data model and local storage
2. APP-1234-02: Create notification service for fetching from API
3. APP-1234-03: Add notification bell icon to tab bar / navigation
4. APP-1234-04: Create notification list screen
5. APP-1234-05: Add mark-as-read functionality
6. APP-1234-06: Add notification preferences screen

Each is one focused change that can be completed and verified independently.

---

## Example

**Input PRD (abbreviated):**
```markdown
# Task Status Feature

Add ability to mark tasks with different statuses.

## Developer Stories
- APP-1234-01: Add status field to task data model
- APP-1234-02: Display status badge on task cells
- APP-1234-03: Add status toggle to task list rows
- APP-1234-04: Filter tasks by status

## Functional Requirements
- FR-1: Status property with enum type (pending / in_progress / done)
- FR-2: Status badge with color coding (gray/blue/green)
- FR-3: Inline status toggle saves immediately without screen refresh
- FR-4: Filter persists selection across screen appearances
- FR-5: Default status for new tasks is pending
- FR-6: Status changes are validated before persisting
```

**Output: `TaskCreate` calls**

**Task 1:**
- **Subject:** `APP-1234-01: Add status field to task data model`
- **Description:**
  ```
  As a developer, I need to store task status in the local database so the UI can display and filter by status.

  Acceptance Criteria:
  - Add `status` property with type enum (pending / in_progress / done) defaulting to pending
  - Update local persistence with migration
  - Existing records default to pending
  - Build succeeds on all target platforms
  ```

*…remaining PRD stories (APP-1234-02 through APP-1234-04) each become their own `TaskCreate` call in the same way…*

*…FR-6 was not covered by any existing story → new task APP-1234-05 added…*

*…APP-1234-03 was too large for one agent iteration → split into APP-1234-05 and APP-1234-06…*

**FR → Story traceability (listed after all tasks are created):**
| FR | Covered by |
|----|------------|
| FR-1 | APP-1234-01 |
| FR-2 | APP-1234-02 |
| … | … |

---

## Phase 2: Set Task Dependencies

**After all tasks have been created via `TaskCreate`, use the TaskUpdate tool to explicitly set the dependencies between tasks.**

### Step 1: Analyze and Build the Dependency Tree

1. Gather the full set of just-created tasks (their IDs and summaries).
2. For each task, determine which other tasks it "blocks" (must finish before another can start) and which it "is_blocked_by" (must wait for another to finish).
    - Use the intent, technical dependencies, and story ordering as described above (e.g., data model → networking → ViewModels → UI screens → polish).
    - Each task should be considered from the perspective of **a single autonomous stack-owning worker**: whoever claims a task owns all required layers, does their own code, tests, config, and QA—no handoffs.
    - Only add a dependency if the task's work **genuinely can't begin** before another is finished (i.e., if waiting is necessary for correctness or to avoid rework).
    - Prefer minimal dependency chains; only encode necessary gates, not organizational process or review steps.
    - Examples:
      - Data model stories must block networking stories that serialize the new fields, which must block UI screens that display them.
      - QA, testing, or doc stories for a feature may not need to block implementation stories (the same worker does it all, so can typically parallelize).

### Step 2: Update Task Records

1. For each task, use `TaskUpdate` to set the `blocks` and `is_blocked_by` fields based on the dependency tree from Step 1.
    - Example: If `APP-1234-01` must finish before `APP-1234-02` can begin, set `APP-1234-01` to `blocks=["APP-1234-02"]` and `APP-1234-02` to `is_blocked_by=["APP-1234-01"]`.
    - Only set dependencies after **all** tasks have been created.
2. Record the final dependency mapping (task ID → blocked/blocks relationships) immediately after the FR → story traceability map.

### Guidance

- Always prefer the smallest, necessary set of gates to allow as much parallelization as possible;
- The "single worker owns their full stack" model means docs, QA, and code for a feature can often proceed together.
- Only gate tasks when a technical or testable precondition **must** be satisfied.

---

## Checklist Before Creating Tasks

Before calling `TaskCreate`, verify:

- [ ] **Phase 0 passed:** symlink `plans/<branch>` exists and points to `~/.claude/tasks/<branch>`
- [ ] **Phase 0 passed:** git branch matches `<branch>` (or user explicitly chose to continue)
- [ ] **Phase 0 passed:** `CLAUDE_CODE_TASK_LIST_ID` in `.claude/settings.json` is consistent with the PRD
- [ ] **Phase 0 passed:** no stale-session warning (or user explicitly chose to continue)
- [ ] Each story is completable in one iteration (small enough)
- [ ] Stories are ordered by dependency (data model → networking → ViewModels → UI screens → polish)
- [ ] Acceptance criteria are verifiable (not vague)
- [ ] No story depends on a later story
- [ ] Every functional requirement from the PRD is traceable to at least one story's acceptance criteria
- [ ] FR → story traceability mapping is listed after tasks are created
- [ ] A final E2E simulator QA task is created, blocked by all other tasks, with proof summary + artifact requirements

---

## Checklist After Task Creation (Phase 2)

Before beginning work on any task, ensure:

- [ ] All tasks have been created via `TaskCreate`
- [ ] For each task, the `blocks` and `is_blocked_by` dependency fields have been set with `TaskUpdate` to reflect the true technical/functional dependencies, following the "one stack-owning worker" mental model
- [ ] The dependency mapping is documented and included after the FR → story mapping

---

## Checklist for Each Task

- [ ] Subject follows format: `<ticket>-##: [Title]`
- [ ] Description includes full story description + all acceptance criteria
- [ ] UI-touching PRDs include a final E2E simulator QA task (blocked by all others) with proof summary requirement
