import { useRef, useState } from 'react';
import { BookTemplate, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useFlashcard } from '@/context/flashcard-context';
import type { FlashcardSheet } from '@/types/flashcard';
import { parseExcelFile } from '@/utils/excelImport';

type PendingImport = { sheets: FlashcardSheet[]; totalWords: number; label: string };

export function ImportButton() {
  const { sheets: currentSheets, setSheets, setActiveSheetIndex } = useFlashcard();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  const applyImport = (nextImport: PendingImport) => {
    setSheets(nextImport.sheets);
    setActiveSheetIndex(0);
    setPendingImport(null);
    toast.success(`✅ ${nextImport.label}: ${nextImport.totalWords} từ trong ${nextImport.sheets.length} buổi học.`);
  };

  const stageImport = (nextSheets: FlashcardSheet[], label: string) => {
    if (!nextSheets.length) {
      toast.error('❌ Không tìm thấy dữ liệu từ vựng hợp lệ.');
      return;
    }
    const nextImport = { sheets: nextSheets, totalWords: nextSheets.reduce((sum, sheet) => sum + sheet.words.length, 0), label };
    if (currentSheets.length) setPendingImport(nextImport);
    else applyImport(nextImport);
  };

  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (!/\.xlsx?$/i.test(file.name)) throw new Error('Vui lòng chọn file Excel (.xlsx hoặc .xls).');
      stageImport(await parseExcelFile(file), 'Import thành công');
    } catch (error: unknown) {
      console.error('Import error:', error);
      toast.error(`❌ ${error instanceof Error ? error.message : 'Không thể đọc file Excel.'}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTemplateImport = async () => {
    setIsLoadingTemplate(true);
    try {
      const response = await fetch('/flashcard_template.xlsx');
      if (!response.ok) throw new Error(`Không thể tải template (HTTP ${response.status}).`);
      const file = new File([await response.blob()], 'flashcard_template.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      stageImport(await parseExcelFile(file), 'Đã tải dữ liệu mẫu');
    } catch (error: unknown) {
      console.error('Template import error:', error);
      toast.error(`❌ ${error instanceof Error ? error.message : 'Không thể tải dữ liệu mẫu.'}`);
    } finally {
      setIsLoadingTemplate(false);
    }
  };

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleExcelImport} className="hidden" id="excel-import" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="gap-2" id="import-button"><Upload className="h-4 w-4" /><span className="hidden sm:inline">Import</span></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Nhập dữ liệu từ vựng</DropdownMenuLabel><DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()} id="import-excel-option"><FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />Import từ Excel</DropdownMenuItem>
          <DropdownMenuItem onClick={handleTemplateImport} disabled={isLoadingTemplate} id="import-template-option">{isLoadingTemplate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookTemplate className="mr-2 h-4 w-4 text-indigo-600" />}{isLoadingTemplate ? 'Đang tải...' : 'Dùng Data có sẵn'}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={Boolean(pendingImport)} onOpenChange={open => { if (!open) setPendingImport(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Thay thế dữ liệu Cards?</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Dữ liệu hiện tại có <b>{currentSheets.length} buổi học</b> và sẽ bị thay thế.</p>
            <p>File mới có <b>{pendingImport?.sheets.length || 0} buổi học</b>, <b>{pendingImport?.totalWords || 0} từ</b>.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPendingImport(null)}>Hủy</Button><Button onClick={() => { if (pendingImport) applyImport(pendingImport); }}>Xác nhận thay thế</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
