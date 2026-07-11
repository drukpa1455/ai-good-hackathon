import { useState } from 'react';

const QUESTIONS = [
  'What changed at 300 De Haro, and what remains uncertain?',
  'Which records support the affordable-unit count at 1939 Market?',
  'Which sources for 758 Pacific are historical or stale?',
  'What do nearby 311 reports tell us—and what do they not prove?',
];

/** Suggested questions live in Help — never inside — the DigitalOcean widget.
 * Tapping copies the question so the user can paste it into the agent. */
export function SuggestedQuestions({ agentEnabled }: { agentEnabled: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copyQuestion = (question: string) => {
    if (!navigator.clipboard) {
      setCopied(null);
      return;
    }
    void navigator.clipboard
      .writeText(question)
      .then(() => setCopied(question))
      .catch(() => setCopied(null));
  };

  return (
    <div className="suggestedquestions">
      <span className="label">Try asking the agent</span>
      <div className="suggestedquestions__list">
        {QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => copyQuestion(q)}
            title="Copy question for the agent widget"
            aria-label={`Copy suggested question: ${q}`}
            className="suggestedquestions__question"
          >
            <span>{q}</span>
            <span className="suggestedquestions__copy">{copied === q ? 'Copied' : 'Copy'}</span>
          </button>
        ))}
      </div>
      <span className="suggestedquestions__note" aria-live="polite">
        {agentEnabled
          ? copied
            ? 'Question copied. Paste it into the agent widget in the corner.'
            : 'Copy a question, then paste it into the agent widget in the corner.'
          : 'Agent unavailable; explore the evidence graph — every claim stays inspectable without chat.'}
      </span>
    </div>
  );
}
