import { useState } from 'react';
import { Copy, FileJson, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  LessonSelector,
} from './LessonSelector';
import {
  lessonRequest,
  type Lesson,
  type LessonIdentity,
  type LessonSelection,
  type Part,
} from './lessonCatalog';
import { ownerErrorMessage, readOwnerApi } from './ownerApi';

type MergeScriptResponse = LessonIdentity & { success: boolean; message?: string };

type ScriptUploadProps = {
  busy: boolean;
  catalogLoading: boolean;
  lessons: Lesson[];
  part: Part;
  selection: LessonSelection;
  setBusy: (value: boolean) => void;
  setPart: (part: Part) => void;
  setSelection: (selection: LessonSelection) => void;
  syncLesson: (identity: LessonIdentity) => Promise<void>;
};

export const ScriptUpload = ({ busy, catalogLoading, lessons, part, selection, setBusy, setPart, setSelection, syncLesson }: ScriptUploadProps) => {
  const [text, setText] = useState('');
  const [display, setDisplay] = useState(true);

  const save = async () => {
    const identity = lessonRequest(part, selection);
    if (!identity.lessonName) return toast.error('Vui lòng chọn hoặc nhập tên buổi học.');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return toast.error('JSON không hợp lệ. Vui lòng kiểm tra lại.');
    }
    const items = Array.isArray(parsed)
      ? parsed
      : (typeof parsed === 'object' && parsed !== null && 'items' in parsed ? (parsed as { items: unknown }).items : null);
    if (!Array.isArray(items) || !items.length) return toast.error('JSON phải chứa danh sách câu hỏi không rỗng.');

    setBusy(true);
    try {
      const data = await readOwnerApi<MergeScriptResponse>(await fetch('/api/merge-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...identity, items, is_display: display }),
      }));
      await syncLesson({ part: data.part as Part, lessonId: data.lessonId, lessonName: data.lessonName });
      toast.success(data.message || `Đã lưu script Part ${part}, ${data.lessonName}.`);
      setText('');
    } catch (error) {
      toast.error(ownerErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const prompt = 'Chuyển dữ liệu thành mảng JSON gồm id, image, answers (key, en, vi), correctAnswer. Chỉ trả về JSON hợp lệ.';
  return <div className="space-y-4">
    <Card className="rounded-[24px] bg-card/75 backdrop-blur-xl">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <LessonSelector context="script" loading={catalogLoading} lessons={lessons} part={part} selection={selection} onPartChange={setPart} onSelectionChange={setSelection} />
        <label className="flex min-h-11 items-center justify-between rounded-xl bg-muted/50 px-3 text-sm">
          <span>Hiển thị script cho người học</span>
          <input type="checkbox" className="h-5 w-5 accent-indigo-600" checked={display} onChange={event => setDisplay(event.target.checked)} />
        </label>
        <div className="flex items-center justify-between">
          <b className="text-sm">Nội dung JSON</b>
          <Button variant="ghost" className="h-11" onClick={() => navigator.clipboard.writeText(prompt).then(() => toast.success('Đã sao chép prompt.')).catch(() => toast.error('Không thể sao chép prompt.'))}>
            <Copy className="mr-2 h-4 w-4" />Prompt
          </Button>
        </div>
        <textarea id="script-json-textarea" value={text} onChange={event => setText(event.target.value)} className="min-h-72 w-full rounded-2xl border bg-background p-3 font-mono text-xs" placeholder='[{"id":1,"answers":[],"correctAnswer":"A"}]' />
      </CardContent>
    </Card>
    <Button id="submit-script-btn" className="h-12 w-full rounded-2xl" disabled={busy} onClick={save}>
      {busy ? <Loader2 className="mr-2 animate-spin" /> : <FileJson className="mr-2" />}Lưu JSON lên Git
    </Button>
  </div>;
};
