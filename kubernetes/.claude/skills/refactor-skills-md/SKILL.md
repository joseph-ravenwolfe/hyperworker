---
name: refactor-skills-md
description: Refactor a SKILL.md file to follow progressive disclosure principles
---

I want you to refactor my SKILL.md file to follow progressive disclosure principles.

Follow these steps:

1. **Find contradictions:** Identify any instructions in the SKILL.md that conflict with each other. For each contradiction, ask me which version I want to keep.

2. **Identify the essentials:** Extract only what belongs in the root SKILL.md:
   - One-sentence skill description
   - Usage triggers or main invocation instructions
   - Absolutely critical configuration or requirements
   - Anything truly relevant to every invocation of the skill

3. **Group the rest:** Organize all other details and instructions into logical categories (e.g., prompt design guidelines, integration notes, edge cases, limitations). For each group, create a separate markdown file.

4. **Create the file structure:** Output:
   - A minimal root SKILL.md with markdown links to the separate files
   - Each separate file with its relevant instructions
   - A suggested docs/ folder structure if the splits are significant

5. **Flag for deletion:** Identify any instructions that are:
   - Redundant (the skill already performs this by default)
   - Too vague to be actionable
   - Overly obvious (like "follow best practices")
