import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { FlashcardSheet, FlashcardWord } from '@/types/flashcard';

// ─── Context Value Type ─────────────────────────────────────────────
interface FlashcardContextValue {
  sheets: FlashcardSheet[];
  activeSheetIndex: number;
  currentWordIndex: number;
  showVietnameseFirst: boolean;
  currentWord: FlashcardWord | null;
  totalWords: number;
  activeSheetName: string;

  setSheets: (sheets: FlashcardSheet[]) => void;
  setActiveSheetIndex: (index: number) => void;
  setCurrentWordIndex: (index: number) => void;
  setShowVietnameseFirst: (value: boolean) => void;

  nextWord: () => void;
  prevWord: () => void;
  shuffleWords: () => void;
  addWord: (sheetName: string, word: FlashcardWord) => void;
  hasNext: boolean;
  hasPrev: boolean;
}

const FlashcardContext = createContext<FlashcardContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────
export function FlashcardProvider({ children }: { children: ReactNode }) {
  const [sheets, setSheets] = useLocalStorage<FlashcardSheet[]>('fc-sheets', []);
  const [activeSheetIndex, setActiveSheetIndex] = useLocalStorage<number>('fc-active-sheet', 0);
  const [currentWordIndex, setCurrentWordIndex] = useLocalStorage<number>('fc-current-word', 0);
  const [showVietnameseFirst, setShowVietnameseFirst] = useLocalStorage<boolean>('fc-vn-first', false);

  const activeSheet = sheets[activeSheetIndex] ?? null;
  const words = activeSheet?.words ?? [];
  const currentWord = words[currentWordIndex] ?? null;
  const totalWords = words.length;
  const activeSheetName = activeSheet?.name ?? '';

  const hasNext = currentWordIndex < totalWords - 1;
  const hasPrev = currentWordIndex > 0;

  const nextWord = useCallback(() => {
    if (currentWordIndex < totalWords - 1) {
      setCurrentWordIndex(currentWordIndex + 1);
    }
  }, [currentWordIndex, totalWords, setCurrentWordIndex]);

  const prevWord = useCallback(() => {
    if (currentWordIndex > 0) {
      setCurrentWordIndex(currentWordIndex - 1);
    }
  }, [currentWordIndex, setCurrentWordIndex]);

  const shuffleWords = useCallback(() => {
    if (!activeSheet || totalWords <= 1) return;
    const shuffled = [...activeSheet.words];
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const newSheets = [...sheets];
    newSheets[activeSheetIndex] = { ...activeSheet, words: shuffled };
    setSheets(newSheets);
    setCurrentWordIndex(0);
  }, [activeSheet, totalWords, sheets, activeSheetIndex, setSheets, setCurrentWordIndex]);

  const handleSetActiveSheetIndex = useCallback((index: number) => {
    setActiveSheetIndex(index);
    setCurrentWordIndex(0);
  }, [setActiveSheetIndex, setCurrentWordIndex]);

  const addWord = useCallback((sheetName: string, word: FlashcardWord) => {
    setSheets((prevSheets) => {
      const newSheets = [...prevSheets];
      const sheetIndex = newSheets.findIndex(s => s.name === sheetName);
      
      if (sheetIndex >= 0) {
        newSheets[sheetIndex] = {
          ...newSheets[sheetIndex],
          words: [word, ...newSheets[sheetIndex].words] // Add to beginning
        };
      } else {
        newSheets.push({
          name: sheetName,
          words: [word]
        });
      }
      return newSheets;
    });
  }, [setSheets]);

  return (
    <FlashcardContext.Provider
      value={{
        sheets,
        activeSheetIndex,
        currentWordIndex,
        showVietnameseFirst,
        currentWord,
        totalWords,
        activeSheetName,
        setSheets,
        setActiveSheetIndex: handleSetActiveSheetIndex,
        setCurrentWordIndex,
        setShowVietnameseFirst,
        nextWord,
        prevWord,
        shuffleWords,
        addWord,
        hasNext,
        hasPrev,
      }}
    >
      {children}
    </FlashcardContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────
export function useFlashcard() {
  const ctx = useContext(FlashcardContext);
  if (!ctx) {
    throw new Error('useFlashcard must be used within a FlashcardProvider');
  }
  return ctx;
}
