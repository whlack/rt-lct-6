import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { fromBuffer } from 'yauzl';
import { isEmail } from 'class-validator';
import { catalogKey, catalogName } from '../../common/catalog-name.js';
import { positiveInteger } from '../../config/jobs.js';
export const headers = {
  Вузы: ['Название вуза'],
  Направления: ['Название направления'],
  'Программы и продукты': ['Тип', 'Название'],
  Сотрудники: ['Email', 'ФИО'],
} as const;
export type SheetName = keyof typeof headers;
export interface RowError {
  column: string;
  code: string;
  message: string;
}
export interface ParsedRow {
  sheet: SheetName;
  rowNumber: number;
  key: string;
  data: Record<string, string | number>;
  action: 'CREATE' | 'UPDATE' | 'SKIP' | 'ERROR';
  errors: RowError[];
}

async function validateZip(buffer: Buffer) {
  const limit = positiveInteger('IMPORT_MAX_UNCOMPRESSED_BYTES', 52428800);
  await new Promise<void>((resolve, reject) => {
    fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true },
      (error, zip) => {
        if (error || !zip) {
          reject(new BadRequestException('Invalid XLSX archive'));
          return;
        }
        let bytes = 0,
          entries = 0,
          settled = false;
        const fail = () => {
          if (!settled) {
            settled = true;
            zip.close();
            reject(
              new BadRequestException('Invalid or oversized XLSX archive'),
            );
          }
        };
        zip.on('error', fail);
        zip.on('end', () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        });
        zip.on('entry', (entry) => {
          if (
            ++entries > 5000 ||
            entry.uncompressedSize > limit ||
            entry.isEncrypted()
          ) {
            fail();
            return;
          }
          zip.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) {
              fail();
              return;
            }
            stream.on('error', fail);
            stream.on('data', (chunk: Buffer) => {
              bytes += chunk.length;
              if (bytes > limit) {
                stream.destroy();
                fail();
              }
            });
            stream.on('end', () => {
              if (!settled) zip.readEntry();
            });
          });
        });
        zip.readEntry();
      },
    );
  });
}
function text(
  sheet: XLSX.WorkSheet,
  row: number,
  column: number,
): { value: string; formula: boolean } {
  const cell: XLSX.CellObject | undefined =
    sheet[XLSX.utils.encode_cell({ r: row, c: column })];
  return {
    value: cell?.v === undefined || cell.v === null ? '' : String(cell.v),
    formula: !!cell?.f,
  };
}
export async function parseWorkbook(
  buffer: Buffer,
  fileName: string,
): Promise<ParsedRow[]> {
  if (buffer.length > positiveInteger('IMPORT_MAX_BYTES', 10485760))
    throw new BadRequestException('Import file too large');
  const extension = fileName.toLowerCase().split('.').pop();
  if (extension === 'xlsx') {
    if (buffer.subarray(0, 2).toString() !== 'PK')
      throw new BadRequestException('Expected XLSX archive');
    await validateZip(buffer);
  } else if (
    extension !== 'xls' ||
    buffer.subarray(0, 8).toString('hex') !== 'd0cf11e0a1b11ae1'
  )
    throw new BadRequestException('Expected XLS or XLSX');
  let book: XLSX.WorkBook;
  try {
    book = XLSX.read(buffer, { type: 'buffer', cellFormula: true });
  } catch {
    throw new BadRequestException('Unreadable or encrypted workbook');
  }
  const result: ParsedRow[] = [];
  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name];
    const addresses = Object.keys(sheet).filter(
      (k) =>
        /^[A-Z]+[1-9]\d*$/.test(k) &&
        (sheet[k].f ||
          (sheet[k].v !== undefined &&
            sheet[k].v !== null &&
            String(sheet[k].v).trim() !== '')),
    );
    if (!addresses.length) continue;
    if (!(name in headers))
      throw new BadRequestException('Unknown non-empty sheet: ' + name);
    const sheetName = name as SheetName;
    const columns = headers[sheetName];
    for (const [column, expected] of columns.entries()) {
      const cell = text(sheet, 0, column);
      if (cell.formula || cell.value !== expected)
        throw new BadRequestException(
          'Unsupported header: ' + name + '/' + expected,
        );
    }
    if (
      addresses.some((a) => {
        const cell = XLSX.utils.decode_cell(a);
        return (
          cell.r === 0 &&
          cell.c >= columns.length &&
          text(sheet, cell.r, cell.c).value !== ''
        );
      })
    )
      throw new BadRequestException('Unexpected columns in ' + name);
    const rows = [
      ...new Set(
        addresses.map((a) => XLSX.utils.decode_cell(a).r).filter((r) => r > 0),
      ),
    ].sort((a, b) => a - b);
    for (const row of rows) {
      const cells = columns.map((_, column) => text(sheet, row, column));
      if (cells.every((c) => !c.value.trim() && !c.formula)) continue;
      if (result.length >= positiveInteger('IMPORT_MAX_ROWS', 20000))
        throw new BadRequestException('Too many import rows');
      const errors: RowError[] = [];
      cells.forEach((cell, i) => {
        if (cell.formula)
          errors.push({
            column: columns[i],
            code: 'FORMULA',
            message: 'Формулы не поддерживаются',
          });
        if (!cell.value.trim())
          errors.push({
            column: columns[i],
            code: 'REQUIRED',
            message: 'Обязательное значение отсутствует',
          });
        if (
          cell.value.length >
          (sheetName === 'Сотрудники' && i === 0 ? 254 : 200)
        )
          errors.push({
            column: columns[i],
            code: 'TOO_LONG',
            message: 'Значение слишком длинное',
          });
      });
      let data: Record<string, string | number>, key: string;
      if (sheetName === 'Сотрудники') {
        const email = cells[0].value.trim().toLowerCase();
        if (!isEmail(email))
          errors.push({
            column: 'Email',
            code: 'EMAIL',
            message: 'Некорректный email',
          });
        data = { email, fullName: catalogName(cells[1].value) };
        key = email;
      } else if (sheetName === 'Программы и продукты') {
        const type = catalogKey(cells[0].value);
        if (!['программа', 'продукт'].includes(type))
          errors.push({
            column: 'Тип',
            code: 'TYPE',
            message: 'Допустимы Программа или Продукт',
          });
        data = {
          type: type === 'программа' ? 'PROGRAM' : 'PRODUCT',
          name: catalogName(cells[1].value),
        };
        key = data.type + '/' + catalogKey(String(data.name));
      } else {
        data = { name: catalogName(cells[0].value) };
        key = catalogKey(String(data.name));
      }
      result.push({
        sheet: sheetName,
        rowNumber: row + 1,
        key,
        data,
        action: errors.length ? 'ERROR' : 'CREATE',
        errors,
      });
    }
  }
  const groups = new Map<string, ParsedRow[]>();
  for (const row of result) {
    const key = row.sheet + '/' + row.key;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    if (new Set(group.map((row) => JSON.stringify(row.data))).size > 1) {
      for (const row of group) {
        row.action = 'ERROR';
        row.errors.push({
          column: '',
          code: 'AMBIGUOUS',
          message:
            'Неоднозначное совпадение: укажите уникальное название или email и повторите загрузку',
        });
      }
    } else {
      for (const row of group.slice(1))
        if (!row.errors.length) {
          row.action = 'SKIP';
          row.data.duplicateOf = group[0].rowNumber;
        }
    }
  }
  return result;
}
