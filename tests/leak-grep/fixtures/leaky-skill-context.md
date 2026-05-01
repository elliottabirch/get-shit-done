---
name: leaky-skill-context
description: A skill that loads .planning/STATE.md at activation via <context>
<context>
@.planning/STATE.md
@.planning/ROADMAP.md
</context>
---

# Leaky Skill (frontmatter <context> @ leak)

This skill triggers Claude Code to read .planning/ files at activation,
bypassing any runtime adapter.
