import type {
  Assertion,
  ContextFocus,
  ContextGraph,
  Diagnostic,
  EvidenceRecord,
  PublicRuntimeConfig,
  SiteSummary,
} from '../contracts';
import { isContextFocus } from '../contracts';
import type { ContextClient } from './client';

// The ONLY module allowed to import fixtures.
import sitesJson from '../mocks/sites.json';
import runtimeJson from '../mocks/runtime-config.json';
import ctx3956008 from '../mocks/context-3956008.json';
import ctx3501006 from '../mocks/context-3501006.json';
import ctx0161014 from '../mocks/context-0161014.json';

export type MockState =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'error'
  | 'stale'
  | 'conflict'
  | 'chat-offline';

const MOCK_STATES: MockState[] = [
  'ready',
  'loading',
  'empty',
  'error',
  'stale',
  'conflict',
  'chat-offline',
];

export function readMockState(search: string): MockState {
  const v = new URLSearchParams(search).get('mockState');
  return (MOCK_STATES as string[]).includes(v ?? '') ? (v as MockState) : 'ready';
}

const CONTEXTS: Record<string, ContextGraph> = {
  '3956008': ctx3956008 as unknown as ContextGraph,
  '3501006': ctx3501006 as unknown as ContextGraph,
  '0161014': ctx0161014 as unknown as ContextGraph,
};

const LATENCY_MS = 120;
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const never = <T,>() => new Promise<T>(() => undefined);

function notFound(message: string): never {
  throw { code: 'not_found', message, request_id: 'req-mock-0001' } satisfies {
    code: 'not_found';
    message: string;
    request_id: string;
  };
}

/** Focus filtering is deterministic and local: assertions keep their category
 * or `identity`; entities stay if the parcel or any remaining assertion
 * touches them. `overview` is unfiltered. */
export function filterByFocus(ctx: ContextGraph, focus: ContextFocus): ContextGraph {
  if (focus === 'overview') return { ...ctx, focus };
  const keepCat = new Set([focus, 'identity']);
  const assertions = ctx.assertions.filter((a) => keepCat.has(a.category));
  const keepIds = new Set<string>();
  for (const a of assertions) {
    keepIds.add(a.subject_id);
    if (a.object.kind === 'entity') keepIds.add(a.object.entity_id);
  }
  const entities = ctx.entities.filter((e) => e.kind === 'parcel' || keepIds.has(e.id));
  return { ...ctx, focus, assertions, entities };
}

function withConflict(ctx: ContextGraph): ContextGraph {
  const status = ctx.assertions.find((a) => a.predicate === 'status');
  if (!status || status.object.kind !== 'literal') return ctx;
  const twin: Assertion = {
    ...status,
    id: `${status.id}-conflicting`,
    object: {
      kind: 'literal',
      value: status.object.value === 'Construction' ? 'On Hold' : 'Withdrawn',
      datatype: 'string',
      unit: null,
    },
    evidence_ids: [ctx.evidence[2]?.id ?? ctx.evidence[0].id],
  };
  const diag: Diagnostic = {
    id: `diag-${ctx.site.parcel_id}-status-conflict`,
    kind: 'conflict',
    severity: 'warning',
    title: 'Two incompatible status values at the same effective time',
    detail: `"${String(status.object.value)}" and "${String(
      twin.object.kind === 'literal' ? twin.object.value : '',
    )}" are both asserted effective ${status.effective_at}. Sources disagree; neither is suppressed.`,
    assertion_ids: [status.id, twin.id],
    evidence_ids: [...status.evidence_ids, ...twin.evidence_ids],
  };
  return {
    ...ctx,
    assertions: [...ctx.assertions, twin],
    diagnostics: [...ctx.diagnostics, diag],
    trust: {
      ...ctx.trust,
      assertion_count: ctx.trust.assertion_count + 1,
      conflict_count: ctx.trust.conflict_count + 1,
    },
  };
}

function withExtraStaleness(ctx: ContextGraph): ContextGraph {
  const assessorAsserts = ctx.assertions
    .filter((a) => a.subject_id.includes('assessor'))
    .map((a) => a.id);
  const assessorEvidence = ctx.evidence
    .filter((e) => e.dataset_id === 'wv5m-vpq2')
    .map((e) => e.id);
  const diag: Diagnostic = {
    id: `diag-${ctx.site.parcel_id}-assessor-stale`,
    kind: 'freshness',
    severity: 'warning',
    title: 'Assessor series predates the release cutoff',
    detail:
      'The latest closed-roll year is 2024; the series was last updated 2025-09-14, before this release cutoff.',
    assertion_ids: assessorAsserts,
    evidence_ids: assessorEvidence,
  };
  return {
    ...ctx,
    diagnostics: [...ctx.diagnostics, diag],
    trust: { ...ctx.trust, freshness_warning_count: ctx.trust.freshness_warning_count + 1 },
  };
}

/**
 * Deterministic mock implementation. The state is selected ONCE from
 * `?mockState=` at construction; components never see this concern.
 */
export class MockContextClient implements ContextClient {
  readonly state: MockState;

  constructor(state?: MockState) {
    this.state =
      state ?? readMockState(typeof window !== 'undefined' ? window.location.search : '');
  }

  async getRuntimeConfig(): Promise<PublicRuntimeConfig> {
    await delay(LATENCY_MS / 2);
    const cfg = runtimeJson as PublicRuntimeConfig;
    if (this.state === 'chat-offline') {
      return { ...cfg, agent: { ...cfg.agent, enabled: false } };
    }
    return cfg;
  }

  async listSites(): Promise<SiteSummary[]> {
    if (this.state === 'loading') return never();
    if (this.state === 'error') {
      await delay(LATENCY_MS);
      throw {
        code: 'unavailable',
        message: 'The context service did not respond.',
        request_id: 'req-mock-7f3a91',
      };
    }
    await delay(LATENCY_MS);
    return sitesJson as SiteSummary[];
  }

  async getContext(parcelId: string, focus: ContextFocus): Promise<ContextGraph> {
    if (this.state === 'loading') return never();
    await delay(LATENCY_MS);
    if (this.state === 'error') {
      throw {
        code: 'unavailable',
        message: 'The context service did not respond.',
        request_id: 'req-mock-7f3a91',
      };
    }
    if (!isContextFocus(focus)) {
      throw { code: 'invalid_focus', message: `Unknown focus ${focus}`, request_id: 'req-mock-0002' };
    }
    const base = CONTEXTS[parcelId];
    if (!base) notFound(`No site with parcel id ${parcelId}`);
    if (this.state === 'empty') {
      return {
        ...base,
        focus,
        entities: [],
        assertions: [],
        evidence: [],
        diagnostics: [],
        trust: {
          ...base.trust,
          source_count: 0,
          assertion_count: 0,
          citation_coverage_percent: 0,
          freshness_warning_count: 0,
          conflict_count: 0,
          coverage_gap_count: 0,
          proximity_only_count: 0,
        },
      };
    }
    let ctx = base;
    if (this.state === 'conflict') ctx = withConflict(ctx);
    if (this.state === 'stale') ctx = withExtraStaleness(ctx);
    return filterByFocus(ctx, focus);
  }

  async getEvidence(evidenceId: string): Promise<EvidenceRecord> {
    if (this.state === 'loading') return never();
    await delay(LATENCY_MS / 2);
    for (const ctx of Object.values(CONTEXTS)) {
      const hit = ctx.evidence.find((e) => e.id === evidenceId);
      if (hit) return hit;
    }
    notFound(`No evidence record ${evidenceId}`);
  }
}
