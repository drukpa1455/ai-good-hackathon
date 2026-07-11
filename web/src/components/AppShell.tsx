import { ReactNode, useEffect, useRef, useState } from 'react';
import type { ReleaseSummary } from '../contracts';
import type { Theme } from '../theme';
import { BrandMark } from './BrandMark';
import { MockDataBadge } from './MockDataBadge';

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

/** Full-height application shell: top bar, folding site rail, full-bleed graph,
 * corner surfaces, trust strip, drawer, agent boundary, mobile tabs, and the
 * screen-reader announcer. Pure layout — no data access. */
export function AppShell({
  release,
  announce,
  tab,
  mobileBars,
  rail,
  renderMap,
  inspector,
  graph,
  trust,
  drawer,
  agent,
  helpQuestions,
}: {
  release: ReleaseSummary | null;
  announce: string;
  tab: MobileTab;
  mobileBars: ReactNode;
  rail: ReactNode;
  renderMap: (theme: Theme) => ReactNode;
  inspector: ReactNode;
  graph: ReactNode;
  trust: ReactNode;
  drawer: ReactNode;
  agent: ReactNode;
  helpQuestions: ReactNode;
}) {
  const [theme, toggleTheme] = useTheme();
  const [howOpen, setHowOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const helpRef = useRef<HTMLDivElement | null>(null);
  const helpTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!howOpen) return;
    const help = helpRef.current;
    const helpTrigger = helpTriggerRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setHowOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !help) return;
      const focusables = help.querySelectorAll<HTMLElement>(
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
      helpTrigger?.focus();
    };
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
          <span className="topbar__divider" aria-hidden="true" />
          <span className="topbar__subtitle">Site context graph</span>
        </div>
        <div className="topbar__meta">
          {release && (
            <span className="chip topbar__release">
              <span className="topbar__release-dot" aria-hidden="true" />
              {release.id} · to {cutoff}
            </span>
          )}
          <MockDataBadge release={release} />
        </div>
        <div className="topbar__controls">
          <button className="btn" onClick={toggleTheme} title="Toggle light/dark theme">
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button
            ref={helpTriggerRef}
            className="btn btn--primary"
            onClick={() => setHowOpen(true)}
          >
            Help
          </button>
        </div>
      </header>

      <div className="mobilebars">{mobileBars}</div>

      <div className="body" data-rail-open={railOpen}>
        <nav className="rail" aria-label="Sites and focus" data-open={railOpen}>
          <div id="site-rail-content" className="rail__content" hidden={!railOpen}>
            {rail}
          </div>
          {!railOpen && <span className="rail__folded-label">Sites · focus</span>}
          <button
            className="rail__toggle"
            type="button"
            aria-label={railOpen ? 'Fold sites and focus' : 'Open sites and focus'}
            aria-controls="site-rail-content"
            aria-expanded={railOpen}
            onClick={() => setRailOpen((open) => !open)}
          >
            {railOpen ? '‹' : '›'}
          </button>
        </nav>

        <main className="main">
          <div className="panes" data-tab={tab}>
            <section className="graphpane" aria-label="Context graph">
              {graph}
            </section>
            <section className="inspectorcorner" aria-label="Entities and assertions">
              {inspector}
            </section>
            <section className="mapcorner" aria-label="Parcel map">
              {renderMap(theme)}
            </section>
          </div>
          {trust}
          <div className="agentcorner">{agent}</div>
        </main>

        {drawer}

        {howOpen && (
          <div className="help-scrim" onClick={() => setHowOpen(false)}>
            <div
              ref={helpRef}
              role="dialog"
              aria-modal="true"
              aria-label="Help"
              className="help-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="help-panel__head">
                <span className="label help-panel__title">
                  Groundwork SF · Help
                </span>
                <button
                  className="btn"
                  onClick={() => setHowOpen(false)}
                  aria-label="Close help"
                  autoFocus
                >
                  ×
                </button>
              </div>
              <p className="help-panel__mission">
                Groundwork SF helps community land trusts, affordable-housing organizations, and
                neighborhood nonprofits read the official public-record context around a San
                Francisco site. Every visible claim belongs to a source-backed context graph, and
                uncertainty stays visible.
              </p>
              <ol className="help-panel__steps">
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
              {helpQuestions}
              <div className="help-panel__scope">
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
