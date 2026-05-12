---
name: clean-skill
description: A skill that uses only SDK calls — no leaks
---

# Clean Skill

All planning state access goes through the SDK:
`gsd-sdk query state.json` returns project state.

No context blocks. No tool calls against the planning directory.
No shell commands targeting the planning directory.
