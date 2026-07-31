import express from "express";
import crypto from "crypto";
import dotenv from "dotenv";
import { commitChanges, readFile } from "./github-api.js";
import { resolveLessonIdentity } from "./server/lesson-identity.js";
import { renameLessonRecord } from "./server/lesson-registry.js";
import {
  createRequestRateLimiter,
  requestRateLimitConfig,
  trustLocalProxy,
  trustProxyHops,
} from "./server/request-rate-limit.js";
import {
  MAX_FILES_PER_INTENT,
  MAX_MEDIA_SIZE,
  buildMediaKey,
  createReadUrl,
  createUploadUrl,
  deleteLessonMedia,
  deleteObject,
  deleteObjects,
  isAllowedMediaKey,
  lessonPrefixes,
  listAllAudioFiles,
  listLessonMedia,
  listMediaLessonIndex,
  parseLessonId,
  r2ConfigurationStatus,
  validateUploadFile,
  verifyObject,
  vietnameseR2Error,
} from "./server/r2-storage.js";

dotenv.config();

const app = express();
const PORT = 3001;
const SCRIPT_PATH = "src/utils/audio/script/script.json";
const COOKIE_NAME = "fc_owner_auth";
const rateLimitConfig = requestRateLimitConfig();
const apiRateLimiter = createRequestRateLimiter(rateLimitConfig.api);
const loginRateLimiter = createRequestRateLimiter(rateLimitConfig.login);
const ownerWriteRateLimiter = createRequestRateLimiter(
  rateLimitConfig.ownerWrite,
);

const proxyHops = trustProxyHops();
app.set("trust proxy", proxyHops > 0 ? proxyHops : trustLocalProxy);

app.use("/api", (req, res, next) => {
  if (req.method === "OPTIONS" || req.path === "/health") return next();
  return apiRateLimiter(req, res, next);
});
app.use(express.json({ limit: "1mb" }));

function jsonError(res, status, message, extra = {}) {
  return res.status(status).json({ success: false, message, ...extra });
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        return index < 0
          ? [item, ""]
          : [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
      }),
  );
}

function authSecret() {
  return process.env.OWNER_SESSION_SECRET || "";
}

function signExpiry(expires) {
  return crypto
    .createHmac("sha256", authSecret())
    .update(String(expires))
    .digest("hex");
}

function timingSafeEqualText(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isAuthenticated(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token || !authSecret()) return false;
  const [signature, expiresText] = token.split(".");
  const expires = Number(expiresText);
  if (!signature || !Number.isSafeInteger(expires) || Date.now() >= expires)
    return false;
  return timingSafeEqualText(signature, signExpiry(expiresText));
}

function requireOwner(req, res, next) {
  if (!isAuthenticated(req))
    return jsonError(
      res,
      401,
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    );
  next();
}

// Mọi thao tác thay đổi dữ liệu (trừ đăng nhập) đều cần owner session ở server.
app.use("/api", (req, res, next) => {
  if (
    ["GET", "HEAD", "OPTIONS"].includes(req.method) ||
    req.path === "/auth/login"
  )
    return next();
  return requireOwner(req, res, () => ownerWriteRateLimiter(req, res, next));
});

app.post("/api/auth/login", loginRateLimiter, (req, res) => {
  const passwords = (process.env.OWNER_PASSWORDS || process.env.VITE_PASS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const password = String(req.body?.password || "");
  if (!passwords.length || !authSecret()) {
    return jsonError(
      res,
      500,
      "Máy chủ chưa cấu hình thông tin đăng nhập owner.",
    );
  }
  const valid = passwords.some((candidate) =>
    timingSafeEqualText(candidate, password),
  );
  if (!valid) return jsonError(res, 401, "Mật khẩu không chính xác.");

  const configuredTtl = Number(
    process.env.OWNER_AUTH_TTL_SECONDS || process.env.VITE_AUTH_TTL,
  );
  const ttlSeconds =
    Number.isInteger(configuredTtl) && configuredTtl >= 60
      ? Math.min(configuredTtl, 604800)
      : 28800;
  const expires = Date.now() + ttlSeconds * 1000;
  const secure =
    process.env.VERCEL || process.env.NODE_ENV === "production"
      ? "; Secure"
      : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${signExpiry(expires)}.${expires}; HttpOnly; Max-Age=${ttlSeconds}; Path=/; SameSite=Strict${secure}`,
  );
  return res.json({ success: true, message: "Đăng nhập thành công." });
});

app.get("/api/auth/verify", (req, res) => {
  res.json({ success: true, authenticated: isAuthenticated(req) });
});

async function readScriptFromGitHub() {
  const result = await readFile(SCRIPT_PATH);
  if (!result) return { lessons: [] };
  let parsed;
  try {
    parsed = JSON.parse(result.content);
  } catch (error) {
    throw new Error(
      `File script.json không phải JSON hợp lệ: ${error.message}`,
    );
  }
  const lessons = Array.isArray(parsed) ? parsed : [parsed];
  return {
    lessons: lessons.map((lesson) => {
      const sourceId = lesson.lessonId ?? lesson.session;
      const lessonId = parseLessonId(sourceId);
      return {
        ...lesson,
        part: Number(lesson.part) || 1,
        lessonId,
        lessonName: String(
          lesson.lessonName ||
            (typeof sourceId === "number"
              ? `Buổi ${sourceId}`
              : sourceId || lessonId),
        ),
      };
    }),
  };
}

function scriptFile(lessons) {
  return [
    {
      path: SCRIPT_PATH,
      content: JSON.stringify(lessons, null, 2),
      encoding: "utf-8",
    },
  ];
}

const lessonIdentity = (req, source = req.body) =>
  resolveLessonIdentity({ source, params: req.params, query: req.query });

app.post("/api/media/upload-intents", async (req, res) => {
  try {
    const { part, lessonId, lessonName } = lessonIdentity(req);
    const files = req.body?.files;
    if (!Array.isArray(files) || !files.length)
      return jsonError(res, 400, "Vui lòng chọn ít nhất một file để tải lên.");
    if (files.length > MAX_FILES_PER_INTENT) {
      return jsonError(
        res,
        400,
        `Mỗi đợt chỉ được tạo tối đa ${MAX_FILES_PER_INTENT} yêu cầu tải lên.`,
      );
    }

    const validFiles = [];
    const invalidFiles = [];
    for (const source of files) {
      try {
        validFiles.push({ source, ...validateUploadFile(source) });
      } catch (error) {
        invalidFiles.push({
          filename:
            source?.filename ||
            source?.fileName ||
            source?.name ||
            "Không rõ tên",
          message: error.message,
        });
      }
    }
    const uploadIntents = await Promise.all(
      validFiles.map(async (file) => {
        const key = buildMediaKey({
          kind: file.kind,
          part,
          lessonId,
          filename: file.filename,
        });
        return {
          clientId: file.source.clientId,
          filename: file.filename,
          fileName: file.filename,
          name: file.filename,
          key,
          contentType: file.contentType,
          uploadUrl: await createUploadUrl({
            key,
            contentType: file.contentType,
          }),
          expiresIn: Math.min(
            Math.max(Number(process.env.R2_UPLOAD_URL_TTL_SECONDS) || 300, 60),
            900,
          ),
        };
      }),
    );
    if (!uploadIntents.length) {
      return jsonError(res, 400, "Không có file hợp lệ để tải lên.", {
        invalidFiles,
      });
    }
    res.json({
      success: true,
      message: invalidFiles.length
        ? "Đã bỏ qua các file không hợp lệ."
        : `Đã chuẩn bị ${uploadIntents.length} file để tải lên.`,
      uploadIntents,
      uploads: uploadIntents,
      intents: uploadIntents,
      invalidFiles,
      maxFileSize: MAX_MEDIA_SIZE,
      part,
      lessonId,
      lessonName,
    });
  } catch (error) {
    console.error("[R2 Upload Intent]", error);
    jsonError(res, 500, vietnameseR2Error(error));
  }
});

app.post("/api/media/verify", async (req, res) => {
  const files = req.body?.files || req.body?.objects;
  if (
    !Array.isArray(files) ||
    !files.length ||
    files.length > MAX_FILES_PER_INTENT
  ) {
    return jsonError(
      res,
      400,
      `Danh sách xác minh phải có từ 1 đến ${MAX_FILES_PER_INTENT} file.`,
    );
  }
  const verified = [];
  const invalidFiles = [];
  await Promise.all(
    files.map(async (file) => {
      const filename = String(
        file?.filename ||
          file?.fileName ||
          file?.name ||
          file?.key?.split("/").pop() ||
          "Không rõ tên",
      );
      try {
        if (!isAllowedMediaKey(file?.key))
          throw new Error("Đường dẫn file không hợp lệ.");
        const metadata = await verifyObject(file.key);
        const expectedSize =
          file.expectedSize === undefined
            ? undefined
            : Number(file.expectedSize);
        const expectedType = file.contentType
          ? String(file.contentType).toLowerCase()
          : undefined;
        const wrongSize =
          metadata.size < 1 ||
          metadata.size >= MAX_MEDIA_SIZE ||
          (Number.isInteger(expectedSize) && metadata.size !== expectedSize);
        const wrongType =
          expectedType && metadata.contentType.toLowerCase() !== expectedType;
        if (wrongSize || wrongType) {
          await deleteObject(file.key);
          const reason =
            metadata.size >= MAX_MEDIA_SIZE
              ? "File phải nhỏ hơn 2 MB và đã được xóa khỏi Cloudflare."
              : "File tải lên không khớp dung lượng hoặc định dạng ban đầu.";
          invalidFiles.push({ filename, key: file.key, message: reason });
          return;
        }
        verified.push({ filename, key: file.key, ...metadata });
      } catch (error) {
        invalidFiles.push({
          filename,
          key: file?.key,
          message: vietnameseR2Error(error),
        });
      }
    }),
  );
  const success = invalidFiles.length === 0;
  res.status(verified.length ? 200 : 400).json({
    success,
    message: success
      ? `Đã xác minh ${verified.length} file thành công.`
      : `Có ${invalidFiles.length} file tải lên không hợp lệ.`,
    verified,
    invalidFiles,
  });
});

app.get("/api/media/read-url", async (req, res) => {
  try {
    const key = String(req.query.key || "");
    const signed = await createReadUrl(key);
    res.json({
      success: true,
      key,
      ...signed,
      expiresAt: Date.now() + signed.expiresIn * 1000,
    });
  } catch (error) {
    jsonError(
      res,
      isAllowedMediaKey(req.query.key) ? 500 : 400,
      vietnameseR2Error(error),
    );
  }
});

app.get("/api/media/audio-files", async (_req, res) => {
  try {
    const files = await listAllAudioFiles();
    res.json({ success: true, files });
  } catch (error) {
    console.error("[R2 Audio Files]", error);
    jsonError(res, 500, vietnameseR2Error(error));
  }
});

// Endpoint cũ không nhận binary qua Vercel nữa.
app.post("/api/upload", (_req, res) =>
  jsonError(
    res,
    410,
    "Cách tải file cũ đã ngừng hỗ trợ. Vui lòng tải trực tiếp lên Server.",
  ),
);

app.post("/api/lessons/register", async (req, res) => {
  try {
    const { part, lessonId, lessonName } = lessonIdentity(req);
    const { lessons } = await readScriptFromGitHub();
    const existing = lessons.find(
      (lesson) => lesson.part === part && lesson.lessonId === lessonId,
    );
    if (existing) {
      return res.json({
        success: true,
        created: false,
        part,
        lessonId,
        lessonName: existing.lessonName || lessonName,
      });
    }
    lessons.push({
      part,
      lessonId,
      lessonName,
      title: `TOEIC Part ${part} - ${lessonName}`,
      is_display: true,
      items: [],
    });
    lessons.sort(
      (a, b) =>
        a.part - b.part ||
        a.lessonId.localeCompare(b.lessonId, "vi", {
          numeric: true,
          sensitivity: "base",
        }),
    );
    await commitChanges({
      filesToAdd: scriptFile(lessons),
      message: `[Lessons] Thêm Part ${part} - ${lessonName} (${lessonId})`,
    });
    res.json({ success: true, created: true, part, lessonId, lessonName });
  } catch (error) {
    console.error("[Register Lesson]", error);
    jsonError(res, error.status === 409 ? 409 : 500, error.message);
  }
});

app.post("/api/merge-script", async (req, res) => {
  try {
    const { part, lessonId, lessonName } = lessonIdentity(req);
    const { items, is_display } = req.body;
    if (!Array.isArray(items) || !items.length)
      return jsonError(res, 400, '"items" phải là mảng không rỗng.');
    const { lessons } = await readScriptFromGitHub();
    const newLesson = {
      lessonId,
      lessonName,
      part,
      title: String(req.body.title || `TOEIC Part ${part} - ${lessonName}`),
      is_display: is_display === undefined ? true : Boolean(is_display),
      items,
    };
    const index = lessons.findIndex(
      (lesson) => lesson.part === part && lesson.lessonId === lessonId,
    );
    const isUpdate = index >= 0;
    if (isUpdate) lessons[index] = newLesson;
    else lessons.push(newLesson);
    lessons.sort(
      (a, b) =>
        a.part - b.part ||
        a.lessonId.localeCompare(b.lessonId, "vi", {
          numeric: true,
          sensitivity: "base",
        }),
    );
    await commitChanges({
      filesToAdd: scriptFile(lessons),
      message: `[Script] ${isUpdate ? "Cập nhật" : "Thêm"} Part ${part} - ${lessonName} (${lessonId}, ${items.length} câu hỏi)`,
    });
    res.json({
      success: true,
      message: `${isUpdate ? "Đã cập nhật" : "Đã thêm"} Part ${part} - ${lessonName}.`,
      part,
      lessonId,
      lessonName,
      itemCount: items.length,
      totalLessons: lessons.length,
    });
  } catch (error) {
    console.error("[Merge Script]", error);
    jsonError(res, 500, error.message);
  }
});

app.get("/api/lessons", async (_req, res) => {
  try {
    const [{ lessons }, mediaLessons] = await Promise.all([
      readScriptFromGitHub(),
      listMediaLessonIndex(),
    ]);
    const records = new Map();
    for (const lesson of lessons) {
      const id = `${lesson.part}:${lesson.lessonId}`;
      records.set(id, {
        part: lesson.part,
        lessonId: lesson.lessonId,
        lessonName: lesson.lessonName || lesson.lessonId,
        title:
          lesson.title ||
          `TOEIC Part ${lesson.part} - ${lesson.lessonName || lesson.lessonId}`,
        is_display: lesson.is_display ?? true,
        itemCount: Array.isArray(lesson.items) ? lesson.items.length : 0,
        hasScript: true,
        hasAudio: false,
        hasImage: false,
      });
    }
    for (const media of mediaLessons) {
      const id = `${media.part}:${media.lessonId}`;
      records.set(id, {
        lessonName: media.lessonId,
        title: `TOEIC Part ${media.part} - ${media.lessonId}`,
        is_display: true,
        itemCount: 0,
        hasScript: false,
        ...records.get(id),
        ...media,
      });
    }
    const list = [...records.values()].sort(
      (a, b) =>
        a.part - b.part ||
        a.lessonId.localeCompare(b.lessonId, "vi", {
          numeric: true,
          sensitivity: "base",
        }),
    );
    res.json({ success: true, lessons: list });
  } catch (error) {
    console.error("[Lessons]", error);
    jsonError(
      res,
      500,
      /R2|Cloudflare/i.test(error.message)
        ? vietnameseR2Error(error)
        : error.message,
    );
  }
});

app.get("/api/lessons/:lessonId/script", async (req, res) => {
  try {
    const { part, lessonId } = lessonIdentity(req, req.query);
    const { lessons } = await readScriptFromGitHub();
    const lesson = lessons.find(
      (item) => item.part === part && item.lessonId === lessonId,
    );
    if (!lesson)
      return jsonError(
        res,
        404,
        `Không tìm thấy nội dung Part ${part} - buổi ${lessonId}.`,
      );
    res.json({ success: true, lesson });
  } catch (error) {
    jsonError(res, 500, error.message);
  }
});

app.patch("/api/lessons/:lessonId/name", async (req, res) => {
  try {
    const { part, lessonId, lessonName } = lessonIdentity(req);
    const { lessons } = await readScriptFromGitHub();
    const existsInGit = lessons.some(
      (lesson) => lesson.part === part && lesson.lessonId === lessonId,
    );
    let mediaExists = false;
    if (!existsInGit) {
      const mediaLessons = await listMediaLessonIndex();
      mediaExists = mediaLessons.some(
        (lesson) => lesson.part === part && lesson.lessonId === lessonId,
      );
    }
    const renamed = renameLessonRecord({
      lessons,
      part,
      lessonId,
      lessonName,
      mediaExists,
    });
    await commitChanges({
      filesToAdd: scriptFile(renamed.lessons),
      message: `[Lessons] Đổi tên Part ${part} - ${lessonId} → ${renamed.lesson.lessonName}`,
    });
    res.json({
      success: true,
      message: `Đã đổi tên buổi học thành ${renamed.lesson.lessonName}.`,
      part,
      lessonId,
      lessonName: renamed.lesson.lessonName,
      created: renamed.created,
    });
  } catch (error) {
    console.error("[Rename Lesson]", error);
    jsonError(res, error.status || 500, error.message);
  }
});

app.patch("/api/lessons/:lessonId/display", async (req, res) => {
  try {
    const { part, lessonId } = lessonIdentity(req);
    if (typeof req.body.is_display !== "boolean")
      return jsonError(res, 400, "is_display phải là boolean.");
    const { lessons } = await readScriptFromGitHub();
    const index = lessons.findIndex(
      (lesson) => lesson.part === part && lesson.lessonId === lessonId,
    );
    if (index < 0)
      return jsonError(
        res,
        404,
        `Không tìm thấy Part ${part} - buổi ${lessonId}.`,
      );
    lessons[index].is_display = req.body.is_display;
    await commitChanges({
      filesToAdd: scriptFile(lessons),
      message: `[Lessons] Part ${part} - buổi ${lessonId} → ${req.body.is_display ? "hiển thị" : "ẩn"}`,
    });
    res.json({
      success: true,
      message: "Đã cập nhật trạng thái hiển thị.",
      part,
      lessonId,
      is_display: req.body.is_display,
    });
  } catch (error) {
    jsonError(res, 500, error.message);
  }
});

app.get("/api/lessons/:lessonId/files", async (req, res) => {
  try {
    const { part, lessonId } = lessonIdentity(req, req.query);
    const files = await listLessonMedia(part, lessonId);
    res.json({ success: true, part, lessonId, ...files });
  } catch (error) {
    jsonError(res, 500, vietnameseR2Error(error));
  }
});

app.delete("/api/lessons/:lessonId/files", async (req, res) => {
  try {
    const { part, lessonId } = lessonIdentity(req);
    const keys = req.body?.keys || req.body?.paths;
    if (!Array.isArray(keys) || !keys.length)
      return jsonError(res, 400, "Danh sách file cần xóa không hợp lệ.");
    const prefixes = lessonPrefixes(part, lessonId);
    const allowed = (key) =>
      (key.startsWith(prefixes.audio) || key.startsWith(prefixes.image)) &&
      isAllowedMediaKey(key);
    const rejected = keys.filter((key) => !allowed(String(key)));
    if (rejected.length)
      return jsonError(
        res,
        403,
        "Có file nằm ngoài Part hoặc buổi học đã chọn.",
        { invalidFiles: rejected },
      );
    const count = await deleteObjects(keys.map(String));
    res.json({
      success: true,
      message: `Đã xóa ${count} file khỏi Server.`,
      deleted: count,
    });
  } catch (error) {
    jsonError(res, 500, vietnameseR2Error(error));
  }
});

app.delete("/api/lessons/:lessonId", async (req, res) => {
  try {
    const { part, lessonId } = lessonIdentity(req);
    const requested = String(req.query.types || "script,audio,image")
      .split(",")
      .filter((type) => ["script", "audio", "image"].includes(type));
    if (!requested.length)
      return jsonError(res, 400, "Loại dữ liệu cần xóa không hợp lệ.");
    let scriptDeleted = false;
    if (requested.includes("script")) {
      const { lessons } = await readScriptFromGitHub();
      const remaining = lessons.filter(
        (lesson) => !(lesson.part === part && lesson.lessonId === lessonId),
      );
      if (remaining.length !== lessons.length) {
        await commitChanges({
          filesToAdd: scriptFile(remaining),
          message: `[Delete] Xóa script Part ${part} - buổi ${lessonId}`,
        });
        scriptDeleted = true;
      }
    }
    try {
      const mediaTypes = requested.filter((type) => type !== "script");
      const mediaDeleted = mediaTypes.length
        ? await deleteLessonMedia(part, lessonId, mediaTypes)
        : 0;
      res.json({
        success: true,
        message: `Đã xóa dữ liệu Part ${part} - buổi ${lessonId}.`,
        scriptDeleted,
        mediaDeleted,
      });
    } catch (error) {
      jsonError(
        res,
        502,
        "Nội dung JSON đã cập nhật nhưng chưa xóa hết file trên Server. Vui lòng thử xóa lại.",
        { partial: scriptDeleted, detail: vietnameseR2Error(error) },
      );
    }
  } catch (error) {
    jsonError(res, 500, error.message);
  }
});

app.get("/api/files/raw", (_req, res) =>
  jsonError(res, 410, "Media hiện được đọc qua URL tạm thời của Server."),
);

app.get("/api/health", (_req, res) => {
  const r2Config = r2ConfigurationStatus();
  res.json({
    status:
      r2Config.readWrite && r2Config.adminDelete
        ? "ok"
        : "configuration-required",
    storage: "cloudflare-r2",
    r2: r2Config,
    message:
      r2Config.readWrite && r2Config.adminDelete
        ? "Server đã được cấu hình đầy đủ."
        : "Thiếu biến môi trường Server. Vui lòng kiểm tra file .env khi chạy local hoặc cấu hình Environment Variables trên Vercel.",
    time: new Date().toISOString(),
  });
});

app.use((error, _req, res, _next) => {
  console.error("[API Error]", error);
  jsonError(res, 500, "Máy chủ gặp lỗi. Vui lòng thử lại.");
});

if (!process.env.VERCEL) {
  app.listen(PORT, () =>
    console.log(`[Server] API chạy tại http://localhost:${PORT}`),
  );
}

export default app;
