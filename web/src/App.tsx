import { useEffect, useMemo, useState } from 'react';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import type {
  ApiError,
  Assertion,
  ContextFocus,
  ContextGraph as ContextGraphData,
  Entity,
  EvidenceRecord,
  PublicRuntimeConfig,
  SiteSummary,
} from './contracts';
import { isContextFocus } from './contracts';
import { contextClient } from './data/client';
import { AppShell } from './components/AppShell';
import { SiteSelector } from './components/SiteSelector';
import { FocusControl } from './components/FocusControl';
import { ParcelMap } from './components/ParcelMap';
import { ContextGraph } from './components/ContextGraph';
import { EvidenceDrawer } from './components/EvidenceDrawer';
import { TrustPanel } from './components/TrustPanel';
import { SuggestedQuestions } from './components/SuggestedQuestions';
import { AgentWidget } from './components/AgentWidget';
import { KIND_META, formatLiteral, kindColor } from './kinds';

export const DEFAULT_SITE = '3956008';
const DEMO_SITES = ['3956008', '3501006', '0161014'];

type MobileTab = 'graph' | 'map' | 'evidence';

function isApiError(e: unknown): e is ApiError {
  return !!e && typeof e === 'object' && 'code' in e && 'message' in e;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/sites/${DEFAULT_SITE}`} replace />} />
      <Route path="/sites/:parcelId" element={<SiteRoute />} />
      <Route path="/evidence/:evidenceId" element={<EvidenceRoute />} />
      <Route path="*" element={<NotFound kind="route" />} />
    </Routes>
  );
}

/** /evidence/:evidenceId resolves the owning site from
 * EvidenceRecord.parcel_ids, then defers to the site view with the drawer
 * selection in the query string. */
function EvidenceRoute() {
  const { evidenceId } = useParams();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    if (!evidenceId) return;
    contextClient
      .getEvidence(evidenceId)
      .then((rec) => {
        if (!live) return;
        const parcel = rec.parcel_ids[0] ?? DEFAULT_SITE;
        navigate(`/sites/${parcel}?ev=${encodeURIComponent(rec.id)}`, { replace: true });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [evidenceId, navigate]);

  if (failed) return <NotFound kind="evidence" id={evidenceId} />;
  return (
    <div className="statecard" role="status">
      <div className="statecard__inner">
        <span className="label">Resolving evidence…</span>
      </div>
    </div>
  );
}

export function NotFound({ kind, id }: { kind: 'route' | 'site' | 'evidence'; id?: string }) {
  const what =
    kind === 'evidence' ? `evidence record ${id ?? ''}` : kind === 'site' ? `site ${id ?? ''}` : 'page';
  return (
    <main className="statecard">
      <div className="statecard__inner">
        <span className="label" style={{ color: 'var(--warn)' }}>
          Not found
        </span>
        <span style={{ fontSize: 15, fontWeight: 600 }}>
          No {what} exists in this graph release.
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>
          Try one of the three demo sites:
        </span>
        <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} aria-label="Demo sites">
          {DEMO_SITES.map((p) => (
            <Link key={p} to={`/sites/${p}`} className="btn" style={{ textDecoration: 'none' }}>
              Parcel {p}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}

function SiteRoute() {
  const { parcelId = DEFAULT_SITE } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ---- the four pieces of navigation state (URL is the source of truth) ----
  const focusParam = searchParams.get('focus');
  const focus: ContextFocus = isContextFocus(focusParam) ? focusParam : 'overview';
  const selectedId = searchParams.get('sel'); // entity OR assertion id
  const selectedEvidenceId = searchParams.get('ev');

  const [sites, setSites] = useState<SiteSummary[] | null>(null);
  const [runtime, setRuntime] = useState<PublicRuntimeConfig | null>(null);
  const [ctx, setCtx] = useState<ContextGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRecord | null>(null);
  const [announce, setAnnounce] = useState('');
  const [tab, setTab] = useState<MobileTab>('graph');

  useEffect(() => {
    let live = true;
    contextClient.listSites().then(
      (s) => live && setSites(s),
      (e) => live && isApiError(e) && setError(e),
    );
    contextClient.getRuntimeConfig().then((c) => live && setRuntime(c));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    contextClient.getContext(parcelId, focus).then(
      (c) => {
        if (!live) return;
        setCtx(c);
        setLoading(false);
        setAnnounce(`${c.site.name} loaded, focus ${focus}`);
      },
      (e) => {
        if (!live) return;
        setLoading(false);
        setError(isApiError(e) ? e : { code: 'unavailable', message: String(e), request_id: 'unknown' });
      },
    );
    return () => {
      live = false;
    };
  }, [parcelId, focus]);

  useEffect(() => {
    let live = true;
    if (!selectedEvidenceId) {
      setEvidence(null);
      return;
    }
    contextClient.getEvidence(selectedEvidenceId).then(
      (rec) => {
        if (!live) return;
        setEvidence(rec);
        setAnnounce(`Evidence opened: ${rec.title}`);
        setTab('evidence');
      },
      () => live && setEvidence(null),
    );
    return () => {
      live = false;
    };
  }, [selectedEvidenceId]);

  const patchParams = (patch: Record<string, string | null>, push = false) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setSearchParams(next, { replace: !push });
  };

  const selectSite = (id: string) => {
    if (id === parcelId) return;
    const q = focus !== 'overview' ? `?focus=${focus}` : '';
    navigate(`/sites/${id}${q}`);
  };
  const setFocus = (f: ContextFocus) => {
    patchParams({ focus: f === 'overview' ? null : f, sel: null });
    setAnnounce(`Focus changed to ${f}`);
  };
  const selectNode = (id: string | null) => {
    patchParams({ sel: id });
    if (id && ctx) {
      const ent = ctx.entities.find((e) => e.id === id);
      if (ent) setAnnounce(`Selected ${ent.label}`);
      setTab('map'); // mobile: inspector lives on the map tab
    }
  };
  const openEvidence = (evidenceId: string, assertionId?: string) => {
    patchParams({ ev: evidenceId, sel: assertionId ?? selectedId }, true);
  };
  const closeDrawer = () => {
    patchParams({ ev: null }, true);
    setAnnounce('Evidence drawer closed');
  };
  const selectAssertion = (a: Assertion) => {
    if (a.object.kind === 'literal') {
      openEvidence(a.evidence_ids[0], a.id);
    } else {
      selectNode(a.object.entity_id);
    }
  };

  const unknownSite = error?.code === 'not_found';
  if (unknownSite) return <NotFound kind="site" id={parcelId} />;

  const selectedEntity: Entity | null =
    (selectedId && ctx?.entities.find((e) => e.id === selectedId)) || null;

  return (
    <AppShell
      release={ctx?.release ?? null}
      announce={announce}
      tab={tab}
      mobileBars={
        <>
          <div className="mobilebars__row" role="group" aria-label="Sites">
            {(sites ?? []).map((s) => (
              <button
                key={s.parcel_id}
                className="sitecard"
                style={{ width: 'auto', flex: 'none', minHeight: 48 }}
                aria-pressed={s.parcel_id === parcelId}
                onClick={() => selectSite(s.parcel_id)}
              >
                <span className="sitecard__name">{s.name}</span>
                <span className="sitecard__headline">
                  {s.headline.value} {s.headline.label.toLowerCase()}
                </span>
              </button>
            ))}
          </div>
          <div className="mobilebars__row">
            <FocusControl focus={focus} onFocus={setFocus} />
          </div>
          {ctx && (
            <div className="mobilebars__row" style={{ alignItems: 'center' }}>
              <span className="label">
                {ctx.trust.citation_coverage_percent}% cited · {ctx.trust.freshness_warning_count}{' '}
                stale · {ctx.trust.conflict_count} conflicts
              </span>
            </div>
          )}
          <div className="mobilebars__tabs" role="tablist" aria-label="Panes">
            {(['graph', 'map', 'evidence'] as MobileTab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className="tabbtn"
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </>
      }
      rail={
        <>
          <SiteSelector sites={sites} activeParcelId={parcelId} onSelect={selectSite} />
          <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="label">Focus</span>
            <FocusControl focus={focus} onFocus={setFocus} />
          </div>
        </>
      }
      renderMap={(theme) => (
        <ParcelMap
          theme={theme}
          site={ctx?.site ?? null}
          loading={loading}
          onSelectParcel={() =>
            ctx && selectNode(ctx.entities.find((e) => e.kind === 'parcel')?.id ?? null)
          }
        />
      )}
      inspector={
        <Inspector
          ctx={ctx}
          selectedEntity={selectedEntity}
          selectedId={selectedId}
          onSelectNode={selectNode}
          onSelectAssertion={selectAssertion}
        />
      }
      helpQuestions={
        <SuggestedQuestions agentEnabled={runtime?.agent.enabled ?? true} />
      }
      graph={
        <ContextGraph
          ctx={ctx}
          loading={loading}
          error={error}
          selectedId={selectedId}
          onSelectEntity={selectNode}
          onSelectAssertion={selectAssertion}
          onRetry={() => {
            // re-run the same fetch; a full reload also clears ?mockState=error
            setLoading(true);
            setError(null);
            contextClient.getContext(parcelId, focus).then(
              (c) => {
                setCtx(c);
                setLoading(false);
              },
              (e) => {
                setLoading(false);
                setError(isApiError(e) ? e : null);
              },
            );
          }}
          emptyLinks={DEMO_SITES}
          onEmptyLink={selectSite}
        />
      }
      trust={
        ctx ? (
          <TrustPanel
            trust={ctx.trust}
            diagnostics={ctx.diagnostics}
            onOpenEvidence={(id) => openEvidence(id)}
          />
        ) : null
      }
      drawer={
        selectedEvidenceId && evidence && ctx ? (
          <EvidenceDrawer
            evidence={evidence}
            ctx={ctx}
            selectedId={selectedId}
            onClose={closeDrawer}
            onSelectAssertion={(a) => {
              patchParams({ sel: a.id });
              setAnnounce(`Highlighted assertion ${a.predicate_label}`);
            }}
          />
        ) : null
      }
      agent={<AgentWidget config={runtime} />}
    />
  );
}

/** Selected-entity details plus the parallel keyboard list for graph nodes. */
function Inspector({
  ctx,
  selectedEntity,
  selectedId,
  onSelectNode,
  onSelectAssertion,
}: {
  ctx: ContextGraphData | null;
  selectedEntity: Entity | null;
  selectedId: string | null;
  onSelectNode: (id: string | null) => void;
  onSelectAssertion: (a: Assertion) => void;
}) {
  const rows = useMemo(() => {
    if (!ctx || !selectedEntity) return [];
    return ctx.assertions.filter(
      (a) =>
        a.subject_id === selectedEntity.id ||
        (a.object.kind === 'entity' && a.object.entity_id === selectedEntity.id),
    );
  }, [ctx, selectedEntity]);

  if (!ctx) return <div className="inspector" />;

  const entityLabel = (id: string) => ctx.entities.find((e) => e.id === id)?.label ?? id;

  return (
    <div className="inspector">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="label">{selectedEntity ? 'Selected entity' : 'Entities (keyboard list)'}</span>
        {selectedEntity && (
          <button className="btn" style={{ marginLeft: 'auto', minHeight: 28 }} onClick={() => onSelectNode(null)}>
            All entities
          </button>
        )}
      </div>

      {selectedEntity ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="kinddot" style={{ background: kindColor(selectedEntity.kind) }} />
            <span
              className="label"
              style={{ color: kindColor(selectedEntity.kind), letterSpacing: '0.14em' }}
            >
              {KIND_META[selectedEntity.kind].label}
            </span>
            <span className="label" style={{ marginLeft: 'auto' }}>
              {selectedEntity.source_count} source{selectedEntity.source_count === 1 ? '' : 's'}
            </span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.3 }}>{selectedEntity.label}</span>
          {selectedEntity.description && (
            <span style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--dim)' }}>
              {selectedEntity.description}
            </span>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 2 }}>
            {rows.map((a) => {
              const lit = a.object.kind === 'literal';
              const val = lit
                ? formatLiteral(a)
                : a.subject_id === selectedEntity.id && a.object.kind === 'entity'
                  ? entityLabel(a.object.entity_id)
                  : entityLabel(a.subject_id);
              return (
                <button
                  key={a.id}
                  className="assertrow"
                  data-selected={selectedId === a.id}
                  onClick={() => onSelectAssertion(a)}
                  aria-label={
                    lit ? `${a.predicate_label} ${val}, open evidence` : `${a.predicate_label} ${val}, select entity`
                  }
                >
                  <span className="assertrow__pred">{a.predicate_label}</span>
                  <span className="assertrow__val">{val}</span>
                  <span className="assertrow__tag">{lit ? `${a.evidence_ids.length} ev ↗` : 'entity'}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div role="list" aria-label="Graph entities" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {ctx.entities.map((e) => (
            <button key={e.id} role="listitem" className="assertrow" onClick={() => onSelectNode(e.id)}>
              <span className="kinddot" style={{ background: kindColor(e.kind) }} />
              <span className="assertrow__val">{e.label}</span>
              <span className="assertrow__tag" style={{ color: 'var(--fnt2)' }}>
                {e.source_count} src
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
