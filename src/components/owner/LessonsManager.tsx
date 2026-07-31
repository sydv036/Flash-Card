import { useState } from "react";
import { FolderOpen, Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getLessonFiles,
  getSignedMediaUrl,
  type MediaFile,
} from "@/lib/localAudio";
import { PARTS, type Lesson, type Part } from "./lessonCatalog";
import { ownerErrorMessage, readOwnerApi } from "./ownerApi";
import { RenameLessonDialog } from "./RenameLessonDialog";

type LessonsManagerProps = {
  busy: boolean;
  lessons: Lesson[];
  loading: boolean;
  part: Part;
  refresh: () => Promise<void>;
  setBusy: (value: boolean) => void;
  setPart: (part: Part) => void;
};

export const LessonsManager = ({
  busy,
  lessons,
  loading,
  part,
  refresh,
  setBusy,
  setPart,
}: LessonsManagerProps) => {
  const [open, setOpen] = useState<Lesson | null>(null);
  const [media, setMedia] = useState<{
    audios: MediaFile[];
    images: MediaFile[];
  }>({ audios: [], images: [] });
  const [selected, setSelected] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<Lesson | null>(null);

  const openFiles = async (lesson: Lesson) => {
    setOpen(lesson);
    setSelected([]);
    try {
      setMedia(await getLessonFiles(Number(lesson.part || 1), lesson.lessonId));
    } catch (error) {
      toast.error(ownerErrorMessage(error));
    }
  };

  const removeFiles = async () => {
    if (!open || !selected.length)
      return toast.error("Vui lòng chọn ít nhất một file để xóa.");
    setBusy(true);
    try {
      await readOwnerApi(
        await fetch(
          `/api/lessons/${encodeURIComponent(open.lessonId)}/files?part=${open.part || 1}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paths: selected }),
          },
        ),
      );
      toast.success(`Đã xóa ${selected.length} file khỏi Server.`);
      setMedia(await getLessonFiles(Number(open.part || 1), open.lessonId));
      setSelected([]);
      await refresh();
    } catch (error) {
      toast.error(ownerErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (lesson: Lesson) => {
    setBusy(true);
    try {
      await readOwnerApi(
        await fetch(
          `/api/lessons/${encodeURIComponent(lesson.lessonId)}/display?part=${lesson.part || 1}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              part: lesson.part || 1,
              is_display: !lesson.is_display,
            }),
          },
        ),
      );
      toast.success(
        `Đã ${lesson.is_display ? "ẩn" : "hiển thị"} Part ${lesson.part || 1}, ${lesson.lessonName || lesson.lessonId}.`,
      );
      await refresh();
    } catch (error) {
      toast.error(ownerErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const renameLesson = async (lesson: Lesson, lessonName: string) => {
    setBusy(true);
    try {
      const data = await readOwnerApi<{ message?: string }>(
        await fetch(
          `/api/lessons/${encodeURIComponent(lesson.lessonId)}/name`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ part: lesson.part || 1, lessonName }),
          },
        ),
      );
      toast.success(data.message || "Đã đổi tên buổi học.");
      setRenaming(null);
      await refresh();
    } catch (error) {
      toast.error(ownerErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const executeRemoveLesson = async (lesson: Lesson) => {
    setBusy(true);
    try {
      const data = await readOwnerApi<{ message?: string }>(
        await fetch(
          `/api/lessons/${encodeURIComponent(lesson.lessonId)}?part=${lesson.part || 1}&types=script,audio,image`,
          { method: "DELETE" },
        ),
      );
      toast.success(data.message || "Đã xóa buổi học và media trên Server.");
      await refresh();
    } catch (error) {
      toast.error(ownerErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const removeLesson = (lesson: Lesson) =>
    toast.warning(
      `Xóa toàn bộ dữ liệu Part ${lesson.part || 1}, ${lesson.lessonName || lesson.lessonId}?`,
      {
        duration: 10000,
        action: {
          label: "Xóa",
          onClick: () => void executeRemoveLesson(lesson),
        },
        cancel: { label: "Hủy", onClick: () => undefined },
      },
    );

  const filtered = lessons.filter(
    (lesson) => Number(lesson.part || 1) === part,
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto">
        {PARTS.map((value) => (
          <button
            key={value}
            className={cn(
              "h-11 shrink-0 rounded-xl px-4 text-sm font-semibold",
              part === value ? "bg-indigo-600 text-white" : "bg-muted",
            )}
            onClick={() => setPart(value)}
          >
            Part {value}
          </button>
        ))}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-11 w-11 shrink-0"
          onClick={refresh}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center p-10">
          <Loader2 className="animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl bg-muted/40 p-10 text-center text-sm text-muted-foreground">
          Chưa có dữ liệu Part {part}.
        </p>
      ) : (
        filtered.map((lesson) => (
          <Card
            key={`${part}-${lesson.lessonId}`}
            className="rounded-[22px] bg-card/75 backdrop-blur-xl"
          >
            <CardContent className="flex items-center gap-3 p-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 font-bold uppercase text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
                {(lesson.lessonName || lesson.lessonId).slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <b className="block truncate text-sm">
                  {lesson.lessonName || lesson.title || lesson.lessonId}
                </b>
                <p className="truncate text-xs text-muted-foreground">
                  {lesson.lessonId} · {lesson.itemCount || 0} câu ·{" "}
                  {lesson.hasAudio ? "Có audio" : "Chưa có audio"} ·{" "}
                  {lesson.hasImage ? "Có ảnh" : "Chưa có ảnh"}
                </p>
              </div>
              <button
                aria-label="Đổi trạng thái hiển thị"
                disabled={busy || !lesson.hasScript}
                onClick={() => toggle(lesson)}
                className={cn(
                  "relative h-8 w-12 rounded-full disabled:opacity-40",
                  lesson.is_display ? "bg-emerald-500" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all",
                    lesson.is_display ? "left-5" : "left-1",
                  )}
                />
              </button>
              <Button
                aria-label="Đổi tên buổi học"
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                onClick={() => setRenaming(lesson)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                onClick={() => openFiles(lesson)}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-red-500"
                onClick={() => removeLesson(lesson)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))
      )}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center"
          onClick={() => setOpen(null)}
        >
          <div
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-[28px] bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-[28px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold">
                  Media Part {open.part || 1} ·{" "}
                  {open.lessonName || open.lessonId}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Slug: {open.lessonId}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setOpen(null)}>
                Đóng
              </Button>
            </div>
            {(["audios", "images"] as const).map((group) => (
              <div key={group} className="mb-4">
                <b className="text-sm">
                  {group === "audios" ? "Audio" : "Hình ảnh"} (
                  {media[group].length})
                </b>
                <div className="mt-2 space-y-1">
                  {media[group].map((file) => (
                    <label
                      key={file.key}
                      className="flex min-h-11 items-center gap-3 rounded-xl bg-muted/40 px-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-indigo-600"
                        checked={selected.includes(file.key)}
                        onChange={() =>
                          setSelected((values) =>
                            values.includes(file.key)
                              ? values.filter((value) => value !== file.key)
                              : [...values, file.key],
                          )
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {file.name}
                      </span>
                      {group === "audios" && (
                        <button
                          className="h-11 px-2 text-indigo-600"
                          onClick={async (event) => {
                            event.preventDefault();
                            try {
                              const url = await getSignedMediaUrl(file.key);
                              await new Audio(url).play();
                            } catch {
                              toast.error(`Không thể phát ${file.name}.`);
                            }
                          }}
                        >
                          Phát
                        </button>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <Button
              className="h-12 w-full rounded-2xl bg-red-600 text-white"
              disabled={!selected.length || busy}
              onClick={removeFiles}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Xóa {selected.length} file khỏi R2
            </Button>
          </div>
        </div>
      )}
      {renaming && (
        <RenameLessonDialog
          key={`${renaming.part}-${renaming.lessonId}`}
          busy={busy}
          lesson={renaming}
          onClose={() => setRenaming(null)}
          onRename={renameLesson}
        />
      )}
    </div>
  );
};
