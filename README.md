# Hyperworker

A Claude Code plugin that turns Claude into a multi-agent team lead. Define a feature with a PRD, break it into tasks, dispatch parallel autonomous agents to execute them, run an adversarial Codex review across the assembled diff, and verify the integrated feature against the PRD's acceptance criteria.

## Workflow

```
/prd  →  /hyperworker
```

1. **`/prd`** — Generate a structured Product Requirements Document. The skill drafts from your description + the codebase, then conducts a design interview to resolve open questions before saving the final PRD.

2. **`/hyperworker`** — Convert the PRD into a task DAG, dispatch parallel agents to implement them, run a Codex adversarial review, and verify against acceptance criteria. The skill walks through seven phases:

   | Phase | What it does |
   |---|---|
   | 0 — Identify the PRD | Pick the PRD file and derive the branch slug |
   | 1 — Create the Agent Team | `TeamCreate` with the branch as team name |
   | 2 — Convert PRD to Tasks | `TaskCreate` per Task; cross-check against Functional Requirements |
   | 3 — Set Task Dependencies | Build the DAG via `TaskUpdate(blocks, is_blocked_by)` |
   | 4 — Dispatch Agents | Spawn agents for every unblocked Task; fan out as wide as the DAG allows |
   | 5 — Code Review (Codex) | Adversarial review via the `codex` plugin; route blocking findings back to Phase 4 |
   | 6 — Acceptance Testing | Verify every FR + Success Metric in the real environment |

## Installation

Hyperworker is a Claude Code plugin. It declares a hard dependency on OpenAI's [`codex` plugin](https://github.com/openai/codex-plugin-cc) (used for Phase 5's adversarial review), which Claude Code installs automatically.

```bash
# Add the marketplace
/plugin marketplace add joseph-ravenwolfe/hyperworker

# Install (codex is pulled in automatically as a dependency)
/plugin install hyperworker@hyperworker
```

Once installed, the skills are available as:

- `/hyperworker:prd`
- `/hyperworker:hyperworker`
- `/hyperworker:refactor-md`

The bare commands `/prd`, `/hyperworker`, and `/refactor-md` also work when no other plugin claims them.

### Codex plugin requirement

Phase 5 invokes `/codex:adversarial-review` from the `codex` plugin. The dependency is declared in `.claude-plugin/plugin.json`, so Claude Code resolves and installs it for you. If the codex plugin is missing or disabled, Phase 5 will fail; you can either install it or skip Phase 5 (acceptance testing in Phase 6 still runs).

You also need the Codex CLI itself installed and authenticated locally — see [`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc) for setup.

## Migrating from older versions

Earlier versions of Hyperworker shipped as a `npx hyperworker-install` script that copied per-stack skill files into your project's `.claude/skills/`. That workflow is gone — Hyperworker is now a Claude Code plugin.

If you have a project set up with the old installer:

1. **Remove the old skill copies** from `.claude/skills/hyperworker/`, `.claude/skills/prd/`, `.claude/skills/prd-tasks/`, and `.claude/skills/refactor-md/`. The plugin owns these now.
2. **Install the plugin** via the steps above.
3. **`prd-tasks` is gone.** Its responsibilities (PRD → `TaskCreate` calls + DAG dependencies + FR cross-check) are now folded into `/hyperworker:hyperworker` Phases 2 and 3.
4. **Per-stack variants are gone.** The single skill set is technology-agnostic and works for Kubernetes, TypeScript, Terraform, and any other stack.
5. **PRD task format changed.** Tasks now use **Description / Approach / Acceptance criteria** instead of the older "How to complete this task" prescriptive checklists. Older PRDs still process, but you may want to regenerate them with the new format for cleaner agent handoffs.

## Skills included

| Skill | Command | Purpose |
|---|---|---|
| **prd** | `/hyperworker:prd` | Generate a PRD from a feature description; conducts a design interview |
| **hyperworker** | `/hyperworker:hyperworker` | Multi-agent team lead — phases 0 through 6 |
| **refactor-md** | `/hyperworker:refactor-md` | Refactor a `CLAUDE.md`, `AGENTS.md`, or `SKILL.md` for progressive disclosure |

## Repository structure

```
hyperworker/
├── .claude-plugin/
│   ├── plugin.json          # Manifest + dependency on codex plugin
│   └── marketplace.json     # Single-plugin marketplace listing
├── skills/
│   ├── prd/SKILL.md
│   ├── hyperworker/SKILL.md
│   └── refactor-md/SKILL.md
├── plans/                   # User's working directory for in-flight PRDs (gitignored)
└── README.md
```

## Agent behavior

Each dispatched agent in Phase 4:

- Reads codebase patterns from `plans/progress.txt` before starting
- Implements only its assigned Task
- Runs project quality checks (typecheck, lint, tests — whatever the project requires)
- Commits with `[Task ID] - [Task Title]` once checks pass
- Logs work, file changes, and reusable learnings to `plans/progress.txt`
- Updates nearby `CLAUDE.md` files with patterns worth preserving

See `skills/hyperworker/SKILL.md` for the full agent prompt.

## Why a Codex review in Phase 5

Cross-model review catches blind spots that same-model review misses. OpenAI's own `codex-plugin-cc` is built around exactly this pattern — Claude implements, Codex adversarially reviews. Hyperworker's Phase 5 wires up `/codex:adversarial-review` with the PRD injected as focus context, then auto-routes `critical`/`high` findings (confidence ≥ 0.7) back to Phase 4 as new fix Tasks. Lower-severity findings surface as advisory.

The triage thresholds are tunable inside `skills/hyperworker/SKILL.md` if Codex is too noisy or too lenient on your stack.
