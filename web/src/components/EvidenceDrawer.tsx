import { useEffect, useRef, useState } from 'react';
import type { Assertion, ContextGraph as Ctx, EvidenceRecord } from '../contracts';
import { formatLiteral, kindColor } from '../kinds';

/** Right-hand evidence drawer. Displays the full evidence record per the
 * handoff (dataset, record key, fields table, dates, scope, license, hash,
 * source link, supported assertions). Traps focus; Escape closes; focus
 * returns to the initiating control. */
export function EvidenceDrawer({
  evidence,
  ctx,
  selectedId,
  onClose,
  onSelectAssertion,
}: {
  evidence: EvidenceRecord;
  ctx: Ctx;
  selectedId: string | null;
  onClose: () => void;
  onSelectAssertion: (a: Assertion) => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    restoreRef.current = (document.activeElement as HTMLElement) ?? null;
    const el = ref.current;
    el?.querySelector<HTMLElement>('[data-close]')?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      // minimal focus trap
      const focusables = el.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      restoreRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evidence.id]);

  const stale = ctx.diagnostics.some(
    (d) => d.kind === 'freshness' && d.evidence_ids.includes(evidence.id),
  );
  const supports = evidence.assertion_ids
    .map((id) => ctx.assertions.find((a) => a.id === id))
    .filter((a): a is Assertion => !!a);
  const entityLabel = (id: string) => ctx.entities.find((e) => e.id === id)?.label ?? id;
  const fmtTs = (s: string | null) => (s ? s.replace('T', ' ').slice(0, 16) : 'unknown');

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside ref={ref} className="drawer" role="dialog" aria-modal="true" aria-label="Evidence record">
        <div className="drawer__head">
          <span className="kinddot" style={{ background: kindColor('source_record') }} />
          <span className="label" style={{ fontSize: 10.5 }}>
            Evidence record
          </span>
          <button
            data-close
            className="btn"
            style={{ marginLeft: 'auto', width: 36 }}
            onClick={onClose}
            aria-label="Close evidence drawer"
          >
            ×
          </button>
        </div>

        <div className="drawer__body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 16.5, fontWeight: 700, lineHeight: 1.3 }}>{evidence.title}</span>
            <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>
              {evidence.dataset_name} <span style={{ color: 'var(--fnt2)' }}>· {evidence.dataset_id}</span>
            </span>
            <span style={{ fontFamily: 'var(--font-label)', fontSize: 11, color: 'var(--fnt)' }}>
              record key: {evidence.record_key}
            </span>
          </div>

          {evidence.scope_note && (
            <div
              style={{
                border: `1px solid ${stale ? 'var(--warn)' : 'var(--brd2)'}`,
                background: stale ? 'var(--warnbg)' : 'var(--srf2)',
                color: stale ? 'var(--warn)' : 'var(--dim)',
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: 12,
                lineHeight: 1.55,
              }}
            >
              {evidence.scope_note}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="metacell">
              <span className="label" style={{ fontSize: 8.5 }}>
                Observed (retrieved)
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{fmtTs(evidence.retrieved_at)}</span>
            </div>
            <div className="metacell" style={stale ? { borderColor: 'var(--warn)' } : undefined}>
              <span className="label" style={{ fontSize: 8.5 }}>
                Source updated
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: stale ? 'var(--warn)' : 'var(--tx)' }}>
                {fmtTs(evidence.source_updated_at)}
                {stale ? ' · stale' : ''}
              </span>
            </div>
            <div className="metacell">
              <span className="label" style={{ fontSize: 8.5 }}>
                License
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{evidence.license_id}</span>
            </div>
            <div className="metacell">
              <span className="label" style={{ fontSize: 8.5 }}>
                Artifact sha256
              </span>
              <button
                style={{
                  textAlign: 'left',
                  padding: 0,
                  color: 'var(--acc)',
                  fontFamily: 'var(--font-label)',
                  fontSize: 11.5,
                }}
                title="Copy full hash"
                onClick={() => {
                  void navigator.clipboard?.writeText(evidence.artifact_sha256).catch(() => undefined);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? 'copied ✓ ' : ''}
                {evidence.artifact_sha256.slice(0, 12)}…
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="label">Fields used</span>
            <div className="fieldtable">
              {Object.entries(evidence.fields).map(([k, v]) => (
                <div key={k} className="fieldtable__row">
                  <span className="fieldtable__k">{k}</span>
                  <span className="fieldtable__v">{v === null ? '—' : String(v)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="label">Supports these assertions</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {supports.map((a) => {
                const subj = ctx.entities.find((e) => e.id === a.subject_id);
                const val =
                  a.object.kind === 'literal' ? formatLiteral(a) : entityLabel(a.object.entity_id);
                return (
                  <button
                    key={a.id}
                    className="assertrow"
                    data-selected={selectedId === a.id}
                    style={{ background: 'var(--srf2)' }}
                    onClick={() => onSelectAssertion(a)}
                  >
                    <span
                      className="kinddot"
                      style={{ width: 8, height: 8, background: subj ? kindColor(subj.kind) : 'var(--fnt)' }}
                    />
                    <span className="assertrow__val">
                      {subj?.label} · {a.predicate_label} · {val}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <a
            className="btn btn--primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 42,
              textDecoration: 'none',
            }}
            href={evidence.record_url ?? evidence.source_url}
            target="_blank"
            rel="noreferrer"
          >
            Open official source ↗
          </a>
        </div>
      </aside>
    </>
  );
}
