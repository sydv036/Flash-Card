import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_MEDIA_SIZE,
  buildMediaKey,
  deleteObject,
  isAllowedMediaKey,
  parsePart,
  r2ConfigurationStatus,
  slugifyLessonName,
  validateUploadFile,
} from "./r2-storage.js";

test("chỉ chấp nhận TOEIC Part 1 đến 4", () => {
  assert.equal(parsePart(1), 1);
  assert.equal(parsePart("4"), 4);
  assert.throws(() => parsePart(0), /1 đến 4/);
  assert.throws(() => parsePart(5), /1 đến 4/);
});

test("tạo key R2 theo part và buổi học", () => {
  const key = buildMediaKey({
    kind: "audio",
    part: 3,
    lessonId: 12,
    filename: "Track 01.mp3",
  });
  assert.equal(key, "audio/part-3/lesson-12/Track-01.mp3");
  assert.equal(isAllowedMediaKey(key), true);
  assert.equal(isAllowedMediaKey("../audio.mp3"), false);
});

test("tạo slug ổn định từ tên buổi học tự do", () => {
  assert.equal(
    slugifyLessonName("  Luyện nghe Văn Phòng 01  "),
    "luyen-nghe-van-phong-01",
  );
  assert.equal(
    slugifyLessonName("Đề số 2: Sân bay & Khách sạn"),
    "de-so-2-san-bay-khach-san",
  );
  assert.match(slugifyLessonName("日本語"), /^buoi-[a-z0-9]+$/);
  assert.throws(() => slugifyLessonName("   "), /nhập tên buổi học/);
});

test("lưu media bằng slug tên buổi và vẫn hỗ trợ buổi số cũ", () => {
  assert.equal(
    buildMediaKey({
      kind: "image",
      part: 4,
      lessonId: "Luyện nghe Văn Phòng 01",
      filename: "Câu 1.png",
    }),
    "images/part-4/lesson-luyen-nghe-van-phong-01/Câu-1.png",
  );
  assert.equal(isAllowedMediaKey("audio/part-1/lesson-12/1.mp3"), true);
});

test("từ chối chính xác file có dung lượng bằng hoặc lớn hơn 2 MiB", () => {
  const base = {
    kind: "audio",
    filename: "part-2.mp3",
    contentType: "audio/mpeg",
  };
  assert.throws(
    () => validateUploadFile({ ...base, size: MAX_MEDIA_SIZE }),
    /part-2\.mp3.*nhỏ hơn 2 MB/,
  );
  assert.throws(
    () => validateUploadFile({ ...base, size: MAX_MEDIA_SIZE + 1 }),
    /part-2\.mp3.*nhỏ hơn 2 MB/,
  );
});

test("chấp nhận ảnh và audio nhỏ hơn 2 MiB", () => {
  assert.equal(
    validateUploadFile({
      kind: "audio",
      filename: "a.mp3",
      contentType: "audio/mpeg",
      size: MAX_MEDIA_SIZE - 1,
    }).filename,
    "a.mp3",
  );
  assert.equal(
    validateUploadFile({
      kind: "image",
      filename: "a.webp",
      contentType: "image/webp",
      size: MAX_MEDIA_SIZE - 1,
    }).filename,
    "a.webp",
  );
});

test("báo riêng trạng thái token read/write và token admin xóa", async () => {
  const keys = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_ADMIN_ACCESS_KEY_ID",
    "R2_ADMIN_SECRET_ACCESS_KEY",
  ];
  const original = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  process.env.R2_ACCOUNT_ID = "account";
  process.env.R2_ACCESS_KEY_ID = "read";
  process.env.R2_SECRET_ACCESS_KEY = "read-secret";
  delete process.env.R2_ADMIN_ACCESS_KEY_ID;
  delete process.env.R2_ADMIN_SECRET_ACCESS_KEY;
  assert.deepEqual(r2ConfigurationStatus(), {
    readWrite: true,
    adminDelete: false,
    bucket: process.env.R2_BUCKET_NAME || "flashcard",
  });
  await assert.rejects(
    deleteObject("audio/part-1/lesson-1/test.mp3"),
    /Token admin dùng để xóa file Server chưa được cấu hình đầy đủ trong môi trường đang chạy/,
  );
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});
