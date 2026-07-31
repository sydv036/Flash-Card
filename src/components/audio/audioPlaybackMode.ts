export type PlayMode = 'SEQUENTIAL' | 'SHUFFLE' | 'LOOP';
export type AudioEndedAction = 'STOP' | 'ADVANCE' | 'REPLAY';

export const audioEndedAction = (mode: PlayMode): AudioEndedAction => {
  if (mode === 'LOOP') return 'REPLAY';
  if (mode === 'SHUFFLE') return 'ADVANCE';
  return 'STOP';
};

export const buildShuffleQueue = <T>(items: T[], current: T | null, random = Math.random): T[] => {
  const queue = items.filter(item => item !== current);
  for (let index = queue.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [queue[index], queue[target]] = [queue[target], queue[index]];
  }
  return queue;
};

export const takeNextShuffledItem = <T>({
  items,
  current,
  queue,
  random = Math.random,
}: {
  items: T[];
  current: T | null;
  queue: T[];
  random?: () => number;
}): { item: T | null; queue: T[] } => {
  const available = new Set(items);
  let nextQueue = queue.filter(item => available.has(item) && item !== current);
  if (!nextQueue.length) nextQueue = buildShuffleQueue(items, current, random);
  if (!nextQueue.length) return { item: null, queue: [] };
  const [item, ...remaining] = nextQueue;
  return { item, queue: remaining };
};
