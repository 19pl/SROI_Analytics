# SROI Analytics

เครื่องคำนวณ SROI (มหาวิทยาลัยนเรศวร) — `frontend/` เว็บ, `backend/` API (PHP), `electron/` แอปเดสก์ท็อป

## Desktop app (Windows .exe)

ต้องมี Node.js 20+ บนเครื่อง Windows

```bash
npm install        # ติดตั้ง Electron + electron-builder
npm start          # ทดลองเปิดแอปในหน้าต่าง
npm run dist       # สร้างไฟล์ติดตั้ง + portable ลงโฟลเดอร์ dist/
```

ผลลัพธ์ใน `dist/`:
- `SROI-Analytics-1.0.0-nsis.exe` — ตัวติดตั้ง
- `SROI-Analytics-1.0.0-portable.exe` — รันได้เลยไม่ต้องติดตั้ง

