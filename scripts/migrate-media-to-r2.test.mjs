import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_FILE_SIZE_BYTES,
  buildObjectKey,
  extractLessonId,
  mapWithConcurrency,
  parseArguments,
  validateFileSize,
} from './migrate-media-to-r2.mjs';

test('nhận diện mã buổi từ tên thư mục audio và ảnh', () => {
  assert.equal(extractLessonId('Audio Buổi 14'), 14);
  assert.equal(extractLessonId('Audio buổi 8'), 8);
  assert.equal(extractLessonId('B17'), 17);
  assert.equal(extractLessonId('script'), null);
});

test('tạo object key Part 1 theo đúng quy ước', () => {
  assert.equal(buildObjectKey('audio', 2, 'a1.mp3'), 'audio/part-1/lesson-2/a1.mp3');
  assert.equal(buildObjectKey('images', 9, '1.png'), 'images/part-1/lesson-9/1.png');
  assert.throws(() => buildObjectKey('audio', 0, '1.mp3'), /không hợp lệ/);
});

test('từ chối file có dung lượng từ 2 MiB', () => {
  assert.equal(validateFileSize(MAX_FILE_SIZE_BYTES - 1), null);
  assert.match(validateFileSize(MAX_FILE_SIZE_BYTES), /nhỏ hơn 2 MiB/);
  assert.match(validateFileSize(MAX_FILE_SIZE_BYTES + 1), /nhỏ hơn 2 MiB/);
});

test('không cho migration vượt quá concurrency 4', () => {
  assert.equal(parseArguments(['--concurrency', '4']).concurrency, 4);
  assert.throws(() => parseArguments(['--concurrency', '5']), /từ 1 đến 4/);
});

test('mapWithConcurrency giữ thứ tự kết quả và giới hạn tác vụ đồng thời', async () => {
  let active = 0;
  let maximumActive = 0;
  const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 3, async (value) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return value * 2;
  });
  assert.deepEqual(results, [2, 4, 6, 8, 10, 12]);
  assert.equal(maximumActive, 3);
});

