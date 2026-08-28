import { describe, expect, it } from 'vitest';
import { getSesPagination } from './sesPagination';

describe('SES visible pagination', () => {
  it('exposes all pages and exact visible ranges for more than 200 drafts', () => {
    expect(getSesPagination({ total: 367, offset: 0, limit: 50, pageCount: 50 })).toEqual({
      totalPages: 8, currentPage: 1, start: 1, end: 50,
      canPrevious: false, canNext: true, previousOffset: 0, nextOffset: 50,
    });
    expect(getSesPagination({ total: 367, offset: 350, limit: 50, pageCount: 17 })).toEqual({
      totalPages: 8, currentPage: 8, start: 351, end: 367,
      canPrevious: true, canNext: false, previousOffset: 300, nextOffset: 350,
    });
  });
});
