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

/** The authoritative Spatioterra symbol assigned to each graph entity kind. */
export const ENTITY_GLYPH: Readonly<Record<EntityKind, EntityGlyph>> = {
  parcel: 'geocell',
  development_project: 'object',
  permit: 'action',
  assessment_series: 'dynamics',
  housing_program: 'coverage',
  hazard_map: 'hazard',
  neighborhood_signal: 'signal',
  source_record: 'evidence',
};

type SvgAttributes = Record<string, number | string>;

const CENTER = 38;
const FALLBACK_COLOR = '#888888';
const SAFE_HEX_COLOR = /^#[0-9a-f]{6}$/i;

function attributes(values: SvgAttributes): string {
  return Object.entries(values)
    .map(([name, value]) => `${name}="${value}"`)
    .join(' ');
}

function strokeAttributes(values: SvgAttributes): string {
  return attributes({
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2.6,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    ...values,
  });
}

function polygonPath(cx: number, cy: number, radius: number, rotation = 0): string {
  let path = '';
  for (let index = 0; index < 6; index += 1) {
    const angle = rotation + (index / 6) * Math.PI * 2;
    path += `${index ? 'L' : 'M'}${(cx + radius * Math.cos(angle)).toFixed(1)} ${(
      cy +
      radius * Math.sin(angle)
    ).toFixed(1)} `;
  }
  return `${path}Z`;
}

/** Exact geometry and stroke treatment from the handoff's lib/glyphs.js.
 * Only the eight entity glyphs are carried here so this remains the single,
 * deterministic rendering seam used by the graph. */
function glyphMarkup(glyph: EntityGlyph, cx: number, cy: number, accent: string): string {
  const parts: string[] = [];
  const path = (d: string, values: SvgAttributes = {}) => {
    parts.push(`<path ${strokeAttributes({ d, ...values })}/>`);
  };
  const stroked = (tag: 'circle', values: SvgAttributes) => {
    parts.push(`<${tag} ${strokeAttributes(values)}/>`);
  };
  const plain = (tag: 'circle' | 'path', values: SvgAttributes) => {
    parts.push(`<${tag} ${attributes(values)}/>`);
  };

  switch (glyph) {
    case 'action':
      plain('path', {
        d: `M${cx + 5} ${cy - 30} L${cx - 16} ${cy + 3} L${cx - 2} ${cy + 3} L${
          cx - 6
        } ${cy + 30} L${cx + 18} ${cy - 5} L${cx + 3} ${cy - 5} Z`,
        fill: accent,
      });
      break;

    case 'coverage':
      path(`M${cx - 30} ${cy + 20} h60`, { 'stroke-width': 2.4, opacity: 0.6 });
      [-16, 0, 16].forEach((offset) => {
        const sourceX = cx + offset;
        const sourceY = cy - 22;
        plain('circle', { cx: sourceX, cy: sourceY, r: 3, fill: accent });
        path(
          `M${sourceX} ${sourceY} L${sourceX - 16} ${cy + 20} L${sourceX + 16} ${
            cy + 20
          } Z`,
          {
            fill: accent,
            'fill-opacity': 0.1,
            stroke: accent,
            'stroke-width': 1.6,
          },
        );
      });
      break;

    case 'dynamics':
      for (let index = 0; index < 3; index += 1) {
        const y = cy - 14 + index * 14;
        path(`M${cx - 30} ${y} q10 -10 20 0 t20 0 t20 0`, {
          'stroke-width': 2.6,
          ...(index === 1 ? { stroke: accent } : { opacity: 0.6 }),
        });
      }
      break;

    case 'evidence':
      path(
        `M${cx - 20} ${cy - 30} H${cx + 10} L${cx + 22} ${cy - 18} V${
          cy + 30
        } H${cx - 20} Z`,
        { 'stroke-width': 2.6 },
      );
      path(`M${cx + 10} ${cy - 30} V${cy - 18} H${cx + 22}`, { 'stroke-width': 2.2 });
      path(`M${cx - 12} ${cy - 6} h20 M${cx - 12} ${cy + 4} h20`, {
        'stroke-width': 2,
        opacity: 0.55,
      });
      path(`M${cx - 10} ${cy + 16} l6 6 l12 -12`, {
        stroke: accent,
        'stroke-width': 2.8,
      });
      break;

    case 'geocell': {
      path(polygonPath(cx, cy, 30), { 'stroke-width': 2.6 });
      const radius = 8;
      const distance = Math.sqrt(3) * radius;
      for (let index = 0; index < 6; index += 1) {
        const angle = ((30 + 60 * index) * Math.PI) / 180;
        path(
          polygonPath(
            cx + distance * Math.cos(angle),
            cy + distance * Math.sin(angle),
            radius,
          ),
          { 'stroke-width': 1.6, opacity: 0.45 },
        );
      }
      plain('path', {
        d: polygonPath(cx, cy, radius),
        fill: accent,
        'fill-opacity': 0.9,
      });
      break;
    }

    case 'hazard':
      stroked('circle', {
        cx,
        cy,
        r: 24,
        stroke: accent,
        'stroke-width': 2.4,
        'stroke-dasharray': '5 6',
      });
      [-12, 0, 12].forEach((offset) => {
        path(`M${cx - 12} ${cy + offset + 4} L${cx + 12} ${cy + offset - 4}`, {
          stroke: accent,
          'stroke-width': 1.6,
          opacity: 0.42,
        });
      });
      plain('circle', { cx, cy, r: 3.5, fill: accent });
      path(`M${cx - 34} ${cy + 30} q11 -5 16 -15`, { 'stroke-width': 2.4 });
      break;

    case 'object': {
      const points: [number, number][] = [];
      for (let index = 0; index < 6; index += 1) {
        const angle = (index / 6) * Math.PI * 2 - Math.PI / 2;
        points.push([cx + 30 * Math.cos(angle), cy + 30 * Math.sin(angle)]);
      }
      const outline = points
        .map(
          ([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `,
        )
        .join('');
      path(`${outline}Z`, { 'stroke-width': 2.4 });
      plain('circle', { cx, cy, r: 8, fill: accent });
      break;
    }

    case 'signal':
      plain('circle', { cx, cy, r: 6, fill: accent });
      [14, 24, 34].forEach((radius) => {
        stroked('circle', { cx, cy, r: radius, 'stroke-width': 2.2, opacity: 0.85 });
      });
      break;
  }

  return parts.join('');
}

/** Cytoscape renders node symbols as SVG backgrounds. Color is restricted to
 * the graph's resolved theme hex values before it enters the SVG document. */
export function entityGlyphDataUri(kind: EntityKind, color: string): string {
  const accent = SAFE_HEX_COLOR.test(color) ? color : FALLBACK_COLOR;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76 76" color="${accent}">${glyphMarkup(
    ENTITY_GLYPH[kind],
    CENTER,
    CENTER,
    accent,
  )}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Keep every symbol proportional to its degree-sized node. The dense parcel
 * cell uses a smaller optical box than the single-path outer symbols.
 * Cytoscape then scales each complete node with the camera. */
export function entityGlyphBackground(kind: EntityKind, color: string) {
  const size = kind === 'parcel' ? '58%' : '68%';
  return {
    'background-image': entityGlyphDataUri(kind, color),
    'background-fit': 'none',
    'background-width': size,
    'background-height': size,
    'background-position-x': '50%',
    'background-position-y': '50%',
    'background-image-opacity': 1,
  } as const;
}
