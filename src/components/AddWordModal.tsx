import { useState } from 'react';
import { useFlashcard } from '@/context/FlashcardContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export function AddWordModal() {
  const { sheets, addWord, setActiveSheetIndex } = useFlashcard();
  const [isOpen, setIsOpen] = useState(false);

  // Form state
  const [english, setEnglish] = useState('');
  const [wordType, setWordType] = useState('');
  const [translation, setTranslation] = useState('');
  const [exampleEnglish, setExampleEnglish] = useState('');
  const [exampleVietnamese, setExampleVietnamese] = useState('');
  const [selectedSheet, setSelectedSheet] = useState('');

  // Determine initial sheet
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      if (sheets.length > 0 && !selectedSheet) {
        setSelectedSheet(sheets[0].name);
      } else if (sheets.length === 0) {
        setSelectedSheet('Buổi 1');
      }
    }
  };

  const handleSave = () => {
    if (!english.trim()) {
      toast.error('Vui lòng nhập từ tiếng Anh');
      return;
    }
    if (!translation.trim()) {
      toast.error('Vui lòng nhập bản dịch tiếng Việt');
      return;
    }
    if (!selectedSheet.trim()) {
      toast.error('Vui lòng chọn hoặc nhập tên buổi học');
      return;
    }

    addWord(selectedSheet.trim(), {
      english: english.trim(),
      wordType: wordType.trim(),
      translation: translation.trim(),
      exampleEnglish: exampleEnglish.trim(),
      exampleVietnamese: exampleVietnamese.trim(),
    });

    // Automatically set the active sheet to the one we just added to
    const targetSheetIndex = sheets.findIndex((s) => s.name === selectedSheet.trim());
    if (targetSheetIndex >= 0) {
      setActiveSheetIndex(targetSheetIndex);
    } else {
      // If a new sheet was created, it'll be added at the end
      setActiveSheetIndex(sheets.length);
    }

    toast.success('Đã thêm từ mới thành công');

    // Reset and close
    setEnglish('');
    setWordType('');
    setTranslation('');
    setExampleEnglish('');
    setExampleVietnamese('');
    setIsOpen(false);
  };

  // Generate unique sheet names
  const existingSheetNames = Array.from(new Set(sheets.map(s => s.name)));

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 dark:hover:from-indigo-950/50 dark:hover:to-purple-950/50">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Thêm từ mới</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Thêm từ vựng mới</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sheet" className="text-right">
              Buổi học
            </Label>
            <div className="col-span-3">
              {existingSheetNames.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn buổi học" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingSheetNames.map(name => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                      <SelectItem value="new_sheet_option">+ Tạo buổi học mới</SelectItem>
                    </SelectContent>
                  </Select>

                  {selectedSheet === 'new_sheet_option' && (
                    <Input
                      placeholder="Nhập tên buổi học mới"
                      onChange={(e) => setSelectedSheet(e.target.value)}
                      className="mt-2"
                      autoFocus
                    />
                  )}
                </div>
              ) : (
                <Input
                  id="sheet"
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  placeholder="Ví dụ: Buổi 1"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="english" className="text-right">
              Từ tiếng Anh <span className="text-destructive">*</span>
            </Label>
            <Input
              id="english"
              value={english}
              onChange={(e) => setEnglish(e.target.value)}
              className="col-span-3"
              placeholder="Ví dụ: adjust"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="translation" className="text-right">
              Bản dịch VN <span className="text-destructive">*</span>
            </Label>
            <Input
              id="translation"
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              className="col-span-3"
              placeholder="Ví dụ: Điều chỉnh"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="wordType" className="text-right">
              Phiên âm
            </Label>
            <Input
              id="wordType"
              value={wordType}
              onChange={(e) => setWordType(e.target.value)}
              className="col-span-3"
              placeholder="Ví dụ: /əˈdʒʌst/"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="exampleEn" className="text-right">
              Ví dụ tiếng Anh
            </Label>
            <Input
              id="exampleEn"
              value={exampleEnglish}
              onChange={(e) => setExampleEnglish(e.target.value)}
              className="col-span-3"
              placeholder="Ví dụ: ..."
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="exampleVn" className="text-right">
              Ví dụ tiếng Việt
            </Label>
            <Input
              id="exampleVn"
              value={exampleVietnamese}
              onChange={(e) => setExampleVietnamese(e.target.value)}
              className="col-span-3"
              placeholder="Ví dụ: ..."
            />
          </div>

        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
            Hủy
          </Button>
          <Button type="submit" onClick={handleSave}>
            Lưu từ mới
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
