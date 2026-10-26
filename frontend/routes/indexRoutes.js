import { Router } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// หน้าเดียว (SPA): การสลับหน้าทำฝั่งเบราว์เซอร์ด้วย hash ใน public/js/main.js
router.get('/', (_req, res) => res.sendFile(path.join(__dirname, '..', 'views', 'index.html')));

export default router;
