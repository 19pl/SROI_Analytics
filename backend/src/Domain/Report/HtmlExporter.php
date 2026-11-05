<?php
declare(strict_types=1);

namespace App\Domain\Report;

/** Self-contained, print-ready HTML (use the browser's "Save as PDF" for full Unicode output). Everything is escaped. */
final class HtmlExporter
{
    private ReportStrings $s;

    public function __construct(?ReportStrings $strings = null)
    {
        $this->s = $strings ?? new ReportStrings();
    }

    /** @param array<string,mixed> $d */
    public function export(array $d): string
    {
        $cur = $d['headline']['currency'];
        $h = $d['headline'];
        $e = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $m = fn($v) => $v === null ? '—' : $e($cur . ' ' . number_format((float)$v, 2));
        $S = $this->s;
        $t = fn(string $k, array $v = []) => $S->t($k, $v);
        $te = fn(string $k, array $v = []) => $e($S->t($k, $v)); // translated and HTML-escaped
        $nar = fn($v) => $e($S->narrative((string)$v));
        $en = fn($v) => $e($S->enum($v === null ? null : (string)$v));
        $na = $t('n/a');
        $ratio = $h['sroi_ratio'] === null ? $na : rtrim(rtrim(number_format($h['sroi_ratio'], 2), '0'), '.') . ':1';

        $o = '<!doctype html><html lang="' . $S->lang() . '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<title>' . $e($d['meta']['title']) . '</title><style>'
            . 'body{font:14px/1.5 "Sarabun","Noto Sans Thai",Tahoma,system-ui,sans-serif;color:#0f172a;max-width:960px;margin:2rem auto;padding:0 1rem}'
            . 'h1{font-size:28px}h2{font-size:20px;margin-top:2rem;border-bottom:1px solid #e2e8f0;padding-bottom:.25rem}'
            . '.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}'
            . '.card{border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#fff}.card b{display:block;font-size:22px}'
            . 'table{border-collapse:collapse;width:100%;margin:.5rem 0;font-size:13px}th,td{border:1px solid #e2e8f0;padding:4px 8px;text-align:left}'
            . 'td.n{text-align:right;font-variant-numeric:tabular-nums}th{background:#f8fafc}.neg{color:#b91c1c}.small{color:#64748b;font-size:12px}'
            . 'th,td{overflow-wrap:anywhere;word-break:break-word;vertical-align:top}.card{min-width:0;overflow-wrap:anywhere}.card b{font-size:20px}img,svg{max-width:100%}'
            . '@page{size:A4;margin:14mm}'
            . '@media print{body{max-width:none;margin:0;padding:0;font-size:11px}h1{font-size:22px}h2{font-size:17px;break-after:avoid}h3{break-after:avoid}'
            . 'table{font-size:10px}thead{display:table-header-group}tr,.card{break-inside:avoid}p,li{orphans:3;widows:3}}'
            . '</style></head><body>';
        $o .= '<h1>' . $e($d['meta']['title']) . '</h1>';
        $o .= '<p class="small">' . $e($d['project']['organization_name'] ?? '') . ' · ' . $te('Scenario: {name}', ['name' => $S->scenario((string)$d['meta']['scenario']['name'])])
            . ' · ' . $te('Methodology v{v}', ['v' => $d['meta']['methodology_version']]) . ' · ' . $te('Generated {at}', ['at' => $d['meta']['generated_at']])
            . ' · ' . $te('Input fingerprint {hash}', ['hash' => substr($d['meta']['input_hash'], 0, 12)]) . '</p>';
        $o .= '<div class="cards">'
            . '<div class="card">' . $te('SROI ratio (gross)') . '<b>' . $e($ratio) . '</b><span class="small">' . $te('Estimated monetised social value per 1 {cur} invested', ['cur' => $cur]) . '</span></div>'
            . '<div class="card">' . $te('Present value of social impact') . '<b>' . $m($h['present_value_of_impact']) . '</b></div>'
            . '<div class="card">' . $te('Total investment') . '<b>' . $m($h['investment_used']) . '</b><span class="small">' . $te('basis: {basis}', ['basis' => $S->enum((string)$h['investment_basis'])]) . '</span></div>'
            . '<div class="card">' . $te('Net social value') . '<b>' . $m($h['net_social_value']) . '</b><span class="small">' . $te('Net return: {pct}', ['pct' => $h['net_return_pct'] === null ? $na : $h['net_return_pct'] . '%']) . '</span></div></div>';

        $o .= '<h2>' . $te('Executive summary') . '</h2>' . $this->p($e($d['project']['description'] ?? ''));
        $o .= '<h3>' . $te('Primary beneficiaries') . '</h3>' . $this->table([$t('Stakeholder'), $t('Share of positive value %')],
            array_map(fn($s) => [$e($s['name']), $e($s['share_of_positive_pct'])], $d['executive_summary']['primary_beneficiaries']), [1]);
        $o .= '<h3>' . $te('Principal outcomes') . '</h3>' . $this->table([$t('Outcome'), $t('Stakeholder'), $t('Present value')],
            array_map(fn($x) => [$e($x['name']), $e($x['stakeholder']), $m($x['present_value'])], $d['executive_summary']['principal_outcomes']), [2]);
        $o .= '<h3>' . $te('Key limitations') . '</h3><ul>' . implode('', array_map(fn($l) => '<li>' . $nar($l) . '</li>', $d['executive_summary']['key_limitations'])) . '</ul>';

        $prof = $d['methodology']['profile'];
        $o .= '<h2>' . $te('Methodology') . '</h2><ul>' . implode('', array_map(fn($f) => '<li>' . $nar($f) . '</li>', $d['methodology']['formulas'])) . '</ul>'
            . '<p class="small">' . $te('Discount rate {rate}% ({basis}; source: {source}). Analysis period {years} years; discount base year {base}. Investment basis: {ibasis}. In-kind resources {inkind}. Price basis: {price}.', [
                'rate' => round($prof['discount_rate'] * 100, 2),
                'basis' => $prof['discount_rate_basis'] ?? $t('basis not stated'),
                'source' => $prof['discount_rate_source'] ?? $t('not stated'),
                'years' => $prof['analysis_period_years'],
                'base' => $prof['discount_base_year'],
                'ibasis' => $S->enum((string)$prof['investment_basis']),
                'inkind' => $t($prof['include_in_kind'] ? 'included' : 'excluded'),
                'price' => $prof['price_basis'] ?? $t('not stated'),
            ]) . '</p>';

        if ($d['meta']['type'] === 'detailed') {
            $o .= '<h2>' . $te('Stakeholders') . '</h2>' . $this->table([$t('Name'), $t('Description'), $t('Estimated reach')],
                array_map(fn($s) => [$e($s['name']), $e($s['description']), $e($s['estimated_count'])], $d['stakeholders']), [2]);
            $o .= '<h2>' . $te('Theory of change') . '</h2>' . $this->table([$t('Activity'), $t('Output'), $t('Outcome'), $t('Indicator'), $t('Baseline'), $t('Observed')],
                array_map(fn($t) => [$e($t['activity']), $e($t['output']), $e($t['outcome']), $e($t['indicator']), $e($t['baseline']), $e($t['observed_result'])], $d['theory_of_change']));
            $o .= '<h2>' . $te('Financial proxies and evidence') . '</h2>' . $this->table([$t('Outcome'), $t('Quantity'), $t('Proxy / unit'), $t('Source'), $t('Evidence quality')],
                array_map(fn($p) => [$e($p['outcome']), $e($p['quantity']), $m($p['proxy_value']) . ' ' . $e($p['unit']), $e($p['source'] ?: $p['rationale']), $en($p['evidence_quality'])], $d['financial_proxies']), [1]);
            $o .= '<h2>' . $te('Impact adjustments (assumptions register)') . '</h2>' . $this->table([$t('Outcome'), $t('Deadweight'), $t('Attribution'), $t('Displacement'), $t('Drop-off'), $t('Basis'), $t('Edited by')],
                array_map(fn($a) => [$e($a['outcome']), $this->pct($a['deadweight']), $this->pct($a['attribution']), $this->pct($a['displacement']), $this->pct($a['drop_off']),
                    $e(trim(($a['justification'] ?? '') . ' ' . ($a['source'] ?? ''))), $e(($a['last_edited_by'] ?? '') . ' ' . ($a['last_edited_at'] ?? ''))], $d['assumptions_register']));
            $o .= '<h2>' . $te('Investment') . '</h2>' . $this->table([$t('Category'), $t('Description'), $t('Year'), $t('Amount ({cur})', ['cur' => $cur]), $t('Counted')],
                array_map(fn($c) => [$en($c['category']), $e($c['description']), $e($c['year']), $m($c['amount_in_project_currency']), $t($c['counted'] ? 'yes' : 'no')], $d['investment']['items']), [3]);
            $o .= '<h2>' . $te('Outcome-by-outcome calculations') . '</h2>';
            foreach ($d['outcome_calculations'] as $oc) {
                $o .= '<h3>' . $e($oc['name']) . ' <span class="small">(' . $e($oc['stakeholder_name']) . ', ' . $en($oc['polarity']) . ')</span></h3>';
                if (!$oc['included']) {
                    $o .= $this->p($te($oc['monetized'] ? 'Excluded from totals.' : 'Not monetised — reported qualitatively.'));
                    continue;
                }
                $o .= $this->table([$t('Year'), $t('Quantity'), $t('Gross'), $t('After drop-off'), $t('Adjusted'), $t('Discount factor'), $t('Present value')],
                    array_map(fn($y) => [$e($y['year']), $e($y['quantity']), $m($y['gross_value']), $m($y['value_after_drop_off']), $m($y['adjusted_impact']), $e($y['discount_factor']), $m($y['present_value'])], $oc['years']), [1, 2, 3, 4, 5, 6]);
            }
            $o .= '<h2>' . $te('Results') . '</h2><h3>' . $te('By stakeholder') . '</h3>' . $this->table([$t('Stakeholder'), $t('Positive'), $t('Negative'), $t('Net')],
                array_map(fn($s) => [$e($s['name']), $m($s['positive_present_value']), $m($s['negative_present_value']), $m($s['net_present_value'])], $d['results']['by_stakeholder']), [1, 2, 3]);
            $o .= '<h3>' . $te('Annual investment and impact') . '</h3>' . $this->table([$t('Year'), $t('Investment amount'), $t('Adjusted impact'), $t('Present value'), $t('Cumulative PV')],
                array_map(fn($a) => [$e($a['year']), $m($a['investment']), $m($a['adjusted_impact']), $m($a['present_value']), $m($a['cumulative_present_value'])], $d['results']['annual']), [1, 2, 3, 4]);
            $o .= '<h2>' . $te('Scenario comparison') . '</h2>' . $this->table([$t('Scenario'), $t('SROI'), $t('Present value'), $t('Net social value'), $t('Status')],
                array_map(fn($sc) => [$e($S->scenario((string)$sc['name'])), $e($sc['sroi_ratio'] ?? $na), $m($sc['present_value_of_impact'] ?? null), $m($sc['net_social_value'] ?? null), $en($sc['status'])], $d['scenario_comparison']), [1, 2, 3]);
            if ($d['sensitivity']) {
                $o .= '<h2>' . $te('Sensitivity') . '</h2><p class="small">' . $nar($d['sensitivity']['note']) . '</p>' . $this->table([$t('Driver'), $t('Low value'), $t('High value'), $t('PV low'), $t('PV high')],
                    array_map(fn($r) => [$e($S->driver((string)$r['label'])), $e(round((float)$r['low_value'], 4)), $e(round((float)$r['high_value'], 4)), $m($r['present_value_low']), $m($r['present_value_high'])], $d['sensitivity']['top_drivers']), [1, 2, 3, 4]);
            }
            $o .= '<h2>' . $te('Unmonetised and negative impacts') . '</h2>' . $this->table([$t('Outcome'), $t('Stakeholder')],
                array_map(fn($u) => [$e($u['name']), $e($u['stakeholder_name'])], $d['unmonetized_outcomes']));
            $o .= '<h2>' . $te('Limitations') . '</h2><ul>' . implode('', array_map(fn($l) => '<li>' . $nar($l) . '</li>', $d['limitations'])) . '</ul>';
            $o .= '<h2>' . $te('Sources') . '</h2>' . $this->table([$t('Kind'), $t('Title'), $t('Reference')], array_map(fn($s) => [$e($s['kind']), $e($s['title']), $e($s['reference'])], $d['sources']));
        }
        return $o . '</body></html>';
    }

    private function p(string $s): string
    {
        return $s === '' ? '' : "<p>$s</p>";
    }

    private function pct(mixed $v): string
    {
        return $v === null ? htmlspecialchars($this->s->t('not assessed')) : htmlspecialchars((string)round((float)$v * 100, 2)) . '%';
    }

    /** @param list<string> $head @param list<list<string>> $rows @param list<int> $numeric */
    private function table(array $head, array $rows, array $numeric = []): string
    {
        if ($rows === []) {
            return '<p class="small">' . htmlspecialchars($this->s->t('None.')) . '</p>';
        }
        $t = '<table><thead><tr>' . implode('', array_map(fn($h) => '<th>' . htmlspecialchars((string)$h, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</th>', $head)) . '</tr></thead><tbody>';
        foreach ($rows as $r) {
            $t .= '<tr>';
            foreach ($r as $i => $c) {
                $t .= '<td' . (in_array($i, $numeric, true) ? ' class="n"' : '') . ">$c</td>";
            }
            $t .= '</tr>';
        }
        return $t . '</tbody></table>';
    }
}