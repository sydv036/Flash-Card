import { useRef, useState } from "react";
import { FileAudio, FileImage, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LessonSelector } from "./LessonSelector";
import {
  lessonRequest,
  type Lesson,
  type LessonIdentity,
  type LessonSelection,
  type Part,
} from "./lessonCatalog";
import {
  ownerErrorMessage,
  readOwnerApi,
  toVietnameseOwnerError,
} from "./ownerApi";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const BATCH_SIZE = 10;
const CONCURRENCY = 4;

type UploadItem = { clientId: string; kind: "audio" | "image"; file: File };
type PutFailureDetails = {
  intentRequestId?: string;
  status: number;
  errorCode: string;
  cloudflareRay?: string | null;
  fileKind: UploadItem["kind"];
};
type UploadIntent = {
  clientId: string;
  fileName: string;
  key: string;
  uploadUrl: string;
  contentType: string;
};
type IntentResponse = LessonIdentity & {
  uploads?: UploadIntent[];
  invalidFiles?: { filename?: string; fileName?: string; message?: string }[];
  requestId?: string;
};
type RegisterResponse = LessonIdentity & { success: boolean };

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const retry = async <T,>(operation: (attempt: number) => Promise<T>) => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await operation(attempt + 1);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await delay(500 * 2 ** attempt);
    }
  }
  throw lastError;
};

const reportPutFailure = (details: PutFailureDetails) => {
  void fetch("/api/media/upload-diagnostics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(details),
  }).catch(() => undefined);
};

const pool = async <T,>(items: T[], worker: (item: T) => Promise<void>) => {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await worker(items[index]);
      }
    }),
  );
};

const FilePicker = ({
  kind,
  files,
  onFiles,
}: {
  kind: "audio" | "image";
  files: File[];
  onFiles: (files: File[]) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isAudio = kind === "audio";
  return (
    <div>
      <input
        ref={inputRef}
        hidden
        type="file"
        multiple
        accept={isAudio ? ".mp3,audio/mpeg" : "image/*"}
        onChange={(event) => onFiles(Array.from(event.target.files || []))}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "min-h-32 w-full rounded-2xl border-2 border-dashed p-4 text-center transition active:scale-[.99]",
          isAudio
            ? "border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20"
            : "border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/20",
        )}
      >
        {isAudio ? (
          <FileAudio className="mx-auto mb-2 h-7 w-7 text-blue-500" />
        ) : (
          <FileImage className="mx-auto mb-2 h-7 w-7 text-violet-500" />
        )}
        <b className="text-sm">
          {files.length
            ? `Đã chọn ${files.length} ${isAudio ? "audio" : "ảnh"}`
            : `Chọn nhiều ${isAudio ? "audio MP3" : "ảnh"}`}
        </b>
        <p className="mt-1 text-xs text-muted-foreground">
          Mỗi file phải nhỏ hơn 2 MB
        </p>
      </button>
      {!!files.length && (
        <div className="mt-2 max-h-28 space-y-1 overflow-y-auto rounded-xl bg-muted/40 p-2">
          {files.map((file) => (
            <p
              key={`${file.name}-${file.lastModified}`}
              className="truncate text-xs"
            >
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

type MediaUploadProps = {
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

export const MediaUpload = ({
  busy,
  catalogLoading,
  lessons,
  part,
  selection,
  setBusy,
  setPart,
  setSelection,
  syncLesson,
}: MediaUploadProps) => {
  const [audio, setAudio] = useState<File[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const choose = (kind: "audio" | "image", selected: File[]) => {
    const invalidType = selected.filter((file) =>
      kind === "audio"
        ? !(
            file.type === "audio/mpeg" ||
            file.name.toLowerCase().endsWith(".mp3")
          )
        : !file.type.startsWith("image/"),
    );
    const tooLarge = selected.filter((file) => file.size >= MAX_FILE_SIZE);
    const invalid = new Set([...invalidType, ...tooLarge]);
    if (tooLarge.length)
      toast.error(
        `Các file phải nhỏ hơn 2 MB: ${tooLarge.map((file) => file.name).join(", ")}`,
        { duration: 10000 },
      );
    if (invalidType.length)
      toast.error(
        `Sai định dạng file: ${invalidType.map((file) => file.name).join(", ")}`,
        { duration: 10000 },
      );
    const valid = selected.filter((file) => !invalid.has(file));
    if (kind === "audio") setAudio(valid);
    else setImages(valid);
  };

  const upload = async () => {
    const identity = lessonRequest(part, selection);
    if (!identity.lessonName)
      return toast.error("Vui lòng chọn hoặc nhập tên buổi học.");
    const now = Date.now();
    const items: UploadItem[] = [
      ...audio.map((file, index) => ({
        clientId: `a-${now}-${index}`,
        kind: "audio" as const,
        file,
      })),
      ...images.map((file, index) => ({
        clientId: `i-${now}-${index}`,
        kind: "image" as const,
        file,
      })),
    ];
    if (!items.length)
      return toast.error("Vui lòng chọn ít nhất một file hợp lệ.");

    setBusy(true);
    setProgress({ done: 0, total: items.length });
    const failures: string[] = [];
    const failureReasons = new Set<string>();
    let resolvedIdentity: LessonIdentity | undefined;

    try {
      for (let start = 0; start < items.length; start += BATCH_SIZE) {
        const batch = items.slice(start, start + BATCH_SIZE);
        const data = await readOwnerApi<IntentResponse>(
          await fetch("/api/media/upload-intents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...identity,
              files: batch.map((item) => ({
                clientId: item.clientId,
                kind: item.kind,
                fileName: item.file.name,
                contentType:
                  item.file.type ||
                  (item.kind === "audio"
                    ? "audio/mpeg"
                    : "application/octet-stream"),
                size: item.file.size,
              })),
            }),
          }),
        );
        resolvedIdentity = {
          part: data.part as Part,
          lessonId: data.lessonId,
          lessonName: data.lessonName,
        };
        const intents = data.uploads || [];
        failures.push(
          ...(data.invalidFiles || []).map(
            (file) => file.filename || file.fileName || "Không rõ tên",
          ),
        );
        data.invalidFiles?.forEach((file) => {
          if (file.message)
            failureReasons.add(toVietnameseOwnerError(file.message));
        });

        const verified: {
          key: string;
          fileName: string;
          expectedSize: number;
          contentType: string;
        }[] = [];
        await pool(batch, async (item) => {
          const intent = intents.find(
            (value) => value.clientId === item.clientId,
          );
          if (!intent) {
            failures.push(item.file.name);
            setProgress((value) => ({ ...value, done: value.done + 1 }));
            return;
          }
          let putFailure: PutFailureDetails | undefined;
          try {
            await retry(async () => {
              let response: Response;
              try {
                response = await fetch(intent.uploadUrl, {
                  method: "PUT",
                  headers: {
                    "Content-Type": intent.contentType || item.file.type,
                  },
                  body: item.file,
                });
              } catch (error) {
                putFailure = {
                  intentRequestId: data.requestId,
                  status: 0,
                  errorCode:
                    error instanceof TypeError ? "NETWORK_OR_CORS" : "FETCH_FAILED",
                  fileKind: item.kind,
                };
                throw error;
              }
              if (!response.ok) {
                const responseText = await response.text();
                putFailure = {
                  intentRequestId: data.requestId,
                  status: response.status,
                  errorCode:
                    responseText.match(/<Code>([^<]+)<\/Code>/i)?.[1] ||
                    `HTTP_${response.status}`,
                  cloudflareRay: response.headers.get("cf-ray"),
                  fileKind: item.kind,
                };
                throw new Error(
                  toVietnameseOwnerError(responseText, response.status),
                );
              }
            });
            verified.push({
              key: intent.key,
              fileName: item.file.name,
              expectedSize: item.file.size,
              contentType: intent.contentType,
            });
          } catch (error) {
            if (putFailure) reportPutFailure(putFailure);
            failures.push(item.file.name);
            failureReasons.add(
              toVietnameseOwnerError(ownerErrorMessage(error)),
            );
          }
          setProgress((value) => ({ ...value, done: value.done + 1 }));
        });

        if (verified.length) {
          const response = await fetch("/api/media/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ objects: verified }),
          });
          const verification = await response.json().catch(() => ({}));
          if (Array.isArray(verification.invalidFiles)) {
            failures.push(
              ...verification.invalidFiles.map(
                (file: { filename?: string; fileName?: string }) =>
                  file.filename || file.fileName || "Không rõ tên",
              ),
            );
            verification.invalidFiles.forEach((file: { message?: string }) => {
              if (file.message)
                failureReasons.add(toVietnameseOwnerError(file.message));
            });
          } else if (!response.ok || verification.success === false) {
            failures.push(...verified.map((item) => item.fileName));
          }
        }
      }

      const uniqueFailures = [...new Set(failures)];
      failureReasons.forEach((reason) =>
        toast.error(reason, { duration: 12000 }),
      );
      if (uniqueFailures.length)
        toast.error(`Không thể tải lên: ${uniqueFailures.join(", ")}`, {
          duration: 12000,
        });
      const success = items.length - uniqueFailures.length;
      if (success && resolvedIdentity) {
        try {
          const registered = await readOwnerApi<RegisterResponse>(
            await fetch("/api/lessons/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(identity),
            }),
          );
          await syncLesson({
            part: registered.part as Part,
            lessonId: registered.lessonId,
            lessonName: registered.lessonName,
          });
        } catch (error) {
          toast.error(
            `Media đã lên R2 nhưng chưa lưu được tên buổi học vào Git: ${ownerErrorMessage(error)}`,
            { duration: 12000 },
          );
        }
        toast.success(
          `Đã tải lên thành công ${success}/${items.length} file cho Part ${part}, ${resolvedIdentity.lessonName}.`,
        );
      }
      if (success === items.length) {
        setAudio([]);
        setImages([]);
      }
    } catch (error) {
      toast.error(toVietnameseOwnerError(ownerErrorMessage(error)), {
        duration: 10000,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-[24px] border-white/60 bg-card/75 shadow-lg backdrop-blur-xl">
        <CardContent className="p-4 sm:p-5">
          <LessonSelector
            context="media"
            loading={catalogLoading}
            lessons={lessons}
            part={part}
            selection={selection}
            onPartChange={setPart}
            onSelectionChange={setSelection}
          />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FilePicker
          kind="audio"
          files={audio}
          onFiles={(files) => choose("audio", files)}
        />
        <FilePicker
          kind="image"
          files={images}
          onFiles={(files) => choose("image", files)}
        />
      </div>
      {busy && (
        <div className="rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
          <div className="mb-2 flex justify-between">
            <span>
              Đang tải lên {progress.done}/{progress.total} file…
            </span>
            <span>
              {progress.total
                ? Math.round((progress.done / progress.total) * 100)
                : 0}
              %
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-900">
            <div
              className="h-full bg-indigo-600 transition-all"
              style={{
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-white/50 bg-background/80 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-2xl sm:static sm:mx-0 sm:rounded-2xl sm:border">
        <Button
          id="submit-upload-btn"
          className="h-12 w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg"
          disabled={busy}
          onClick={upload}
        >
          {busy ? (
            <Loader2 className="mr-2 animate-spin" />
          ) : (
            <Upload className="mr-2" />
          )}
          Tải lên
        </Button>
      </div>
    </div>
  );
};
