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
    <p className="text-xs text-muted-foreground text-center mt-2">
      💡 Dùng phím <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">←</kbd>{' '}
      <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">→</kbd> để điều hướng
      &bull; Nhấn vào thẻ để lật
    </p>
  );
}
