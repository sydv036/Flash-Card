import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import { FlashcardProvider } from '@/context/FlashcardContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { Header } from '@/components/Header';
import { HomePage } from '@/pages/HomePage';
import { AudioPage } from '@/pages/AudioPage';

export default function App() {
  return (
    <ThemeProvider>
      <FlashcardProvider>
        <TooltipProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 dark:from-gray-950 dark:via-indigo-950/30 dark:to-purple-950/20 transition-colors duration-500 overflow-x-hidden">
              <Header />
              
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/audio" element={<AudioPage />} />
              </Routes>
            </div>

            <Toaster
              position="top-center"
              richColors
              closeButton
              toastOptions={{
                duration: 3000,
              }}
            />
          </BrowserRouter>
        </TooltipProvider>
      </FlashcardProvider>
    </ThemeProvider>
  );
}
