import type { ElementDefinition } from 'cytoscape';
import type { Assertion, ContextGraph as Ctx, DiagnosticKind } from '../contracts';
import { KIND_META, KIND_ORDER, formatLiteral } from '../kinds';
import { GRAPH_REFERENCE_VIEW, type GraphLod } from './viewport';

export const GRAPH_REFERENCE_ANCHOR_IDS = ['__graph-reference-start', '__graph-reference-end'] as const;

interface GraphPoint {
  x: number;
  y: number;
  radius: number;
  angle: number;
}

export interface GraphLayout {
  nodes: ElementDefinition[];
  edges: ElementDefinition[];
}

export interface GraphWarnings {
  staleEntityIds: ReadonlySet<string>;
  conflictEntityIds: ReadonlySet<string>;
  conflictAssertionIds: ReadonlySet<string>;
}

export interface GraphDetailPlan {
  selectedSubjectId: string | null;
  visibleFactIds: ReadonlySet<string>;
  visibleCountSubjectIds: ReadonlySet<string>;
}

export function diagnosticEntityIds(ctx: Ctx, kind: DiagnosticKind): Set<string> {
  const ids = new Set<string>();
  for (const diagnostic of ctx.diagnostics) {
    if (diagnostic.kind !== kind) continue;
    for (const assertionId of diagnostic.assertion_ids) {
      const assertion = ctx.assertions.find((item) => item.id === assertionId);
      if (!assertion) continue;
      ids.add(assertion.subject_id);
    }
  }
  return ids;
}

export function diagnosticAssertionIds(ctx: Ctx, kind: DiagnosticKind): Set<string> {
  const ids = new Set<string>();
  for (const diagnostic of ctx.diagnostics) {
    if (diagnostic.kind === kind) diagnostic.assertion_ids.forEach((id) => ids.add(id));
  }
  return ids;
}

/** Stable design-reference geometry. Values and colors encode graph structure,
 * never desirability, value, safety, or risk. */
export function buildGraphElements(ctx: Ctx, warnings: GraphWarnings): GraphLayout {
  const nodes: ElementDefinition[] = [
    referenceAnchor(GRAPH_REFERENCE_ANCHOR_IDS[0], GRAPH_REFERENCE_VIEW.x, GRAPH_REFERENCE_VIEW.y),
    referenceAnchor(
      GRAPH_REFERENCE_ANCHOR_IDS[1],
      GRAPH_REFERENCE_VIEW.x + GRAPH_REFERENCE_VIEW.width,
      GRAPH_REFERENCE_VIEW.y + GRAPH_REFERENCE_VIEW.height,
    ),
  ];
  const edges: ElementDefinition[] = [];
  const positions = new Map<string, GraphPoint>();

  const parcel = ctx.entities.find((entity) => entity.kind === 'parcel');
  const ring = ctx.entities
    .filter((entity) => entity.kind !== 'parcel')
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));

  const degree = new Map<string, number>();
  for (const assertion of ctx.assertions) {
    if (assertion.object.kind !== 'entity') continue;
    degree.set(assertion.subject_id, (degree.get(assertion.subject_id) ?? 0) + 1);
    degree.set(assertion.object.entity_id, (degree.get(assertion.object.entity_id) ?? 0) + 1);
  }

  if (parcel) {
    positions.set(parcel.id, {
      x: GRAPH_REFERENCE_VIEW.centerX,
      y: GRAPH_REFERENCE_VIEW.centerY,
      radius: 37,
      angle: 0,
    });
  }
  ring.forEach((entity, index) => {
    const angle = ((-90 + (index * 360) / Math.max(ring.length, 1)) * Math.PI) / 180;
    positions.set(entity.id, {
      x: GRAPH_REFERENCE_VIEW.centerX + GRAPH_REFERENCE_VIEW.radiusX * Math.cos(angle),
      y: GRAPH_REFERENCE_VIEW.centerY + GRAPH_REFERENCE_VIEW.radiusY * Math.sin(angle),
      radius: 23 + Math.min(degree.get(entity.id) ?? 1, 4) * 2,
      angle,
    });
  });

  for (const entity of ctx.entities) {
    const position = positions.get(entity.id);
    if (!position) continue;
    const stale = warnings.staleEntityIds.has(entity.id);
    const conflict = warnings.conflictEntityIds.has(entity.id);
    const warningLabel = conflict ? 'CONFLICT' : stale ? 'STALE SOURCE' : '';
    const sourceLabel = `${KIND_META[entity.kind].label} · ${entity.source_count} src`;
    nodes.push({
      data: {
        id: entity.id,
        label: entity.label,
        fullLabel: `${entity.label}\n${sourceLabel}${warningLabel ? `\n${warningLabel}` : ''}`,
        displayLabel: `${entity.label}\n${sourceLabel}${warningLabel ? `\n${warningLabel}` : ''}`,
        kind: entity.kind,
        size: position.radius * 2,
        warningLabel,
      },
      position: { x: position.x, y: position.y },
      classes: [
        'entity',
        `kind-${entity.kind}`,
        stale ? 'stale' : '',
        conflict ? 'conflict' : '',
        stale || conflict ? 'warning' : '',
        position.y > GRAPH_REFERENCE_VIEW.centerY + GRAPH_REFERENCE_VIEW.radiusY / 2
          ? 'label-above'
          : '',
      ]
        .filter(Boolean)
        .join(' '),
    });
  }

  for (const assertion of ctx.assertions) {
    if (assertion.object.kind !== 'entity') continue;
    if (!positions.has(assertion.subject_id) || !positions.has(assertion.object.entity_id)) continue;
    edges.push({
      data: {
        id: assertion.id,
        source: assertion.subject_id,
        target: assertion.object.entity_id,
        label: assertion.predicate_label,
        displayLabel: assertion.predicate_label,
      },
      classes: `assert${assertion.predicate === 'near' ? ' proximity' : ''}`,
    });
  }

  const factsBySubject = new Map<string, Assertion[]>();
  for (const assertion of ctx.assertions) {
    if (assertion.object.kind !== 'literal') continue;
    const facts = factsBySubject.get(assertion.subject_id) ?? [];
    facts.push(assertion);
    factsBySubject.set(assertion.subject_id, facts);
  }

  for (const [subjectId, facts] of factsBySubject) {
    const subject = positions.get(subjectId);
    if (!subject) continue;
    const isParcel = parcel?.id === subjectId;
    const baseAngle = isParcel ? (135 * Math.PI) / 180 : subject.angle;

    facts.forEach((assertion, index) => {
      const offset = index - (facts.length - 1) / 2;
      const angle = baseAngle + offset * 0.52;
      const distance = isParcel ? 118 : subject.radius + 64 + Math.abs(offset) * 46;
      const conflicted = warnings.conflictAssertionIds.has(assertion.id);
      const label = `${assertion.predicate_label}: ${formatLiteral(assertion)}${
        conflicted ? '  ⚠' : ''
      }`;
      nodes.push({
        data: {
          id: assertion.id,
          label,
          width: Math.min(label.length * 6.6 + 22, 230),
          subject: subjectId,
          conflicted: conflicted ? 1 : 0,
        },
        position: {
          x: subject.x + Math.cos(angle) * distance * (isParcel ? 1 : 1.3),
          y: subject.y + Math.sin(angle) * distance,
        },
        classes: `fact${conflicted ? ' conflicted' : ''}`,
      });
      edges.push({
        data: {
          id: `${assertion.id}-tether`,
          source: subjectId,
          target: assertion.id,
          subject: subjectId,
          factId: assertion.id,
        },
        classes: 'tether fact-tether',
      });
    });

    const countLabel = `${facts.length} fact${facts.length === 1 ? '' : 's'}`;
    const countDistance = isParcel ? 118 : subject.radius + 64;
    const countId = `__facts-${subjectId}`;
    nodes.push({
      data: {
        id: countId,
        label: countLabel,
        width: countLabel.length * 6.6 + 26,
        subject: subjectId,
        count: facts.length,
      },
      position: {
        x: subject.x + Math.cos(baseAngle) * countDistance * (isParcel ? 1 : 1.3),
        y: subject.y + Math.sin(baseAngle) * countDistance,
      },
      classes: 'fact-count lod-hidden',
    });
    edges.push({
      data: {
        id: `${countId}-tether`,
        source: subjectId,
        target: countId,
        subject: subjectId,
      },
      classes: 'tether count-tether lod-hidden',
    });
  }

  return { nodes, edges };
}

export function planGraphDetail(ctx: Ctx, lod: GraphLod, selectedId: string | null): GraphDetailPlan {
  const selectedEntity = selectedId && ctx.entities.some((entity) => entity.id === selectedId);
  const selectedAssertion = selectedId
    ? ctx.assertions.find((assertion) => assertion.id === selectedId)
    : undefined;
  const selectedSubjectId = selectedEntity
    ? selectedId
    : selectedAssertion?.object.kind === 'literal'
      ? selectedAssertion.subject_id
      : null;

  const literalAssertions = ctx.assertions.filter((assertion) => assertion.object.kind === 'literal');
  const visibleFactIds = new Set<string>();
  if (lod === 'full') {
    literalAssertions.forEach((assertion) => visibleFactIds.add(assertion.id));
  } else if (selectedSubjectId) {
    literalAssertions
      .filter((assertion) => assertion.subject_id === selectedSubjectId)
      .forEach((assertion) => visibleFactIds.add(assertion.id));
  }

  const visibleCountSubjectIds = new Set<string>();
  if (lod === 'mid') {
    literalAssertions.forEach((assertion) => {
      if (assertion.subject_id !== selectedSubjectId) visibleCountSubjectIds.add(assertion.subject_id);
    });
  }

  return { selectedSubjectId, visibleFactIds, visibleCountSubjectIds };
}

function referenceAnchor(id: string, x: number, y: number): ElementDefinition {
  return {
    data: { id },
    position: { x, y },
    classes: 'graph-reference-anchor',
    locked: true,
    selectable: false,
    grabbable: false,
  };
}
