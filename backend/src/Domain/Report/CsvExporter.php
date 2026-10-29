<?php
declare(strict_types=1);

namespace App\Domain\Report;

/** CSV datasets from a report payload. Text cells that could be interpreted as formulas are neutralised. */
final class CsvExporter
{
    public const DATASETS = ['outcomes', 'investment', 'results', 'annual', 'stakeholders'];

    /** @param array<string,mixed> $doc */
    public function export(array $doc, string $dataset): string
    {
        $currency = $doc['headline']['currency'];
        switch ($dataset) {
            case 'investment':
                $rows = [['id', 'category', 'description', 'year', 'amount', 'currency', 'exchange_rate', 'amount_in_' . $currency, 'present_value', 'cash', 'counted_in_total']];
                foreach ($doc['investment']['items'] ?? [] as $c) {
                    $rows[] = [$c['id'], $c['category'], $c['description'], $c['year'], $c['amount'], $c['currency'], $c['exchange_rate'],
                        $c['amount_in_project_currency'], $c['present_value'], $c['is_cash'] ? 'yes' : 'no', $c['counted'] ? 'yes' : 'no'];
                }
                break;
            case 'results':
                $rows = [['metric', 'value']];
                foreach ($doc['headline'] as $k => $v) {
                    $rows[] = [$k, $v];
                }
                $rows[] = ['methodology_version', $doc['meta']['methodology_version']];
                $rows[] = ['input_hash', $doc['meta']['input_hash']];
                $rows[] = ['generated_at', $doc['meta']['generated_at']];
                break;
            case 'annual':
                $rows = [['year', 'investment', 'investment_present_value', 'adjusted_impact', 'present_value', 'cumulative_investment', 'cumulative_adjusted_impact', 'cumulative_present_value']];
                foreach ($doc['results']['annual'] ?? [] as $a) {
                    $rows[] = array_values($a);
                }
                break;
            case 'stakeholders':
                $rows = [['stakeholder_id', 'name', 'positive_present_value', 'negative_present_value', 'net_present_value', 'share_of_positive_pct']];
                foreach ($doc['results']['by_stakeholder'] ?? [] as $s) {
                    $rows[] = array_values($s);
                }
                break;
            case 'outcomes':
                $rows = [['outcome_id', 'outcome', 'stakeholder', 'polarity', 'evidence_quality', 'included', 'year', 'quantity', 'gross_value', 'value_after_drop_off',
                    'adjusted_impact', 'discount_factor', 'present_value']];
                foreach ($doc['outcome_calculations'] ?? [] as $o) {
                    if ($o['years'] === []) {
                        $rows[] = [$o['id'], $o['name'], $o['stakeholder_name'], $o['polarity'], $o['evidence_quality'], $o['included'] ? 'yes' : 'no', '', '', '', '', '', '', ''];
                    }
                    foreach ($o['years'] as $y) {
                        $rows[] = [$o['id'], $o['name'], $o['stakeholder_name'], $o['polarity'], $o['evidence_quality'], 'yes', $y['year'], $y['quantity'],
                            $y['gross_value'], $y['value_after_drop_off'], $y['adjusted_impact'], $y['discount_factor'], $y['present_value']];
                    }
                }
                break;
            default:
                throw new \InvalidArgumentException('Unknown dataset');
        }
        $fh = fopen('php://temp', 'w+');
        fwrite($fh, "\xEF\xBB\xBF"); // BOM so Excel reads UTF-8 (Thai etc.) correctly
        foreach ($rows as $r) {
            fputcsv($fh, array_map([$this, 'cell'], $r), ',', '"', '\\', "\r\n");
        }
        rewind($fh);
        return (string)stream_get_contents($fh);
    }

    private function cell(mixed $v): string|int|float
    {
        if ($v === null) {
            return '';
        }
        if (is_bool($v)) {
            return $v ? 'true' : 'false';
        }
        if (is_int($v) || is_float($v)) {
            return $v;
        }
        $s = (string)$v;
        return $s !== '' && strpbrk($s[0], "=+-@\t\r") !== false ? "'" . $s : $s;
    }
}
