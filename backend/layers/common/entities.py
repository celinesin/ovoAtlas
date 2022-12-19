from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import List, Optional

from dataclasses_json import dataclass_json


# TODO: copy and paste the docs for these


class DatasetStatusKey(str, Enum):
    UPLOAD = "upload"
    VALIDATION = "validation"
    CXG = "cxg"
    RDS = "rds"
    H5AD = "h5ad"
    PROCESSING = "processing"


class DatasetStatusGeneric:
    pass


class DatasetProcessingStatus(DatasetStatusGeneric, Enum):
    """
    Enumerates the status of processing a dataset.

    INITIALIZED = Dataset id created, and awaiting upload.
    PENDING = Processing has not started
    SUCCESS = Processing succeeded
    FAILURE = Processing failed
    """

    INITIALIZED = "INITIALIZED"
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"


class DatasetUploadStatus(DatasetStatusGeneric, Enum):
    NA = "NA"
    WAITING = "WAITING"
    UPLOADING = "UPLOADING"
    UPLOADED = "UPLOADED"
    FAILED = "FAILED"
    CANCEL_PENDING = "CANCEL PENDING"
    CANCELED = "CANCELED"


class DatasetValidationStatus(DatasetStatusGeneric, Enum):
    NA = "NA"
    VALIDATING = "VALIDATING"
    VALID = "VALID"
    INVALID = "INVALID"


class DatasetConversionStatus(DatasetStatusGeneric, Enum):
    NA = "NA"
    CONVERTING = "CONVERTING"
    CONVERTED = "CONVERTED"
    UPLOADING = "UPLOADING"
    UPLOADED = "UPLOADED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class CollectionLinkType(str, Enum):
    DOI = "doi"
    RAW_DATA = "raw_data"
    PROTOCOL = "protocol"
    LAB_WEBSITE = "lab_website"
    OTHER = "other"
    DATA_SOURCE = "data_source"


class DatasetArtifactType(str, Enum):
    RAW_H5AD = "raw_h5ad"
    H5AD = "h5ad"
    RDS = "rds"
    CXG = "cxg"


@dataclass_json
@dataclass
class DatasetStatus:
    upload_status: Optional[DatasetUploadStatus]
    validation_status: Optional[DatasetValidationStatus]
    cxg_status: Optional[DatasetConversionStatus]
    rds_status: Optional[DatasetConversionStatus]
    h5ad_status: Optional[DatasetConversionStatus]
    processing_status: Optional[DatasetProcessingStatus]
    validation_message: Optional[str] = None

    @staticmethod
    def empty():
        return DatasetStatus(None, None, None, None, None, None)


@dataclass
class CollectionId:
    id: str

    def __repr__(self) -> str:
        return self.id


@dataclass
class CollectionVersionId:
    id: str

    def __repr__(self) -> str:
        return self.id


@dataclass
class DatasetId:
    id: str

    def __repr__(self) -> str:
        return self.id


@dataclass
class DatasetVersionId:
    id: str

    def __repr__(self) -> str:
        return self.id


@dataclass
class DatasetArtifactId:
    id: str

    def __repr__(self) -> str:
        return self.id


@dataclass
class DatasetArtifact:
    id: DatasetArtifactId
    type: DatasetArtifactType
    uri: str


@dataclass
class OntologyTermId:
    label: str
    ontology_term_id: str


@dataclass_json
@dataclass
class DatasetMetadata:
    name: str
    schema_version: str
    organism: List[OntologyTermId]
    tissue: List[OntologyTermId]
    assay: List[OntologyTermId]
    disease: List[OntologyTermId]
    sex: List[OntologyTermId]
    self_reported_ethnicity: List[OntologyTermId]
    development_stage: List[OntologyTermId]
    cell_type: List[OntologyTermId]
    cell_count: int
    schema_version: str
    mean_genes_per_cell: float
    batch_condition: List[str]
    suspension_type: List[str]
    donor_id: List[str]
    is_primary_data: str
    x_approximate_distribution: Optional[str]


@dataclass
class CanonicalDataset:
    dataset_id: DatasetId
    dataset_version_id: Optional[DatasetVersionId]
    published_at: Optional[datetime] = None
    revised_at: Optional[datetime] = None  # The last time this Dataset Version was Published


@dataclass
class DatasetVersion:
    dataset_id: DatasetId
    version_id: DatasetVersionId
    collection_id: CollectionId  # Pointer to the canonical collection id this dataset belongs to
    status: DatasetStatus
    metadata: Optional[DatasetMetadata]
    artifacts: List[DatasetArtifact]
    created_at: datetime
    canonical_dataset: CanonicalDataset


@dataclass
class Link:
    name: Optional[str]
    type: str
    uri: str

    def strip_fields(self):
        if self.name:
            self.name = self.name.strip()
        self.type = self.type.strip()
        self.uri = self.uri.strip()


@dataclass_json
@dataclass
class CollectionMetadata:
    name: str
    description: str
    contact_name: str
    contact_email: str
    links: List[Link]

    def strip_fields(self):
        self.name = self.name.strip()
        self.description = self.description.strip()
        self.contact_name = self.contact_name.strip()
        self.contact_email = self.contact_email.strip()
        for link in self.links:
            link.strip_fields()


@dataclass
class CanonicalCollection:
    id: CollectionId
    version_id: Optional[CollectionVersionId]  # Needs to be optional, or not exist
    originally_published_at: Optional[datetime]
    tombstoned: bool


@dataclass
class CollectionVersionBase:
    collection_id: CollectionId
    version_id: CollectionVersionId
    owner: str
    curator_name: str
    metadata: CollectionMetadata
    publisher_metadata: Optional[dict]  # TODO: use a dataclass
    published_at: Optional[datetime]
    created_at: datetime
    canonical_collection: CanonicalCollection


@dataclass
class CollectionVersion(CollectionVersionBase):
    datasets: List[DatasetVersionId]


@dataclass
class CollectionVersionWithDatasets(CollectionVersionBase):
    datasets: List[DatasetVersion]
