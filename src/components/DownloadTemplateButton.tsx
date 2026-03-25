import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export function DownloadTemplateButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      asChild
      className="gap-2"
    >
      <a href="/flashcard_template.xlsx" download="flashcard_template.xlsx">
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Tải Template</span>
      </a>
    </Button>
  );
}
