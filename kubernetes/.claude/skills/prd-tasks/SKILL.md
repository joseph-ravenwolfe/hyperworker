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
> - `<branch>` — the value of `CLAUDE_CODE_TASK_LIST_ID` from `.claude/settings.json` (set by the PRD skill), e.g. `OPS-1234-ambient-mesh`
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
OPS-1234-01: Verify Flux Kustomization chain for Ambient stack
```

### Description
Load the **entire story description and all acceptance criteria** into this field. Format it as a single block of text:

```
As a developer, I want Flux to reconcile Ambient Mode in a safe, ordered way so the mesh components come up reliably.

Acceptance Criteria:
- Running `flux get kustomization -n flux-system | grep -E 'istio-base|istiod|istio-cni|ztunnel'` verifies Kustomizations are present
- Running `flux describe kustomization istiod -n flux-system` verifies `dependsOn: istio-base` is set
- After reconciliation, `kubectl get pods -n istio-system` shows all Ambient Mode components running in Ready state
- Linting passes
```

---

## Story Size: The Number One Rule

**Each story must be completable in ONE autonomous agent iteration (one context window).**

Each iteration spawns a fresh agent instance with no memory of previous work. If a story is too big, the agent runs out of context before finishing and produces broken code.

### Right-sized stories (DevOps examples):
- Add a new variable to a Helm values.yaml and deploy change
- Update a Kubernetes deployment resource to use a new container image tag
- Update a Crossplane XRD (CompositeResourceDefinition) to add a new parameter
- Create a simple Prometheus alert rule for pod restarts

### Too big (split these):
- "Set up continuous deployment pipeline" – Split into: configure build job, set up artifact publishing, create deploy job, write deployment triggers
- "Migrate all workloads to Kubernetes" – Split into: migrate one service at a time, define manifests for each, test deployment individually
- "Overhaul monitoring and alerting" – Split into: add metrics exporter, configure alert rules, set up notification channels

**Rule of thumb:** If you cannot describe the change in 2-3 sentences, it is too big.

---

## Story Ordering: Dependencies First

Stories should be created in dependency order. Earlier stories must not depend on later ones.

**Correct order:**
1. Base resources and CRDs (e.g., `istio-base`, HelmRepository sources)
2. Control plane components that depend on base (e.g., `istiod`)
3. Data plane / node-level agents (e.g., `istio-cni`, then `ztunnel`)
4. Workload enrollment and policy (e.g., namespace labels, AuthorizationPolicies)

**Wrong order:**
1. Enroll namespaces into Ambient Mode (depends on ztunnel being deployed)
2. Deploy ztunnel DaemonSet

---

## Required Final Criteria

When creating tasks, append these criteria to every story's acceptance criteria:

- **All stories:** "Have objective and testable acceptance criteria, linting passes"
- **Stories with testable browser UI:** "Verify in browser using dev-browser skill"

If you need to write **new** stories (e.g., to cover an uncovered functional requirement), follow the acceptance criteria guidance in the PRD skill (`prd`) — criteria must be concrete, testable, and indicate the "how."

---

## Conversion Rules

1. **Each user story becomes one `TaskCreate` call**
2. **IDs**: Sequential `<ticket>-01`, `<ticket>-02`, etc. (zero-padded, two-digit) — used in the Subject
3. **Create tasks in dependency order** (base resources → control plane → data plane → enrollment/policy)
4. **Subject**: `<ticket>-##: [Story title]`
5. **Description**: Full story description + all acceptance criteria

---

## Functional Requirements Cross-Check

After extracting stories from the PRD, cross-check against the **Functional Requirements** section (if present):

1. Read every numbered FR (e.g., `OPSFR-1`, `OPSFR-2`, …) in the PRD
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
> "Deploy Istio Ambient Mode across clusters"

**Split into separate `TaskCreate` calls:**
1. OPS-1234-01: Verify Flux Kustomization chain for Ambient stack
2. OPS-1234-02: Enroll a workload namespace into Ambient Mode
3. OPS-1234-03: Add L4 AuthorizationPolicy for enrolled namespace
4. OPS-1234-04: Validate ztunnel interception with positive and negative tests
5. OPS-1234-05: Document rollout runbook and environment-specific overrides

Each is one focused change that can be completed and verified independently.

---

## Example

**Input PRD (abbreviated):**
```markdown
# Istio Ambient Mode Deployment

Deploy Istio Ambient Mode across clusters using Flux → Kustomize → HelmRelease.

## Developer Stories
- OPS-1234-01: Verify Flux Kustomization chain for Ambient stack
- OPS-1234-02: Enroll a workload namespace into Ambient Mode
- OPS-1234-03: Add L4 AuthorizationPolicy for enrolled namespace
- OPS-1234-04: Validate ztunnel interception with positive and negative tests

## Functional Requirements
- OPSFR-1: Flux Kustomizations with correct `dependsOn` ordering
- OPSFR-2: `clusters/base/istio/base/kustomization.yaml` includes HelmRepository and namespaces
- OPSFR-3: Ambient Mode enabled via Helm values (`values.profile: ambient`)
- OPSFR-4: Namespace enrollment via YAML with `istio.io/dataplane-mode: ambient`
- OPSFR-5: AuthorizationPolicies prefer L4 rules (`ports` + `principals`)
- OPSFR-6: Every policy change includes at least one negative test
```

**Output: `TaskCreate` calls**

**Task 1:**
- **Subject:** `OPS-1234-01: Verify Flux Kustomization chain for Ambient stack`
- **Description:**
  ```
  As a developer, I want Flux to reconcile Ambient Mode in a safe, ordered way so the mesh components come up reliably.

  Acceptance Criteria:
  - Suspend Flux before applying any changes
  - `flux get kustomization -n flux-system | grep -E 'istio-base|istiod|istio-cni|ztunnel'` shows all four Kustomizations present
  - `flux describe kustomization istiod -n flux-system` shows `dependsOn: istio-base`
  - `kubectl get pods -n istio-system` shows istiod, ztunnel, and istio-cni in Ready state
  - Validate before resuming Flux
  - Linting passes
  ```

*…remaining PRD stories (OPS-1234-02 through OPS-1234-04) each become their own `TaskCreate` call in the same way…*

*…OPSFR-5 was not covered by any existing story → new task OPS-1234-05 added…*

*…OPS-1234-02 was too large for one agent iteration → split into OPS-1234-05 and OPS-1234-06…*

**FR → Story traceability (listed after all tasks are created):**
| FR | Covered by |
|----|------------|
| OPSFR-1 | OPS-1234-01 |
| OPSFR-2 | OPS-1234-01 |
| … | … |

---

## Phase 2: Set Task Dependencies

**After all tasks have been created via `TaskCreate`, use the TaskUpdate tool to explicitly set the dependencies between tasks.**

### Step 1: Analyze and Build the Dependency Tree

1. Gather the full set of just-created tasks (their IDs and summaries).
2. For each task, determine which other tasks it "blocks" (must finish before another can start) and which it "is_blocked_by" (must wait for another to finish).
    - Use the intent, technical dependencies, and story ordering as described above (e.g., base → control plane → data plane → workload/policy).
    - Each task should be considered from the perspective of **a single autonomous stack-owning worker**: whoever claims a task owns all required layers, does their own code, tests, config, and QA—no handoffs.
    - Only add a dependency if the task's work **genuinely can't begin** before another is finished (i.e., if waiting is necessary for correctness or to avoid rework).
    - Prefer minimal dependency chains; only encode necessary gates, not organizational process or review steps.
    - Examples:
      - Base/CRD resource creation must block control-plane deployment, which must block policy/application of workload logic, etc.
      - QA, testing, or doc stories for a feature may not need to block implementation stories (the same worker does it all, so can typically parallelize).
      - A "Document rollout runbook" task might not need to wait for all coding stories to finish, unless the doc absolutely requires their outputs.

### Step 2: Update Task Records

1. For each task, use `TaskUpdate` to set the `blocks` and `is_blocked_by` fields based on the dependency tree from Step 1.
    - Example: If `OPS-1234-01` must finish before `OPS-1234-02` can begin, set `OPS-1234-01` to `blocks=["OPS-1234-02"]` and `OPS-1234-02` to `is_blocked_by=["OPS-1234-01"]`.
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
- [ ] Stories are ordered by dependency (base resources → control plane → data plane → enrollment/policy)
- [ ] Acceptance criteria are verifiable (not vague)
- [ ] No story depends on a later story
- [ ] Every functional requirement (`OPSFR-#`) from the PRD is traceable to at least one story's acceptance criteria
- [ ] FR → story traceability mapping is listed after tasks are created

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
