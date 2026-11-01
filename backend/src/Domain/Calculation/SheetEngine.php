<?php
declare(strict_types=1);

namespace App\Domain\Calculation;

/**
 * "Sheet method" SROI — the calculation the customer's Excel workbooks perform, made explicit and audited.
 * Pure: no database, clock or I/O. The same input always yields the same result.
 *
 * Input shape (all raw cell texts may be a number or a small formula, see Formula):
 *   project:  currency, y0_label, y1_label, adjustment_mode (deduct|retain)
 *   columns[]:  id, band (stakeholder|input|outcome), key, label, data_type, counts_toward (none|input|outcome), count_in (y0|y1)
 *   groups[]:   id, parent_id|null, code, name, population_raw, actual_count_raw, custom{}
 *   inputs[]:   id, group_id, resource, y0_raw, y1_raw, include_in_total, custom{}
 *   outcomes[]: id, group_id, outcome, y0_raw, y1_raw, adj_y0|null, adj_y1|null, include_in_total, custom{}
 *
 * Formulas:
 *   input line   = Y0 + Y1 (+ counted custom columns)
 *   outcome line = Y0 + Y1 (+ counted custom columns)                      -> "gross"
 *   adjusted Y   = gross_Y x (1 - adj_Y)   [mode deduct]   |   gross_Y x adj_Y   [mode retain]
 *                  an EMPTY adjustment % means "not assessed": the value is left unchanged and flagged — never read as 0 %
 *   SROI         = total adjusted outcome (Y0+Y1) / total input (Y0+Y1)
 *   (the un-adjusted ratio, total gross outcome / total input, is reported alongside it)
 *
 * There is no discounting: like the workbooks, Y0 and Y1 are simply added. Group totals roll up sub-groups, and the
 * grand total is the sum of LINES (never of group totals), so nothing is counted twice. Blank cells are reported, not
 * silently turned into 0. Money is rounded to 2 dp only at the end; ratios to 6 dp.
 */
final class SheetEngine
{
    public const METHODOLOGY_VERSION = 'sheet-1.0.0';

    /** @param array<string,mixed> $in @return array<string,mixed> */
    public function calculate(array $in): array
    {
        $p = $in['project'] ?? [];
        $mode = ($p['adjustment_mode'] ?? 'deduct') === 'retain' ? 'retain' : 'deduct';
        $errors = [];
        $warnings = [];
        $err = function (string $code, string $msg, string $path) use (&$errors) {
            $errors[] = ['code' => $code, 'message' => $msg, 'path' => $path];
        };
        $warn = function (string $code, string $sev, string $msg, string $type, $id) use (&$warnings) {
            $warnings[] = ['code' => $code, 'severity' => $sev, 'message' => $msg, 'entity_type' => $type, 'entity_id' => $id];
        };

        $cols = ['stakeholder' => [], 'input' => [], 'outcome' => []];
        foreach ($in['columns'] ?? [] as $c) {
            $cols[$c['band']][] = $c;
        }

        // evaluate one raw cell; a bad formula is a blocking error, a blank is null
        $val = function (mixed $raw, string $path) use ($err): ?float {
            try {
                return Formula::evaluate($raw);
            } catch (FormulaException $e) {
                $err('invalid_formula', $e->getMessage(), $path);
                return null;
            }
        };
        // custom columns that count toward a total, for one row of the given band
        $customCounted = function (array $row, string $band, string $target, string $path) use ($cols, $val): array {
            $y = ['y0' => 0.0, 'y1' => 0.0];
            foreach ($cols[$band] as $c) {
                if (($c['counts_toward'] ?? 'none') !== $target || !in_array($c['data_type'], ['number', 'percent'], true)) {
                    continue;
                }
                $v = $val($row['custom'][$c['key']] ?? null, $path . '.custom.' . $c['key']);
                if ($v !== null) {
                    $y[$c['count_in'] === 'y1' ? 'y1' : 'y0'] += $v;
                }
            }
            return $y;
        };

        // ---- groups
        $groups = [];
        foreach ($in['groups'] ?? [] as $g) {
            $id = (int)$g['id'];
            $groups[$id] = [
                'id' => $id,
                'parent_id' => isset($g['parent_id']) ? (int)$g['parent_id'] : null,
                'code' => $g['code'] ?? null,
                'name' => $g['name'] ?? '',
                'population' => $val($g['population_raw'] ?? null, "groups.$id.population_raw"),
                'actual_count' => $val($g['actual_count_raw'] ?? null, "groups.$id.actual_count_raw"),
                'input' => ['y0' => 0.0, 'y1' => 0.0],
                'outcome_gross' => ['y0' => 0.0, 'y1' => 0.0],
                'outcome_adjusted' => ['y0' => 0.0, 'y1' => 0.0],
                'input_lines' => 0,
                'outcome_lines' => 0,
            ];
        }

        $addTo = function (int $gid, string $bucket, float $y0, float $y1) use (&$groups): void {
            // add to the group and every ancestor (depth is small; guard against bad data with a hop limit)
            for ($hops = 0; $gid !== null && isset($groups[$gid]) && $hops < 10; $hops++) {
                $groups[$gid][$bucket]['y0'] += $y0;
                $groups[$gid][$bucket]['y1'] += $y1;
                $gid = $groups[$gid]['parent_id'];
            }
        };
        $countLine = function (int $gid, string $key) use (&$groups): void {
            for ($hops = 0; $gid !== null && isset($groups[$gid]) && $hops < 10; $hops++) {
                $groups[$gid][$key]++;
                $gid = $groups[$gid]['parent_id'];
            }
        };

        // ---- input lines
        $inputs = [];
        $tin = ['y0' => 0.0, 'y1' => 0.0];
        foreach ($in['inputs'] ?? [] as $r) {
            $id = (int)$r['id'];
            $gid = (int)$r['group_id'];
            $path = "inputs.$id";
            $y0 = $val($r['y0_raw'] ?? null, "$path.y0_raw");
            $y1 = $val($r['y1_raw'] ?? null, "$path.y1_raw");
            $extra = $customCounted($r, 'input', 'input', $path);
            $included = (bool)($r['include_in_total'] ?? true);
            $line = [
                'id' => $id, 'group_id' => $gid, 'resource' => $r['resource'] ?? '',
                'y0' => $y0, 'y1' => $y1,
                'extra_y0' => $extra['y0'], 'extra_y1' => $extra['y1'],
                'counted_y0' => ($y0 ?? 0.0) + $extra['y0'],
                'counted_y1' => ($y1 ?? 0.0) + $extra['y1'],
                'included' => $included,
            ];
            $line['total'] = $line['counted_y0'] + $line['counted_y1'];
            if (!isset($groups[$gid])) {
                $err('unknown_group', 'Input line refers to a group that does not exist', "$path.group_id");
            } elseif ($included) {
                $addTo($gid, 'input', $line['counted_y0'], $line['counted_y1']);
                $countLine($gid, 'input_lines');
                $tin['y0'] += $line['counted_y0'];
                $tin['y1'] += $line['counted_y1'];
            }
            if ($y0 === null && $y1 === null && $extra['y0'] == 0.0 && $extra['y1'] == 0.0 && $included) {
                $warn('VALUE_NOT_ENTERED', 'info', 'Input "' . ($r['resource'] ?? '') . '" has no Y0 or Y1 value yet.', 'input', $id);
            }
            if ($y0 !== null && $y0 < 0 || $y1 !== null && $y1 < 0) {
                $warn('NEGATIVE_INPUT', 'warning', 'Input "' . ($r['resource'] ?? '') . '" is negative.', 'input', $id);
            }
            $inputs[] = $line;
        }

        // ---- outcome lines
        $outcomes = [];
        $tg = ['y0' => 0.0, 'y1' => 0.0];
        $ta = ['y0' => 0.0, 'y1' => 0.0];
        $unassessed = 0;
        foreach ($in['outcomes'] ?? [] as $r) {
            $id = (int)$r['id'];
            $gid = (int)$r['group_id'];
            $path = "outcomes.$id";
            $y0 = $val($r['y0_raw'] ?? null, "$path.y0_raw");
            $y1 = $val($r['y1_raw'] ?? null, "$path.y1_raw");
            $extra = $customCounted($r, 'outcome', 'outcome', $path);
            $included = (bool)($r['include_in_total'] ?? true);
            $g0 = ($y0 ?? 0.0) + $extra['y0'];
            $g1 = ($y1 ?? 0.0) + $extra['y1'];
            $a0 = isset($r['adj_y0']) ? (float)$r['adj_y0'] : null;
            $a1 = isset($r['adj_y1']) ? (float)$r['adj_y1'] : null;
            $apply = fn(float $v, ?float $pct): float => $pct === null ? $v : ($mode === 'retain' ? $v * $pct : $v * (1 - $pct));
            $j0 = $apply($g0, $a0);
            $j1 = $apply($g1, $a1);
            $line = [
                'id' => $id, 'group_id' => $gid, 'outcome' => $r['outcome'] ?? '', 'dimension' => $r['dimension'] ?? null,
                'y0' => $y0, 'y1' => $y1,
                'extra_y0' => $extra['y0'], 'extra_y1' => $extra['y1'],
                'gross_y0' => $g0, 'gross_y1' => $g1, 'gross_total' => $g0 + $g1,
                'adj_y0' => $a0, 'adj_y1' => $a1,
                'adjusted_y0' => $j0, 'adjusted_y1' => $j1, 'adjusted_total' => $j0 + $j1,
                'included' => $included,
            ];
            if (!isset($groups[$gid])) {
                $err('unknown_group', 'Outcome line refers to a group that does not exist', "$path.group_id");
            } elseif ($included) {
                $addTo($gid, 'outcome_gross', $g0, $g1);
                $addTo($gid, 'outcome_adjusted', $j0, $j1);
                $countLine($gid, 'outcome_lines');
                $tg['y0'] += $g0;
                $tg['y1'] += $g1;
                $ta['y0'] += $j0;
                $ta['y1'] += $j1;
                $hasValue = ($g0 != 0.0 || $g1 != 0.0);
                if ($hasValue && (($g0 != 0.0 && $a0 === null) || ($g1 != 0.0 && $a1 === null))) {
                    $unassessed++;
                }
            }
            if ($y0 === null && $y1 === null && $extra['y0'] == 0.0 && $extra['y1'] == 0.0 && $included) {
                $warn('VALUE_NOT_ENTERED', 'info', 'Outcome "' . ($r['outcome'] ?? '') . '" has no Y0 or Y1 value yet.', 'outcome', $id);
            }
            $outcomes[] = $line;
        }
        if ($unassessed > 0) {
            $warn('ADJUSTMENT_NOT_ASSESSED', 'info',
                "$unassessed outcome line(s) with a value have no adjustment % yet. They are counted at full value until an adjustment is entered.",
                'project', null);
        }

        // ---- totals and ratios
        $inputTotal = $tin['y0'] + $tin['y1'];
        $grossTotal = $tg['y0'] + $tg['y1'];
        $adjTotal = $ta['y0'] + $ta['y1'];
        $ratio = fn(float $num) => $inputTotal > 0 ? round($num / $inputTotal, 6) : null;
        if ($inputTotal <= 0) {
            $warn('ZERO_INPUT', 'warning', 'Total input is zero, so the SROI ratio cannot be calculated.', 'project', null);
        }

        $r2 = fn(float $v) => round($v, 2) == 0.0 ? 0.0 : round($v, 2);
        $pack = fn(array $b) => ['y0' => $r2($b['y0']), 'y1' => $r2($b['y1']), 'total' => $r2($b['y0'] + $b['y1'])];
        foreach ($groups as &$g) {
            $g['input'] = $pack($g['input']);
            $g['outcome_gross'] = $pack($g['outcome_gross']);
            $g['outcome_adjusted'] = $pack($g['outcome_adjusted']);
        }
        unset($g);
        foreach ($inputs as &$l) {
            foreach (['y0', 'y1', 'extra_y0', 'extra_y1', 'counted_y0', 'counted_y1', 'total'] as $k) {
                $l[$k] = $l[$k] === null ? null : $r2((float)$l[$k]);
            }
        }
        unset($l);
        foreach ($outcomes as &$l) {
            foreach (['y0', 'y1', 'extra_y0', 'extra_y1', 'gross_y0', 'gross_y1', 'gross_total', 'adjusted_y0', 'adjusted_y1', 'adjusted_total'] as $k) {
                $l[$k] = $l[$k] === null ? null : $r2((float)$l[$k]);
            }
        }
        unset($l);

        return [
            'methodology_version' => self::METHODOLOGY_VERSION,
            'currency' => $p['currency'] ?? null,
            'adjustment_mode' => $mode,
            'blocked' => $errors !== [],
            'errors' => $errors,
            'warnings' => $warnings,
            'groups' => array_values($groups),
            'inputs' => $inputs,
            'outcomes' => $outcomes,
            'totals' => [
                'input' => $pack($tin),
                'outcome_gross' => $pack($tg),
                'outcome_adjusted' => $pack($ta),
            ],
            'sroi' => $errors !== [] ? null : $ratio($adjTotal),
            'sroi_unadjusted' => $errors !== [] ? null : $ratio($grossTotal),
            'net_value' => $r2($adjTotal - $inputTotal),
        ];
    }
}
