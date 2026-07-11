import { ReactNode, useEffect, useState } from 'react';
import type { ReleaseSummary } from '../contracts';
import { MockDataBadge } from './MockDataBadge';

type Theme = 'dark' | 'light';
type MobileTab = 'graph' | 'map' | 'evidence';

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = window.localStorage.getItem('gw-theme');
    return stored === 'light' ? 'light' : 'dark';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('gw-theme', theme);
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

/** Full-height application shell: top bar, site rail, panes, trust strip,
 * evidence drawer overlay, reserved agent corner, mobile tab bars, and the
 * screen-reader announcer. Pure layout — no data access. */
export function AppShell({
  release,
  announce,
  tab,
  mobileBars,
  rail,
  left,
  graph,
  trust,
  drawer,
  agent,
}: {
  release: ReleaseSummary | null;
  announce: string;
  tab: MobileTab;
  mobileBars: ReactNode;
  rail: ReactNode;
  left: ReactNode;
  graph: ReactNode;
  trust: ReactNode;
  drawer: ReactNode;
  agent: ReactNode;
}) {
  const [theme, toggleTheme] = useTheme();
  const [howOpen, setHowOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && howOpen) setHowOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [howOpen]);

  const cutoff = release ? release.source_cutoff_at.replace('T', ' ').slice(0, 16) : '';

  return (
    <div className="shell">
      <div aria-live="polite" role="status" className="visually-hidden">
        {announce}
      </div>

      <header className="topbar">
        <div className="topbar__brand">
          <BrandMark />
          <span className="topbar__wordmark">Groundwork&#8202;SF</span>
        </div>
        <div className="topbar__meta">
          {release && <span className="chip">{release.id}</span>}
          {release && <span className="chip topbar__cutoff">data to {cutoff}</span>}
          <MockDataBadge release={release} />
        </div>
        <div className="topbar__controls">
          <button className="btn" onClick={toggleTheme} title="Toggle light/dark theme">
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button className="btn" onClick={() => setHowOpen(true)}>
            How this works
          </button>
        </div>
      </header>

      <div className="mobilebars">{mobileBars}</div>

      <div className="body">
        <nav className="rail" aria-label="Sites and focus">
          {rail}
        </nav>

        <main className="main">
          <div className="panes" data-tab={tab}>
            <section className="leftcol" aria-label="Map and inspector">
              {left}
            </section>
            <section className="graphpane" aria-label="Context graph">
              {graph}
            </section>
          </div>
          {trust}
          <div className="agentcorner">{agent}</div>
        </main>

        {drawer}

        {howOpen && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--scrim)',
              zIndex: 55,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
            onClick={() => setHowOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="How this works"
              className="statecard__inner"
              style={{ maxWidth: 560, width: '100%', maxHeight: '86%', overflowY: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="label" style={{ fontSize: 12, color: 'var(--tx)' }}>
                  How this works
                </span>
                <button
                  className="btn"
                  style={{ marginLeft: 'auto', width: 36 }}
                  onClick={() => setHowOpen(false)}
                  aria-label="Close"
                  autoFocus
                >
                  ×
                </button>
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--dim)' }}>
                Groundwork SF helps community land trusts, affordable-housing organizations, and
                neighborhood nonprofits read the official public-record context around a San
                Francisco site. Every visible claim belongs to a source-backed context graph, and
                uncertainty stays visible.
              </p>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: 'var(--dim)' }}>
                <li>The graph centers the parcel; every connected entity and fact carries evidence.</li>
                <li>
                  Select any fact to open its evidence record — dataset, record key, observation
                  date, license, and the official source link.
                </li>
                <li>
                  The trust panel reports citation coverage, stale sources, conflicts, and coverage
                  gaps as deterministic graph metrics.
                </li>
              </ol>
              <div
                style={{
                  border: '1px solid var(--brd)',
                  borderRadius: 10,
                  background: 'var(--srf2)',
                  padding: 12,
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: 'var(--fnt)',
                }}
              >
                This is an evidence explorer — not a marketplace, ranking product, valuation tool,
                or recommendation engine. It makes no legal, safety, valuation, or suitability
                conclusions. Mock mode shows normalized design fixtures, never official records.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Small static rendering of the Fibonacci-globe brand mark. */
function BrandMark() {
  const dots: ReactNode[] = [];
  const N = 34;
  const GA = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const r = 14 * Math.sqrt((i + 0.5) / N);
    const a = i * GA;
    dots.push(
      <circle
        key={i}
        cx={15 + r * Math.cos(a)}
        cy={15 + r * Math.sin(a)}
        r={i % 5 === 0 ? 1.4 : 0.9}
        fill="var(--acc)"
        opacity={0.4 + 0.6 * ((i % 7) / 7)}
      />,
    );
  }
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      {dots}
    </svg>
  );
}
