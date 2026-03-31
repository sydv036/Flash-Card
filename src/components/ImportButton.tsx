import { useRef, useState } from 'react';
import { useFlashcard } from '@/context/FlashcardContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Upload, FileSpreadsheet, BookTemplate, Loader2 } from 'lucide-react';
import { parseExcelFile } from '@/utils/excelImport';
import { toast } from 'sonner';

export function ImportButton() {
  const { setSheets, setActiveSheetIndex } = useFlashcard();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);

  // ─── Option 1: Import file Excel từ máy ──────────────────────────────
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  // ─── Option 2: Import template có sẵn trên server ───────────────────
  const handleTemplateImport = async () => {
    setIsLoadingTemplate(true);
    try {
      const response = await fetch('/flashcard_template.xlsx');

      if (!response.ok) {
        throw new Error(`Không thể tải template (HTTP ${response.status})`);
      }

      const blob = await response.blob();
      const file = new File([blob], 'flashcard_template.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const sheets = await parseExcelFile(file);

      if (sheets.length === 0) {
        toast.error('❌ Template không chứa dữ liệu từ vựng hợp lệ!');
        return;
      }

      const totalWords = sheets.reduce((sum, s) => sum + s.words.length, 0);
      setSheets(sheets);
      setActiveSheetIndex(0);

      toast.success(
        `✅ Đã tải template mẫu! ${totalWords} từ vựng từ ${sheets.length} buổi học.`
      );
    } catch (error) {
      console.error('Template import error:', error);
      const message =
        error instanceof Error ? error.message : 'Lỗi không xác định.';
      toast.error(`❌ ${message}`);
    } finally {
      setIsLoadingTemplate(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleExcelImport}
        className="hidden"
        id="excel-import"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" id="import-button">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Nhập dữ liệu từ vựng</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Option 1: Import from local Excel file */}
          <DropdownMenuItem
            onClick={() => fileInputRef.current?.click()}
            id="import-excel-option"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
            Import từ Excel
          </DropdownMenuItem>

          {/* Option 2: Import template from server */}
          <DropdownMenuItem
            onClick={handleTemplateImport}
            disabled={isLoadingTemplate}
            id="import-template-option"
          >
            {isLoadingTemplate ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <BookTemplate className="h-4 w-4 mr-2 text-indigo-600 dark:text-indigo-400" />
            )}
            {isLoadingTemplate ? 'Đang tải...' : 'Dùng template mẫu'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
