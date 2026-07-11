import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteSummary } from '../contracts';

const mapMock = vi.hoisted(() => ({
  construct: vi.fn(),
  addSource: vi.fn(),
  addLayer: vi.fn(),
  setTiles: vi.fn(),
  setData: vi.fn(),
  setPaintProperty: vi.fn(),
  fitBounds: vi.fn(),
  remove: vi.fn(),
  layers: new Set<string>(),
  loaded: false,
  load: null as null | (() => void),
}));

vi.mock('maplibre-gl', () => {
  class Map {
    constructor(options: unknown) {
      mapMock.construct(options);
    }

    on(event: string, layerOrHandler: string | (() => void), handler?: () => void) {
      if (event === 'load' && typeof layerOrHandler === 'function') mapMock.load = layerOrHandler;
      void handler;
    }

    remove() {
      mapMock.remove();
    }

    addSource(id: string, source: unknown) {
      mapMock.addSource(id, source);
    }

    addLayer(layer: { id: string }) {
      mapMock.layers.add(layer.id);
      mapMock.addLayer(layer);
    }

    getSource(id: string) {
      if (id === 'basemap') return { setTiles: mapMock.setTiles };
      if (id === 'parcel') return { setData: mapMock.setData };
      return undefined;
    }

    getLayer(id: string) {
      return mapMock.layers.has(id) ? { id } : undefined;
    }

    setPaintProperty(layer: string, property: string, value: string) {
      mapMock.setPaintProperty(layer, property, value);
    }

    fitBounds(bounds: unknown, options: unknown) {
      mapMock.fitBounds(bounds, options);
    }

    isStyleLoaded() {
      return mapMock.loaded;
    }
  }

  return { default: { Map }, Map };
});
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

import { ParcelMap } from './ParcelMap';

const SITE: SiteSummary = {
  parcel_id: '3956008',
  name: '300 De Haro Street',
  address: '300 De Haro Street',
  subtitle: 'Demo site',
  story: 'Demo story',
  centroid: { longitude: -122.402, latitude: 37.7657 },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-122.403, 37.765],
        [-122.401, 37.765],
        [-122.401, 37.766],
        [-122.403, 37.766],
        [-122.403, 37.765],
      ],
    ],
  },
  headline: { label: 'Affordable units', value: '425' },
};

describe('ParcelMap theme updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mapMock.layers.clear();
    mapMock.loaded = false;
    mapMock.load = null;
  });

  it('updates tiles and parcel paint in place without refitting or replacing geometry', () => {
    const { rerender } = render(
      <ParcelMap theme="dark" site={SITE} loading={false} onSelectParcel={() => undefined} />,
    );

    expect(mapMock.construct).toHaveBeenCalledTimes(1);
    const style = (mapMock.construct.mock.calls[0][0] as {
      style: { sources: { basemap: { tiles: string[]; attribution: string } } };
    }).style;
    expect(style.sources.basemap.tiles.every((url) => url.includes('/dark_all/'))).toBe(true);
    expect(style.sources.basemap.attribution).toContain('OpenStreetMap');
    expect(style.sources.basemap.attribution).toContain('CARTO');

    act(() => {
      mapMock.loaded = true;
      mapMock.load?.();
    });
    expect(mapMock.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'parcel-fill',
        paint: { 'fill-color': '#afa0ff', 'fill-opacity': 0.16 },
      }),
    );
    expect(mapMock.setData).toHaveBeenCalledTimes(1);
    expect(mapMock.fitBounds).toHaveBeenCalledTimes(1);

    rerender(
      <ParcelMap theme="light" site={SITE} loading={false} onSelectParcel={() => undefined} />,
    );

    expect(mapMock.construct).toHaveBeenCalledTimes(1);
    const lightTiles = mapMock.setTiles.mock.calls.at(-1)?.[0] as string[];
    expect(lightTiles.every((url) => url.includes('/light_all/'))).toBe(true);
    expect(mapMock.setPaintProperty).toHaveBeenCalledWith(
      'parcel-fill',
      'fill-color',
      '#5b4bc4',
    );
    expect(mapMock.setPaintProperty).toHaveBeenCalledWith(
      'parcel-line',
      'line-color',
      '#5b4bc4',
    );
    expect(mapMock.setData).toHaveBeenCalledTimes(1);
    expect(mapMock.fitBounds).toHaveBeenCalledTimes(1);
  });
});
