/**
 * Query module entry point — factory and re-exports.
 *
 * The `createRegistry()` factory creates a fully-wired `QueryRegistry`
 * with all native handlers registered. New handlers are added here
 * as they are migrated from gsd-tools.cjs.
 *
 * @example
 * ```typescript
 * import { createRegistry } from './query/index.js';
 * import { createStorageAdapter } from './query/adapter-factory.js';
 *
 * const registry = createRegistry({ adapter: createStorageAdapter(projectDir) });
 * const result = await registry.dispatch('generate-slug', ['My Phase'], projectDir);
 * ```
 */

import { QueryRegistry } from './registry.js';
import { generateSlug, currentTimestamp } from './utils.js';
import { frontmatterGet } from './frontmatter.js';
import { configGet, configPath, resolveModel } from './config-query.js';
import { stateJson, stateGet, stateSnapshot } from './state.js';
import { stateProjectLoad } from './state-project-load.js';
import {
  STATE_COMMAND_ALIASES,
  VERIFY_COMMAND_ALIASES,
  INIT_COMMAND_ALIASES,
  PHASE_COMMAND_ALIASES,
  PHASES_COMMAND_ALIASES,
  VALIDATE_COMMAND_ALIASES,
  ROADMAP_COMMAND_ALIASES,
} from './command-aliases.generated.js';
import { QUERY_MUTATION_COMMAND_LIST } from './query-policy-capability.js';
import { findPhase, phasePlanIndex } from './phase.js';
import { phaseListPlans, phaseListArtifacts } from './phase-list-queries.js';
import { planTaskStructure } from './plan-task-structure.js';
import { requirementsExtractFromPlans } from './requirements-extract-from-plans.js';
import { roadmapAnalyze, roadmapGetPhase } from './roadmap.js';
import { progressJson } from './progress.js';
import { frontmatterSet, frontmatterMerge, frontmatterValidate } from './frontmatter-mutation.js';
import {
  stateUpdate, statePatch, stateBeginPhase, stateAdvancePlan,
  stateRecordMetric, stateUpdateProgress, stateAddDecision,
  stateAddBlocker, stateResolveBlocker, stateRecordSession,
  stateSignalWaiting, stateSignalResume, stateValidate, stateSync, statePrune,
  stateMilestoneSwitch, stateAddRoadmapEvolution,
} from './state-mutation.js';
import {
  configSet, configSetModelProfile, configNewProject, configEnsureSection,
} from './config-mutation.js';
import { commit, checkCommit } from './commit.js';
import { templateFill, templateSelect } from './template.js';
import { verifyPlanStructure, verifyPhaseCompleteness, verifyArtifacts, verifyCommits, verifyReferences, verifySummary, verifyPathExists } from './verify.js';
import { decisionsParse } from './decisions.js';
import { checkDecisionCoveragePlan, checkDecisionCoverageVerify } from './check-decision-coverage.js';
import { verifyKeyLinks, validateConsistency, validateHealth, validateAgents, validateContext } from './validate.js';
import {
  phaseAdd, phaseAddBatch, phaseInsert, phaseRemove, phaseComplete,
  phaseScaffold, phasesClear, phasesArchive,
  phasesList, phaseNextDecimal,
} from './phase-lifecycle.js';
import {
  initExecutePhase, initPlanPhase, initNewMilestone, initQuick,
  initResume, initVerifyWork, initPhaseOp, initTodos, initMilestoneOp,
  initMapCodebase, initNewWorkspace, initListWorkspaces, initRemoveWorkspace,
  initIngestDocs,
} from './init.js';
import { initNewProject, initProgress, initManager } from './init-complex.js';
import { agentSkills } from './skills.js';
import { requirementsMarkComplete, roadmapAnnotateDependencies } from './roadmap.js';
import { roadmapUpdatePlanProgress } from './roadmap-update-plan-progress.js';
import { statePlannedPhase } from './state-mutation.js';
import { verifySchemaDrift } from './verify.js';
// verifyCodebaseDrift intentionally not imported — see verify.ts:681 comment
// (ADR docs/adr/3524-cjs-sdk-hard-seam.md §3: CJS-only).
import {
  todoMatchPhase, statsJson, statsTable, progressBar, progressTable, listTodos, todoComplete,
} from './progress.js';
import { milestoneComplete } from './phase-lifecycle.js';
import { summaryExtract, historyDigest } from './summary.js';
import { commitToSubrepo } from './commit.js';
import {
  workstreamGet, workstreamList, workstreamCreate, workstreamSet, workstreamStatus,
  workstreamComplete, workstreamProgress,
} from './workstream.js';
import { docsInit } from './docs-init.js';
import { uatRenderCheckpoint, auditUat } from './uat.js';
import { websearch } from './websearch.js';
import {
  intelStatus, intelDiff, intelSnapshot, intelValidate, intelQuery,
  intelExtractExports, intelPatchMeta, intelUpdate,
} from './intel.js';
import {
  learningsCopy, learningsQuery, learningsListHandler, learningsPrune, learningsDelete,
  extractMessages, scanSessions, profileSample, profileQuestionnaire,
} from './profile.js';
import {
  writeProfile, generateClaudeProfile, generateDevPreferences, generateClaudeMd,
} from './profile-output.js';
import { skillManifest } from './skill-manifest.js';
import { auditOpen } from './audit-open.js';
import { detectCustomFiles } from './detect-custom-files.js';
import { commandsList } from './commands-list.js';
import { checkConfigGates } from './config-gates.js';
import { verifyFatSkills } from './verify-fat-skills.js';
import { checkAutoMode } from './check-auto-mode.js';
import { checkPhaseReady } from './phase-ready.js';
import { routeNextAction } from './route-next-action.js';
import { detectPhaseType } from './detect-phase-type.js';
import { checkCompletion } from './check-completion.js';
import { checkGates } from './check-gates.js';
import { checkVerificationStatus } from './check-verification-status.js';
import { checkShipReady } from './check-ship-ready.js';
import { codebasePut, codebaseGet, codebaseList } from './codebase-docs.js';
import { reportPut, reportGet, handoffPut, continueHerePut, forensicsPut, decisionsIndexGet } from './named-docs.js';
import { debugArchive } from './debug-session.js';
import { spikeGetManifest, spikeGetConventions, spikePutWrapUp, spikePutConventions, sketchGetManifest, sketchGetConventions, sketchPutWrapUp } from './spike-sketch.js';
import { threadAdd, seedAdd, todoAdd } from './thread-seed.js';
import { milestoneArchivePhases, phaseGetManifest, graphifyStore } from './milestone-ops.js';
import { tmpPut, tmpGet } from './tmp-docs.js';
import { nextCallCountGetHandler, nextCallCountIncrHandler } from './sidecar.js';
import {
  discussCheckpointPut, discussCheckpointGet, discussCheckpointDelete,
  discussQuestionsPut, discussQuestionsGet, discussQuestionsDelete,
} from './scratch.js';
import { GSDEventStream } from '../event-stream.js';
import type { StorageAdapter } from '../../../adapters/types.js';
import { createStorageAdapter } from './adapter-factory.js';
import {
  GSDEventType,
  type GSDEvent,
  type GSDStateMutationEvent,
  type GSDConfigMutationEvent,
  type GSDFrontmatterMutationEvent,
  type GSDGitCommitEvent,
  type GSDTemplateFillEvent,
} from '../types.js';
import type { QueryHandler, QueryResult } from './utils.js';

// ─── Re-exports ────────────────────────────────────────────────────────────

export type { QueryResult, QueryHandler } from './utils.js';
export { extractField } from './registry.js';
/** Same argv normalization as `gsd-sdk query` — use when calling `registry.dispatch()` with CLI-style `command` + `args`. */
export { normalizeQueryCommand } from './query-command-resolution-strategy.js';
export { buildRegistry, decorateRegistryMutations } from './registry-assembly.js';

// ─── Mutation commands set ────────────────────────────────────────────────

/**
 * Command names that perform durable writes (disk, git, or global profile store).
 * Used to wire event emission after successful dispatch. Both dotted and
 * space-delimited aliases must be listed when both exist.
 *
 * See QUERY-HANDLERS.md for semantics. Init composition handlers are omitted
 * (they emit JSON for workflows; agents perform writes).
 */
export const QUERY_MUTATION_COMMANDS = new Set<string>(QUERY_MUTATION_COMMAND_LIST);

// ─── Event builder ────────────────────────────────────────────────────────

/**
 * Build a mutation event based on the command prefix and result.
 *
 * @param correlationSessionId - Optional session correlation id (from {@link createRegistry})
 */
function buildMutationEvent(
  correlationSessionId: string,
  cmd: string,
  args: string[],
  result: QueryResult,
): GSDEvent {
  const base = {
    timestamp: new Date().toISOString(),
    sessionId: correlationSessionId,
  };

  if (cmd.startsWith('template.') || cmd.startsWith('template ')) {
    const data = result.data as Record<string, unknown> | null;
    return {
      ...base,
      type: GSDEventType.TemplateFill,
      templateType: (data?.template as string) ?? args[0] ?? '',
      path: (data?.path as string) ?? args[1] ?? '',
      created: (data?.created as boolean) ?? false,
    } as GSDTemplateFillEvent;
  }

  if (cmd === 'commit' || cmd === 'check-commit' || cmd === 'commit-to-subrepo') {
    const data = result.data as Record<string, unknown> | null;
    return {
      ...base,
      type: GSDEventType.GitCommit,
      hash: (data?.hash as string) ?? null,
      committed: (data?.committed as boolean) ?? false,
      reason: (data?.reason as string) ?? '',
    } as GSDGitCommitEvent;
  }

  if (cmd.startsWith('frontmatter.') || cmd.startsWith('frontmatter ')) {
    return {
      ...base,
      type: GSDEventType.FrontmatterMutation,
      command: cmd,
      file: args[0] ?? '',
      fields: args.slice(1),
      success: true,
    } as GSDFrontmatterMutationEvent;
  }

  if (cmd.startsWith('config-')) {
    return {
      ...base,
      type: GSDEventType.ConfigMutation,
      command: cmd,
      key: args[0] ?? '',
      success: true,
    } as GSDConfigMutationEvent;
  }

  if (cmd.startsWith('validate.') || cmd.startsWith('validate ')) {
    return {
      ...base,
      type: GSDEventType.ConfigMutation,
      command: cmd,
      key: args[0] ?? '',
      success: true,
    } as GSDConfigMutationEvent;
  }

  if (cmd.startsWith('phase.') || cmd.startsWith('phase ') || cmd.startsWith('phases.') || cmd.startsWith('phases ')) {
    return {
      ...base,
      type: GSDEventType.StateMutation,
      command: cmd,
      fields: args.slice(0, 2),
      success: true,
    } as GSDStateMutationEvent;
  }

  if (cmd.startsWith('state.') || cmd.startsWith('state ')) {
    return {
      ...base,
      type: GSDEventType.StateMutation,
      command: cmd,
      fields: args.slice(0, 2),
      success: true,
    } as GSDStateMutationEvent;
  }

  // roadmap, requirements, todo, milestone, workstream, intel, profile, learnings, docs-init
  return {
    ...base,
    type: GSDEventType.StateMutation,
    command: cmd,
    fields: args.slice(0, 2),
    success: true,
  } as GSDStateMutationEvent;
}

// ─── Factory ───────────────────────────────────────────────────────────────

/**
 * Create a fully-wired QueryRegistry with all native handlers registered.
 *
 * @param opts.adapter - Required StorageAdapter implementation (per D-2026-04-30-05 + D-07).
 *                       Phase 2 Plan 02-01 onwards: adapter-aware handlers register through a
 *                       closure wrapper that binds `adapter` as the first arg (Shape A from
 *                       Phase 2 D-10). Currently wired: `state.load` (Task 4),
 *                       `route.next-action` / `route next-action` (Task 5). Plans 02-02..04
 *                       add wrappers for the remaining read handlers as they migrate.
 *                       Non-adapter-aware handlers continue to register unchanged.
 * @param opts.eventStream - Optional event stream for mutation event emission
 * @param opts.correlationSessionId - Optional session id threaded into mutation-related events
 * @returns A QueryRegistry instance with all handlers registered
 */
export function createRegistry(opts?: {
  adapter?: StorageAdapter;
  eventStream?: GSDEventStream;
  correlationSessionId?: string;
}): QueryRegistry {
  const adapter = opts?.adapter ?? createStorageAdapter(process.cwd());
  const eventStream = opts?.eventStream;
  const correlationSessionId = opts?.correlationSessionId;
  // Phase 2 D-10 (Plan 02-01 onwards): adapter is consumed by per-handler
  // closure wrappers. Each adapter-aware handler is registered via a closure
  // that binds `adapter` as the first argument; non-adapter-aware handlers
  // register unchanged. Plans 2-4 add wrappers for additional handlers as
  // they migrate.
  const mutationSessionId = correlationSessionId ?? '';
  const registry = new QueryRegistry();

  registry.register('generate-slug', generateSlug);
  registry.register('current-timestamp', currentTimestamp);
  registry.register('frontmatter.get', frontmatterGet);
  registry.register('config-get', configGet);
  registry.register('config-path', configPath);
  registry.register('resolve-model', resolveModel);
  const stateHandlers: Record<string, QueryHandler> = {
    // Phase 2 Plan 02-01 Task 4: stateProjectLoad migrated to adapter-as-first-arg
    // signature. Closure wrapper threads the adapter from createRegistry's opts.
    'state.load': (args, projectDir, ws) => stateProjectLoad(adapter, args, projectDir, ws),
    'state.json': (args, projectDir, ws) => stateJson(adapter, args, projectDir, ws),
    'state.get': (args, projectDir, ws) => stateGet(adapter, args, projectDir, ws),
    'state.update': stateUpdate,
    'state.patch': statePatch,
    'state.begin-phase': stateBeginPhase,
    'state.advance-plan': stateAdvancePlan,
    'state.record-metric': stateRecordMetric,
    'state.update-progress': stateUpdateProgress,
    'state.add-decision': stateAddDecision,
    'state.add-blocker': stateAddBlocker,
    'state.resolve-blocker': stateResolveBlocker,
    'state.record-session': stateRecordSession,
    'state.signal-waiting': stateSignalWaiting,
    'state.signal-resume': stateSignalResume,
    'state.planned-phase': statePlannedPhase,
    'state.validate': stateValidate,
    'state.sync': stateSync,
    'state.prune': statePrune,
    'state.milestone-switch': stateMilestoneSwitch,
    'state.add-roadmap-evolution': stateAddRoadmapEvolution,
  };

  for (const entry of STATE_COMMAND_ALIASES) {
    const handler = stateHandlers[entry.canonical];
    if (!handler) continue;
    registry.register(entry.canonical, handler);
    for (const alias of entry.aliases) {
      registry.register(alias, handler);
    }
  }

  registry.register('state-snapshot', (args, projectDir, ws) => stateSnapshot(adapter, args, projectDir, ws));
  // Phase 2 Plan 02-02 Task 1: findPhase + phasePlanIndex migrated to adapter-as-first-arg.
  registry.register('find-phase', (args, projectDir, ws) =>
    findPhase(adapter, args, projectDir, ws),
  );
  registry.register('phase-plan-index', (args, projectDir, ws) =>
    phasePlanIndex(adapter, args, projectDir, ws),
  );
  registry.register('plan.task-structure', planTaskStructure);
  registry.register('plan task-structure', planTaskStructure);
  registry.register('requirements.extract-from-plans', requirementsExtractFromPlans);
  registry.register('requirements extract-from-plans', requirementsExtractFromPlans);
  // Phase 2 Plan 02-02 Task 1: roadmapAnalyze + roadmapGetPhase migrated to adapter-as-first-arg.
  // roadmapUpdatePlanProgress and roadmapAnnotateDependencies retain QueryHandler shape (write
  // handlers; Phase 3 will fully migrate them).
  const roadmapHandlers: Record<string, QueryHandler> = {
    'roadmap.analyze': (args, projectDir, ws) => roadmapAnalyze(adapter, args, projectDir, ws),
    'roadmap.get-phase': (args, projectDir, ws) => roadmapGetPhase(adapter, args, projectDir, ws),
    'roadmap.update-plan-progress': roadmapUpdatePlanProgress,
    'roadmap.annotate-dependencies': roadmapAnnotateDependencies,
  };

  for (const entry of ROADMAP_COMMAND_ALIASES) {
    const handler = roadmapHandlers[entry.canonical];
    if (!handler) continue;
    registry.register(entry.canonical, handler);
    for (const alias of entry.aliases) {
      registry.register(alias, handler);
    }
  }

  // Phase 2 Plan 02-02 Task 2: progressJson migrated to adapter-as-first-arg.
  registry.register('progress', (args, projectDir, ws) =>
    progressJson(adapter, args, projectDir, ws),
  );
  registry.register('progress.json', (args, projectDir, ws) =>
    progressJson(adapter, args, projectDir, ws),
  );

  // Frontmatter mutation handlers
  registry.register('frontmatter.set', frontmatterSet);
  registry.register('frontmatter.merge', frontmatterMerge);
  registry.register('frontmatter.validate', frontmatterValidate);
  registry.register('frontmatter validate', frontmatterValidate);

  // Config mutation handlers
  registry.register('config-set', configSet);
  registry.register('config-set-model-profile', configSetModelProfile);
  registry.register('config-new-project', configNewProject);
  registry.register('config-ensure-section', configEnsureSection);

  // Git commit handlers
  registry.register('commit', commit);
  registry.register('check-commit', checkCommit);

  // Template handlers
  registry.register('template.fill', templateFill);
  registry.register('template.select', templateSelect);
  registry.register('template select', templateSelect);

  const verifyHandlers: Record<string, QueryHandler> = {
    'verify.plan-structure': verifyPlanStructure,
    'verify.phase-completeness': verifyPhaseCompleteness,
    'verify.references': verifyReferences,
    'verify.commits': verifyCommits,
    'verify.artifacts': verifyArtifacts,
    'verify.key-links': verifyKeyLinks,
    'verify.schema-drift': verifySchemaDrift,
    // verify.codebase-drift handled directly by CJS router (see verify.ts:681)
    'verify.fat-skills': verifyFatSkills,
  };

  for (const entry of VERIFY_COMMAND_ALIASES) {
    const handler = verifyHandlers[entry.canonical];
    if (!handler) continue;
    registry.register(entry.canonical, handler);
    for (const alias of entry.aliases) {
      registry.register(alias, handler);
    }
  }

  registry.register('verify-summary', verifySummary);
  registry.register('verify.summary', verifySummary);
  registry.register('verify summary', verifySummary);
  registry.register('verify-path-exists', verifyPathExists);
  registry.register('verify.path-exists', verifyPathExists);
  registry.register('verify path-exists', verifyPathExists);

  // Decision coverage gates (issue #2492)
  registry.register('decisions.parse', decisionsParse);
  registry.register('decisions parse', decisionsParse);
  registry.register('check.decision-coverage-plan', checkDecisionCoveragePlan);
  registry.register('check decision-coverage-plan', checkDecisionCoveragePlan);
  registry.register('check.decision-coverage-verify', checkDecisionCoverageVerify);
  registry.register('check decision-coverage-verify', checkDecisionCoverageVerify);
  const validateHandlers: Record<string, QueryHandler> = {
    'validate.consistency': validateConsistency,
    'validate.health': validateHealth,
    'validate.agents': validateAgents,
    'validate.context': validateContext,
  };

  for (const entry of VALIDATE_COMMAND_ALIASES) {
    const handler = validateHandlers[entry.canonical];
    if (!handler) continue;
    registry.register(entry.canonical, handler);
    for (const alias of entry.aliases) {
      registry.register(alias, handler);
    }
  }

  // Decision routing (SDK-only — no `gsd-tools.cjs` mirror yet; see QUERY-HANDLERS.md)
  registry.register('check.config-gates', checkConfigGates);
  registry.register('check config-gates', checkConfigGates);
  registry.register('check.auto-mode', checkAutoMode);
  registry.register('check auto-mode', checkAutoMode);
  // Phase 2 Plan 02-02 Task 1: checkPhaseReady migrated to adapter-as-first-arg.
  registry.register('check.phase-ready', (args, projectDir, ws) =>
    checkPhaseReady(adapter, args, projectDir, ws),
  );
  registry.register('check phase-ready', (args, projectDir, ws) =>
    checkPhaseReady(adapter, args, projectDir, ws),
  );
  // Phase 2 Plan 02-01 Task 5: routeNextAction migrated to adapter-as-first-arg
  // signature. Closure wrapper threads the adapter from createRegistry's opts.
  registry.register('route.next-action', (args, projectDir, ws) =>
    routeNextAction(adapter, args, projectDir, ws),
  );
  registry.register('route next-action', (args, projectDir, ws) =>
    routeNextAction(adapter, args, projectDir, ws),
  );
  // Phase 2 Plan 02-02 Task 1: detectPhaseType migrated to adapter-as-first-arg.
  registry.register('detect.phase-type', (args, projectDir, ws) =>
    detectPhaseType(adapter, args, projectDir, ws),
  );
  registry.register('detect phase-type', (args, projectDir, ws) =>
    detectPhaseType(adapter, args, projectDir, ws),
  );
  registry.register('check.completion', checkCompletion);
  registry.register('check completion', checkCompletion);
  registry.register('check.gates', checkGates);
  registry.register('check gates', checkGates);
  // Phase 2 Plan 02-02 Task 1: checkVerificationStatus migrated to adapter-as-first-arg.
  registry.register('check.verification-status', (args, projectDir, ws) =>
    checkVerificationStatus(adapter, args, projectDir, ws),
  );
  registry.register('check verification-status', (args, projectDir, ws) =>
    checkVerificationStatus(adapter, args, projectDir, ws),
  );
  registry.register('check.ship-ready', checkShipReady);
  registry.register('check ship-ready', checkShipReady);

  const phaseHandlers: Record<string, QueryHandler> = {
    'phase.list-plans': phaseListPlans,
    'phase.list-artifacts': phaseListArtifacts,
    'phase.add': phaseAdd,
    'phase.add-batch': phaseAddBatch,
    'phase.insert': phaseInsert,
    'phase.remove': phaseRemove,
    'phase.complete': phaseComplete,
    'phase.scaffold': phaseScaffold,
    'phase.next-decimal': (args, projectDir, ws) => phaseNextDecimal(adapter, args, projectDir, ws),
  };

  for (const entry of PHASE_COMMAND_ALIASES) {
    const handler = phaseHandlers[entry.canonical];
    if (!handler) continue;
    registry.register(entry.canonical, handler);
    for (const alias of entry.aliases) {
      registry.register(alias, handler);
    }
  }

  const phasesHandlers: Record<string, QueryHandler> = {
    'phases.list': (args, projectDir, ws) => phasesList(adapter, args, projectDir, ws),
    'phases.clear': phasesClear,
    'phases.archive': (args, projectDir, ws) => phasesArchive(adapter, args, projectDir, ws),
  };

  for (const entry of PHASES_COMMAND_ALIASES) {
    const handler = phasesHandlers[entry.canonical];
    if (!handler) continue;
    registry.register(entry.canonical, handler);
    for (const alias of entry.aliases) {
      registry.register(alias, handler);
    }
  }

  // Phase 2 Plan 02-04 Task 1: 14 init.ts bundlers migrated to
  // adapter-as-first-arg signature (Shape A). Closure wrappers thread the
  // adapter from createRegistry's opts. External bundle shape is
  // byte-identical to pre-migration baselines — see
  // tests/conformance/init-bundlers.test.ts (OQ-09 + ROADMAP SC#2).
  //
  // Each canonical key is registered explicitly (literal
  // `registry.register('init.X', ...)`) so the MED-2 count-based wrapper
  // assertion can grep them deterministically; the alias loop below registers
  // the space-form aliases ('init execute-phase', etc.) for each canonical
  // entry by reusing the same closure wrapper.
  registry.register('init.execute-phase', (args, projectDir, ws) => initExecutePhase(adapter, args, projectDir, ws));
  registry.register('init.plan-phase', (args, projectDir, ws) => initPlanPhase(adapter, args, projectDir, ws));
  registry.register('init.new-milestone', (args, projectDir, ws) => initNewMilestone(adapter, args, projectDir, ws));
  registry.register('init.quick', (args, projectDir, ws) => initQuick(adapter, args, projectDir, ws));
  registry.register('init.ingest-docs', (args, projectDir, ws) => initIngestDocs(adapter, args, projectDir, ws));
  registry.register('init.resume', (args, projectDir, ws) => initResume(adapter, args, projectDir, ws));
  registry.register('init.verify-work', (args, projectDir, ws) => initVerifyWork(adapter, args, projectDir, ws));
  registry.register('init.phase-op', (args, projectDir, ws) => initPhaseOp(adapter, args, projectDir, ws));
  registry.register('init.todos', (args, projectDir, ws) => initTodos(adapter, args, projectDir, ws));
  registry.register('init.milestone-op', (args, projectDir, ws) => initMilestoneOp(adapter, args, projectDir, ws));
  registry.register('init.map-codebase', (args, projectDir, ws) => initMapCodebase(adapter, args, projectDir, ws));
  registry.register('init.new-workspace', (args, projectDir, ws) => initNewWorkspace(adapter, args, projectDir, ws));
  registry.register('init.list-workspaces', (args, projectDir, ws) => initListWorkspaces(adapter, args, projectDir, ws));
  registry.register('init.remove-workspace', (args, projectDir, ws) => initRemoveWorkspace(adapter, args, projectDir, ws));
  registry.register('init.new-project', (args, projectDir, ws) => initNewProject(adapter, args, projectDir, ws));
  registry.register('init.progress', (args, projectDir, ws) => initProgress(adapter, args, projectDir, ws));
  registry.register('init.manager', (args, projectDir, ws) => initManager(adapter, args, projectDir, ws));

  // Wire space-form aliases (e.g. 'init execute-phase') to the same closure
  // wrappers via the alias manifest.
  for (const entry of INIT_COMMAND_ALIASES) {
    const handler = registry.getHandler(entry.canonical);
    if (!handler) continue;
    for (const alias of entry.aliases) {
      registry.register(alias, handler);
    }
  }

  // Domain-specific handlers (fully implemented)
  registry.register('agent-skills', agentSkills);
  registry.register('requirements.mark-complete', requirementsMarkComplete);
  registry.register('requirements mark-complete', requirementsMarkComplete);
  registry.register('todo.match-phase', todoMatchPhase);
  registry.register('todo match-phase', todoMatchPhase);
  registry.register('list-todos', listTodos);
  registry.register('list.todos', listTodos);
  registry.register('todo.complete', todoComplete);
  registry.register('todo complete', todoComplete);
  registry.register('milestone.complete', milestoneComplete);
  registry.register('milestone complete', milestoneComplete);
  // Phase 2 Plan 02-03 Task 1: summaryExtract + historyDigest migrated to
  // adapter-as-first-arg signature. Closure wrappers thread the adapter from
  // createRegistry's opts. All three aliases preserved.
  registry.register('summary.extract', (args, projectDir, ws) =>
    summaryExtract(adapter, args, projectDir, ws),
  );
  registry.register('summary extract', (args, projectDir, ws) =>
    summaryExtract(adapter, args, projectDir, ws),
  );
  registry.register('summary-extract', (args, projectDir, ws) =>
    summaryExtract(adapter, args, projectDir, ws),
  );
  registry.register('history.digest', (args, projectDir, ws) =>
    historyDigest(adapter, args, projectDir, ws),
  );
  registry.register('history digest', (args, projectDir, ws) =>
    historyDigest(adapter, args, projectDir, ws),
  );
  registry.register('history-digest', (args, projectDir, ws) =>
    historyDigest(adapter, args, projectDir, ws),
  );
  registry.register('stats', statsJson);
  registry.register('stats.json', statsJson);
  registry.register('stats json', statsJson);
  registry.register('stats.table', statsTable);
  registry.register('stats table', statsTable);
  registry.register('commit-to-subrepo', commitToSubrepo);
  registry.register('progress.bar', progressBar);
  registry.register('progress bar', progressBar);
  registry.register('progress.table', progressTable);
  registry.register('progress table', progressTable);
  registry.register('workstream.get', workstreamGet);
  registry.register('workstream get', workstreamGet);
  registry.register('workstream.list', workstreamList);
  registry.register('workstream list', workstreamList);
  registry.register('workstream.create', workstreamCreate);
  registry.register('workstream create', workstreamCreate);
  registry.register('workstream.set', workstreamSet);
  registry.register('workstream set', workstreamSet);
  registry.register('workstream.status', workstreamStatus);
  registry.register('workstream status', workstreamStatus);
  registry.register('workstream.complete', workstreamComplete);
  registry.register('workstream complete', workstreamComplete);
  registry.register('workstream.progress', workstreamProgress);
  registry.register('workstream progress', workstreamProgress);
  // Phase 2 Plan 02-03 Task 2: docsInit migrated to adapter-as-first-arg
  // signature. Closure wrapper threads the adapter from createRegistry's opts.
  registry.register('docs-init', (args, projectDir, ws) =>
    docsInit(adapter, args, projectDir, ws),
  );
  registry.register('docs.init', (args, projectDir, ws) =>
    docsInit(adapter, args, projectDir, ws),
  );
  registry.register('websearch', websearch);
  registry.register('learnings.copy', learningsCopy);
  registry.register('learnings copy', learningsCopy);
  registry.register('learnings.query', learningsQuery);
  registry.register('learnings query', learningsQuery);
  registry.register('learnings.list', learningsListHandler);
  registry.register('learnings list', learningsListHandler);
  registry.register('learnings.prune', learningsPrune);
  registry.register('learnings prune', learningsPrune);
  registry.register('learnings.delete', learningsDelete);
  registry.register('learnings delete', learningsDelete);
  registry.register('skill-manifest', skillManifest);
  registry.register('skill manifest', skillManifest);
  // Phase 2 Plan 02-02 Task 2: auditOpen migrated to adapter-as-first-arg.
  registry.register('audit-open', (args, projectDir, ws) =>
    auditOpen(adapter, args, projectDir, ws),
  );
  registry.register('audit open', (args, projectDir, ws) =>
    auditOpen(adapter, args, projectDir, ws),
  );
  registry.register('detect-custom-files', detectCustomFiles);
  registry.register('commands', commandsList);
  registry.register('extract-messages', extractMessages);
  registry.register('extract.messages', extractMessages);
  // Phase 2 Plan 02-03 Task 1: auditUat + uatRenderCheckpoint migrated to
  // adapter-as-first-arg signature. Closure wrappers thread the adapter from
  // createRegistry's opts. `audit.uat` dotted form added alongside the
  // hyphenated `audit-uat` to align with the Plan-3 canonical key naming
  // (alias parity with `summary.extract` / `summary-extract`).
  registry.register('audit-uat', (args, projectDir, ws) =>
    auditUat(adapter, args, projectDir, ws),
  );
  registry.register('audit.uat', (args, projectDir, ws) =>
    auditUat(adapter, args, projectDir, ws),
  );
  registry.register('audit uat', (args, projectDir, ws) =>
    auditUat(adapter, args, projectDir, ws),
  );
  registry.register('uat.render-checkpoint', (args, projectDir, ws) =>
    uatRenderCheckpoint(adapter, args, projectDir, ws),
  );
  registry.register('uat render-checkpoint', (args, projectDir, ws) =>
    uatRenderCheckpoint(adapter, args, projectDir, ws),
  );
  // Phase 2 Plan 02-03 Task 2: intel handlers migrated to adapter-as-first-arg
  // signature. Closure wrappers thread the adapter from createRegistry's opts.
  // Read paths route through adapter; write paths inside the handlers stay
  // direct fs per D-14 (Phase 3 territory).
  registry.register('intel.diff', (args, projectDir, ws) =>
    intelDiff(adapter, args, projectDir, ws),
  );
  registry.register('intel diff', (args, projectDir, ws) =>
    intelDiff(adapter, args, projectDir, ws),
  );
  registry.register('intel.snapshot', (args, projectDir, ws) =>
    intelSnapshot(adapter, args, projectDir, ws),
  );
  registry.register('intel snapshot', (args, projectDir, ws) =>
    intelSnapshot(adapter, args, projectDir, ws),
  );
  registry.register('intel.validate', (args, projectDir, ws) =>
    intelValidate(adapter, args, projectDir, ws),
  );
  registry.register('intel validate', (args, projectDir, ws) =>
    intelValidate(adapter, args, projectDir, ws),
  );
  registry.register('intel.status', (args, projectDir, ws) =>
    intelStatus(adapter, args, projectDir, ws),
  );
  registry.register('intel status', (args, projectDir, ws) =>
    intelStatus(adapter, args, projectDir, ws),
  );
  registry.register('intel.query', (args, projectDir, ws) =>
    intelQuery(adapter, args, projectDir, ws),
  );
  registry.register('intel query', (args, projectDir, ws) =>
    intelQuery(adapter, args, projectDir, ws),
  );
  registry.register('intel.extract-exports', (args, projectDir, ws) =>
    intelExtractExports(adapter, args, projectDir, ws),
  );
  registry.register('intel extract-exports', (args, projectDir, ws) =>
    intelExtractExports(adapter, args, projectDir, ws),
  );
  registry.register('intel.patch-meta', (args, projectDir, ws) =>
    intelPatchMeta(adapter, args, projectDir, ws),
  );
  registry.register('intel patch-meta', (args, projectDir, ws) =>
    intelPatchMeta(adapter, args, projectDir, ws),
  );
  registry.register('intel.update', (args, projectDir, ws) =>
    intelUpdate(adapter, args, projectDir, ws),
  );
  registry.register('intel update', (args, projectDir, ws) =>
    intelUpdate(adapter, args, projectDir, ws),
  );
  registry.register('generate-claude-profile', generateClaudeProfile);
  registry.register('generate-dev-preferences', generateDevPreferences);
  registry.register('write-profile', writeProfile);
  registry.register('profile-questionnaire', profileQuestionnaire);
  registry.register('profile-sample', profileSample);
  registry.register('scan-sessions', scanSessions);
  registry.register('generate-claude-md', generateClaudeMd);

  // Phase 4 Plan 01: New domain query verbs for workflow leak elimination.
  // Codebase docs (covers map-codebase 7 leaks, new-project 1, scout-codebase 1)
  registry.register('codebase.put', (args, projectDir, ws) => codebasePut(args, projectDir, ws));
  registry.register('codebase.get', (args, projectDir, ws) => codebaseGet(args, projectDir, ws));
  registry.register('codebase.list', (args, projectDir, ws) => codebaseList(args, projectDir, ws));
  // Named docs (covers session-report, milestone-summary, forensics, inbox, pause-work, discuss-phase)
  registry.register('report.put', (args, projectDir, ws) => reportPut(args, projectDir, ws));
  registry.register('report.get', (args, projectDir, ws) => reportGet(args, projectDir, ws));
  registry.register('handoff.put', (args, projectDir, ws) => handoffPut(args, projectDir, ws));
  registry.register('continue-here.put', (args, projectDir, ws) => continueHerePut(args, projectDir, ws));
  registry.register('forensics.put', (args, projectDir, ws) => forensicsPut(args, projectDir, ws));
  registry.register('decisions-index.get', (args, projectDir, ws) => decisionsIndexGet(args, projectDir, ws));
  // Debug session (covers execute-phase debug archive, gsd-debugger 3 leaks)
  registry.register('debug.archive', (args, projectDir, ws) => debugArchive(args, projectDir, ws));
  // Spike/sketch (covers spike 3, spike-wrap-up 3, sketch 2, sketch-wrap-up 1)
  registry.register('spike.get-manifest', (args, projectDir, ws) => spikeGetManifest(args, projectDir, ws));
  registry.register('spike.get-conventions', (args, projectDir, ws) => spikeGetConventions(args, projectDir, ws));
  registry.register('spike.put-wrap-up', (args, projectDir, ws) => spikePutWrapUp(args, projectDir, ws));
  registry.register('spike.put-conventions', (args, projectDir, ws) => spikePutConventions(args, projectDir, ws));
  registry.register('sketch.get-manifest', (args, projectDir, ws) => sketchGetManifest(args, projectDir, ws));
  registry.register('sketch.get-conventions', (args, projectDir, ws) => sketchGetConventions(args, projectDir, ws));
  registry.register('sketch.put-wrap-up', (args, projectDir, ws) => sketchPutWrapUp(args, projectDir, ws));
  // Thread/seed/todo (covers thread 1, plant-seed 1, add-todo 1)
  registry.register('thread.add', (args, projectDir, ws) => threadAdd(args, projectDir, ws));
  registry.register('seed.add', (args, projectDir, ws) => seedAdd(args, projectDir, ws));
  registry.register('todo.add', (args, projectDir, ws) => todoAdd(args, projectDir, ws));
  // Milestone ops (covers cleanup 1, complete-milestone 1, undo 1, graphify 3-4)
  registry.register('milestone.archive-phases', (args, projectDir, ws) => milestoneArchivePhases(args, projectDir, ws));
  registry.register('phase.get-manifest', (args, projectDir, ws) => phaseGetManifest(args, projectDir, ws));
  registry.register('graphify.store', (args, projectDir, ws) => graphifyStore(args, projectDir, ws));
  // Tmp docs (covers docs-update 4 leaks)
  registry.register('tmp.put', (args, projectDir, ws) => tmpPut(args, projectDir, ws));
  registry.register('tmp.get', (args, projectDir, ws) => tmpGet(args, projectDir, ws));
  // Sidecar verbs (Phase 5 D-19, D-21 — PRIMITIVES-08)
  registry.register('next-call-count.get', (args, projectDir, ws) => nextCallCountGetHandler(args, projectDir, ws));
  registry.register('next-call-count.incr', (args, projectDir, ws) => nextCallCountIncrHandler(args, projectDir, ws));
  // Scratch verbs (Phase 5 D-20 — PRIMITIVES-09)
  registry.register('discuss.checkpoint.put', (args, projectDir, ws) => discussCheckpointPut(args, projectDir, ws));
  registry.register('discuss.checkpoint.get', (args, projectDir, ws) => discussCheckpointGet(args, projectDir, ws));
  registry.register('discuss.checkpoint.delete', (args, projectDir, ws) => discussCheckpointDelete(args, projectDir, ws));
  registry.register('discuss.questions.put', (args, projectDir, ws) => discussQuestionsPut(args, projectDir, ws));
  registry.register('discuss.questions.get', (args, projectDir, ws) => discussQuestionsGet(args, projectDir, ws));
  registry.register('discuss.questions.delete', (args, projectDir, ws) => discussQuestionsDelete(args, projectDir, ws));

  // Wire event emission for mutation commands
  if (eventStream) {
    for (const cmd of QUERY_MUTATION_COMMANDS) {
      const original = registry.getHandler(cmd);
      if (original) {
        registry.register(cmd, async (args: string[], projectDir: string) => {
          const result = await original(args, projectDir);
          try {
            const event = buildMutationEvent(mutationSessionId, cmd, args, result);
            eventStream.emitEvent(event);
          } catch {
            // T-11-12: Event emission is fire-and-forget; never block mutation success
          }
          return result;
        });
      }
    }
  }

  // Phase 4 stub registrations: verbs referenced by rewritten workflows/agents
  const stubHandler: QueryHandler = async () => ({ data: { error: 'stub — implementation pending' } });
  registry.register('debug.append-knowledge', stubHandler);
  registry.register('debug.create', stubHandler);
  registry.register('debug.get-resolved', stubHandler);
  registry.register('debug.list-active', stubHandler);
  registry.register('graphify.exists', stubHandler);
  registry.register('milestone.get-roadmap', stubHandler);
  registry.register('milestone.list-archives', stubHandler);
  registry.register('phase.get-summary', stubHandler);
  registry.register('phase.has-context', stubHandler);
  registry.register('phase.list-contexts', stubHandler);
  registry.register('phase.list-dirs', stubHandler);
  registry.register('phase.list-learnings', stubHandler);
  registry.register('phase.list-summaries', stubHandler);
  registry.register('phase.list-uat-sessions', stubHandler);
  registry.register('phase.list-verifications', stubHandler);
  registry.register('phase.put-doc', stubHandler);
  registry.register('phase.put-uat', stubHandler);
  registry.register('project.get', stubHandler);
  registry.register('report.list', stubHandler);
  registry.register('requirements.get', stubHandler);
  registry.register('roadmap', stubHandler);
  registry.register('roadmap.restore-snapshot', stubHandler);
  registry.register('seed.ensure-dir', stubHandler);
  registry.register('seed.next-id', stubHandler);
  registry.register('sketch.ensure-dirs', stubHandler);
  registry.register('sketch.last-id', stubHandler);
  registry.register('spike.get-readme', stubHandler);
  registry.register('state.add-graduation-backlog', stubHandler);
  registry.register('state.detect-active-context', stubHandler);
  registry.register('state.list-files', stubHandler);
  registry.register('state.record-quick-task', stubHandler);
  registry.register('state.restore-snapshot', stubHandler);
  registry.register('thread.list', stubHandler);
  registry.register('tmp.ensure-dir', stubHandler);
  registry.register('todo.ensure-dirs', stubHandler);
  registry.register('agent-tracking.check-interrupted', stubHandler);
  registry.register('agent-tracking.complete', stubHandler);
  registry.register('agent-tracking.init', stubHandler);
  registry.register('agent-tracking.spawn', stubHandler);
  registry.register('codebase-docs.list', stubHandler);
  registry.register('debug-session.list', stubHandler);
  registry.register('milestone-ops.archive-phases', stubHandler);
  registry.register('milestone-ops.check-roadmap', stubHandler);
  registry.register('milestone-ops.latest-audit', stubHandler);
  registry.register('named-doc.get', stubHandler);
  registry.register('phase.count-plans', stubHandler);
  registry.register('phase.count-summaries', stubHandler);
  registry.register('phase.create-dir', stubHandler);
  registry.register('phase.get-plan', stubHandler);
  registry.register('phase.get-plans', stubHandler);
  registry.register('phase.list-backlog', stubHandler);
  registry.register('state-project-load', stubHandler);
  registry.register('thread-seed.list-seeds', stubHandler);
  registry.register('todo.list-pending', stubHandler);
  registry.register('workspace.ensure-dir', stubHandler);
  registry.register('workspace.file-exists', stubHandler);
  registry.register('workspace.find-dir', stubHandler);
  registry.register('workspace.list-dir', stubHandler);
  registry.register('workspace.list-handoffs', stubHandler);
  registry.register('debug-session.count-active', stubHandler);
  registry.register('phase.count-uats', stubHandler);
  registry.register('named-doc.list', stubHandler);
  registry.register('workspace.get-handoff', stubHandler);
  registry.register('workspace.list-continue-here', stubHandler);
  registry.register('codebase-docs.exists', stubHandler);
  registry.register('config-query', stubHandler);
  registry.register('phase.get-summaries', stubHandler);

  return registry;
}
