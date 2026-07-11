import type { EntityKind } from '../contracts';

type EntityGlyph =
  | 'action'
  | 'coverage'
  | 'dynamics'
  | 'evidence'
  | 'geocell'
  | 'hazard'
  | 'object'
  | 'signal';

/** The design-reference symbol assigned to each graph entity kind. */
export const ENTITY_GLYPH: Record<EntityKind, EntityGlyph> = {
  parcel: 'geocell',
  development_project: 'object',
  permit: 'action',
  assessment_series: 'dynamics',
  housing_program: 'coverage',
  hazard_map: 'hazard',
  neighborhood_signal: 'signal',
  source_record: 'evidence',
};

const C = 38;

function polygonPath(cx: number, cy: number, radius: number, rotation = 0): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = rotation + (index * Math.PI) / 3;
    const x = (cx + radius * Math.cos(angle)).toFixed(1);
    const y = (cy + radius * Math.sin(angle)).toFixed(1);
    return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
  }).join(' ') + ' Z';
}

function glyphMarkup(glyph: EntityGlyph): string {
  switch (glyph) {
    case 'geocell': {
      const radius = 8;
      const distance = Math.sqrt(3) * radius;
      const cells = Array.from({ length: 6 }, (_, index) => {
        const angle = Math.PI / 6 + (index * Math.PI) / 3;
        return `<path d="${polygonPath(
          C + distance * Math.cos(angle),
          C + distance * Math.sin(angle),
          radius,
        )}" stroke-width="1.6" opacity=".45"/>`;
      }).join('');
      return `<path d="${polygonPath(C, C, 30)}"/>${cells}<path d="${polygonPath(
        C,
        C,
        radius,
      )}" fill="currentColor" stroke="none"/>`;
    }
    case 'object':
      return `<path d="${polygonPath(C, C, 30, -Math.PI / 2)}"/><circle cx="38" cy="38" r="8" fill="currentColor" stroke="none"/>`;
    case 'action':
      return '<path d="M43 8 L22 41 L36 41 L32 68 L56 33 L41 33 Z" fill="currentColor" stroke="none"/>';
    case 'dynamics':
      return [-14, 0, 14]
        .map(
          (offset, index) =>
            `<path d="M8 ${C + offset} q10 -10 20 0 t20 0 t20 0"${
              index === 1 ? '' : ' opacity=".6"'
            }/>`,
        )
        .join('');
    case 'coverage':
      return `<path d="M8 58 h60" opacity=".6"/>${[-16, 0, 16]
        .map(
          (offset) =>
            `<circle cx="${C + offset}" cy="16" r="3" fill="currentColor" stroke="none"/><path d="M${
              C + offset
            } 16 L${C + offset - 16} 58 L${C + offset + 16} 58 Z" fill="currentColor" fill-opacity=".1" stroke-width="1.6"/>`,
        )
        .join('')}`;
    case 'hazard':
      return `<circle cx="38" cy="38" r="24" stroke-dasharray="5 6"/><path d="M26 30 L50 22 M26 42 L50 34 M26 54 L50 46" stroke-width="1.6" opacity=".42"/><circle cx="38" cy="38" r="3.5" fill="currentColor" stroke="none"/><path d="M4 68 q11 -5 16 -15"/>`;
    case 'signal':
      return '<circle cx="38" cy="38" r="6" fill="currentColor" stroke="none"/><circle cx="38" cy="38" r="14" stroke-width="2.2" opacity=".85"/><circle cx="38" cy="38" r="24" stroke-width="2.2" opacity=".85"/><circle cx="38" cy="38" r="34" stroke-width="2.2" opacity=".85"/>';
    case 'evidence':
      return '<path d="M18 8 H48 L60 20 V68 H18 Z"/><path d="M48 8 V20 H60" stroke-width="2.2"/><path d="M26 32 h20 M26 42 h20" stroke-width="2" opacity=".55"/><path d="M28 54 l6 6 l12 -12" stroke-width="2.8"/>';
  }
}

/** Cytoscape renders node symbols as SVG backgrounds; no prototype runtime or
 * HTML injection enters the application. */
export function entityGlyphDataUri(kind: EntityKind, color: string): string {
  const safeColor = color.replace(/[&<>'"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76 76" color="${safeColor}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${glyphMarkup(
    ENTITY_GLYPH[kind],
  )}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
