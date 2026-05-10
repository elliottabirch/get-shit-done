/**
 * Next slash-command suggestion for `/gsd-next`-style routing (`route.next-action`).
 *
 * Deterministic routing from STATE.md, ROADMAP, and phase directories.
 * See `.planning/research/decision-routing-audit.md` §3.1 and `get-shit-done/workflows/next.md`.
 * Phase 2 Plan 02-01 Task 5 (D-12, D-10): the canonical migrated reference
 * handler. Adapter-as-first-arg signature; every fs read routes through the
 * adapter; workstream paths use `planningRelativePath`. Plans 02-02..04
 * follow this exact recipe for the remaining read handlers.
 */

import {
  normalizePhaseName,
  comparePhaseNum,
  planningRelativePath,
} from './helpers.js';
import { stateJson } from './state.js';
import { roadmapAnalyze } from './roadmap.js';
import { findPhase } from './phase.js';
import { nextCallCountGet } from './sidecar.js';
 * Strip the leading `.planning/` segment from a planning-relative directory
 * path returned by `findPhase`. The adapter is rooted at .planning/, so its
 * relative inputs must NOT include the leading prefix.
 * Handles workstream-prefixed dirs unchanged (the workstream segment lives
 * under .planning/workstreams/<ws>/, so once .planning/ is stripped the
 * remaining `workstreams/<ws>/...` is already adapter-resolvable).
function toAdapterDir(planningRelDir: string): string {
  if (planningRelDir.startsWith('.planning/')) {
    return planningRelDir.slice('.planning/'.length);
  }
  return planningRelDir;
}
async function readConsecutiveCallCount(
  adapter: StorageAdapter,
  workstream: string | undefined,
): Promise<number> {
  // D-21: path literal centralized in sdk/src/query/sidecar.ts.
  return nextCallCountGet(adapter, workstream);
/** Unresolved FAIL rows in phase VERIFICATION.md (lightweight gate). */
async function hasUnresolvedVerificationFails(
  phaseRelDir: string,
): Promise<boolean> {
  const refs = await adapter.listCollection(phaseRelDir);
  if (refs.length === 0) return false;
  const vf = refs.find(r => r.name === 'VERIFICATION.md' || r.name.endsWith('-VERIFICATION.md'));
  if (!vf) return false;
  const content = await adapter.getRecord(vf.path);
  if (content === null) return false;
  const lines = content.split('\n');
  for (const line of lines) {
    if (/\|\s*FAIL\s*\|/i.test(line) && !/override/i.test(line)) return true;
  return false;
async function verificationPassed(
  return /status:\s*passed/i.test(content);
export const routeNextAction = async (
  _args: string[],
  projectDir: string,
  workstream?: string,
): Promise<QueryResult> => {
  const continueHere = await adapter.exists(
    planningRelativePath(workstream, '.continue-here.md'),
  );
  const sj = await stateJson(adapter, [], projectDir, workstream);
  const sjd = sj.data as Record<string, unknown>;
  if (sjd.error) {
    return {
      data: {
        command: '/gsd-new-project',
        args: '',
        reason: 'No STATE.md — initialize a GSD project first',
        current_phase: null,
        phase_name: null,
        gates: {
          continue_here: continueHere,
          error_state: false,
          unresolved_verification: false,
          consecutive_calls: 0,
        },
        context: {},
      },
    };
  const status = String(sjd.status ?? '');
  const errorState = /\b(error|failed)\b/i.test(status);
  const pausedAt = sjd.paused_at ? String(sjd.paused_at) : null;
  let currentPhase = sjd.current_phase ? String(sjd.current_phase) : null;
  const phaseName = sjd.current_phase_name ? String(sjd.current_phase_name) : null;
  const consecutiveCalls = await readConsecutiveCallCount(adapter, workstream);
  const ra = await roadmapAnalyze(adapter, [], projectDir, workstream);
  const raData = ra.data as { phases?: Array<Record<string, unknown>> };
  const phases = raData.phases ?? [];
  const phasesRel = planningRelativePath(workstream, 'phases');
  const phaseEntries = await adapter.listCollection(phasesRel);
  let dirCount = 0;
  for (const ref of phaseEntries) {
    const st = await adapter.stat(ref.path);
    if (st !== null && st.kind === 'dir') dirCount += 1;
  let unresolvedVerification = false;
  if (currentPhase) {
    const fp = await findPhase(adapter, [currentPhase], projectDir, workstream);
    const fd = fp.data as Record<string, unknown>;
    if (fd.found && fd.directory) {
      unresolvedVerification = await hasUnresolvedVerificationFails(
        adapter,
        toAdapterDir(fd.directory as string),
      );
    }
  const gates = {
    continue_here: continueHere,
    error_state: errorState,
    unresolved_verification: unresolvedVerification,
    consecutive_calls: consecutiveCalls,
  };
  const buildContext = async (cp: string | null) => {
    if (!cp) {
      return {
        has_context: false,
        has_research: false,
        has_plans: false,
        plan_count: 0,
        summary_count: 0,
        has_verification: false,
        paused_at: pausedAt,
        uat_gaps: 0,
      };
    const fp = await findPhase(adapter, [cp], projectDir, workstream);
    const d = fp.data as Record<string, unknown>;
    const plans = (d.plans as string[]) ?? [];
    const summaries = (d.summaries as string[]) ?? [];
      has_context: Boolean(d.has_context),
      has_research: Boolean(d.has_research),
      has_plans: plans.length > 0,
      plan_count: plans.length,
      summary_count: summaries.length,
      has_verification: Boolean(d.has_verification),
      paused_at: pausedAt,
      uat_gaps: 0,
  if (pausedAt) {
    const ctx = await buildContext(currentPhase);
        command: '/gsd-resume-work',
        reason: 'Paused — resume work before other routing',
        current_phase: currentPhase,
        phase_name: phaseName,
        gates,
        context: { ...ctx, paused_at: pausedAt },
  if (continueHere || errorState || unresolvedVerification) {
        command: '',
        reason: continueHere
          ? 'Blocked: .planning/.continue-here.md exists'
          : errorState
            ? 'Blocked: STATE.md status is error or failed'
            : 'Blocked: unresolved VERIFICATION FAIL items',
        context: ctx,
  // Route 1 — ROADMAP lists phases but no phase directories
  if (phases.length > 0 && dirCount === 0) {
    const first = String(phases[0].number);
    const ctx = await buildContext(first);
        command: '/gsd-discuss-phase',
        args: first,
        reason: 'ROADMAP has phases but no phase directories on disk yet',
        current_phase: first,
        phase_name: String(phases[0].name ?? ''),
  if (!currentPhase && phases.length > 0) {
    currentPhase = String(phases[0].number);
  if (!currentPhase) {
    const ctx = await buildContext(null);
        reason: 'No current phase in STATE.md and no roadmap phases',
  const fp = await findPhase(adapter, [currentPhase], projectDir, workstream);
  const pd = fp.data as Record<string, unknown>;
  const found = Boolean(pd.found);
  const cp = normalizePhaseName(currentPhase);
  const displayName = (pd.phase_name as string) || phaseName || '';
  const sorted = [...phases].sort((a, b) =>
    comparePhaseNum(String(a.number), String(b.number)),
  if (!found) {
        args: cp,
        reason: 'Phase directory not found — start with discuss',
        phase_name: displayName,
  const plans = (pd.plans as string[]) ?? [];
  const incomplete = (pd.incomplete_plans as string[]) ?? [];
  const hasContext = Boolean(pd.has_context);
  const hasResearch = Boolean(pd.has_research);
  const phaseRelDir = pd.directory ? toAdapterDir(pd.directory as string) : '';
  // Route 2
  if (!hasContext && !hasResearch) {
        reason: 'No CONTEXT.md or RESEARCH.md for this phase',
  // Route 3
  if (plans.length === 0) {
        command: '/gsd-plan-phase',
        reason: 'Context exists but no PLAN.md files',
  // Route 4
  if (incomplete.length > 0) {
        command: '/gsd-execute-phase',
        reason: `${incomplete.length} plan(s) still need SUMMARY.md`,
  // Summaries match plans — verification / advance
  const verPassed = phaseRelDir ? await verificationPassed(adapter, phaseRelDir) : false;
  const hasVerFile = Boolean(pd.has_verification);
  if (!hasVerFile || !verPassed) {
        command: '/gsd-verify-work',
        reason: 'All plans have summaries — run verification',
  // Phase verified — Route 6 vs 7 handled by allComplete above; find next incomplete phase
  const idx = sorted.findIndex(p => normalizePhaseName(String(p.number)) === cp);
  const next = idx >= 0 ? sorted.slice(idx + 1).find(p => p.disk_status !== 'complete' && !p.roadmap_complete) : null;
  if (next) {
    const nextNum = String(next.number);
    const ctx = await buildContext(nextNum);
        args: nextNum,
        reason: 'Current phase verified — advance to next phase',
        current_phase: nextNum,
        phase_name: String(next.name ?? ''),
  const ctx = await buildContext(currentPhase);
  return {
    data: {
      command: '/gsd-complete-milestone',
      args: '',
      reason: 'Verified phase with no further phases — complete milestone',
      current_phase: currentPhase,
      phase_name: displayName,
      gates,
      context: ctx,
    },
};
