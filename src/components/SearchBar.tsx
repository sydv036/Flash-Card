import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useFlashcard } from '@/context/FlashcardContext';

export function SearchBar() {
  const { searchTerm, setSearchTerm, totalWords } = useFlashcard();
  
  return (
    <div className="w-full max-w-lg mb-[-12px] z-10 transition-all">
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
    </div>
  );
}
