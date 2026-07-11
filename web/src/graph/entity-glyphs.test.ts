import { describe, expect, it } from 'vitest';
import type { EntityKind } from '../contracts';
import { ENTITY_GLYPH, entityGlyphBackground, entityGlyphDataUri } from './entity-glyphs';

const KINDS: EntityKind[] = [
  'parcel',
  'development_project',
  'permit',
  'assessment_series',
  'housing_program',
  'hazard_map',
  'neighborhood_signal',
  'source_record',
];

function decode(kind: EntityKind, color = '#afa0ff'): string {
  return decodeURIComponent(entityGlyphDataUri(kind, color));
}

function expectElement(svg: string, tag: 'circle' | 'path', fragments: string[]): void {
  const elements = svg.match(new RegExp(`<${tag}\\b[^>]*\\/>`, 'g')) ?? [];
  expect(elements.some((element) => fragments.every((fragment) => element.includes(fragment)))).toBe(
    true,
  );
}

describe('entity glyphs', () => {
  it('keeps the authoritative Spatioterra symbol assignment explicit', () => {
    expect(ENTITY_GLYPH).toEqual({
      parcel: 'geocell',
      development_project: 'object',
      permit: 'action',
      assessment_series: 'dynamics',
      housing_program: 'coverage',
      hazard_map: 'hazard',
      neighborhood_signal: 'signal',
      source_record: 'evidence',
    });
  });

  it('renders the exact handoff geometry for all eight entity kinds', () => {
    const parcel = decode('parcel');
    expectElement(parcel, 'path', [
      'd="M68.0 38.0 L53.0 64.0 L23.0 64.0 L8.0 38.0 L23.0 12.0 L53.0 12.0 Z"',
      'stroke-width="2.6"',
    ]);
    expectElement(parcel, 'path', [
      'd="M46.0 38.0 L42.0 44.9 L34.0 44.9 L30.0 38.0 L34.0 31.1 L42.0 31.1 Z"',
      'fill="#afa0ff"',
      'fill-opacity="0.9"',
    ]);

    const project = decode('development_project');
    expectElement(project, 'path', [
      'd="M38.0 8.0 L64.0 23.0 L64.0 53.0 L38.0 68.0 L12.0 53.0 L12.0 23.0 Z"',
      'stroke-width="2.4"',
    ]);
    expectElement(project, 'circle', ['cx="38"', 'cy="38"', 'r="8"', 'fill="#afa0ff"']);

    expectElement(decode('permit'), 'path', [
      'd="M43 8 L22 41 L36 41 L32 68 L56 33 L41 33 Z"',
      'fill="#afa0ff"',
    ]);

    const assessment = decode('assessment_series');
    expect(assessment).toContain('d="M8 24 q10 -10 20 0 t20 0 t20 0"');
    expectElement(assessment, 'path', [
      'd="M8 38 q10 -10 20 0 t20 0 t20 0"',
      'stroke="#afa0ff"',
    ]);
    expect(assessment).toContain('d="M8 52 q10 -10 20 0 t20 0 t20 0"');

    const housing = decode('housing_program');
    expectElement(housing, 'path', [
      'd="M8 58 h60"',
      'stroke-width="2.4"',
      'opacity="0.6"',
    ]);
    expect(housing).toContain('d="M22 16 L6 58 L38 58 Z"');
    expect(housing).toContain('d="M54 16 L38 58 L70 58 Z"');

    const hazard = decode('hazard_map');
    expectElement(hazard, 'circle', [
      'r="24"',
      'stroke="#afa0ff"',
      'stroke-width="2.4"',
      'stroke-dasharray="5 6"',
    ]);
    expectElement(hazard, 'path', [
      'd="M4 68 q11 -5 16 -15"',
      'stroke-width="2.4"',
    ]);

    const signal = decode('neighborhood_signal');
    expect(signal).toContain('<circle cx="38" cy="38" r="6" fill="#afa0ff"/>');
    for (const radius of [14, 24, 34]) {
      expectElement(signal, 'circle', [
        `r="${radius}"`,
        'stroke-width="2.2"',
        'opacity="0.85"',
      ]);
    }

    const source = decode('source_record');
    expectElement(source, 'path', [
      'd="M18 8 H48 L60 20 V68 H18 Z"',
      'stroke-width="2.6"',
    ]);
    expectElement(source, 'path', [
      'd="M28 54 l6 6 l12 -12"',
      'stroke="#afa0ff"',
      'stroke-width="2.8"',
    ]);
  });

  it('renders distinct encoded SVGs and restricts color to resolved theme hex values', () => {
    const uris = KINDS.map((kind) => entityGlyphDataUri(kind, '#5b4bc4'));
    expect(new Set(uris)).toHaveLength(KINDS.length);
    for (const uri of uris) {
      expect(uri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
      expect(decodeURIComponent(uri)).toContain('viewBox="0 0 76 76" color="#5b4bc4"');
    }

    expect(decodeURIComponent(entityGlyphDataUri('parcel', '"><script>'))).toContain(
      'color="#888888"',
    );
    expect(decodeURIComponent(entityGlyphDataUri('parcel', '"><script>'))).not.toContain(
      '<script>',
    );
  });

  it('keeps prototype scale fixed while degree changes node diameter', () => {
    expect(entityGlyphBackground('parcel', '#afa0ff')).toMatchObject({
      'background-fit': 'none',
      'background-width': '38px',
      'background-height': '38px',
    });
    for (const kind of KINDS.filter((kind) => kind !== 'parcel')) {
      expect(entityGlyphBackground(kind, '#afa0ff')).toMatchObject({
        'background-fit': 'none',
        'background-width': '30.4px',
        'background-height': '30.4px',
      });
    }
  });
});
