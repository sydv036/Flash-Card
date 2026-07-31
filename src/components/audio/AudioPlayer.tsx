import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
  ImageIcon,
  ListMusic,
  Loader2,
  Music,
  Pause,
  Play,
  Repeat,
  Shuffle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getLessonFiles,
  getRemoteAudioFiles,
  getSignedMediaUrl,
  type AudioFile,
} from "@/lib/localAudio";
import {
  audioEndedAction,
  takeNextShuffledItem,
  type PlayMode,
} from "./audioPlaybackMode";

type Answer = { key: string; en: string; vi: string };
type ScriptItem = {
  id?: number;
  questionId?: number;
  answers?: Answer[];
  correctAnswer?: string;
};
type ScriptLesson = { is_display?: boolean; items?: ScriptItem[] };
type Lesson = {
  lessonId: string;
  lessonName?: string;
  part?: number;
  title?: string;
  is_display: boolean;
  hasAudio?: boolean;
  items?: ScriptItem[];
};

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "00:00";
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
};

const audioNumber = (name?: string) => Number(name?.match(/\d+/)?.[0] || 0);

async function readApi(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false)
    throw new Error(data.message || "Không thể tải dữ liệu bài nghe.");
  return data;
}

const errorMessage = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : "";
  return /[À-ỹ]/u.test(message) ? message : fallback;
};

export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const signedUrlCache = useRef(new Map<string, string>());
  const refreshedKey = useRef<string | null>(null);
  const breakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shuffleQueue = useRef<string[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [part, setPart] = useState(1);
  const [lessonId, setLessonId] = useState<string | "all">("all");
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [script, setScript] = useState<ScriptLesson | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [rate, setRate] = useState(
    () => Number(localStorage.getItem("fc-audio-rate")) || 1,
  );
  const [mode, setMode] = useState<PlayMode>("SEQUENTIAL");
  const [showScript, setShowScript] = useState(
    () => localStorage.getItem("fc-audio-show-script") === "true",
  );
  const [breakTime, setBreakTime] = useState(() =>
    Math.max(0, Number(localStorage.getItem("fc-audio-break")) || 0),
  );
  const [enlarged, setEnlarged] = useState(false);

  const clearBreakTimer = useCallback(() => {
    if (breakTimer.current) clearTimeout(breakTimer.current);
    breakTimer.current = null;
  }, []);

  useEffect(() => () => clearBreakTimer(), [clearBreakTimer]);
  useEffect(() => localStorage.setItem("fc-audio-rate", String(rate)), [rate]);
  useEffect(
    () => localStorage.setItem("fc-audio-break", String(breakTime)),
    [breakTime],
  );
  useEffect(
    () => localStorage.setItem("fc-audio-show-script", String(showScript)),
    [showScript],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await readApi(await fetch("/api/lessons"));
        const nextLessons: Lesson[] = data.lessons || [];
        if (cancelled) return;
        setLessons(nextLessons);
        setFiles(await getRemoteAudioFiles(nextLessons));
      } catch (error: unknown) {
        if (!cancelled)
          toast.error(errorMessage(error, "Không thể tải danh sách bài nghe."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const partLessons = useMemo(
    () =>
      lessons
        .filter(
          (item) =>
            Number(item.part || 1) === part &&
            item.hasAudio &&
            item.is_display !== false,
        )
        .sort((a, b) =>
          a.lessonId.localeCompare(b.lessonId, "vi", {
            numeric: true,
            sensitivity: "base",
          }),
        ),
    [lessons, part],
  );
  const visibleFiles = useMemo(
    () =>
      files.filter(
        (file) =>
          file.part === part &&
          (lessonId === "all" || file.lessonId === lessonId),
      ),
    [files, part, lessonId],
  );
  const currentIndex = visibleFiles.findIndex(
    (file) => file.key === currentKey,
  );
  const currentFile = currentIndex >= 0 ? visibleFiles[currentIndex] : null;
  const currentItem = useMemo(
    () =>
      script?.items?.find(
        (item) =>
          Number(item.id ?? item.questionId) === audioNumber(currentFile?.name),
      ),
    [script, currentFile],
  );

  const selectContext = (nextPart: number, nextLesson: string | "all") => {
    clearBreakTimer();
    shuffleQueue.current = [];
    audioRef.current?.pause();
    setPlaying(false);
    setPart(nextPart);
    setLessonId(nextLesson);
    setCurrentKey(null);
    setSourceUrl("");
    setScript(null);
    setImageUrl("");
  };

  useEffect(() => {
    if (!currentFile) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await readApi(
          await fetch(
            `/api/lessons/${encodeURIComponent(currentFile.lessonId)}/script?part=${currentFile.part}`,
          ),
        );
        if (!cancelled) setScript(data.lesson || data.script || data);
      } catch {
        if (!cancelled) setScript(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentFile]);

  useEffect(() => {
    if (!currentFile) return;
    let cancelled = false;
    setSourceLoading(true);
    (async () => {
      try {
        let url = signedUrlCache.current.get(currentFile.key);
        if (!url) {
          url = await getSignedMediaUrl(currentFile.key);
          signedUrlCache.current.set(currentFile.key, url);
        }
        if (!cancelled) {
          setSourceUrl(url);
          refreshedKey.current = null;
        }
      } catch (error: unknown) {
        if (!cancelled)
          toast.error(
            `Không thể mở ${currentFile.name}: ${errorMessage(error, "Lỗi không xác định")}`,
          );
      } finally {
        if (!cancelled) setSourceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentFile]);

  useEffect(() => {
    if (!currentFile) {
      setImageUrl("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const media = await getLessonFiles(
          currentFile.part,
          currentFile.lessonId,
        );
        const id = audioNumber(currentFile.name);
        const image = media.images.find(
          (file) => audioNumber(file.name) === id,
        );
        if (!cancelled)
          setImageUrl(image ? await getSignedMediaUrl(image.key) : "");
      } catch {
        if (!cancelled) setImageUrl("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentFile]);

  useEffect(() => {
    if (!sourceUrl || !audioRef.current) return;
    audioRef.current.src = sourceUrl;
    audioRef.current
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }, [sourceUrl]);

  useEffect(() => {
    shuffleQueue.current = [];
  }, [visibleFiles]);

  const move = useCallback(
    (direction: 1 | -1, automatic = false) => {
      clearBreakTimer();
      if (!visibleFiles.length) return;
      if (automatic && mode === "LOOP" && audioRef.current) {
        const replay = () => {
          if (!audioRef.current) return;
          audioRef.current.currentTime = 0;
          audioRef.current
            .play()
            .catch(() => toast.error("Không thể phát lại audio."));
        };
        if (breakTime > 0)
          breakTimer.current = setTimeout(replay, breakTime * 1000);
        else replay();
        return;
      }
      let targetKey: string | null = null;
      if (mode === "SHUFFLE" && direction === 1) {
        const shuffled = takeNextShuffledItem({
          items: visibleFiles.map((file) => file.key),
          current: currentKey,
          queue: shuffleQueue.current,
        });
        shuffleQueue.current = shuffled.queue;
        targetKey = shuffled.item;
      } else {
        const index =
          ((currentIndex < 0 ? 0 : currentIndex) +
            direction +
            visibleFiles.length) %
          visibleFiles.length;
        targetKey = visibleFiles[index].key;
      }
      if (!targetKey) return;
      const select = () => setCurrentKey(targetKey);
      if (automatic && breakTime > 0)
        breakTimer.current = setTimeout(select, breakTime * 1000);
      else select();
    },
    [visibleFiles, currentIndex, currentKey, mode, breakTime, clearBreakTimer],
  );

  const handleEnded = useCallback(() => {
    setPlaying(false);
    const action = audioEndedAction(mode);
    if (action === "STOP") {
      clearBreakTimer();
      return;
    }
    move(1, true);
  }, [mode, move, clearBreakTimer]);

  const moveLesson = (direction: 1 | -1) => {
    clearBreakTimer();
    if (lessonId !== "all" || !currentFile || !partLessons.length) return;
    const lessonIndex = partLessons.findIndex(
      (lesson) => lesson.lessonId === currentFile.lessonId,
    );
    const nextLesson =
      partLessons[
        (lessonIndex + direction + partLessons.length) % partLessons.length
      ];
    const target = visibleFiles.find(
      (file) => file.lessonId === nextLesson.lessonId,
    );
    if (target) setCurrentKey(target.key);
  };

  const togglePlay = () => {
    clearBreakTimer();
    if (!currentFile && visibleFiles[0]) {
      if (mode === "SHUFFLE") {
        const shuffled = takeNextShuffledItem({
          items: visibleFiles.map((file) => file.key),
          current: null,
          queue: [],
        });
        shuffleQueue.current = shuffled.queue;
        if (shuffled.item) setCurrentKey(shuffled.item);
      } else {
        setCurrentKey(visibleFiles[0].key);
      }
      return;
    }
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else
      audioRef.current
        .play()
        .catch(() => toast.error("Không thể phát audio. Vui lòng thử lại."));
  };

  const handleMediaError = async () => {
    if (!currentFile || refreshedKey.current === currentFile.key) {
      toast.error(`Không thể phát file ${currentFile?.name || ""}.`);
      return;
    }
    refreshedKey.current = currentFile.key;
    signedUrlCache.current.delete(currentFile.key);
    try {
      const url = await getSignedMediaUrl(currentFile.key);
      signedUrlCache.current.set(currentFile.key, url);
      setSourceUrl(url);
    } catch {
      toast.error(
        `Liên kết ${currentFile.name} đã hết hạn và không thể làm mới.`,
      );
    }
  };

  return (
    <div className="w-full space-y-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-6">
      <div className="rounded-[28px] border border-white/50 bg-white/70 p-4 shadow-xl shadow-indigo-500/10 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/65 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
            <Music className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold">Luyện nghe TOEIC</h2>
            <p className="text-xs text-muted-foreground">
              Audio được phát trực tiếp từ Server
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-muted-foreground">
            Phần thi
            <select
              className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm text-foreground"
              value={part}
              onChange={(e) => selectContext(Number(e.target.value), "all")}
            >
              {[1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  TOEIC Part {value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Buổi học
            <select
              className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm text-foreground"
              value={lessonId}
              onChange={(e) => selectContext(part, e.target.value)}
            >
              <option value="all">Tất cả buổi</option>
              {partLessons.map((lesson) => (
                <option key={lesson.lessonId} value={lesson.lessonId}>
                  {lesson.lessonName || lesson.title || lesson.lessonId}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Nghỉ giữa audio (giây)
            <input
              type="number"
              min={0}
              step={1}
              value={breakTime}
              onChange={(e) =>
                setBreakTime(Math.max(0, Number(e.target.value) || 0))
              }
              className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm text-foreground"
            />
          </label>
        </div>
      </div>

      <Card className="overflow-hidden rounded-[28px] border-white/50 bg-card/75 shadow-xl backdrop-blur-2xl dark:border-white/10">
        <CardContent className="p-4 sm:p-6">
          {imageUrl ? (
            <button
              className="mb-5 block w-full overflow-hidden rounded-2xl bg-muted"
              onClick={() => setEnlarged(true)}
            >
              <img
                src={imageUrl}
                className="max-h-72 w-full object-contain"
                alt="Ảnh câu hỏi"
              />
            </button>
          ) : (
            <div className="mb-5 flex h-36 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-sky-50 dark:from-indigo-950 dark:to-slate-900">
              <ImageIcon className="h-12 w-12 text-indigo-300" />
            </div>
          )}
          <div className="min-w-0 text-center">
            <p className="truncate font-semibold">
              {currentFile?.name || "Chọn một bài nghe"}
            </p>
            <p className="text-xs text-muted-foreground">
              {currentFile?.session || `${visibleFiles.length} audio`}
            </p>
          </div>
          <input
            aria-label="Tiến trình phát"
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (audioRef.current) audioRef.current.currentTime = value;
              setCurrentTime(value);
            }}
            className="mt-5 h-11 w-full accent-indigo-600"
          />
          <div className="-mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <Button
              title={mode === "SHUFFLE" ? "Tắt phát trộn" : "Bật phát trộn"}
              aria-label="Phát trộn audio"
              aria-pressed={mode === "SHUFFLE"}
              variant="ghost"
              size="icon"
              className={cn(
                "h-11 w-11 rounded-full",
                mode === "SHUFFLE" && "bg-indigo-100 dark:bg-indigo-950",
              )}
              onClick={() => {
                clearBreakTimer();
                shuffleQueue.current = [];
                setMode(mode === "SHUFFLE" ? "SEQUENTIAL" : "SHUFFLE");
              }}
            >
              <Shuffle
                className={cn(
                  "h-5 w-5",
                  mode === "SHUFFLE" && "text-indigo-600",
                )}
              />
            </Button>
            {lessonId === "all" && (
              <Button
                title="Buổi trước"
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full"
                onClick={() => moveLesson(-1)}
              >
                <ChevronsLeft className="h-5 w-5" />
              </Button>
            )}
            <Button
              variant="secondary"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={() => move(-1)}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              size="icon"
              className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg"
              onClick={togglePlay}
              disabled={loading || sourceLoading}
            >
              {sourceLoading ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : playing ? (
                <Pause className="h-7 w-7" />
              ) : (
                <Play className="ml-1 h-7 w-7" />
              )}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={() => move(1)}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
            {lessonId === "all" && (
              <Button
                title="Buổi tiếp theo"
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full"
                onClick={() => moveLesson(1)}
              >
                <ChevronsRight className="h-5 w-5" />
              </Button>
            )}
            <Button
              title={mode === "LOOP" ? "Tắt lặp audio" : "Lặp audio hiện tại"}
              aria-label="Lặp audio hiện tại"
              aria-pressed={mode === "LOOP"}
              variant="ghost"
              size="icon"
              className={cn(
                "h-11 w-11 rounded-full",
                mode === "LOOP" && "bg-indigo-100 dark:bg-indigo-950",
              )}
              onClick={() => {
                clearBreakTimer();
                shuffleQueue.current = [];
                setMode(mode === "LOOP" ? "SEQUENTIAL" : "LOOP");
              }}
            >
              <Repeat
                className={cn("h-5 w-5", mode === "LOOP" && "text-indigo-600")}
              />
            </Button>
          </div>
          <p
            className="mt-2 text-center text-xs text-muted-foreground"
            aria-live="polite"
          >
            {mode === "SHUFFLE"
              ? "Phát trộn đang bật · mỗi audio phát một lần trước khi trộn vòng mới"
              : mode === "LOOP"
                ? "Đang lặp lại audio hiện tại"
                : "Phát một audio rồi dừng"}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => (
              <button
                key={value}
                className={cn(
                  "h-11 min-w-11 rounded-xl px-2 text-xs font-semibold",
                  rate === value ? "bg-indigo-600 text-white" : "bg-muted",
                )}
                onClick={() => {
                  setRate(value);
                  if (audioRef.current) audioRef.current.playbackRate = value;
                }}
              >
                {value}×
              </button>
            ))}
          </div>
          <audio
            ref={audioRef}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration);
              e.currentTarget.playbackRate = rate;
            }}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onEnded={handleEnded}
            onError={handleMediaError}
          />
        </CardContent>
      </Card>

      {currentItem && script?.is_display !== false && (
        <Card className="rounded-[24px] bg-card/80 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Nội dung bài nghe</h3>
              <Button
                variant="ghost"
                className="h-11 rounded-xl"
                onClick={() => setShowScript(!showScript)}
              >
                {showScript ? (
                  <EyeOff className="mr-2 h-4 w-4" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                {showScript ? "Ẩn" : "Hiện"}
              </Button>
            </div>
            {showScript && (
              <div className="mt-3 space-y-2">
                {currentItem.answers?.map((answer) => (
                  <div
                    key={answer.key}
                    className={cn(
                      "rounded-2xl border p-3 text-sm",
                      answer.key === currentItem.correctAnswer &&
                        "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30",
                    )}
                  >
                    <b>
                      {answer.key}. {answer.en}
                    </b>
                    <p className="mt-1 text-muted-foreground">{answer.vi}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-[24px] bg-card/75 backdrop-blur-xl">
        <CardContent className="p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="flex items-center gap-2 font-semibold">
              <ListMusic className="h-4 w-4 text-indigo-500" />
              Danh sách
            </span>
            <span className="text-xs text-muted-foreground">
              {visibleFiles.length} file
            </span>
          </div>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="animate-spin" />
              </div>
            ) : visibleFiles.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Chưa có audio cho lựa chọn này.
              </p>
            ) : (
              visibleFiles.map((file) => (
                <button
                  key={file.key}
                  onClick={() => {
                    clearBreakTimer();
                    shuffleQueue.current = [];
                    setCurrentKey(file.key);
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm",
                    currentKey === file.key
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"
                      : "hover:bg-muted",
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background">
                    {currentKey === file.key && playing ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="ml-0.5 h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <b className="block truncate">{file.name}</b>
                    <small className="text-muted-foreground">
                      {file.session}
                    </small>
                  </span>
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {enlarged && imageUrl && (
        <button
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setEnlarged(false)}
        >
          <img
            src={imageUrl}
            alt="Ảnh phóng to"
            className="max-h-[90vh] max-w-full rounded-2xl object-contain"
          />
        </button>
      )}
    </div>
  );
}
