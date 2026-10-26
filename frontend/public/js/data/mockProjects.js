/** ข้อมูลจำลองทั้งหมด (ไม่มี API) */
export const STATUS_LABEL = {
  mock: 'ข้อมูลจำลอง',
  planned: 'วางแผน',
  development: 'กำลังพัฒนา',
  integrated: 'เชื่อมต่อแล้ว',
  production: 'ใช้งานจริง',
};

const o = (id, name, stakeholder, quantity, proxyValue, deadweight, attribution, dropOff) =>
  ({ id, name, stakeholder, quantity, proxyValue, deadweight, attribution, dropOff });

export const mockProjects = [
  {
    id: 'p1', name: 'โครงการฝึกอาชีพและวิสาหกิจชุมชน ม.นเรศวร', status: 'development', investment: 1200000, years: 5, discountRate: 3.5,
    outcomes: [
      o('o1', 'รายได้ครัวเรือนเพิ่มขึ้น', 'ผู้เข้าร่วมอบรม', 120, 36000, 20, 15, 10),
      o('o2', 'หนี้นอกระบบลดลง', 'ครัวเรือนผู้เข้าร่วม', 80, 12000, 30, 10, 20),
    ],
  },
  {
    id: 'p2', name: 'โครงการโภชนาการและสุขภาพชุมชน พิษณุโลก', status: 'planned', investment: 800000, years: 3, discountRate: 3.5,
    outcomes: [
      o('o1', 'ภาวะทุพโภชนาการลดลง', 'นักเรียน', 300, 4500, 25, 20, 15),
      o('o2', 'ผู้ปกครองมีเวลาทำงานเพิ่ม', 'ผู้ปกครอง', 150, 6000, 35, 10, 25),
    ],
  },
  {
    id: 'p3', name: 'โครงการดูแลสุขภาวะผู้สูงอายุ ม.นเรศวร', status: 'production', investment: 2500000, years: 6, discountRate: 3,
    outcomes: [
      o('o1', 'ลดการเข้าโรงพยาบาลฉุกเฉิน', 'ผู้สูงอายุ', 200, 18000, 20, 25, 10),
      o('o2', 'ผู้ดูแลกลับไปทำงานได้', 'สมาชิกครอบครัว', 110, 48000, 30, 20, 15),
      o('o3', 'ความเหงาและซึมเศร้าลดลง', 'ผู้สูงอายุ', 200, 7000, 15, 30, 20),
    ],
  },
];
