import { describe, expect, it } from 'vitest';
import { MockContextClient, filterByFocus, readMockState } from './mock-client';
import type { ApiError, ContextGraph } from '../contracts';

const SITE_IDS = ['3956008', '3501006', '0161014'];

describe('readMockState', () => {
  it('defaults to ready and accepts every documented state', () => {
    expect(readMockState('')).toBe('ready');
    expect(readMockState('?mockState=nonsense')).toBe('ready');
    for (const s of ['ready', 'loading', 'empty', 'error', 'stale', 'conflict', 'chat-offline']) {
      expect(readMockState(`?mockState=${s}`)).toBe(s);
    }
  });
});

describe('MockContextClient · ready', () => {
  const client = new MockContextClient('ready');

  it('lists the three demo sites with headlines', async () => {
    const sites = await client.listSites();
    expect(sites.map((s) => s.parcel_id)).toEqual(SITE_IDS);
    expect(sites[0].headline.value).toBe('425');
    expect(sites[1].headline.value).toBe('185');
    expect(sites[2].headline.value).toBe('174');
  });

  it.each(SITE_IDS)('site %s meets the minimum graph requirements', async (id) => {
    const ctx = await client.getContext(id, 'overview');
    expect(ctx.release.mock).toBe(true);
    expect(ctx.entities.length).toBeGreaterThanOrEqual(6);
    expect(ctx.entities.length).toBeLessThanOrEqual(10);
    const entityAsserts = ctx.assertions.filter((a) => a.object.kind === 'entity');
    const literalAsserts = ctx.assertions.filter((a) => a.object.kind === 'literal');
    expect(entityAsserts.length).toBeGreaterThanOrEqual(1);
    expect(literalAsserts.length).toBeGreaterThanOrEqual(3);
    expect(ctx.evidence.length).toBeGreaterThanOrEqual(4);
    expect(ctx.diagnostics.some((d) => d.kind === 'freshness')).toBe(true);
    expect(
      ctx.diagnostics.some((d) => d.kind === 'coverage_gap' || d.kind === 'proximity_only'),
    ).toBe(true);
  });

  it.each(SITE_IDS)('every assertion on %s resolves to existing evidence', async (id) => {
    const ctx = await client.getContext(id, 'overview');
    const evidenceIds = new Set(ctx.evidence.map((e) => e.id));
    for (const a of ctx.assertions) {
      expect(a.evidence_ids.length).toBeGreaterThan(0);
      for (const eid of a.evidence_ids) expect(evidenceIds.has(eid)).toBe(true);
    }
  });

  it('trust metrics match the diagnostics deterministically', async () => {
    const ctx = await client.getContext('3956008', 'overview');
    const count = (k: string) => ctx.diagnostics.filter((d) => d.kind === k).length;
    expect(ctx.trust.freshness_warning_count).toBe(count('freshness'));
    expect(ctx.trust.conflict_count).toBe(count('conflict'));
    expect(ctx.trust.coverage_gap_count).toBe(count('coverage_gap'));
    expect(ctx.trust.proximity_only_count).toBe(count('proximity_only'));
    expect(ctx.trust.citation_coverage_percent).toBe(100);
  });

  it('758/772 Pacific carries the historical 2015 AHBP warning', async () => {
    const ctx = await client.getContext('0161014', 'overview');
    const warning = ctx.diagnostics.find(
      (d) => d.kind === 'freshness' && d.title.toLowerCase().includes('ahbp'),
    );
    expect(warning).toBeDefined();
    const ev = ctx.evidence.find((e) => e.dataset_id === 'fizh-zaxt');
    expect(ev?.fields.matched_row).toBe(true);
    expect(ev?.fields.layer_vintage).toBe(2015);
  });

  it('does not assert a current flood-risk conclusion', async () => {
    for (const id of SITE_IDS) {
      const ctx = await client.getContext(id, 'overview');
      expect(ctx.assertions.some((a) => a.predicate === 'intersects')).toBe(false);
      const flood = ctx.evidence.find((e) => e.dataset_id === 'jzu3-4yxp');
      expect(flood?.fields.intersection_conclusion).toBeNull();
    }
  });

  it('rejects unknown sites and unknown evidence with not_found', async () => {
    await expect(client.getContext('9999999', 'overview')).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(client.getEvidence('ev-nope')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('resolves stable evidence ids and back-links their assertions', async () => {
    const ev = await client.getEvidence('ev-6jgi-cpb4-3956008');
    expect(ev.parcel_ids).toContain('3956008');
    expect(ev.assertion_ids.length).toBeGreaterThan(0);
  });
});

describe('focus filtering', () => {
  it('keeps the parcel plus focus-relevant assertions only', async () => {
    const client = new MockContextClient('ready');
    const full = (await client.getContext('3956008', 'overview')) as ContextGraph;
    const housing = filterByFocus(full, 'housing');
    expect(housing.assertions.every((a) => a.category === 'housing' || a.category === 'identity')).toBe(
      true,
    );
    expect(housing.entities.some((e) => e.kind === 'parcel')).toBe(true);
    expect(housing.entities.length).toBeLessThan(full.entities.length);
  });
});

describe('MockContextClient · deterministic states', () => {
  it('empty returns a valid site with no context', async () => {
    const ctx = await new MockContextClient('empty').getContext('3956008', 'overview');
    expect(ctx.site.parcel_id).toBe('3956008');
    expect(ctx.entities).toHaveLength(0);
    expect(ctx.assertions).toHaveLength(0);
    expect(ctx.trust.assertion_count).toBe(0);
  });

  it('error rejects with an unavailable ApiError', async () => {
    await expect(new MockContextClient('error').getContext('3956008', 'overview')).rejects.toMatchObject(
      { code: 'unavailable', request_id: expect.stringContaining('req-') } satisfies Partial<ApiError>,
    );
  });

  it('loading never resolves (deterministic skeleton state)', async () => {
    const result = await Promise.race([
      new MockContextClient('loading').getContext('3956008', 'overview').then(() => 'resolved'),
      new Promise((r) => setTimeout(() => r('pending'), 250)),
    ]);
    expect(result).toBe('pending');
  });

  it('conflict adds two incompatible same-effective-time assertions and a linking diagnostic', async () => {
    const ctx = await new MockContextClient('conflict').getContext('3956008', 'overview');
    const conflictDiag = ctx.diagnostics.find((d) => d.kind === 'conflict');
    expect(conflictDiag).toBeDefined();
    const [a1, a2] = conflictDiag!.assertion_ids.map(
      (id) => ctx.assertions.find((a) => a.id === id)!,
    );
    expect(a1.effective_at).toBe(a2.effective_at);
    expect(a1.predicate).toBe(a2.predicate);
    expect(a1.object).not.toEqual(a2.object);
    expect(ctx.trust.conflict_count).toBeGreaterThan(0);
  });

  it('stale adds a freshness diagnostic and raises the trust counter', async () => {
    const ready = await new MockContextClient('ready').getContext('3956008', 'overview');
    const stale = await new MockContextClient('stale').getContext('3956008', 'overview');
    expect(stale.trust.freshness_warning_count).toBe(ready.trust.freshness_warning_count + 1);
    expect(stale.diagnostics.length).toBe(ready.diagnostics.length + 1);
  });

  it('chat-offline disables the agent but leaves data intact', async () => {
    const offline = new MockContextClient('chat-offline');
    const cfg = await offline.getRuntimeConfig();
    expect(cfg.agent.enabled).toBe(false);
    const ctx = await offline.getContext('3956008', 'overview');
    expect(ctx.entities.length).toBeGreaterThan(0);
    const ready = await new MockContextClient('ready').getRuntimeConfig();
    expect(ready.agent.enabled).toBe(true);
  });
});
