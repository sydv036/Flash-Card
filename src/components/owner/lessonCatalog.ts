export const PARTS = [1, 2, 3, 4] as const;
export type Part = (typeof PARTS)[number];

export type Lesson = {
  lessonId: string;
  lessonName?: string;
  part?: number;
  title?: string;
  is_display: boolean;
  itemCount?: number;
  hasScript?: boolean;
  hasAudio?: boolean;
  hasImage?: boolean;
};

export type LessonSelection =
  | { mode: 'new'; lessonId: null; lessonName: string }
  | { mode: 'existing'; lessonId: string; lessonName: string };

export type LessonIdentity = { part: Part; lessonId: string; lessonName: string };

export const lessonRequest = (part: Part, selection: LessonSelection) => ({
  part,
  ...(selection.mode === 'existing' ? { lessonId: selection.lessonId } : {}),
  lessonName: selection.lessonName.normalize('NFC').trim(),
});
