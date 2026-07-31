import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import type { FlashcardSheet, FlashcardWord } from '@/types/flashcard';
import type { ShuffleResult } from '@/lib/flashcardStudy';

export interface FlashcardContextValue {
  sheets: FlashcardSheet[];
  activeSheetIndex: number;
  currentWordIndex: number;
  showVietnameseFirst: boolean;
  currentWord: FlashcardWord | null;
  totalWords: number;
  activeSheetName: string;
  setSheets: Dispatch<SetStateAction<FlashcardSheet[]>>;
  setActiveSheetIndex: (index: number) => void;
  setCurrentWordIndex: (index: number) => void;
  setShowVietnameseFirst: (value: boolean) => void;
  nextWord: () => void;
  prevWord: () => void;
  shuffleWords: () => ShuffleResult;
  addWord: (sheetName: string, word: FlashcardWord) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  hasNext: boolean;
  hasPrev: boolean;
  isAutoReading: boolean;
  flashcardBreakTime: number;
  setFlashcardBreakTime: (value: number) => void;
  toggleAutoRead: () => void;
  stopAutoReading: () => void;
}

export const FlashcardContext = createContext<FlashcardContextValue | null>(null);

export function useFlashcard() {
  const context = useContext(FlashcardContext);
  if (!context) throw new Error('useFlashcard must be used within a FlashcardProvider');
  return context;
}
