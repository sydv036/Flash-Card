import { SettingsBar } from '@/components/SettingsBar';
import { ImportButton } from '@/components/ImportButton';
import { DownloadTemplateButton } from '@/components/DownloadTemplateButton';
import { AddWordModal } from '@/components/AddWordModal';
import { BookOpen } from 'lucide-react';

export function Header() {
  return (
    <header className="w-full border-b border-border/40 bg-card/60 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center gap-3 sm:gap-0 sm:justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
            Flash Card Study
          </h1>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
          <AddWordModal />
          <ImportButton />
          <DownloadTemplateButton />
          <div className="hidden sm:block w-px h-6 bg-border" />
          <SettingsBar />
        </div>
      </div>
    </header>
  );
}
