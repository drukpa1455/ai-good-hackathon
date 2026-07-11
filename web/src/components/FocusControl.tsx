import type { ContextFocus } from '../contracts';
import { FOCUS_VALUES } from '../contracts';

/** Focus filters the CURRENT context; it never fetches an unrelated graph. */
export function FocusControl({
  focus,
  onFocus,
}: {
  focus: ContextFocus;
  onFocus: (f: ContextFocus) => void;
}) {
  return (
    <div role="group" aria-label="Context focus" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {FOCUS_VALUES.map((f) => (
        <button key={f} className="focuschip" aria-pressed={focus === f} onClick={() => onFocus(f)}>
          {f}
        </button>
      ))}
    </div>
  );
}
