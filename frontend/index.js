// เซิร์ฟเวอร์ Node.js สำหรับเสิร์ฟไฟล์ static เท่านั้น (ไม่มี API / ฐานข้อมูล)
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import indexRoutes from './routes/indexRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use('/', indexRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SROI frontend: http://localhost:${PORT}`));
