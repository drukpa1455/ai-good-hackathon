import type { ReleaseSummary } from '../contracts';

/** Persistent but unobtrusive MOCK DATA badge. Rendered only when the release
 * says it is mock; API mode never shows it. */
export function MockDataBadge({ release }: { release: ReleaseSummary | null }) {
  if (!release?.mock) return null;
  return <span className="chip chip--warn">Mock data</span>;
}
