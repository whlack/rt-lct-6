import { expect, it } from 'vitest';
import { validateReportFilters } from './index';
it('rejects incomplete or reversed periods and simultaneous program/product filters', () => {
  expect(validateReportFilters({ dateFrom: '2026-01-01' })).toContain(
    'обе даты',
  );
  expect(
    validateReportFilters({ dateFrom: '2026-02-01', dateTo: '2026-01-01' }),
  ).toContain('не позже');
  expect(
    validateReportFilters({ programId: 'program', productId: 'product' }),
  ).toContain('или');
  expect(
    validateReportFilters({ dateFrom: '2026-01-01', dateTo: '2026-01-01' }),
  ).toBe('');
});
