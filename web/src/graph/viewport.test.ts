import { describe, expect, it } from 'vitest';
import {
  GRAPH_REFERENCE_VIEW,
  GRAPH_VIEW_WIDTH,
  GRAPH_ZOOM_STEP,
  clampGraphZoom,
  graphFitPadding,
  graphFitPanX,
  graphLodForViewWidth,
  graphViewport,
  graphZoomLimits,
} from './viewport';

describe('graph viewport', () => {
  it('keeps the mobile reference inset and adds desktop overlay clearance', () => {
    expect(graphFitPadding(390)).toBe(36);
    expect(graphFitPadding(880)).toBe(36);
    expect(graphFitPadding(881)).toBe(100);
    expect(graphFitPadding(1176)).toBe(100);
    expect(graphFitPanX(390)).toBe(0);
    expect(graphFitPanX(880)).toBe(0);
    expect(graphFitPanX(881)).toBe(-30);
    expect(graphFitPanX(1176)).toBe(-30);
  });

  it('uses the reference view and exact LOD boundaries', () => {
    expect(graphLodForViewWidth(1249.999)).toBe('full');
    expect(graphLodForViewWidth(1250)).toBe('mid');
    expect(graphLodForViewWidth(1799.999)).toBe('mid');
    expect(graphLodForViewWidth(1800)).toBe('far');

    const referenceZoom = 2;
    expect(graphViewport(referenceZoom, referenceZoom)).toEqual({
      viewWidth: GRAPH_REFERENCE_VIEW.width,
      lod: 'full',
    });
    expect(graphViewport(referenceZoom * (1072 / 1250), referenceZoom).lod).toBe('mid');
    expect(graphViewport(referenceZoom * (1072 / 1800), referenceZoom).lod).toBe('far');
  });

  it('clamps Cytoscape zoom to the 340–2600 reference-width range', () => {
    const referenceZoom = 2;
    const limits = graphZoomLimits(referenceZoom);

    expect(limits.min / referenceZoom).toBeCloseTo(0.412308, 6);
    expect(limits.max / referenceZoom).toBeCloseTo(3.152941, 6);
    expect(graphViewport(clampGraphZoom(0, referenceZoom), referenceZoom).viewWidth).toBe(
      GRAPH_VIEW_WIDTH.max,
    );
    expect(graphViewport(clampGraphZoom(99, referenceZoom), referenceZoom).viewWidth).toBe(
      GRAPH_VIEW_WIDTH.min,
    );
  });

  it('moves from full to mid to far in two zoom-out button steps', () => {
    const referenceZoom = 1;
    const once = referenceZoom / GRAPH_ZOOM_STEP;
    const twice = once / GRAPH_ZOOM_STEP;

    expect(graphViewport(referenceZoom, referenceZoom).lod).toBe('full');
    expect(graphViewport(once, referenceZoom).lod).toBe('mid');
    expect(graphViewport(twice, referenceZoom).lod).toBe('far');
  });
});
