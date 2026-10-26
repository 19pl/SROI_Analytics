// ค่าตั้งต้นของเซิร์ฟเวอร์ (พอร์ต และตำแหน่งไฟล์ที่ต้องเสิร์ฟ)
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

export const PORT = process.env.PORT || 3000;
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
export const INDEX_HTML = path.join(ROOT_DIR, 'views', 'index.html');
