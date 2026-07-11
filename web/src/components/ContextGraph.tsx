import { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import type { ApiError, Assertion, ContextGraph as Ctx } from '../contracts';
import { KIND_META, KIND_ORDER, formatLiteral, kindColorResolved, tokenResolved } from '../kinds';

const W = 980;
const CX = W / 2;
const CY = 380;
const RX = 302;
const RY = 224;

interface Layout {
  nodes: ElementDefinition[];
  edges: ElementDefinition[];
}

/** Deterministic parcel-centered placement: parcel in the middle, other
 * entities on an ellipse in stable kind order, literal assertions as fact
 * satellites around their subject. No random force layout — the same context
 * always produces the same picture. */
function buildElements(ctx: Ctx, staleEntityIds: Set<string>, conflictIds: Set<string>): Layout {
  const nodes: ElementDefinition[] = [];
  const edges: ElementDefinition[] = [];
  const pos = new Map<string, { x: number; y: number; ang: number }>();

  const parcel = ctx.entities.find((e) => e.kind === 'parcel');
  const ring = ctx.entities
    .filter((e) => e.kind !== 'parcel')
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));

  if (parcel) pos.set(parcel.id, { x: CX, y: CY, ang: 0 });
  ring.forEach((e, i) => {
    const ang = ((-90 + (i * 360) / Math.max(ring.length, 1)) * Math.PI) / 180;
    pos.set(e.id, { x: CX + RX * Math.cos(ang), y: CY + RY * Math.sin(ang), ang });
  });

  const degree = new Map<string, number>();
  for (const a of ctx.assertions) {
    if (a.object.kind !== 'entity') continue;
    degree.set(a.subject_id, (degree.get(a.subject_id) ?? 0) + 1);
    degree.set(a.object.entity_id, (degree.get(a.object.entity_id) ?? 0) + 1);
  }

  for (const e of ctx.entities) {
    const p = pos.get(e.id);
    if (!p) continue;
    const stale = staleEntityIds.has(e.id);
    nodes.push({
      data: {
        id: e.id,
        label: e.label,
        sub: `${KIND_META[e.kind].label} · ${e.source_count} src${stale ? ' · STALE' : ''}`,
        kind: e.kind,
        // node size encodes degree only — never value, risk, or desirability
        size: e.kind === 'parcel' ? 74 : 46 + Math.min(degree.get(e.id) ?? 1, 4) * 4,
        stale: stale ? 1 : 0,
      },
      position: { x: p.x, y: p.y },
      classes: `entity kind-${e.kind}${stale ? ' stale' : ''}`,
    });
  }

  // entity→entity assertions become edges (no duplicate edges array needed)
  for (const a of ctx.assertions) {
    if (a.object.kind !== 'entity') continue;
    if (!pos.has(a.subject_id) || !pos.has(a.object.entity_id)) continue;
    edges.push({
      data: {
        id: a.id,
        source: a.subject_id,
        target: a.object.entity_id,
        label: a.predicate_label,
        subjectKind: ctx.entities.find((e) => e.id === a.subject_id)?.kind ?? 'source_record',
      },
      classes: `assert${a.predicate === 'near' ? ' proximity' : ''}`,
    });
  }

  // literal assertions become fact satellites (selectable + citeable)
  const bySubject = new Map<string, Assertion[]>();
  for (const a of ctx.assertions) {
    if (a.object.kind !== 'literal') continue;
    const list = bySubject.get(a.subject_id) ?? [];
    list.push(a);
    bySubject.set(a.subject_id, list);
  }
  for (const [sid, list] of bySubject) {
    const p = pos.get(sid);
    if (!p) continue;
    const isCenter = parcel ? sid === parcel.id : false;
    list.forEach((a, j) => {
      const spread = 0.52;
      const baseAng = isCenter ? (135 * Math.PI) / 180 : p.ang;
      const angOff = (j - (list.length - 1) / 2) * spread;
      const ang = baseAng + angOff;
      const dist = (isCenter ? 118 : 100) + Math.abs(j - (list.length - 1) / 2) * 46;
      const conflicted = conflictIds.has(a.id);
      nodes.push({
        data: {
          id: a.id,
          label: `${a.predicate_label}: ${formatLiteral(a)}${conflicted ? '  ⚠' : ''}`,
          subject: sid,
          conflicted: conflicted ? 1 : 0,
        },
        position: {
          x: p.x + Math.cos(ang) * dist * (isCenter ? 1 : 1.3),
          y: p.y + Math.sin(ang) * dist,
        },
        classes: `fact${conflicted ? ' conflicted' : ''}`,
      });
      edges.push({
        data: { id: `${a.id}-tether`, source: sid, target: a.id },
        classes: 'tether',
      });
    });
  }

  return { nodes, edges };
}

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
        label: 'data(label)',
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
      selector: 'node.entity[sub]',
      style: {
        label: (el: cytoscape.NodeSingular) => `${el.data('label')}\n${el.data('sub')}`,
      } as unknown as cytoscape.Css.Node,
    },
    {
      selector: 'node.stale',
      style: { 'border-style': 'dashed', 'border-color': warn },
    },
    {
      selector: 'node.fact',
      style: {
        shape: 'round-rectangle',
        width: 'label',
        height: 26,
        padding: '8px',
        'background-color': srf2,
        'border-width': 1.2,
        'border-color': brd2,
        label: 'data(label)',
        color: tx,
        'font-family': 'Inconsolata, monospace',
        'font-size': 11.5,
        'text-valign': 'center',
        'text-halign': 'center',
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
        label: 'data(label)',
        color: fnt,
        'font-family': 'Atkinson Hyperlegible Mono, monospace',
        'font-size': 9.5,
        'text-rotation': 'autorotate',
        'text-margin-y': -8,
      },
    },
    { selector: 'edge.proximity', style: { 'line-style': 'dotted' } },
    { selector: 'edge.tether', style: { width: 1, 'line-color': edge, 'curve-style': 'straight' } },
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
    styles.push({
      selector: `node.kind-${kind}`,
      style: { 'border-color': kindColorResolved(kind) },
    });
  }
  return styles;
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
  const [legendOpen, setLegendOpen] = useState(() => window.innerWidth >= 1150);
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const callbacks = useRef({ onSelectEntity, onSelectAssertion, ctx });
  callbacks.current = { onSelectEntity, onSelectAssertion, ctx };

  const isEmpty = !!ctx && !loading && !error && ctx.entities.length === 0;

  const staleEntityIds = useMemo(() => {
    const ids = new Set<string>();
    if (!ctx) return ids;
    for (const d of ctx.diagnostics) {
      if (d.kind !== 'freshness') continue;
      for (const aid of d.assertion_ids) {
        const a = ctx.assertions.find((x) => x.id === aid);
        if (a) ids.add(a.subject_id);
      }
    }
    return ids;
  }, [ctx]);

  const conflictAssertIds = useMemo(() => {
    const ids = new Set<string>();
    if (!ctx) return ids;
    for (const d of ctx.diagnostics) {
      if (d.kind === 'conflict') d.assertion_ids.forEach((id) => ids.add(id));
    }
    return ids;
  }, [ctx]);

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
    cy.on('tap', (evt) => {
      if (evt.target === cy) callbacks.current.onSelectEntity(null);
    });
    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  // Rebuild elements when the context changes (site, focus, mock state, theme).
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !ctx) return;
    const { nodes, edges } = buildElements(ctx, staleEntityIds, conflictAssertIds);
    cy.elements().remove();
    cy.style(cyStyles());
    cy.add([...nodes, ...edges]);
    cy.fit(undefined, 36);

    if (!reducedMotion) {
      // Expansion: entities grow out from the parcel; reduced-motion mode
      // renders the final state immediately (no information difference).
      const parcelPos = { x: CX, y: CY };
      cy.nodes().forEach((n, i) => {
        if (n.hasClass('fact')) {
          n.style('opacity', 0);
          n.delay(280 + i * 24).animate({ style: { opacity: 1 }, duration: 220 });
        } else if (n.id() !== ctx.entities.find((e) => e.kind === 'parcel')?.id) {
          const target = { ...n.position() };
          n.position(parcelPos);
          n.delay(i * 40).animate({ position: target, duration: 380, easing: 'ease-out-cubic' });
        }
      });
      cy.edges().forEach((e, i) => {
        e.style('opacity', 0);
        e.delay(160 + i * 24).animate({ style: { opacity: 1 }, duration: 240 });
      });
    }
  }, [ctx, staleEntityIds, conflictAssertIds, reducedMotion]);

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

  return (
    <>
      <div className="graph-host" ref={hostRef} role="application" aria-label="Context graph canvas" />

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
