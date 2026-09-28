import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../workbook.js';
function book(
  sheets: Record<string, unknown[][]>,
  type: 'xls' | 'xlsx' = 'xlsx',
) {
  const workbook = XLSX.utils.book_new();
  for (const [name, data] of Object.entries(sheets))
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(data), name);
  return Buffer.from(
    XLSX.write(workbook, {
      type: 'buffer',
      bookType: type === 'xls' ? 'biff8' : 'xlsx',
    }),
  );
}
test('both formats accept partial books, normalize names and apply identical duplicates once', async () => {
  for (const format of ['xls', 'xlsx'] as const) {
    const rows = await parseWorkbook(
      book(
        {
          Вузы: [
            ['Название вуза'],
            ['  Университет   связи  '],
            ['Университет связи'],
            [],
          ],
          Сотрудники: [
            ['Email', 'ФИО'],
            ['NAME@example.test', 'Иван Иванов'],
          ],
        },
        format,
      ),
      'data.' + format,
    );
    assert.equal(rows.length, 3);
    assert.equal(rows[0].data.name, 'Университет связи');
    assert.equal(rows[0].key, 'университет связи');
    assert.equal(rows[1].action, 'SKIP');
    assert.equal(rows[2].key, 'name@example.test');
  }
});
test('conflicting natural keys reject all occurrences, unknown sheets and headers reject the book', async () => {
  const rows = await parseWorkbook(
    book({ Направления: [['Название направления'], ['Связь'], ['СВЯЗЬ']] }),
    'x.xlsx',
  );
  assert.ok(rows.every((row) => row.action === 'ERROR'));
  await assert.rejects(parseWorkbook(book({ Другое: [['data']] }), 'x.xlsx'));
  await assert.rejects(parseWorkbook(book({ Вузы: [['Название']] }), 'x.xlsx'));
  assert.deepEqual(
    await parseWorkbook(
      book({ Другое: [['   ']], Вузы: [['Название вуза']] }),
      'empty.xlsx',
    ),
    [],
  );
});
test('formulas in meaningful cells are errors and archive/row limits are enforced', async () => {
  const workbook = XLSX.utils.book_new(),
    sheet = XLSX.utils.aoa_to_sheet([['Название вуза'], ['Cached']]);
  sheet.A2.f = '1+1';
  XLSX.utils.book_append_sheet(workbook, sheet, 'Вузы');
  const bytes = Buffer.from(
    XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
  );
  assert.equal(
    (await parseWorkbook(bytes, 'x.xlsx'))[0].errors[0].code,
    'FORMULA',
  );
  const previous = process.env.IMPORT_MAX_UNCOMPRESSED_BYTES;
  process.env.IMPORT_MAX_UNCOMPRESSED_BYTES = '10';
  try {
    await assert.rejects(parseWorkbook(bytes, 'x.xlsx'));
  } finally {
    if (previous === undefined)
      delete process.env.IMPORT_MAX_UNCOMPRESSED_BYTES;
    else process.env.IMPORT_MAX_UNCOMPRESSED_BYTES = previous;
  }
});
