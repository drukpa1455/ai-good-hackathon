import type {
  ContextFocus,
  ContextGraph,
  EvidenceRecord,
  PublicRuntimeConfig,
  SiteSummary,
} from '../contracts';

/**
 * The single data boundary. Components receive data through this interface
 * only; mock-versus-HTTP selection happens once in `client.ts`. Components
 * never inspect VITE_DATA_MODE and never import fixtures.
 */
export interface ContextClient {
  getRuntimeConfig(): Promise<PublicRuntimeConfig>;
  listSites(): Promise<SiteSummary[]>;
  getContext(parcelId: string, focus: ContextFocus): Promise<ContextGraph>;
  getEvidence(evidenceId: string): Promise<EvidenceRecord>;
}

import { MockContextClient } from './mock-client';
import { HttpContextClient } from './http-client';

const mode = import.meta.env.VITE_DATA_MODE === 'api' ? 'api' : 'mock';

export const contextClient: ContextClient =
  mode === 'api' ? new HttpContextClient() : new MockContextClient();
