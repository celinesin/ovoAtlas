import Head from "next/head";
import React, { useMemo } from "react";
import { Column, useFilters, useSortBy, useTable } from "react-table";
import { PLURALIZED_METADATA_LABEL } from "src/common/constants/metadata";
import { FEATURES } from "src/common/featureFlags/features";
import {
  CategoryKey,
  useCategoryFilter,
} from "src/common/hooks/useCategoryFilter";
import { useExplainNewTab } from "src/common/hooks/useExplainNewTab";
import { useFeatureFlag } from "src/common/hooks/useFeatureFlag";
import { useFetchDatasetRows } from "src/common/queries/filter";
import Filter from "src/components/common/Filter";
import {
  CATEGORY_KEY,
  CellPropsValue,
  DatasetRow,
  RowPropsValue,
} from "src/components/common/Filter/common/entities";
import { ontologyCellAccessorFn } from "src/components/common/Filter/common/utils";
import CountCell from "src/components/common/Grid/components/CountCell";
import { GridHero } from "src/components/common/Grid/components/Hero";
import NTagCell from "src/components/common/Grid/components/NTagCell";
import { RightAlignCell } from "src/components/common/Grid/components/RightAlignCell";
import SideBar from "src/components/common/SideBar";
import DatasetsActionsCell from "src/components/Datasets/components/Grid/components/DatasetActionsCell";
import DatasetNameCell from "src/components/Datasets/components/Grid/components/DatasetNameCell";
import { DatasetsGrid } from "src/components/Datasets/components/Grid/components/DatasetsGrid/style";
import { View } from "../globalStyle";

/**
 * Collection ID object key.
 */
const COLLECTION_ID = "collection_id";

/**
 * Collection name object key.
 */
const COLLECTION_NAME = "collection_name";

/**
 * Dataset ID object key.
 */
const DATASET_ID = "id";

/**
 * Dataset name object key.
 */
const DATASET_NAME = "name";

/**
 * Explorer URL object key.
 */
const EXPLORER_URL = "explorer_url";

/**
 * Recency object key.
 */
const RECENCY = "recency";

/**
 * Key identifying recency sort by column.
 */
const COLUMN_ID_RECENCY = "recency";

export default function Datasets(): JSX.Element {
  /* Pop toast if user has come from Explorer with work in progress */
  useExplainNewTab(
    "To maintain your in-progress work on the previous dataset, we opened a new tab."
  );

  // Filterable datasets joined from datasets and collections responses.
  const { isError, isLoading, rows: datasetRows } = useFetchDatasetRows();

  // Column configuration backing table.
  const columnConfig: Column<DatasetRow>[] = useMemo(
    () => [
      {
        Cell: ({ row: { values } }: RowPropsValue<DatasetRow>) => {
          return (
            <DatasetNameCell
              collectionId={values.collection_id}
              collectionName={values.collection_name}
              name={values.name}
            />
          );
        },
        Header: "Dataset",
        accessor: DATASET_NAME,
      },
      {
        Cell: ({ value }: CellPropsValue<string[]>) => (
          <NTagCell label={PLURALIZED_METADATA_LABEL.TISSUE} values={value} />
        ),
        Header: "Tissue",
        accessor: ontologyCellAccessorFn(CATEGORY_KEY.TISSUE),
        filter: "includesSome",
        id: CATEGORY_KEY.TISSUE,
      },
      {
        Cell: ({ value }: CellPropsValue<string[]>) => (
          <NTagCell label={PLURALIZED_METADATA_LABEL.DISEASE} values={value} />
        ),
        Header: "Disease",
        accessor: ontologyCellAccessorFn(CATEGORY_KEY.DISEASE),
        filter: "includesSome",
        id: CATEGORY_KEY.DISEASE,
      },
      {
        Cell: ({ value }: CellPropsValue<string[]>) => (
          <NTagCell label={PLURALIZED_METADATA_LABEL.ASSAY} values={value} />
        ),
        Header: "Assay",
        accessor: ontologyCellAccessorFn(CATEGORY_KEY.ASSAY),
        filter: "includesSome",
        id: CATEGORY_KEY.ASSAY,
      },
      {
        Cell: ({ value }: CellPropsValue<string[]>) => (
          <NTagCell label={PLURALIZED_METADATA_LABEL.ORGANISM} values={value} />
        ),
        Header: "Organism",
        accessor: ontologyCellAccessorFn(CATEGORY_KEY.ORGANISM),
        filter: "includesSome",
        id: CATEGORY_KEY.ORGANISM,
      },
      {
        Cell: ({ value }: CellPropsValue<number>) => (
          <RightAlignCell>
            <CountCell cellCount={value || 0} />
          </RightAlignCell>
        ),
        Header: <RightAlignCell>Cells</RightAlignCell>,
        accessor: CATEGORY_KEY.CELL_COUNT,
        filter: "between",
      },
      {
        Cell: ({ row: { values } }: RowPropsValue<DatasetRow>) => (
          <DatasetsActionsCell
            datasetId={values.id}
            isOverMaxCellCount={values.isOverMaxCellCount}
            name={values.name}
            tombstone={false} // Only public datasets are displayed in the datasets index.
            explorerUrl={values.explorer_url}
          />
        ),
        accessor: (datasetRow: DatasetRow): DatasetRow => datasetRow,
        id: "dataset_actions",
      },
      // Hidden, required for sorting by recency.
      {
        accessor: RECENCY,
        id: COLUMN_ID_RECENCY,
      },
      // Hidden, required for accessing dataset ID via row.values, for download functionality.
      {
        accessor: DATASET_ID,
      },
      // Hidden, required for accessing collection ID via row.values, for building link to collection detail page.
      {
        accessor: COLLECTION_ID,
      },
      // Hidden, required for accessing collection name via row.values, for display.
      {
        accessor: COLLECTION_NAME,
      },
      // Hidden, required for accessing explorer_url via row.values, for display.
      {
        accessor: EXPLORER_URL,
      },
      // Hidden, required for filter.
      {
        accessor: ontologyCellAccessorFn(CATEGORY_KEY.CELL_TYPE),
        filter: "includesSome",
        id: CATEGORY_KEY.CELL_TYPE,
      },
      // Hidden, required for filter.
      {
        accessor: ontologyCellAccessorFn(CATEGORY_KEY.ETHNICITY),
        filter: "includesSome",
        id: CATEGORY_KEY.ETHNICITY,
      },
      // Hidden, required for filter.
      {
        accessor: CATEGORY_KEY.IS_PRIMARY_DATA,
        filter: "includesSome",
      },
      // Hidden, required for filter.
      {
        accessor: CATEGORY_KEY.MEAN_GENES_PER_CELL,
        filter: "between",
      },
      // Hidden, required for filter.
      {
        accessor: CATEGORY_KEY.PUBLICATION_AUTHORS,
        filter: "includesSome",
        id: CATEGORY_KEY.PUBLICATION_AUTHORS,
      },
      // Hidden, required for filter.
      {
        accessor: CATEGORY_KEY.PUBLICATION_DATE_VALUES,
        filter: "includesSome",
        id: CATEGORY_KEY.PUBLICATION_DATE_VALUES,
      },
      // Hidden, required for filter.
      {
        accessor: ontologyCellAccessorFn(CATEGORY_KEY.SEX),
        filter: "includesSome",
        id: CATEGORY_KEY.SEX,
      },
    ],
    []
  );

  // Table init
  const tableInstance = useTable<DatasetRow>(
    {
      columns: columnConfig,
      data: datasetRows,
      initialState: {
        hiddenColumns: [
          DATASET_ID,
          COLLECTION_ID,
          COLLECTION_NAME,
          COLUMN_ID_RECENCY,
          CATEGORY_KEY.CELL_TYPE,
          CATEGORY_KEY.ETHNICITY,
          CATEGORY_KEY.IS_PRIMARY_DATA,
          CATEGORY_KEY.MEAN_GENES_PER_CELL,
          CATEGORY_KEY.PUBLICATION_AUTHORS,
          CATEGORY_KEY.PUBLICATION_DATE_VALUES,
          CATEGORY_KEY.SEX,
          EXPLORER_URL,
        ],
        sortBy: [
          {
            desc: true,
            id: COLUMN_ID_RECENCY,
          },
        ],
      },
    },
    useFilters,
    useSortBy
  );

  // Filter init.
  const {
    preFilteredRows,
    rows,
    setFilter,
    state: { filters },
  } = tableInstance;

  // Determine the set of categories to display for the datasets view.
  const categories = useMemo<Set<CATEGORY_KEY>>(() => {
    return Object.values(CATEGORY_KEY).reduce(
      (accum, categoryKey: CategoryKey) => {
        accum.add(categoryKey);
        return accum;
      },
      new Set<CATEGORY_KEY>()
    );
  }, []);

  // Set up filter instance.
  const filterInstance = useCategoryFilter(
    preFilteredRows,
    categories,
    filters,
    setFilter
  );

  // Hide datasets behind feature flag - start
  const isFilterEnabled = useFeatureFlag(FEATURES.FILTER);
  if (!isFilterEnabled) {
    return <></>;
  }
  // Hide datasets behind feature flag - end

  return (
    <>
      <Head>
        <title>cellxgene | Datasets</title>
      </Head>
      {isError || isLoading ? null : (
        <>
          <SideBar label="Filters" isOpen>
            <Filter {...filterInstance} />
          </SideBar>
          <View>
            {!rows || rows.length === 0 ? (
              <GridHero>
                <h3>No Results</h3>
                <p>There are no datasets matching those filters.</p>
              </GridHero>
            ) : (
              // @ts-expect-error -- revisit tableInstance typing
              <DatasetsGrid tableInstance={tableInstance} />
            )}
          </View>
        </>
      )}
    </>
  );
}
