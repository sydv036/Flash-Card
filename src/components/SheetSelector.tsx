import { useFlashcard } from '@/context/FlashcardContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function SheetSelector() {
  const { sheets, activeSheetIndex, setActiveSheetIndex } = useFlashcard();

  if (sheets.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
        📖 Buổi học:
      </label>
      <Select
        value={String(activeSheetIndex)}
        onValueChange={(val) => setActiveSheetIndex(Number(val))}
      >
        <SelectTrigger className="w-[200px] bg-card/80 backdrop-blur-sm">
          <SelectValue placeholder="Chọn buổi học" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="-1">Tất cả buổi học (Tổng hợp)</SelectItem>
          {sheets.map((sheet, index) => (
            <SelectItem key={index} value={String(index)}>
              {sheet.name} ({sheet.words.length} từ)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
