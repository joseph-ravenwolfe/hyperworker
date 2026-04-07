---
name: prd
description: "Generate a Product Requirements Document (PRD) for a new mobile app feature. Use when planning a feature, starting a new project, or when asked to create a PRD. Triggers on: create a prd, write prd for, plan this feature, requirements for, spec out."
user-invocable: true
---

# PRD Generator

Create detailed Product Requirements Documents that are clear, actionable, and suitable for implementation by junior developers or AI agents working on mobile apps (iOS Swift, Android Kotlin, React Native).

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
2. Ask 3–5 clarifying questions using **AskUserQuestion** (focus on: problem/goal, target platform(s), core functionality, scope/boundaries, success criteria)
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
- [ ] Target platform(s) are explicitly stated (iOS, Android, React Native, or cross-platform)
- [ ] PRDs with UI stories include a final E2E simulator QA story (blocked by all others)

---

# Example PRD (Annotated Reference)

> **[Guidance]** Brief description of the feature and the problem it solves.

## 1. Introduction/Overview

Add **priority levels** to tasks so users can focus on what matters most. Tasks can be marked as high, medium, or low priority, with visual indicators and filtering to help users manage their workload effectively.

Today, all tasks appear in a flat list with no way to distinguish urgency. What's missing is:

- A priority field on each task (high / medium / low)
- Visual indicators (colored badges) so priority is obvious at a glance
- Filtering and sorting so users can focus on high-priority items first

**Target platforms:** iOS (Swift/SwiftUI), Android (Kotlin/Jetpack Compose)

> **[Guidance]** Specific, measurable objectives (bullet list).

## 2. Goals

- Allow assigning priority (high / medium / low) to any task, defaulting new tasks to medium
- Provide clear visual differentiation between priority levels using colored badges on task cells/cards
- Enable filtering and sorting by priority so users can focus on the most urgent work
- Persist priority in the local database and sync with the backend so it survives app restarts and device switches
- All changes ship with zero build errors, zero lint warnings, and passing tests across all target platforms

> **[Guidance]** Stories use the `<ticket>-##` prefix (zero-padded, two-digit). Each should be small enough to implement in one focused session.
> Format: `### <ticket>-##: [Title]` / `**Description:** As a [developer/user], I want [capability] so that [benefit].`
> Acceptance criteria must be concrete, testable, and indicate the "how." Good: "Selecting 'High' from the picker and saving shows a red badge on the task cell." Bad: "Priority works."
> Story ordering follows data model → backend/networking → UI (data layer first, then API, then presentation).
> **Individual stories do NOT include simulator QA criteria.** A dedicated final E2E QA story (see below) handles all simulator/emulator testing in one pass after all implementation is complete.

## 3. Developer Stories

### APP-1234-01: Add priority field to data model and local storage
**Description:** As a developer, I need to store task priority locally so it persists across app launches.

**Acceptance Criteria:**
- [ ] Add `priority` property to the Task model with type `Priority` enum (`.high`, `.medium`, `.low`) defaulting to `.medium`
- [ ] Update local persistence (Core Data / Room / AsyncStorage) with migration for existing records
- [ ] Migration runs successfully without data loss
- [ ] Build succeeds on all target platforms
- [ ] Existing tests continue to pass

### APP-1234-02: Sync priority field with backend API
**Description:** As a developer, I want the priority field to sync with the backend so it persists across devices.

**Acceptance Criteria:**
- [ ] `GET /api/tasks/:id` response includes the `priority` field and is parsed into the model
- [ ] `PATCH /api/tasks/:id` sends `{ priority: 'high' | 'medium' | 'low' }` and persists the change
- [ ] Invalid priority values from the API are handled gracefully (default to `.medium`)
- [ ] Build succeeds on all target platforms
- [ ] Network layer tests pass

### APP-1234-03: Display priority badge on task cells
**Description:** As a user, I want to see task priority at a glance so I know what needs attention first.

**Acceptance Criteria:**
- [ ] Each task cell/card shows a colored priority badge (red = high, yellow = medium, gray = low)
- [ ] Priority is visible without tapping or long-pressing
- [ ] Badge follows platform conventions (SF Symbols on iOS, Material icons on Android)
- [ ] Build succeeds on all target platforms

... continued with APP-1234-04 (priority picker in edit screen), APP-1234-05 (filter/sort by priority), and so on.

### APP-1234-XX: End-to-end simulator QA validation

**Description:** As a developer, I need to verify the complete feature works end-to-end on the simulator/emulator before considering this feature complete.

**Acceptance Criteria:**

- [ ] Full flow tested on simulator/emulator covering every UI story's acceptance criteria
- [ ] Screenshots and/or video recordings saved to `plans/artifacts/`
- [ ] QA proof summary written to `plans/artifacts/qa-proof-summary.md` with pass/fail per AC, artifact filenames, and any issues/questions
- [ ] All quality checks pass (build, lint, tests)
- [ ] Team Lead reviews proof summary and artifacts before signing off

> **[Guidance]** Every PRD that includes UI stories MUST end with a dedicated E2E simulator QA story. Individual story agents do NOT open the simulator — only this final QA story does. This avoids parallel agents fighting over the simulator, redundant builds, and excessive token usage. The QA agent's job is to prove to both the Team Lead and the human engineer that the feature works as intended.

> **[Guidance]** Numbered `FR-#` list. Be explicit and unambiguous. Use application/user-action phrasing (e.g., "The system must allow users to...").

## 4. Functional Requirements

- FR-1: The app must store a `priority` field on every task with allowed values `high`, `medium`, or `low`, defaulting to `medium`.
- FR-2: The app must display a colored priority badge on each task cell (red for high, yellow for medium, gray for low).
- FR-3: The app must allow users to change a task's priority from the task edit screen via a picker/selector.
- FR-4: The app must allow users to filter the task list by priority level (All / High / Medium / Low).
- FR-5: The app must sort tasks by priority within each section (high first, then medium, then low).
- FR-6: The app must handle invalid priority values from the API gracefully without crashing.

> **[Guidance]** What this feature will NOT include. Critical for managing scope.

## 5. Non-Goals (Out of Scope)

- No priority-based push notifications or reminders
- No automatic priority assignment based on due date or other heuristics
- No priority inheritance for subtasks
- No drag-and-drop reordering within a priority group
- No widget or watch complication for priority views

> **[Guidance]** Address each of these categories where relevant:
> - UI/UX layout and visual design (per platform)
> - Component/view architecture (new vs. reused components)
> - State management approach
> - API integration patterns
> - Reuse of existing components or utilities

## 6. Design Considerations

- **UI/UX layout**:
  - Priority badge appears to the left of the task title in each cell for maximum visibility
  - Filter control sits in the navigation bar or list header, consistent with existing filter patterns
  - Priority picker on the edit screen uses platform-native controls (iOS: segmented control or picker; Android: chip group or exposed dropdown)
- **Component/view architecture**:
  - New `PriorityBadge` view (presentational, receives `priority` property, renders colored badge)
  - New `PriorityFilter` component (manages filter state, emits selected priority)
  - Reuse existing design system badge/tag components where available
  - Reuse existing picker/selector components for the edit screen
- **State management**:
  - Priority filter state stored in the view model (persisted to UserDefaults / SharedPreferences if needed)
  - Task priority managed via existing data layer (repository pattern, React Query, etc.) — no new store needed
- **API integration**:
  - Extend existing task DTO / response model to include `priority` field
  - Extend existing `PATCH` request to accept `priority` in the request body
  - Use existing networking utilities and error handling patterns

> **[Guidance]** Address each of these categories where relevant:
> - Known constraints or dependencies
> - Integration points with existing systems
> - Performance requirements

## 7. Technical Considerations

- **Data migration**: The new `priority` field needs a default value so existing records are backfilled automatically; no manual data migration required.
- **Type safety**: Define a `Priority` enum in the shared/domain layer and reference it from both networking and presentation code.
- **Accessibility**: Priority badges must include accessibility labels (e.g., "High priority") for VoiceOver / TalkBack.
- **Backwards compatibility**: The app must handle API responses that omit the `priority` field, defaulting to `.medium`.
- **Offline support**: Priority changes made offline must sync when connectivity is restored.

> **[Guidance]** Quantitative, outcome-based metrics. Examples: "Reduce time to complete X by 50%", "Increase conversion rate by 10%".

## 8. Success Metrics

- Users can assign or change a task's priority in under 2 taps
- High-priority tasks are immediately visible at the top of each section without manual sorting
- Task list screen launch time does not regress by more than 50 ms after adding priority filtering
- Zero build errors and zero lint warnings across all target platforms after all stories are merged

> **[Guidance]** Questions that must be answered to finalize scope/design/rollout. Keep existing questions across phases. Append additional questions discovered during refinement at the bottom (e.g., "Added in Phase 2", "Added in Phase 3").

## 9. Open Questions

- Should priority affect the default sort order within each section, or only when the user explicitly sorts?
- Should we add haptic feedback when changing priority (iOS)?
- Do we need an "urgent" level above "high" for time-sensitive tasks?
- Should the priority filter persist across app launches?
