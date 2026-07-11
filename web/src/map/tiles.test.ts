import { describe, expect, it } from 'vitest';
import { tileSourceForTheme } from './tiles';

describe('tileSourceForTheme', () => {
  it.each([
    ['dark', 'dark_all'],
    ['light', 'light_all'],
  ] as const)('maps %s to the matching CARTO raster style', (theme, style) => {
    const source = tileSourceForTheme(theme);

    expect(source.tiles).toHaveLength(4);
    expect(source.tiles.every((url) => url.includes(`/${style}/`))).toBe(true);
    expect(source.tiles.every((url) => url.startsWith('https://'))).toBe(true);
    expect(source.attribution).toContain('OpenStreetMap');
    expect(source.attribution).toContain('CARTO');
  });
});
