# Hyperworker

A collection of Claude Code skills that turn Claude into a multi-agent team lead. Define a feature with a PRD, break it into tasks, then let a team of autonomous agents execute them in parallel — respecting dependency order, logging progress, and enforcing quality gates.

## Get Started

Pick the stack that matches your project:

| Stack | README | Description |
|---|---|---|
| **Kubernetes** | [kubernetes/README.md](kubernetes/README.md) | Kubernetes / DevOps — Flux suspend/resume, manifest validation, cluster safety rails |
| **TypeScript** | [typescript/README.md](typescript/README.md) | TypeScript / Node.js — type checking, linting, test suite quality gates |

Each stack README is self-contained with prerequisites, installation, and usage instructions.

## Repository Structure

```
hyperworker/
├── kubernetes/                        # Kubernetes / DevOps stack
│   ├── .claude/
│   │   └── skills/
│   │       ├── hyperworker/SKILL.md   # Multi-agent team lead (K8s variant)
│   │       ├── prd/SKILL.md           # PRD generator (K8s examples)
│   │       ├── prd-tasks/SKILL.md     # PRD-to-tasks converter (K8s variant)
│   │       ├── refactor-agents-md/SKILL.md
│   │       ├── refactor-claude-md/SKILL.md
│   │       └── refactor-skills-md/SKILL.md
│   ├── settings.json                  # Project-level Claude settings template
│   └── user-settings.json             # User-level Claude settings template
│
├── typescript/                        # TypeScript / Node.js stack
│   ├── .claude/
│   │   └── skills/
│   │       ├── hyperworker/SKILL.md   # Multi-agent team lead (TS variant)
│   │       ├── prd/SKILL.md           # PRD generator (TS examples)
│   │       ├── prd-tasks/SKILL.md     # PRD-to-tasks converter (TS variant)
│   │       ├── refactor-agents-md/SKILL.md
│   │       ├── refactor-claude-md/SKILL.md
│   │       └── refactor-skills-md/SKILL.md
│   ├── settings.json                  # Project-level Claude settings template
│   └── user-settings.json             # User-level Claude settings template
│
├── README.md                          # This file
└── user-settings.json                 # Shared user-level settings template
```

## How It Works

Hyperworker follows a **technology-agnostic** three-phase workflow:

```
/prd  →  /prd-tasks  →  /hyperworker
```

1. **`/prd`** — Generate a structured Product Requirements Document from a feature description. Claude asks clarifying questions across multiple refinement phases and produces a complete PRD with developer stories, functional requirements, design considerations, and open questions.

2. **`/prd-tasks`** — Convert the PRD into a dependency-ordered task list using Claude's built-in `TaskCreate` tool. Each developer story becomes a right-sized task (completable in one agent context window). Dependencies are encoded so agents don't start work that depends on unfinished prerequisites. Functional requirements are cross-checked for full traceability.

3. **`/hyperworker`** — The core skill. Claude acts as a Team Lead: it reads the task DAG, visualizes the dependency topology, creates an agent team, and dispatches up to 4 parallel agents to work through tasks. Each agent gets a focused prompt, implements its assigned story, runs quality checks, commits, and logs progress. The Team Lead supervises completion and assigns the next available work.

The workflow is the same regardless of technology stack. The skills within each technology directory provide stack-specific agent behavior, quality gates, and examples.

| Workflow Phase | Kubernetes Variant | TypeScript Variant |
|---|---|---|
| `/prd` | [kubernetes/.claude/skills/prd/](kubernetes/.claude/skills/prd/SKILL.md) | [typescript/.claude/skills/prd/](typescript/.claude/skills/prd/SKILL.md) |
| `/prd-tasks` | [kubernetes/.claude/skills/prd-tasks/](kubernetes/.claude/skills/prd-tasks/SKILL.md) | [typescript/.claude/skills/prd-tasks/](typescript/.claude/skills/prd-tasks/SKILL.md) |
| `/hyperworker` | [kubernetes/.claude/skills/hyperworker/](kubernetes/.claude/skills/hyperworker/SKILL.md) | [typescript/.claude/skills/hyperworker/](typescript/.claude/skills/hyperworker/SKILL.md) |

### Agent Behavior

Each dispatched agent:

- Reads codebase patterns from `plans/progress.txt` before starting
- Implements only its assigned task
- Runs project quality checks (typecheck, lint, test)
- Commits with the format `[Story ID] - [Story Title]`
- Logs all work, file changes, and learnings to `plans/progress.txt`
- Updates `CLAUDE.md` files with reusable patterns discovered during implementation

See each stack's README for technology-specific agent behavior details.

## Included Skills

| Skill | Command | Purpose |
|---|---|---|
| **hyperworker** | `/hyperworker` | Multi-agent team lead — dispatches and supervises autonomous agents |
| **prd** | `/prd` | Generate a PRD from a feature description |
| **prd-tasks** | `/prd-tasks` | Convert a PRD into dependency-ordered tasks |
| **refactor-agents-md** | `/refactor-agents-md` | Refactor an AGENTS.md file for progressive disclosure |
| **refactor-claude-md** | `/refactor-claude-md` | Refactor a CLAUDE.md file for progressive disclosure |
| **refactor-skills-md** | `/refactor-skills-md` | Refactor a SKILL.md file for progressive disclosure |

The three refactor skills are identical across stacks. The hyperworker, prd, and prd-tasks skills have stack-specific variants.
