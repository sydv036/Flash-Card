import { useFlashcard } from '@/context/FlashcardContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';
import { toast } from 'sonner';

export function CardControls() {
  const {
    currentWordIndex,
    totalWords,
    nextWord,
    prevWord,
    shuffleWords,
    hasNext,
    hasPrev,
  } = useFlashcard();

  if (totalWords === 0) return null;

  const handleNext = () => {
    if (hasNext) {
      nextWord();
    } else {
      toast.info('🎉 Bạn đã hoàn thành tất cả từ trong bộ thẻ này!');
    }
  };

  const handleShuffle = () => {
    shuffleWords();
    toast.success('🔀 Đã xáo trộn thứ tự từ vựng!');
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-lg mx-auto">
      {/* Card counter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Thẻ
        </span>
        <span className="text-lg font-bold text-foreground tabular-nums">
          {currentWordIndex + 1}
        </span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-lg font-bold text-foreground tabular-nums">
          {totalWords}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${((currentWordIndex + 1) / totalWords) * 100}%` }}
        />
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={prevWord}
          disabled={!hasPrev}
          className="gap-2"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="hidden sm:inline">Trước</span>
        </Button>

        <Button
          variant="outline"
          size="lg"
          onClick={handleShuffle}
          className="gap-2"
        >
          <Shuffle className="h-5 w-5" />
          <span className="hidden sm:inline">Xáo trộn</span>
        </Button>

        <Button
          size="lg"
          onClick={handleNext}
          className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg"
        >
          <span className="hidden sm:inline">Tiếp theo</span>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
