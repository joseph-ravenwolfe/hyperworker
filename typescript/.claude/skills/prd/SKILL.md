---
name: prd
description: "Generate a Product Requirements Document (PRD) for a new feature. Use when planning a feature, starting a new project, or when asked to create a PRD. Triggers on: create a prd, write prd for, plan this feature, requirements for, spec out."
user-invocable: true
---

# PRD Generator

Create detailed Product Requirements Documents that are clear, actionable, and suitable for implementation by junior developers or AI agents.

## The Job

> **Placeholders used below:**
> - `<ticket>` — the Jira ticket number provided by the user (e.g., `APP-1234`)
> - `<branch>` — derived from the ticket number + a short kebab-case slug of the feature description (e.g., `APP-1234-task-priority`)
>
> Substitute these placeholders with their actual values everywhere they appear.

### Phase 0: Environment Setup
1. Receive a feature description from the user.
2. Ask for the **Jira ticket number** (format: `APP-####`) using **AskUserQuestion**.
3. Generate `<branch>` by combining `<ticket>` with a short, lowercase-kebab-case slug derived from the feature description (e.g., ticket `APP-1234` + description "Task Priority System" → `APP-1234-task-priority`).
4. Update `.claude/settings.json`: set the value of `env.CLAUDE_CODE_TASK_LIST_ID` to `<branch>`.
5. Run:
   ```
   ln -sf ~/.claude/tasks/<branch> plans/<branch>
   ```
   (This creates both directories if needed and makes `plans/<branch>` a symlink to `~/.claude/tasks/<branch>`)

### Phase 1: Draft PRD (baseline)
1. If `plans/<branch>-prd.md` already exists, move it to `plans/archive/<branch>-prd.md` before continuing
2. Ask 3–5 clarifying questions using **AskUserQuestion** (focus on: problem/goal, core functionality, scope/boundaries, success criteria)
3. Generate a complete draft PRD following the [annotated example](#example-prd-annotated-reference) below
    - Must include **Design Considerations** and **Open Questions**
4. Save to `plans/<branch>-prd.md`

### Phase 2: Design refinement (questions + expand open questions)
1. Review the PRD's **Design Considerations** and ask a targeted series of design questions using **AskUserQuestion**
2. Append newly discovered questions to the **bottom of the Open Questions section** (keep existing; add an "Added in Phase 2" subsection)
3. Update `plans/<branch>-prd.md` with the refined design considerations and updated open questions

### Phase 3: Final refinement (answer all open questions + final pass)
1. Ask the user **all remaining Open Questions** using **AskUserQuestion**
2. Refine the PRD one final time based on the answers
3. Save the final version to `plans/<branch>-prd.md`

**Important:** Do NOT start implementing. Just create the PRD.

## Before Saving

- [ ] Phase 0 completed: `<branch>` chosen, `CLAUDE_CODE_TASK_LIST_ID` updated in `.claude/settings.json`, `plans/<branch>/` directory exists, symlink `~/.claude/tasks/<branch>` points to `plans/<branch>/`
- [ ] Phase 1 PRD includes all 9 sections, including Design Considerations and Open Questions
- [ ] Used **AskUserQuestion** in each phase as needed
- [ ] Incorporated user's answers into the PRD after each refinement phase
- [ ] Developer stories are small, specific, and follow story format in the [annotated example](#example-prd-annotated-reference) below
- [ ] Functional requirements are numbered (`FR-###`) and unambiguous
- [ ] Any old `plans/<branch>-prd.md` is archived to `plans/archive/`
- [ ] Non-goals section defines clear boundaries
- [ ] Any newly discovered questions were appended to the bottom of **Open Questions** (with a phase marker)

---

# Example PRD (Annotated Reference)

> **[Guidance]** Brief description of the feature and the problem it solves.

## 1. Introduction/Overview

Add **priority levels** to tasks so users can focus on what matters most. Tasks can be marked as high, medium, or low priority, with visual indicators and filtering to help users manage their workload effectively.

Today, all tasks appear in a flat list with no way to distinguish urgency. What's missing is:

- A priority field on each task (high / medium / low)
- Visual indicators (colored badges) so priority is obvious at a glance
- Filtering and sorting so users can focus on high-priority items first

> **[Guidance]** Specific, measurable objectives (bullet list).

## 2. Goals

- Allow assigning priority (high / medium / low) to any task, defaulting new tasks to medium
- Provide clear visual differentiation between priority levels using colored badges on task cards
- Enable filtering and sorting by priority so users can focus on the most urgent work
- Persist priority in the database so it survives page reloads and sessions
- All changes ship with zero TypeScript errors (`tsc --noEmit`), zero lint warnings (`eslint . --max-warnings 0`), and passing tests

> **[Guidance]** Stories use the `<ticket>-##` prefix (zero-padded, two-digit). Each should be small enough to implement in one focused session.
> Format: `### <ticket>-##: [Title]` / `**Description:** As a [developer/user], I want [capability] so that [benefit].`
> Acceptance criteria must be concrete, testable, and indicate the "how." Good: "Selecting 'High' from the dropdown and saving shows a red badge on the task card." Bad: "Priority works."
> Story ordering follows schema → backend → UI (data layer first, then API, then frontend).

## 3. Developer Stories

### APP-1234-01: Add priority field to database schema
**Description:** As a developer, I need to store task priority in the database so it persists across sessions.

**Acceptance Criteria:**
- [ ] Add `priority` column to `tasks` table with type `enum('high', 'medium', 'low')` defaulting to `'medium'`
- [ ] Generate and run migration successfully
- [ ] Running `npm run build` completes without errors
- [ ] Running `tsc --noEmit` passes with no type errors
- [ ] Running `eslint . --max-warnings 0` passes with no warnings
- [ ] Existing tests continue to pass

### APP-1234-02: Create priority API endpoints
**Description:** As a developer, I want backend endpoints to read and update task priority so the frontend can manage priorities.

**Acceptance Criteria:**
- [ ] `GET /api/tasks/:id` response includes the `priority` field
- [ ] `PATCH /api/tasks/:id` accepts `{ priority: 'high' | 'medium' | 'low' }` and persists the change
- [ ] Invalid priority values return a 400 response with a descriptive error message
- [ ] Running `tsc --noEmit` passes with no type errors
- [ ] Running `eslint . --max-warnings 0` passes with no warnings

### APP-1234-03: Display priority badge on task cards
**Description:** As a user, I want to see task priority at a glance so I know what needs attention first.

**Acceptance Criteria:**
- [ ] Each task card shows a colored priority badge (red = high, yellow = medium, gray = low)
- [ ] Priority is visible without hovering or clicking
- [ ] Running `tsc --noEmit` passes with no type errors
- [ ] Running `eslint . --max-warnings 0` passes with no warnings
- [ ] Verify in browser using dev-browser skill

... continued with APP-1234-04 (priority selector in edit modal), APP-1234-05 (filter/sort by priority), and so on.

> **[Guidance]** Numbered `FR-#` list. Be explicit and unambiguous. Use application/user-action phrasing (e.g., "The system must allow users to...").

## 4. Functional Requirements

- FR-1: The system must store a `priority` field on every task with allowed values `high`, `medium`, or `low`, defaulting to `medium`.
- FR-2: The system must display a colored priority badge on each task card (red for high, yellow for medium, gray for low).
- FR-3: The system must allow users to change a task's priority from the task edit modal via a dropdown selector.
- FR-4: The system must allow users to filter the task list by priority level (All / High / Medium / Low).
- FR-5: The system must sort tasks by priority within each status column (high first, then medium, then low).
- FR-6: The system must return a 400 error when an invalid priority value is submitted via the API.

> **[Guidance]** What this feature will NOT include. Critical for managing scope.

## 5. Non-Goals (Out of Scope)

- No priority-based notifications or reminders
- No automatic priority assignment based on due date or other heuristics
- No priority inheritance for subtasks
- No drag-and-drop reordering within a priority group

> **[Guidance]** Address each of these categories where relevant:
> - UI/UX layout and visual design
> - Component architecture (new vs. reused components)
> - State management approach
> - API integration patterns
> - Reuse of existing components or utilities

## 6. Design Considerations

- **UI/UX layout**:
  - Priority badge appears to the left of the task title on each card for maximum visibility
  - Filter dropdown sits in the task list header, alongside existing filter controls
  - Priority selector in the edit modal uses a standard `<select>` element consistent with other form fields
- **Component architecture**:
  - New `PriorityBadge` component (presentational, receives `priority` prop, renders colored badge)
  - New `PriorityFilter` component (manages filter state, emits selected priority)
  - Reuse existing `Badge` component with color variants for the priority indicator
  - Reuse existing `Select` component for the priority dropdown in the edit modal
- **State management**:
  - Priority filter state stored in URL search params (shareable, survives refresh)
  - Task priority managed via existing task state slice / React Query cache — no new store needed
- **API integration**:
  - Extend existing `GET /api/tasks` response to include `priority` field
  - Extend existing `PATCH /api/tasks/:id` to accept `priority` in the request body
  - Use existing API client utilities and error handling patterns

> **[Guidance]** Address each of these categories where relevant:
> - Known constraints or dependencies
> - Integration points with existing systems
> - Performance requirements

## 7. Technical Considerations

- **Database migration**: The new `priority` column needs a default value so existing rows are backfilled automatically; no data migration script required.
- **Type safety**: Define a `Priority` union type (`'high' | 'medium' | 'low'`) in a shared types file and reference it from both backend and frontend code.
- **Bundle size**: The `PriorityBadge` component should be lightweight — no new dependencies beyond existing design system tokens.
- **Backwards compatibility**: The API must continue to accept requests that omit the `priority` field, defaulting to `'medium'`.

> **[Guidance]** Quantitative, outcome-based metrics. Examples: "Reduce time to complete X by 50%", "Increase conversion rate by 10%".

## 8. Success Metrics

- Users can assign or change a task's priority in under 2 clicks
- High-priority tasks are immediately visible at the top of each status column without manual sorting
- Task list page load time does not regress by more than 50 ms after adding priority filtering
- Zero TypeScript errors and zero lint warnings across the entire codebase after all stories are merged

> **[Guidance]** Questions that must be answered to finalize scope/design/rollout. Keep existing questions across phases. Append additional questions discovered during refinement at the bottom (e.g., "Added in Phase 2", "Added in Phase 3").

## 9. Open Questions

- Should priority affect the default sort order within each status column, or only when the user explicitly sorts?
- Should we add keyboard shortcuts for quick priority changes (e.g., `1` = high, `2` = medium, `3` = low)?
- Do we need an "urgent" level above "high" for time-sensitive tasks?
