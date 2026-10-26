<?php
declare(strict_types=1);

namespace App\Domain\Report;

use App\Domain\Calculation\CalculationEngine;

/**
 * Turns a calculation run into an immutable report document. It contains NO formulas: every number comes from the
 * engine result, so the report always reproduces the dashboard's calculation snapshot.
 */
final class ReportBuilder
{
    /**
     * @param array<string,mixed> $snapshot snapshot stored with the run
     * @param array<string,mixed> $result   engine result of the run
     * @param list<array<string,mixed>> $scenarios scenario comparison rows (same data state)
     * @param array<string,mixed>|null $sensitivity engine sensitivity output
     * @return array<string,mixed>
     */
    public function build(string $type, string $title, array $run, array $snapshot, array $result, array $scenarios, ?array $sensitivity, string $generatedAt): array
    {
        $summary = $result['summary'];
        $outcomes = array_values(array_filter($result['outcomes'], fn($o) => $o['included']));
        usort($outcomes, fn($a, $b) => abs($b['totals']['present_value']) <=> abs($a['totals']['present_value']));
        $stake = array_values(array_filter($result['by_stakeholder'], fn($s) => $s['positive_present_value'] > 0));

        $limitations = [
            'The SROI ratio is an estimate that depends on the stated proxies and assumptions; it is not proof that the project is effective.',
            'Financial proxies are monetary estimates of value, not cash received or verified income.',
            'This is a calculator output, not an independently assured SROI analysis.',
        ];
        foreach ($result['warnings'] as $w) {
            if ($w['severity'] === 'warning') {
                $limitations[] = $w['message'];
            }
        }

        $doc = [
            'meta' => [
                'type' => $type, 'title' => $title, 'generated_at' => $generatedAt,
                'methodology_version' => $result['methodology_version'],
                'calculation_run_id' => (int)$run['id'], 'input_hash' => $run['input_hash'],
                'scenario' => $result['scenario'],
            ],
            'project' => $snapshot['meta'] + ['currency' => $summary['currency']],
            'headline' => $summary,
            'executive_summary' => [
                'primary_beneficiaries' => array_slice(array_map(fn($s) => ['name' => $s['name'], 'share_of_positive_pct' => $s['share_of_positive_pct']], $stake), 0, 5),
                'principal_outcomes' => array_slice(array_map(fn($o) => ['name' => $o['name'], 'stakeholder' => $o['stakeholder_name'], 'present_value' => $o['totals']['present_value']], $outcomes), 0, 5),
                'key_limitations' => $limitations,
            ],
            'methodology' => [
                'profile' => $result['profile'],
                'formulas' => [
                    'gross value = quantity x financial proxy',
                    'adjusted impact = gross x persistence x (1 - deadweight) x (1 - attribution) x (1 - displacement)',
                    'present value = adjusted impact / (1 + discount rate) ^ max(0, year - discount base year)',
                    'SROI = total present value of social impact / total investment',
                    'net social value = total present value of social impact - total investment',
                ],
            ],
        ];
        if ($type === 'executive') {
            return $doc;
        }

        $evidenceByOutcome = [];
        foreach ($snapshot['evidence'] ?? [] as $e) {
            if (in_array($e['entity_type'], ['outcome', 'adjustment'], true) && $e['entity_id'] !== null) {
                $evidenceByOutcome[(int)$e['entity_id']][] = $e;
            }
        }
        $byId = [];
        foreach ($snapshot['outcomes'] as $o) {
            $byId[$o['id']] = $o;
        }

        $doc['stakeholders'] = $snapshot['stakeholders'];
        $doc['theory_of_change'] = array_map(fn($o) => [
            'outcome' => $o['name'], 'stakeholder_id' => $o['stakeholder_id'], 'activity' => $o['activity'], 'output' => $o['output_description'],
            'indicator' => $o['indicator'], 'baseline' => $o['baseline'], 'observed_result' => $o['observed_result'],
        ], $snapshot['outcomes']);
        $doc['financial_proxies'] = array_map(fn($o) => [
            'outcome' => $o['name'], 'quantity' => $o['quantity'], 'proxy_value' => $o['proxy_value'], 'unit' => $o['proxy_unit'],
            'source' => $o['proxy_source'], 'rationale' => $o['proxy_rationale'], 'evidence_quality' => $o['evidence_quality'],
            'attachments' => $evidenceByOutcome[$o['id']] ?? [],
        ], $snapshot['outcomes']);
        $doc['impact_adjustments'] = array_map(fn($o) => [
            'outcome' => $o['name'], 'projection_model' => $o['projection_model'], 'start_year' => $o['start_year'], 'duration_years' => $o['duration_years'],
            'adjustment' => $o['adjustment'], 'year_overrides' => $o['year_overrides'],
        ], $snapshot['outcomes']);
        $doc['investment'] = $result['investment'];
        $doc['outcome_calculations'] = $result['outcomes'];
        $doc['results'] = [
            'by_stakeholder' => $result['by_stakeholder'], 'annual' => $result['annual'], 'evidence_quality' => $result['evidence_quality'],
        ];
        $doc['scenario_comparison'] = array_map(fn($s) => array_diff_key($s, ['assumptions' => 1]) + ['assumptions' => $s['assumptions']], $scenarios);
        $doc['sensitivity'] = $sensitivity === null ? null : ['base' => $sensitivity['base'], 'top_drivers' => array_slice($sensitivity['rows'], 0, 10),
            'note' => 'One-at-a-time changes around the selected scenario. These are not statistical confidence intervals.'];
        $doc['negative_impacts'] = array_values(array_filter($result['outcomes'], fn($o) => $o['polarity'] === 'negative'));
        $doc['unmonetized_outcomes'] = $result['unmonetized_outcomes'];
        $doc['warnings'] = $result['warnings'];
        $doc['limitations'] = $limitations;
        $doc['sources'] = $snapshot['evidence'] ?? [];
        $doc['assumptions_register'] = array_values(array_filter(array_map(fn($o) => $o['adjustment'] === null ? null : [
            'outcome' => $o['name'], 'deadweight' => $o['adjustment']['deadweight'], 'attribution' => $o['adjustment']['attribution'],
            'displacement' => $o['adjustment']['displacement'], 'drop_off' => $o['adjustment']['drop_off'],
            'justification' => $o['adjustment']['justification'], 'source' => $o['adjustment']['source'],
            'last_edited_by' => $o['adjustment']['updated_by'], 'last_edited_at' => $o['adjustment']['updated_at'],
        ], $snapshot['outcomes'])));
        return $doc;
    }
}
