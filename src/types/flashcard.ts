// Types for the Flashcard application

export interface FlashcardWord {
  english: string;
  wordType: string;
  translation: string;
  exampleEnglish: string;
  exampleVietnamese: string;
  phonetic?: string;
}

export interface FlashcardSheet {
  name: string;
  words: FlashcardWord[];
}

export interface AppState {
  sheets: FlashcardSheet[];
  activeSheetIndex: number;
  currentWordIndex: number;
  isFlipped: boolean;
  showVietnameseFirst: boolean;
  theme: 'light' | 'dark';
}

export type SidePreference = 'english' | 'vietnamese';
