import { describe, expect, it } from 'vitest';
import type { ContextGraph as Ctx } from '../contracts';
import fixture from '../../../data/releases/demo-v1/contexts/3956008.json';
import {
  GRAPH_REFERENCE_ANCHOR_IDS,
  buildGraphElements,
  planGraphDetail,
} from './layout';
import { GRAPH_REFERENCE_VIEW } from './viewport';

const ctx = fixture as unknown as Ctx;
const noWarnings = {
  staleEntityIds: new Set<string>(),
  conflictEntityIds: new Set<string>(),
  conflictAssertionIds: new Set<string>(),
};

function node(layout: ReturnType<typeof buildGraphElements>, id: string) {
  const match = layout.nodes.find((element) => element.data.id === id);
  if (!match) throw new Error(`missing node ${id}`);
  return match;
}

describe('graph layout', () => {
  it('pins the reference view and corrected parcel center', () => {
    const layout = buildGraphElements(ctx, noWarnings);
    expect(node(layout, GRAPH_REFERENCE_ANCHOR_IDS[0]).position).toEqual({ x: -36, y: 0 });
    expect(node(layout, GRAPH_REFERENCE_ANCHOR_IDS[1]).position).toEqual({ x: 1036, y: 762 });

    const parcel = ctx.entities.find((entity) => entity.kind === 'parcel');
    expect(parcel).toBeDefined();
    expect(node(layout, parcel!.id).position).toEqual({
      x: GRAPH_REFERENCE_VIEW.centerX,
      y: GRAPH_REFERENCE_VIEW.centerY,
    });
  });

  it('keeps parcel facts on radius 118 and spaces non-parcel facts from entity radius', () => {
    const layout = buildGraphElements(ctx, noWarnings);
    const parcel = ctx.entities.find((entity) => entity.kind === 'parcel')!;
    const parcelFacts = ctx.assertions.filter(
      (assertion) => assertion.subject_id === parcel.id && assertion.object.kind === 'literal',
    );
    for (const fact of parcelFacts) {
      const position = node(layout, fact.id).position!;
      expect(
        Math.hypot(
          position.x - GRAPH_REFERENCE_VIEW.centerX,
          position.y - GRAPH_REFERENCE_VIEW.centerY,
        ),
      ).toBeCloseTo(118, 8);
    }

    const subjectId = ctx.assertions.find(
      (assertion) =>
        assertion.object.kind === 'literal' &&
        ctx.entities.some((entity) => entity.id === assertion.subject_id && entity.kind !== 'parcel'),
    )!.subject_id;
    const subjectNode = node(layout, subjectId);
    const subjectPosition = subjectNode.position!;
    const subjectRadius = Number(subjectNode.data.size) / 2;
    const facts = ctx.assertions.filter(
      (assertion) => assertion.subject_id === subjectId && assertion.object.kind === 'literal',
    );
    const angle = Math.atan2(
      (subjectPosition.y - GRAPH_REFERENCE_VIEW.centerY) / GRAPH_REFERENCE_VIEW.radiusY,
      (subjectPosition.x - GRAPH_REFERENCE_VIEW.centerX) / GRAPH_REFERENCE_VIEW.radiusX,
    );
    facts.forEach((fact, index) => {
      const offset = index - (facts.length - 1) / 2;
      const factAngle = angle + offset * 0.52;
      const distance = subjectRadius + 64 + Math.abs(offset) * 46;
      expect(node(layout, fact.id).position).toEqual({
        x: subjectPosition.x + Math.cos(factAngle) * distance * 1.3,
        y: subjectPosition.y + Math.sin(factAngle) * distance,
      });
    });
  });

  it('collapses mid-detail facts and expands the selected fact subject at every LOD', () => {
    const literal = ctx.assertions.find((assertion) => assertion.object.kind === 'literal')!;
    const full = planGraphDetail(ctx, 'full', null);
    const mid = planGraphDetail(ctx, 'mid', null);
    const selectedMid = planGraphDetail(ctx, 'mid', literal.id);
    const selectedFar = planGraphDetail(ctx, 'far', literal.id);

    expect(full.visibleFactIds.size).toBeGreaterThan(0);
    expect(full.visibleCountSubjectIds.size).toBe(0);
    expect(mid.visibleFactIds.size).toBe(0);
    expect(mid.visibleCountSubjectIds.size).toBeGreaterThan(0);
    expect(selectedMid.visibleFactIds).toContain(literal.id);
    expect(selectedMid.visibleCountSubjectIds).not.toContain(literal.subject_id);
    expect(selectedFar.visibleFactIds).toContain(literal.id);
    expect(selectedFar.visibleCountSubjectIds.size).toBe(0);
  });

  it('keeps kind classes while marking warning entities and bounded fact pills', () => {
    const parcel = ctx.entities.find((entity) => entity.kind === 'parcel')!;
    const project = ctx.entities.find((entity) => entity.kind === 'development_project')!;
    const literal = ctx.assertions.find((assertion) => assertion.object.kind === 'literal')!;
    const layout = buildGraphElements(ctx, {
      staleEntityIds: new Set([parcel.id]),
      conflictEntityIds: new Set([project.id]),
      conflictAssertionIds: new Set([literal.id]),
    });

    expect(node(layout, parcel.id).classes).toContain('kind-parcel');
    expect(node(layout, parcel.id).classes).toContain('warning');
    expect(String(node(layout, parcel.id).data.fullLabel).split('\n')).toHaveLength(3);
    expect(node(layout, parcel.id).data.fullLabel).toContain('STALE SOURCE');
    expect(node(layout, project.id).classes).toContain('kind-development_project');
    expect(node(layout, project.id).classes).toContain('conflict');
    expect(node(layout, literal.id).classes).toContain('conflicted');
    expect(node(layout, literal.id).data.label).toContain('⚠');
    expect(Number(node(layout, literal.id).data.width)).toBeLessThanOrEqual(230);
    expect(node(layout, `__facts-${literal.subject_id}`).data.label).toMatch(/\d+ facts?/);
    const lowerEntity = ctx.entities.find((entity) => entity.kind === 'hazard_map')!;
    expect(node(layout, lowerEntity.id).classes).toContain('label-above');
  });
});
