import type { ReleaseSummary } from '../contracts';

/** Persistent but unobtrusive MOCK DATA badge. Rendered whenever the release
 * says it is mock, including an API-served demo release. */
export function MockDataBadge({ release }: { release: ReleaseSummary | null }) {
  if (!release?.mock) return null;
  return <span className="chip chip--warn">Mock data</span>;
}
