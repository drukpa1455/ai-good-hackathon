// Frozen public types from docs/frontend-design-handoff.md plus their local
// boundary-validation helpers. Backend changes preserve these shapes.

export type ContextFocus =
  | 'overview'
  | 'housing'
  | 'permits'
  | 'hazards'
  | 'neighborhood';

export type EntityKind =
  | 'parcel'
  | 'development_project'
  | 'permit'
  | 'assessment_series'
  | 'housing_program'
  | 'hazard_map'
  | 'neighborhood_signal'
  | 'source_record';

export type DiagnosticKind =
  | 'freshness'
  | 'conflict'
  | 'coverage_gap'
  | 'proximity_only';

export interface Point {
  longitude: number;
  latitude: number;
}

export type Position = [longitude: number, latitude: number];

export type GeoJsonGeometry =
  | { type: 'Point'; coordinates: Position }
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] };

export interface ReleaseSummary {
  id: string;
  created_at: string;
  source_cutoff_at: string;
  compiler_version: string;
  mock: boolean;
}

export interface SiteSummary {
  parcel_id: string;
  name: string;
  address: string;
  subtitle: string;
  story: string;
  centroid: Point;
  geometry: GeoJsonGeometry;
  headline: {
    label: string;
    value: string;
  };
}

export interface Entity {
  id: string;
  kind: EntityKind;
  label: string;
  description: string | null;
  geometry: GeoJsonGeometry | null;
  source_count: number;
}

export type AssertionObject =
  | { kind: 'entity'; entity_id: string }
  | {
      kind: 'literal';
      value: string | number | boolean;
      datatype: 'string' | 'integer' | 'decimal' | 'boolean' | 'date' | 'datetime';
      unit: string | null;
    };

export interface Assertion {
  id: string;
  subject_id: string;
  predicate: string;
  predicate_label: string;
  category: ContextFocus | 'identity';
  object: AssertionObject;
  effective_at: string | null;
  observed_at: string;
  evidence_ids: string[];
}

export interface EvidenceRecord {
  id: string;
  dataset_id: string;
  dataset_name: string;
  title: string;
  record_key: string;
  source_url: string;
  record_url: string | null;
  license_id: string;
  retrieved_at: string;
  source_updated_at: string | null;
  artifact_sha256: string;
  scope_note: string | null;
  parcel_ids: string[];
  assertion_ids: string[];
  fields: Record<string, string | number | boolean | null>;
}

export interface Diagnostic {
  id: string;
  kind: DiagnosticKind;
  severity: 'info' | 'warning';
  title: string;
  detail: string;
  assertion_ids: string[];
  evidence_ids: string[];
}

export interface AgentEvaluationSummary {
  status: 'passed' | 'failed' | 'not_run';
  evaluated_at: string | null;
  graph_release_id: string | null;
  agent_config_sha256: string | null;
  passed_cases: number;
  total_cases: number;
}

export interface TrustSummary {
  graph_release_id: string;
  source_count: number;
  assertion_count: number;
  citation_coverage_percent: number;
  freshness_warning_count: number;
  conflict_count: number;
  coverage_gap_count: number;
  proximity_only_count: number;
  latest_agent_evaluation: AgentEvaluationSummary;
}

export interface ContextGraph {
  schema_version: '1.0';
  release: ReleaseSummary;
  site: SiteSummary;
  focus: ContextFocus;
  entities: Entity[];
  assertions: Assertion[];
  evidence: EvidenceRecord[];
  diagnostics: Diagnostic[];
  trust: TrustSummary;
}

export interface PublicRuntimeConfig {
  data_mode: 'mock' | 'api';
  agent: {
    enabled: boolean;
    script_url: string | null;
    agent_id: string | null;
    chatbot_id: string | null;
    name: string;
    starting_message: string;
    primary_color: string;
    secondary_color: string;
    button_background_color: string;
  };
}

export interface ApiError {
  code: 'not_found' | 'invalid_focus' | 'context_too_large' | 'unavailable';
  message: string;
  request_id: string;
}

export const FOCUS_VALUES: ContextFocus[] = [
  'overview',
  'housing',
  'permits',
  'hazards',
  'neighborhood',
];

export function isContextFocus(v: string | null | undefined): v is ContextFocus {
  return !!v && (FOCUS_VALUES as string[]).includes(v);
}
