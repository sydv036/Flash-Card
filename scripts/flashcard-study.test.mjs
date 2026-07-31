import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlaybackSessionGuard, getSwipeNavigation, isEditableTarget, shuffleKeys } from '../src/lib/flashcardStudy.ts';

test('vuốt trái đi tới và vuốt phải quay lại', () => {
  assert.equal(getSwipeNavigation(300, 100), 'next');
  assert.equal(getSwipeNavigation(100, 300), 'previous');
  assert.equal(getSwipeNavigation(100, 70), null);
  assert.equal(getSwipeNavigation(null, 100), null);
});

test('nhận diện vùng nhập liệu để không chạy phím tắt Cards', () => {
  const OriginalElement = globalThis.Element;
  globalThis.Element = class ElementMock {};
  const inputTarget = new globalThis.Element();
  inputTarget.closest = selector => selector.includes('input') ? inputTarget : null;
  const cardTarget = new globalThis.Element();
  cardTarget.closest = () => null;
  assert.equal(isEditableTarget(inputTarget), true);
  assert.equal(isEditableTarget(cardTarget), false);
  globalThis.Element = OriginalElement;
});

test('xáo trộn tạo bản sao đủ phần tử và không sửa dữ liệu nguồn', () => {
  const source = ['a', 'b', 'c', 'd'];
  const result = shuffleKeys(source, () => 0);
  assert.equal(result.result, 'shuffled');
  assert.deepEqual(source, ['a', 'b', 'c', 'd']);
  assert.deepEqual(new Set(result.keys), new Set(source));
  assert.equal(new Set(result.keys).size, source.length);
});

test('xáo trộn báo insufficient với danh sách dưới hai thẻ', () => {
  assert.deepEqual(shuffleKeys([]), { result: 'insufficient', keys: [] });
  assert.deepEqual(shuffleKeys(['a']), { result: 'insufficient', keys: ['a'] });
});

test('callback audio cũ mất hiệu lực sau khi dừng hoặc bắt đầu playback mới', async () => {
  const guard = createPlaybackSessionGuard();
  guard.start();
  const oldPlayback = guard.beginPlayback();
  const delayed = Promise.resolve().then(() => guard.isActive(oldPlayback));
  guard.stop();
  assert.equal(await delayed, false);

  guard.start();
  const first = guard.beginPlayback();
  const second = guard.beginPlayback();
  assert.equal(guard.isActive(first), false);
  assert.equal(guard.isActive(second), true);
});
