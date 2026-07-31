export type SwipeNavigation = 'next' | 'previous' | null;
export type ShuffleResult = 'shuffled' | 'insufficient';
export type PlaybackToken = Readonly<{ run: number; playback: number }>;

export function getSwipeNavigation(start: number | null, end: number | null, minimumDistance = 50): SwipeNavigation {
  if (start === null || end === null) return null;
  const distance = start - end;
  if (distance > minimumDistance) return 'next';
  if (distance < -minimumDistance) return 'previous';
  return null;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

export function shuffleKeys(keys: string[], random = Math.random): { result: ShuffleResult; keys: string[] } {
  if (keys.length <= 1) return { result: 'insufficient', keys: [...keys] };
  const shuffled = [...keys];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return { result: 'shuffled', keys: shuffled };
}

export function createPlaybackSessionGuard() {
  let run = 0;
  let playback = 0;
  let active = false;

  return {
    start(): PlaybackToken {
      active = true;
      run += 1;
      playback += 1;
      return { run, playback };
    },
    beginPlayback(): PlaybackToken {
      playback += 1;
      return { run, playback };
    },
    stop(): void {
      active = false;
      run += 1;
      playback += 1;
    },
    isActive(token: PlaybackToken): boolean {
      return active && token.run === run && token.playback === playback;
    },
  };
}
