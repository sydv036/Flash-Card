import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PARTS, type Lesson, type LessonSelection, type Part } from './lessonCatalog';

const NEW_LESSON = '__new_lesson__';

const lessonStatus = (lesson: Lesson) => [
  lesson.hasScript ? 'script' : null,
  lesson.hasAudio ? 'audio' : null,
  lesson.hasImage ? 'ảnh' : null,
].filter(Boolean).join(', ') || 'chưa có dữ liệu';

type LessonSelectorProps = {
  context: 'media' | 'script';
  loading: boolean;
  lessons: Lesson[];
  part: Part;
  selection: LessonSelection;
  onPartChange: (part: Part) => void;
  onSelectionChange: (selection: LessonSelection) => void;
};

export const LessonSelector = ({
  context,
  loading,
  lessons,
  part,
  selection,
  onPartChange,
  onSelectionChange,
}: LessonSelectorProps) => {
  const available = lessons.filter(lesson => Number(lesson.part || 1) === part);
  const selectedLesson = selection.mode === 'existing'
    ? available.find(lesson => lesson.lessonId === selection.lessonId)
    : undefined;
  const canNameMediaOnly = context === 'script' && selectedLesson && !selectedLesson.hasScript;
  const selectedValue = selection.mode === 'existing' ? selection.lessonId : NEW_LESSON;

  const chooseLesson = (value: string) => {
    if (value === NEW_LESSON) {
      onSelectionChange({ mode: 'new', lessonId: null, lessonName: '' });
      return;
    }
    const lesson = available.find(item => item.lessonId === value);
    if (!lesson) return;
    onSelectionChange({
      mode: 'existing',
      lessonId: lesson.lessonId,
      lessonName: lesson.lessonName || lesson.lessonId,
    });
  };

  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <label className="text-xs font-semibold text-muted-foreground">Phần thi
      <select
        value={part}
        onChange={event => onPartChange(Number(event.target.value) as Part)}
        className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm text-foreground"
      >
        {PARTS.map(value => <option key={value} value={value}>TOEIC Part {value}</option>)}
      </select>
    </label>
    <div className="text-xs font-semibold text-muted-foreground">
      Buổi học
      <Select value={selectedValue} onValueChange={chooseLesson} disabled={loading}>
        <SelectTrigger className="mt-1 h-11 w-full rounded-xl bg-background px-3 text-sm font-normal text-foreground">
          <SelectValue placeholder={loading ? 'Đang tải danh sách…' : 'Chọn buổi học'} />
        </SelectTrigger>
        <SelectContent position="popper" align="start" className="max-w-[calc(100vw-2rem)]">
          <SelectItem value={NEW_LESSON}>＋ Thêm buổi học mới</SelectItem>
          {available.map(lesson => <SelectItem key={lesson.lessonId} value={lesson.lessonId}>
            <span className="block max-w-72 truncate">
              {lesson.lessonName || lesson.lessonId} · {lessonStatus(lesson)}
            </span>
          </SelectItem>)}
        </SelectContent>
      </Select>
      {selection.mode === 'existing' && <p className="mt-1 truncate font-normal">Slug: {selection.lessonId}</p>}
    </div>
    {(selection.mode === 'new' || canNameMediaOnly) && <label className="text-xs font-semibold text-muted-foreground sm:col-span-2">
      {canNameMediaOnly ? 'Tên hiển thị khi tạo script' : 'Tên buổi học mới'}
      <Input
        value={selection.lessonName}
        onChange={event => onSelectionChange({ ...selection, lessonName: event.target.value })}
        type="text"
        maxLength={120}
        placeholder="Ví dụ: Giao tiếp văn phòng 01"
        className="mt-1 h-11 rounded-xl"
      />
      {canNameMediaOnly && <p className="mt-1 font-normal">Folder R2 vẫn giữ nguyên; chỉ cập nhật tên hiển thị trong Git.</p>}
    </label>}
  </div>;
};
