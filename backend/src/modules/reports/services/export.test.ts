import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as XLSX from 'xlsx';
import { spreadsheet } from '../../../integrations/rendering/spreadsheet.js';
import { escapeHtml } from '../../../integrations/rendering/document.js';
import { exportParameters } from './report-export.service.js';

test('XLS is BIFF8, preserves Cyrillic and treats formula-looking data as text', () => {
  const bytes = spreadsheet(
    {
      title: 'Тест',
      generatedAt: '',
      timezone: '',
      sections: [
        {
          title: 'Данные',
          columns: ['Вуз'],
          rows: [['Ростелеком'], ['=HYPERLINK("http://invalid")']],
        },
      ],
    },
    'xls',
  );
  assert.equal(bytes.subarray(0, 8).toString('hex'), 'd0cf11e0a1b11ae1');
  const book = XLSX.read(bytes, { type: 'buffer', cellFormula: true });
  const cell = book.Sheets[book.SheetNames[0]].A3;
  assert.equal(cell.t, 's');
  assert.equal(cell.f, undefined);
  assert.equal(book.Sheets[book.SheetNames[0]].A2.v, 'Ростелеком');
});
test('large event sets are split without losing the last row', () => {
  const rows = Array.from({ length: 65001 }, (_, i) => [i]);
  const bytes = spreadsheet(
    {
      title: '',
      generatedAt: '',
      timezone: '',
      sections: [{ title: 'История', columns: ['N'], rows }],
    },
    'xls',
  );
  const book = XLSX.read(bytes, { type: 'buffer' });
  assert.equal(book.SheetNames.length, 2);
  assert.equal(book.Sheets[book.SheetNames[1]].A2.v, 65000);
});
test('full project export rejects filters and rendering escapes markup', () => {
  assert.throws(() =>
    exportParameters({ format: 'pdf', projectId: 'p', status: 'ACTIVE' }),
  );
  assert.equal(escapeHtml('<script>&"'), '&lt;script&gt;&amp;&quot;');
});
