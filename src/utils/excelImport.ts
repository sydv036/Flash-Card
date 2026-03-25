import ExcelJS from 'exceljs';
import type { FlashcardSheet, FlashcardWord } from '@/types/flashcard';

/**
 * Expected column headers in each sheet of the Excel file.
 */
const EXPECTED_HEADERS = [
  'English',
  'Work Type',
  'Translation',
  'Example English',
  'Example Vietnamese',
] as const;

/**
 * Parse an Excel (.xlsx) file and extract flashcard data from all sheets.
 * Each sheet becomes a FlashcardSheet with its words.
 */
export async function parseExcelFile(file: File): Promise<FlashcardSheet[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const sheets: FlashcardSheet[] = [];

  workbook.eachSheet((worksheet) => {
    const words: FlashcardWord[] = [];

    // Get header row to map column indices
    const headerRow = worksheet.getRow(1);
    const columnMap: Record<string, number> = {};

    headerRow.eachCell((cell, colNumber) => {
      const value = String(cell.value || '').trim();
      columnMap[value] = colNumber;
    });

    // Validate that we have at least the required columns
    const missingHeaders = EXPECTED_HEADERS.filter(
      (h) => !(h in columnMap)
    );

    if (missingHeaders.length > 0) {
      console.warn(
        `Sheet "${worksheet.name}" is missing headers: ${missingHeaders.join(', ')}. Skipping.`
      );
      return;
    }

    // Iterate through data rows (starting from row 2)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const getCellValue = (colName: string): string => {
        const colIndex = columnMap[colName];
        if (!colIndex) return '';
        const cell = row.getCell(colIndex);
        return String(cell.value || '').trim();
      };

      const english = getCellValue('English');
      if (!english) return; // skip empty rows

      words.push({
        english,
        wordType: getCellValue('Work Type'),
        translation: getCellValue('Translation'),
        exampleEnglish: getCellValue('Example English'),
        exampleVietnamese: getCellValue('Example Vietnamese'),
      });
    });

    if (words.length > 0) {
      sheets.push({
        name: worksheet.name,
        words,
      });
    }
  });

  return sheets;
}
