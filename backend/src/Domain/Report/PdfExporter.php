<?php
declare(strict_types=1);

namespace App\Domain\Report;

/**
 * Minimal PDF 1.4 writer (no dependencies): A4, built-in Helvetica/Courier fonts, tables, simple bar charts.
 * Built-in fonts are Latin-1 only, so non-Latin characters (e.g. Thai) are replaced with "?" and the baht sign with "THB".
 * For full Unicode output use the HTML export and print to PDF.
 */
final class PdfExporter
{
    private const W = 595.28;
    private const H = 841.89;
    private const M = 50.0;

    /** @var list<string> */
    private array $pages = [];
    private string $cur = '';
    private float $y = 0.0;

    /** @param array<string,mixed> $d */
    public function export(array $d): string
    {
        $this->pages = [];
        $this->newPage();
        $cur = $d['headline']['currency'];
        $h = $d['headline'];
        $money = fn($v) => $v === null ? '-' : $cur . ' ' . number_format((float)$v, 2);

        $this->text($d['meta']['title'], 'F2', 20);
        $this->y -= 6;
        $this->para(($d['project']['organization_name'] ?? '') . ' | Scenario: ' . $d['meta']['scenario']['name'] . ' | Methodology v' . $d['meta']['methodology_version']
            . ' | Generated ' . $d['meta']['generated_at'], 8.5);
        $this->para('Input fingerprint ' . substr($d['meta']['input_hash'], 0, 16), 8.5);
        $this->gap(8);

        $ratio = $h['sroi_ratio'] === null ? 'n/a' : rtrim(rtrim(number_format($h['sroi_ratio'], 2), '0'), '.') . ':1';
        $this->heading('Headline results');
        $this->table(['Metric', 'Value'], [
            ['SROI ratio (gross)', $ratio],
            ['Present value of social impact', $money($h['present_value_of_impact'])],
            ['Total investment (' . $h['investment_basis'] . ' basis)', $money($h['investment_used'])],
            ['Net social value', $money($h['net_social_value'])],
            ['Net return', $h['net_return_pct'] === null ? 'n/a' : $h['net_return_pct'] . '%'],
            ['Positive value / negative value', $money($h['positive_present_value']) . ' / ' . $money($h['negative_present_value'])],
        ], [38, 52]);
        $this->para('Estimated monetised social value per 1 ' . $cur . ' invested, under the stated assumptions and methodology.', 9);

        $this->heading('Executive summary');
        if (!empty($d['project']['description'])) {
            $this->para($d['project']['description']);
        }
        $this->table(['Primary beneficiary', 'Share of positive value'],
            array_map(fn($s) => [$s['name'], ($s['share_of_positive_pct'] ?? '-') . '%'], $d['executive_summary']['primary_beneficiaries']), [50, 40]);
        $this->bars('Principal outcomes (present value)', array_map(fn($o) => [$o['name'], (float)$o['present_value']], $d['executive_summary']['principal_outcomes']), $cur);
        $this->heading('Key limitations', 12);
        foreach ($d['executive_summary']['key_limitations'] as $l) {
            $this->para('- ' . $l, 9);
        }

        $p = $d['methodology']['profile'];
        $this->heading('Methodology');
        foreach ($d['methodology']['formulas'] as $f) {
            $this->para('- ' . $f, 9);
        }
        $this->para(sprintf('Discount rate %s%% (%s; source: %s). Analysis period %d years; discount base year %d. Investment basis: %s. In-kind resources %s. Price basis: %s.',
            round($p['discount_rate'] * 100, 2), $p['discount_rate_basis'] ?? 'basis not stated', $p['discount_rate_source'] ?? 'not stated',
            $p['analysis_period_years'], $p['discount_base_year'], $p['investment_basis'], $p['include_in_kind'] ? 'included' : 'excluded', $p['price_basis'] ?? 'not stated'), 9);

        if ($d['meta']['type'] === 'detailed') {
            $this->heading('Stakeholders');
            $this->table(['Name', 'Reach', 'Description'], array_map(fn($s) => [$s['name'], (string)($s['estimated_count'] ?? ''), (string)$s['description']], $d['stakeholders']), [26, 8, 56]);
            $this->heading('Theory of change');
            $this->table(['Activity', 'Output', 'Outcome', 'Indicator'], array_map(fn($t) => [(string)$t['activity'], (string)$t['output'], $t['outcome'], (string)$t['indicator']], $d['theory_of_change']), [22, 22, 22, 24]);
            $this->heading('Financial proxies and evidence');
            $this->table(['Outcome', 'Qty', 'Proxy', 'Quality', 'Source'], array_map(fn($x) => [$x['outcome'], (string)$x['quantity'],
                $x['proxy_value'] === null ? 'none' : number_format((float)$x['proxy_value'], 2), $x['evidence_quality'], (string)($x['source'] ?: $x['rationale'])], $d['financial_proxies']), [22, 7, 12, 10, 39]);
            $this->heading('Impact adjustments / assumptions register');
            $pc = fn($v) => $v === null ? 'n/a' : round($v * 100, 1) . '%';
            $this->table(['Outcome', 'DW', 'Attr', 'Disp', 'Drop', 'Basis / editor'], array_map(fn($a) => [$a['outcome'], $pc($a['deadweight']), $pc($a['attribution']), $pc($a['displacement']), $pc($a['drop_off']),
                trim(($a['justification'] ?? '') . ' ' . ($a['source'] ?? '') . ' [' . ($a['last_edited_by'] ?? '?') . ' ' . ($a['last_edited_at'] ?? '') . ']')], $d['assumptions_register']), [20, 6, 6, 6, 6, 46]);
            $this->heading('Investment');
            $this->table(['Category', 'Description', 'Yr', 'Amount', 'Counted'], array_map(fn($c) => [$c['category'], $c['description'], (string)$c['year'],
                number_format($c['amount_in_project_currency'], 2), $c['counted'] ? 'yes' : 'no'], $d['investment']['items']), [14, 38, 5, 18, 9]);
            $this->heading('Outcome-by-outcome calculations');
            foreach ($d['outcome_calculations'] as $oc) {
                $this->heading($oc['name'] . ' (' . $oc['stakeholder_name'] . ', ' . $oc['polarity'] . ')', 10.5);
                if (!$oc['included']) {
                    $this->para($oc['monetized'] ? 'Excluded from totals.' : 'Not monetised - reported qualitatively.', 9);
                    continue;
                }
                $this->table(['Yr', 'Qty', 'Gross', 'Adjusted', 'DF', 'Present value'], array_map(fn($y) => [(string)$y['year'], (string)round($y['quantity'], 2), number_format($y['gross_value'], 2),
                    number_format($y['adjusted_impact'], 2), (string)round($y['discount_factor'], 4), number_format($y['present_value'], 2)], $oc['years']), [5, 10, 17, 17, 11, 17]);
            }
            $this->heading('Results');
            $this->bars('Net value by stakeholder', array_map(fn($s) => [$s['name'], (float)$s['net_present_value']], $d['results']['by_stakeholder']), $cur);
            $this->table(['Year', 'Investment', 'Adjusted impact', 'Present value', 'Cum. PV'], array_map(fn($a) => [(string)$a['year'], number_format($a['investment'], 2),
                number_format($a['adjusted_impact'], 2), number_format($a['present_value'], 2), number_format($a['cumulative_present_value'], 2)], $d['results']['annual']), [6, 17, 20, 20, 20]);
            $this->heading('Scenario comparison');
            $this->table(['Scenario', 'SROI', 'Present value', 'Net social value'], array_map(fn($s) => [$s['name'], (string)($s['sroi_ratio'] ?? 'n/a'),
                isset($s['present_value_of_impact']) ? number_format($s['present_value_of_impact'], 2) : $s['status'], isset($s['net_social_value']) ? number_format($s['net_social_value'], 2) : '-'], $d['scenario_comparison']), [26, 10, 26, 26]);
            if ($d['sensitivity']) {
                $this->heading('Sensitivity (top drivers)');
                $this->para($d['sensitivity']['note'], 8.5);
                $this->table(['Driver', 'PV low', 'PV high'], array_map(fn($r) => [$r['label'], number_format($r['present_value_low'], 2), number_format($r['present_value_high'], 2)], $d['sensitivity']['top_drivers']), [50, 20, 20]);
            }
            $this->heading('Unmonetised outcomes');
            $this->table(['Outcome', 'Stakeholder'], array_map(fn($u) => [$u['name'], $u['stakeholder_name']], $d['unmonetized_outcomes']), [50, 40]);
            $this->heading('Limitations');
            foreach ($d['limitations'] as $l) {
                $this->para('- ' . $l, 9);
            }
            $this->heading('Sources');
            $this->table(['Kind', 'Title', 'Reference'], array_map(fn($s) => [$s['kind'], $s['title'], (string)$s['reference']], $d['sources']), [12, 38, 40]);
        }
        return $this->render($d['meta']['methodology_version'], substr($d['meta']['input_hash'], 0, 12));
    }

    // ---- layout primitives --------------------------------------------------------------------

    private function newPage(): void
    {
        if ($this->cur !== '') {
            $this->pages[] = $this->cur;
        }
        $this->cur = '';
        $this->y = self::H - self::M;
    }

    private function ensure(float $h): void
    {
        if ($this->y - $h < self::M + 20) {
            $this->newPage();
        }
    }

    private function gap(float $h): void
    {
        $this->y -= $h;
    }

    private function enc(string $s): string
    {
        $s = str_replace(['฿', "\r", "\t"], ['THB ', '', '  '], $s);
        $s = (string)iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $s);
        // iconv may drop untranslatable characters silently; replace remaining control characters
        return preg_replace('/[\x00-\x08\x0B-\x1F]/', '?', $s) ?? '';
    }

    private function esc(string $s): string
    {
        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $this->enc($s));
    }

    private function text(string $s, string $font, float $size, float $x = self::M): void
    {
        $this->ensure($size * 1.4);
        $this->y -= $size;
        $this->cur .= sprintf("BT /%s %.1f Tf %.2f %.2f Td (%s) Tj ET\n", $font, $size, $x, $this->y, $this->esc($s));
        $this->y -= $size * 0.35;
    }

    private function heading(string $s, float $size = 14): void
    {
        $this->ensure($size * 3);
        $this->gap($size * 0.6);
        $this->text($s, 'F2', $size);
        $this->gap(2);
    }

    private function para(string $s, float $size = 10): void
    {
        $per = (int)floor((self::W - 2 * self::M) / ($size * 0.5));
        foreach (explode("\n", wordwrap($this->enc($s), max(20, $per), "\n", true)) as $line) {
            $this->text($line, 'F1', $size);
        }
    }

    /** @param list<string> $head @param list<list<string>> $rows @param list<int> $widths character widths per column */
    private function table(array $head, array $rows, array $widths): void
    {
        if ($rows === []) {
            $this->para('None.', 9);
            return;
        }
        $size = 8.0;
        $fmt = function (array $cells) use ($widths): array {
            $wrapped = [];
            $lines = 1;
            foreach ($cells as $i => $c) {
                $w = $widths[$i] ?? 10;
                $parts = explode("\n", wordwrap($this->enc((string)$c), $w, "\n", true));
                $wrapped[$i] = $parts;
                $lines = max($lines, count($parts));
            }
            $out = [];
            for ($l = 0; $l < $lines; $l++) {
                $row = '';
                foreach ($wrapped as $i => $parts) {
                    $row .= str_pad($parts[$l] ?? '', ($widths[$i] ?? 10) + 1);
                }
                $out[] = rtrim($row);
            }
            return $out;
        };
        foreach ($fmt($head) as $line) {
            $this->mono($line, $size, true);
        }
        foreach ($rows as $r) {
            $lines = $fmt($r);
            $this->ensure(count($lines) * $size * 1.4);
            foreach ($lines as $line) {
                $this->mono($line, $size, false);
            }
        }
        $this->gap(4);
    }

    private function mono(string $line, float $size, bool $bold): void
    {
        $this->ensure($size * 1.4);
        $this->y -= $size * 1.15;
        $this->cur .= sprintf("BT /%s %.1f Tf %.2f %.2f Td (%s) Tj ET\n", $bold ? 'F4' : 'F3', $size, self::M, $this->y, $this->esc($line));
    }

    /** @param list<array{0:string,1:float}> $items */
    private function bars(string $title, array $items, string $cur): void
    {
        if ($items === []) {
            return;
        }
        $this->heading($title, 11);
        $max = max(1.0, max(array_map(fn($i) => abs($i[1]), $items)));
        $barMax = 230.0;
        foreach ($items as [$label, $v]) {
            $this->ensure(16);
            $this->y -= 12;
            $w = max(1.0, abs($v) / $max * $barMax);
            $this->cur .= sprintf("BT /F1 8 Tf %.2f %.2f Td (%s) Tj ET\n", self::M, $this->y, $this->esc(mb_strimwidth($label, 0, 34, '...')));
            $this->cur .= sprintf("%s rg %.2f %.2f %.2f 8 re f\n", $v >= 0 ? '0.08 0.50 0.24' : '0.73 0.11 0.11', self::M + 150, $this->y - 1, $w);
            $this->cur .= sprintf("0 g BT /F1 8 Tf %.2f %.2f Td (%s) Tj ET\n", self::M + 155 + $w, $this->y, $this->esc(number_format($v, 2) . ' ' . $cur));
            $this->cur .= "0 g\n";
        }
        $this->gap(4);
    }

    // ---- file assembly ------------------------------------------------------------------------

    private function render(string $version, string $hash): string
    {
        $this->pages[] = $this->cur;
        $this->cur = '';
        $n = count($this->pages);
        $objs = [];
        $objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        $kids = [];
        $fonts = '/F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R';
        $objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        $objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
        $objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>';
        $objs[6] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>';
        $next = 7;
        foreach ($this->pages as $i => $content) {
            $content .= sprintf("0 g BT /F1 7 Tf %.2f 30 Td (%s) Tj ET\n", self::M, $this->esc("ImpactValue - methodology v$version - fingerprint $hash - page " . ($i + 1) . " of $n"));
            $cid = $next++;
            $pid = $next++;
            $objs[$cid] = "<< /Length " . strlen($content) . " >>\nstream\n" . $content . "endstream";
            $objs[$pid] = sprintf('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] /Resources << /Font << %s >> >> /Contents %d 0 R >>', self::W, self::H, $fonts, $cid);
            $kids[] = "$pid 0 R";
        }
        $objs[2] = '<< /Type /Pages /Count ' . count($kids) . ' /Kids [' . implode(' ', $kids) . '] >>';
        ksort($objs);
        $out = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objs as $id => $body) {
            $offsets[$id] = strlen($out);
            $out .= "$id 0 obj\n$body\nendobj\n";
        }
        $xref = strlen($out);
        $max = max(array_keys($objs));
        $out .= "xref\n0 " . ($max + 1) . "\n0000000000 65535 f \n";
        for ($i = 1; $i <= $max; $i++) {
            $out .= sprintf("%010d 00000 n \n", $offsets[$i]);
        }
        return $out . "trailer\n<< /Size " . ($max + 1) . " /Root 1 0 R >>\nstartxref\n$xref\n%%EOF";
    }
}
