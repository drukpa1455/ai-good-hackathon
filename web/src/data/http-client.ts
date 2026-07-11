import type {
  ApiError,
  ContextFocus,
  ContextGraph,
  EvidenceRecord,
  PublicRuntimeConfig,
  SiteSummary,
} from '../contracts';
import type { ContextClient } from './client';

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    let err: ApiError;
    try {
      err = (await res.json()) as ApiError;
    } catch {
      err = { code: 'unavailable', message: `HTTP ${res.status}`, request_id: 'unknown' };
    }
    throw err;
  }
  return (await res.json()) as T;
}

/** Maps 1:1 onto the future FastAPI endpoints from the handoff. */
export class HttpContextClient implements ContextClient {
  getRuntimeConfig(): Promise<PublicRuntimeConfig> {
    return get('/api/runtime-config');
  }
  listSites(): Promise<SiteSummary[]> {
    return get('/api/sites');
  }
  getContext(parcelId: string, focus: ContextFocus): Promise<ContextGraph> {
    return get(`/api/sites/${encodeURIComponent(parcelId)}/context?focus=${focus}`);
  }
  getEvidence(evidenceId: string): Promise<EvidenceRecord> {
    return get(`/api/evidence/${encodeURIComponent(evidenceId)}`);
  }
}
