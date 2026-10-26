// ค่าคงที่ที่ใช้ร่วมกันทั้งแอป (ชื่อแอป, ขอบเขตค่าที่กรอกได้)

export const APP_TITLE = 'NU SROI';

/** hash ของหน้าเริ่มต้น (เครื่องคำนวณ) */
export const HOME_HASH = '#/';

/** ขอบเขตค่าของ "ข้อมูลโครงการ" ที่ใช้ตัดค่า (clamp) ตอนผู้ใช้กรอก */
export const PROJECT_LIMITS = {
  investment: { min: 0, max: 1e12 },
  years: { min: 1, max: 10 },
  discountRate: { min: 0, max: 20 },
};

/**
 * ค่าสูงสุดของช่อง "ระยะเวลาวัดผล" ที่แสดงบนหน้าจอ (ตรงกับข้อความ "ไม่เกิน 5 ปี")
 * หมายเหตุ: ต่างจาก PROJECT_LIMITS.years.max (10) ซึ่งเป็นค่าที่ใช้ตัดค่าจริง
 * และโครงการตัวอย่าง p3 ใช้ 6 ปี — ควรตัดสินใจให้เหลือค่าเดียว
 */
export const YEARS_INPUT_MAX = 5;

/** ค่าสูงสุดของช่องตัวเลขทั่วไป */
export const MAX_AMOUNT = 1e9;
export const MAX_PERCENT = 100;
