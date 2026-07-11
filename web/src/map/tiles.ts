// Tile source configuration lives in exactly one module (map contract).
// Interactive on-screen tiles only; no prefetch or offline bundling.

import type { Theme } from '../theme';

export interface TileSource {
  tiles: string[];
  tileSize: number;
  attribution: string;
  maxzoom: number;
}

const CARTO_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · ' +
  '© <a href="https://carto.com/attributions">CARTO</a>';

function cartoRaster(style: 'dark_all' | 'light_all'): TileSource {
  return {
    tiles: ['a', 'b', 'c', 'd'].map(
      (subdomain) =>
        `https://${subdomain}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}.png`,
    ),
    tileSize: 256,
    attribution: CARTO_ATTRIBUTION,
    maxzoom: 19,
  };
}

const CARTO_BY_THEME: Record<Theme, TileSource> = {
  dark: cartoRaster('dark_all'),
  light: cartoRaster('light_all'),
};

export function tileSourceForTheme(theme: Theme): TileSource {
  return CARTO_BY_THEME[theme];
}
