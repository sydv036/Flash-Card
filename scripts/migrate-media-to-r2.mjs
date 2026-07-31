#!/usr/bin/env node

import "dotenv/config";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
export const DEFAULT_CONCURRENCY = 4;

const MEDIA_CONFIG = {
  audio: {
    extensions: new Set([".aac", ".m4a", ".mp3", ".ogg", ".wav"]),
    root: path.join("src", "utils", "audio"),
  },
  images: {
    extensions: new Set([".gif", ".jpeg", ".jpg", ".png", ".webp"]),
    root: path.join("src", "assets"),
  },
};

const CONTENT_TYPES = {
  ".aac": "audio/aac",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".wav": "audio/wav",
  ".webp": "image/webp",
};

export function extractLessonId(directoryName) {
  const normalized = directoryName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const match = normalized.match(/^(?:audio\s*)?buoi\s*(\d+)$|^b\s*(\d+)$/);
  if (!match) return null;
  const lessonId = Number(match[1] ?? match[2]);
  return Number.isSafeInteger(lessonId) && lessonId > 0 ? lessonId : null;
}

export function buildObjectKey(kind, lessonId, filename) {
  if (!Object.hasOwn(MEDIA_CONFIG, kind))
    throw new Error(`Loại media không hợp lệ: ${kind}`);
  if (!Number.isSafeInteger(lessonId) || lessonId < 1)
    throw new Error("Mã buổi học không hợp lệ.");
  const safeFilename = path.basename(filename).normalize("NFC");
  if (!safeFilename || safeFilename === "." || safeFilename === "..") {
    throw new Error("Tên file không hợp lệ.");
  }
  return `${kind}/part-1/lesson-${lessonId}/${safeFilename}`;
}

export function validateFileSize(size) {
  if (!Number.isSafeInteger(size) || size < 0)
    return "Không đọc được dung lượng file.";
  if (size >= MAX_FILE_SIZE_BYTES) return "File phải nhỏ hơn 2 MiB.";
  return null;
}

export async function mapWithConcurrency(items, concurrency, worker) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new Error("Concurrency phải là số nguyên dương.");
  }
  const results = new Array(items.length);
  let cursor = 0;
  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runWorker),
  );
  return results;
}

async function discoverKind(projectRoot, kind, configuredRoot) {
  const config = MEDIA_CONFIG[kind];
  const root = path.resolve(projectRoot, configuredRoot ?? config.root);
  const directories = await readdir(root, { withFileTypes: true });
  const files = [];
  const invalidDirectories = [];

  for (const directory of directories) {
    if (!directory.isDirectory()) continue;
    const lessonId = extractLessonId(directory.name);
    if (lessonId === null) {
      // `script` và các thư mục asset khác không phải media TOEIC.
      continue;
    }
    const directoryPath = path.join(root, directory.name);
    const entries = await readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const extension = path.extname(entry.name).toLowerCase();
      if (!config.extensions.has(extension)) continue;
      const sourcePath = path.join(directoryPath, entry.name);
      const metadata = await stat(sourcePath);
      files.push({
        kind,
        lessonId,
        filename: entry.name.normalize("NFC"),
        sourcePath,
        size: metadata.size,
        contentType: CONTENT_TYPES[extension] ?? "application/octet-stream",
        key: buildObjectKey(kind, lessonId, entry.name),
      });
    }
  }

  return { files, invalidDirectories };
}

export async function discoverMedia({ projectRoot, audioDir, imagesDir }) {
  const [audio, images] = await Promise.all([
    discoverKind(projectRoot, "audio", audioDir),
    discoverKind(projectRoot, "images", imagesDir),
  ]);
  const files = [...audio.files, ...images.files].sort((left, right) =>
    left.key.localeCompare(right.key, "vi"),
  );
  const duplicateKeys = files
    .filter((file, index) => index > 0 && file.key === files[index - 1].key)
    .map((file) => file.key);
  return { files, duplicateKeys };
}

export function parseArguments(argv) {
  const options = {
    dryRun: false,
    concurrency: DEFAULT_CONCURRENCY,
    projectRoot: process.cwd(),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--project-root") options.projectRoot = argv[++index];
    else if (argument === "--audio-dir") options.audioDir = argv[++index];
    else if (argument === "--images-dir") options.imagesDir = argv[++index];
    else if (argument === "--concurrency")
      options.concurrency = Number(argv[++index]);
    else throw new Error(`Tham số không được hỗ trợ: ${argument}`);
  }
  if (!options.projectRoot)
    throw new Error("Thiếu giá trị cho --project-root.");
  if (
    !Number.isSafeInteger(options.concurrency) ||
    options.concurrency < 1 ||
    options.concurrency > 4
  ) {
    throw new Error("--concurrency phải là số nguyên từ 1 đến 4.");
  }
  options.projectRoot = path.resolve(options.projectRoot);
  return options;
}

function printHelp() {
  console.log(`Migration media TOEIC lên Server

Cách dùng:
  node scripts/migrate-media-to-r2.mjs --dry-run
  node scripts/migrate-media-to-r2.mjs

Tùy chọn:
  --dry-run              Chỉ kiểm tra và in kế hoạch, không kết nối R2
  --project-root <path>  Thư mục gốc dự án (mặc định: thư mục hiện tại)
  --audio-dir <path>     Thư mục audio, tương đối với project root hoặc tuyệt đối
  --images-dir <path>    Thư mục ảnh, tương đối với project root hoặc tuyệt đối
  --concurrency <1..4>   Số upload song song (mặc định: 4)
`);
}

function requireR2Environment() {
  const required = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length)
    throw new Error(`Thiếu biến môi trường: ${missing.join(", ")}`);
  return {
    accountId: process.env.R2_ACCOUNT_ID.trim(),
    accessKeyId: process.env.R2_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
    bucket: process.env.R2_BUCKET_NAME?.trim() || "flashcard",
  };
}

function describeR2Error(error) {
  const status = error?.$metadata?.httpStatusCode;
  const code = error?.name ?? error?.Code;
  if (status === 401 || status === 403)
    return "R2 từ chối quyền truy cập. Hãy kiểm tra API token và phạm vi bucket.";
  if (status === 429 || code === "SlowDown")
    return "R2 đang giới hạn tần suất. Hãy chờ rồi chạy lại migration.";
  if (status === 402 || code === "PaymentRequired")
    return "Tài khoản Cloudflare không thể ghi thêm dữ liệu. Hãy kiểm tra billing và trạng thái R2.";
  if (status >= 500)
    return "Dịch vụ R2 đang tạm thời gặp sự cố. Có thể chạy lại an toàn sau.";
  return error?.message || "Không xác định được lỗi Server.";
}

async function migrate(options) {
  const discovered = await discoverMedia(options);
  if (discovered.duplicateKeys.length) {
    throw new Error(
      `Có object key bị trùng:\n${discovered.duplicateKeys.join("\n")}`,
    );
  }

  const rejected = discovered.files.filter((file) =>
    validateFileSize(file.size),
  );
  const accepted = discovered.files.filter(
    (file) => !validateFileSize(file.size),
  );
  console.log(
    `Đã tìm thấy ${discovered.files.length} file: ${accepted.length} hợp lệ, ${rejected.length} không hợp lệ.`,
  );
  if (rejected.length) {
    console.error("Các file bị từ chối (phải nhỏ hơn 2 MiB):");
    for (const file of rejected)
      console.error(`- ${file.sourcePath} (${file.size} byte)`);
    throw new Error("Migration dừng để tránh bỏ sót media không hợp lệ.");
  }

  if (options.dryRun) {
    const audioCount = accepted.filter((file) => file.kind === "audio").length;
    const imageCount = accepted.length - audioCount;
    console.log(
      `Dry-run hợp lệ: sẽ upload ${audioCount} audio và ${imageCount} ảnh vào bucket flashcard.`,
    );
    console.log("Không có dữ liệu nào được thay đổi.");
    return { uploaded: 0, skipped: 0, total: accepted.length };
  }

  const environment = requireR2Environment();
  const { HeadObjectCommand, PutObjectCommand, S3Client } =
    await import("@aws-sdk/client-s3");
  const client = new S3Client({
    endpoint: `https://${environment.accountId}.r2.cloudflarestorage.com`,
    region: "auto",
    credentials: {
      accessKeyId: environment.accessKeyId,
      secretAccessKey: environment.secretAccessKey,
    },
  });
  let completed = 0;
  const results = await mapWithConcurrency(
    accepted,
    options.concurrency,
    async (file) => {
      let existsWithSameSize = false;
      try {
        const head = await client.send(
          new HeadObjectCommand({ Bucket: environment.bucket, Key: file.key }),
        );
        existsWithSameSize = Number(head.ContentLength) === file.size;
      } catch (error) {
        if (
          error?.$metadata?.httpStatusCode !== 404 &&
          error?.name !== "NotFound" &&
          error?.name !== "NoSuchKey"
        ) {
          throw new Error(`${file.filename}: ${describeR2Error(error)}`, {
            cause: error,
          });
        }
      }

      if (!existsWithSameSize) {
        try {
          await client.send(
            new PutObjectCommand({
              Bucket: environment.bucket,
              Key: file.key,
              Body: createReadStream(file.sourcePath),
              ContentLength: file.size,
              ContentType: file.contentType,
            }),
          );
        } catch (error) {
          throw new Error(`${file.filename}: ${describeR2Error(error)}`, {
            cause: error,
          });
        }
      }
      completed += 1;
      console.log(
        `[${completed}/${accepted.length}] ${existsWithSameSize ? "Đã có, bỏ qua" : "Đã upload"}: ${file.key}`,
      );
      return existsWithSameSize ? "skipped" : "uploaded";
    },
  );
  const uploaded = results.filter((result) => result === "uploaded").length;
  const skipped = results.length - uploaded;
  console.log(
    `Hoàn tất: upload ${uploaded} file, bỏ qua ${skipped} file đã tồn tại đúng dung lượng.`,
  );
  return { uploaded, skipped, total: accepted.length };
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) return printHelp();
    await migrate(options);
  } catch (error) {
    console.error(`Lỗi migration: ${error.message}`);
    process.exitCode = 1;
  }
}

const isDirectRun =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) await main();
