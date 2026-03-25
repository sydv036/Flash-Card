import { ThemeProvider } from '@/context/ThemeContext';
import { FlashcardProvider } from '@/context/FlashcardContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { Header } from '@/components/Header';
import { SheetSelector } from '@/components/SheetSelector';
import { FlashcardCard } from '@/components/FlashcardCard';
import { CardControls } from '@/components/CardControls';
import { KeyboardShortcutsHint } from '@/components/KeyboardShortcuts';

export default function App() {
  return (
    <ThemeProvider>
      <FlashcardProvider>
        <TooltipProvider>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 dark:from-gray-950 dark:via-indigo-950/30 dark:to-purple-950/20 transition-colors duration-500">
            <Header />

            <main className="max-w-4xl mx-auto px-4 py-6 sm:py-10 flex flex-col items-center gap-6 sm:gap-8">
              {/* Sheet Selector */}
              <SheetSelector />

              {/* Flashcard */}
              <FlashcardCard />

              {/* Controls */}
              <CardControls />

              {/* Keyboard shortcuts hint */}
              <KeyboardShortcutsHint />
            </main>
          </div>

          <Toaster
            position="top-center"
            richColors
            closeButton
            toastOptions={{
              duration: 3000,
            }}
          />
        </TooltipProvider>
      </FlashcardProvider>
    </ThemeProvider>
  );
}
