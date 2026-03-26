import { useEffect } from 'react';
import { useFlashcard } from '@/context/FlashcardContext';

/**
 * Keyboard shortcuts component.
 * Handles left/right arrow keys for navigation.
 */
export function KeyboardShortcutsHint() {
  const { nextWord, prevWord, hasNext, hasPrev, totalWords } = useFlashcard();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && hasNext) {
        nextWord();
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        prevWord();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextWord, prevWord, hasNext, hasPrev]);

  if (totalWords === 0) return null;

  return (
    <div className="text-xs text-muted-foreground text-center mt-2 space-y-1">
      <p>
        💡 <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">←</kbd>{' '}
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">→</kbd> điều hướng
        <span className="mx-2">&bull;</span>
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Space</kbd> lật thẻ
      </p>
      <p>
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd> đọc từ vựng
        <span className="mx-2">&bull;</span>
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Shift</kbd> đọc ví dụ
      </p>
    </div>
  );
}
