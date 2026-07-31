import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { parseExcelFile } from '../src/utils/excelImport.ts';

async function createWorkbook(headers, values) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Lesson');
  sheet.addRow(headers);
  sheet.addRow(values);
  const buffer = await workbook.xlsx.writeBuffer();
  return { arrayBuffer: async () => buffer };
}

test('import file cũ dùng Work Type vẫn tương thích', async () => {
  const file = await createWorkbook(
    ['English', 'Work Type', 'Translation', 'Example English', 'Example Vietnamese'],
    ['adjust', 'verb', 'điều chỉnh', 'Adjust it.', 'Hãy điều chỉnh.'],
  );
  const sheets = await parseExcelFile(file);
  assert.equal(sheets[0].words[0].wordType, 'verb');
  assert.equal(sheets[0].words[0].phonetic, undefined);
});

test('import schema mới tách Word Type và Phonetic', async () => {
  const file = await createWorkbook(
    ['English', 'Word Type', 'Phonetic', 'Translation', 'Example English', 'Example Vietnamese'],
    ['adjust', 'verb', '/əˈdʒʌst/', 'điều chỉnh', 'Adjust it.', 'Hãy điều chỉnh.'],
  );
  const sheets = await parseExcelFile(file);
  assert.equal(sheets[0].words[0].wordType, 'verb');
  assert.equal(sheets[0].words[0].phonetic, '/əˈdʒʌst/');
});
