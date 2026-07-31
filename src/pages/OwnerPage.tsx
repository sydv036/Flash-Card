import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  FileJson,
  FolderOpen,
  Key,
  Loader2,
  Lock,
  Music,
} from "lucide-react";
import { toast } from "sonner";
import { LessonsManager } from "@/components/owner/LessonsManager";
import {
  type Lesson,
  type LessonIdentity,
  type LessonSelection,
  type Part,
} from "@/components/owner/lessonCatalog";
import { MediaUpload } from "@/components/owner/MediaUpload";
import { ownerErrorMessage, readOwnerApi } from "@/components/owner/ownerApi";
import { ScriptUpload } from "@/components/owner/ScriptUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Tab = "media" | "script" | "lessons";
type LessonsResponse = { lessons?: Lesson[] };

const emptySelection = (): LessonSelection => ({
  mode: "new",
  lessonId: null,
  lessonName: "",
});

export function OwnerPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("media");
  const [part, setPartState] = useState<Part>(1);
  const [selection, setSelection] = useState<LessonSelection>(emptySelection);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const refreshLessons = useCallback(
    async (identity?: LessonIdentity) => {
      setCatalogLoading(true);
      try {
        const data = await readOwnerApi<LessonsResponse>(
          await fetch("/api/lessons"),
        );
        const catalog = data.lessons || [];
        setLessons(catalog);
        if (identity) {
          const stored = catalog.find(
            (lesson) =>
              Number(lesson.part || 1) === identity.part &&
              lesson.lessonId === identity.lessonId,
          );
          setPartState(identity.part);
          setSelection({
            mode: "existing",
            lessonId: identity.lessonId,
            lessonName: stored?.lessonName || identity.lessonName,
          });
        } else {
          setSelection((current) => {
            if (current.mode !== "existing") return current;
            const stored = catalog.find(
              (lesson) =>
                Number(lesson.part || 1) === part &&
                lesson.lessonId === current.lessonId,
            );
            if (!stored) return emptySelection();
            return {
              ...current,
              lessonName: stored.lessonName || current.lessonName,
            };
          });
        }
      } catch (error) {
        toast.error(
          `Không thể tải danh sách buổi học: ${ownerErrorMessage(error)}`,
        );
      } finally {
        setCatalogLoading(false);
      }
    },
    [part],
  );

  useEffect(() => {
    fetch("/api/auth/verify")
      .then((response) => readOwnerApi<{ authenticated?: boolean }>(response))
      .then((data) => setAuthenticated(Boolean(data.authenticated)))
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (authenticated) void refreshLessons();
  }, [authenticated, refreshLessons]);

  const setPart = (value: Part) => {
    setPartState(value);
    setSelection(emptySelection());
  };

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const password = String(
      new FormData(event.currentTarget).get("password") || "",
    );
    try {
      const data = await readOwnerApi<{ success?: boolean }>(
        await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }),
      );
      setAuthenticated(Boolean(data.success));
      toast.success("Đăng nhập thành công.");
    } catch {
      toast.error("Mật khẩu không chính xác hoặc không thể kết nối.");
    }
  };

  if (checking)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" />
      </div>
    );

  if (!authenticated)
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 to-indigo-100 p-4 dark:from-slate-950 dark:to-indigo-950">
        <Card className="w-full max-w-sm rounded-[28px] bg-card/75 shadow-2xl backdrop-blur-2xl">
          <CardContent className="p-6">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white">
              <Lock />
            </span>
            <h1 className="text-center text-xl font-bold">Khu vực quản trị</h1>
            <form onSubmit={login} className="mt-6 space-y-3">
              <div className="relative">
                <Key className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  name="password"
                  type="password"
                  className="h-12 rounded-2xl pl-10"
                  placeholder="Nhập mật khẩu"
                  autoFocus
                />
              </div>
              <Button className="h-12 w-full rounded-2xl">Đăng nhập</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );

  const tabs: { id: Tab; label: string; icon: typeof Music }[] = [
    { id: "media", label: "Media", icon: Music },
    { id: "script", label: "Script", icon: FileJson },
    { id: "lessons", label: "Danh sách", icon: BookOpen },
  ];

  const featureProps = {
    busy,
    catalogLoading,
    lessons,
    part,
    selection,
    setBusy,
    setPart,
    setSelection,
    syncLesson: (identity: LessonIdentity) => refreshLessons(identity),
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50/70 via-background to-indigo-50/40 px-4 py-6 dark:from-slate-950 dark:to-indigo-950/30 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
            <FolderOpen />
          </span>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">
              Quản lý TOEIC Listening
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">Server</p>
          </div>
        </header>
        <nav className="mb-5 grid grid-cols-3 rounded-2xl bg-white/65 p-1 shadow-sm backdrop-blur-xl dark:bg-white/5">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                disabled={busy}
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-2 rounded-xl text-xs font-semibold transition sm:text-sm",
                  tab === item.id
                    ? "bg-white text-indigo-700 shadow dark:bg-slate-800 dark:text-indigo-200"
                    : "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        {tab === "media" && <MediaUpload {...featureProps} />}
        {tab === "script" && <ScriptUpload {...featureProps} />}
        {tab === "lessons" && (
          <LessonsManager
            busy={busy}
            lessons={lessons}
            loading={catalogLoading}
            part={part}
            refresh={() => refreshLessons()}
            setBusy={setBusy}
            setPart={setPart}
          />
        )}
      </div>
    </main>
  );
}
