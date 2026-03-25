import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { downloadTemplate } from '@/utils/excelTemplate';
import { toast } from 'sonner';

export function DownloadTemplateButton() {
  const handleDownload = async () => {
    try {
      await downloadTemplate();
      toast.success('📥 Đã tải file template mẫu thành công!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('❌ Lỗi khi tạo file template!');
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">Tải Template</span>
    </Button>
  );
}
