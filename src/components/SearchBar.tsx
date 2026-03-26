import { Search, Play, Pause } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFlashcard } from '@/context/FlashcardContext';

export function SearchBar() {
  const {
    searchTerm,
    setSearchTerm,
    totalWords,
    isAutoReading,
    toggleAutoRead,
    flashcardBreakTime,
    setFlashcardBreakTime
  } = useFlashcard();

  return (
    <div className="w-full max-w-lg mb-2 z-10 transition-all">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors group-focus-within:text-indigo-500">
          <Search className="h-5 w-5 text-muted-foreground/70 group-focus-within:text-indigo-500 transition-colors" />
        </div>
        <Input
          type="text"
          placeholder="Tìm kiếm từ vựng, dịch nghĩa, hoặc ví dụ..."
          className="pl-11 h-12 text-base w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-indigo-100 dark:border-indigo-900/50 shadow-sm focus-visible:ring-indigo-500 transition-all rounded-xl"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-xs font-medium text-indigo-700 bg-indigo-50 dark:bg-indigo-900/50 dark:text-indigo-300 px-2.5 py-1 rounded-full border border-indigo-100 dark:border-indigo-800">
              {totalWords} kết quả
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-3">
        <div className="flex items-center gap-3 mx-auto sm:mx-0">
          <Button
            variant={isAutoReading ? "default" : "outline"}
            className={isAutoReading ? "bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20" : "bg-white dark:bg-zinc-900"}
            onClick={toggleAutoRead}
          >
            {isAutoReading ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2 text-indigo-500" />}
            {isAutoReading ? "Dừng đọc" : "Tự động đọc"}
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground border border-input rounded-md px-3 h-10 bg-white dark:bg-zinc-900">
            <span className="font-medium whitespace-nowrap text-xs uppercase tracking-wider">Nghỉ:</span>
            <input
              type="number"
              min={0}
              className="w-12 bg-transparent outline-none tabular-nums text-foreground font-semibold"
              value={flashcardBreakTime}
              onChange={e => setFlashcardBreakTime(Math.max(0, Number(e.target.value)))}
              disabled={isAutoReading}
            />
            <span className="text-xs uppercase font-medium">giây</span>
          </div>
        </div>
      </div>
    </div>
  );
}
