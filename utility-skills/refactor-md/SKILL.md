---
name: refactor-md
description: Refactor a CLAUDE.md, AGENTS.md, or SKILL.md file to follow progressive disclosure principles
---

I want you to refactor my markdown file to follow progressive disclosure principles.

**File type detection:** Determine the target file type using this precedence:
1. If an explicit file type argument is provided (e.g., `CLAUDE.md`, `AGENTS.md`, `SKILL.md`), use that
2. Otherwise, match the file's basename against known patterns: `CLAUDE.md`, `AGENTS.md`, `SKILL.md`
3. If the basename does not match any known pattern, fall back to generic refactoring using only the shared base essentials criteria below

Follow these steps:

1. **Find contradictions**: Identify any instructions that conflict with each other. For each contradiction, ask me which version I want to keep.

2. **Identify the essentials**: Extract only what belongs in the root file. Use the flat list below — each criterion is annotated with the file types it applies to:
   - One-sentence project or skill description *(all types)*
   - Package manager, if not npm *(CLAUDE.md, AGENTS.md)*
   - Non-standard build/typecheck commands *(CLAUDE.md, AGENTS.md)*
   - Anything truly relevant to every single task *(CLAUDE.md, AGENTS.md)*
   - Usage triggers or main invocation instructions *(SKILL.md)*
   - Absolutely critical configuration or requirements *(SKILL.md)*
   - Anything truly relevant to every invocation of the skill *(SKILL.md)*

3. **Group the rest**: Organize remaining instructions into logical categories (e.g., TypeScript conventions, testing patterns, API design, Git workflow). For each group, create a separate markdown file.

4. **Create the file structure**: Output:
   - A minimal root file with markdown links to the separate files
   - Each separate file with its relevant instructions
   - A suggested docs/ folder structure

5. **Flag for deletion**: Identify any instructions that are:
   - Redundant (the agent or skill already knows or does this by default)
   - Too vague to be actionable
   - Overly obvious (like "write clean code" or "follow best practices")
