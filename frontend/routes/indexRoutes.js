import { Router } from 'express';
import { INDEX_HTML } from '../config.js';

const router = Router();

// หน้าเดียว (SPA): การสลับหน้าทำฝั่งเบราว์เซอร์ด้วย hash ใน public/js/main.js
router.get('/', (_req, res) => res.sendFile(INDEX_HTML));

export default router;
