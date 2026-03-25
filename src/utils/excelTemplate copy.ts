import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * Generate and download a template Excel file with the correct headers
 * and a sample row so users know how to structure their data.
 */
export async function downloadTemplate(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Flashcard Study App';
  workbook.created = new Date();

  // Create two sample sheets
  const sheetNames = ['Buổi 1', 'Buổi 2'];

  for (const sheetName of sheetNames) {
    const worksheet = workbook.addWorksheet(sheetName);

    // Define columns with headers
    worksheet.columns = [
      { header: 'English', key: 'english', width: 20 },
      { header: 'Work Type', key: 'workType', width: 15 },
      { header: 'Translation', key: 'translation', width: 25 },
      { header: 'Example English', key: 'exampleEnglish', width: 40 },
      { header: 'Example Vietnamese', key: 'exampleVietnamese', width: 40 },
    ];

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 30;

    // Add sample data row
    if (sheetName === 'Buổi 1') {
      worksheet.addRow({
        english: 'abundant',
        workType: 'adjective',
        translation: 'dồi dào, phong phú',
        exampleEnglish: 'The region has abundant natural resources.',
        exampleVietnamese: 'Khu vực này có nguồn tài nguyên thiên nhiên dồi dào.',
      });
      worksheet.addRow({
        english: 'accomplish',
        workType: 'verb',
        translation: 'hoàn thành, đạt được',
        exampleEnglish: 'She accomplished all her goals this year.',
        exampleVietnamese: 'Cô ấy đã hoàn thành tất cả mục tiêu trong năm nay.',
      });
    } else {
      worksheet.addRow({
        english: 'collaborate',
        workType: 'verb',
        translation: 'hợp tác, cộng tác',
        exampleEnglish: 'The teams collaborate on the project.',
        exampleVietnamese: 'Các đội hợp tác trong dự án.',
      });
    }
  }

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, 'flashcard_template.xlsx');
}
