/**
 * Standard option lists for forms and modals.
 * Each item has { value, th, en, ...extra }.
 */

export const PROJECT_CATEGORIES = [
  { value: 'Education', th: 'การศึกษา', en: 'Education' },
  { value: 'Health', th: 'สุขภาพและสาธารณสุข', en: 'Health' },
  { value: 'Community', th: 'การพัฒนาชุมชนและสังคม', en: 'Community' },
  { value: 'Technology', th: 'เทคโนโลยีและนวัตกรรม', en: 'Technology' },
  { value: 'Agriculture', th: 'การเกษตรและความมั่นคงทางอาหาร', en: 'Agriculture' },
  { value: 'Environment', th: 'สิ่งแวดล้อมและพลังงาน', en: 'Environment' },
  { value: 'Other', th: 'อื่น ๆ (ระบุ)', en: 'Other (specify)' },
];

export const CURRENCIES = [
  { value: 'THB', th: 'THB (บาท)', en: 'THB (Thai Baht)' },
  { value: 'USD', th: 'USD (ดอลลาร์สหรัฐ)', en: 'USD (US Dollar)' },
  { value: 'EUR', th: 'EUR (ยูโร)', en: 'EUR (Euro)' },
  { value: 'Other', th: 'อื่น ๆ (ระบุ)', en: 'Other (specify)' },
];

export const PERIOD_MONTHS = [
  { value: '', th: 'เต็มปี (12 เดือน / มาตรฐาน)', en: 'Full Year (12 months / standard)' },
  { value: '6', th: '6 เดือน (ระหว่างกาล)', en: '6 Months (Interim)' },
  { value: '9', th: '9 เดือน (ระหว่างกาล)', en: '9 Months (Interim)' },
  { value: '12', th: '12 เดือน (ปีงบประมาณ)', en: '12 Months (Fiscal Year)' },
];

export const ANALYSIS_YEARS = [
  { value: '1', th: '1 ปี (แนะนำสำหรับโครงการทั่วไป)', en: '1 Year (standard)' },
  { value: '2', th: '2 ปี', en: '2 Years' },
  { value: '3', th: '3 ปี', en: '3 Years' },
  { value: '4', th: '4 ปี', en: '4 Years' },
  { value: '5', th: '5 ปี', en: '5 Years' },
  { value: '6', th: '6 ปี', en: '6 Years' },
  { value: '7', th: '7 ปี', en: '7 Years' },
  { value: '8', th: '8 ปี', en: '8 Years' },
  { value: '9', th: '9 ปี', en: '9 Years' },
  { value: '10', th: '10 ปี', en: '10 Years' },
  { value: 'Other', th: 'อื่น ๆ (ระบุ)', en: 'Other (specify)' },
];

export const EVAL_TYPES = [
  {
    value: 'forecast',
    th: 'การประเมินล่วงหน้า / คาดการณ์ผล (Forecast)',
    en: 'Forecast (Ex-ante prospective)',
    desc_th: 'ประเมินก่อนเริ่มโครงการเพื่อคาดการณ์ผลตอบแทนทางสังคม',
    desc_en: 'Prospective evaluation before project start to forecast impact',
  },
  {
    value: 'evaluative',
    th: 'การประเมินย้อนหลังตามผลจริง (Evaluative)',
    en: 'Evaluative (Ex-post actuals)',
    desc_th: 'ประเมินหลังโครงการเสร็จสิ้นเพื่อวัดผลลัพธ์ที่เกิดขึ้นจริง',
    desc_en: 'Retrospective assessment using real results after completion',
  },
];
