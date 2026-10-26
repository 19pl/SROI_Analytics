// เซิร์ฟเวอร์ Node.js สำหรับเสิร์ฟไฟล์ static เท่านั้น (ไม่มี API / ฐานข้อมูล)
import express from 'express';
import { PORT, PUBLIC_DIR } from './config.js';
import indexRoutes from './routes/indexRoutes.js';

const app = express();

app.use(express.static(PUBLIC_DIR));
app.use('/', indexRoutes);

app.listen(PORT, () => console.log(`SROI frontend: http://localhost:${PORT}`));
