import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFlashcard } from '@/context/flashcard-context';
import { getSwipeNavigation, isEditableTarget } from '@/lib/flashcardStudy';
import { fetchPronunciationUrl, isEnglishWord, selectEnglishVoice } from '@/lib/pronunciation';

export function FlashcardCard() {
  const { currentWord, showVietnameseFirst, totalWords, searchTerm, nextWord, prevWord, stopAutoReading } = useFlashcard();
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);
  const swipedRef = useRef(false);
  const isDragging = useRef(false);
  const manualAudioRef = useRef<HTMLAudioElement | null>(null);
  const manualAbortRef = useRef<AbortController | null>(null);

  const cancelManualPlayback = useCallback(() => {
    manualAbortRef.current?.abort();
    manualAbortRef.current = null;
    if (manualAudioRef.current) {
      manualAudioRef.current.onended = null;
      manualAudioRef.current.onerror = null;
      manualAudioRef.current.pause();
      manualAudioRef.current = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsAudioLoading(false);
    setIsSpeaking(false);
  }, []);

  useEffect(() => setIsSpeechSupported('speechSynthesis' in window), []);
  useEffect(() => {
    setIsFlipped(false);
    cancelManualPlayback();
  }, [cancelManualPlayback, currentWord]);
  useEffect(() => () => cancelManualPlayback(), [cancelManualPlayback]);

  const handleFlip = useCallback(() => {
    if (swipedRef.current) {
      swipedRef.current = false;
      return;
    }
    setIsFlipped(previous => !previous);
  }, []);

  const speakText = useCallback((text: string, trackSpeaking: boolean) => {
    if (!isSpeechSupported) {
      toast.error('Trình duyệt không hỗ trợ đọc giọng nói.');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    const voice = selectEnglishVoice(window.speechSynthesis.getVoices());
    if (voice) utterance.voice = voice;
    if (trackSpeaking) {
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => {
        setIsSpeaking(false);
        toast.error('Không thể phát giọng đọc. Vui lòng thử lại.');
      };
    }
    window.speechSynthesis.speak(utterance);
  }, [isSpeechSupported]);

  const handleSpeak = useCallback((event?: React.MouseEvent | KeyboardEvent) => {
    event?.stopPropagation();
    if (!currentWord?.exampleEnglish) return;
    stopAutoReading();
    if (isSpeaking) {
      cancelManualPlayback();
      return;
    }
    cancelManualPlayback();
    speakText(currentWord.exampleEnglish, true);
  }, [cancelManualPlayback, currentWord, isSpeaking, speakText, stopAutoReading]);

  const handleAudioClick = useCallback(async (event?: React.MouseEvent | KeyboardEvent) => {
    event?.stopPropagation();
    if (!currentWord?.english) return;
    stopAutoReading();
    cancelManualPlayback();
    if (!isEnglishWord(currentWord.english)) {
      toast.warning(`Không tìm thấy phát âm cho "${currentWord.english}".`);
      return;
    }

    const controller = new AbortController();
    manualAbortRef.current = controller;
    setIsAudioLoading(true);
    const fallbackToSpeech = () => {
      if (manualAbortRef.current !== controller || controller.signal.aborted) return;
      speakText(currentWord.english, false);
    };

    try {
      const audioUrl = await fetchPronunciationUrl(currentWord.english, controller.signal);
      if (manualAbortRef.current !== controller || controller.signal.aborted) return;
      if (!audioUrl) {
        fallbackToSpeech();
        return;
      }
      const audio = new Audio(audioUrl);
      manualAudioRef.current = audio;
      let fallbackStarted = false;
      const fallbackOnce = () => {
        if (fallbackStarted) return;
        fallbackStarted = true;
        fallbackToSpeech();
      };
      audio.onended = () => { if (manualAudioRef.current === audio) manualAudioRef.current = null; };
      audio.onerror = fallbackOnce;
      await audio.play().catch(fallbackOnce);
    } catch (error: unknown) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) fallbackToSpeech();
    } finally {
      if (manualAbortRef.current === controller) setIsAudioLoading(false);
    }
  }, [cancelManualPlayback, currentWord, speakText, stopAutoReading]);

  const navigateFromSwipe = () => {
    const navigation = getSwipeNavigation(touchStartRef.current, touchEndRef.current);
    if (!navigation) return;
    swipedRef.current = true;
    if (navigation === 'next') nextWord();
    else prevWord();
  };

  const onTouchStart = (event: React.TouchEvent) => {
    if ((event.target as Element).closest('button, input, textarea, select, [contenteditable="true"]')) return;
    touchEndRef.current = null;
    touchStartRef.current = event.targetTouches[0].clientX;
    swipedRef.current = false;
  };
  const onTouchMove = (event: React.TouchEvent) => {
    if (touchStartRef.current !== null) touchEndRef.current = event.targetTouches[0].clientX;
  };
  const onTouchEnd = () => {
    navigateFromSwipe();
    touchStartRef.current = null;
    touchEndRef.current = null;
  };
  const onMouseDown = (event: React.MouseEvent) => {
    if ((event.target as Element).closest('button, input, textarea, select, [contenteditable="true"]')) return;
    isDragging.current = true;
    touchStartRef.current = event.clientX;
    touchEndRef.current = null;
    swipedRef.current = false;
  };
  const onMouseMove = (event: React.MouseEvent) => {
    if (isDragging.current) touchEndRef.current = event.clientX;
  };
  const finishMouseDrag = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    navigateFromSwipe();
    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === ' ') {
        event.preventDefault();
        handleFlip();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        void handleAudioClick(event);
      } else if (event.key === 'Shift') {
        event.preventDefault();
        handleSpeak(event);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAudioClick, handleFlip, handleSpeak]);

  if (!currentWord || totalWords === 0) {
    return (
      <div className="flex min-h-[320px] w-full items-center justify-center sm:min-h-[380px]">
        <Card className="w-full max-w-lg border-2 border-dashed p-8 text-center">
          <p className="text-lg font-semibold text-muted-foreground">{searchTerm ? '🔍 Không tìm thấy từ vựng phù hợp.' : '📚 Chưa có dữ liệu từ vựng.'}</p>
          <p className="mt-2 text-sm text-muted-foreground">{searchTerm ? 'Hãy thử từ khóa khác.' : 'Hãy import file Excel hoặc thêm từ mới để bắt đầu học.'}</p>
        </Card>
      </div>
    );
  }

  const shouldShowBack = showVietnameseFirst ? !isFlipped : isFlipped;
  return (
    <div className="perspective-[1200px] mx-auto w-full max-w-lg cursor-pointer select-none" onClick={handleFlip} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={finishMouseDrag} onMouseLeave={() => { isDragging.current = false; }} role="button" tabIndex={0} aria-label="Lật thẻ học">
      <div className={`transform-3d relative min-h-[320px] w-full transition-transform duration-700 sm:min-h-[380px] ${shouldShowBack ? 'rotate-y-180' : ''}`}>
        <Card className="backface-hidden absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-4 border-indigo-200/50 bg-gradient-to-br from-indigo-50 to-purple-50 p-6 shadow-xl sm:p-8 dark:border-indigo-800/50 dark:from-indigo-950/50 dark:to-purple-950/50">
          <div className="absolute right-3 top-3">
            <Tooltip><TooltipTrigger asChild><Button aria-label="Phát âm từ" variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={handleAudioClick} disabled={isAudioLoading}>{isAudioLoading ? <Loader2 className="h-7 w-7 animate-spin" /> : <Volume2 className="h-7 w-7" />}</Button></TooltipTrigger><TooltipContent>Phát âm</TooltipContent></Tooltip>
          </div>
          <div className="space-y-3 text-center">
            <h2 className="text-4xl font-bold tracking-tight text-foreground">{currentWord.english}</h2>
            {currentWord.wordType && <Badge variant="secondary" className="text-lg font-medium">{currentWord.wordType}</Badge>}
            {currentWord.phonetic && <p className="text-lg italic text-muted-foreground">{currentWord.phonetic}</p>}
          </div>
          {currentWord.exampleEnglish && <div className="mt-4 w-full rounded-lg border border-indigo-100/50 bg-white/60 p-3 sm:p-4 dark:border-indigo-800/30 dark:bg-white/5"><div className="mb-1 flex items-center justify-between"><p className="text-sm font-medium text-muted-foreground">Ví dụ:</p>{isSpeechSupported ? <Tooltip><TooltipTrigger asChild><Button aria-label={isSpeaking ? 'Dừng đọc ví dụ' : 'Đọc ví dụ'} variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-full" onClick={handleSpeak}>{isSpeaking ? <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> : <Volume2 className="h-4 w-4 text-indigo-500" />}</Button></TooltipTrigger><TooltipContent>{isSpeaking ? 'Dừng đọc' : 'Đọc ví dụ'}</TooltipContent></Tooltip> : <Tooltip><TooltipTrigger asChild><span className="inline-flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-full opacity-40"><VolumeX className="h-4 w-4" /></span></TooltipTrigger><TooltipContent>Trình duyệt không hỗ trợ đọc giọng nói</TooltipContent></Tooltip>}</div><p className="text-sm italic leading-relaxed text-red-500 sm:text-base">“{currentWord.exampleEnglish}”</p></div>}
          <p className="mt-auto pt-2 text-xs text-muted-foreground">Nhấn để lật thẻ</p>
        </Card>
        <Card className="backface-hidden rotate-y-180 absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-4 border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 shadow-xl sm:p-8 dark:border-emerald-800/50 dark:from-emerald-950/50 dark:to-teal-950/50">
          <div className="space-y-3 text-center"><h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{currentWord.translation}</h2></div>
          {currentWord.exampleVietnamese && <div className="mt-4 w-full rounded-lg border border-emerald-100/50 bg-white/60 p-3 sm:p-4 dark:border-emerald-800/30 dark:bg-white/5"><p className="mb-1 text-sm font-medium text-muted-foreground">Bản dịch:</p><p className="text-sm italic leading-relaxed text-red-500 sm:text-base">“{currentWord.exampleVietnamese}”</p></div>}
          <p className="mt-auto pt-2 text-xs text-muted-foreground">Nhấn để lật thẻ</p>
        </Card>
      </div>
    </div>
  );
}
