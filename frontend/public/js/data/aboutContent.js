/**
 * SROI Methodology Content
 * Bilingual support (Thai & English)
 */

import { getLanguage } from '../i18n.js';

const CONTENT = {
  th: {
    badge: 'NU SROI มหาวิทยาลัยนเรศวร',
    title: 'SROI คืออะไร?',
    subtitle: 'ทำความเข้าใจการประเมินผลตอบแทนทางสังคมจากการลงทุน และขั้นตอนการประเมินอย่างเป็นระบบ',
    eyebrow: 'SOCIAL RETURN ON INVESTMENT',
    heroTitle: 'วัดคุณค่าที่โครงการสร้างให้สังคม',
    heroDesc: 'SROI (Social Return on Investment) คือแนวทางประเมินคุณค่าทางสังคม เศรษฐกิจ และสิ่งแวดล้อมที่เกิดจากโครงการ โดยเปรียบเทียบมูลค่าผลลัพธ์ที่เกิดขึ้นกับเงินลงทุน',
    qCardTitle: 'SROI ช่วยให้เราเข้าใจอะไร?',
    qCardDesc: 'มองให้ไกลกว่าตัวเลขรายรับและรายจ่าย',
    questions: [
      'ใครได้รับผลกระทบหรือได้รับประโยชน์จากโครงการ',
      'เกิดการเปลี่ยนแปลงอะไรขึ้นกับผู้มีส่วนได้ส่วนเสีย',
      'ผลลัพธ์เหล่านั้นมีคุณค่ามากน้อยเพียงใด',
      'เมื่อเทียบกับเงินลงทุนแล้ว โครงการสร้างคุณค่ากลับคืนเท่าใด',
    ],
    readCardTitle: 'อ่านค่า SROI อย่างไร?',
    readCardDesc: 'ตัวอย่างการตีความอัตราส่วน',
    readSample: '3 : 1',
    readSampleLabel: 'ตัวอย่างอัตราส่วน SROI',
    readSampleExplain: 'หมายถึง ทุกการลงทุน 1 บาท สร้างมูลค่าผลลัพธ์ทางสังคมที่ประเมินได้ประมาณ 3 บาท ภายใต้สมมติฐานและวิธีประเมินของโครงการนั้น',
    readSampleNote: 'อัตราส่วนนี้เป็นเพียงตัวอย่าง ไม่ใช่ผลการประเมินของโครงการใดโดยเฉพาะ',
    stepsCardTitle: 'ประเมิน SROI อย่างไร?',
    stepsCardDesc: 'ขั้นตอนหลักในการประเมินผลตอบแทนทางสังคม',
    steps: [
      {
        title: 'กำหนดขอบเขตและผู้มีส่วนได้ส่วนเสีย',
        description: 'ระบุเป้าหมาย ระยะเวลา และกลุ่มคนที่ได้รับผลกระทบจากโครงการ',
      },
      {
        title: 'ระบุผลลัพธ์ที่เกิดขึ้น',
        description: 'รวบรวมข้อมูลการเปลี่ยนแปลงที่เกิดกับผู้เข้าร่วมและชุมชน ทั้งด้านบวกและด้านลบ',
      },
      {
        title: 'กำหนดตัวชี้วัดและมูลค่าทางการเงิน',
        description: 'เลือกตัวชี้วัดและใช้มูลค่าทางการเงินแทนคุณค่าของผลลัพธ์อย่างมีเหตุผล พร้อมระบุแหล่งข้อมูล',
      },
      {
        title: 'หักผลกระทบที่ไม่ควรนับรวม',
        description: 'พิจารณา Deadweight, Attribution, Displacement และ Drop-off เพื่อลดการกล่าวอ้างผลลัพธ์เกินจริง',
      },
      {
        title: 'คำนวณ วิเคราะห์ และรายงาน',
        description: 'คำนวณมูลค่าปัจจุบันของผลลัพธ์เทียบกับเงินลงทุน ตรวจสอบสมมติฐาน และสื่อสารข้อจำกัดอย่างโปร่งใส',
      },
    ],
    termsCardTitle: 'คำศัพท์สำคัญในการประเมิน SROI',
    termsCardDesc: 'ค่าที่ใช้ปรับผลลัพธ์ให้สะท้อนผลกระทบของโครงการอย่างสมเหตุสมผล',
    terms: [
      {
        symbol: 'DW',
        title: 'Deadweight %',
        subtitle: 'ผลลัพธ์ที่เกิดขึ้นเอง',
        description: 'สัดส่วนของการเปลี่ยนแปลงที่อาจเกิดขึ้นอยู่แล้ว แม้ไม่มีโครงการ เช่น ผู้เข้าร่วมมีรายได้เพิ่มขึ้นจากภาวะเศรษฐกิจตามปกติ จึงต้องหักส่วนนั้นออกจากผลลัพธ์ที่นับให้โครงการ',
        example: 'หากคาดว่า 20% ของผลลัพธ์จะเกิดขึ้นเอง ให้กำหนด Deadweight = 20%',
      },
      {
        symbol: 'AT',
        title: 'Attribution %',
        subtitle: 'ผลจากปัจจัยหรือหน่วยงานอื่น',
        description: 'สัดส่วนของผลลัพธ์ที่เกิดจากบุคคล หน่วยงาน หรือปัจจัยอื่น ไม่ใช่ผลงานของโครงการนี้เพียงอย่างเดียว ส่วนนี้จะถูกหักออกเพื่อไม่ให้กล่าวอ้างผลลัพธ์เกินจริง',
        example: 'หากหน่วยงานอื่นมีส่วนสร้างผลลัพธ์ 15% ให้กำหนด Attribution = 15%',
      },
      {
        symbol: 'DP',
        title: 'Displacement %',
        subtitle: 'การย้ายที่ของผลกระทบ',
        description: 'สัดส่วนของผลประโยชน์ที่เกิดขึ้นในพื้นที่หนึ่ง แต่ไปลดทอนผลประโยชน์ที่คล้ายกันในพื้นที่หรือกลุ่มอื่น เช่น การจัดหางานให้ผู้เข้าร่วมแต่ไปแทนที่แรงงานคนอื่น',
        example: 'หากการจ้างงานไปแทนที่ตำแหน่งเดิมของผู้อื่น 10% ให้กำหนด Displacement = 10%',
      },
      {
        symbol: 'DO',
        title: 'Drop-off %',
        subtitle: 'การลดลงของผลลัพธ์ในแต่ละปี',
        description: 'อัตราที่ผลลัพธ์หรือประโยชน์ลดลงในปีถัด ๆ ไป หลังจากปีแรก โดยทั่วไปใช้ปรับมูลค่าผลลัพธ์ของปีต่อมา ไม่ใช่การหักผลลัพธ์ซ้ำในปีแรก',
        example: 'หากประโยชน์ลดลงปีละ 10% ให้กำหนด Drop-off = 10% ต่อปี',
      },
      {
        symbol: 'DR',
        title: 'อัตราคิดลด',
        subtitle: 'Discount rate',
        description: 'อัตราที่ใช้แปลงมูลค่าผลลัพธ์ที่จะเกิดในอนาคตให้เป็นมูลค่า ณ ปัจจุบัน เพราะเงินหรือประโยชน์ที่ได้รับในอนาคตมีมูลค่าในวันนี้แตกต่างกัน',
        example: 'หากใช้อัตราคิดลด 3.5% ต่อปี จะนำอัตรานี้ไปคำนวณมูลค่าปัจจุบันของผลลัพธ์ในแต่ละปี',
      },
    ],
    termsNote: 'หมายเหตุ: ค่าร้อยละควรอ้างอิงจากข้อมูลหรือหลักฐานของโครงการ ไม่ควรกำหนดจากการคาดเดาเพียงอย่างเดียว และควรระบุสมมติฐานที่ใช้ให้ชัดเจน',
    formulaEyebrow: 'แนวคิดการคำนวณ',
    formulaTitle: 'อัตราส่วน SROI',
    formulaDesc: 'เปรียบเทียบมูลค่าปัจจุบันของผลลัพธ์ทางสังคมกับมูลค่าการลงทุน',
    formulaNumerator: 'มูลค่าปัจจุบันของผลลัพธ์',
    formulaDenominator: 'มูลค่าการลงทุน',
    disclaimer: 'หมายเหตุ: การประเมิน SROI ที่น่าเชื่อถือควรใช้ข้อมูลที่ตรวจสอบได้ เปิดเผยสมมติฐาน และให้ผู้มีส่วนได้ส่วนเสียมีส่วนร่วม ผลลัพธ์เป็นค่าประมาณตามขอบเขตและวิธีประเมินที่กำหนด',
    exampleText: 'ตัวอย่าง:',
  },
  en: {
    badge: 'NU SROI Naresuan University',
    title: 'What is SROI?',
    subtitle: 'Understand Social Return on Investment methodology and systematic evaluation stages.',
    eyebrow: 'SOCIAL RETURN ON INVESTMENT',
    heroTitle: 'Measuring Societal Impact and Value',
    heroDesc: 'SROI (Social Return on Investment) is an internationally recognized framework that accounts for broader social, environmental, and economic value relative to resources invested.',
    qCardTitle: 'What Does SROI Help Us Understand?',
    qCardDesc: 'Looking beyond traditional revenue and accounting expenditures.',
    questions: [
      'Who experiences material change or benefits from the initiative?',
      'What specific outcomes occur for key stakeholder groups?',
      'How significant and valuable are those societal outcomes?',
      'Compared to resources invested, how much value does the initiative return?',
    ],
    readCardTitle: 'How to Interpret SROI Ratios?',
    readCardDesc: 'Example interpretation of return ratios.',
    readSample: '3 : 1',
    readSampleLabel: 'Example SROI Ratio',
    readSampleExplain: 'Indicates that every 1 Baht invested generated approximately 3 Baht in verified social and economic value, under the project’s specific evidence and assumptions.',
    readSampleNote: 'This ratio is illustrative and does not represent any specific individual project.',
    stepsCardTitle: 'How is SROI Evaluated?',
    stepsCardDesc: 'Key stages in the social return evaluation methodology.',
    steps: [
      {
        title: 'Establish Scope & Identify Stakeholders',
        description: 'Define project boundaries, timeframe, and all groups materially affected by the initiative.',
      },
      {
        title: 'Map Outcomes',
        description: 'Collect evidence of direct and indirect changes experienced by stakeholders, positive and negative.',
      },
      {
        title: 'Evidencing Outcomes & Giving Them a Value',
        description: 'Select appropriate indicators and apply defensible financial proxies to value outcomes.',
      },
      {
        title: 'Establishing Impact (Adjustments)',
        description: 'Deduct deadweight, attribution, displacement, and drop-off to avoid over-claiming impact.',
      },
      {
        title: 'Calculate SROI & Report Findings',
        description: 'Calculate net present value, test sensitivity assumptions, and transparently communicate results.',
      },
    ],
    termsCardTitle: 'Key Adjustment Definitions',
    termsCardDesc: 'Factors applied to adjust gross values and isolate true project additionality.',
    terms: [
      {
        symbol: 'DW',
        title: 'Deadweight %',
        subtitle: 'What would have happened anyway',
        description: 'The proportion of outcomes that would have occurred naturally without the project. This amount is deducted to isolate additionality.',
        example: 'If 20% of improvement would occur anyway, Deadweight = 20%.',
      },
      {
        symbol: 'AT',
        title: 'Attribution %',
        subtitle: 'Contribution of other actors',
        description: 'The portion of outcome changes resulting from external programs, family support, or partner institutions.',
        example: 'If external partners contributed 15% of the effect, Attribution = 15%.',
      },
      {
        symbol: 'DP',
        title: 'Displacement %',
        subtitle: 'Outcome shifted from elsewhere',
        description: 'An assessment of whether the outcome merely displaced value from another geographic area or community group.',
        example: 'If employment jobs replaced jobs in an adjacent district, Displacement = 10%.',
      },
      {
        symbol: 'DO',
        title: 'Drop-off %',
        subtitle: 'Annual outcome deterioration',
        description: 'The annual rate at which the benefits deteriorate or fade in successive years following the intervention.',
        example: 'If skills retention declines 10% each subsequent year, Drop-off = 10% per year.',
      },
      {
        symbol: 'DR',
        title: 'Discount Rate',
        subtitle: 'Time value of future benefits',
        description: 'The rate used to convert future societal returns into present value terms today.',
        example: 'If an annual social discount rate of 3.5% is applied, future flows are discounted accordingly.',
      },
    ],
    termsNote: 'Note: Adjustment percentages should be grounded in stakeholder evidence or benchmark data, with all assumptions clearly recorded.',
    formulaEyebrow: 'Calculation Framework',
    formulaTitle: 'SROI Ratio',
    formulaDesc: 'Compares total present value of societal benefits against total present value of investment.',
    formulaNumerator: 'Present Value of Outcomes',
    formulaDenominator: 'Present Value of Investment',
    disclaimer: 'Note: Robust SROI evaluations rely on verifiable data, transparent sensitivity testing, and active stakeholder involvement. Ratios represent evidence-based estimates within defined scopes.',
    exampleText: 'Example:',
  },
};

export function getAboutData() {
  const lang = getLanguage();
  return CONTENT[lang] || CONTENT.th;
}

export const ABOUT_QUESTIONS = CONTENT.th.questions;
export const ABOUT_STEPS = CONTENT.th.steps;
export const ABOUT_TERMS = CONTENT.th.terms;
