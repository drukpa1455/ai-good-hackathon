import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { SiteSummary } from '../contracts';
import { tileSourceForTheme } from '../map/tiles';
import type { Theme } from '../theme';

const PARCEL_COLOR: Record<Theme, string> = {
  dark: '#afa0ff',
  light: '#5b4bc4',
};

function applyTheme(map: maplibregl.Map, theme: Theme) {
  const tileSource = tileSourceForTheme(theme);
  const basemap = map.getSource('basemap') as maplibregl.RasterTileSource | undefined;
  basemap?.setTiles(tileSource.tiles);
  if (map.getLayer('parcel-fill')) {
    map.setPaintProperty('parcel-fill', 'fill-color', PARCEL_COLOR[theme]);
  }
  if (map.getLayer('parcel-line')) {
    map.setPaintProperty('parcel-line', 'line-color', PARCEL_COLOR[theme]);
  }
}

function bboxOf(site: SiteSummary): [[number, number], [number, number]] {
  if (site.geometry.type === 'Polygon') {
    const ring = site.geometry.coordinates[0];
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [x, y] of ring) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    return [
      [minX, minY],
      [maxX, maxY],
    ];
  }
  const { longitude, latitude } = site.centroid;
  return [
    [longitude - 0.001, latitude - 0.001],
    [longitude + 0.001, latitude + 0.001],
  ];
}

/** MapLibre pane: parcel geometry, site marker, visible attribution, focus
 * controls. Tiles come from the single configurable tile module; when tiles
 * fail, geometry/controls/attribution stay on a neutral canvas. Fits bounds
 * on site change only — never recenters after user interaction. */
export function ParcelMap({
  theme,
  site,
  loading,
  onSelectParcel,
}: {
  theme: Theme;
  site: SiteSummary | null;
  loading: boolean;
  onSelectParcel: () => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const selectRef = useRef(onSelectParcel);
  selectRef.current = onSelectParcel;
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;
    const tileSource = tileSourceForTheme(themeRef.current);
    const map = new maplibregl.Map({
      container: hostRef.current,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: 'raster',
            tiles: tileSource.tiles,
            tileSize: tileSource.tileSize,
            attribution: tileSource.attribution,
            maxzoom: tileSource.maxzoom,
          },
        },
        layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
      },
      center: [-122.402, 37.7657],
      zoom: 15.5,
      attributionControl: { compact: false },
    });
    map.on('error', (e) => {
      // Raster tile failures leave the parcel overlay + attribution intact.
      if (String(e?.error?.message ?? '').toLowerCase().includes('tile')) setTilesFailed(true);
    });
    map.on('load', () => {
      map.addSource('parcel', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'parcel-fill',
        type: 'fill',
        source: 'parcel',
        paint: { 'fill-color': PARCEL_COLOR[themeRef.current], 'fill-opacity': 0.16 },
      });
      map.addLayer({
        id: 'parcel-line',
        type: 'line',
        source: 'parcel',
        paint: { 'line-color': PARCEL_COLOR[themeRef.current], 'line-width': 2.5 },
      });
      map.on('click', 'parcel-fill', () => selectRef.current());
      applyTheme(map, themeRef.current);
      syncSite();
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    applyTheme(map, theme);
    setTilesFailed(false);
  }, [theme]);

  const syncSite = () => {
    const map = mapRef.current;
    if (!map || !site) return;
    const src = map.getSource('parcel') as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData({
        type: 'Feature',
        properties: { parcel_id: site.parcel_id },
        geometry: site.geometry,
      });
    }
    map.fitBounds(bboxOf(site), { padding: 60, maxZoom: 17.5, duration: 400 });
  };

  useEffect(() => {
    // Fit bounds when the SITE changes (not on every interaction).
    if (mapRef.current?.isStyleLoaded()) syncSite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.parcel_id]);

  return (
    <>
      <div className="mapcard" data-tiles-failed={tilesFailed}>
        <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--srf2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span className="label">Loading map…</span>
          </div>
        )}
        {tilesFailed && (
          <span
            className="chip chip--warn"
            style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}
          >
            Tiles unavailable — parcel shown on neutral canvas
          </span>
        )}
      </div>
      {/* Map information duplicated textually (accessibility requirement). */}
      <p className="mapnote">
        {site
          ? `${site.address} · parcel ${site.parcel_id} centered at ${site.centroid.longitude.toFixed(
              4,
            )}, ${site.centroid.latitude.toFixed(4)}. Mock rectangle stands in for official parcel geometry.`
          : 'Map loads with the selected site.'}
      </p>
    </>
  );
}
