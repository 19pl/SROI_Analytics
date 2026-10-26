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

    <section class="card about-terms-card">
      <div class="card-head"><div><h2 class="card-title">คำศัพท์สำคัญในการประเมิน SROI</h2><p class="muted">ค่าที่ใช้ปรับผลลัพธ์ให้สะท้อนผลกระทบของโครงการอย่างสมเหตุสมผล</p></div></div>
      <div class="about-terms-grid">
        <article class="about-term">
          <span class="about-term-symbol">DW</span>
          <div><h3>Deadweight % <span>ผลลัพธ์ที่เกิดขึ้นเอง</span></h3><p>สัดส่วนของการเปลี่ยนแปลงที่อาจเกิดขึ้นอยู่แล้ว แม้ไม่มีโครงการ เช่น ผู้เข้าร่วมมีรายได้เพิ่มขึ้นจากภาวะเศรษฐกิจตามปกติ จึงต้องหักส่วนนั้นออกจากผลลัพธ์ที่นับให้โครงการ</p><p class="about-term-example"><strong>ตัวอย่าง:</strong> หากคาดว่า 20% ของผลลัพธ์จะเกิดขึ้นเอง ให้กำหนด Deadweight = 20%</p></div>
        </article>
        <article class="about-term">
          <span class="about-term-symbol">AT</span>
          <div><h3>Attribution % <span>ผลจากปัจจัยหรือหน่วยงานอื่น</span></h3><p>สัดส่วนของผลลัพธ์ที่เกิดจากบุคคล หน่วยงาน หรือปัจจัยอื่น ไม่ใช่ผลงานของโครงการนี้เพียงอย่างเดียว ส่วนนี้จะถูกหักออกเพื่อไม่ให้กล่าวอ้างผลลัพธ์เกินจริง</p><p class="about-term-example"><strong>ตัวอย่าง:</strong> หากหน่วยงานอื่นมีส่วนสร้างผลลัพธ์ 15% ให้กำหนด Attribution = 15%</p></div>
        </article>
        <article class="about-term">
          <span class="about-term-symbol">DO</span>
          <div><h3>Drop-off % <span>การลดลงของผลลัพธ์ในแต่ละปี</span></h3><p>อัตราที่ผลลัพธ์หรือประโยชน์ลดลงในปีถัด ๆ ไป หลังจากปีแรก โดยทั่วไปใช้ปรับมูลค่าผลลัพธ์ของปีต่อมา ไม่ใช่การหักผลลัพธ์ซ้ำในปีแรก</p><p class="about-term-example"><strong>ตัวอย่าง:</strong> หากประโยชน์ลดลงปีละ 10% ให้กำหนด Drop-off = 10% ต่อปี</p></div>
        </article>
        <article class="about-term">
          <span class="about-term-symbol">DR</span>
          <div><h3>อัตราคิดลด <span>Discount rate</span></h3><p>อัตราที่ใช้แปลงมูลค่าผลลัพธ์ที่จะเกิดในอนาคตให้เป็นมูลค่า ณ ปัจจุบัน เพราะเงินหรือประโยชน์ที่ได้รับในอนาคตมีมูลค่าในวันนี้แตกต่างกัน</p><p class="about-term-example"><strong>ตัวอย่าง:</strong> หากใช้อัตราคิดลด 3.5% ต่อปี จะนำอัตรานี้ไปคำนวณมูลค่าปัจจุบันของผลลัพธ์ในแต่ละปี</p></div>
        </article>
      </div>
      <p class="about-terms-note">หมายเหตุ: ค่าร้อยละควรอ้างอิงจากข้อมูลหรือหลักฐานของโครงการ ไม่ควรกำหนดจากการคาดเดาเพียงอย่างเดียว และควรระบุสมมติฐานที่ใช้ให้ชัดเจน</p>
    </section>

    <section class="about-formula">
      <div><p class="about-eyebrow">แนวคิดการคำนวณ</p><h2>อัตราส่วน SROI</h2><p>เปรียบเทียบมูลค่าปัจจุบันของผลลัพธ์ทางสังคมกับมูลค่าการลงทุน</p></div>
      <div class="about-formula-equation"><strong class="about-formula-label">SROI <span>=</span></strong><div class="about-formula-fraction"><span class="about-formula-numerator">มูลค่าปัจจุบันของผลลัพธ์</span><i aria-hidden="true"></i><span class="about-formula-denominator">มูลค่าการลงทุน</span></div></div>
    </section>
    <p class="about-disclaimer">หมายเหตุ: การประเมิน SROI ที่น่าเชื่อถือควรใช้ข้อมูลที่ตรวจสอบได้ เปิดเผยสมมติฐาน และให้ผู้มีส่วนได้ส่วนเสียมีส่วนร่วม ผลลัพธ์เป็นค่าประมาณตามขอบเขตและวิธีประเมินที่กำหนด</p>
  </div>`;
}
