import { Link, useLocation } from 'react-router-dom';
import { SettingsBar } from '@/components/SettingsBar';
import { ImportButton } from '@/components/ImportButton';
import { DownloadTemplateButton } from '@/components/DownloadTemplateButton';
import { AddWordModal } from '@/components/AddWordModal';
import { BookOpen, Headphones } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Header() {
  const location = useLocation();

  return (
    <header className="w-full border-b border-border/40 bg-card/60 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center gap-3 sm:gap-0 sm:justify-between">
        {/* Logo & Navigation */}
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full sm:w-auto">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
              Flash Card Study
            </h1>
          </Link>

          <nav className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
            <Link 
              to="/" 
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                location.pathname === '/' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <BookOpen className="w-4 h-4" />
              Cards
            </Link>
            <Link 
              to="/audio" 
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                location.pathname === '/audio' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <Headphones className="w-4 h-4" />
              Audio
            </Link>
          </nav>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center w-full sm:w-auto mt-2 sm:mt-0">
          {location.pathname === '/' && (
            <>
              <AddWordModal />
              <ImportButton />
              <DownloadTemplateButton />
              <div className="hidden sm:block w-px h-6 bg-border" />
            </>
          )}
          <SettingsBar />
        </div>
      </div>
    </header>
  );
}
