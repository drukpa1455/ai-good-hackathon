import type { SiteSummary } from '../contracts';

/** Three story cards: address, project type/status line, and one headline
 * housing figure. */
export function SiteSelector({
  sites,
  activeParcelId,
  onSelect,
}: {
  sites: SiteSummary[] | null;
  activeParcelId: string;
  onSelect: (parcelId: string) => void;
}) {
  return (
    <div style={{ padding: '14px 14px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span className="label">Demo sites</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(sites ?? []).map((s) => (
          <button
            key={s.parcel_id}
            className="sitecard"
            aria-pressed={s.parcel_id === activeParcelId}
            aria-label={`${s.name}, ${s.subtitle}, ${s.headline.value} ${s.headline.label}`}
            onClick={() => onSelect(s.parcel_id)}
          >
            <span className="sitecard__name">{s.name}</span>
            <span className="sitecard__sub">
              {s.subtitle} · {s.address.split(',')[0]}
            </span>
            <span className="sitecard__row">
              <span className="chip">{s.subtitle.split('·').pop()?.trim()}</span>
              <span className="sitecard__headline">
                {s.headline.value} {s.headline.label.toLowerCase()}
              </span>
            </span>
          </button>
        ))}
        {!sites && (
          <div className="sitecard" aria-hidden="true" style={{ opacity: 0.5 }}>
            <span className="sitecard__name">Loading sites…</span>
          </div>
        )}
      </div>
    </div>
  );
}
