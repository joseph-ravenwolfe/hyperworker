# Hyperworker Review Guidance

This guidance is appended to the standard codex adversarial-review prompt as additional focus context. It applies **in addition to** the codex review's normal attack surface (auth, data loss, races, rollback, etc.) — not in place of it.

## Scope

These rules apply only to **code files** — excluding YAML, JSON, TOML, HCL/Terraform, Helm/Kustomize manifests, lockfiles, generated code, and other declarative or machine-managed configuration.

## Structural rules

For code files in scope, treat the following as material findings worth surfacing:

### Module size

A module should be roughly **≤ 100 lines**, excluding blank lines and comment-only lines. Larger modules tend to conflate concerns and resist unit testing. When flagging an oversized module, name a concrete extraction (e.g., "split the cache layer starting at line 142 into its own module").

### Function size

A function should be roughly **≤ 10 statements** — executable statements, not raw lines. Long functions hide control flow and obscure edge cases. When flagging, quote the function name and the statement count.

### Cyclomatic complexity

Functions with deeply nested branches, large `switch`/`case` structures, or many early returns are findings. Prefer extraction, polymorphism, or table-driven dispatch over nested conditionals. Flag specific functions and lines; don't generalize.

### Unit test coverage

Every non-trivial function **added or materially modified** in this change should have at least one unit test for the happy path and at least one for a failure or edge case. If a code change adds or modifies a function and no accompanying test exists in the diff, flag it.

## Calibration

These are guidelines, not absolute thresholds. Use judgment for one-or-two-over cases — a 12-statement function or a 110-line module is not, on its own, a finding. **Systematic violations are findings**: a 400-line module, a 50-statement function, branching logic with no tests at all.

Apply the standard finding bar from the codex adversarial-review prompt — concrete, defensible, actionable, tied to a specific code location. Do **not** pad findings with style or naming feedback, low-value cleanup, or speculative concerns without evidence.
