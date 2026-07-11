const QUESTIONS = [
  'What changed at 300 De Haro, and what remains uncertain?',
  'Which records support the affordable-unit count at 1939 Market?',
  'Which sources for 758 Pacific are historical or stale?',
  'What do nearby 311 reports tell us—and what do they not prove?',
];

/** Suggested questions live beside — never inside — the DigitalOcean widget.
 * Tapping copies the question so the user can paste it into the agent. */
export function SuggestedQuestions({ agentEnabled }: { agentEnabled: boolean }) {
  return (
    <div
      style={{
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        borderTop: '1px solid var(--brd)',
        marginTop: 10,
      }}
    >
      <span className="label">Ask the agent</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => {
              void navigator.clipboard?.writeText(q).catch(() => undefined);
            }}
            title="Copy question for the agent widget"
            style={{
              textAlign: 'left',
              padding: '9px 11px',
              borderRadius: 10,
              border: '1px solid var(--brd)',
              background: 'var(--srf2)',
              color: 'var(--dim)',
              fontSize: 12.5,
              lineHeight: 1.45,
            }}
          >
            {q}
          </button>
        ))}
      </div>
      <span style={{ fontSize: 11, color: 'var(--fnt2)', lineHeight: 1.5 }}>
        {agentEnabled
          ? 'Questions are suggestions for the agent widget in the corner. Tap one to copy it.'
          : 'Agent unavailable; explore the evidence graph — every claim stays inspectable without chat.'}
      </span>
    </div>
  );
}
