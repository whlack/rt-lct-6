import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateFilters } from '../report-filters.js';
import { projectScope } from '../../projects/index.js';
import { universityScope } from '../../universities/index.js';

test('report periods are paired, real calendar dates and ordered', () => {
  for (const value of [
    { dateFrom: '2026-01-01' },
    { dateFrom: '2026-02-30', dateTo: '2026-03-01' },
    { dateFrom: '2026-03-01', dateTo: '2026-02-01' },
    { programId: 'a', productId: 'b' },
  ])
    assert.throws(() => validateFilters(value));
  assert.doesNotThrow(() =>
    validateFilters({ dateFrom: '2024-02-29', dateTo: '2024-02-29' }),
  );
});
test('project responsibility grants project access without broadening university scope', () => {
  const user = { id: 'u', subject: 's', level: 10 as const };
  assert.deepEqual(projectScope(user), {
    OR: [
      { responsibleId: 'u' },
      { university: { assignments: { some: { userId: 'u' } } } },
    ],
  });
  assert.deepEqual(universityScope(user), {
    assignments: { some: { userId: 'u' } },
  });
  assert.deepEqual(projectScope({ ...user, level: 20 }), {});
});
