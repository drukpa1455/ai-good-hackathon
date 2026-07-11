import { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape, { Core } from 'cytoscape';
import type { ApiError, Assertion, ContextGraph as Ctx } from '../contracts';
import { entityGlyphBackground } from '../graph/entity-glyphs';
import {
  buildGraphElements,
  diagnosticAssertionIds,
  diagnosticEntityIds,
  planGraphDetail,
} from '../graph/layout';
import {
  GRAPH_REFERENCE_VIEW,
  GRAPH_ZOOM_STEP,
  clampGraphZoom,
  graphFitPadding,
  graphFitPanX,
  graphLodAnnouncement,
  graphViewport,
  graphZoomLimits,
  type GraphLod,
} from '../graph/viewport';
import { KIND_META, kindColorResolved, tokenResolved } from '../kinds';

function cyStyles(): cytoscape.StylesheetStyle[] {
  const tx = tokenResolved('--tx', '#f8f8f2');
  const srf = tokenResolved('--srf', '#111017');
  const srf2 = tokenResolved('--srf2', '#1a1822');
  const fnt = tokenResolved('--fnt', '#77747f');
  const brd2 = tokenResolved('--brd2', '#2e2a3a');
  const edge = tokenResolved('--edge', 'rgba(248,248,242,0.2)');
  const acc = tokenResolved('--acc', '#afa0ff');
  const warn = tokenResolved('--warn', '#ffb86b');

  const styles: cytoscape.StylesheetStyle[] = [
    {
      selector: 'node.entity',
      style: {
        shape: 'ellipse',
        width: 'data(size)',
        height: 'data(size)',
        'background-color': srf,
        'border-width': 2.2,
        label: 'data(displayLabel)',
        color: tx,
        'font-family': 'Inconsolata, monospace',
        'font-size': 13,
        'font-weight': 600,
        'text-valign': 'bottom',
        'text-margin-y': 8,
        'text-wrap': 'wrap',
        'text-max-width': '150',
      },
    },
    {
      selector: 'node.entity.warning',
      style: {
        'outline-color': warn,
        'outline-width': 1.6,
        'outline-style': 'dashed',
        'outline-offset': 5,
      },
    },
    {
      selector: 'node.entity.label-above',
      style: { 'text-valign': 'top', 'text-margin-y': -8 },
    },
    {
      selector: 'node.entity.kind-parcel',
      style: { 'text-halign': 'right', 'text-margin-x': 8 },
    },
    {
      selector: 'node.fact',
      style: {
        shape: 'round-rectangle',
        width: 'data(width)',
        height: 24,
        padding: '0px',
        'background-color': srf2,
        'border-width': 1.2,
        'border-color': brd2,
        label: 'data(label)',
        color: tx,
        'font-family': 'Inconsolata, monospace',
        'font-size': 11.5,
        'text-valign': 'center',
        'text-halign': 'center',
        'text-wrap': 'ellipsis',
        'text-max-width': '208',
      } as unknown as cytoscape.Css.Node,
    },
    {
      selector: 'node.fact.conflicted',
      style: { 'border-color': warn, 'border-width': 2.2 },
    },
    {
      selector: 'edge.assert',
      style: {
        width: 1.3,
        'line-color': edge,
        'curve-style': 'straight',
        label: 'data(displayLabel)',
        color: fnt,
        'font-family': 'Atkinson Hyperlegible Mono, monospace',
        'font-size': 9.5,
        'text-rotation': 'autorotate',
        'text-margin-y': -8,
      },
    },
    { selector: 'edge.proximity', style: { 'line-style': 'dotted' } },
    { selector: 'edge.tether', style: { width: 1, 'line-color': edge, 'curve-style': 'straight' } },
    {
      selector: 'node.fact-count',
      style: {
        shape: 'round-rectangle',
        width: 'data(width)',
        height: 24,
        padding: '0px',
        'background-color': srf,
        'border-width': 1.2,
        'border-color': brd2,
        label: 'data(label)',
        color: fnt,
        'font-family': 'Inconsolata, monospace',
        'font-size': 11.5,
        'font-weight': 500,
        'text-valign': 'center',
        'text-halign': 'center',
      } as unknown as cytoscape.Css.Node,
    },
    {
      selector: 'node.graph-reference-anchor',
      style: { width: 1, height: 1, opacity: 0, events: 'no' },
    },
    {
      selector: '.lod-hidden',
      style: { display: 'none' },
    },
    // selection strengthens evidence lines; width never encodes confidence
    {
      selector: 'node:selected, node.hot',
      style: { 'border-color': acc, 'border-width': 3.2 },
    },
    {
      selector: 'edge.hot',
      style: { width: 2.6, 'line-color': acc, color: tx },
    },
  ];

  for (const kind of Object.keys(KIND_META) as (keyof typeof KIND_META)[]) {
    const color = kindColorResolved(kind);
    styles.push({
      selector: `node.kind-${kind}`,
      style: {
        'border-color': color,
        ...entityGlyphBackground(kind, color),
      } as unknown as cytoscape.Css.Node,
    });
  }
  return styles;
}
function applyGraphDetail(cy: Core, ctx: Ctx, lod: GraphLod, selectedId: string | null) {
  const plan = planGraphDetail(ctx, lod, selectedId);

  cy.nodes('.entity').forEach((node) => {
    const showFarLabel =
      node.data('kind') === 'parcel' || node.id() === plan.selectedSubjectId;
    const label = lod === 'full' ? node.data('fullLabel') : lod === 'mid' || showFarLabel ? node.data('label') : '';
    node.data('displayLabel', label);
  });

  cy.edges('.assert').forEach((edge) => {
    const selectedEdge =
      !!plan.selectedSubjectId &&
      (edge.data('source') === plan.selectedSubjectId || edge.data('target') === plan.selectedSubjectId);
    edge.data('displayLabel', lod === 'full' || (lod === 'mid' && selectedEdge) ? edge.data('label') : '');
  });

  cy.nodes('.fact').forEach((node) => {
    setLodHidden(node, !plan.visibleFactIds.has(node.id()));
  });
  cy.edges('.fact-tether').forEach((edge) => {
    setLodHidden(edge, !plan.visibleFactIds.has(edge.data('factId')));
  });
  cy.nodes('.fact-count').forEach((node) => {
    setLodHidden(node, !plan.visibleCountSubjectIds.has(node.data('subject')));
  });
  cy.edges('.count-tether').forEach((edge) => {
    setLodHidden(edge, !plan.visibleCountSubjectIds.has(edge.data('subject')));
  });

  return plan;
}

function setLodHidden(element: cytoscape.SingularElementArgument, hidden: boolean) {
  if (hidden) element.addClass('lod-hidden');
  else element.removeClass('lod-hidden');
}

function fitReferenceView(cy: Core, hostWidth: number): number {
  cy.minZoom(0.0001);
  cy.maxZoom(10_000);
  cy.fit(cy.nodes('.graph-reference-anchor'), graphFitPadding(hostWidth));
  cy.panBy({ x: graphFitPanX(hostWidth), y: 0 });
  const referenceZoom = cy.zoom();
  const limits = graphZoomLimits(referenceZoom);
  cy.minZoom(limits.min);
  cy.maxZoom(limits.max);
  return referenceZoom;
}

export function ContextGraph({
  ctx,
  loading,
  error,
  selectedId,
  onSelectEntity,
  onSelectAssertion,
  onRetry,
  emptyLinks,
  onEmptyLink,
}: {
  ctx: Ctx | null;
  loading: boolean;
  error: ApiError | null;
  selectedId: string | null;
  onSelectEntity: (id: string | null) => void;
  onSelectAssertion: (a: Assertion) => void;
  onRetry: () => void;
  emptyLinks: string[];
  onEmptyLink: (parcelId: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const referenceZoomRef = useRef<number | null>(null);
  const lodRef = useRef<GraphLod>('full');
  const [legendOpen, setLegendOpen] = useState(() => window.innerWidth >= 1150);
  const [lod, setLod] = useState<GraphLod>('full');
  const [graphAnnouncement, setGraphAnnouncement] = useState('');
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const callbacks = useRef({ onSelectEntity, onSelectAssertion, ctx, selectedId });
  callbacks.current = { onSelectEntity, onSelectAssertion, ctx, selectedId };

  const isEmpty = !!ctx && !loading && !error && ctx.entities.length === 0;

  const staleEntityIds = useMemo(
    () => (ctx ? diagnosticEntityIds(ctx, 'freshness') : new Set<string>()),
    [ctx],
  );
  const conflictEntityIds = useMemo(
    () => (ctx ? diagnosticEntityIds(ctx, 'conflict') : new Set<string>()),
    [ctx],
  );
  const conflictAssertionIds = useMemo(
    () => (ctx ? diagnosticAssertionIds(ctx, 'conflict') : new Set<string>()),
    [ctx],
  );
  const detailPlan = useMemo(
    () => (ctx ? planGraphDetail(ctx, lod, selectedId) : null),
    [ctx, lod, selectedId],
  );

  useEffect(() => {
    if (!hostRef.current || cyRef.current) return;
    const cy = cytoscape({
      container: hostRef.current,
      elements: [],
      style: cyStyles(),
      layout: { name: 'preset' },
      wheelSensitivity: 0.2,
      autoungrabify: true,
    });
    cy.on('tap', 'node.entity', (evt) => {
      const id = evt.target.id();
      callbacks.current.onSelectEntity(id);
    });
    cy.on('tap', 'node.fact', (evt) => {
      const a = callbacks.current.ctx?.assertions.find((x) => x.id === evt.target.id());
      if (a) callbacks.current.onSelectAssertion(a);
    });
    cy.on('tap', 'node.fact-count', (evt) => {
      const subjectId = evt.target.data('subject');
      const entity = callbacks.current.ctx?.entities.find((item) => item.id === subjectId);
      callbacks.current.onSelectEntity(subjectId);
      setGraphAnnouncement(`Selected ${entity?.label ?? 'entity'}; facts expanded`);
    });
    cy.on('tap', (evt) => {
      if (evt.target === cy) callbacks.current.onSelectEntity(null);
    });
    cy.on('zoom', () => {
      const referenceZoom = referenceZoomRef.current;
      if (!referenceZoom) return;
      const nextLod = graphViewport(cy.zoom(), referenceZoom).lod;
      if (nextLod === lodRef.current) return;
      lodRef.current = nextLod;
      setLod(nextLod);
      setGraphAnnouncement(graphLodAnnouncement(nextLod));
    });
    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const cy = cyRef.current;
    if (!host || !cy || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => cy.resize());
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => cy.style(cyStyles()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  // Rebuild and reset the reference viewport when site, focus, or mock state changes.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !ctx) return;
    const { nodes, edges } = buildGraphElements(ctx, {
      staleEntityIds,
      conflictEntityIds,
      conflictAssertionIds,
    });
    cy.elements().remove();
    cy.style(cyStyles());
    cy.add([...nodes, ...edges]);
    referenceZoomRef.current = null;
    const referenceZoom = fitReferenceView(cy, hostRef.current?.clientWidth ?? 0);
    referenceZoomRef.current = referenceZoom;
    lodRef.current = 'full';
    setLod('full');
    setGraphAnnouncement(graphLodAnnouncement('full'));
    applyGraphDetail(cy, ctx, 'full', callbacks.current.selectedId);

    if (!reducedMotion) {
      // Expansion: entities grow out from the parcel; reduced-motion mode
      // renders the final state immediately (no information difference).
      const parcelPos = { x: GRAPH_REFERENCE_VIEW.centerX, y: GRAPH_REFERENCE_VIEW.centerY };
      cy.nodes('.entity, .fact').forEach((n, i) => {
        if (n.hasClass('fact')) {
          n.style('opacity', 0);
          n.delay(280 + i * 24).animate({ style: { opacity: 1 }, duration: 220 });
        } else if (n.id() !== ctx.entities.find((e) => e.kind === 'parcel')?.id) {
          const target = { ...n.position() };
          n.position(parcelPos);
          n.delay(i * 40).animate({ position: target, duration: 380, easing: 'ease-out-cubic' });
        }
      });
      cy.edges(':visible').forEach((e, i) => {
        e.style('opacity', 0);
        e.delay(160 + i * 24).animate({ style: { opacity: 1 }, duration: 240 });
      });
    }
  }, [
    ctx,
    staleEntityIds,
    conflictEntityIds,
    conflictAssertionIds,
    reducedMotion,
  ]);

  // Selection highlighting: strengthen touched evidence lines.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass('hot');
    if (!selectedId) return;
    const el = cy.getElementById(selectedId);
    if (el.nonempty()) {
      el.addClass('hot');
      if (el.isNode()) el.connectedEdges().addClass('hot');
    }
  }, [selectedId, ctx]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !ctx) return;
    applyGraphDetail(cy, ctx, lod, selectedId);
  }, [ctx, lod, selectedId]);

  const zoomGraph = (factor: number, direction: 'in' | 'out') => {
    const cy = cyRef.current;
    const referenceZoom = referenceZoomRef.current;
    const host = hostRef.current;
    if (!cy || !referenceZoom || !host) return;
    const previousLod = lodRef.current;
    cy.zoom({
      level: clampGraphZoom(cy.zoom() * factor, referenceZoom),
      renderedPosition: { x: host.clientWidth / 2, y: host.clientHeight / 2 },
    });
    if (lodRef.current === previousLod) setGraphAnnouncement(`Graph zoomed ${direction}`);
  };

  const resetGraphView = () => {
    const cy = cyRef.current;
    const host = hostRef.current;
    if (!cy || !host) return;
    referenceZoomRef.current = null;
    referenceZoomRef.current = fitReferenceView(cy, host.clientWidth);
    lodRef.current = 'full';
    setLod('full');
    if (ctx) applyGraphDetail(cy, ctx, 'full', selectedId);
    setGraphAnnouncement(`Graph view reset. ${graphLodAnnouncement('full')}`);
  };

  const detailSummary = detailPlan
    ? lod === 'full'
      ? `Full detail. ${detailPlan.visibleFactIds.size} facts shown.`
      : lod === 'mid'
        ? `Mid detail. ${detailPlan.visibleCountSubjectIds.size} fact groups collapsed.${
            detailPlan.selectedSubjectId
              ? ` ${detailPlan.visibleFactIds.size} selected facts expanded.`
              : ''
          }`
        : `Far detail. Anchor labels only.${
            detailPlan.selectedSubjectId
              ? ` ${detailPlan.visibleFactIds.size} selected facts expanded.`
              : ''
          }`
    : '';
  const showGraphControls = !!ctx && !loading && !error && !isEmpty;

  return (
    <>
      <div
        className="graph-host"
        ref={hostRef}
        role="application"
        aria-label="Context graph canvas. Drag to pan; scroll or pinch to zoom."
        data-lod={lod}
        data-visible-facts={detailPlan?.visibleFactIds.size ?? 0}
        data-visible-count-pills={detailPlan?.visibleCountSubjectIds.size ?? 0}
        data-selected-subject={detailPlan?.selectedSubjectId ?? undefined}
      />
      <div className="visually-hidden" role="status" aria-live="polite">
        {graphAnnouncement}
      </div>
      <div className="visually-hidden" aria-label="Graph detail summary">
        {detailSummary}
      </div>

      {loading && (
        <div className="statecard" role="status">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div className="spinner" aria-hidden="true" />
            <span className="label">Compiling context…</span>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="statecard" role="alert">
          <div className="statecard__inner">
            <span className="label" style={{ color: 'var(--warn)' }}>
              Error · {error.code}
            </span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{error.message}</span>
            <span style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>
              The map, graph, and evidence stay usable once loaded. Retry, or continue with the last
              good release.
            </span>
            <span className="label">request_id: {error.request_id}</span>
            <button className="btn btn--primary" style={{ alignSelf: 'flex-start' }} onClick={onRetry}>
              Retry
            </button>
          </div>
        </div>
      )}

      {isEmpty && (
        <div className="statecard">
          <div className="statecard__inner">
            <span className="label">Empty context</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              No compiled context for parcel {ctx?.site.parcel_id} in {ctx?.release.id}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>
              The parcel is valid, but this graph release compiled no context for it. Try one of the
              demo sites:
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {emptyLinks.map((p) => (
                <button key={p} className="btn" onClick={() => onEmptyLink(p)}>
                  Parcel {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showGraphControls && (
        <div className="graph-zoom" role="group" aria-label="Graph zoom controls">
          <button
            type="button"
            aria-label="Zoom graph in"
            onClick={() => zoomGraph(GRAPH_ZOOM_STEP, 'in')}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom graph out"
            onClick={() => zoomGraph(1 / GRAPH_ZOOM_STEP, 'out')}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Reset graph view"
            title="Reset graph view"
            onClick={resetGraphView}
          >
            ⌖
          </button>
          <span className="graph-zoom__lod" aria-hidden="true">
            {lod}
          </span>
        </div>
      )}

      <div className="legendbox">
        <button className="btn" aria-expanded={legendOpen} onClick={() => setLegendOpen((o) => !o)}>
          {legendOpen ? 'Legend ×' : 'Legend'}
        </button>
        {legendOpen && (
          <div className="legendbox__panel">
            <span className="label" style={{ fontSize: 9 }}>
              Entity kinds
            </span>
            {(Object.keys(KIND_META) as (keyof typeof KIND_META)[]).map((k) => (
              <div key={k} className="legendrow">
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    border: `2px solid var(${KIND_META[k].cssVar})`,
                    flex: 'none',
                  }}
                />
                {KIND_META[k].label}
              </div>
            ))}
            <span className="label" style={{ fontSize: 9, marginTop: 4 }}>
              Treatments
            </span>
            <div className="legendrow">
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  border: '1.6px dashed var(--warn)',
                  flex: 'none',
                }}
              />
              Stale source · labeled
            </div>
            <div className="legendrow">
              <span style={{ width: 14, borderTop: '2px dotted var(--fnt)', flex: 'none' }} />
              Proximity-only link
            </div>
            <div className="legendrow">
              <span
                className="chip chip--warn"
                style={{ fontSize: 8.5, padding: '1px 4px', flex: 'none' }}
              >
                ⚠
              </span>
              Same-time conflict
            </div>
            <span style={{ fontSize: 10.5, color: 'var(--fnt2)', lineHeight: 1.5, marginTop: 2 }}>
              Node size = connections. Never value or risk.
            </span>
          </div>
        )}
      </div>
    </>
  );
}
