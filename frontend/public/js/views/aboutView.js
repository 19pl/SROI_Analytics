import { card, icons } from '../components/ui.js';

export function renderAbout(root) {
  root.innerHTML = `<div class="about-page">
    <span class="badge badge-mock">NU SROI มหาวิทยาลัยนเรศวร</span>
    <h1 class="page-title">SROI คืออะไร?</h1>
    <p class="muted page-sub">ทำความเข้าใจการประเมินผลตอบแทนทางสังคมจากการลงทุน และขั้นตอนการประเมินอย่างเป็นระบบ</p>

    <section class="about-hero">
      <div class="about-hero-icon">${icons.trendUp}</div>
      <div>
        <p class="about-eyebrow">SOCIAL RETURN ON INVESTMENT</p>
        <h2>วัดคุณค่าที่โครงการสร้างให้สังคม</h2>
        <p>SROI (Social Return on Investment) คือแนวทางประเมินคุณค่าทางสังคม เศรษฐกิจ และสิ่งแวดล้อมที่เกิดจากโครงการ โดยเปรียบเทียบมูลค่าผลลัพธ์ที่เกิดขึ้นกับเงินลงทุน</p>
      </div>
    </section>

    <div class="about-content-grid">
      ${card({ title: 'SROI ช่วยให้เราเข้าใจอะไร?', description: 'มองให้ไกลกว่าตัวเลขรายรับและรายจ่าย', body: `<ul class="about-list"><li>ใครได้รับผลกระทบหรือได้รับประโยชน์จากโครงการ</li><li>เกิดการเปลี่ยนแปลงอะไรขึ้นกับผู้มีส่วนได้ส่วนเสีย</li><li>ผลลัพธ์เหล่านั้นมีคุณค่ามากน้อยเพียงใด</li><li>เมื่อเทียบกับเงินลงทุนแล้ว โครงการสร้างคุณค่ากลับคืนเท่าใด</li></ul>`})}
      ${card({ title: 'อ่านค่า SROI อย่างไร?', description: 'ตัวอย่างการตีความอัตราส่วน', body: `<div class="about-ratio"><strong>3 : 1</strong><span>ตัวอย่างอัตราส่วน SROI</span></div><p class="muted">หมายถึง ทุกการลงทุน 1 บาท สร้างมูลค่าผลลัพธ์ทางสังคมที่ประเมินได้ประมาณ 3 บาท ภายใต้สมมติฐานและวิธีประเมินของโครงการนั้น</p><p class="about-note">อัตราส่วนนี้เป็นเพียงตัวอย่าง ไม่ใช่ผลการประเมินของโครงการใดโดยเฉพาะ</p>`})}
    </div>

    <section class="card about-steps-card">
      <div class="card-head"><div><h2 class="card-title">ประเมิน SROI อย่างไร?</h2><p class="muted">ขั้นตอนหลักในการประเมินผลตอบแทนทางสังคม</p></div></div>
      <div class="about-steps">
        <article class="about-step"><span>1</span><div><h3>กำหนดขอบเขตและผู้มีส่วนได้ส่วนเสีย</h3><p>ระบุเป้าหมาย ระยะเวลา และกลุ่มคนที่ได้รับผลกระทบจากโครงการ</p></div></article>
        <article class="about-step"><span>2</span><div><h3>ระบุผลลัพธ์ที่เกิดขึ้น</h3><p>รวบรวมข้อมูลการเปลี่ยนแปลงที่เกิดกับผู้เข้าร่วมและชุมชน ทั้งด้านบวกและด้านลบ</p></div></article>
        <article class="about-step"><span>3</span><div><h3>กำหนดตัวชี้วัดและมูลค่าทางการเงิน</h3><p>เลือกตัวชี้วัดและใช้มูลค่าทางการเงินแทนคุณค่าของผลลัพธ์อย่างมีเหตุผล พร้อมระบุแหล่งข้อมูล</p></div></article>
        <article class="about-step"><span>4</span><div><h3>หักผลกระทบที่ไม่ควรนับรวม</h3><p>พิจารณา Deadweight, Attribution, Displacement และ Drop-off เพื่อลดการกล่าวอ้างผลลัพธ์เกินจริง</p></div></article>
        <article class="about-step"><span>5</span><div><h3>คำนวณ วิเคราะห์ และรายงาน</h3><p>คำนวณมูลค่าปัจจุบันของผลลัพธ์เทียบกับเงินลงทุน ตรวจสอบสมมติฐาน และสื่อสารข้อจำกัดอย่างโปร่งใส</p></div></article>
      </div>
    </section>

    <section class="about-formula">
      <div><p class="about-eyebrow">แนวคิดการคำนวณ</p><h2>อัตราส่วน SROI</h2><p>เปรียบเทียบมูลค่าปัจจุบันของผลลัพธ์ทางสังคมกับมูลค่าการลงทุน</p></div>
      <div class="about-formula-equation">SROI = <span>มูลค่าปัจจุบันของผลลัพธ์</span><i></i><span>มูลค่าการลงทุน</span></div>
    </section>
    <p class="about-disclaimer">หมายเหตุ: การประเมิน SROI ที่น่าเชื่อถือควรใช้ข้อมูลที่ตรวจสอบได้ เปิดเผยสมมติฐาน และให้ผู้มีส่วนได้ส่วนเสียมีส่วนร่วม ผลลัพธ์เป็นค่าประมาณตามขอบเขตและวิธีประเมินที่กำหนด</p>
  </div>`;
}
