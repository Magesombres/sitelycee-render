const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const { fileTypeFromBuffer } = require('file-type');
const fs = require('fs');
const path = require('path');
const { authMiddleware, isAdmin } = require('../middleware/authMiddleware');
const Media = require('../models/Media');

const MAX_FILE_BYTES = Number(process.env.UPLOAD_MAX_BYTES || 2 * 1024 * 1024); // 2MB
const NSFW_THRESHOLD = Number(process.env.NSFW_THRESHOLD || 0.2);
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const PENDING_DIR = path.join(UPLOADS_DIR, 'pending');
const APPROVED_DIR = path.join(UPLOADS_DIR, 'approved');

function ensureDirs() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
  if (!fs.existsSync(PENDING_DIR)) fs.mkdirSync(PENDING_DIR);
  if (!fs.existsSync(APPROVED_DIR)) fs.mkdirSync(APPROVED_DIR);
}
ensureDirs();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

async function detectNSFW(buffer) {
  // TODO: replace with real detector or external API
  // naive pseudo-random low probability based on buffer length hash to be deterministic
  let h = 0; for (let i = 0; i < buffer.length; i += Math.ceil(buffer.length / 97) || 1) { h = (h * 31 + buffer[i]) >>> 0; }
  const nsfwProb = (h % 100) / 1000; // 0..0.099
  return { nsfwProb };
}

router.post('/image', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
    const kind = await fileTypeFromBuffer(req.file.buffer);
    if (!kind || !['image/png', 'image/jpeg', 'image/webp'].includes(kind.mime)) {
      return res.status(400).json({ error: 'Type non supporté (png/jpeg/webp)' });
    }

    // Normalize: rotate, resize to max 1600, convert to webp
    const img = sharp(req.file.buffer).rotate();
    const meta = await img.metadata();
    const maxDim = Number(process.env.UPLOAD_MAX_DIM || 1600);
    if ((meta.width || 0) > maxDim || (meta.height || 0) > maxDim) {
      img.resize({ width: maxDim, height: maxDim, fit: 'inside' });
    }
    const out = await img.webp({ quality: 82 }).toBuffer();

    const { nsfwProb } = await detectNSFW(out);
    const approved = nsfwProb < NSFW_THRESHOLD;

    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`;
    const destDir = approved ? APPROVED_DIR : PENDING_DIR;
    const storagePath = path.join(destDir, filename);
    fs.writeFileSync(storagePath, out);

    const media = await Media.create({
      user: req.user.id,
      originalName: req.file.originalname,
      mime: 'image/webp',
      width: meta.width,
      height: meta.height,
      size: out.length,
      storagePath: storagePath,
      url: approved ? `/uploads/approved/${filename}` : null,
      status: approved ? 'approved' : 'pending',
      reason: approved ? undefined : 'En attente de modération',
      flags: { nsfwProb },
    });

    res.json({ id: String(media._id), status: media.status, url: media.url, nsfwProb });
  } catch (e) {
    console.error('POST /media/image error:', e);
    const tooBig = /File too large/i.test(e?.message || '');
    res.status(tooBig ? 413 : 500).json({ error: tooBig ? 'Fichier trop volumineux' : 'Upload échoué' });
  }
});

// Current user's media
router.get('/mine', authMiddleware, async (req, res) => {
  const list = await Media.find({ user: req.user.id }).sort('-createdAt').limit(100).lean();
  res.json(list.map((m) => ({
    id: String(m._id),
    url: m.url,
    status: m.status,
    reason: m.reason,
    width: m.width,
    height: m.height,
    size: m.size,
    flags: m.flags,
    createdAt: m.createdAt,
  })));
});

// Admin: list pending
router.get('/pending', authMiddleware, isAdmin, async (req, res) => {
  const list = await Media.find({ status: 'pending' }).sort('createdAt').limit(200).lean();
  res.json(list.map((m) => ({
    id: String(m._id), user: String(m.user), status: m.status, reason: m.reason, flags: m.flags,
    url: null, // not public yet
    width: m.width, height: m.height, size: m.size, createdAt: m.createdAt,
  })));
});

// Secure raw fetch for owner/admin (to preview pending)
router.get('/:id/raw', authMiddleware, async (req, res) => {
  const m = await Media.findById(req.params.id);
  if (!m) return res.status(404).end();
  const isOwner = String(m.user) === String(req.user.id);
  const isAdm = req.user.role === 'admin';
  if (!(isOwner || isAdm)) return res.status(403).end();
  try {
    if (!m.storagePath || !fs.existsSync(m.storagePath)) return res.status(404).end();
    res.setHeader('Content-Type', m.mime || 'image/webp');
    fs.createReadStream(m.storagePath).pipe(res);
  } catch { res.status(500).end(); }
});

// Moderate
router.patch('/:id/moderate', authMiddleware, isAdmin, async (req, res) => {
  const { action, reason } = req.body || {};
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Action invalide' });
  const m = await Media.findById(req.params.id);
  if (!m) return res.status(404).json({ error: 'Introuvable' });

  if (action === 'approve') {
    // move to approved dir if pending
    if (m.status !== 'approved' && m.storagePath && fs.existsSync(m.storagePath)) {
      const filename = path.basename(m.storagePath);
      const newPath = path.join(APPROVED_DIR, filename);
      fs.renameSync(m.storagePath, newPath);
      m.storagePath = newPath;
      m.url = `/uploads/approved/${filename}`;
    }
    m.status = 'approved';
    m.reason = undefined;
  } else {
    // reject: delete file and null url
    if (m.storagePath && fs.existsSync(m.storagePath)) {
      try { fs.unlinkSync(m.storagePath); } catch {}
    }
    m.storagePath = null;
    m.url = null;
    m.status = 'rejected';
    m.reason = reason || 'Rejeté par la modération';
  }
  await m.save();
  res.json({ id: String(m._id), status: m.status, url: m.url, reason: m.reason });
});

module.exports = router;
