<?php
declare(strict_types=1);

namespace App\Domain\Report;

/** Self-contained, print-ready HTML (use the browser's "Save as PDF" for full Unicode output). Everything is escaped. */
final class HtmlExporter
{
    /** @param array<string,mixed> $d */
    public function export(array $d): string
    {
        $cur = $d['headline']['currency'];
        $h = $d['headline'];
        $e = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $m = fn($v) => $v === null ? '—' : $e($cur . ' ' . number_format((float)$v, 2));
        $ratio = $h['sroi_ratio'] === null ? 'n/a' : rtrim(rtrim(number_format($h['sroi_ratio'], 2), '0'), '.') . ':1';

        $o = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<title>' . $e($d['meta']['title']) . '</title><style>'
            . 'body{font:14px/1.5 system-ui,sans-serif;color:#0f172a;max-width:960px;margin:2rem auto;padding:0 1rem}'
            . 'h1{font-size:28px}h2{font-size:20px;margin-top:2rem;border-bottom:1px solid #e2e8f0;padding-bottom:.25rem}'
            . '.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}'
            . '.card{border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#fff}.card b{display:block;font-size:22px}'
            . 'table{border-collapse:collapse;width:100%;margin:.5rem 0;font-size:13px}th,td{border:1px solid #e2e8f0;padding:4px 8px;text-align:left}'
            . 'td.n{text-align:right;font-variant-numeric:tabular-nums}th{background:#f8fafc}.neg{color:#b91c1c}.small{color:#64748b;font-size:12px}'
            . '</style></head><body>';
        $o .= '<h1>' . $e($d['meta']['title']) . '</h1>';
        $o .= '<p class="small">' . $e($d['project']['organization_name'] ?? '') . ' · Scenario: ' . $e($d['meta']['scenario']['name'])
            . ' · Methodology v' . $e($d['meta']['methodology_version']) . ' · Generated ' . $e($d['meta']['generated_at'])
            . ' · Input fingerprint ' . $e(substr($d['meta']['input_hash'], 0, 12)) . '</p>';
        $o .= '<div class="cards">'
            . '<div class="card">SROI ratio (gross)<b>' . $e($ratio) . '</b><span class="small">Estimated monetised social value per 1 ' . $e($cur) . ' invested</span></div>'
            . '<div class="card">Present value of social impact<b>' . $m($h['present_value_of_impact']) . '</b></div>'
            . '<div class="card">Total investment<b>' . $m($h['investment_used']) . '</b><span class="small">basis: ' . $e($h['investment_basis']) . '</span></div>'
            . '<div class="card">Net social value<b>' . $m($h['net_social_value']) . '</b><span class="small">Net return: ' . ($h['net_return_pct'] === null ? 'n/a' : $e($h['net_return_pct']) . '%') . '</span></div></div>';

        $o .= '<h2>Executive summary</h2>' . $this->p($e($d['project']['description'] ?? ''));
        $o .= '<h3>Primary beneficiaries</h3>' . $this->table(['Stakeholder', 'Share of positive value %'],
            array_map(fn($s) => [$e($s['name']), $e($s['share_of_positive_pct'])], $d['executive_summary']['primary_beneficiaries']), [1]);
        $o .= '<h3>Principal outcomes</h3>' . $this->table(['Outcome', 'Stakeholder', 'Present value'],
            array_map(fn($x) => [$e($x['name']), $e($x['stakeholder']), $m($x['present_value'])], $d['executive_summary']['principal_outcomes']), [2]);
        $o .= '<h3>Key limitations</h3><ul>' . implode('', array_map(fn($l) => '<li>' . $e($l) . '</li>', $d['executive_summary']['key_limitations'])) . '</ul>';

        $prof = $d['methodology']['profile'];
        $o .= '<h2>Methodology</h2><ul>' . implode('', array_map(fn($f) => '<li>' . $e($f) . '</li>', $d['methodology']['formulas'])) . '</ul>'
            . '<p class="small">Discount rate ' . $e(round($prof['discount_rate'] * 100, 2)) . '% (' . $e($prof['discount_rate_basis'] ?? 'basis not stated') . '; source: '
            . $e($prof['discount_rate_source'] ?? 'not stated') . '). Analysis period ' . $e($prof['analysis_period_years']) . ' years; discount base year '
            . $e($prof['discount_base_year']) . '. Investment basis: ' . $e($prof['investment_basis']) . '. In-kind resources '
            . ($prof['include_in_kind'] ? 'included' : 'excluded') . '. Price basis: ' . $e($prof['price_basis'] ?? 'not stated') . '.</p>';

        if ($d['meta']['type'] === 'detailed') {
            $o .= '<h2>Stakeholders</h2>' . $this->table(['Name', 'Description', 'Estimated reach'],
                array_map(fn($s) => [$e($s['name']), $e($s['description']), $e($s['estimated_count'])], $d['stakeholders']), [2]);
            $o .= '<h2>Theory of change</h2>' . $this->table(['Activity', 'Output', 'Outcome', 'Indicator', 'Baseline', 'Observed'],
                array_map(fn($t) => [$e($t['activity']), $e($t['output']), $e($t['outcome']), $e($t['indicator']), $e($t['baseline']), $e($t['observed_result'])], $d['theory_of_change']));
            $o .= '<h2>Financial proxies and evidence</h2>' . $this->table(['Outcome', 'Quantity', 'Proxy / unit', 'Source', 'Evidence quality'],
                array_map(fn($p) => [$e($p['outcome']), $e($p['quantity']), $m($p['proxy_value']) . ' ' . $e($p['unit']), $e($p['source'] ?: $p['rationale']), $e($p['evidence_quality'])], $d['financial_proxies']), [1]);
            $o .= '<h2>Impact adjustments (assumptions register)</h2>' . $this->table(['Outcome', 'Deadweight', 'Attribution', 'Displacement', 'Drop-off', 'Basis', 'Edited by'],
                array_map(fn($a) => [$e($a['outcome']), $this->pct($a['deadweight']), $this->pct($a['attribution']), $this->pct($a['displacement']), $this->pct($a['drop_off']),
                    $e(trim(($a['justification'] ?? '') . ' ' . ($a['source'] ?? ''))), $e(($a['last_edited_by'] ?? '') . ' ' . ($a['last_edited_at'] ?? ''))], $d['assumptions_register']));
            $o .= '<h2>Investment</h2>' . $this->table(['Category', 'Description', 'Year', 'Amount (' . $e($cur) . ')', 'Counted'],
                array_map(fn($c) => [$e($c['category']), $e($c['description']), $e($c['year']), $m($c['amount_in_project_currency']), $c['counted'] ? 'yes' : 'no'], $d['investment']['items']), [3]);
            $o .= '<h2>Outcome-by-outcome calculations</h2>';
            foreach ($d['outcome_calculations'] as $oc) {
                $o .= '<h3>' . $e($oc['name']) . ' <span class="small">(' . $e($oc['stakeholder_name']) . ', ' . $e($oc['polarity']) . ')</span></h3>';
                if (!$oc['included']) {
                    $o .= $this->p($oc['monetized'] ? 'Excluded from totals.' : 'Not monetised — reported qualitatively.');
                    continue;
                }
                $o .= $this->table(['Year', 'Quantity', 'Gross', 'After drop-off', 'Adjusted', 'Discount factor', 'Present value'],
                    array_map(fn($y) => [$e($y['year']), $e($y['quantity']), $m($y['gross_value']), $m($y['value_after_drop_off']), $m($y['adjusted_impact']), $e($y['discount_factor']), $m($y['present_value'])], $oc['years']), [1, 2, 3, 4, 5, 6]);
            }
            $o .= '<h2>Results</h2><h3>By stakeholder</h3>' . $this->table(['Stakeholder', 'Positive', 'Negative', 'Net'],
                array_map(fn($s) => [$e($s['name']), $m($s['positive_present_value']), $m($s['negative_present_value']), $m($s['net_present_value'])], $d['results']['by_stakeholder']), [1, 2, 3]);
            $o .= '<h3>Annual investment and impact</h3>' . $this->table(['Year', 'Investment', 'Adjusted impact', 'Present value', 'Cumulative PV'],
                array_map(fn($a) => [$e($a['year']), $m($a['investment']), $m($a['adjusted_impact']), $m($a['present_value']), $m($a['cumulative_present_value'])], $d['results']['annual']), [1, 2, 3, 4]);
            $o .= '<h2>Scenario comparison</h2>' . $this->table(['Scenario', 'SROI', 'Present value', 'Net social value', 'Status'],
                array_map(fn($s) => [$e($s['name']), $e($s['sroi_ratio'] ?? 'n/a'), $m($s['present_value_of_impact'] ?? null), $m($s['net_social_value'] ?? null), $e($s['status'])], $d['scenario_comparison']), [1, 2, 3]);
            if ($d['sensitivity']) {
                $o .= '<h2>Sensitivity</h2><p class="small">' . $e($d['sensitivity']['note']) . '</p>' . $this->table(['Driver', 'Low value', 'High value', 'PV low', 'PV high'],
                    array_map(fn($r) => [$e($r['label']), $e(round((float)$r['low_value'], 4)), $e(round((float)$r['high_value'], 4)), $m($r['present_value_low']), $m($r['present_value_high'])], $d['sensitivity']['top_drivers']), [1, 2, 3, 4]);
            }
            $o .= '<h2>Unmonetised and negative impacts</h2>' . $this->table(['Outcome', 'Stakeholder'],
                array_map(fn($u) => [$e($u['name']), $e($u['stakeholder_name'])], $d['unmonetized_outcomes']));
            $o .= '<h2>Limitations</h2><ul>' . implode('', array_map(fn($l) => '<li>' . $e($l) . '</li>', $d['limitations'])) . '</ul>';
            $o .= '<h2>Sources</h2>' . $this->table(['Kind', 'Title', 'Reference'], array_map(fn($s) => [$e($s['kind']), $e($s['title']), $e($s['reference'])], $d['sources']));
        }
        return $o . '</body></html>';
    }

    private function p(string $s): string
    {
        return $s === '' ? '' : "<p>$s</p>";
    }

    private function pct(mixed $v): string
    {
        return $v === null ? 'not assessed' : htmlspecialchars((string)round((float)$v * 100, 2)) . '%';
    }

    /** @param list<string> $head @param list<list<string>> $rows @param list<int> $numeric */
    private function table(array $head, array $rows, array $numeric = []): string
    {
        if ($rows === []) {
            return '<p class="small">None.</p>';
        }
        $t = '<table><thead><tr>' . implode('', array_map(fn($h) => "<th>$h</th>", $head)) . '</tr></thead><tbody>';
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
