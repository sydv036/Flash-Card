import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MAX_MEDIA_SIZE = 2 * 1024 * 1024;
export const MAX_FILES_PER_INTENT = 10;

const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/ogg",
]);
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "ogg"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

let readWriteClient;
let adminClient;

function config(role = "read-write") {
  const accountId = process.env.R2_ACCOUNT_ID;
  const isAdmin = role === "admin";
  const accessKeyId = isAdmin
    ? process.env.R2_ADMIN_ACCESS_KEY_ID
    : process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = isAdmin
    ? process.env.R2_ADMIN_SECRET_ACCESS_KEY
    : process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME || "flashcard";
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      isAdmin
        ? "Token admin dùng để xóa file Server chưa được cấu hình đầy đủ trong môi trường đang chạy."
        : "Token đọc và ghi Server chưa được cấu hình đầy đủ trong môi trường đang chạy.",
    );
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function r2(role = "read-write") {
  const isAdmin = role === "admin";
  if (isAdmin ? !adminClient : !readWriteClient) {
    const { accountId, accessKeyId, secretAccessKey } = config(role);
    const newClient = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    if (isAdmin) adminClient = newClient;
    else readWriteClient = newClient;
  }
  return isAdmin ? adminClient : readWriteClient;
}

export function r2ConfigurationStatus() {
  return {
    readWrite: Boolean(
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY,
    ),
    adminDelete: Boolean(
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ADMIN_ACCESS_KEY_ID &&
      process.env.R2_ADMIN_SECRET_ACCESS_KEY,
    ),
    bucket: process.env.R2_BUCKET_NAME || "flashcard",
  };
}

export function parsePart(value) {
  const part = Number(value ?? 1);
  if (!Number.isInteger(part) || part < 1 || part > 4)
    throw new Error("Part phải là số từ 1 đến 4.");
  return part;
}

function shortHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function slugifyLessonName(value) {
  const original = String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");
  if (!original) throw new Error("Vui lòng nhập tên buổi học.");
  let slug = original
    .replace(/[đĐ]/g, (character) => (character === "đ" ? "d" : "D"))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) slug = `buoi-${shortHash(original)}`;
  if (slug.length > 80)
    slug = `${slug.slice(0, 70).replace(/-+$/g, "")}-${shortHash(original)}`;
  return slug;
}

export function parseLessonId(value) {
  return slugifyLessonName(value);
}

export function safeFilename(value) {
  const original = String(value || "")
    .normalize("NFC")
    .trim();
  const basename = original.split(/[\\/]/).pop();
  if (!basename || basename === "." || basename === "..")
    throw new Error("Tên file không hợp lệ.");
  const safe = basename
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\p{L}\p{N}._() -]/gu, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 180);
  if (!safe || safe.startsWith("."))
    throw new Error(`Tên file không hợp lệ: ${basename}`);
  return safe;
}

export function buildMediaKey({ kind, part, lessonId, filename }) {
  const folder =
    kind === "audio" ? "audio" : kind === "image" ? "images" : null;
  if (!folder) throw new Error("Loại file phải là audio hoặc image.");
  return `${folder}/part-${parsePart(part)}/lesson-${parseLessonId(lessonId)}/${safeFilename(filename)}`;
}

export function isAllowedMediaKey(key) {
  return /^(audio|images)\/part-[1-4]\/lesson-[a-z0-9]+(?:-[a-z0-9]+)*\/[^/]+$/u.test(
    String(key || ""),
  );
}

export function lessonPrefixes(part, lessonId) {
  const p = parsePart(part);
  const lesson = parseLessonId(lessonId);
  return {
    audio: `audio/part-${p}/lesson-${lesson}/`,
    image: `images/part-${p}/lesson-${lesson}/`,
  };
}

export function validateUploadFile(file) {
  const filename = String(
    file?.filename || file?.fileName || file?.name || "",
  ).trim();
  const size = Number(file?.size);
  const kind = file?.kind;
  const contentType = String(
    file?.contentType || file?.type || "",
  ).toLowerCase();
  const extension = filename.includes(".")
    ? filename.split(".").pop().toLowerCase()
    : "";
  if (!filename) throw new Error("Có file chưa có tên.");
  if (!Number.isInteger(size) || size < 1)
    throw new Error(`Dung lượng file ${filename} không hợp lệ.`);
  if (size >= MAX_MEDIA_SIZE)
    throw new Error(`File ${filename} phải nhỏ hơn 2 MB.`);
  if (
    kind === "audio" &&
    (!AUDIO_TYPES.has(contentType) || !AUDIO_EXTENSIONS.has(extension))
  ) {
    throw new Error(
      `File ${filename} không phải định dạng âm thanh được hỗ trợ.`,
    );
  }
  if (
    kind === "image" &&
    (!IMAGE_TYPES.has(contentType) || !IMAGE_EXTENSIONS.has(extension))
  ) {
    throw new Error(`File ${filename} không phải định dạng ảnh được hỗ trợ.`);
  }
  if (kind !== "audio" && kind !== "image")
    throw new Error(`Không xác định được loại của file ${filename}.`);
  return { filename, size, kind, contentType };
}

export async function createUploadUrl({ key, contentType }) {
  if (!isAllowedMediaKey(key))
    throw new Error("Đường dẫn file R2 không hợp lệ.");
  const { bucket } = config();
  const expiresIn = Math.min(
    Math.max(Number(process.env.R2_UPLOAD_URL_TTL_SECONDS) || 300, 60),
    900,
  );
  return getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn },
  );
}

export async function createReadUrl(key) {
  if (!isAllowedMediaKey(key))
    throw new Error("Đường dẫn file R2 không hợp lệ.");
  const { bucket } = config();
  const expiresIn = Math.min(
    Math.max(Number(process.env.R2_READ_URL_TTL_SECONDS) || 3600, 60),
    86400,
  );
  return {
    url: await getSignedUrl(
      r2(),
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn },
    ),
    expiresIn,
  };
}

export async function verifyObject(key) {
  if (!isAllowedMediaKey(key))
    throw new Error("Đường dẫn file R2 không hợp lệ.");
  const { bucket } = config();
  const result = await r2().send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  );
  return {
    size: Number(result.ContentLength || 0),
    contentType: result.ContentType || "",
  };
}

export async function deleteObject(key) {
  if (!isAllowedMediaKey(key))
    throw new Error("Đường dẫn file R2 không hợp lệ.");
  const { bucket } = config();
  await r2("admin").send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function listLessonMedia(part, lessonId) {
  const { bucket } = config();
  const prefixes = lessonPrefixes(part, lessonId);
  const output = { audios: [], images: [] };
  for (const [kind, prefix] of [
    ["audios", prefixes.audio],
    ["images", prefixes.image],
  ]) {
    let continuationToken;
    do {
      const page = await r2().send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const item of page.Contents || []) {
        if (!item.Key || !isAllowedMediaKey(item.Key)) continue;
        output[kind].push({
          name: item.Key.slice(prefix.length),
          path: item.Key,
          key: item.Key,
          size: Number(item.Size || 0),
          lastModified: item.LastModified?.toISOString() || null,
        });
      }
      continuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
    } while (continuationToken);
  }
  const naturalSort = (a, b) =>
    a.name.localeCompare(b.name, "vi", { numeric: true, sensitivity: "base" });
  output.audios.sort(naturalSort);
  output.images.sort(naturalSort);
  return output;
}

export async function listMediaLessonIndex() {
  const { bucket } = config();
  const index = new Map();
  for (const root of ["audio/", "images/"]) {
    let continuationToken;
    do {
      const page = await r2().send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: root,
          ContinuationToken: continuationToken,
        }),
      );
      for (const item of page.Contents || []) {
        const match = item.Key?.match(
          /^(audio|images)\/part-([1-4])\/lesson-([a-z0-9]+(?:-[a-z0-9]+)*)\/[^/]+$/u,
        );
        if (!match) continue;
        const part = Number(match[2]);
        const lessonId = match[3];
        const id = `${part}:${lessonId}`;
        const current = index.get(id) || {
          part,
          lessonId,
          hasAudio: false,
          hasImage: false,
        };
        if (match[1] === "audio") current.hasAudio = true;
        if (match[1] === "images") current.hasImage = true;
        index.set(id, current);
      }
      continuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
    } while (continuationToken);
  }
  return [...index.values()];
}

export async function listAllAudioFiles() {
  const { bucket } = config();
  const files = [];
  let continuationToken;
  do {
    const page = await r2().send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "audio/",
        ContinuationToken: continuationToken,
      }),
    );
    for (const item of page.Contents || []) {
      const match = item.Key?.match(
        /^audio\/part-([1-4])\/lesson-([a-z0-9]+(?:-[a-z0-9]+)*)\/([^/]+)$/u,
      );
      if (!match) continue;
      files.push({
        key: item.Key,
        path: item.Key,
        name: match[3],
        part: Number(match[1]),
        lessonId: match[2],
        size: Number(item.Size || 0),
        lastModified: item.LastModified?.toISOString() || null,
      });
    }
    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);
  return files.sort(
    (a, b) =>
      a.part - b.part ||
      a.lessonId.localeCompare(b.lessonId, "vi", {
        numeric: true,
        sensitivity: "base",
      }) ||
      a.name.localeCompare(b.name, "vi", {
        numeric: true,
        sensitivity: "base",
      }),
  );
}

export async function deleteObjects(keys) {
  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.some((key) => !isAllowedMediaKey(key)))
    throw new Error("Danh sách chứa đường dẫn file R2 không hợp lệ.");
  const { bucket } = config();
  const errors = [];
  for (let index = 0; index < uniqueKeys.length; index += 1000) {
    const chunk = uniqueKeys.slice(index, index + 1000);
    if (!chunk.length) continue;
    const result = await r2("admin").send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: false },
      }),
    );
    errors.push(...(result.Errors || []));
  }
  if (errors.length)
    throw new Error(`Không thể xóa ${errors.length} file trên Server.`);
  return uniqueKeys.length;
}

export async function deleteLessonMedia(
  part,
  lessonId,
  types = ["audio", "image"],
) {
  const listed = await listLessonMedia(part, lessonId);
  const keys = [
    ...(types.includes("audio") ? listed.audios.map((file) => file.key) : []),
    ...(types.includes("image") ? listed.images.map((file) => file.key) : []),
  ];
  return deleteObjects(keys);
}

export function vietnameseR2Error(error) {
  const status = error?.$metadata?.httpStatusCode;
  const code = error?.name || error?.Code || "";
  if (
    status === 401 ||
    status === 403 ||
    /AccessDenied|InvalidAccessKey|Signature/i.test(code)
  ) {
    return "Server từ chối quyền truy cập. Vui lòng kiểm tra API token.";
  }
  if (status === 429 || /SlowDown|TooManyRequests/i.test(code)) {
    return "Server đang giới hạn yêu cầu. Vui lòng thử lại sau.";
  }
  if (
    status === 507 ||
    /InsufficientStorage|Quota|Billing/i.test(`${code} ${error?.message || ""}`)
  ) {
    return "Không thể lưu file vì dung lượng hoặc hạn mức Server đã hết. Vui lòng kiểm tra gói dịch vụ.";
  }
  if (status === 404 || /NoSuchKey|NotFound/i.test(code))
    return "Không tìm thấy file trên Server.";
  if (status >= 500) return "Server đang gặp sự cố. Vui lòng thử lại sau.";
  // Giữ thông báo validation do ứng dụng tạo (đều là tiếng Việt), nhưng không
  // để lộ thông báo kỹ thuật/tiếng Anh của S3 SDK ra toast.
  if (/[À-ỹ]/u.test(error?.message || "")) return error.message;
  return "Không thể kết nối Server. Vui lòng thử lại.";
}
