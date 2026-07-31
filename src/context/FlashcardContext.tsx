import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { FlashcardSheet, FlashcardWord } from '@/types/flashcard';
import { createPlaybackSessionGuard, shuffleKeys, type PlaybackToken, type ShuffleResult } from '@/lib/flashcardStudy';
import { fetchPronunciationUrl, isEnglishWord, selectEnglishVoice } from '@/lib/pronunciation';
import { FlashcardContext } from './flashcard-context';

type StudyEntry = { key: string; word: FlashcardWord };

const normalizeSheetName = (name: string) => name.trim().toLocaleLowerCase('vi');

export function FlashcardProvider({ children }: { children: ReactNode }) {
  const [sheets, setStoredSheets] = useLocalStorage<FlashcardSheet[]>('fc-sheets', []);
  const [activeSheetIndex, setStoredActiveSheetIndex] = useLocalStorage<number>('fc-active-sheet', 0);
  const [currentWordIndex, setStoredCurrentWordIndex] = useLocalStorage<number>('fc-current-word', 0);
  const [showVietnameseFirst, setShowVietnameseFirst] = useLocalStorage<boolean>('fc-vn-first', false);
  const [flashcardBreakTime, setFlashcardBreakTime] = useLocalStorage<number>('fc-flashcard-break', 0);
  const [searchTerm, setSearchTermState] = useState('');
  const [sessionOrder, setSessionOrder] = useState<{ source: string; keys: string[] } | null>(null);
  const [isAutoReading, setIsAutoReading] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const playbackGuard = useRef(createPlaybackSessionGuard());

  const activeSheet = activeSheetIndex === -1 ? null : (sheets[activeSheetIndex] ?? null);
  const baseEntries = useMemo<StudyEntry[]>(() => {
    if (activeSheetIndex === -1) {
      return sheets.flatMap((sheet, sheetIndex) => sheet.words.map((word, wordIndex) => ({ key: `${sheetIndex}:${wordIndex}`, word })));
    }
    return (activeSheet?.words || []).map((word, wordIndex) => ({ key: `${activeSheetIndex}:${wordIndex}`, word }));
  }, [activeSheet, activeSheetIndex, sheets]);

  const filteredEntries = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase('vi');
    if (!query) return baseEntries;
    return baseEntries.filter(({ word }) =>
      word.english.toLocaleLowerCase('vi').includes(query)
      || word.translation.toLocaleLowerCase('vi').includes(query)
      || word.exampleEnglish?.toLocaleLowerCase('vi').includes(query)
      || word.exampleVietnamese?.toLocaleLowerCase('vi').includes(query));
  }, [baseEntries, searchTerm]);
  const baseEntriesSignature = useMemo(() => JSON.stringify(baseEntries.map(entry => [entry.key, entry.word])), [baseEntries]);

  const orderedEntries = useMemo(() => {
    if (!sessionOrder || sessionOrder.source !== baseEntriesSignature) return filteredEntries;
    const rank = new Map(sessionOrder.keys.map((key, index) => [key, index]));
    return [...filteredEntries].sort((left, right) => (rank.get(left.key) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.key) ?? Number.MAX_SAFE_INTEGER));
  }, [baseEntriesSignature, filteredEntries, sessionOrder]);

  const words = useMemo(() => orderedEntries.map(entry => entry.word), [orderedEntries]);
  const currentWord = words[currentWordIndex] ?? null;
  const totalWords = words.length;
  const hasNext = currentWordIndex < totalWords - 1;
  const hasPrev = currentWordIndex > 0;
  const activeSheetName = activeSheetIndex === -1 ? 'Tất cả buổi học (Tổng hợp)' : (activeSheet?.name ?? '');

  const clearPlaybackResources = useCallback((cancelSpeech = true) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (cancelSpeech && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const stopAutoReading = useCallback(() => {
    playbackGuard.current.stop();
    clearPlaybackResources();
    setIsAutoReading(false);
  }, [clearPlaybackResources]);

  const setSheets = useCallback((value: SetStateAction<FlashcardSheet[]>) => {
    stopAutoReading();
    setSessionOrder(null);
    setSearchTermState('');
    setStoredCurrentWordIndex(0);
    setStoredSheets(value);
  }, [setStoredCurrentWordIndex, setStoredSheets, stopAutoReading]);

  const setActiveSheetIndex = useCallback((index: number) => {
    stopAutoReading();
    setSessionOrder(null);
    setSearchTermState('');
    setStoredActiveSheetIndex(index);
    setStoredCurrentWordIndex(0);
  }, [setStoredActiveSheetIndex, setStoredCurrentWordIndex, stopAutoReading]);

  const setCurrentWordIndex = useCallback((index: number) => {
    stopAutoReading();
    setStoredCurrentWordIndex(Math.max(0, Math.min(index, Math.max(totalWords - 1, 0))));
  }, [setStoredCurrentWordIndex, stopAutoReading, totalWords]);

  const nextWord = useCallback(() => {
    stopAutoReading();
    setStoredCurrentWordIndex(previous => Math.min(previous + 1, Math.max(totalWords - 1, 0)));
  }, [setStoredCurrentWordIndex, stopAutoReading, totalWords]);

  const prevWord = useCallback(() => {
    stopAutoReading();
    setStoredCurrentWordIndex(previous => Math.max(previous - 1, 0));
  }, [setStoredCurrentWordIndex, stopAutoReading]);

  const setSearchTerm = useCallback((term: string) => {
    stopAutoReading();
    setSessionOrder(null);
    setStoredCurrentWordIndex(0);
    setSearchTermState(term);
  }, [setStoredCurrentWordIndex, stopAutoReading]);

  const shuffleWords = useCallback((): ShuffleResult => {
    stopAutoReading();
    const shuffled = shuffleKeys(filteredEntries.map(entry => entry.key));
    if (shuffled.result === 'shuffled') {
      setSessionOrder({ source: baseEntriesSignature, keys: shuffled.keys });
      setStoredCurrentWordIndex(0);
    }
    return shuffled.result;
  }, [baseEntriesSignature, filteredEntries, setStoredCurrentWordIndex, stopAutoReading]);

  const addWord = useCallback((sheetName: string, word: FlashcardWord) => {
    stopAutoReading();
    setSessionOrder(null);
    setSearchTermState('');
    setStoredCurrentWordIndex(0);
    setStoredSheets(previousSheets => {
      const nextSheets = [...previousSheets];
      const normalized = normalizeSheetName(sheetName);
      const sheetIndex = nextSheets.findIndex(sheet => normalizeSheetName(sheet.name) === normalized);
      if (sheetIndex >= 0) {
        nextSheets[sheetIndex] = { ...nextSheets[sheetIndex], words: [word, ...nextSheets[sheetIndex].words] };
      } else {
        nextSheets.push({ name: sheetName.trim(), words: [word] });
      }
      return nextSheets;
    });
  }, [setStoredCurrentWordIndex, setStoredSheets, stopAutoReading]);

  const finishAutoReading = useCallback((token: PlaybackToken) => {
    if (!playbackGuard.current.isActive(token)) return;
    playbackGuard.current.stop();
    clearPlaybackResources();
    setIsAutoReading(false);
  }, [clearPlaybackResources]);

  const scheduleAdvance = useCallback((token: PlaybackToken, delayMs: number) => {
    timeoutRef.current = setTimeout(() => {
      if (!playbackGuard.current.isActive(token)) return;
      if (hasNext) setStoredCurrentWordIndex(previous => Math.min(previous + 1, totalWords - 1));
      else finishAutoReading(token);
    }, delayMs);
  }, [finishAutoReading, hasNext, setStoredCurrentWordIndex, totalWords]);

  const playWordAndAdvance = useCallback(async (token: PlaybackToken, signal: AbortSignal) => {
    if (!currentWord?.english) {
      scheduleAdvance(token, 2000 + flashcardBreakTime * 1000);
      return;
    }

    const fallbackToSpeech = () => {
      if (!playbackGuard.current.isActive(token)) return;
      if (!('speechSynthesis' in window)) {
        scheduleAdvance(token, 1500 + flashcardBreakTime * 1000);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(currentWord.english);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.pitch = 1;
      const voice = selectEnglishVoice(window.speechSynthesis.getVoices());
      if (voice) utterance.voice = voice;
      utterance.onend = () => scheduleAdvance(token, flashcardBreakTime * 1000);
      utterance.onerror = () => scheduleAdvance(token, 1500 + flashcardBreakTime * 1000);
      window.speechSynthesis.speak(utterance);
    };

    if (!isEnglishWord(currentWord.english)) {
      fallbackToSpeech();
      return;
    }

    try {
      const audioUrl = await fetchPronunciationUrl(currentWord.english, signal);
      if (!playbackGuard.current.isActive(token)) return;
      if (!audioUrl) {
        fallbackToSpeech();
        return;
      }
      const audio = new Audio(audioUrl);
      let fallbackStarted = false;
      const fallbackOnce = () => {
        if (fallbackStarted || !playbackGuard.current.isActive(token)) return;
        fallbackStarted = true;
        audio.onended = null;
        audio.onerror = null;
        fallbackToSpeech();
      };
      audioRef.current = audio;
      audio.onended = () => scheduleAdvance(token, flashcardBreakTime * 1000);
      audio.onerror = fallbackOnce;
      await audio.play().catch(fallbackOnce);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      fallbackToSpeech();
    }
  }, [currentWord, flashcardBreakTime, scheduleAdvance]);

  const toggleAutoRead = useCallback(() => {
    if (isAutoReading) {
      stopAutoReading();
      return;
    }
    if (!currentWord) {
      toast.info('Chưa có thẻ để đọc.');
      return;
    }
    playbackGuard.current.start();
    setIsAutoReading(true);
  }, [currentWord, isAutoReading, stopAutoReading]);

  useEffect(() => {
    if (sheets.length === 0) {
      if (activeSheetIndex !== 0) setStoredActiveSheetIndex(0);
    } else if (activeSheetIndex < -1 || activeSheetIndex >= sheets.length) {
      setStoredActiveSheetIndex(0);
      setStoredCurrentWordIndex(0);
    }
  }, [activeSheetIndex, setStoredActiveSheetIndex, setStoredCurrentWordIndex, sheets]);

  useEffect(() => {
    if (totalWords === 0 && currentWordIndex !== 0) setStoredCurrentWordIndex(0);
    else if (currentWordIndex >= totalWords && totalWords > 0) setStoredCurrentWordIndex(totalWords - 1);
  }, [currentWordIndex, setStoredCurrentWordIndex, totalWords]);

  useEffect(() => {
    if (!isAutoReading) return;
    const guard = playbackGuard.current;
    const token = guard.beginPlayback();
    clearPlaybackResources();
    const controller = new AbortController();
    abortRef.current = controller;
    void playWordAndAdvance(token, controller.signal);
    return () => {
      guard.beginPlayback();
      clearPlaybackResources(false);
    };
  }, [clearPlaybackResources, currentWordIndex, isAutoReading, playWordAndAdvance]);

  useEffect(() => () => {
    playbackGuard.current.stop();
    clearPlaybackResources();
  }, [clearPlaybackResources]);

  return (
    <FlashcardContext.Provider value={{
      sheets,
      activeSheetIndex,
      currentWordIndex,
      showVietnameseFirst,
      currentWord,
      totalWords,
      activeSheetName,
      setSheets,
      setActiveSheetIndex,
      setCurrentWordIndex,
      setShowVietnameseFirst,
      nextWord,
      prevWord,
      shuffleWords,
      addWord,
      searchTerm,
      setSearchTerm,
      hasNext,
      hasPrev,
      isAutoReading,
      flashcardBreakTime,
      setFlashcardBreakTime,
      toggleAutoRead,
      stopAutoReading,
    }}>
      {children}
    </FlashcardContext.Provider>
  );
}
