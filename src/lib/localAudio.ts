export interface AudioFile {
  id: string;
  key: string;
  name: string;
  session: string;
  lessonId: string;
  lessonName: string;
  part: 1 | 2 | 3 | 4;
  url?: string;
}

export interface MediaFile {
  key: string;
  path: string;
  name: string;
  size?: number;
  contentType?: string;
}

export interface LessonFiles {
  audios: MediaFile[];
  images: MediaFile[];
}

interface RemoteMediaFile {
  key?: string;
  path?: string;
  name?: string;
  size?: number;
  contentType?: string;
  part?: number;
  lessonId?: string;
  lessonName?: string;
}

interface RemoteLesson {
  lessonId: string;
  lessonName?: string;
  part?: number;
  hasAudio?: boolean;
  is_display?: boolean;
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'Không thể kết nối đến kho lưu trữ.');
  }
  return data;
}

export async function getLessonFiles(part: number, lessonId: string): Promise<LessonFiles> {
  const response = await fetch(`/api/lessons/${encodeURIComponent(lessonId)}/files?part=${part}`);
  const data = await readJson(response);
  const normalize = (file: RemoteMediaFile): MediaFile => {
    const key = String(file.key || file.path || '');
    return {
      key,
      path: String(file.path || key),
      name: file.name || key.split('/').pop() || 'Không rõ tên',
      size: file.size,
      contentType: file.contentType,
    };
  };
  return {
    audios: (data.audios || data.files?.audios || []).map(normalize),
    images: (data.images || data.files?.images || []).map(normalize),
  };
}

export async function getSignedMediaUrl(key: string): Promise<string> {
  const response = await fetch(`/api/media/read-url?key=${encodeURIComponent(key)}`);
  const data = await readJson(response);
  const url = data.url || data.readUrl;
  if (!url) throw new Error('Cloudflare không trả về đường dẫn phát file.');
  return url;
}

export async function getRemoteAudioFiles(lessons: RemoteLesson[]): Promise<AudioFile[]> {
  const activeLessons = new Set(lessons
    .filter(lesson => lesson.hasAudio && lesson.is_display !== false)
    .map(lesson => `${Number(lesson.part || 1)}:${String(lesson.lessonId)}`));
  if (!activeLessons.size) return [];

  const response = await fetch('/api/media/audio-files');
  const data = await readJson(response);
  return (data.files || [])
    .filter((file: RemoteMediaFile) => activeLessons.has(`${Number(file.part)}:${String(file.lessonId)}`))
    .map((file: RemoteMediaFile) => {
      const key = String(file.key || file.path || '');
      const part = Number(file.part) as 1 | 2 | 3 | 4;
      const lessonId = String(file.lessonId);
      const lesson = lessons.find(item => Number(item.part || 1) === part && String(item.lessonId) === lessonId);
      const lessonName = lesson?.lessonName || lessonId;
      return {
        id: key,
        key,
        name: file.name || key.split('/').pop() || 'Không rõ tên',
        lessonId,
        lessonName,
        part,
        session: `Part ${part} · ${lessonName}`,
      };
    })
    .sort((a: AudioFile, b: AudioFile) =>
      a.part - b.part || a.lessonId.localeCompare(b.lessonId, 'vi', { numeric: true, sensitivity: 'base' }) ||
      a.name.localeCompare(b.name, 'vi', { numeric: true, sensitivity: 'base' })
    );
}
