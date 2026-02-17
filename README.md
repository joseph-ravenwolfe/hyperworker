# Hyperworker

A collection of Claude Code skills that turn Claude into a multi-agent team lead. Define a feature with a PRD, break it into tasks, then let a team of autonomous agents execute them in parallel — respecting dependency order, logging progress, and enforcing quality gates.

## How It Works

Hyperworker follows a three-phase workflow:

```
/prd  →  /prd-tasks  →  /hyperworker
```

1. **`/prd`** — Generate a structured Product Requirements Document from a feature description. Claude asks clarifying questions across multiple refinement phases and produces a complete PRD with developer stories, functional requirements, design considerations, and open questions.

2. **`/prd-tasks`** — Convert the PRD into a dependency-ordered task list using Claude's built-in `TaskCreate` tool. Each developer story becomes a right-sized task (completable in one agent context window). Dependencies are encoded so agents don't start work that depends on unfinished prerequisites. Functional requirements are cross-checked for full traceability.

3. **`/hyperworker`** — The core skill. Claude acts as a Team Lead: it reads the task DAG, visualizes the dependency topology, creates an agent team, and dispatches up to 4 parallel agents to work through tasks. Each agent gets a focused prompt, implements its assigned story, runs quality checks, commits, and logs progress. The Team Lead supervises completion and assigns the next available work.

### Agent Behavior

Each dispatched agent:

- Reads codebase patterns from `plans/progress.txt` before starting
- Implements only its assigned task
- Runs project quality checks (typecheck, lint, test)
- Commits with the format `[Story ID] - [Story Title]`
- Logs all work, file changes, and learnings to `plans/progress.txt`
- Updates `CLAUDE.md` files with reusable patterns discovered during implementation
- For Kubernetes work: suspends Flux before changes, applies file-first manifests, validates, then resumes Flux — logging every cluster action for auditability

## Included Skills

| Skill | Command | Purpose |
|---|---|---|
| **hyperworker** | `/hyperworker` | Multi-agent team lead — dispatches and supervises autonomous agents |
| **prd** | `/prd` | Generate a PRD from a feature description |
| **prd-tasks** | `/prd-tasks` | Convert a PRD into dependency-ordered tasks |

## Installation

**Important:**
:warning: The `/plans` directory is used for generated task lists, logs, and work-in-progress. **Be sure to add `/plans` to your `.gitignore`** to avoid committing transient agent artifacts or sensitive data.

### 1. Copy skills into your project

```bash
# From your project root
cp -r /path/to/hyperworker/.claude/skills/* .claude/skills/
```

Or clone and copy:

```bash
git clone https://github.com/YOUR_ORG/hyperworker.git /tmp/hyperworker
cp -r /tmp/hyperworker/.claude/skills/* .claude/skills/
rm -rf /tmp/hyperworker
```

### 2. Copy project settings into your `.claude/settings.json`

Hyperworker requires specific project-level settings. Merge these into your existing `.claude/settings.json` (or create it):

```bash
# If you don't have a .claude/settings.json yet
cp /path/to/hyperworker/.claude/settings.json .claude/settings.json

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

## Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed
- `tmux` installed (used by `teammateMode` for agent pane management)
- The experimental agents/teams feature flag enabled (handled by the settings above)
