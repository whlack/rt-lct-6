import * as XLSX from 'xlsx';
import type { TableDocument } from './document.js';
export function spreadsheet(
  document: TableDocument,
  format: 'xls' | 'xlsx',
): Buffer {
  const book = XLSX.utils.book_new();
  for (const [sectionIndex, section] of document.sections.entries()) {
    const chunks = Math.max(1, Math.ceil(section.rows.length / 65000));
    for (let index = 0; index < chunks; index++) {
      // Strings remain t:s cells, including values beginning with '='.
      const sheet = XLSX.utils.aoa_to_sheet([
        section.columns,
        ...section.rows.slice(index * 65000, (index + 1) * 65000),
      ]);
      sheet['!cols'] = section.columns.map(() => ({ wch: 25 }));
      XLSX.utils.book_append_sheet(
        book,
        sheet,
        (
          sectionIndex +
          1 +
          '-' +
          section.title.slice(0, 20) +
          '-' +
          (index + 1)
        )
          .replace(/[\\/?*:\]]/g, '_')
          .replaceAll('[', '_')
          .slice(0, 31),
      );
    }
  }
  const data: unknown = XLSX.write(book, {
    type: 'buffer',
    bookType: format === 'xls' ? 'biff8' : 'xlsx',
  });
  if (!Buffer.isBuffer(data)) throw new Error('Invalid workbook output');
  return data;
}
