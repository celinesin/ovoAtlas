import Head from "next/head";
import { useContext, useEffect, useMemo, useState } from "react";
import { EMPTY_OBJECT } from "src/common/constants/utils";
import {
  CellTypeByTissueName,
  GeneExpressionSummariesByTissueName,
  useCellTypesByTissueName,
  useGeneExpressionSummariesByTissueName,
} from "src/common/queries/wheresMyGene";
import SideBar from "src/components/common/SideBar";
import { Position } from "src/components/common/SideBar/style";
import { View } from "../../../globalStyle";
import { DispatchContext, StateContext } from "../../common/store";
import {
  deleteSelectedGenesAndSelectedCellTypeIds,
  tissueCellTypesFetched,
} from "../../common/store/actions";
import { CellType, GeneExpressionSummary, Tissue } from "../../common/types";
import { SideBarPositioner, SideBarWrapper, Top, Wrapper } from "../../style";
import Beta from "../Beta";
import Filters from "../Filters";
import GeneSearchBar from "../GeneSearchBar";
import GetStarted from "../GetStarted";
import HeatMap from "../HeatMap";
import InfoPanel from "../InfoPanel";

const INFO_PANEL_WIDTH_PX = 320;

export default function WheresMyGene(): JSX.Element {
  const state = useContext(StateContext);
  const dispatch = useContext(DispatchContext);

  const { selectedGenes, selectedCellTypeIds } = state;

  const {
    data: rawCellTypesByTissueName,
    isLoading: isLoadingCellTypesByTissueName,
  } = useCellTypesByTissueName();

  const [cellTypesByTissueName, setCellTypesByTissueName] =
    useState<CellTypeByTissueName>(EMPTY_OBJECT);

  useEffect(() => {
    if (isLoadingCellTypesByTissueName) return;

    setCellTypesByTissueName(rawCellTypesByTissueName);
  }, [rawCellTypesByTissueName, isLoadingCellTypesByTissueName]);

  /**
   * This holds ALL the geneData we have loaded from the API, including previously
   * and currently selected genes.
   * We use `selectedGeneData` to subset the data to only the genes that are
   * currently selected.
   */
  const { data: rawGeneExpressionSummariesByTissueName, isLoading } =
    useGeneExpressionSummariesByTissueName();

  const [
    geneExpressionSummariesByTissueName,
    setGeneExpressionSummariesByTissueName,
  ] = useState<GeneExpressionSummariesByTissueName>(EMPTY_OBJECT);

  useEffect(() => {
    if (isLoading) return;

    setGeneExpressionSummariesByTissueName(
      rawGeneExpressionSummariesByTissueName
    );
  }, [rawGeneExpressionSummariesByTissueName, isLoading]);

  // TODO(thuang): Fix this complexity
  // eslint-disable-next-line sonarjs/cognitive-complexity
  const { scaledMeanExpressionMax, scaledMeanExpressionMin } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    for (const [tissueName, tissueSelectedCellTypeIds] of Object.entries(
      selectedCellTypeIds
    )) {
      const tissueGeneExpressionSummaries =
        geneExpressionSummariesByTissueName[tissueName];

      if (!tissueGeneExpressionSummaries) {
        continue;
      }

      for (const selectedGeneName of selectedGenes) {
        const geneExpressionSummary =
          tissueGeneExpressionSummaries[selectedGeneName];

        if (geneExpressionSummary) {
          const { cellTypeGeneExpressionSummaries } = geneExpressionSummary;

          for (const cellTypeGeneExpressionSummary of cellTypeGeneExpressionSummaries) {
            if (
              !tissueSelectedCellTypeIds.includes(
                cellTypeGeneExpressionSummary.id
              )
            ) {
              continue;
            }

            const { meanExpression } = cellTypeGeneExpressionSummary;

            min = Math.min(min, meanExpression);
            max = Math.max(max, meanExpression);
          }
        }
      }
    }

    return {
      scaledMeanExpressionMax: max,
      scaledMeanExpressionMin: min,
    };
  }, [geneExpressionSummariesByTissueName, selectedCellTypeIds, selectedGenes]);

  /**
   * This holds only the CellTypeSummary objects that are currently selected in
   * `state.selectedCellTypeIds`.
   */
  const selectedCellTypes = useMemo(() => {
    const result: { [tissueName: Tissue]: CellType[] } = {};

    for (const [tissue, selectedIds] of Object.entries(selectedCellTypeIds)) {
      const tissueCellTypes = cellTypesByTissueName[tissue];

      for (const selectedId of selectedIds) {
        const cellType = tissueCellTypes?.find(
          (cellType) => cellType.id === selectedId
        );

        if (cellType !== undefined) {
          const tissueCellTypes = result[tissue] || [];
          tissueCellTypes.push(cellType);
          result[tissue] = tissueCellTypes;
        }
      }
    }

    return result;
  }, [selectedCellTypeIds, cellTypesByTissueName]);

  /**
   * This indicates which tissues have less cell types than the API response,
   * indicating the user has deleted some cell types manually
   */
  const tissuesWithDeletedCellTypes = useMemo(() => {
    const result = [];

    for (const [tissue, tissueCellTypes] of Object.entries(
      cellTypesByTissueName
    )) {
      if (selectedCellTypeIds[tissue]?.length < tissueCellTypes.length) {
        result.push(tissue);
      }
    }

    return result;
  }, [cellTypesByTissueName, selectedCellTypeIds]);

  const selectedGeneExpressionSummariesByTissueName = useMemo(() => {
    const result: { [tissueName: string]: GeneExpressionSummary[] } = {};

    for (const tissueName of Object.keys(selectedCellTypeIds)) {
      const tissueGeneExpressionSummaries =
        geneExpressionSummariesByTissueName[tissueName];

      if (!tissueGeneExpressionSummaries) continue;

      result[tissueName] = selectedGenes.map(
        (geneName) => tissueGeneExpressionSummaries[geneName]
      );
    }

    return result;
  }, [geneExpressionSummariesByTissueName, selectedGenes, selectedCellTypeIds]);

  useEffect(() => {
    // TODO(thuang): dispatch in a batch for all tissues
    for (const [tissueName, tissueCellTypes] of Object.entries(
      cellTypesByTissueName
    )) {
      if (!dispatch) return;

      dispatch(tissueCellTypesFetched(tissueName, tissueCellTypes));
    }
  }, [cellTypesByTissueName, dispatch]);

  // Listen to delete keyboard press event
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.code === "Backspace") {
        if (!dispatch) return;

        dispatch(deleteSelectedGenesAndSelectedCellTypeIds());
      }
    }
  }, [dispatch]);

  const hasSelectedGenes = selectedGenes.length > 0;

  const hasSelectedCellTypeIds = Object.keys(selectedCellTypeIds).length > 0;

  const shouldShowHeatMap = useMemo(() => {
    return hasSelectedGenes && hasSelectedCellTypeIds;
  }, [hasSelectedGenes, hasSelectedCellTypeIds]);

  return (
    <>
      <Head>
        <title>cellxgene | Where&apos;s My Gene</title>
      </Head>

      <SideBar
        label="Filters"
        isOpen
        SideBarWrapperComponent={SideBarWrapper}
        SideBarPositionerComponent={SideBarPositioner}
      >
        <Filters />
      </SideBar>

      <SideBar
        width={INFO_PANEL_WIDTH_PX}
        label="Info"
        isOpen
        position={Position.RIGHT}
        SideBarWrapperComponent={SideBarWrapper}
        SideBarPositionerComponent={SideBarPositioner}
      >
        <InfoPanel />
      </SideBar>

      <View hideOverflow>
        <Wrapper>
          <Top>
            <GeneSearchBar />
            <Beta />
          </Top>

          {shouldShowHeatMap ? (
            <HeatMap
              isLoadingAPI={isLoading}
              cellTypes={selectedCellTypes}
              genes={selectedGenes}
              selectedGeneExpressionSummariesByTissueName={
                selectedGeneExpressionSummariesByTissueName
              }
              tissuesWithDeletedCellTypes={tissuesWithDeletedCellTypes}
              allTissueCellTypes={cellTypesByTissueName}
              scaledMeanExpressionMax={scaledMeanExpressionMax}
              scaledMeanExpressionMin={scaledMeanExpressionMin}
            />
          ) : (
            <GetStarted />
          )}
        </Wrapper>
      </View>
    </>
  );
}