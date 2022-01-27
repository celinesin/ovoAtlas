import { useMemo } from "react";
import { useQuery, UseQueryResult } from "react-query";
import { API } from "src/common/API";
import { IS_PRIMARY_DATA, Ontology } from "src/common/entities";
import { DEFAULT_FETCH_OPTIONS } from "src/common/queries/common";
import { ENTITIES } from "src/common/queries/entities";
import { COLLATOR_CASE_INSENSITIVE } from "src/components/common/Filter/common/constants";
import {
  Categories,
  CATEGORY_KEY,
  CollectionRow,
  DatasetRow,
} from "src/components/common/Filter/common/entities";
import { checkIsOverMaxCellCount } from "src/components/common/Grid/common/utils";
import { API_URL } from "src/configs/configs";

/**
 * Never expire cached collections and datasets. TODO revisit once state management approach is confirmed (#1809).
 */
const DEFAULT_QUERY_OPTIONS = {
  staleTime: Infinity,
};

/**
 * Query key for /collections/index
 */
const QUERY_ID_COLLECTIONS = "collectionsIndex";

/**
 * Query key for /datasets/index
 */
const QUERY_ID_DATASETS = "datasetIndex";

/**
 * Model returned on fetch of collections or datasets: materialized view models (rows) as well as fetch status.
 */
export interface FetchCategoriesRows<T extends Categories> {
  isError: boolean;
  isLoading: boolean;
  rows: T[];
}

/**
 * Model returned on fetch of collection datasets: materialized dataset view models as well as fetch status.
 */
export interface FetchCollectionDatasetRows {
  isError: boolean;
  isLoading: boolean;
  rows: DatasetRow[];
}

/**
 * Model of /collections/index JSON response.
 */
export interface CollectionResponse {
  id: string;
  name: string;
  published_at: number;
  revised_at: number;
}

/**
 * Model of /datasets/index JSON response.
 */
export interface DatasetResponse {
  assay: Ontology[];
  cell_count: number | null;
  cell_type: Ontology[];
  collection_id: string;
  disease: Ontology[];
  explorer_url: string;
  id: string;
  is_primary_data: IS_PRIMARY_DATA;
  name: string;
  organism: Ontology[];
  published_at: number;
  revised_at?: number;
  sex: Ontology[];
  tissue: Ontology[];
}

/**
 * Query key for caching collections returned from /collections/index endpoint.
 */
export const USE_COLLECTIONS_INDEX = {
  entities: [ENTITIES.COLLECTION],
  id: QUERY_ID_COLLECTIONS,
};

/**
 * Query key for caching datasets returned from /datasets/index endpoint.
 */
const USE_DATASETS_INDEX = {
  entities: [ENTITIES.DATASET],
  id: QUERY_ID_DATASETS,
};

/**
 * Fetch datasets for the given collection ID.
 * @param collectionId - ID of collection to fetch datasets for.
 * @returns All public datasets for the given collection ID.
 */
export function useFetchCollectionDatasetRows(
  collectionId: string
): FetchCollectionDatasetRows {
  const { rows: allRows, isError, isLoading } = useFetchDatasetRows();
  const datasetsByCollectionId = groupDatasetRowsByCollection(allRows);
  return {
    isError,
    isLoading,
    rows: datasetsByCollectionId.get(collectionId) ?? [],
  };
}

/**
 * Fetch collection and dataset information and build collection-specific filter view model.
 * @returns All public collections and the aggregated metadata of their datasets.
 */
export function useFetchCollectionRows(): FetchCategoriesRows<CollectionRow> {
  // Fetch datasets.
  const {
    data: datasets,
    isError: datasetsError,
    isLoading: datasetsLoading,
  } = useFetchDatasets();

  // Fetch collections.
  const {
    data: collectionsById,
    isError: collectionsError,
    isLoading: collectionsLoading,
  } = useFetchCollections();

  // View model built from join of collections response and aggregated metadata of dataset rows.
  // Build dataset rows once datasets and collections responses have resolved.
  const collectionRows = useMemo(() => {
    if (!datasets || !collectionsById) {
      return [];
    }
    const datasetRows = buildDatasetRows(collectionsById, datasets);
    return buildCollectionRows(collectionsById, datasetRows);
  }, [datasets, collectionsById]);

  return {
    isError: datasetsError || collectionsError,
    isLoading: datasetsLoading || collectionsLoading,
    rows: collectionRows,
  };
}

/**
 * Cache-enabled hook for fetching public collections and returning only core collection fields.
 * @returns Array of collections - possible cached from previous request - containing only ID, name and recency values.
 */
export function useFetchCollections(): UseQueryResult<
  Map<string, CollectionResponse>
> {
  return useQuery<Map<string, CollectionResponse>>(
    [USE_COLLECTIONS_INDEX],
    fetchCollections,
    {
      ...DEFAULT_QUERY_OPTIONS,
    }
  );
}

/**
 * Fetch collection and dataset information and build filter view model.
 * @returns All public datasets joined with their corresponding collection information.
 */
export function useFetchDatasetRows(): FetchCategoriesRows<DatasetRow> {
  // Fetch datasets.
  const {
    data: datasets,
    isError: datasetsError,
    isLoading: datasetsLoading,
  } = useFetchDatasets();

  // Fetch collections.
  const {
    data: collectionsById,
    isError: collectionsError,
    isLoading: collectionsLoading,
  } = useFetchCollections();

  // Build dataset rows once datasets and collections responses have resolved.
  const datasetRows = useMemo(() => {
    if (!datasets || !collectionsById) {
      return [];
    }
    return buildDatasetRows(collectionsById, datasets);
  }, [datasets, collectionsById]);

  return {
    isError: datasetsError || collectionsError,
    isLoading: datasetsLoading || collectionsLoading,
    rows: datasetRows,
  };
}

/**
 * Cache-enabled hook for fetching public, non-tombstoned, datasets returning only filterable and sortable fields.
 * @returns Array of datasets - possible cached from previous request - containing filterable and sortable dataset
 * fields.
 */
export function useFetchDatasets(): UseQueryResult<DatasetResponse[]> {
  return useQuery<DatasetResponse[]>([USE_DATASETS_INDEX], fetchDatasets, {
    ...DEFAULT_QUERY_OPTIONS,
  });
}

/**
 * Create model of collection category values by aggregating the values in each category of each dataset in collection.
 * @param collectionDatasetRows - Datasets in the collection to aggregate category values over.
 * @returns Object containing aggregated category values from given dataset rows.
 */
function aggregateCollectionDatasetRows(
  collectionDatasetRows: DatasetRow[]
): Categories {
  // Aggregate dataset category values for each category in the collection.
  const aggregatedCategoryValues = collectionDatasetRows.reduce(
    (accum: Categories, collectionDatasetRow: DatasetRow) => {
      return {
        assay: [...accum.assay, ...collectionDatasetRow.assay],
        cell_type: [...accum.cell_type, ...collectionDatasetRow.cell_type],
        disease: [...accum.disease, ...collectionDatasetRow.disease],
        is_primary_data: [
          ...accum.is_primary_data,
          ...collectionDatasetRow.is_primary_data,
        ],
        organism: [...accum.organism, ...collectionDatasetRow.organism],
        sex: [...accum.sex, ...collectionDatasetRow.sex],
        tissue: [...accum.tissue, ...collectionDatasetRow.tissue],
      };
    },
    {
      assay: [],
      cell_type: [],
      disease: [],
      is_primary_data: [],
      organism: [],
      sex: [],
      tissue: [],
    }
  );

  // De-dupe aggregated category values.
  return {
    assay: uniqueOntologies(aggregatedCategoryValues.assay),
    cell_type: uniqueOntologies(aggregatedCategoryValues.cell_type),
    disease: uniqueOntologies(aggregatedCategoryValues.disease),
    is_primary_data: [...new Set(aggregatedCategoryValues.is_primary_data)],
    organism: uniqueOntologies(aggregatedCategoryValues.organism),
    sex: uniqueOntologies(aggregatedCategoryValues.sex),
    tissue: uniqueOntologies(aggregatedCategoryValues.tissue),
  };
}

/**
 * Create collection rows from aggregated dataset category values and add to each dataset in collection.
 * @param collectionsById - Collections keyed by their ID.
 * @param datasetRows - Array of joined of dataset and basic collection information (that is, collection name).
 * @returns Datasets joined with their corresponding collection information as well as aggregated category values
 * across sibling datasets in its collection.
 */
function buildCollectionRows(
  collectionsById: Map<string, CollectionResponse>,
  datasetRows: DatasetRow[]
): CollectionRow[] {
  // Group datasets by collection to facilitate aggregation of dataset category values for each collection.
  const datasetRowsByCollectionId = groupDatasetRowsByCollection(datasetRows);

  // Aggregate category values for each collection and update on each dataset.
  const collectionRows = [];
  for (const [collectionId, collection] of collectionsById.entries()) {
    // Create model of collection category values by aggregating the values in each category of each dataset in
    // collection.
    const collectionDatasetRows =
      datasetRowsByCollectionId.get(collectionId) ?? [];
    const aggregatedCategoryValues = aggregateCollectionDatasetRows(
      collectionDatasetRows
    );

    // Create collection row from aggregated collection category values and core collection information.
    const { id, name, published_at, revised_at } = collection;
    const collectionRow = sortCategoryValues({
      id,
      name,
      published_at,
      revised_at,
      ...aggregatedCategoryValues,
    });
    collectionRows.push(collectionRow);
  }
  return collectionRows;
}

/**
 * Join dataset and collection information to facilitate filter over datasets.
 * @param collectionsById - Collections keyed by their ID.
 * @param datasets - Datasets returned from datasets/index endpoint.
 * @returns Datasets joined with their corresponding collection information.
 */
function buildDatasetRows(
  collectionsById: Map<string, CollectionResponse>,
  datasets: DatasetResponse[]
): DatasetRow[] {
  // Join collection and dataset information to create dataset rows.
  return datasets.map((dataset: DatasetResponse) => {
    const collection = collectionsById.get(dataset.collection_id);
    return buildDatasetRow(dataset, collection);
  });
}

/**
 * Build dataset row from dataset response. Correct is_primary_data where necessary.
 * @param dataset - Response dataset values to build filterable data from.
 * @param collection - Response collection values to join with dataset values, possibly undefined if dataset is an
 * orphan with no corresponding collection.
 * @returns Fully built dataset row; join between dataset and collection values with corrected missing and
 * data primary values.
 */
function buildDatasetRow(
  dataset: DatasetResponse,
  collection?: CollectionResponse
): DatasetRow {
  const { is_primary_data } = dataset;

  // Join!
  const datasetRow = {
    ...dataset,
    collection_name: collection?.name ?? "-",
    isOverMaxCellCount: checkIsOverMaxCellCount(dataset.cell_count),
    is_primary_data: expandIsPrimaryData(is_primary_data),
  };

  return sortCategoryValues(datasetRow);
}

/**
 * Determine the correct value for is_primary_data. Convert "BOTH" primary data values to ["primary", "secondary"].
 * Convert "primary" or "secondary" to singleton arrays. Convert error cases where is_primary_data is undefined to [].
 * @param isPrimaryData - Primary data value to sanitize.
 */
function expandIsPrimaryData(
  isPrimaryData: IS_PRIMARY_DATA
): IS_PRIMARY_DATA[] {
  if (!isPrimaryData) {
    return [];
  }

  return isPrimaryData === IS_PRIMARY_DATA.BOTH
    ? [IS_PRIMARY_DATA.PRIMARY, IS_PRIMARY_DATA.SECONDARY]
    : [isPrimaryData];
}

/**
 * Fetch public collections from /datasets/index endpoint. Collections are partial in that they do not contain all
 * fields; only fields required for filtering and sorting are returned.
 * @returns Promise that resolves to a map of collections keyed by collection ID - possible cached from previous
 * request - containing only ID, name and recency values.
 */
async function fetchCollections(): Promise<Map<string, CollectionResponse>> {
  const collections = await (
    await fetch(API_URL + API.COLLECTIONS_INDEX, DEFAULT_FETCH_OPTIONS)
  ).json();

  // Create "collections lookup" to facilitate join between collections and datasets.
  return keyCollectionsById(collections);
}

/**
 * Fetch public, non-tombstoned, partial datasets from /datasets/index endpoint. Datasets are partial in that they
 * do not contain all fields; only fields required for filtering and sorting are returned. Correct any dirt data
 * returned from endpoint.
 * @returns Promise resolving to an array of datasets - possible cached from previous request - containing
 * filterable and sortable dataset fields.
 */
async function fetchDatasets(): Promise<DatasetResponse[]> {
  const datasets = await (
    await fetch(API_URL + API.DATASETS_INDEX, DEFAULT_FETCH_OPTIONS)
  ).json();

  // Correct any dirty data returned from endpoint.
  return datasets.map((dataset: DatasetResponse) => {
    return sanitizeDataset(dataset);
  });
}

/**
 * Group dataset rows by collection.
 * @param datasetRows - Array of dataset rows to group by their collection ID.
 * @returns Dataset rows keyed by their collection IDs.
 */
function groupDatasetRowsByCollection(
  datasetRows: DatasetRow[]
): Map<string, DatasetRow[]> {
  return datasetRows.reduce((accum: Map<string, DatasetRow[]>, datasetRow) => {
    const datasetsByCollectionId = accum.get(datasetRow.collection_id);
    if (datasetsByCollectionId) {
      datasetsByCollectionId.push(datasetRow);
    } else {
      accum.set(datasetRow.collection_id, [datasetRow]);
    }
    return accum;
  }, new Map<string, DatasetRow[]>());
}

/**
 * Created a map of collections keyed by their ID.
 * @param collections - Collections returned from collection/index endpoint.
 * @returns Map of collections keyed by their ID.
 */
function keyCollectionsById(
  collections: CollectionResponse[]
): Map<string, CollectionResponse> {
  return new Map(
    collections.map((collection: CollectionResponse) => [
      collection.id,
      collection,
    ])
  );
}

/**
 * Add defaults for missing filterable values: convert missing ontology values to empty array and is_primary_data to "".
 * @param dataset - Dataset to check for missing values.
 * @returns Corrected dataset response.
 */
function sanitizeDataset(dataset: DatasetResponse): DatasetResponse {
  return Object.values(CATEGORY_KEY).reduce(
    (accum: DatasetResponse, categoryKey: CATEGORY_KEY) => {
      if (categoryKey === CATEGORY_KEY.IS_PRIMARY_DATA) {
        accum.is_primary_data = dataset.is_primary_data ?? "";
      } else {
        accum[categoryKey] = dataset[categoryKey] ?? [];
      }
      return accum;
    },
    { ...dataset }
  );
}

/**
 * Sort category values on the given collection or dataset rows.
 * @param row - Collection or dataset row to sort category values of.
 * @returns Array of collection or dataset rows with category values sorted.
 */
function sortCategoryValues<T extends Categories>(row: T): T {
  return {
    ...row,
    assay: row.assay.sort(sortOntologies),
    cell_type: row.cell_type.sort(sortOntologies),
    disease: row.disease.sort(sortOntologies),
    is_primary_data: row.is_primary_data.sort(),
    organism: row.organism.sort(sortOntologies),
    sex: row.sex.sort(sortOntologies),
    tissue: row.tissue.sort(sortOntologies),
  };
}

/*
 * Sort ontologies by label, case insensitive, ascending.
 * @param o0 - First filtered rows to compare.
 * @param o1 - Second filtered rows to compare.
 * @returns Number indicating sort precedence of o0 vs o1.
 */
function sortOntologies(o0: Ontology, o1: Ontology): number {
  return COLLATOR_CASE_INSENSITIVE.compare(o0.label, o1.label);
}

/**
 * De-dupe ontologies in the given array.
 * @param ontologies - Array of ontologies to remove duplicated from.
 * @returns Array containing set of ontologies.
 */
function uniqueOntologies(ontologies: Ontology[]): Ontology[] {
  return [
    ...new Map(
      ontologies.map((ontology: Ontology) => [ontology.label, ontology])
    ).values(),
  ];
}
