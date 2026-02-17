# Hyperworker

A collection of Claude Code skills that turn Claude into a multi-agent team lead. Define a feature with a PRD, break it into tasks, then let a team of autonomous agents execute them in parallel — respecting dependency order, logging progress, and enforcing quality gates.

## Repository Structure

Hyperworker is organized by **technology stack**. Each directory contains the full set of skills tailored for that stack:

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
│   │       ├── hyperworker/           # (placeholder — coming soon)
│   │       ├── prd/                   # (placeholder — coming soon)
│   │       ├── prd-tasks/             # (placeholder — coming soon)
│   │       ├── refactor-agents-md/SKILL.md
│   │       ├── refactor-claude-md/SKILL.md
│   │       └── refactor-skills-md/SKILL.md
│
├── README.md                          # This file
└── user-settings.json                 # Shared user-level settings template
```

Pick the technology directory that matches your project and copy its skills into your repo (see [Installation](#installation)).

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
| `/prd` | [kubernetes/.claude/skills/prd/](kubernetes/.claude/skills/prd/SKILL.md) | [typescript/.claude/skills/prd/](typescript/.claude/skills/prd/) (coming soon) |
| `/prd-tasks` | [kubernetes/.claude/skills/prd-tasks/](kubernetes/.claude/skills/prd-tasks/SKILL.md) | [typescript/.claude/skills/prd-tasks/](typescript/.claude/skills/prd-tasks/) (coming soon) |
| `/hyperworker` | [kubernetes/.claude/skills/hyperworker/](kubernetes/.claude/skills/hyperworker/SKILL.md) | [typescript/.claude/skills/hyperworker/](typescript/.claude/skills/hyperworker/) (coming soon) |

### Agent Behavior

Each dispatched agent:

- Reads codebase patterns from `plans/progress.txt` before starting
- Implements only its assigned task
- Runs project quality checks (typecheck, lint, test)
- Commits with the format `[Story ID] - [Story Title]`
- Logs all work, file changes, and learnings to `plans/progress.txt`
- Updates `CLAUDE.md` files with reusable patterns discovered during implementation

**Kubernetes-specific behavior:**
- Suspends Flux before changes, applies file-first manifests, validates, then resumes Flux — logging every cluster action for auditability

**TypeScript-specific behavior** (coming soon):
- Runs `tsc --noEmit` for type checking, linter, and test suite as quality gates

## Included Skills

| Skill | Command | Kubernetes | TypeScript | Purpose |
|---|---|---|---|---|
| **hyperworker** | `/hyperworker` | Available | Coming soon | Multi-agent team lead — dispatches and supervises autonomous agents |
| **prd** | `/prd` | Available | Coming soon | Generate a PRD from a feature description |
| **prd-tasks** | `/prd-tasks` | Available | Coming soon | Convert a PRD into dependency-ordered tasks |
| **refactor-agents-md** | `/refactor-agents-md` | Available | Available | Refactor an AGENTS.md file for progressive disclosure |
| **refactor-claude-md** | `/refactor-claude-md` | Available | Available | Refactor a CLAUDE.md file for progressive disclosure |
| **refactor-skills-md** | `/refactor-skills-md` | Available | Available | Refactor a SKILL.md file for progressive disclosure |

## Prerequisites

**All stacks:**

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed
- `tmux` installed (used by `teammateMode` for agent pane management)
- The experimental agents/teams feature flag enabled (handled by the settings below)

**TypeScript stack (additional):**

- [Node.js](https://nodejs.org/) (LTS recommended)
- `npm` or `pnpm` package manager

**Kubernetes stack (additional):**

- `kubectl` configured with cluster access
- `flux` CLI installed (for Flux-managed clusters)

## Installation

> **Important:** The `/plans` directory is used for generated task lists, logs, and work-in-progress. **Add `/plans` to your `.gitignore`** to avoid committing transient agent artifacts or sensitive data.

### 1. Copy skills from the relevant technology directory

Choose the technology stack that matches your project and copy its skills:

**Kubernetes:**

```bash
# From your project root
cp -r /path/to/hyperworker/kubernetes/.claude/skills/* .claude/skills/
```

**TypeScript:**

```bash
# From your project root
cp -r /path/to/hyperworker/typescript/.claude/skills/* .claude/skills/
```

Or clone and copy:

```bash
git clone https://github.com/YOUR_ORG/hyperworker.git /tmp/hyperworker

# For Kubernetes projects:
cp -r /tmp/hyperworker/kubernetes/.claude/skills/* .claude/skills/

# For TypeScript projects:
cp -r /tmp/hyperworker/typescript/.claude/skills/* .claude/skills/

rm -rf /tmp/hyperworker
```

### 2. Copy project settings into your `.claude/settings.json`

Hyperworker requires specific project-level settings. Each technology directory includes a `settings.json` template. Merge these into your existing `.claude/settings.json` (or create it):

```bash
# Kubernetes — use the bundled template
cp /path/to/hyperworker/kubernetes/settings.json .claude/settings.json

# If you already have one, manually merge the required keys (see below)
```

The important project settings are:

```jsonc
{
  "env": {
    // Set by /prd — identifies the active task list / branch
    "CLAUDE_CODE_TASK_LIST_ID": "my-new-feature"
  },
  "permissions": {
    "allow": [
      // Important to be permissive for agent autonomy
    ],
    "deny": [
      // Safety rails: block production cluster access
      "Bash(gcloud*prod*)",
      "Bash(kubectl*--context*prod*)",
      "Bash(tsh*prod*)"
    ]
  }
}
```

### 3. Apply user-level settings

The `user-settings.json` file contains settings that should be applied to your **user-level** Claude configuration at `~/.claude/settings.json`:

```bash
# View what will be applied
cat /path/to/hyperworker/user-settings.json

# Merge into your user settings (create if it doesn't exist)
# If ~/.claude/settings.json doesn't exist:
mkdir -p ~/.claude
cp /path/to/hyperworker/user-settings.json ~/.claude/settings.json

# If it already exists, manually merge these keys:
```

The user settings enable:

```jsonc
{
  // Required: enables agent teams at the user level
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENTS_TEAMS": "1"
  },
  // Agents run in tmux panes for visibility
  "teammateMode": "tmux",
  // Full autonomy for agents
  "bypassPermissions": true,
  "skipDangerousModePermissionPrompt": true,
  "spinnerTipsEnabled": false
}
```

## Usage

```bash
# Start a Tmux Session for Agent panes
tmux

# Start Claude Code in your project
claude

# Step 1: Create a PRD
> /prd <task description>

# Step 2: Convert PRD to tasks
> /prd-tasks

# Step 3: Launch the agent team
> /hyperworker
```
