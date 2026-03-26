import { AudioPlayer } from '@/components/audio/AudioPlayer';

export function AudioPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-6 sm:py-10 flex flex-col items-center gap-6 sm:gap-8 min-h-[calc(100vh-80px)]">
      <div className="w-full flex-1 max-w-2xl flex flex-col mt-4 sm:mt-10">
        <AudioPlayer />
      </div>
    </main>
  );
}
