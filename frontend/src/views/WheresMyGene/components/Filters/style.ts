import styled from "@emotion/styled";
import {
  CommonThemeProps,
  ComplexFilter,
  ComplexFilterInputDropdown,
  getColors,
  getSpaces,
} from "@czi-sds/components";
import { Label, Wrapper as RawWrapper } from "./components/common/style";

export const StyledComplexFilterInputDropdown = styled(
  ComplexFilterInputDropdown
)`
  padding-left: 0;
  /* (thuang): Sex filter is short and doesn't need the default 64px width */
  min-width: 0;

  .MuiButton-label {
    margin-left: 0;
    margin-right: 10px;
  }

  &.Mui-disabled {
    border: 0;
  }

  ${(props: CommonThemeProps) => {
    const colors = getColors(props);

    return `
      .styled-label {
        // (thuang): Override the default color black to be gray until SDS fixes it
        color: ${colors?.gray[500]} !important;
      }
    `;
  }}
`;

export const Wrapper = styled(RawWrapper)`
  ${(props: CommonThemeProps) => {
    const spaces = getSpaces(props);

    return `
      gap: ${spaces?.xl}px;
    `;
  }}
`;

export const StyledComplexFilter = styled(ComplexFilter)`
  width: 100%;
  margin-bottom: 16px;
` as typeof ComplexFilter;

export const ViewOptionsLabel = styled(Label)`
  margin-bottom: 8px;
`;
