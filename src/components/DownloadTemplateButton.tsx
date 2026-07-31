import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { downloadTemplate } from '@/utils/excelTemplate';

export function DownloadTemplateButton() {
  const [loading, setLoading] = useState(false);
  const handleDownload = async () => {
    setLoading(true);
    try {
      await downloadTemplate();
    } catch (error: unknown) {
      console.error('Template download error:', error);
      toast.error('Không thể tạo file template.');
    } finally {
      setLoading(false);
    }
  };
  return <Button variant="outline" size="sm" className="gap-2" onClick={handleDownload} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}<span className="hidden sm:inline">Tải Template</span></Button>;
}
