import type { Assertion, EntityKind } from './contracts';

/** Display metadata per entity kind. Colors resolve through CSS tokens so the
 * same map serves both themes. */
export const KIND_META: Record<EntityKind, { label: string; cssVar: string }> = {
  parcel: { label: 'Parcel', cssVar: '--k-parcel' },
  development_project: { label: 'Development project', cssVar: '--k-development_project' },
  permit: { label: 'Permit', cssVar: '--k-permit' },
  assessment_series: { label: 'Assessor history', cssVar: '--k-assessment_series' },
  housing_program: { label: 'Housing program', cssVar: '--k-housing_program' },
  hazard_map: { label: 'Hazard map', cssVar: '--k-hazard_map' },
  neighborhood_signal: { label: 'Neighborhood signal', cssVar: '--k-neighborhood_signal' },
  source_record: { label: 'Source record', cssVar: '--k-source_record' },
};

export const KIND_ORDER: EntityKind[] = [
  'development_project',
  'permit',
  'assessment_series',
  'housing_program',
  'hazard_map',
  'neighborhood_signal',
  'source_record',
];

export function kindColor(kind: EntityKind): string {
  return `var(${KIND_META[kind].cssVar})`;
}

/** Resolved hex for canvas-based libraries (cytoscape) that cannot read
 * var() strings. */
export function kindColorResolved(kind: EntityKind): string {
  if (typeof window === 'undefined') return '#888888';
  return getComputedStyle(document.documentElement)
    .getPropertyValue(KIND_META[kind].cssVar)
    .trim();
}

export function tokenResolved(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function formatLiteral(a: Assertion): string {
  if (a.object.kind !== 'literal') return '';
  const o = a.object;
  if (o.datatype === 'decimal' && o.unit === 'USD') {
    return '$' + (Number(o.value) / 1e6).toFixed(1) + 'M';
  }
  if (o.unit) return `${String(o.value)} ${o.unit}`;
  return String(o.value);
}
