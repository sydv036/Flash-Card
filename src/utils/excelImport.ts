import ExcelJS from 'exceljs';
import type { FlashcardSheet, FlashcardWord } from '@/types/flashcard';

const REQUIRED_HEADERS = ['English', 'Translation', 'Example English', 'Example Vietnamese'] as const;

export async function parseExcelFile(file: File): Promise<FlashcardSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheets: FlashcardSheet[] = [];

  workbook.eachSheet(worksheet => {
    const columns = new Map<string, number>();
    worksheet.getRow(1).eachCell((cell, column) => columns.set(String(cell.value || '').trim(), column));
    const wordTypeColumn = columns.get('Word Type') || columns.get('Work Type');
    const missing: string[] = REQUIRED_HEADERS.filter(header => !columns.has(header));
    if (!wordTypeColumn) missing.push('Word Type');
    if (missing.length) {
      console.warn(`Sheet "${worksheet.name}" is missing headers: ${missing.join(', ')}. Skipping.`);
      return;
    }

    const words: FlashcardWord[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const read = (column?: number) => column ? String(row.getCell(column).value || '').trim() : '';
      const english = read(columns.get('English'));
      if (!english) return;
      words.push({
        english,
        wordType: read(wordTypeColumn),
        phonetic: read(columns.get('Phonetic')) || undefined,
        translation: read(columns.get('Translation')),
        exampleEnglish: read(columns.get('Example English')),
        exampleVietnamese: read(columns.get('Example Vietnamese')),
      });
    });
    if (words.length) sheets.push({ name: worksheet.name, words });
  });

  return sheets;
}
