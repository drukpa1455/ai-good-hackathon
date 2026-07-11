import { useState } from 'react';
import type { Diagnostic, TrustSummary } from '../contracts';

const DIAG_TAG: Record<Diagnostic['kind'], string> = {
  freshness: 'Stale',
  conflict: 'Conflict',
  coverage_gap: 'Gap',
  proximity_only: 'Proximity',
};

/** Persistent trust strip + expandable diagnostics panel. Everything shown
 * here is a deterministic graph metric; the agent-evaluation block is a FIXED
 * evaluation, never a live retrieval trace. */
export function TrustPanel({
  trust,
  diagnostics,
  onOpenEvidence,
}: {
  trust: TrustSummary;
  diagnostics: Diagnostic[];
  onOpenEvidence: (evidenceId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ev = trust.latest_agent_evaluation;

  const metrics: { value: string | number; label: string; warn?: boolean; accent?: boolean }[] = [
    { value: `${trust.citation_coverage_percent}%`, label: 'citation coverage', accent: true },
    { value: trust.source_count, label: 'evidence records' },
    { value: trust.assertion_count, label: 'assertions' },
    { value: trust.freshness_warning_count, label: 'freshness warnings', warn: trust.freshness_warning_count > 0 },
    { value: trust.conflict_count, label: 'conflicts', warn: trust.conflict_count > 0 },
    { value: trust.coverage_gap_count, label: 'coverage gaps', warn: trust.coverage_gap_count > 0 },
    { value: trust.proximity_only_count, label: 'proximity-only' },
    { value: trust.graph_release_id.replace('mock-release-', 'r'), label: 'graph release', accent: true },
  ];

  return (
    <>
      <footer className="truststrip">
        <span className="label" style={{ letterSpacing: '0.12em' }}>
          Trust
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
          {metrics.slice(0, 7).map((m) => (
            <span key={m.label} className="truststrip__metric">
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 13.5,
                  color: m.warn ? 'var(--warn)' : m.accent ? 'var(--k-development_project)' : 'var(--tx)',
                }}
              >
                {m.value}
              </span>
              <span className="label" style={{ fontSize: 9.5, letterSpacing: '0.1em' }}>
                {m.label.replace('citation coverage', 'cited').replace('evidence records', 'sources')}
              </span>
            </span>
          ))}
        </div>
        <button
          className="btn"
          style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Close diagnostics' : 'Diagnostics'}
        </button>
      </footer>

      {open && (
        <div className="trustpanel" role="dialog" aria-label="Trust diagnostics">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="label" style={{ fontSize: 11, color: 'var(--tx)', letterSpacing: '0.2em' }}>
              Trust · deterministic graph metrics
            </span>
            <span className="label">{trust.graph_release_id}</span>
            <button
              className="btn"
              style={{ marginLeft: 'auto', width: 32 }}
              aria-label="Close trust panel"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="metricgrid">
            {metrics.map((m) => (
              <div key={m.label} className="metriccell">
                <span
                  style={{
                    fontSize: 19,
                    fontWeight: 700,
                    color: m.warn ? 'var(--warn)' : m.accent ? 'var(--acc)' : 'var(--tx)',
                  }}
                >
                  {m.value}
                </span>
                <span className="label" style={{ fontSize: 9, lineHeight: 1.4 }}>
                  {m.label}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span className="label">Diagnostics</span>
            {diagnostics.map((d) => (
              <div key={d.id} className="diagrow">
                <span
                  className="chip"
                  style={{
                    color: d.severity === 'warning' ? 'var(--warn)' : 'var(--fnt)',
                    borderColor: d.severity === 'warning' ? 'var(--warn)' : 'var(--brd)',
                    flex: 'none',
                    marginTop: 1,
                  }}
                >
                  {DIAG_TAG[d.kind]}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{d.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5 }}>{d.detail}</span>
                </div>
                {d.evidence_ids.length > 0 && (
                  <button
                    className="btn"
                    style={{ marginLeft: 'auto', flex: 'none' }}
                    onClick={() => {
                      setOpen(false);
                      onOpenEvidence(d.evidence_ids[0]);
                    }}
                  >
                    Evidence
                  </button>
                )}
              </div>
            ))}
            {diagnostics.length === 0 && (
              <span style={{ fontSize: 12.5, color: 'var(--fnt)' }}>
                No diagnostics for this context.
              </span>
            )}
          </div>

          <div
            style={{
              border: '1px solid var(--brd)',
              borderRadius: 10,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              background: 'var(--srf2)',
            }}
          >
            <span className="label">Latest fixed agent evaluation</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span
                className="chip"
                style={{
                  color: ev.status === 'passed' ? 'var(--k-development_project)' : 'var(--warn)',
                  borderColor: ev.status === 'passed' ? 'var(--k-development_project)' : 'var(--warn)',
                }}
              >
                {ev.status}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {ev.passed_cases}/{ev.total_cases} cases
              </span>
              <span className="label" style={{ letterSpacing: '0.06em', textTransform: 'none' }}>
                eval {ev.evaluated_at?.replace('T', ' ').slice(0, 16) ?? '—'} · {ev.graph_release_id ?? '—'} ·
                cfg {ev.agent_config_sha256?.slice(0, 10) ?? '—'}…
              </span>
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--fnt)', lineHeight: 1.5 }}>
              Fixed evaluation of the agent against this graph release — not a live retrieval trace
              or current chatbot activity.
            </span>
          </div>
        </div>
      )}
    </>
  );
}
