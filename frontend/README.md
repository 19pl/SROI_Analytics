# Frontend: เครื่องคำนวณ SROI

HTML + CSS + JavaScript (ES Modules) เสิร์ฟด้วย Node.js (Express) ใช้ข้อมูลจำลอง ไม่มี API / ฐานข้อมูล

```bash
npm install
npm start          # http://localhost:3000   (npm run dev = รีสตาร์ทอัตโนมัติ)
```

## โครงสร้าง
| ไฟล์/โฟลเดอร์ | หน้าที่ |
|---|---|
| `index.js` | เซิร์ฟเวอร์ Node เสิร์ฟไฟล์ static |
| `routes/indexRoutes.js` | route ฝั่งเซิร์ฟเวอร์ (ส่งหน้า `views/index.html`) |
| `views/index.html` | โครงหน้า: Sidebar + Header + พื้นที่เนื้อหา |
| `public/css/tokens.css` | สี ฟอนต์ ระยะ จาก DESIGN.md (เปลี่ยนธีมที่นี่) |
| `public/css/layout.css` / `components.css` | เปลือกแอป / การ์ด ตาราง ปุ่ม ป้ายสถานะ กราฟ |
| `public/js/main.js` | เริ่มแอปและสลับหน้าด้วย hash |
| `public/js/routes.js` | รายการเมนู/หน้า (เพิ่มหน้าใหม่ที่นี่) |
| `public/js/views/` | หน้าจอแต่ละหน้า |
| `public/js/components/ui.js` | การ์ด ป้ายสถานะ ช่องกรอก ไอคอน |
| `public/js/store.js` | state ของโครงการที่กำลังคำนวณ |
| `public/js/utils/sroi.js` | สูตรคำนวณ SROI + ตัวจัดรูปแบบตัวเลข |
| `public/js/data/mockProjects.js` | ข้อมูลจำลอง |
