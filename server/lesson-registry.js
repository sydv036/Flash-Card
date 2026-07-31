const normalizedName = value => String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
const comparableName = value => normalizedName(value).toLocaleLowerCase('vi');

const registryError = (status, message) => Object.assign(new Error(message), { status });

export const renameLessonRecord = ({ lessons, part, lessonId, lessonName, mediaExists = false }) => {
  const nextName = normalizedName(lessonName);
  if (!nextName) throw registryError(400, 'Vui lòng nhập tên buổi học mới.');
  if (nextName.length > 120) throw registryError(400, 'Tên buổi học không được vượt quá 120 ký tự.');

  const duplicate = lessons.find(lesson =>
    lesson.part === part &&
    lesson.lessonId !== lessonId &&
    comparableName(lesson.lessonName || lesson.lessonId) === comparableName(nextName)
  );
  if (duplicate) throw registryError(409, `Tên buổi học đã được dùng bởi ${duplicate.lessonName || duplicate.lessonId}.`);

  const index = lessons.findIndex(lesson => lesson.part === part && lesson.lessonId === lessonId);
  if (index < 0 && !mediaExists) throw registryError(404, `Không tìm thấy Part ${part} - buổi ${lessonId}.`);

  const existing = index >= 0 ? lessons[index] : {
    part,
    lessonId,
    is_display: true,
    items: [],
  };
  const renamed = {
    ...existing,
    part,
    lessonId,
    lessonName: nextName,
    title: `TOEIC Part ${part} - ${nextName}`,
  };
  const updated = [...lessons];
  if (index >= 0) updated[index] = renamed;
  else updated.push(renamed);
  updated.sort((left, right) => left.part - right.part || left.lessonId.localeCompare(right.lessonId, 'vi', { numeric: true, sensitivity: 'base' }));

  return { lessons: updated, lesson: renamed, created: index < 0 };
};
