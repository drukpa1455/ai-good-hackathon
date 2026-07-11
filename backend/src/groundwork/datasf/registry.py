from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from types import MappingProxyType
from urllib.parse import urlencode

from ..contracts import Point

DATA_SF_RESOURCE_ROOT = "https://data.sfgov.org/resource"
PARCEL_ID_PATTERN = re.compile(r"^[0-9]{7}$")


@dataclass(frozen=True)
class DatasetSpec:
    id: str
    name: str
    license_id: str
    select: str
    output_fields: frozenset[str]
    row_limit: int

    @property
    def source_url(self) -> str:
        return f"https://data.sfgov.org/d/{self.id}"


@dataclass(frozen=True)
class DataSFQuery:
    dataset: DatasetSpec
    parameters: tuple[tuple[str, str], ...]

    @property
    def dataset_id(self) -> str:
        return self.dataset.id

    @property
    def url(self) -> str:
        return f"{DATA_SF_RESOURCE_ROOT}/{self.dataset.id}.json?{urlencode(self.parameters)}"


_SPECS = (
    DatasetSpec(
        id="acdm-wktn",
        name="Parcels – Active and Retired",
        license_id="PDDL-1.0",
        select=(
            "blklot,block_num,lot_num,from_address_num,to_address_num,street_name,"
            "street_type,active,in_asr_secured_roll,zoning_code,zoning_district,"
            "analysis_neighborhood,centroid_latitude,centroid_longitude,shape,"
            "data_as_of,data_loaded_at"
        ),
        output_fields=frozenset(
            {
                "blklot",
                "block_num",
                "lot_num",
                "from_address_num",
                "to_address_num",
                "street_name",
                "street_type",
                "active",
                "in_asr_secured_roll",
                "zoning_code",
                "zoning_district",
                "analysis_neighborhood",
                "centroid_latitude",
                "centroid_longitude",
                "shape",
                "data_as_of",
                "data_loaded_at",
            }
        ),
        row_limit=1,
    ),
    DatasetSpec(
        id="6jgi-cpb4",
        name="San Francisco Development Pipeline",
        license_id="CC0-1.0",
        select=(
            "blklot,nameaddr,current_status,current_status_date,proposed_units,"
            "pipeline_affordable_units,description_planning,description_dbi,bpa_no,"
            "zoning_district,nhood41,latitude,longitude"
        ),
        output_fields=frozenset(
            {
                "blklot",
                "nameaddr",
                "current_status",
                "current_status_date",
                "proposed_units",
                "pipeline_affordable_units",
                "description_planning",
                "description_dbi",
                "bpa_no",
                "zoning_district",
                "nhood41",
                "latitude",
                "longitude",
            }
        ),
        row_limit=1,
    ),
    DatasetSpec(
        id="i98e-djp9",
        name="Building Permits",
        license_id="PDDL-1.0",
        select=(
            "permit_number,permit_type_definition,description,status,status_date,"
            "filed_date,issued_date,completed_date,proposed_units,site_permit,"
            "data_as_of,data_loaded_at"
        ),
        output_fields=frozenset(
            {
                "permit_number",
                "permit_type_definition",
                "description",
                "status",
                "status_date",
                "filed_date",
                "issued_date",
                "completed_date",
                "proposed_units",
                "site_permit",
                "data_as_of",
                "data_loaded_at",
            }
        ),
        row_limit=5,
    ),
    DatasetSpec(
        id="wv5m-vpq2",
        name="Assessor Historical Secured Property Tax Rolls",
        license_id="PDDL-1.0",
        select=(
            "closed_roll_year,parcel_number,block,lot,use_code,assessed_land_value,"
            "assessed_improvement_value,property_class_code_definition,number_of_units,"
            "zoning_code,data_as_of,data_loaded_at"
        ),
        output_fields=frozenset(
            {
                "closed_roll_year",
                "parcel_number",
                "block",
                "lot",
                "use_code",
                "assessed_land_value",
                "assessed_improvement_value",
                "property_class_code_definition",
                "number_of_units",
                "zoning_code",
                "data_as_of",
                "data_loaded_at",
            }
        ),
        row_limit=9,
    ),
    DatasetSpec(
        id="fizh-zaxt",
        name="Affordable Housing Bonus Program Eligible Parcels",
        license_id="PDDL-1.0",
        select="mapblklot,zoning_sim,heightlimi",
        output_fields=frozenset({"mapblklot", "zoning_sim", "heightlimi"}),
        row_limit=1,
    ),
    DatasetSpec(
        id="jzu3-4yxp",
        name="100-Year Storm Flood Risk Zone (July 2022)",
        license_id="PDDL-1.0",
        select=(
            "count(*) as intersection_count,max(data_as_of) as data_as_of,"
            "max(data_loaded_at) as data_loaded_at"
        ),
        output_fields=frozenset({"intersection_count", "data_as_of", "data_loaded_at"}),
        row_limit=1,
    ),
    DatasetSpec(
        id="vw6y-z8j6",
        name="311 Cases",
        license_id="PDDL-1.0",
        select=(
            "count(*) as case_count,max(updated_datetime) as latest_updated_at,"
            "max(data_as_of) as data_as_of,max(data_loaded_at) as data_loaded_at"
        ),
        output_fields=frozenset(
            {"case_count", "latest_updated_at", "data_as_of", "data_loaded_at"}
        ),
        row_limit=1,
    ),
)

DATASET_REGISTRY = MappingProxyType({spec.id: spec for spec in _SPECS})


def validate_parcel_id(value: str) -> str:
    if not PARCEL_ID_PATTERN.fullmatch(value):
        raise ValueError("DataSF parcel id must contain exactly seven digits")
    return value


def parcel_query(parcel_id: str) -> DataSFQuery:
    parcel_id = validate_parcel_id(parcel_id)
    spec = DATASET_REGISTRY["acdm-wktn"]
    return _query(
        spec,
        ("$where", f"blklot='{parcel_id}' and active=true"),
    )


def dependent_queries(
    parcel_id: str,
    centroid: Point,
    as_of: date | datetime,
) -> tuple[DataSFQuery, ...]:
    parcel_id = validate_parcel_id(parcel_id)
    block, lot = parcel_id[:4], parcel_id[4:]
    longitude = _coordinate(centroid.longitude)
    latitude = _coordinate(centroid.latitude)
    cutoff = (
        (as_of - timedelta(days=90)).date()
        if isinstance(as_of, datetime)
        else as_of - timedelta(days=90)
    )

    return (
        _query(
            DATASET_REGISTRY["6jgi-cpb4"],
            ("$where", f"blklot='{parcel_id}'"),
            ("$order", "current_status_date DESC"),
        ),
        _query(
            DATASET_REGISTRY["i98e-djp9"],
            ("$where", f"block='{block}' and lot='{lot}'"),
            ("$order", "status_date DESC"),
        ),
        _query(
            DATASET_REGISTRY["wv5m-vpq2"],
            ("$where", f"block='{block}' and lot='{lot}'"),
            ("$order", "closed_roll_year DESC"),
        ),
        _query(
            DATASET_REGISTRY["fizh-zaxt"],
            ("$where", f"mapblklot='{parcel_id}'"),
        ),
        _query(
            DATASET_REGISTRY["jzu3-4yxp"],
            ("$where", f"intersects(the_geom, 'POINT ({longitude} {latitude})')"),
        ),
        _query(
            DATASET_REGISTRY["vw6y-z8j6"],
            (
                "$where",
                "within_circle(point_geom, "
                f"{latitude}, {longitude}, 150) and requested_datetime >= "
                f"'{cutoff.isoformat()}T00:00:00.000'",
            ),
        ),
    )


def _query(spec: DatasetSpec, *parameters: tuple[str, str]) -> DataSFQuery:
    return DataSFQuery(
        dataset=spec,
        parameters=(("$select", spec.select), *parameters, ("$limit", str(spec.row_limit))),
    )


def _coordinate(value: float) -> str:
    return f"{value:.8f}".rstrip("0").rstrip(".")
