<?php
declare(strict_types=1);

namespace App\Domain\Report;

/**
 * Report language. Reports are stored once (language-neutral numbers + user text); the language of the labels and
 * standard sentences is chosen when the report is rendered, from the language the person selected in the website.
 * English text is the lookup key, so a missing translation simply falls back to English.
 * User-entered content (names, descriptions, sources) is never translated.
 */
final class ReportStrings
{
    public const LANGS = ['en', 'th'];

    private bool $th;

    public function __construct(string $lang = 'en')
    {
        $this->th = $lang === 'th';
    }

    public static function normalize(?string $lang): string
    {
        return $lang === 'th' ? 'th' : 'en';
    }

    public function lang(): string
    {
        return $this->th ? 'th' : 'en';
    }

    public function isTh(): bool
    {
        return $this->th;
    }

    /** @param array<string,string|int|float> $vars replaces {name} placeholders */
    public function t(string $en, array $vars = []): string
    {
        $s = $this->th ? (self::TH[$en] ?? $en) : $en;
        if ($vars) {
            $map = [];
            foreach ($vars as $k => $v) {
                $map['{' . $k . '}'] = (string)$v;
            }
            $s = strtr($s, $map);
        }
        return $s;
    }

    /** Fixed vocabulary values (polarity, evidence quality, cost category, ...). Unknown values pass through. */
    public function enum(?string $v): string
    {
        if ($v === null || $v === '') {
            return '';
        }
        return $this->th ? (self::ENUM_TH[$v] ?? $v) : $v;
    }

    /** Standard sentences produced by the calculation engine / report builder. Unknown sentences pass through. */
    public function narrative(string $s): string
    {
        if (!$this->th) {
            return $s;
        }
        if (isset(self::TH[$s])) {
            return self::TH[$s];
        }
        foreach (self::PATTERNS as [$re, $tpl]) {
            if (preg_match($re, $s, $m)) {
                $out = $tpl;
                for ($i = 1; $i < count($m); $i++) {
                    $out = str_replace('{' . $i . '}', $m[$i], $out);
                }
                return $out;
            }
        }
        return $s;
    }

    /** Labels of the sensitivity table, e.g. "Training — quantity". */
    public function driver(string $label): string
    {
        if (!$this->th) {
            return $label;
        }
        if ($label === 'Discount rate') {
            return 'อัตราคิดลด';
        }
        if (preg_match('~^(.*) — (quantity|financial proxy|deadweight|attribution|displacement|drop_off)$~us', $label, $m)) {
            $field = [
                'quantity' => 'จำนวน',
                'financial proxy' => 'ตัวแทนทางการเงิน',
                'deadweight' => 'Deadweight',
                'attribution' => 'Attribution',
                'displacement' => 'Displacement',
                'drop_off' => 'Drop-off',
            ][$m[2]];
            return $m[1] . ' — ' . $field;
        }
        return $label;
    }

    /** Scenario names created by the system ("Base case"); names typed by the user are untouched. */
    public function scenario(string $name): string
    {
        return $this->th && $name === 'Base case' ? 'กรณีฐาน (Base case)' : $name;
    }

    private const ENUM_TH = [
        'positive' => 'เชิงบวก',
        'negative' => 'เชิงลบ',
        'measured' => 'วัดผลจริง',
        'external' => 'อ้างอิงข้อมูลภายนอก',
        'estimated' => 'ประมาณการ',
        'assumed' => 'สมมติฐาน',
        'capex' => 'ค่าลงทุน (CAPEX)',
        'opex' => 'ค่าดำเนินการ (OPEX)',
        'delivery' => 'ค่าจัดกิจกรรม',
        'administration' => 'ค่าบริหารจัดการ',
        'in_kind' => 'สิ่งสนับสนุน (In-kind)',
        'other' => 'อื่นๆ',
        'nominal' => 'มูลค่าตามราคาที่จ่ายจริง (Nominal)',
        'present_value' => 'มูลค่าปัจจุบัน (Present value)',
        'forecast' => 'การคาดการณ์ (Forecast)',
        'evaluative' => 'การประเมินผล (Evaluative)',
        'ok' => 'ปกติ',
        'invalid' => 'ข้อมูลไม่ครบถ้วน',
        'cohort' => 'กลุ่มเดียว (Cohort)',
        'recurring_cohorts' => 'กลุ่มใหม่ทุกปี (Recurring cohorts)',
        'independent' => 'วัดรายปีอิสระ (Independent)',
    ];

    /** @var list<array{0:string,1:string}> regex => Thai template ({1}, {2} = captured groups) */
    private const PATTERNS = [
        ['~^Cost "(.*)" is in (\w+) but its exchange rate to (\w+) is 1\.$~us', 'รายการต้นทุน "{1}" เป็นสกุลเงิน {2} แต่อัตราแลกเปลี่ยนเป็น {3} ถูกตั้งไว้ที่ 1'],
        ['~^Possible double counting: (.*) appears (\d+) times with the same amount and year\.$~us', 'อาจมีการนับซ้ำ: "{1}" ปรากฏ {2} ครั้งด้วยจำนวนเงินและปีเดียวกัน'],
        ['~^Outcome "(.*)": deadweight, attribution and displacement have not been assessed; they are treated as 0%, which may overstate impact\.$~us', 'ผลลัพธ์ "{1}": ยังไม่ได้ประเมิน Deadweight, Attribution และ Displacement จึงถือเป็น 0% ซึ่งอาจทำให้ผลกระทบสูงเกินจริง'],
        ['~^Outcome "(.*)": impact adjustments have no source or justification\.$~us', 'ผลลัพธ์ "{1}": การปรับผลกระทบยังไม่มีแหล่งที่มาหรือเหตุผลประกอบ'],
        ['~^Outcome "(.*)" rests on an assumption rather than evidence\.$~us', 'ผลลัพธ์ "{1}" อาศัยสมมติฐานมากกว่าหลักฐาน'],
        ['~^Outcome "(.*)": the financial proxy has no source or stated rationale\.$~us', 'ผลลัพธ์ "{1}": ตัวแทนทางการเงินยังไม่มีแหล่งที่มาหรือเหตุผลประกอบ'],
        ['~^Outcome "(.*)" uses independently measured annual quantities, so its drop-off was NOT applied \(applying both would double-count the decline\)\.$~us', 'ผลลัพธ์ "{1}" ใช้จำนวนที่วัดอิสระรายปี จึงไม่ได้นำ Drop-off มาคำนวณ (การใช้ทั้งสองอย่างจะนับการลดลงซ้ำ)'],
        ['~^Outcomes sharing overlap group "(.*)" may count the same value more than once: (.*)\.$~us', 'ผลลัพธ์ในกลุ่มที่ซ้อนทับกัน "{1}" อาจนับมูลค่าเดียวกันมากกว่าหนึ่งครั้ง: {2}'],
        ['~^Outcome "(.*)" is listed more than once for the same stakeholder\.$~us', 'ผลลัพธ์ "{1}" ถูกระบุมากกว่าหนึ่งครั้งสำหรับผู้มีส่วนได้ส่วนเสียกลุ่มเดียวกัน'],
    ];

    private const TH = [
        // headline and layout
        'SROI ratio (gross)' => 'อัตราส่วน SROI (ก่อนหักต้นทุน)',
        'SROI' => 'SROI',
        'Estimated monetised social value per 1 {cur} invested' => 'มูลค่าทางสังคมที่ประเมินเป็นตัวเงิน ต่อเงินลงทุน 1 {cur}',
        'Present value of social impact' => 'มูลค่าปัจจุบันของผลกระทบทางสังคม',
        'Total investment' => 'เงินลงทุนรวม',
        'basis: {basis}' => 'เกณฑ์: {basis}',
        'Net social value' => 'มูลค่าทางสังคมสุทธิ',
        'Net return: {pct}' => 'ผลตอบแทนสุทธิ: {pct}',
        'Scenario: {name}' => 'สถานการณ์: {name}',
        'Methodology v{v}' => 'ระเบียบวิธี v{v}',
        'Generated {at}' => 'สร้างเมื่อ {at}',
        'Input fingerprint {hash}' => 'รหัสตรวจสอบข้อมูลนำเข้า {hash}',
        'n/a' => 'ไม่มีข้อมูล',
        'None.' => 'ไม่มีรายการ',
        'yes' => 'ใช่',
        'no' => 'ไม่',
        'not assessed' => 'ยังไม่ได้ประเมิน',
        // sections
        'Executive summary' => 'บทสรุปสำหรับผู้บริหาร',
        'Primary beneficiaries' => 'ผู้ได้รับประโยชน์หลัก',
        'Principal outcomes' => 'ผลลัพธ์หลัก',
        'Key limitations' => 'ข้อจำกัดสำคัญ',
        'Methodology' => 'ระเบียบวิธี',
        'Stakeholders' => 'ผู้มีส่วนได้ส่วนเสีย',
        'Theory of change' => 'ทฤษฎีการเปลี่ยนแปลง (Theory of Change)',
        'Financial proxies and evidence' => 'ตัวแทนทางการเงินและหลักฐาน',
        'Impact adjustments (assumptions register)' => 'การปรับผลกระทบ (ทะเบียนสมมติฐาน)',
        'Investment' => 'เงินลงทุน',
        'Outcome-by-outcome calculations' => 'การคำนวณรายผลลัพธ์',
        'Results' => 'ผลการประเมิน',
        'By stakeholder' => 'แยกตามผู้มีส่วนได้ส่วนเสีย',
        'Annual investment and impact' => 'เงินลงทุนและผลกระทบรายปี',
        'Scenario comparison' => 'การเปรียบเทียบสถานการณ์',
        'Sensitivity' => 'การวิเคราะห์ความอ่อนไหว',
        'Sensitivity (top drivers)' => 'การวิเคราะห์ความอ่อนไหว (ปัจจัยที่มีผลมากที่สุด)',
        'Unmonetised and negative impacts' => 'ผลลัพธ์ที่ไม่ได้ประเมินเป็นตัวเงินและผลกระทบเชิงลบ',
        'Limitations' => 'ข้อจำกัด',
        'Sources' => 'แหล่งอ้างอิง',
        // table headers
        'Stakeholder' => 'ผู้มีส่วนได้ส่วนเสีย',
        'Share of positive value %' => 'สัดส่วนมูลค่าเชิงบวก (%)',
        'Outcome' => 'ผลลัพธ์',
        'Present value' => 'มูลค่าปัจจุบัน',
        'Name' => 'ชื่อ',
        'Description' => 'รายละเอียด',
        'Estimated reach' => 'จำนวนผู้ได้รับผลกระทบโดยประมาณ',
        'Activity' => 'กิจกรรม',
        'Output' => 'ผลผลิต',
        'Indicator' => 'ตัวชี้วัด',
        'Baseline' => 'ค่าฐานก่อนเริ่มโครงการ',
        'Observed' => 'ผลที่สังเกตได้',
        'Quantity' => 'จำนวน',
        'Proxy / unit' => 'ตัวแทนทางการเงิน / หน่วย',
        'Source' => 'แหล่งที่มา',
        'Evidence quality' => 'คุณภาพของหลักฐาน',
        'Deadweight' => 'Deadweight (ผลที่เกิดขึ้นเองอยู่แล้ว)',
        'Attribution' => 'Attribution (ผลจากปัจจัยอื่น)',
        'Displacement' => 'Displacement (การย้ายที่ของผลกระทบ)',
        'Drop-off' => 'Drop-off (การลดลงของผล)',
        'Basis' => 'เหตุผลประกอบ',
        'Edited by' => 'แก้ไขโดย',
        'Category' => 'หมวดหมู่',
        'Year' => 'ปี',
        'Amount ({cur})' => 'จำนวนเงิน ({cur})',
        'Counted' => 'นับรวม',
        'Gross' => 'มูลค่าเต็ม',
        'After drop-off' => 'หลังหัก Drop-off',
        'Adjusted' => 'หลังปรับผลกระทบ',
        'Discount factor' => 'ตัวคูณคิดลด',
        'Positive' => 'เชิงบวก',
        'Negative' => 'เชิงลบ',
        'Net' => 'สุทธิ',
        'Investment amount' => 'เงินลงทุน',
        'Adjusted impact' => 'ผลกระทบหลังปรับ',
        'Cumulative PV' => 'มูลค่าปัจจุบันสะสม',
        'Scenario' => 'สถานการณ์',
        'Status' => 'สถานะ',
        'Driver' => 'ปัจจัย',
        'Low value' => 'ค่าต่ำ',
        'High value' => 'ค่าสูง',
        'PV low' => 'มูลค่าปัจจุบัน (ต่ำ)',
        'PV high' => 'มูลค่าปัจจุบัน (สูง)',
        'Kind' => 'ประเภท',
        'Title' => 'ชื่อเรื่อง',
        'Reference' => 'การอ้างอิง',
        // sentences
        'Excluded from totals.' => 'ไม่นำมารวมในผลรวม',
        'Not monetised — reported qualitatively.' => 'ไม่ได้ประเมินเป็นตัวเงิน — รายงานเชิงคุณภาพเท่านั้น',
        'Discount rate {rate}% ({basis}; source: {source}). Analysis period {years} years; discount base year {base}. Investment basis: {ibasis}. In-kind resources {inkind}. Price basis: {price}.' => 'อัตราคิดลด {rate}% ({basis}; แหล่งที่มา: {source}) ระยะเวลาประเมิน {years} ปี ปีฐานการคิดลด {base} เกณฑ์เงินลงทุน: {ibasis} สิ่งสนับสนุน (In-kind) {inkind} เกณฑ์ราคา: {price}',
        'basis not stated' => 'ไม่ได้ระบุเกณฑ์',
        'not stated' => 'ไม่ได้ระบุ',
        'included' => 'นับรวม',
        'excluded' => 'ไม่นับรวม',
        // standard limitation / methodology sentences
        'The SROI ratio is an estimate that depends on the stated proxies and assumptions; it is not proof that the project is effective.' => 'อัตราส่วน SROI เป็นค่าประมาณที่ขึ้นอยู่กับตัวแทนทางการเงินและสมมติฐานที่ระบุไว้ ไม่ใช่หลักฐานยืนยันว่าโครงการมีประสิทธิผล',
        'Financial proxies are monetary estimates of value, not cash received or verified income.' => 'ตัวแทนทางการเงินเป็นการประเมินมูลค่าเป็นตัวเงิน ไม่ใช่เงินสดที่ได้รับจริงหรือรายได้ที่ตรวจสอบแล้ว',
        'This is a calculator output, not an independently assured SROI analysis.' => 'เอกสารนี้เป็นผลจากเครื่องมือคำนวณ ไม่ใช่การวิเคราะห์ SROI ที่ผ่านการสอบทานโดยหน่วยงานอิสระ',
        'Total investment is zero, so the SROI ratio is undefined. Net social value is still reported.' => 'เงินลงทุนรวมเป็นศูนย์ จึงไม่สามารถคำนวณอัตราส่วน SROI ได้ แต่ยังรายงานมูลค่าทางสังคมสุทธิ',
        'No monetised outcomes are included, so social value is zero.' => 'ไม่มีผลลัพธ์ที่ประเมินเป็นตัวเงินรวมอยู่ในการคำนวณ มูลค่าทางสังคมจึงเป็นศูนย์',
        'More than half of the monetised value rests on estimated or assumed inputs. Treat the ratio as indicative, not proven.' => 'มูลค่าที่ประเมินเป็นตัวเงินมากกว่าครึ่งหนึ่งอาศัยข้อมูลประมาณการหรือสมมติฐาน ควรถือว่าอัตราส่วนนี้เป็นเพียงตัวบ่งชี้ ไม่ใช่ข้อสรุปที่พิสูจน์แล้ว',
        'One-at-a-time changes around the selected scenario. These are not statistical confidence intervals.' => 'เป็นการเปลี่ยนค่าทีละปัจจัยรอบสถานการณ์ที่เลือก ไม่ใช่ช่วงความเชื่อมั่นทางสถิติ',
        'gross value = quantity x financial proxy' => 'มูลค่าเต็ม = จำนวน x ตัวแทนทางการเงิน',
        'adjusted impact = gross x persistence x (1 - deadweight) x (1 - attribution) x (1 - displacement)' => 'ผลกระทบหลังปรับ = มูลค่าเต็ม x การคงอยู่ของผล x (1 - Deadweight) x (1 - Attribution) x (1 - Displacement)',
        'present value = adjusted impact / (1 + discount rate) ^ max(0, year - discount base year)' => 'มูลค่าปัจจุบัน = ผลกระทบหลังปรับ / (1 + อัตราคิดลด) ^ max(0, ปี - ปีฐานการคิดลด)',
        'SROI = total present value of social impact / total investment' => 'SROI = มูลค่าปัจจุบันรวมของผลกระทบทางสังคม / เงินลงทุนรวม',
        'net social value = total present value of social impact - total investment' => 'มูลค่าทางสังคมสุทธิ = มูลค่าปัจจุบันรวมของผลกระทบทางสังคม - เงินลงทุนรวม',
        // csv headers
        'outcome_id' => 'รหัสผลลัพธ์',
        'outcome' => 'ผลลัพธ์',
        'stakeholder' => 'ผู้มีส่วนได้ส่วนเสีย',
        'polarity' => 'ทิศทางผลกระทบ',
        'evidence_quality' => 'คุณภาพหลักฐาน',
        'included' => 'นับรวม',
        'year' => 'ปี',
        'quantity' => 'จำนวน',
        'gross_value' => 'มูลค่าเต็ม',
        'value_after_drop_off' => 'มูลค่าหลังหัก Drop-off',
        'adjusted_impact' => 'ผลกระทบหลังปรับ',
        'discount_factor' => 'ตัวคูณคิดลด',
        'present_value' => 'มูลค่าปัจจุบัน',
        'id' => 'รหัส',
        'category' => 'หมวดหมู่',
        'description' => 'รายละเอียด',
        'amount' => 'จำนวนเงิน',
        'currency' => 'สกุลเงิน',
        'exchange_rate' => 'อัตราแลกเปลี่ยน',
        'cash' => 'เงินสด',
        'counted_in_total' => 'นับรวมในผลรวม',
        'metric' => 'รายการ',
        'value' => 'ค่า',
        'investment' => 'เงินลงทุน',
        'investment_present_value' => 'มูลค่าปัจจุบันของเงินลงทุน',
        'cumulative_investment' => 'เงินลงทุนสะสม',
        'cumulative_adjusted_impact' => 'ผลกระทบหลังปรับสะสม',
        'cumulative_present_value' => 'มูลค่าปัจจุบันสะสม',
        'stakeholder_id' => 'รหัสผู้มีส่วนได้ส่วนเสีย',
        'name' => 'ชื่อ',
        'positive_present_value' => 'มูลค่าปัจจุบันเชิงบวก',
        'negative_present_value' => 'มูลค่าปัจจุบันเชิงลบ',
        'net_present_value' => 'มูลค่าปัจจุบันสุทธิ',
        'share_of_positive_pct' => 'สัดส่วนมูลค่าเชิงบวก (%)',
        'total_investment_nominal' => 'เงินลงทุนรวม (ตามราคาที่จ่ายจริง)',
        'total_investment_present_value' => 'เงินลงทุนรวม (มูลค่าปัจจุบัน)',
        'investment_used' => 'เงินลงทุนที่ใช้คำนวณ',
        'investment_basis' => 'เกณฑ์เงินลงทุน',
        'present_value_of_impact' => 'มูลค่าปัจจุบันของผลกระทบ',
        'adjusted_impact_undiscounted' => 'ผลกระทบหลังปรับ (ก่อนคิดลด)',
        'sroi_ratio' => 'อัตราส่วน SROI',
        'sroi_ratio_nominal_investment' => 'อัตราส่วน SROI (เงินลงทุนตามราคาที่จ่ายจริง)',
        'sroi_ratio_present_value_investment' => 'อัตราส่วน SROI (เงินลงทุนเป็นมูลค่าปัจจุบัน)',
        'net_social_value' => 'มูลค่าทางสังคมสุทธิ',
        'net_return_pct' => 'ผลตอบแทนสุทธิ (%)',
        'monetized_outcomes_included' => 'จำนวนผลลัพธ์ที่ประเมินเป็นตัวเงินและนับรวม',
        'unmonetized_outcomes' => 'จำนวนผลลัพธ์ที่ไม่ได้ประเมินเป็นตัวเงิน',
        'methodology_version' => 'เวอร์ชันระเบียบวิธี',
        'input_hash' => 'รหัสตรวจสอบข้อมูลนำเข้า',
        'generated_at' => 'สร้างเมื่อ',
    ];
}