import assert from 'node:assert/strict';
import test from 'node:test';
import { audioEndedAction, takeNextShuffledItem } from '../src/components/audio/audioPlaybackMode.ts';

test('chế độ mặc định dừng khi audio kết thúc', () => {
  assert.equal(audioEndedAction('SEQUENTIAL'), 'STOP');
});

test('chỉ lặp hoặc đảo mới tiếp tục phát tự động', () => {
  assert.equal(audioEndedAction('LOOP'), 'REPLAY');
  assert.equal(audioEndedAction('SHUFFLE'), 'ADVANCE');
});

test('phát trộn đi hết các audio còn lại trước khi tạo vòng mới', () => {
  const items = ['a', 'b', 'c', 'd'];
  let current = 'a';
  let queue = [];
  const played = [];
  for (let count = 0; count < 3; count++) {
    const next = takeNextShuffledItem({ items, current, queue, random: () => 0 });
    assert.notEqual(next.item, null);
    current = next.item;
    queue = next.queue;
    played.push(current);
  }
  assert.equal(new Set(played).size, 3);
  assert.deepEqual(new Set(played), new Set(['b', 'c', 'd']));
});

test('phát trộn không lặp ngay audio hiện tại và dừng nếu chỉ có một audio', () => {
  assert.equal(takeNextShuffledItem({ items: ['a', 'b'], current: 'a', queue: [], random: () => 0 }).item, 'b');
  assert.deepEqual(takeNextShuffledItem({ items: ['a'], current: 'a', queue: [] }), { item: null, queue: [] });
});
