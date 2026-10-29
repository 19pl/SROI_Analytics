// ค่าคงที่ที่ใช้ร่วมกันทั้งแอป (ชื่อแอป, ขอบเขตค่าที่กรอกได้)

export const APP_TITLE = 'NU SROI';

/** hash ของหน้าเริ่มต้น (เครื่องคำนวณ) */
export const HOME_HASH = '#/';

/** ขอบเขตค่าของ "ข้อมูลโครงการ" ที่ใช้ตัดค่า (clamp) ตอนผู้ใช้กรอก
 *  years.max ตรงกับค่าสูงสุดของ backend (analysis_period_years BETWEEN 1 AND 100)
 */
export const PROJECT_LIMITS = {
  investment: { min: 0, max: 1e12 },
  years: { min: 1, max: 100 },
  discountRate: { min: 0, max: 20 },
};

/** ค่าสูงสุดของช่องตัวเลขทั่วไป */
export const MAX_AMOUNT = 1e9;
export const MAX_PERCENT = 100;
