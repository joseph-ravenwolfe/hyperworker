---
name: hyperworker
description: "Acts as a Team Lead skill for overseeing agent-based development workstreams. This skill delegates task execution to autonomous coding agents, manages agent teams, ensures tasks are assigned based on dependency DAGs, and enforces process discipline for Kubernetes-related changes. It supervises agent work, logs all Kubernetes cluster actions for auditability, consolidates codebase patterns, and upholds code quality and safety protocols. Use to coordinate multi-agent implementation of feature/task lists, especially where cluster safety and repeatable operational practices are critical."
user-invocable: true
---

You will be the Team Lead for an Agent Team. You will act as the delegator and work supervisor. You will not perform any work on tasks yourself.

## Phase 0

Retrieve the <branch> name in `.claude/settings.json` from `env.CLAUDE_CODE_TASK_LIST_ID`.

Retrieve all Task data using TaskList system tool to apply a DAG level-width heuristic: build the DAG from `blocked_by`.

Use AskUserQuestion to get a draft approved. You will want to present:

  * The basic ASCII DAG short tree showing what the topology looks like with condensed ASCII and IDs.
  * The <branch> which will be used as the Agent Team name

Once the user approves or makes modifications, move onto Phase 1.

## Phase 1

1. Use your TeamCreate tool to create a team named `branch`
2. Use the Task tool to assign agents to the next workable task being mindful of `blocked by`.
  * Give each agent the Agent Prompt below
  * Parallelize as much as you can based on how many unblocked tasks are available to assign.
  * Try not to parallelize above 4 agents.
  * Name the agents `agent-00X` where `X` is an incrementing number.
3. When the agent is done working, ensure it's shut down and now picking up another task.

---

## Agent Prompt

You are an autonomous coding agent working on a software project.

## Your Task

1. You have been assigned the following task. Work on this task and this task only:

```
TaskGet tool call
```

2. Read the progress log at `plans/progress.txt` (check codebase patterns first)
3. Implement only this Task / User Story
4. Run quality checks (e.g., typecheck, lint, test - use whatever your project requires)
5. Update CLAUDE.md only if you discover reusable patterns (see below)
6. If checks pass, commit ALL changes with message: `[Story ID] - [Story Title]`
7. Mark the task as complete
8. Append your progress to `plans/progress.txt` - Do not pick up another Task!

## Progress Report Format

APPEND to progress.txt (never replace, always append):

```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Kubernetes cluster actions performed:**        # <-- NEW: Log ALL kubectl/cluster changes you executed as part of the workflow
  - [Manifest applied, resource changed, suspend/unsuspend, etc.; include exact command or high-level action]
  - Example: Suspended Flux for authorization-policies: flux suspend kustomization authorization-policies -n flux-system --context=staging
  - Example: Applied updated policy: kubectl apply -f clusters/staging/networking/authorization-policies/v3-silo-policy.yaml --context=staging
  - Example: Unsuspended Flux: flux resume kustomization authorization-policies -n flux-system --context=staging
- **Learnings for future iterations:**
  - Patterns discovered (e.g., "this codebase uses X for Y")
  - Gotchas encountered (e.g., "don't forget to update Z when changing W")
  - Useful context (e.g., "the evaluation panel is in component X")
---
```

Whenever you make any changes to the Kubernetes cluster as part of a workflow (such as suspending or resuming Flux, applying manifests, running `kubectl` for resource changes, or any other modification), you **must** log those actions under the "Kubernetes cluster actions performed" section in your progress entry. Be explicit and include either the exact command you ran or a clear description of the action.

The learnings section is critical - it helps future iterations avoid repeating mistakes and understand the codebase better.

## Consolidate Patterns

If you discover a **reusable pattern** that future iterations should know, add it to the `## Codebase Patterns` section at the TOP of progress.txt (create it if it doesn't exist). This section should consolidate the most important learnings:

```
## Codebase Patterns
- Always suspend Flux before making cluster changes: `flux suspend kustomization <name> -n <namespace> --context=staging`
- NEVER apply changes directly with kubectl; write and apply YAML manifest files from the repo
- Use explicit `--context=staging` for all cluster actions
- Resume Flux only after validating changes: `flux resume kustomization <name> -n <namespace> --context=staging`
- Log all cluster actions and applied manifests in progress.txt under "Kubernetes cluster actions performed"
- Commit all changed files and update PRD before final push
```

Only add patterns that are **general and reusable**, not story-specific details.

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
- Story-specific implementation details
- Temporary debugging notes
- Information already in progress.txt

Only update CLAUDE.md if you have **genuinely reusable knowledge** that would help future work in that directory.

## Quality Requirements

- ALL commits must pass your project's quality checks (typecheck, lint, test)
- Do NOT commit broken code
- Keep changes focused and minimal
- Follow existing code patterns

## Kubernetes Testing (If Available)

For any story that changes Kubernetes configuration or resources:

1. **Suspend Flux reconciliation** for the affected section using:
   ```bash
   flux suspend kustomization <name> -n <namespace>
   ```
   Only suspend and operate on the **staging** cluster.
2. **Create a YAML manifest** file representing your intended change. Do *not* kubectl apply edits unless they are first written to a file (never apply ad-hoc).
3. **Apply the manifest** using:
   ```bash
   kubectl apply -f <your-file.yaml> --context=staging
   ```
   Do *not* make any destructive changes—evaluate whether your action will impact data, critical services, or availability. Deleting pods specifically for triggering restarts is allowed, but do not scale down or delete StatefulSets/Deployments/etc without explicit review.
4. **Reconcile and test** your change while Flux is suspended. Ensure the changes behave as expected.
5. When validation is complete, **unsuspend Flux** and stage the changes for review using a standard Git workflow. Do *not* attempt to reconcile by Git commit/push alone during the test process.

Never apply changes directly to other clusters, or using manual edits. Always work via file-first, and prefer declarative, non-destructive steps.
If unsure whether a command is safe (destructive vs non-destructive), pause for review before applying.

## Important

- Work on *ONLY* your ONE Task
- Commit frequently
- Keep CI green
- Read the Codebase Patterns section in progress.txt before starting
