export function resolveSesReviewSubmittedRange(input: {
  dateFromState: string;
  dateToState: string;
  dateFromVisible?: string | null;
  dateToVisible?: string | null;
}) {
  return {
    dateFrom: input.dateFromVisible?.trim() || input.dateFromState,
    dateTo: input.dateToVisible?.trim() || input.dateToState,
  };
}

export function getSesReviewCoveragePercentage(coverageComplete: boolean) {
  return coverageComplete ? 100 : 0;
}
