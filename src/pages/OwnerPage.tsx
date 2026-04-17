import { useState, useEffect } from 'react';
import { Upload, FolderOpen, Music, Image, CheckCircle2, Loader2, AlertCircle, FileAudio, FileImage, FileJson, BookOpen, Copy, Lock, Key, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRef } from 'react';

// ─── Section 1: Upload Audio & Ảnh ───────────────────────────────────────────

function UploadAudioSection() {
  const [session, setSession] = useState<string>('');
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setAudioFiles(Array.from(e.target.files));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setImageFiles(Array.from(e.target.files));
  };

  const validate = () => {
    if (!session || isNaN(Number(session)) || Number(session) <= 0) {
      toast.error('Vui lòng nhập số buổi học hợp lệ');
      return false;
    }
    if (audioFiles.length === 0 && imageFiles.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 file MP3 hoặc ảnh');
      return false;
    }
    return true;
  };

  const handleConfirmedUpload = async () => {
    setShowConfirm(false);
    setLoading(true);
    let successCount = 0;

    try {
      const allFilesList = [
        ...audioFiles.map(f => ({ type: 'audios', file: f })),
        ...imageFiles.map(f => ({ type: 'images', file: f }))
      ];

      const BATCH_SIZE = 8; // Giới hạn 8 file mỗi lượt tải để tránh quá tải 4.5MB Payload của Vercel (Lỗi 413 Payload Too Large)

      for (let i = 0; i < allFilesList.length; i += BATCH_SIZE) {
        const chunk = allFilesList.slice(i, i + BATCH_SIZE);
        const formData = new FormData();
        formData.append('session', session);
        chunk.forEach(item => {
          formData.append(item.type, item.file);
        });

        // Tuỳ chọn hiển thị tiến trình (tuỳ chọn thêm để biết dang upload tới đâu)
        if (allFilesList.length > BATCH_SIZE && i === 0) {
          toast.loading(`Đang upload: ${allFilesList.length} files, vui lòng đợi!`);
        }

        const res = await fetch('/api/upload', { method: 'POST', body: formData });

        let data;
        try {
          data = await res.json();
        } catch (e) {
          throw new Error('Dung lượng block file quá nặng, Vercel từ chối kết nối (Lỗi 413 Payload Too Large). Vui lòng chọn file nhẹ hơn.');
        }

        if (!res.ok || !data.success) throw new Error(data.message || `Lỗi tải lên ở file thứ ${i + 1}`);
        successCount += chunk.length;
      }

      toast.dismiss();
      toast.success(`Hoàn tất tải lên ${successCount} files cho buổi ${session}!`);
      setSession(''); setAudioFiles([]); setImageFiles([]);
      if (audioInputRef.current) audioInputRef.current.value = '';
      if (imageInputRef.current) imageInputRef.current.value = '';
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || 'Đã có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = session !== '' && !isNaN(Number(session)) && Number(session) > 0
    && (audioFiles.length > 0 || imageFiles.length > 0);

  return (
    <>
      <div className="flex flex-col gap-5">
        <Card className="border-border/40 shadow-sm bg-card/80 backdrop-blur-sm">
          <CardContent className="p-5">
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Buổi học <span className="text-red-500">*</span>
            </label>
            <Input
              id="upload-session-input"
              type="number" min={1}
              placeholder="VD: 11"
              value={session}
              onChange={(e) => setSession(e.target.value)}
              className="max-w-[200px] font-mono text-base"
            />
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm bg-card/80 backdrop-blur-sm">
          <CardContent className="p-5">
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              File MP3 <span className="text-muted-foreground font-normal">(nhiều file)</span>
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Chỉ <strong>.mp3</strong>.
            </p>
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20",
                audioFiles.length > 0 ? "border-indigo-400 bg-indigo-50/40 dark:bg-indigo-900/20" : "border-border/60"
              )}
              onClick={() => audioInputRef.current?.click()}
            >
              <Music className={cn("w-7 h-7 mx-auto mb-2", audioFiles.length > 0 ? "text-indigo-500" : "text-muted-foreground/40")} />
              {audioFiles.length > 0 ? (
                <div>
                  <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Đã chọn {audioFiles.length} file MP3</p>
                  <div className="max-h-24 overflow-y-auto mt-2 flex flex-col gap-0.5">
                    {audioFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground text-left px-2">
                        <FileAudio className="w-3 h-3 text-indigo-400 shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-muted-foreground">Nhấn để chọn các file MP3</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Hỗ trợ chọn nhiều file cùng lúc</p>
                </>
              )}
            </div>
            <input ref={audioInputRef} type="file" accept=".mp3,audio/mpeg" multiple className="hidden" onChange={handleAudioChange} />
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm bg-card/80 backdrop-blur-sm">
          <CardContent className="p-5">
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Ảnh minh hoạ <span className="text-muted-foreground font-normal">(nhiều file)</span>
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Mọi định dạng ảnh.
            </p>
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/20",
                imageFiles.length > 0 ? "border-purple-400 bg-purple-50/40 dark:bg-purple-900/20" : "border-border/60"
              )}
              onClick={() => imageInputRef.current?.click()}
            >
              <Image className={cn("w-7 h-7 mx-auto mb-2", imageFiles.length > 0 ? "text-purple-500" : "text-muted-foreground/40")} />
              {imageFiles.length > 0 ? (
                <div>
                  <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">Đã chọn {imageFiles.length} ảnh</p>
                  <div className="max-h-24 overflow-y-auto mt-2 flex flex-col gap-0.5">
                    {imageFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground text-left px-2">
                        <FileImage className="w-3 h-3 text-purple-400 shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-muted-foreground">Nhấn để chọn ảnh</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Hỗ trợ chọn nhiều ảnh cùng lúc</p>
                </>
              )}
            </div>
            <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
          </CardContent>
        </Card>

        {canSubmit && (
          <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 flex flex-col gap-1">
            <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Sẵn sàng tải lên
            </p>
            <p className="text-xs text-muted-foreground">
              {audioFiles.length > 0 && <><strong>{audioFiles.length}</strong> MP3 · </>}
              {imageFiles.length > 0 && <><strong>{imageFiles.length}</strong> ảnh</>}
              {' '}→ Buổi <strong>{session}</strong>
            </p>
          </div>
        )}

        <Button
          id="submit-upload-btn"
          size="lg"
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-xl shadow-indigo-500/20 hover:scale-[1.01] transition-all"
          onClick={() => { if (validate()) setShowConfirm(true); }}
          disabled={!canSubmit || loading}
        >
          {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Đang tải lên...</> : <><Upload className="w-5 h-5 mr-2" /> Tải lên Audio & Ảnh</>}
        </Button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-border/50 p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-3 mb-5">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Xác nhận tải lên?</h2>
              <div className="text-sm text-muted-foreground flex flex-col gap-1">
                <p className="mt-1">
                  {audioFiles.length > 0 && <><strong className="text-foreground">{audioFiles.length}</strong> MP3 · </>}
                  {imageFiles.length > 0 && <><strong className="text-foreground">{imageFiles.length}</strong> ảnh</>}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>Huỷ</Button>
              <Button id="confirm-upload-btn" className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white" onClick={handleConfirmedUpload}>Xác nhận</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Section 2: Script JSON bằng Textarea ────────────────────────────────────

const PROMPT_TEXT = `Vui lòng chuyển dữ liệu các câu hỏi sau thành một mảng JSON (Array) với cấu trúc như sau:
[  
 {
    "id": 1,
    "image": "1.png",
    "answers": [
      {
        "key": "A",
        "en": "English sentence",
        "vi": "Dịch nghĩa tiếng Việt"
      },
      {
        "key": "B",
        "en": "English sentence",
        "vi": "Dịch nghĩa tiếng Việt"
      }
    ],
    "correctAnswer": "A"
  }
]
Yêu cầu:
- Trả về CHỈ mảng JSON hợp lệ, không bao gồm code block markdown (không có \`\`\`json).
- \`image\` có format là "\${id}.png". 
- \`id\` được lấy từ câu số trong file tôi đẩy lên.

Dữ liệu:
Là file được tôi đẩy lên.
`;

const SAMPLE_JSON = `
[ 
  {
      "id": 1,
      "image": "1.png",
      "answers": [
        {
          "key": "A",
          "en": "The men are putting on headphones.",
          "vi": "Người đàn ông đang đeo tai nghe."
        },
        {
          "key": "B",
          "en": "The men are getting up from their chairs.",
          "vi": "Những người đàn ông đang đứng dậy từ ghế của họ."
        }
      ],
      "correctAnswer": "A"
  }
]
`;

function UploadScriptSection() {
  const [session, setSession] = useState<string>('');
  const [isDisplay, setIsDisplay] = useState<boolean>(true);
  const [jsonText, setJsonText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [preview, setPreview] = useState<{ itemCount: number; title?: string } | null>(null);
  const [parseError, setParseError] = useState<string>('');

  const handleJsonChange = (val: string) => {
    setJsonText(val);
    if (!val.trim()) {
      setPreview(null);
      setParseError('');
      return;
    }
    try {
      const parsed = JSON.parse(val);
      // Chấp nhận cả 2 dạng:
      // 1. Mảng items trực tiếp: [{id:1,...}, {id:2,...}]
      // 2. Object có items: { "items": [...] }
      let itemsArr: any[] | null = null;
      if (Array.isArray(parsed)) {
        itemsArr = parsed;
      } else if (parsed.items && Array.isArray(parsed.items)) {
        itemsArr = parsed.items;
      }

      // Xử lý khi mảng bị bọc bên trong mảng khác quá nhiều lần [[...]] (AI hay sinh nhầm)
      if (itemsArr) {
        while (itemsArr.length === 1 && Array.isArray(itemsArr[0])) {
          itemsArr = itemsArr[0];
        }
      }

      if (!itemsArr || itemsArr.length === 0) {
        setPreview(null);
        setParseError('Cần nhập mảng items [...] hoặc object có trường items');
      } else {
        setPreview({ itemCount: itemsArr.length });
        setParseError('');
      }
    } catch (e: any) {
      setPreview(null);
      setParseError('JSON không hợp lệ: ' + e.message);
    }
  };

  const validate = () => {
    if (!session || isNaN(Number(session)) || Number(session) <= 0) {
      toast.error('Vui lòng nhập số buổi học hợp lệ');
      return false;
    }
    if (!jsonText.trim()) {
      toast.error('Vui lòng nhập nội dung JSON');
      return false;
    }
    if (parseError || !preview) {
      toast.error('JSON không hợp lệ, hãy kiểm tra lại');
      return false;
    }
    return true;
  };

  const handleConfirmedUpload = async () => {
    setShowConfirm(false);
    setLoading(true);
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(jsonText);
      } catch (e: any) {
        throw new Error('JSON không parse được: ' + e.message);
      }

      // Lấy items dù input là array hay object
      const items = Array.isArray(parsed) ? parsed : parsed.items;

      const res = await fetch('/api/merge-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, items, is_display: isDisplay }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Lưu script thất bại');

      toast.success(data.message);
      setSession(''); setJsonText(''); setPreview(null); setParseError(''); setIsDisplay(true);
    } catch (err: any) {
      toast.error(err.message || 'Đã có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = session !== '' && !isNaN(Number(session)) && Number(session) > 0
    && jsonText.trim() !== '' && preview !== null && !parseError;

  const copyToClipboard = (text: string, title: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`Đã copy ${title}`);
    }).catch(() => {
      toast.error(`Không thể copy ${title}`);
    });
  };

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* Support Tools: Prompt & Sample */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border/40 shadow-sm bg-card/80 backdrop-blur-sm flex flex-col h-full">
            <CardContent className="p-4 flex flex-col h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <FileJson className="w-4 h-4" />
                  <span className="text-sm font-semibold">Prompt mẫu (cho AI) </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(PROMPT_TEXT, 'Prompt mẫu')}
                  className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors"
                  title="Copy Prompt"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 bg-muted/40 rounded-lg p-3 overflow-y-auto max-h-[150px] font-mono text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {PROMPT_TEXT}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-sm bg-card/80 backdrop-blur-sm flex flex-col h-full">
            <CardContent className="p-4 flex flex-col h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <BookOpen className="w-4 h-4" />
                  <span className="text-sm font-semibold">JSON Mẫu</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(SAMPLE_JSON, 'JSON Mẫu')}
                  className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors"
                  title="Copy JSON Mẫu"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 bg-muted/40 rounded-lg p-3 overflow-y-auto max-h-[150px] font-mono text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {SAMPLE_JSON}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/40 shadow-sm bg-card/80 backdrop-blur-sm">
          <CardContent className="p-5">
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Buổi học <span className="text-red-500">*</span>
            </label>
            <Input
              id="script-session-input"
              type="number" min={1}
              placeholder="VD: 11"
              value={session}
              onChange={(e) => setSession(e.target.value)}
              className="max-w-[200px] font-mono text-base"
            />
          </CardContent>
        </Card>

        {/* is_display toggle */}
        <Card className="border-border/40 shadow-sm bg-card/80 backdrop-blur-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Hiển thị script cho bài nghe</p>
                <p className="text-xs text-muted-foreground mt-0.5">Bật để hiện thị script cho bài nghe trong buổi này</p>
              </div>
              <button
                id="is-display-toggle"
                type="button"
                onClick={() => setIsDisplay(v => !v)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
                  isDisplay ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                    isDisplay ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm bg-card/80 backdrop-blur-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-foreground">
                Nội dung JSON Script
              </label>
              {jsonText.trim() !== '' && (
                preview ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> {preview.itemCount} câu hỏi
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                    ⚠️ JSON lỗi
                  </span>
                )
              )}
            </div>

            <p className="text-xs text-muted-foreground mb-3">
              Dán list câu hỏi <code className="bg-muted px-1 rounded text-emerald-600">{'[...]'}</code>
            </p>
            <textarea
              id="script-json-textarea"
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
              placeholder={'[\n  {\n    "id": 1,\n    "image": "1.png",\n    "answers": [\n      { "key": "A", "en": "...", "vi": "..." },\n      { "key": "B", "en": "...", "vi": "..." }\n    ],\n    "correctAnswer": "A"\n  }\n]'}
              spellCheck={false}
              className={cn(
                'w-full h-72 font-mono text-xs rounded-xl border p-3 resize-y bg-muted/30 dark:bg-gray-900/50 focus:outline-none focus:ring-2 transition-all',
                parseError && jsonText.trim()
                  ? 'border-red-400 focus:ring-red-400/30'
                  : preview
                    ? 'border-emerald-400 focus:ring-emerald-400/30'
                    : 'border-border/60 focus:ring-indigo-400/30'
              )}
            />
            {parseError && jsonText.trim() && (
              <p className="text-xs text-red-500 mt-2 font-mono">{parseError}</p>
            )}
          </CardContent>
        </Card>

        {canSubmit && (
          <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/30 p-4 flex flex-col gap-1">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Sẵn sàng lưu script
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>{preview?.itemCount}</strong> câu hỏi.
            </p>
          </div>
        )}

        <Button
          id="submit-script-btn"
          size="lg"
          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-xl shadow-emerald-500/20 hover:scale-[1.01] transition-all"
          onClick={() => { if (validate()) setShowConfirm(true); }}
          disabled={!canSubmit || loading}
        >
          {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Đang lưu script...</> : <><BookOpen className="w-5 h-5 mr-2" /> Lưu Script JSON</>}
        </Button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-border/50 p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-3 mb-5">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <FileJson className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Xác nhận lưu script?</h2>
              <div className="text-sm text-muted-foreground flex flex-col gap-1">
                <p className="mt-1">
                  <strong className="text-foreground">{preview?.itemCount}</strong> câu hỏi — Buổi <strong className="text-foreground">{session}</strong>
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  ⚠️ Nếu B{session}.json đã tồn tại, nó sẽ bị ghi đè.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>Huỷ</Button>
              <Button id="confirm-script-btn" className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white" onClick={handleConfirmedUpload}>Xác nhận</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Section 3: Danh sách Lessons ───────────────────────────────────────────

type LessonMeta = {
  lessonId: number;
  title: string;
  is_display: boolean;
  itemCount: number;
  hasScript?: boolean;
  hasAudio?: boolean;
  hasImage?: boolean;
};

function LessonsListSection() {
  const [lessons, setLessons] = useState<LessonMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  // Pending confirm: lesson đang chờ xác nhận toggle
  const [confirmLesson, setConfirmLesson] = useState<LessonMeta | null>(null);
  const [confirmDeleteLesson, setConfirmDeleteLesson] = useState<LessonMeta | null>(null);
  const [deleteOptions, setDeleteOptions] = useState({ script: true, audio: true, image: true });

  const fetchLessons = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lessons');
      const data = await res.json();
      if (data.success) setLessons(data.lessons);
    } catch {
      toast.error('Không thể tải danh sách lessons');
    } finally {
      setLoading(false);
    }
  };

  // Bước 1: Hiện confirm
  const requestToggle = (lesson: LessonMeta) => {
    setConfirmLesson(lesson);
  };

  const requestDelete = (lesson: LessonMeta) => {
    setDeleteOptions({
      script: !!lesson.hasScript,
      audio: !!lesson.hasAudio,
      image: !!lesson.hasImage
    });
    setConfirmDeleteLesson(lesson);
  };

  // Bước 2: Người dùng xác nhận → mới gọi API
  const handleConfirmedToggle = async () => {
    if (!confirmLesson) return;
    const { lessonId, is_display } = confirmLesson;
    setConfirmLesson(null);
    setToggling(lessonId);
    try {
      const res = await fetch(`/api/lessons/${lessonId}/display`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_display: !is_display }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setLessons(prev => prev.map(l =>
        l.lessonId === lessonId ? { ...l, is_display: !is_display } : l
      ));
      toast.success(`Buổi ${lessonId}: ${!is_display ? 'Đã bật hiển thị' : 'Đã tắt hiển thị'}`);
    } catch (err: any) {
      toast.error(err.message || 'Cập nhật thất bại');
    } finally {
      setToggling(null);
    }
  };

  const handleConfirmedDelete = async () => {
    if (!confirmDeleteLesson) return;
    const { lessonId } = confirmDeleteLesson;

    const types = [];
    if (deleteOptions.script) types.push('script');
    if (deleteOptions.audio) types.push('audio');
    if (deleteOptions.image) types.push('image');

    if (types.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 loại dữ liệu để xóa');
      return;
    }

    setConfirmDeleteLesson(null);
    setDeleting(lessonId);
    try {
      const res = await fetch(`/api/lessons/${lessonId}?types=${types.join(',')}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      // Load lại để cập nhật state các thành phần có tồn tại
      await fetchLessons();
      toast.success(data.message);
    } catch (err: any) {
      toast.error(err.message || 'Xóa thất bại');
    } finally {
      setDeleting(null);
    }
  };

  // Auto-fetch khi mount
  useEffect(() => { fetchLessons(); }, []);

  const displayed = lessons.filter(l => l.is_display).length;
  const hidden = lessons.length - displayed;

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Stats + Refresh */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {displayed} đang hiển thị
            </span>
            {hidden > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-muted-foreground px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                {hidden} đã ẩn
              </span>
            )}
          </div>
          <button
            onClick={fetchLessons}
            disabled={loading}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <Loader2 className={cn('w-3 h-3', loading ? 'animate-spin' : 'opacity-0 pointer-events-none')} />
            Làm mới
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Đang tải...
          </div>
        ) : lessons.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Chưa có lesson nào trong script.json
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {lessons.map(lesson => (
              <Card
                key={lesson.lessonId}
                className={cn(
                  'border-border/40 shadow-sm transition-all',
                  lesson.is_display
                    ? 'bg-card/80'
                    : 'bg-muted/30 opacity-60'
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Lesson number badge */}
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0',
                      lesson.is_display
                        ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-muted-foreground'
                    )}>
                      {lesson.lessonId}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{lesson.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {lesson.hasScript ? `${lesson.itemCount} câu hỏi · ` : 'Trống script · '}
                        {lesson.is_display ? (
                          <span className="text-emerald-600 dark:text-emerald-400">Đang hiển thị</span>
                        ) : (
                          <span className="text-gray-400">Đã ẩn</span>
                        )}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {lesson.hasScript && <span className="inline-flex items-center text-[10px] bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded uppercase font-semibold">Script</span>}
                        {lesson.hasAudio && <span className="inline-flex items-center text-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-1.5 py-0.5 rounded uppercase font-semibold">Audio</span>}
                        {lesson.hasImage && <span className="inline-flex items-center text-[10px] bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded uppercase font-semibold">Ảnh</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        id={`toggle-lesson-${lesson.lessonId}`}
                        type="button"
                        disabled={toggling === lesson.lessonId || deleting === lesson.lessonId}
                        onClick={() => requestToggle(lesson)}
                        className={cn(
                          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0',
                          toggling === lesson.lessonId || deleting === lesson.lessonId ? 'opacity-50 cursor-not-allowed' : '',
                          lesson.is_display ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                        )}
                      >
                        {toggling === lesson.lessonId ? (
                          <Loader2 className="w-3 h-3 text-white animate-spin mx-auto" />
                        ) : (
                          <span className={cn(
                            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                            lesson.is_display ? 'translate-x-6' : 'translate-x-1'
                          )} />
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={toggling === lesson.lessonId || deleting === lesson.lessonId}
                        onClick={() => requestDelete(lesson)}
                        className={cn(
                          'p-1.5 rounded-md transition-colors',
                          deleting === lesson.lessonId ? 'opacity-50 cursor-not-allowed text-red-300' : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'
                        )}
                        title="Xóa buổi học này"
                      >
                        {deleting === lesson.lessonId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Confirm dialog overlay */}
      {confirmLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3 mb-4">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                confirmLesson.is_display
                  ? 'bg-amber-100 dark:bg-amber-900/40'
                  : 'bg-emerald-100 dark:bg-emerald-900/40'
              )}>
                <AlertCircle className={cn(
                  'w-5 h-5',
                  confirmLesson.is_display ? 'text-amber-600' : 'text-emerald-600'
                )} />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">
                  {confirmLesson.is_display ? 'Ẩn buổi học?' : 'Hiển thị buổi học?'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium text-foreground">Script {confirmLesson.title}</span>
                  {confirmLesson.is_display
                    ? ' sẽ không hiển thị trong danh sách học.'
                    : ' sẽ xuất hiện trong danh sách học.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmLesson(null)}
              >
                Huỷ
              </Button>
              <Button
                id="confirm-toggle-display-btn"
                className={cn(
                  'flex-1 text-white',
                  confirmLesson.is_display
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                )}
                onClick={handleConfirmedToggle}
              >
                {confirmLesson.is_display ? 'Xác nhận ẩn' : 'Xác nhận hiện'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm DELETE dialog overlay */}
      {confirmDeleteLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-red-100 dark:bg-red-900/40">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">
                  Xóa dữ liệu buổi học?
                </p>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  Chọn các dữ liệu của <span className="font-medium text-foreground">{confirmDeleteLesson.title}</span> mà bạn muốn xóa.
                </p>

                <div className="flex flex-col gap-2 mt-3">
                  <label className={cn("flex items-center gap-2 text-sm", !confirmDeleteLesson.hasScript ? "opacity-50" : "cursor-pointer")}>
                    <input type="checkbox" checked={deleteOptions.script} disabled={!confirmDeleteLesson.hasScript} onChange={e => setDeleteOptions(prev => ({ ...prev, script: e.target.checked }))} className="rounded accent-red-500 w-4 h-4 cursor-pointer" />
                    Xóa Script JSON {confirmDeleteLesson.hasScript && <span className="text-muted-foreground text-xs">({confirmDeleteLesson.itemCount} câu hỏi)</span>}
                  </label>

                  <label className={cn("flex items-center gap-2 text-sm", !confirmDeleteLesson.hasAudio ? "opacity-50" : "cursor-pointer")}>
                    <input type="checkbox" checked={deleteOptions.audio} disabled={!confirmDeleteLesson.hasAudio} onChange={e => setDeleteOptions(prev => ({ ...prev, audio: e.target.checked }))} className="rounded accent-red-500 w-4 h-4 cursor-pointer" />
                    Xóa thư mục Audio MP3
                  </label>

                  <label className={cn("flex items-center gap-2 text-sm", !confirmDeleteLesson.hasImage ? "opacity-50" : "cursor-pointer")}>
                    <input type="checkbox" checked={deleteOptions.image} disabled={!confirmDeleteLesson.hasImage} onChange={e => setDeleteOptions(prev => ({ ...prev, image: e.target.checked }))} className="rounded accent-red-500 w-4 h-4 cursor-pointer" />
                    Xóa thư mục Ảnh minh họa
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmDeleteLesson(null)}
              >
                Huỷ
              </Button>
              <Button
                id="confirm-delete-btn"
                className="flex-1 text-white bg-red-600 hover:bg-red-700"
                onClick={handleConfirmedDelete}
              >
                Xác nhận
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'audio' | 'script' | 'lessons';

export function OwnerPage() {
  const [activeTab, setActiveTab] = useState<Tab>('audio');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [loginError, setLoginError] = useState('');

  // Tùy chọn: tự động theo dõi nếu cookie hết hạn mà đang ở trong tab thì văng ra ngoài
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/verify');
        const data = await res.json();
        setIsAuthenticated(!!data.authenticated);
      } catch (err) {
        setIsAuthenticated(false);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    checkAuth();

    const interval = setInterval(() => {
      checkAuth();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const passwordInput = formData.get('password') as string;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setLoginError('');
      } else {
        setLoginError('Mật khẩu không chính xác!');
      }
    } catch (err) {
      setLoginError('Lỗi kết nối tới máy chủ');
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <Card className="w-full max-w-sm shadow-xl border-border/40 bg-card/80 backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-sm">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Xác thực Owner</h2>
              <p className="text-xs text-muted-foreground mt-1 text-center">Vui lòng nhập mật khẩu để truy cập</p>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="space-y-2">
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    name="password"
                    placeholder="Nhập mật khẩu..."
                    className="pl-9 h-10"
                    autoFocus
                  />
                </div>
                {loginError && <p className="text-xs text-red-500 font-medium ml-1">{loginError}</p>}
              </div>

              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all h-10">
                Đăng nhập
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <FolderOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Quản lý Audio</h1>
              <p className="text-sm text-muted-foreground">Tải lên file MP3, ảnh minh hoạ và script JSON cho từng buổi học</p>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-indigo-200 via-purple-200 to-transparent dark:from-indigo-800 dark:via-purple-800 mt-4" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl mb-6">
          <button
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all',
              activeTab === 'audio'
                ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-700 dark:text-indigo-300'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setActiveTab('audio')}
          >
            <Music className="w-4 h-4" />
            Audio & Ảnh
          </button>
          <button
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all',
              activeTab === 'script'
                ? 'bg-white dark:bg-gray-800 shadow-sm text-emerald-700 dark:text-emerald-300'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setActiveTab('script')}
          >
            <FileJson className="w-4 h-4" />
            Script JSON
          </button>
          <button
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all',
              activeTab === 'lessons'
                ? 'bg-white dark:bg-gray-800 shadow-sm text-violet-700 dark:text-violet-300'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setActiveTab('lessons')}
          >
            <BookOpen className="w-4 h-4" />
            Danh sách
          </button>
        </div>

        {activeTab === 'audio' && <UploadAudioSection />}
        {activeTab === 'script' && <UploadScriptSection />}
        {activeTab === 'lessons' && <LessonsListSection />}
      </div>
    </div>
  );
}
