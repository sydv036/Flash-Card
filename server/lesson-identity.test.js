import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLessonIdentity } from './lesson-identity.js';

test('ưu tiên lessonId ổn định thay vì tạo lại từ lessonName', () => {
  assert.deepEqual(resolveLessonIdentity({
    source: { part: 1, lessonId: 9, lessonName: 'Buổi 9' },
  }), {
    part: 1,
    lessonId: '9',
    lessonName: 'Buổi 9',
  });
});

test('media-only lesson giữ nguyên slug khi bổ sung tên hiển thị', () => {
  assert.deepEqual(resolveLessonIdentity({
    source: { part: 3, lessonId: 'media-cu', lessonName: 'Luyện nghe văn phòng' },
  }), {
    part: 3,
    lessonId: 'media-cu',
    lessonName: 'Luyện nghe văn phòng',
  });
});

test('request cũ chỉ có lessonName vẫn sinh slug', () => {
  assert.deepEqual(resolveLessonIdentity({
    source: { part: '2', lessonName: 'Sân bay 01' },
  }), {
    part: 2,
    lessonId: 'san-bay-01',
    lessonName: 'Sân bay 01',
  });
});

test('tên mới có cùng slug sẽ nhận cùng lessonId', () => {
  const first = resolveLessonIdentity({ source: { part: 2, lessonName: 'Luyện nghe Văn Phòng' } });
  const second = resolveLessonIdentity({ source: { part: 2, lessonName: 'luyen-nghe-van-phong' } });
  assert.equal(first.lessonId, second.lessonId);
});

test('route param và query vẫn được hỗ trợ', () => {
  assert.deepEqual(resolveLessonIdentity({
    params: { lessonId: 'legacy-12' },
    query: { part: '4' },
  }), {
    part: 4,
    lessonId: 'legacy-12',
    lessonName: 'legacy-12',
  });
});
