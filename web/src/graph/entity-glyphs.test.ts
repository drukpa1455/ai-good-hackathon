import { describe, expect, it } from 'vitest';
import type { EntityKind } from '../contracts';
import { ENTITY_GLYPH, entityGlyphDataUri } from './entity-glyphs';

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

describe('entity glyphs', () => {
  it('keeps the design-reference symbol assignment explicit', () => {
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

  it('renders a distinct encoded SVG for every entity kind', () => {
    const uris = KINDS.map((kind) => entityGlyphDataUri(kind, '#afa0ff'));
    expect(new Set(uris)).toHaveLength(KINDS.length);
    for (const uri of uris) {
      expect(uri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
      expect(decodeURIComponent(uri)).toContain('viewBox="0 0 76 76"');
    }
  });
});
