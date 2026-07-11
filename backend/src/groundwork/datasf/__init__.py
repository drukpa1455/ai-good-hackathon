"""Bounded DataSF query and context-graph compilation primitives."""

from .compiler import DataSFCompileError, DataSFCompiler, parcel_seed
from .models import (
    DataSFArtifact,
    DataSFClient,
    DataSFParcelSeed,
    canonical_projection_bytes,
)
from .registry import (
    DATASET_REGISTRY,
    DatasetSpec,
    DataSFQuery,
    dependent_queries,
    parcel_query,
    validate_parcel_id,
)

__all__ = [
    "DATASET_REGISTRY",
    "DataSFArtifact",
    "DataSFClient",
    "DataSFCompileError",
    "DataSFCompiler",
    "DataSFParcelSeed",
    "DataSFQuery",
    "DatasetSpec",
    "canonical_projection_bytes",
    "dependent_queries",
    "parcel_query",
    "parcel_seed",
    "validate_parcel_id",
]
