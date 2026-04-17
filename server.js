import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { commitChanges, readFile, getRepoPaths } from './github-api.js';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(express.json());

// ─── Multer: lưu file vào RAM (không cần ổ cứng) ────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
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

// ─── Upload endpoint ─────────────────────────────────────────────────────────

app.post('/api/upload', (req, res) => {
  const uploadFields = upload.fields([
    { name: 'audios', maxCount: 200 },
    { name: 'images', maxCount: 200 },
  ]);

  uploadFields(req, res, async (err) => {
    if (err) {
      console.error('[Upload Error]', err.message);
      return res.status(400).json({ success: false, message: err.message });
    }

    const session = req.body.session;
    if (!session || isNaN(Number(session))) {
      return res.status(400).json({ success: false, message: 'Số buổi học không hợp lệ' });
    }

    const audios = req.files['audios'] || [];
    const images = req.files['images'] || [];

    if (audios.length === 0 && images.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có file nào được chọn' });
    }

    // Chuyển từng file thành entry cho GitHub commit
    const filesToCommit = [];

    for (const file of audios) {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      filesToCommit.push({
        path: `src/utils/audio/Audio Buổi ${session}/${originalName}`,
        content: file.buffer,
        encoding: 'base64',
      });
    }

    for (const file of images) {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      filesToCommit.push({
        path: `src/assets/B${session}/${originalName}`,
        content: file.buffer,
        encoding: 'base64',
      });
    }

    try {
      await commitChanges({
        filesToAdd: filesToCommit,
        message: `[Upload] Buổi ${session}: ${audios.length} MP3, ${images.length} ảnh`,
      });

      console.log(`[Upload] Buổi ${session}: ${audios.length} MP3, ${images.length} ảnh → GitHub`);

      res.json({
        success: true,
        message: `Tải lên thành công! ${audios.length} file MP3, ${images.length} ảnh cho Buổi ${session}`,
        audios: audios.map(f => Buffer.from(f.originalname, 'latin1').toString('utf8')),
        images: images.map(f => Buffer.from(f.originalname, 'latin1').toString('utf8')),
      });
    } catch (error) {
      console.error('[Upload Error]', error);
      res.status(500).json({ success: false, message: 'Lỗi đẩy file lên GitHub: ' + error.message });
    }
  });
});

// ─── Helper đọc script.json từ GitHub ────────────────────────────────────────

async function readScriptFromGitHub() {
  const result = await readFile('src/utils/audio/script/script.json');
  if (!result) return { lessons: [] };
  try {
    const parsed = JSON.parse(result.content);
    return { lessons: Array.isArray(parsed) ? parsed : [parsed] };
  } catch {
    return { lessons: [] };
  }
}

// ─── Merge script JSON endpoint ──────────────────────────────────────────────

app.post('/api/merge-script', async (req, res) => {
  const { session, items, is_display } = req.body;

  if (!session || isNaN(Number(session)) || Number(session) <= 0) {
    return res.status(400).json({ success: false, message: 'Số buổi học không hợp lệ' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: '"items" phải là mảng không rỗng' });
  }

  const newLesson = {
    lessonId: Number(session),
    title: `Audio buổi ${session}`,
    is_display: is_display !== undefined ? Boolean(is_display) : true,
    items,
  };

  try {
    const { lessons } = await readScriptFromGitHub();

    const existingIdx = lessons.findIndex(l => l.lessonId === newLesson.lessonId);
    const isUpdate = existingIdx >= 0;
    if (isUpdate) {
      lessons[existingIdx] = newLesson;
    } else {
      lessons.push(newLesson);
      lessons.sort((a, b) => a.lessonId - b.lessonId);
    }

    await commitChanges({
      filesToAdd: [{
        path: 'src/utils/audio/script/script.json',
        content: JSON.stringify(lessons, null, 2),
        encoding: 'utf-8',
      }],
      message: `[Script] ${isUpdate ? 'Cập nhật' : 'Thêm'} buổi ${session} (${items.length} câu hỏi)`,
    });

    console.log(`[Script] ${isUpdate ? 'Đã cập nhật' : 'Đã thêm'} buổi ${session} → GitHub`);

    res.json({
      success: true,
      message: isUpdate
        ? `Đã cập nhật buổi ${session} (${items.length} câu hỏi)`
        : `Đã thêm buổi ${session} (${items.length} câu hỏi) — tổng ${lessons.length} buổi`,
      lessonId: newLesson.lessonId,
      title: newLesson.title,
      itemCount: items.length,
      totalLessons: lessons.length,
    });
  } catch (error) {
    console.error('[Merge Script Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/lessons ────────────────────────────────────────────────────────

app.get('/api/lessons', async (req, res) => {
  try {
    const { lessons } = await readScriptFromGitHub();
    const repoPaths = await getRepoPaths();

    const lessonIds = new Set(lessons.map(l => l.lessonId));

    // Quét tree để tìm thư mục Audio và Image
    for (const p of repoPaths) {
      const audioMatch = p.match(/^src\/utils\/audio\/Audio Buổi (\d+)\//);
      if (audioMatch) lessonIds.add(Number(audioMatch[1]));

      const imageMatch = p.match(/^src\/assets\/B(\d+)\//);
      if (imageMatch) lessonIds.add(Number(imageMatch[1]));
    }

    const list = Array.from(lessonIds).sort((a, b) => a - b).map(id => {
      const scriptLesson = lessons.find(l => l.lessonId === id);
      const hasAudio = [...repoPaths].some(p => p.startsWith(`src/utils/audio/Audio Buổi ${id}/`));
      const hasImage = [...repoPaths].some(p => p.startsWith(`src/assets/B${id}/`));

      return {
        lessonId: id,
        title: scriptLesson ? scriptLesson.title : `Buổi ${id}`,
        is_display: scriptLesson?.is_display !== undefined ? scriptLesson.is_display : true,
        itemCount: scriptLesson?.items?.length || 0,
        hasScript: !!scriptLesson,
        hasAudio,
        hasImage,
      };
    });

    res.json({ success: true, lessons: list });
  } catch (error) {
    console.error('[Lessons Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PATCH /api/lessons/:lessonId/display ────────────────────────────────────

app.patch('/api/lessons/:lessonId/display', async (req, res) => {
  const lessonId = Number(req.params.lessonId);
  const { is_display } = req.body;

  if (isNaN(lessonId)) {
    return res.status(400).json({ success: false, message: 'lessonId không hợp lệ' });
  }
  if (typeof is_display !== 'boolean') {
    return res.status(400).json({ success: false, message: 'is_display phải là boolean' });
  }

  try {
    const { lessons } = await readScriptFromGitHub();
    const idx = lessons.findIndex(l => l.lessonId === lessonId);
    if (idx < 0) {
      return res.status(404).json({ success: false, message: `Không tìm thấy buổi ${lessonId} trong script` });
    }

    lessons[idx].is_display = is_display;

    await commitChanges({
      filesToAdd: [{
        path: 'src/utils/audio/script/script.json',
        content: JSON.stringify(lessons, null, 2),
        encoding: 'utf-8',
      }],
      message: `[Lessons] Buổi ${lessonId} → ${is_display ? 'hiển thị' : 'ẩn'}`,
    });

    console.log(`[Lessons] Buổi ${lessonId} is_display → ${is_display}`);
    res.json({ success: true, lessonId, is_display });
  } catch (error) {
    console.error('[Display Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── DELETE /api/lessons/:lessonId ───────────────────────────────────────────

app.delete('/api/lessons/:lessonId', async (req, res) => {
  const lessonId = Number(req.params.lessonId);
  if (isNaN(lessonId)) {
    return res.status(400).json({ success: false, message: 'lessonId không hợp lệ' });
  }

  const types = req.query.types ? req.query.types.split(',') : ['script', 'audio', 'image'];

  try {
    const pathsToDelete = [];
    const filesToAdd = [];
    const deletedItems = [];

    if (types.includes('audio')) {
      pathsToDelete.push(`src/utils/audio/Audio Buổi ${lessonId}`);
      deletedItems.push('Audio');
    }

    if (types.includes('image')) {
      pathsToDelete.push(`src/assets/B${lessonId}`);
      deletedItems.push('Ảnh');
    }

    if (types.includes('script')) {
      const { lessons } = await readScriptFromGitHub();
      const idx = lessons.findIndex(l => l.lessonId === lessonId);
      if (idx >= 0) {
        lessons.splice(idx, 1);
        filesToAdd.push({
          path: 'src/utils/audio/script/script.json',
          content: JSON.stringify(lessons, null, 2),
          encoding: 'utf-8',
        });
        deletedItems.push('Script');
      }
    }

    if (deletedItems.length === 0) {
      return res.json({ success: true, message: `Không có dữ liệu nào được xóa cho buổi ${lessonId}` });
    }

    await commitChanges({
      filesToAdd: filesToAdd.length > 0 ? filesToAdd : undefined,
      pathsToDelete: pathsToDelete.length > 0 ? pathsToDelete : undefined,
      message: `[Delete] Xóa ${deletedItems.join(', ')} buổi ${lessonId}`,
    });

    console.log(`[Delete] Xóa ${deletedItems.join(', ')} buổi ${lessonId} → GitHub`);
    res.json({ success: true, message: `Đã xóa ${deletedItems.join(', ')} buổi ${lessonId} thành công` });
  } catch (error) {
    console.error('[Delete Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Health check ────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─── Auth endpoints (giữ nguyên logic cũ nhưng đổi sang Stateless) ───────────

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  try {
    // Lấy password từ biến môi trường VITE_PASS (hỗ trợ nhiều mật khẩu cách nhau bằng dấu phẩy)
    const envPass = process.env.VITE_PASS || '';
    const allowedPasswords = envPass.split(',').map(p => p.trim()).filter(Boolean);

    if (allowedPasswords.length === 0) {
      console.error('[Auth Error] VITE_PASS chưa được cấu hình trong file .env');
      return res.status(500).json({ success: false, message: 'Lỗi cấu hình máy chủ' });
    }

    if (allowedPasswords.includes(password)) {
      // Lấy thời gian sống (TTL) của cookie từ env, tính bằng giây. Mặc định 180s
      const ttlSeconds = parseInt(process.env.VITE_AUTH_TTL, 10) || 18000000;

      // Tạo token Stateless chứa Expiry + Signature để không bị mất khi nodemon/vercel restart
      const expires = Date.now() + (ttlSeconds * 1000);
      const secret = process.env.GITHUB_TOKEN || process.env.VITE_PASS || 'default_secret';
      const signature = crypto.createHmac('sha256', secret).update(expires.toString()).digest('hex');
      const token = `${signature}.${expires}`;

      res.setHeader('Set-Cookie', `fc_owner_auth=${token}; HttpOnly; Max-Age=${ttlSeconds}; Path=/; SameSite=Strict`);
      return res.json({ success: true });
    }
  } catch (err) {
    console.error('[Auth Error]', err);
  }
  res.status(401).json({ success: false, message: 'Mật khẩu không chính xác' });
});

app.get('/api/auth/verify', (req, res) => {
  const cookieStr = req.headers.cookie || '';
  const match = cookieStr.match(/fc_owner_auth=([^;]+)/);
  const token = match ? match[1] : null;

  if (token) {
    const parts = token.split('.');
    if (parts.length === 2) {
      const [signature, expiresStr] = parts;
      const expires = parseInt(expiresStr, 10);

      if (Date.now() < expires) {
        const secret = process.env.GITHUB_TOKEN || process.env.VITE_PASS || 'default_secret';
        const expectedSignature = crypto.createHmac('sha256', secret).update(expiresStr).digest('hex');

        if (signature === expectedSignature) {
          return res.json({ success: true, authenticated: true });
        }
      }
    }
  }

  return res.json({ success: true, authenticated: false });
});

// ─── Start server (chỉ khi chạy local, bỏ qua trên Vercel) ─────────────────

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[Server] API chạy tại http://localhost:${PORT}`);
  });
}

export default app;
