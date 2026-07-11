// Tile source configuration lives in exactly one module (map contract).
// Interactive on-screen tiles only; no prefetch, no offline bundling.
// The official OpenStreetMap raster endpoint requires visible attribution.

export interface TileSource {
  tiles: string[];
  tileSize: number;
  attribution: string;
  maxzoom: number;
}

export const OSM_RASTER: TileSource = {
  tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
  tileSize: 256,
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxzoom: 19,
};

export const ACTIVE_TILE_SOURCE: TileSource = OSM_RASTER;
