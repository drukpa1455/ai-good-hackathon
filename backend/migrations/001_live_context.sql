CREATE TABLE context_store_guard (
    id smallint PRIMARY KEY CHECK (id = 1)
);

INSERT INTO context_store_guard (id) VALUES (1);

CREATE TABLE source_artifacts (
    dataset_id text NOT NULL CHECK (dataset_id ~ '^[a-z0-9]{4}-[a-z0-9]{4}$'),
    sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    object_key text NOT NULL,
    byte_count integer NOT NULL CHECK (byte_count >= 0),
    query_url text NOT NULL,
    license_id text NOT NULL,
    retrieved_at timestamptz NOT NULL,
    source_updated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (dataset_id, sha256, retrieved_at)
);

CREATE TABLE context_snapshots (
    snapshot_sha256 text PRIMARY KEY CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
    parcel_id text NOT NULL CHECK (parcel_id ~ '^[0-9]{7}$'),
    graph_release_id text NOT NULL,
    context jsonb NOT NULL,
    published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    source_cutoff_at timestamptz NOT NULL,
    UNIQUE (parcel_id, graph_release_id)
);

CREATE INDEX context_snapshots_by_parcel
    ON context_snapshots (parcel_id, published_at DESC, snapshot_sha256 DESC);

CREATE TABLE snapshot_evidence (
    snapshot_sha256 text NOT NULL REFERENCES context_snapshots(snapshot_sha256) ON DELETE CASCADE,
    evidence_id text NOT NULL,
    dataset_id text NOT NULL,
    artifact_sha256 text NOT NULL,
    artifact_retrieved_at timestamptz NOT NULL,
    record jsonb NOT NULL,
    PRIMARY KEY (snapshot_sha256, evidence_id),
    FOREIGN KEY (dataset_id, artifact_sha256, artifact_retrieved_at)
        REFERENCES source_artifacts(dataset_id, sha256, retrieved_at)
);

CREATE INDEX snapshot_evidence_by_id
    ON snapshot_evidence (evidence_id, snapshot_sha256);

CREATE TABLE current_contexts (
    parcel_id text PRIMARY KEY CHECK (parcel_id ~ '^[0-9]{7}$'),
    snapshot_sha256 text NOT NULL UNIQUE
        REFERENCES context_snapshots(snapshot_sha256),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE refresh_state (
    parcel_id text PRIMARY KEY CHECK (parcel_id ~ '^[0-9]{7}$'),
    lease_owner uuid,
    lease_generation bigint NOT NULL DEFAULT 0 CHECK (lease_generation >= 0),
    lease_expires_at timestamptz,
    last_started_at timestamptz,
    last_completed_at timestamptz,
    last_error_code text,
    CHECK ((lease_owner IS NULL) = (lease_expires_at IS NULL))
);
