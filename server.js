import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(express.json());

// Dynamic storage: route file to correct folder based on fieldname & session
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const session = req.body.session || req.query.session;

    if (!session || isNaN(Number(session))) {
      return cb(new Error('Số buổi học không hợp lệ'), '');
    }

    let destDir;
    if (file.fieldname === 'images') {
      destDir = path.join(__dirname, 'src', 'assets', `B${session}`);
    } else if (file.fieldname === 'audios') {
      destDir = path.join(__dirname, 'src', 'utils', 'audio', `Audio Buổi ${session}`);
    } else {
      return cb(new Error('Field không hợp lệ: ' + file.fieldname), '');
    }

    fs.mkdirSync(destDir, { recursive: true });
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    // Giữ nguyên tên file gốc, decode URI nếu cần
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, originalName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'audios') {
      if (!file.mimetype.includes('audio') && !file.originalname.endsWith('.mp3')) {
        return cb(new Error('Chỉ chấp nhận file MP3'));
      }
    }
    if (file.fieldname === 'images') {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Chỉ chấp nhận file ảnh'));
      }
    }
    cb(null, true);
  },
});

// Upload endpoint - nhận cả audios và images cùng lúc
app.post('/api/upload', (req, res) => {
  // multer cần đọc body trước để biết session, nhưng multer.fields sẽ parse body
  const uploadFields = upload.fields([
    { name: 'audios', maxCount: 200 },
    { name: 'images', maxCount: 200 },
  ]);

  uploadFields(req, res, (err) => {
    if (err) {
      console.error('[Upload Error]', err.message);
      return res.status(400).json({ success: false, message: err.message });
    }

    const session = req.body.session;
    const audios = req.files['audios'] || [];
    const images = req.files['images'] || [];

    console.log(`[Upload] Buổi ${session}: ${audios.length} MP3, ${images.length} ảnh`);

    res.json({
      success: true,
      message: `Tải lên thành công! ${audios.length} file MP3 vào "Audio Buổi ${session}", ${images.length} ảnh vào "B${session}"`,
      audios: audios.map(f => f.filename),
      images: images.map(f => f.filename),
    });
  });
});

// Merge script JSON endpoint
// Nhận { session, items: [...] } - items là mảng câu hỏi
// Tự tạo lesson object và append/update vào script.json (JSON array)
app.post('/api/merge-script', (req, res) => {
  const { session, items, is_display } = req.body;

  if (!session || isNaN(Number(session)) || Number(session) <= 0) {
    return res.status(400).json({ success: false, message: 'Số buổi học không hợp lệ' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: '"items" phải là mảng không rỗng' });
  }

  // Tự đóng gói thành lesson object
  const newLesson = {
    lessonId: Number(session),
    title: `Audio buổi ${session}`,
    is_display: is_display !== undefined ? Boolean(is_display) : true,
    items,
  };

  const scriptFile = path.join(__dirname, 'src', 'utils', 'audio', 'script', 'script.json');

  // Đọc file hiện tại
  let lessons = [];
  try {
    const raw = fs.readFileSync(scriptFile, 'utf8');
    const parsed = JSON.parse(raw);
    lessons = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    lessons = [];
  }

  // Kiểm tra xem lessonId đã tồn tại chưa → ghi đè hoặc append
  const existingIdx = lessons.findIndex(l => l.lessonId === newLesson.lessonId);
  const isUpdate = existingIdx >= 0;
  if (isUpdate) {
    lessons[existingIdx] = newLesson;
    console.log(`[Script] Ghi đè lesson ${session} trong script.json`);
  } else {
    lessons.push(newLesson);
    lessons.sort((a, b) => a.lessonId - b.lessonId);
    console.log(`[Script] Thêm lesson ${session} vào script.json (tổng: ${lessons.length} buổi)`);
  }

  fs.writeFileSync(scriptFile, JSON.stringify(lessons, null, 2), 'utf8');

  res.json({
    success: true,
    message: isUpdate
      ? `Đã cập nhật buổi ${session} (${items.length} câu hỏi) trong script.json`
      : `Đã thêm buổi ${session} (${items.length} câu hỏi) — script.json có ${lessons.length} buổi`,
    lessonId: newLesson.lessonId,
    title: newLesson.title,
    itemCount: items.length,
    totalLessons: lessons.length,
  });
});

// Helper đọc script.json
const readScriptFile = () => {
  const scriptFile = path.join(__dirname, 'src', 'utils', 'audio', 'script', 'script.json');
  try {
    const raw = fs.readFileSync(scriptFile, 'utf8');
    const parsed = JSON.parse(raw);
    return { lessons: Array.isArray(parsed) ? parsed : [parsed], scriptFile };
  } catch {
    return { lessons: [], scriptFile };
  }
};

// GET /api/lessons - trả về danh sách lessons
app.get('/api/lessons', (req, res) => {
  const { lessons } = readScriptFile();
  const lessonIds = new Set(lessons.map(l => l.lessonId));

  const audioBase = path.join(__dirname, 'src', 'utils', 'audio');
  if (fs.existsSync(audioBase)) {
    const folders = fs.readdirSync(audioBase);
    folders.forEach(f => {
      const match = f.match(/^Audio Buổi (\d+)$/);
      if (match) lessonIds.add(Number(match[1]));
    });
  }

  const imageBase = path.join(__dirname, 'src', 'assets');
  if (fs.existsSync(imageBase)) {
    const folders = fs.readdirSync(imageBase);
    folders.forEach(f => {
      const match = f.match(/^B(\d+)$/);
      if (match) lessonIds.add(Number(match[1]));
    });
  }

  const list = Array.from(lessonIds).sort((a, b) => a - b).map(id => {
    const scriptLesson = lessons.find(l => l.lessonId === id);
    const hasScript = !!scriptLesson;
    const hasAudio = fs.existsSync(path.join(audioBase, `Audio Buổi ${id}`));
    const hasImage = fs.existsSync(path.join(imageBase, `B${id}`));

    return {
      lessonId: id,
      title: scriptLesson ? scriptLesson.title : `Buổi ${id}`,
      is_display: scriptLesson && scriptLesson.is_display !== undefined ? scriptLesson.is_display : true,
      itemCount: scriptLesson && Array.isArray(scriptLesson.items) ? scriptLesson.items.length : 0,
      hasScript,
      hasAudio,
      hasImage
    };
  });

  res.json({ success: true, lessons: list });
});

// PATCH /api/lessons/:lessonId/display - cập nhật is_display
app.patch('/api/lessons/:lessonId/display', (req, res) => {
  const lessonId = Number(req.params.lessonId);
  const { is_display } = req.body;

  if (isNaN(lessonId)) {
    return res.status(400).json({ success: false, message: 'lessonId không hợp lệ' });
  }
  if (typeof is_display !== 'boolean') {
    return res.status(400).json({ success: false, message: 'is_display phải là boolean' });
  }

  const { lessons, scriptFile } = readScriptFile();
  const idx = lessons.findIndex(l => l.lessonId === lessonId);
  if (idx < 0) {
    return res.status(404).json({ success: false, message: `Không tìm thấy buổi ${lessonId} trong script` });
  }

  lessons[idx].is_display = is_display;
  fs.writeFileSync(scriptFile, JSON.stringify(lessons, null, 2), 'utf8');

  console.log(`[Lessons] Buổi ${lessonId} is_display → ${is_display}`);
  res.json({ success: true, lessonId, is_display });
});

// DELETE /api/lessons/:lessonId - xóa script, audio, image của buổi học
app.delete('/api/lessons/:lessonId', (req, res) => {
  const lessonId = Number(req.params.lessonId);
  if (isNaN(lessonId)) {
    return res.status(400).json({ success: false, message: 'lessonId không hợp lệ' });
  }

  const types = req.query.types ? req.query.types.split(',') : ['script', 'audio', 'image'];
  let deletedItems = [];

  if (types.includes('script')) {
    const { lessons, scriptFile } = readScriptFile();
    const idx = lessons.findIndex(l => l.lessonId === lessonId);
    if (idx >= 0) {
      lessons.splice(idx, 1);
      fs.writeFileSync(scriptFile, JSON.stringify(lessons, null, 2), 'utf8');
      console.log(`[Lessons] Đã xóa buổi ${lessonId} khỏi script.json`);
      deletedItems.push('Script');
    }
  }

  if (types.includes('audio')) {
    const audioDir = path.join(__dirname, 'src', 'utils', 'audio', `Audio Buổi ${lessonId}`);
    if (fs.existsSync(audioDir)) {
      fs.rmSync(audioDir, { recursive: true, force: true });
      console.log(`[Lessons] Đã xóa thư mục ${audioDir}`);
      deletedItems.push('Audio');
    }
  }

  if (types.includes('image')) {
    const imageDir = path.join(__dirname, 'src', 'assets', `B${lessonId}`);
    if (fs.existsSync(imageDir)) {
      fs.rmSync(imageDir, { recursive: true, force: true });
      console.log(`[Lessons] Đã xóa thư mục ${imageDir}`);
      deletedItems.push('Ảnh');
    }
  }

  if (deletedItems.length === 0) {
    return res.json({ success: true, message: `Không có dữ liệu nào được xóa cho buổi ${lessonId}` });
  }

  res.json({ success: true, message: `Đã xóa ${deletedItems.join(', ')} buổi ${lessonId} thành công` });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), VITE_PASS: process.env.VITE_PASS, VITE_AUTH_TTL: process.env.VITE_AUTH_TTL });
});

// Auth endpoints (HttpOnly Cookie + Secure Token)
let activeAuthToken = null;
let authTokenExpires = 0;

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  try {
    // Lấy password từ biến môi trường VITE_PASS (hỗ trợ nhiều mật khẩu cách nhau bằng dấu phẩy)
    const envPass = process.env.VITE_PASS || '';
    const allowedPasswords = envPass.split(',').map(p => p.trim()).filter(Boolean);
    
    console.log('[DEBUG Auth]', { received: password, allowed: allowedPasswords });

    if (allowedPasswords.length === 0) {
      console.error('[Auth Error] VITE_PASS chưa được cấu hình trong file .env');
      return res.status(500).json({ success: false, message: 'Lỗi cấu hình máy chủ' });
    }

    if (allowedPasswords.includes(password)) {
      // Lấy thời gian sống (TTL) của cookie từ env, tính bằng giây. Mặc định 180s = 3 phút
      const ttlSeconds = parseInt(process.env.VITE_AUTH_TTL, 10) || 180;

      // Tạo token ngẫu nhiên độ dài 64 ký tự hex (không thể đoán mò)
      activeAuthToken = crypto.randomBytes(32).toString('hex');
      authTokenExpires = Date.now() + (ttlSeconds * 1000);

      res.setHeader('Set-Cookie', `fc_owner_auth=${activeAuthToken}; HttpOnly; Max-Age=${ttlSeconds}; Path=/; SameSite=Strict`);
      return res.json({ success: true });
    }
  } catch (err) {
    console.error('[Auth Error]', err);
  }
  res.status(401).json({ success: false, message: 'Mật khẩu không chính xác' });
});

app.get('/api/auth/verify', (req, res) => {
  const cookieStr = req.headers.cookie || '';
  // Đọc giá trị token từ cookie do frontend gửi lên
  const match = cookieStr.match(/fc_owner_auth=([^;]+)/);
  const token = match ? match[1] : null;

  // Đối chiếu token trong request có khớp bằng token đang lưu giữ ở Backend hay không
  if (token && activeAuthToken && token === activeAuthToken && Date.now() < authTokenExpires) {
    return res.json({ success: true, authenticated: true });
  }

  // Tránh việc giữ token cũ cặn ở RAM, nếu verify sai ta clear luôn
  return res.json({ success: true, authenticated: false });
});

app.listen(PORT, () => {
  console.log(`[Server] API chạy tại http://localhost:${PORT}`);
});

