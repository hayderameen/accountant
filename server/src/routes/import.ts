import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { stripUserId } from '../middleware/stripUserId.js';
import {
  ensureUploadDir,
  createImportPreview,
  confirmImport,
} from '../lib/import/importService.js';

const router = Router();
router.use(requireAuth, stripUserId);

ensureUploadDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir();
    cb(null, path.resolve('uploads'));
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.sqlite', '.mmbak', '.moneymanager2'];
    const ext = path.extname(file.originalname).toLowerCase();
    const base = file.originalname.toLowerCase();
    const ok =
      allowed.some((a) => ext === a || base.endsWith(a)) ||
      base.includes('money') ||
      ext === '.db';
    cb(null, ok);
  },
});

router.post('/preview', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    const result = await createImportPreview(req.userId, req.file.path, req.file.originalname);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to parse backup' });
  }
});

const confirmSchema = z.object({
  jobId: z.string(),
  runAutomationsOnImport: z.boolean().optional(),
});

router.post('/confirm', async (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const result = await confirmImport(
      req.userId,
      parsed.data.jobId,
      parsed.data.runAutomationsOnImport ?? false
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Import failed' });
  }
});

export default router;
