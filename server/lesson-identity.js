import { parseLessonId, parsePart } from './r2-storage.js';

const normalizedText = value => String(value ?? '').normalize('NFC').trim();

export const resolveLessonIdentity = ({ source = {}, params = {}, query = {} } = {}) => {
  const explicitId = source?.lessonId ?? source?.session ?? params?.lessonId;
  const rawId = explicitId ?? source?.lessonName;
  const fallbackName = typeof explicitId === 'number' ? `Buổi ${explicitId}` : explicitId;
  const lessonName = normalizedText(source?.lessonName ?? fallbackName);

  return {
    part: parsePart(source?.part ?? query?.part ?? 1),
    lessonId: parseLessonId(rawId),
    lessonName,
  };
};
