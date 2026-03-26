import { SheetSelector } from '@/components/SheetSelector';
import { SearchBar } from '@/components/SearchBar';
import { FlashcardCard } from '@/components/FlashcardCard';
import { CardControls } from '@/components/CardControls';
import { KeyboardShortcutsHint } from '@/components/KeyboardShortcuts';

export function HomePage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-6 sm:py-10 flex flex-col items-center gap-6 sm:gap-8">
      {/* Sheet Selector */}
      <SheetSelector />

      {/* Search Input */}
      <SearchBar />

      {/* Flashcard */}
      <FlashcardCard />

      {/* Controls */}
      <CardControls />

      {/* Keyboard shortcuts hint */}
      <KeyboardShortcutsHint />
    </main>
  );
}
