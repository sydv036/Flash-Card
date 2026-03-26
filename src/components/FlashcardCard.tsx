import { useState, useEffect, useCallback, useRef } from 'react';
import { useFlashcard } from '@/context/FlashcardContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';

export function FlashcardCard() {
  const { currentWord, showVietnameseFirst, totalWords, searchTerm } = useFlashcard();
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);

  // ─── Web Speech API (TTS) state ───
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check browser support on mount
  useEffect(() => {
    setIsSpeechSupported('speechSynthesis' in window);
  }, []);

  // Cleanup: stop speech when component unmounts or word changes
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [currentWord]);

  /**
   * Pick the best English voice available:
   * priority: "Google UK English Female" > "Google US English" > any en-* voice > default
   */
  const getEnglishVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();
    const preferred = [
      'Google UK English Female',
      'Google US English',
    ];
    for (const name of preferred) {
      const v = voices.find((voice) => voice.name === name);
      if (v) return v;
    }
    // Fallback to any en-US or en voice
    return (
      voices.find((v) => v.lang === 'en-US') ||
      voices.find((v) => v.lang.startsWith('en')) ||
      null
    );
  }, []);

  /**
   * Toggle speaking the example English sentence.
   * Clicking while speaking will stop playback.
   */
  const handleSpeak = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent card flip

      if (!isSpeechSupported || !currentWord?.exampleEnglish) return;

      // If currently speaking → stop
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }

      // Cancel any leftover utterance
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(currentWord.exampleEnglish);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.pitch = 1;

      const voice = getEnglishVoice();
      if (voice) utterance.voice = voice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => {
        setIsSpeaking(false);
        toast.error('Không thể phát giọng đọc. Vui lòng thử lại.');
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSpeaking, isSpeechSupported, currentWord, getEnglishVoice],
  );

  if (!currentWord || totalWords === 0) {
    if (searchTerm) {
      return (
        <div className="flex items-center justify-center min-h-[320px] sm:min-h-[380px] w-full">
          <Card className="w-full max-w-lg p-8 text-center bg-indigo-50/50 dark:bg-indigo-950/20 backdrop-blur-sm border-dashed border-2 border-indigo-200">
            <p className="text-indigo-600 dark:text-indigo-400 text-lg font-semibold">
              🔍 Không tìm thấy từ vựng phù hợp.
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              Hãy thử tìm bằng phân loại, định nghĩa hoặc từ khóa khác nhé.
            </p>
          </Card>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center min-h-[320px] sm:min-h-[380px]">
        <Card className="w-full max-w-lg p-8 text-center bg-card/80 backdrop-blur-sm border-dashed border-2">
          <p className="text-muted-foreground text-lg">
            📚 Chưa có dữ liệu từ vựng.
          </p>
          <p className="text-muted-foreground text-sm mt-2">
            Hãy import file Excel hoặc tải template mẫu để bắt đầu học!
          </p>
        </Card>
      </div>
    );
  }

  const handleFlip = () => setIsFlipped(!isFlipped);

  // Determine what shows on front and back based on preference
  const shouldShowBack = showVietnameseFirst ? !isFlipped : isFlipped;

  const handleAudioClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!currentWord || !currentWord.english) return;

    setIsAudioLoading(true);

    try {
      const wordId = currentWord.english.trim().toLowerCase();
      console.log(`[${wordId}]`);
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(wordId)}`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Không tìm thấy âm thanh cho từ này (hoặc từ không tồn tại).');
        } else {
          toast.error(`Lỗi kết nối (${response.status}): Không thể lấy dữ liệu.`);
        }
        return;
      }

      const data = await response.json();

      const phonetics = data[0]?.phonetics || [];
      const audioObj = phonetics.find((p: any) => p.audio && p.audio.includes('-us.mp3'))
        || phonetics.find((p: any) => p.audio);
      const audioUrl = audioObj?.audio;

      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.play().catch((err) => {
          console.error('Audio play error:', err);
          toast.error('Trình duyệt chặn phát âm thanh tự động.');
        });
      } else {
        toast.error('Không tìm thấy âm thanh cho từ này.');
      }
    } catch (error) {
      console.error('API Error:', error);
      toast.error('Lỗi kết nối. Vui lòng kiểm tra mạng.');
    } finally {
      setIsAudioLoading(false);
    }
  };

  return (
    <div
      className="perspective-[1200px] w-full max-w-lg mx-auto cursor-pointer select-none"
      onClick={handleFlip}
    >
      <div
        className={`relative w-full min-h-[320px] sm:min-h-[380px] transition-transform duration-700 transform-3d ${shouldShowBack ? 'rotate-y-180' : ''
          }`}
      >
        {/* ─── Front Side (English) ─── */}
        <Card className="absolute inset-0 w-full h-full backface-hidden p-6 sm:p-8 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 border-indigo-200/50 dark:border-indigo-800/50 shadow-xl">
          <div className="absolute top-3 right-3 flex gap-2 ">

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={handleAudioClick}
                  disabled={isAudioLoading}
                >
                  {isAudioLoading ? (
                    <Loader2 className="h-7 w-7 animate-spin" />
                  ) : (
                    <Volume2 className="h-7 w-7" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Phát âm</TooltipContent>
            </Tooltip>
          </div>

          <div className="text-center space-y-3">
            <h2 className="text-4xl sm:text-4xl font-bold text-foreground tracking-tight">
              {currentWord.english}

            </h2>
            <Badge variant="secondary" className="text-lg font-medium">
              {currentWord.wordType}
            </Badge>
            {currentWord.phonetic && (
              <p className="text-muted-foreground text-lg italic">
                {currentWord.phonetic}
              </p>
            )}
          </div>

          {currentWord.exampleEnglish && (
            <div className="mt-4 p-3 sm:p-4 rounded-lg bg-white/60 dark:bg-white/5 border border-indigo-100/50 dark:border-indigo-800/30 w-full">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-muted-foreground font-medium">Ví dụ:</p>

                {/* ─── TTS Button for exampleEnglish ─── */}
                {isSpeechSupported ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full shrink-0"
                        onClick={handleSpeak}
                        disabled={false}
                      >
                        {isSpeaking ? (
                          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                        ) : (
                          <Volume2 className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isSpeaking ? 'Dừng đọc' : 'Đọc ví dụ'}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full opacity-40 cursor-not-allowed">
                        <VolumeX className="h-4 w-4" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Trình duyệt không hỗ trợ đọc giọng nói</TooltipContent>
                  </Tooltip>
                )}
              </div>

              <p className="text-foreground text-sm sm:text-base italic leading-relaxed text-red-500">
                "{currentWord.exampleEnglish}"
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-auto pt-2">
            Nhấn để lật thẻ
          </p>
        </Card>

        {/* ─── Back Side (Vietnamese) ─── */}
        <Card className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 p-6 sm:p-8 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 border-emerald-200/50 dark:border-emerald-800/50 shadow-xl">
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="text-xs font-medium">
              {/* {currentWord.wordType} */}
            </Badge>
          </div>

          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              {currentWord.translation}
            </h2>
            <p className="text-muted-foreground text-lg">
              {/* ({currentWord.english}) */}
            </p>
          </div>

          {currentWord.exampleVietnamese && (
            <div className="mt-4 p-3 sm:p-4 rounded-lg bg-white/60 dark:bg-white/5 border border-emerald-100/50 dark:border-emerald-800/30 dark:bg-white w-full">
              <p className="text-sm text-muted-foreground mb-1 font-medium">Bản dịch:</p>
              <p className="text-foreground text-sm sm:text-base italic leading-relaxed text-red-500">
                "{currentWord.exampleVietnamese}"
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-auto pt-2">
            Nhấn để lật thẻ
          </p>
        </Card>
      </div>
    </div>
  );
}
