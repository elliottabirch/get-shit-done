---
name: clean-skill
description: A skill that uses only SDK calls — no leaks
---

# Clean Skill

All planning state access goes through the SDK:
`gsd-sdk query state.json` returns project state.

No <context> block. No Read/Write/Edit against .planning/.
No cp/mv/rm against .planning/.
