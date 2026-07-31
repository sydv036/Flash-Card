import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export async function downloadTemplate(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Flashcard Study App';
  const worksheet = workbook.addWorksheet('Buổi 1');
  worksheet.columns = [
    { header: 'English', key: 'english', width: 20 },
    { header: 'Word Type', key: 'wordType', width: 15 },
    { header: 'Phonetic', key: 'phonetic', width: 18 },
    { header: 'Translation', key: 'translation', width: 25 },
    { header: 'Example English', key: 'exampleEnglish', width: 40 },
    { header: 'Example Vietnamese', key: 'exampleVietnamese', width: 40 },
  ];
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;
  worksheet.addRow({
    english: 'adjust',
    wordType: 'verb',
    phonetic: '/əˈdʒʌst/',
    translation: 'điều chỉnh',
    exampleEnglish: 'Please adjust the volume.',
    exampleVietnamese: 'Vui lòng điều chỉnh âm lượng.',
  });
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'flashcard_template.xlsx');
}
