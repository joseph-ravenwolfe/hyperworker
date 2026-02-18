# Hyperworker — Kubernetes Stack

Kubernetes / DevOps variant of [Hyperworker](../README.md) — a collection of Claude Code skills that turn Claude into a multi-agent team lead.

## Included Skills

| Skill | Command | Purpose |
|---|---|---|
| **hyperworker** | `/hyperworker` | Multi-agent team lead — dispatches and supervises autonomous agents |
| **prd** | `/prd` | Generate a PRD from a feature description |
| **prd-tasks** | `/prd-tasks` | Convert a PRD into dependency-ordered tasks |
| **refactor-agents-md** | `/refactor-agents-md` | Refactor an AGENTS.md file for progressive disclosure |
| **refactor-claude-md** | `/refactor-claude-md` | Refactor a CLAUDE.md file for progressive disclosure |
| **refactor-skills-md** | `/refactor-skills-md` | Refactor a SKILL.md file for progressive disclosure |

## Agent Behavior

Each dispatched agent:

- Reads codebase patterns from `plans/progress.txt` before starting
- Implements only its assigned task
- Runs project quality checks (typecheck, lint, test)
- Commits with the format `[Story ID] - [Story Title]`
- Logs all work, file changes, and learnings to `plans/progress.txt`
- Updates `CLAUDE.md` files with reusable patterns discovered during implementation

**Kubernetes-specific behavior:**
- Suspends Flux before changes, applies file-first manifests, validates, then resumes Flux — logging every cluster action for auditability

## Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed
- `tmux` installed (used by `teammateMode` for agent pane management)
- The experimental agents/teams feature flag enabled (handled by the settings below)
- `kubectl` configured with cluster access
- `flux` CLI installed (for Flux-managed clusters)

## Installation

> **Important:** The `/plans` directory is used for generated task lists, logs, and work-in-progress. **Add `/plans` to your `.gitignore`** to avoid committing transient agent artifacts or sensitive data.

### 1. Copy skills into your project

```bash
# From your project root
cp -r /path/to/hyperworker/kubernetes/.claude/skills/* .claude/skills/
```

Or clone and copy:

```bash
git clone https://github.com/YOUR_ORG/hyperworker.git /tmp/hyperworker
cp -r /tmp/hyperworker/kubernetes/.claude/skills/* .claude/skills/
rm -rf /tmp/hyperworker
```

### 2. Copy project settings into your `.claude/settings.json`

Merge the bundled `settings.json` into your existing `.claude/settings.json` (or create it):

```bash
cp /path/to/hyperworker/kubernetes/settings.json .claude/settings.json
```

If you already have a `.claude/settings.json`, manually merge the required keys. The important project settings are:

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
cat /path/to/hyperworker/kubernetes/user-settings.json

# If ~/.claude/settings.json doesn't exist:
mkdir -p ~/.claude
cp /path/to/hyperworker/kubernetes/user-settings.json ~/.claude/settings.json

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

### 4. Add `/plans` to `.gitignore`

```bash
echo '/plans' >> .gitignore
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
