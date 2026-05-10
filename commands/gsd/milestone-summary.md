---
type: prompt
name: gsd:milestone-summary
description: Generate a comprehensive project summary from milestone artifacts for team onboarding and review
argument-hint: "[version]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
---

<objective>
Generate a structured milestone summary for team onboarding and project review. Reads completed milestone artifacts (ROADMAP, REQUIREMENTS, CONTEXT, SUMMARY, VERIFICATION files) and produces a human-friendly overview of what was built, how, and why.

Purpose: Enable new team members to understand a completed project by reading one document and asking follow-up questions.
Output: MILESTONE_SUMMARY written to `.planning/reports/`, presented inline, optional interactive Q&A.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/milestone-summary.md
</execution_context>

<project_context>
<!-- Injected by orchestrator via: gsd-sdk query state.load -->
<!-- Provides: ROADMAP.md, PROJECT.md, STATE.md, RETROSPECTIVE.md content -->
<!-- Milestone archives resolved by orchestrator at construction time -->
<!-- Phase artifacts (SUMMARY.md, VERIFICATION.md, CONTEXT.md, RESEARCH.md) via: gsd-sdk query history-digest -->
</project_context>

<context>
**User input:**
- Version: $ARGUMENTS (optional — defaults to current/latest milestone)
</context>

<process>
Execute end-to-end.
</process>

<success_criteria>
- Milestone version resolved (from args, STATE.md, or archive scan)
- All available artifacts read (ROADMAP, REQUIREMENTS, CONTEXT, SUMMARY, VERIFICATION, RESEARCH, RETROSPECTIVE)
- Summary document written to `.planning/reports/MILESTONE_SUMMARY-v{version}.md`
- All 7 sections generated (Overview, Architecture, Phases, Decisions, Requirements, Tech Debt, Getting Started)
- Summary presented inline to user
- Interactive Q&A offered
- STATE.md updated
</success_criteria>
