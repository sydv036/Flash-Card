import { useRef } from 'react';
import { useFlashcard } from '@/context/FlashcardContext';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { parseExcelFile } from '@/utils/excelImport';
import { toast } from 'sonner';

export function ImportButton() {
  const { setSheets, setActiveSheetIndex } = useFlashcard();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('❌ Vui lòng chọn file Excel (.xlsx)!');
      return;
    }

    try {
      const sheets = await parseExcelFile(file);

      if (sheets.length === 0) {
        toast.error('❌ Không tìm thấy dữ liệu từ vựng trong file. Vui lòng kiểm tra lại format!');
        return;
      }

      const totalWords = sheets.reduce((sum, s) => sum + s.words.length, 0);

      setSheets(sheets);
      setActiveSheetIndex(0);

      toast.success(
        `✅ Import thành công! Đã tải ${totalWords} từ vựng từ ${sheets.length} buổi học.`
      );
    } catch (error) {
      console.error('Import error:', error);
      toast.error('❌ Lỗi khi đọc file Excel. Vui lòng kiểm tra lại file!');
    }

    // Reset input so same file can be re-imported
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleImport}
        className="hidden"
        id="excel-import"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        <span className="hidden sm:inline">Import Excel</span>
      </Button>
    </>
  );
}
