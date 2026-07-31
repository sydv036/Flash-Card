import test from 'node:test';
import assert from 'node:assert/strict';
import { renameLessonRecord } from './lesson-registry.js';

test('đổi lessonName nhưng giữ nguyên lessonId và nội dung script', () => {
  const source = [{ part: 1, lessonId: '9', lessonName: 'Buổi 9', title: 'Cũ', is_display: false, items: [{ id: 1 }] }];
  const result = renameLessonRecord({ lessons: source, part: 1, lessonId: '9', lessonName: '  Văn phòng 09  ' });
  assert.equal(result.created, false);
  assert.equal(result.lesson.lessonId, '9');
  assert.equal(result.lesson.lessonName, 'Văn phòng 09');
  assert.equal(result.lesson.title, 'TOEIC Part 1 - Văn phòng 09');
  assert.deepEqual(result.lesson.items, [{ id: 1 }]);
  assert.equal(result.lesson.is_display, false);
});

test('media-only lesson được đăng ký tên mà không đổi slug', () => {
  const result = renameLessonRecord({ lessons: [], part: 3, lessonId: 'media-cu', lessonName: 'Tên dễ nhớ', mediaExists: true });
  assert.equal(result.created, true);
  assert.deepEqual(result.lesson, {
    part: 3,
    lessonId: 'media-cu',
    lessonName: 'Tên dễ nhớ',
    title: 'TOEIC Part 3 - Tên dễ nhớ',
    is_display: true,
    items: [],
  });
});

test('không cho hai lesson cùng Part dùng trùng tên hiển thị', () => {
  const lessons = [
    { part: 2, lessonId: 'a', lessonName: 'Sân bay' },
    { part: 2, lessonId: 'b', lessonName: 'Khách sạn' },
  ];
  assert.throws(
    () => renameLessonRecord({ lessons, part: 2, lessonId: 'b', lessonName: ' sân BAY ' }),
    error => error.status === 409,
  );
});

test('không tạo registry cho lesson không tồn tại trong Git hoặc R2', () => {
  assert.throws(
    () => renameLessonRecord({ lessons: [], part: 4, lessonId: 'khong-ton-tai', lessonName: 'Tên mới' }),
    error => error.status === 404,
  );
});
