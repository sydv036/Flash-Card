import { useTheme } from '@/context/ThemeContext';
import { useFlashcard } from '@/context/FlashcardContext';
import { Switch } from '@/components/ui/switch';
import { Moon, Sun, Languages } from 'lucide-react';

export function SettingsBar() {
  const { theme, toggleTheme } = useTheme();
  const { showVietnameseFirst, setShowVietnameseFirst } = useFlashcard();

  return (
    <div className="flex items-center gap-4 sm:gap-6">
      {/* Side preference toggle */}
      <div className="flex items-center gap-2">
        <Languages className="h-4 w-4 text-muted-foreground" />
        <label
          htmlFor="side-pref"
          className="text-xs sm:text-sm text-muted-foreground cursor-pointer whitespace-nowrap"
        >
          {showVietnameseFirst ? 'VN trước' : 'EN trước'}
        </label>
        <Switch
          id="side-pref"
          checked={showVietnameseFirst}
          onCheckedChange={setShowVietnameseFirst}
        />
      </div>

      {/* Theme toggle */}
      <div className="flex items-center gap-2">
        {theme === 'light' ? (
          <Sun className="h-4 w-4 text-amber-500" />
        ) : (
          <Moon className="h-4 w-4 text-indigo-400" />
        )}
        <Switch
          id="theme-toggle"
          checked={theme === 'dark'}
          onCheckedChange={toggleTheme}
        />
      </div>
    </div>
  );
}
