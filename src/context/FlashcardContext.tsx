import { createContext, useContext, useCallback, useState, useMemo, useEffect, type ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { FlashcardSheet, FlashcardWord } from '@/types/flashcard';
import { toast } from 'sonner';

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
  
  searchTerm: string;
  setSearchTerm: (term: string) => void;

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
  const [searchTerm, setSearchTerm] = useState<string>('');

  const activeSheet = activeSheetIndex === -1 ? null : (sheets[activeSheetIndex] ?? null);
  const allWords = activeSheetIndex === -1 ? sheets.flatMap(s => s.words) : (activeSheet?.words ?? []);
  
  // Compute filtered words based on search term
  const words = useMemo(() => {
    if (!searchTerm.trim()) return allWords;
    const ls = searchTerm.toLowerCase();
    return allWords.filter(w => 
      w.english.toLowerCase().includes(ls) ||
      w.translation.toLowerCase().includes(ls) ||
      (w.exampleEnglish && w.exampleEnglish.toLowerCase().includes(ls)) ||
      (w.exampleVietnamese && w.exampleVietnamese.toLowerCase().includes(ls))
    );
  }, [allWords, searchTerm]);

  // Reset current word to 0 when search term changes so we don't go out of bounds
  useEffect(() => {
    if (words.length > 0) {
      setCurrentWordIndex(0);
    }
  }, [searchTerm, setCurrentWordIndex, words.length]);

  const currentWord = words[currentWordIndex] ?? null;
  const totalWords = words.length;
  const activeSheetName = activeSheetIndex === -1 ? 'Tất cả buổi học (Tổng hợp)' : (activeSheet?.name ?? '');

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
    if (allWords.length <= 1) return;
    
    if (activeSheetIndex === -1) {
      // Shuffling combined pool across all sheets is complex to persist to LocalStorage natively
      // So instead, we just shuffle the `filteredList`? But shuffleWords is supposed to mutate 'sheets'.
      // If we are combining all sheets, we probably shouldn't mutate and shuffle the master array permanently.
      // So let's skip shuffling logic if All Sheets is selected, or handle it as a session-only boundary.
      toast.warning('Không thể xáo trộn vật lý trên toàn bộ danh mục cùng lúc.');
      return;
    }

    if (!activeSheet) return;
    
    const shuffled = [...activeSheet.words]; // Shuffle the raw list, not the filtered one
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const newSheets = [...sheets];
    newSheets[activeSheetIndex] = { ...activeSheet, words: shuffled };
    setSheets(newSheets);
    setCurrentWordIndex(0);
  }, [activeSheet, allWords.length, sheets, activeSheetIndex, setSheets, setCurrentWordIndex]);

  const handleSetActiveSheetIndex = useCallback((index: number) => {
    setActiveSheetIndex(index);
    setCurrentWordIndex(0);
    setSearchTerm(''); // Clear search on sheet change
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
        searchTerm,
        setSearchTerm,
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
