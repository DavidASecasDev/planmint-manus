export function getSesPagination(input: { total: number; offset: number; limit: number; pageCount: number }) {
  const total = Math.max(0, input.total);
  const limit = Math.max(1, input.limit);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(totalPages, Math.floor(Math.max(0, input.offset) / limit) + 1);
  const start = total === 0 ? 0 : Math.min(total, input.offset + 1);
  const end = total === 0 ? 0 : Math.min(total, input.offset + input.pageCount);
  return {
    totalPages,
    currentPage,
    start,
    end,
    canPrevious: input.offset > 0,
    canNext: input.offset + input.pageCount < total,
    previousOffset: Math.max(0, input.offset - limit),
    nextOffset: Math.min(Math.max(0, (totalPages - 1) * limit), input.offset + limit),
  };
}
