# Frontend: เครื่องคำนวณ SROI

HTML + CSS + JavaScript (ES Modules) เสิร์ฟด้วย Node.js (Express) ใช้ข้อมูลจำลอง ไม่มี API / ฐานข้อมูล

```bash
npm install
npm start          # http://localhost:3000   (npm run dev = รีสตาร์ทอัตโนมัติ)
npm run format     # จัดรูปแบบโค้ดทั้งโปรเจกต์ด้วย Prettier
npm run format:check
```

## โครงสร้าง

```text
frontend/
├── index.js                     เซิร์ฟเวอร์ Node เสิร์ฟไฟล์ static
├── config.js                    พอร์ต และ path ของไฟล์ฝั่งเซิร์ฟเวอร์
├── routes/indexRoutes.js        route ฝั่งเซิร์ฟเวอร์ (ส่งหน้า views/index.html)
├── views/index.html             โครงหน้า: Sidebar + Header + พื้นที่เนื้อหา
└── public/
    ├── css/
    │   ├── tokens.css           สี ฟอนต์ ระยะ (เปลี่ยนธีมที่นี่)
    │   ├── base.css             รีเซ็ต + utility (.muted .strong .num)
    │   ├── layout.css           เปลือกแอป: Sidebar, Header, พื้นที่เนื้อหา
    │   ├── components.css       Card, Button, Input, Table, Badge
    │   └── pages/               สไตล์เฉพาะหน้า (calculator.css, about.css)
    └── js/
        ├── main.js              เริ่มแอป สร้างเมนู และสลับหน้าด้วย hash
        ├── routes.js            รายการเมนู/หน้า (เพิ่มหน้าใหม่ที่นี่)
        ├── store.js             state ของโครงการที่กำลังคำนวณ
        ├── config/constants.js  ค่าคงที่ (ชื่อแอป, ขอบเขตค่าที่กรอกได้)
        ├── data/                ข้อมูลจำลอง (mockProjects.js) และเนื้อหาหน้า About
        ├── utils/               sroi.js (สูตรคำนวณ), format.js, html.js, math.js
        ├── components/          icons.js (ไอคอน SVG), ui.js (การ์ด ป้าย ช่องกรอก)
        └── views/               หน้าจอแต่ละหน้า
            ├── aboutView.js
            ├── projectsView.js
            ├── calculatorView.js    ประกอบหน้า + จัดการ event
            └── calculator/          ส่วนย่อยของหน้าคำนวณ
                ├── projectForm.js, outcomeTable.js
                └── summaryPanel.js, yearlyChart.js
```

## แนวทางพัฒนาต่อ

| ต้องการ…                      | แก้ที่                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------- |
| เพิ่มหน้าใหม่                 | สร้างไฟล์ใน `public/js/views/` แล้วเพิ่มรายการใน `public/js/routes.js`            |
| เปลี่ยนสูตรคำนวณ SROI         | `public/js/utils/sroi.js` (ไฟล์เดียว)                                             |
| เปลี่ยนสี / ธีม               | `public/css/tokens.css`                                                           |
| แก้ข้อความหน้า "SROI คืออะไร" | `public/js/data/aboutContent.js`                                                  |
| เพิ่ม/แก้โครงการตัวอย่าง      | `public/js/data/mockProjects.js`                                                  |
| แก้ขอบเขตค่าที่กรอกได้        | `public/js/config/constants.js`                                                   |
| เพิ่มไอคอน                    | `public/js/components/icons.js`                                                   |
| เพิ่มสถานะโครงการใหม่         | `STATUS_LABEL` ใน `mockProjects.js` + คลาส `.badge-<status>` และ token ใน `*.css` |

## ข้อตกลงการเขียนโค้ด

- ฟังก์ชัน `*Html` / `card()` / `numberField()` คืนค่าเป็นสตริง HTML — ข้อความที่มาจากผู้ใช้ต้องผ่าน `escapeHtml()` เสมอ
- หน้าคำนวณวาดโครงครั้งเดียว แล้วอัปเดตเฉพาะส่วนผลลัพธ์ (`updateResults`) เพื่อไม่ให้ช่องที่กำลังพิมพ์เสียโฟกัส
- ค่าสีและระยะใน CSS ให้ใช้ตัวแปรจาก `tokens.css` แทนการเขียนค่าตรง ๆ
- จัดรูปแบบด้วย Prettier (ตั้งค่าใน `.prettierrc.json`) ก่อน commit ทุกครั้ง
