export type GraphLod = 'full' | 'mid' | 'far';

export const GRAPH_REFERENCE_VIEW = {
  x: -36,
  y: 0,
  width: 1072,
  height: 762,
  padding: 36,
  centerX: 490,
  centerY: 362,
  radiusX: 302,
  radiusY: 224,
} as const;

export const GRAPH_VIEW_WIDTH = {
  min: 340,
  mid: 1250,
  far: 1800,
  max: 2600,
} as const;

export const GRAPH_ZOOM_STEP = 1.3;

export function graphFitPadding(hostWidth: number): number {
  return hostWidth > 880 ? 100 : GRAPH_REFERENCE_VIEW.padding;
}

export function graphFitPanX(hostWidth: number): number {
  return hostWidth > 880 ? -30 : 0;
}

export function graphLodForViewWidth(width: number): GraphLod {
  if (width >= GRAPH_VIEW_WIDTH.far) return 'far';
  if (width >= GRAPH_VIEW_WIDTH.mid) return 'mid';
  return 'full';
}

export function graphViewWidth(zoom: number, referenceZoom: number): number {
  const width = GRAPH_REFERENCE_VIEW.width / (zoom / referenceZoom);
  return Math.max(GRAPH_VIEW_WIDTH.min, Math.min(GRAPH_VIEW_WIDTH.max, width));
}

export function graphViewport(zoom: number, referenceZoom: number) {
  const viewWidth = graphViewWidth(zoom, referenceZoom);
  return { viewWidth, lod: graphLodForViewWidth(viewWidth) };
}

export function graphZoomLimits(referenceZoom: number) {
  return {
    min: referenceZoom * (GRAPH_REFERENCE_VIEW.width / GRAPH_VIEW_WIDTH.max),
    max: referenceZoom * (GRAPH_REFERENCE_VIEW.width / GRAPH_VIEW_WIDTH.min),
  };
}

export function clampGraphZoom(zoom: number, referenceZoom: number): number {
  const limits = graphZoomLimits(referenceZoom);
  return Math.max(limits.min, Math.min(limits.max, zoom));
}

export function graphLodAnnouncement(lod: GraphLod): string {
  if (lod === 'mid') return 'Mid detail: facts collapsed to counts';
  if (lod === 'far') return 'Constellation: anchor labels only';
  return 'Full detail: facts and labels shown';
}
