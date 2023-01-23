import { agnes } from "ml-hclust";
import { useMemo } from "react";
import {
  CellType,
  CellTypeGeneExpressionSummaryData,
  Tissue,
} from "src/views/WheresMyGene/common/types";

interface Props {
  tissueNameToCellTypeIdToGeneNameToCellTypeGeneExpressionSummaryDataMap: Map<
    string,
    Map<string, Map<string, CellTypeGeneExpressionSummaryData>>
  >;
  selectedCellTypes: { [tissue: Tissue]: CellType[] };
  genes: string[];
}

export function useSortedCellTypesByTissueName({
  tissueNameToCellTypeIdToGeneNameToCellTypeGeneExpressionSummaryDataMap,
  selectedCellTypes,
  genes,
}: Props): { [tissue: Tissue]: CellType[] } {
  return useMemo(() => {
    if (genes.length === 0) {
      return selectedCellTypes;
    }

    const sortedCellTypesByTissueName: { [tissueName: string]: CellType[] } =
      {};

    for (const [tissueName, cellTypes] of Object.entries(selectedCellTypes)) {
      const cellTypeIdToGeneNameToCellTypeGeneExpressionSummaryData =
        tissueNameToCellTypeIdToGeneNameToCellTypeGeneExpressionSummaryDataMap.get(
          tissueName
        );

      if (!cellTypeIdToGeneNameToCellTypeGeneExpressionSummaryData) continue;

      const matrix = cellTypes.map((cellType) => {
        const geneNameToCellTypeGeneExpressionSummaryData =
          cellTypeIdToGeneNameToCellTypeGeneExpressionSummaryData.get(
            cellType.id
          );

        if (!geneNameToCellTypeGeneExpressionSummaryData) {
          return genes.map(() => 0);
        }

        return genes.map((geneName) => {
          const cellTypeGeneExpressionSummaryData =
            geneNameToCellTypeGeneExpressionSummaryData.get(geneName);

          if (!cellTypeGeneExpressionSummaryData) return 0;

          const { meanExpression, percentage } =
            cellTypeGeneExpressionSummaryData;

          return meanExpression * percentage;
        });
      });

      const tree = agnes(matrix);

      const orderedCellTypes =
        tree
          ?.indices()
          .reverse()
          .map((index) => {
            const { id, name, total_count } = cellTypes[index];

            return { id, name, total_count };
          }) || [];

      sortedCellTypesByTissueName[tissueName] = orderedCellTypes;
    }

    return sortedCellTypesByTissueName;
  }, [
    tissueNameToCellTypeIdToGeneNameToCellTypeGeneExpressionSummaryDataMap,
    selectedCellTypes,
    genes,
  ]);
}
