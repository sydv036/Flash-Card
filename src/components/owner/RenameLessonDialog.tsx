import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Lesson } from './lessonCatalog';

type RenameLessonDialogProps = {
  busy: boolean;
  lesson: Lesson;
  onClose: () => void;
  onRename: (lesson: Lesson, lessonName: string) => Promise<void>;
};

export const RenameLessonDialog = ({ busy, lesson, onClose, onRename }: RenameLessonDialogProps) => {
  const [lessonName, setLessonName] = useState(lesson.lessonName || lesson.lessonId);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onRename(lesson, lessonName);
  };

  const normalizedName = lessonName.normalize('NFC').trim().replace(/\s+/g, ' ');
  const currentName = (lesson.lessonName || lesson.lessonId).normalize('NFC').trim().replace(/\s+/g, ' ');

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent>
      <form onSubmit={submit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>Đổi tên buổi học</DialogTitle>
          <DialogDescription>
            Tên hiển thị sẽ thay đổi nhưng slug và toàn bộ đường dẫn audio, hình ảnh trên R2 được giữ nguyên.
          </DialogDescription>
        </DialogHeader>
        <label className="block text-xs font-semibold text-muted-foreground">
          Tên mới
          <Input value={lessonName} onChange={event => setLessonName(event.target.value)} maxLength={120} className="mt-1 h-11" autoFocus />
        </label>
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Slug giữ nguyên: {lesson.lessonId}</p>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={busy || !normalizedName || normalizedName === currentName}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Lưu tên mới
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
};
