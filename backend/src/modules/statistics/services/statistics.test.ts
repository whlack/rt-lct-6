import assert from 'node:assert/strict';
import { test } from 'node:test';
import { months } from '../repositories/statistics.repository.js';
import { charts } from './charts.js';
test('monthly ranges contain zero months, default to 12 and stop beyond 36', () => {
  assert.deepEqual(months({ dateFrom: '2026-01-31', dateTo: '2026-03-01' }), [
    '2026-01',
    '2026-02',
    '2026-03',
  ]);
  assert.equal(months({}, new Date('2026-09-01T00:00:00Z')).length, 12);
  assert.throws(() => months({ dateFrom: '2023-01-01', dateTo: '2026-01-01' }));
});
test('charts render empty aggregates and escape imported direction names', () => {
  const empty = charts({
    status: { active: 0, closed: 0 },
    directions: [],
    months: [],
  });
  assert.ok(empty.includes('Нет данных'));
  assert.equal((empty.match(/<svg /g) ?? []).length, 3);
  const markup = charts({
    status: { active: 1, closed: 0 },
    directions: [{ name: '<script>', count: 1 }],
    months: [],
  });
  assert.ok(markup.includes('&lt;script&gt;'));
  assert.ok(!markup.includes('<script>'));
});
