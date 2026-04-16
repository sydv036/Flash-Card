import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Pause, SkipForward, SkipBack, Shuffle, Loader2, Music, ListMusic, Layers, ListOrdered, Repeat, Repeat1, ChevronsRight, ChevronsLeft, X, Eye, EyeOff } from 'lucide-react';
import { getLocalAudioFiles } from '@/lib/localAudio';
import type { AudioFile } from '@/lib/localAudio';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Tự động load tất cả các file JSON script từ thư mục script
const scriptModules = import.meta.glob('@/utils/audio/script/*.json', { eager: true });
const allScripts: any[] = Object.values(scriptModules).map((mod: any) => mod.default || mod);

// Tự động quét tất cả các file hình ảnh trong thư mục src/assets để import tự động
const imageModules = import.meta.glob('@/assets/**/*.{png,jpg,jpeg,gif,svg,webp}', { eager: true, query: '?url', import: 'default' });

export type PlayMode = 'SEQUENTIAL' | 'SHUFFLE' | 'LOOP';

export function AudioPlayer() {
  const [allFiles, setAllFiles] = useState<AudioFile[]>([]);
  const [activeSession, setActiveSession] = useState<string>('All');

  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>('SEQUENTIAL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImageEnlarged, setIsImageEnlarged] = useState(false);
  const [showScriptContent, setShowScriptContent] = useLocalStorage<boolean>('fc-audio-show-script', false);

  // Advanced Controls
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  const [audioBreakTime, setAudioBreakTime] = useLocalStorage<number>('fc-audio-break', 0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const loadFiles = useCallback(() => {
    try {
      setLoading(true);
      setError(null);
      const audioFiles = getLocalAudioFiles();
      setAllFiles(audioFiles);
    } catch (err: any) {
      setError(err.message || 'Failed to load local audio files.');
      toast.error('Failed to load audio files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const sessions = useMemo(() => {
    const sessionSet = new Set<string>();
    allFiles.forEach(f => sessionSet.add(f.session));
    return Array.from(sessionSet).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase(), 'vi', { numeric: true })
    );
  }, [allFiles]);

  const filteredFiles = useMemo(() => {
    if (activeSession === 'All') return allFiles;
    return allFiles.filter(f => f.session === activeSession);
  }, [allFiles, activeSession]);

  const handleSessionChange = (val: string) => {
    clearPendingTimeout();
    setActiveSession(val);
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    setCurrentIndex(-1);
    setCurrentTime(0);
    setDuration(0);
  };

  const startPlaybackMode = (sessionVal: string, mode: PlayMode) => {
    clearPendingTimeout();
    if (isPlaying && audioRef.current) audioRef.current.pause();
    setIsPlaying(false);

    setActiveSession(sessionVal);
    setPlayMode(mode);

    const targetList = sessionVal === 'All' ? allFiles : allFiles.filter(f => f.session === sessionVal);

    if (targetList.length > 0) {
      const initialIdx = mode === 'SHUFFLE' ? Math.floor(Math.random() * targetList.length) : 0;
      setCurrentIndex(initialIdx);
    } else {
      setCurrentIndex(-1);
      toast.error('No audio files matched this selection');
    }
  };

  const currentFile = currentIndex >= 0 ? filteredFiles[currentIndex] : null;

  const currentSessionNumber = useMemo(() => {
    if (!currentFile || !currentFile.session) return null;
    const match = currentFile.session.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  }, [currentFile]);

  const currentAudioId = useMemo(() => {
    if (!currentFile || !currentFile.name) return null;
    const match = currentFile.name.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  }, [currentFile]);

  const currentScriptItem = useMemo(() => {
    if (currentSessionNumber === null || currentAudioId === null) return null;
    const sessionScript = allScripts.find(s => s.lessonId === currentSessionNumber);
    if (!sessionScript || !sessionScript.items) return null;
    return sessionScript.items.find((item: any) => item.id === currentAudioId) || null;
  }, [currentSessionNumber, currentAudioId]);

  const currentImageUrl = useMemo(() => {
    if (currentSessionNumber === null || currentAudioId === null) return null;

    // 1. Cắt số buổi ra thêm chữ B => ví dụ: B9
    const targetFolder = `B${currentSessionNumber}`;
    console.log(`Folder ${targetFolder}`);


    // 2. Cắt tên audio ra => ví dụ: 2 (từ 2.mp3)
    // Ở đây currentAudioId chính là số 2 đã được cắt ra từ trước
    const targetNamePrefix = `${currentAudioId}.`;

    // Quét tìm trong danh sách ảnh nội bộ (đã compile sẵn cực nhanh)
    const possiblePaths = Object.keys(imageModules);
    const matchedPath = possiblePaths.find(path => {
      const parts = path.split('/');
      const folder = parts[parts.length - 2];
      const filename = parts[parts.length - 1];

      // Khớp chính xác thư mục (B9) và tên file bắt đầu bằng số audio (vd "2.png", "2.jpg")
      return folder === targetFolder && filename.startsWith(targetNamePrefix);
    });

    if (matchedPath) {
      return imageModules[matchedPath] as string;
    }

    // Dự phòng: Nếu sau này bỏ trong public/assets/B9/2.png
    return `/assets/${targetFolder}/${currentAudioId}.png`;
  }, [currentSessionNumber, currentAudioId]);

  const skipToNextSession = () => {
    clearPendingTimeout();
    if (activeSession !== 'All' || filteredFiles.length === 0 || !currentFile) return;
    const currentSessIndex = sessions.indexOf(currentFile.session);
    const nextSessionName = currentSessIndex >= 0 && currentSessIndex < sessions.length - 1 ? sessions[currentSessIndex + 1] : sessions[0];
    const targetIdx = filteredFiles.findIndex(f => f.session === nextSessionName);
    setCurrentIndex(targetIdx !== -1 ? targetIdx : 0);
  };

  const skipToPrevSession = () => {
    clearPendingTimeout();
    if (activeSession !== 'All' || filteredFiles.length === 0 || !currentFile) return;
    const currentSessIndex = sessions.indexOf(currentFile.session);
    const prevSessionName = currentSessIndex > 0 ? sessions[currentSessIndex - 1] : sessions[sessions.length - 1];
    const targetIdx = filteredFiles.findIndex(f => f.session === prevSessionName);
    setCurrentIndex(targetIdx !== -1 ? targetIdx : 0);
  };

  const playNext = useCallback((isAuto = false) => {
    clearPendingTimeout();
    if (filteredFiles.length === 0) return;

    if (isAuto && playMode === 'LOOP') {
      const triggerLoop = () => {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(e => console.error(e));
        }
      };
      if (audioBreakTime > 0) {
        timeoutRef.current = setTimeout(triggerLoop, audioBreakTime * 1000);
      } else {
        triggerLoop();
      }
      return;
    }

    let nextIndex;
    if (playMode === 'SHUFFLE') {
      nextIndex = Math.floor(Math.random() * filteredFiles.length);
      if (nextIndex === currentIndex && filteredFiles.length > 1) {
        nextIndex = (nextIndex + 1) % filteredFiles.length;
      }
    } else {
      nextIndex = (currentIndex + 1) % filteredFiles.length;
    }

    if (isAuto && audioBreakTime > 0) {
      timeoutRef.current = setTimeout(() => {
        setCurrentIndex(nextIndex);
      }, audioBreakTime * 1000);
    } else {
      setCurrentIndex(nextIndex);
    }
  }, [filteredFiles.length, currentIndex, playMode, audioBreakTime, clearPendingTimeout]);

  const playPrevious = () => {
    clearPendingTimeout();
    if (filteredFiles.length === 0) return;
    const prevIndex = currentIndex <= 0 ? filteredFiles.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIndex);
  };

  const togglePlaySync = () => {
    clearPendingTimeout();
    if (currentIndex === -1 && filteredFiles.length > 0) {
      setCurrentIndex(0);
      return;
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => {
          console.error("Playback failed:", e);
          toast.error("Could not play audio");
        });
      }
    }
  };

  const cyclePlayMode = () => {
    if (playMode === 'SEQUENTIAL') setPlayMode('SHUFFLE');
    else if (playMode === 'SHUFFLE') setPlayMode('LOOP');
    else setPlayMode('SEQUENTIAL');
  };

  // Sync playbackRate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Auto play when currentIndex changes
  useEffect(() => {
    if (currentIndex >= 0 && audioRef.current && filteredFiles[currentIndex]) {
      audioRef.current.src = filteredFiles[currentIndex].url;
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error("Auto-play blocked or failed", err);
          setIsPlaying(false);
          toast.error(`Không thể phát: ${filteredFiles[currentIndex].name}. Đang bỏ qua...`);
          clearPendingTimeout();
          timeoutRef.current = setTimeout(() => {
            playNext(true);
          }, 1500);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, filteredFiles]);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const handleEnded = () => playNext(true);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => {
      console.error("Audio playback error");
      setIsPlaying(false);
      clearPendingTimeout();
      timeoutRef.current = setTimeout(() => {
        playNext(true);
      }, 1500);
    };

    audioEl.addEventListener('ended', handleEnded);
    audioEl.addEventListener('play', handlePlay);
    audioEl.addEventListener('pause', handlePause);
    audioEl.addEventListener('error', handleError);

    return () => {
      audioEl.removeEventListener('ended', handleEnded);
      audioEl.removeEventListener('play', handlePlay);
      audioEl.removeEventListener('pause', handlePause);
      audioEl.removeEventListener('error', handleError);
    };
  }, [playNext, clearPendingTimeout]);

  const formatTime = (time: number) => {
    if (isNaN(time)) return '00:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const renderModeIcon = () => {
    if (playMode === 'SEQUENTIAL') return <Repeat className="w-5 h-5 text-indigo-500" />;
    if (playMode === 'SHUFFLE') return <Shuffle className="w-5 h-5 text-indigo-500" />;
    return <Repeat1 className="w-5 h-5 text-indigo-700 dark:text-indigo-300" />;
  }

  return (
    <div className="w-full flex flex-col gap-6">

      {/* Top Toolbar */}
      <Card className="border-border/40 shadow-sm overflow-hidden bg-card/60 backdrop-blur-sm">
        <div className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chọn buổi học</label>
              <Select value={activeSession} onValueChange={handleSessionChange}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Chọn buổi học" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">Tất cả buổi học</SelectItem>
                  {sessions.map(session => (
                    <SelectItem key={session} value={session}>{session}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nghỉ (giây)</label>
              <Input
                type="number"
                min={0}
                className="w-full sm:w-[90px]"
                value={audioBreakTime}
                onChange={(e) => setAudioBreakTime(Math.max(0, Number(e.target.value)))}
              />
            </div>

            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tốc độ</label>
              <Select value={playbackRate.toString()} onValueChange={(val) => setPlaybackRate(Number(val))}>
                <SelectTrigger className="w-full sm:w-[90px]">
                  <SelectValue placeholder="Tốc độ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">0.5x</SelectItem>
                  <SelectItem value="0.75">0.75x</SelectItem>
                  <SelectItem value="1">1.0x</SelectItem>
                  <SelectItem value="1.25">1.25x</SelectItem>
                  <SelectItem value="1.5">1.5x</SelectItem>
                  <SelectItem value="2">2.0x</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-4">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 hover:bg-muted"
              onClick={() => startPlaybackMode(activeSession, 'SEQUENTIAL')}
              disabled={filteredFiles.length === 0}
            >
              <ListOrdered className="w-4 h-4 text-muted-foreground" />
              <span className="hidden sm:inline">Phát lần lượt</span>
              <span className="sm:hidden">Lần lượt</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-900/40 dark:hover:bg-indigo-900/50"
              onClick={() => startPlaybackMode(activeSession, 'SHUFFLE')}
              disabled={filteredFiles.length === 0}
            >
              <Shuffle className="w-4 h-4 text-indigo-500" />
              <span className="hidden sm:inline">{activeSession === 'All' ? 'Trộn tất cả' : 'Trộn buổi này'}</span>
              <span className="sm:hidden">Trộn</span>
            </Button>

            {activeSession !== 'All' && (
              <Button
                variant="default"
                size="sm"
                className="flex items-center gap-2"
                onClick={() => startPlaybackMode('All', 'SHUFFLE')}
                disabled={allFiles.length === 0}
              >
                <Layers className="w-4 h-4" />
                <span>Trộn hệ thống</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Player Controls */}
      <Card className="border-2 border-indigo-100 dark:border-indigo-900/40 shadow-xl overflow-hidden bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm relative">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col items-center gap-6">
            {/* {currentScriptItem && currentImageUrl ? ( */}
            {currentImageUrl ? (
              <div className="w-full max-w-[320px] aspect-[4/3] rounded-xl bg-white/60 dark:bg-gray-800/60 overflow-hidden border border-indigo-100 dark:border-indigo-900/40 p-2 shadow-sm relative group flex items-center justify-center">
                <img
                  src={currentImageUrl}
                  alt={`Hình ảnh câu ${currentAudioId}`}
                  className="w-full h-full object-contain transition-all hover:scale-[1.02] cursor-zoom-in"
                  onClick={() => setIsImageEnlarged(true)}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 pointer-events-none rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-black/50 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 backdrop-blur-md">
                    Phóng to
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                {isPlaying ? (
                  <div className="flex gap-1.5 items-end h-8">
                    <div className="w-1.5 bg-white rounded-full animate-[bounce_1s_ease-in-out_infinite]" />
                    <div className="w-1.5 bg-white rounded-full animate-[bounce_1.2s_ease-in-out_infinite_0.1s]" />
                    <div className="w-1.5 bg-white rounded-full animate-[bounce_0.9s_ease-in-out_infinite_0.2s]" />
                    <div className="w-1.5 bg-white rounded-full animate-[bounce_1.1s_ease-in-out_infinite_0.3s]" />
                  </div>
                ) : (
                  <Music className="w-10 h-10 text-white" />
                )}
              </div>
            )}

            <div className="text-center w-full">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 truncate flex-1 leading-tight mb-2">
                {currentFile ? currentFile.name : 'Vui lòng chọn bài'}
              </h2>
              <div className="inline-flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full">
                <Layers className="w-3.5 h-3.5" />
                <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider">
                  {currentFile && currentFile.session !== 'Others'
                    ? `Buổi: ${currentFile.session}`
                    : `${filteredFiles.length} file(s) / ${sessions.length} Buổi học`}
                </p>
              </div>
            </div>

            {/* Seek Bar */}
            <div className="w-full max-w-sm mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-2 font-medium">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-indigo-100 dark:bg-indigo-900 rounded-lg appearance-none cursor-pointer accent-indigo-600 outline-none transition-all hover:h-2"
              />
            </div>

            <audio
              ref={audioRef}
              className="hidden"
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => {
                const audio = e.currentTarget;
                setDuration(audio.duration);
                audio.playbackRate = playbackRate;
              }}
            />

            <div className="flex items-center gap-2 sm:gap-4 mt-2">
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "rounded-full w-10 h-10 sm:w-12 sm:h-12 transition-all",
                  playMode !== 'SEQUENTIAL' && "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700"
                )}
                onClick={cyclePlayMode}
                title={`Chế độ: ${playMode}`}
              >
                {renderModeIcon()}
              </Button>

              <div className="flex gap-1 sm:gap-2 border border-border/60 rounded-full px-2 py-1 items-center bg-muted/10">
                {activeSession === 'All' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full w-8 h-8 hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-900"
                    onClick={skipToPrevSession}
                    title="Chuyển về buổi học trước"
                    disabled={filteredFiles.length === 0}
                  >
                    <ChevronsLeft className="w-5 h-5" />
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full w-10 h-10 sm:w-12 sm:h-12 border-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={playPrevious}
                  disabled={filteredFiles.length === 0}
                >
                  <SkipBack className="w-6 h-6" />
                </Button>
              </div>

              <Button
                size="icon"
                className="rounded-full w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-xl shadow-indigo-500/20 text-white border-0 hover:scale-105 transition-transform"
                onClick={togglePlaySync}
                disabled={filteredFiles.length === 0}
              >
                {loading ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-8 h-8 fill-current" />
                ) : (
                  <Play className="w-8 h-8 fill-current ml-1" />
                )}
              </Button>

              <div className="flex gap-1 sm:gap-2 border border-border/60 rounded-full px-2 py-1 items-center bg-muted/10">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full w-10 h-10 sm:w-12 sm:h-12 border-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => playNext()}
                  disabled={filteredFiles.length === 0}
                >
                  <SkipForward className="w-6 h-6" />
                </Button>

                {activeSession === 'All' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full w-8 h-8 hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-900"
                    onClick={skipToNextSession}
                    title="Chuyển sang buổi học kế tiếp"
                    disabled={filteredFiles.length === 0}
                  >
                    <ChevronsRight className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Hiển thị script nếu có file script match */}
            {currentScriptItem && currentSessionNumber !== null && (
              <div className="w-full mt-6 border-t border-border/50 pt-6 z-10 bg-white/40 dark:bg-black/20 p-4 md:p-6 rounded-xl backdrop-blur-sm">

                {/* Nội dung Script */}
                <div className="w-full flex flex-col gap-3 text-left">
                  <h3 className="font-semibold text-lg text-indigo-700 dark:text-indigo-400 mb-2 flex items-center justify-between">
                    <span>Nội dung bài nghe</span>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 rounded-full px-4 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-900/50"
                      onClick={() => setShowScriptContent(!showScriptContent)}
                    >
                      {showScriptContent ? (
                        <>
                          <EyeOff className="w-4 h-4 text-indigo-500" />
                          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Ẩn nội dung</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 text-indigo-500" />
                          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Hiện nội dung</span>
                        </>
                      )}
                    </Button>
                  </h3>

                  {showScriptContent ? (
                    <div className="flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                      {currentScriptItem.answers?.map((ans: any, idx: number) => {
                        const isCorrect = ans.key === currentScriptItem.correctAnswer;
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "p-3.5 rounded-lg border transition-all duration-200",
                              isCorrect
                                ? "bg-green-50/90 border-green-200 dark:bg-green-950/40 dark:border-green-900/60 shadow-sm scale-[1.01]"
                                : "bg-white/50 dark:bg-gray-800/40 border-border/60 hover:bg-white dark:hover:bg-gray-800"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <span className={cn(
                                "font-bold text-base min-w-[24px] mt-0.5",
                                isCorrect ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                              )}>
                                {ans.key}.
                              </span>
                              <div className="flex flex-col gap-1.5">
                                <span className={cn(
                                  "text-[15px] font-medium leading-snug",
                                  isCorrect ? "text-green-700 dark:text-green-300" : "text-foreground"
                                )}>{ans.en}</span>
                                <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                                  {ans.vi}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center py-12 px-4 bg-muted/20 border-2 border-dashed border-indigo-100 dark:border-indigo-900/40 rounded-xl cursor-pointer hover:bg-muted/40 transition-colors group"
                      onClick={() => setShowScriptContent(true)}
                    >
                      <EyeOff className="w-10 h-10 text-muted-foreground/50 group-hover:text-indigo-400 mb-3 transition-colors" />
                      <p className="text-sm text-muted-foreground font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
                        Nội dung đang ẩn
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Nhấn vào đây hoặc nút "Hiện nội dung" để hiển thị
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 pointer-events-none opacity-20">
            <Music className="w-24 h-24" />
          </div>
        </CardContent>
      </Card>

      {/* Track List */}
      <Card className="border-border/40 shadow-sm overflow-hidden bg-card/60 backdrop-blur-sm">
        <div className="p-4 border-b border-border/50 flex flex-row items-center gap-2 bg-muted/20 justify-between">
          <div className="flex flex-row items-center gap-2">
            <ListMusic className="w-5 h-5 text-indigo-500" />
            <h3 className="font-semibold text-foreground">
              {activeSession === 'All' ? 'Tất cả danh sách' : `Danh sách: ${activeSession}`}
            </h3>
          </div>
          <span className="text-xs font-medium text-muted-foreground bg-background px-2 py-1 rounded-md border border-border">
            {filteredFiles.length} bài
          </span>
        </div>
        <div className="max-h-[400px] overflow-y-auto p-2 scrollbar-thin">
          {error ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-red-500">
              <p>{error}</p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
              <p>Loading local audio files...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground flex flex-col gap-2">
              <p>No audio files found.</p>
              <p className="text-sm">Add .mp3 or .wav files to <code>src/utils/audio/</code> to see them here.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredFiles.map((file, index) => (
                <button
                  key={file.id}
                  onClick={() => {
                    clearPendingTimeout();
                    setCurrentIndex(index);
                  }}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg text-left transition-all hover:bg-muted group w-full",
                    currentIndex === index
                      ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/50 shadow-sm"
                      : "text-foreground"
                  )}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-background shrink-0 shadow-sm border border-border group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/50 transition-colors">
                      {currentIndex === index && isPlaying ? (
                        <Music className="w-4 h-4 text-indigo-500 animate-pulse" />
                      ) : (
                        <Play className="w-4 h-4 text-muted-foreground group-hover:text-indigo-500 ml-0.5" />
                      )}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="truncate text-sm font-medium">
                        {file.name}
                      </span>
                      {activeSession === 'All' && file.session !== 'Others' && (
                        <span className="text-[10px] sm:text-xs text-muted-foreground truncate uppercase tracking-wider font-semibold">
                          {file.session}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Fullscreen Image Overlay */}
      {isImageEnlarged && currentImageUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setIsImageEnlarged(false)}
        >
          <button
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-12 h-12 bg-white/10 hover:bg-white/20 hover:scale-105 rounded-full flex items-center justify-center text-white transition-all shadow-lg"
            onClick={(e) => {
              e.stopPropagation();
              setIsImageEnlarged(false);
            }}
          >
            <X className="w-6 h-6" />
          </button>

          <img
            src={currentImageUrl}
            alt="Đã phóng to"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl ring-1 ring-white/20 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
