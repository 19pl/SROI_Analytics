<?php
declare(strict_types=1);

namespace App\Domain\Calculation;

/**
 * Deterministic SROI calculation engine. Pure: no database, clock or I/O.
 * The same validated snapshot always yields the same result, and every report is generated from
 * that result — formulas exist ONLY here.
 *
 * Snapshot shape (all percentages are fractions, 0.15 = 15%):
 *   project:      currency, analysis_period_years, discount_rate, discount_rate_basis, discount_rate_source,
 *                 discount_base_year, investment_basis (nominal|present_value), include_in_kind, price_basis
 *   costs[]:      id, category, description, amount, currency, exchange_rate, year, is_cash, include_in_calculation
 *   stakeholders[]: id, name
 *   outcomes[]:   id, stakeholder_id, name, polarity, projection_model, quantity, proxy_value|null, start_year,
 *                 duration_years, entry_years, evidence_quality, proxy_source, overlap_group, include_in_total,
 *                 adjustment{deadweight, attribution, displacement, drop_off, justification, source}|null,
 *                 year_overrides[]{year, quantity, drop_off}
 *   scenario:     id, name, kind, assumptions{global{...}, outcomes{<id>{...}}}
 *
 * Formulas (per outcome, per year t):
 *   gross      = quantity x proxy                                  (sign applied: negative outcomes subtract)
 *   retained   = gross x persistence      persistence(1)=1, persistence(k)=persistence(k-1) x (1 - dropoff_k)
 *   adjusted   = retained x (1-deadweight) x (1-attribution) x (1-displacement)
 *   present    = adjusted / (1+r)^max(0, t - discount_base_year)
 * SROI = sum(present) / investment ; net social value = sum(present) - investment.
 * Every monetary line is rounded to 2 dp and totals are sums of those rounded lines, so tables always add up.
 */
final class CalculationEngine
{
    public const METHODOLOGY_VERSION = '1.0.0';

    private const MAX_OUTCOMES = 300;
    private const MAX_COSTS = 2000;

    public const MODELS = ['cohort', 'recurring_cohorts', 'independent'];
    public const QUALITIES = ['measured', 'external', 'estimated', 'assumed'];
    public const COST_CATEGORIES = ['capex', 'opex', 'delivery', 'administration', 'in_kind', 'other'];

    /** @return list<array{code:string,message:string,path:string}> blocking problems; empty = calculable */
    public function validate(array $snapshot): array
    {
        return $this->normalize($snapshot)[1];
    }

    /** @throws InvalidSnapshotException */
    public function calculate(array $snapshot): array
    {
        [$s, $errors] = $this->normalize($snapshot);
        if ($errors !== [] || $s === null) {
            throw new InvalidSnapshotException($errors);
        }
        return $this->compute($s);
    }

    /**
     * One-at-a-time sensitivity ("tornado") analysis around the given scenario.
     * @param array{proxy_pct?:float,quantity_pct?:float,adjustment_pp?:float,discount_pp?:float} $opts
     * @return array{base:array<string,mixed>,rows:list<array<string,mixed>>} rows sorted by swing, largest first
     */
    public function sensitivity(array $snapshot, array $opts = []): array
    {
        [$s, $errors] = $this->normalize($snapshot);
        if ($errors !== [] || $s === null) {
            throw new InvalidSnapshotException($errors);
        }
        $proxyPct = $opts['proxy_pct'] ?? 0.2;
        $qtyPct = $opts['quantity_pct'] ?? 0.2;
        $pp = $opts['adjustment_pp'] ?? 0.1;
        $dpp = $opts['discount_pp'] ?? 0.02;

        $base = $this->compute($s);
        $baseRatio = $base['summary']['sroi_ratio'];
        $basePv = $base['summary']['present_value_of_impact'];
        $eff = $this->effectiveOutcomes($s);
        $rows = [];

        $run = function (callable $mutate) use ($s): array {
            $c = $s;
            $mutate($c);
            return $this->compute($c)['summary'];
        };
        $push = function (string $param, string $label, ?int $id, float|int $lowV, float|int $highV, array $lo, array $hi) use (&$rows, $basePv) {
            $swing = abs($hi['present_value_of_impact'] - $lo['present_value_of_impact']);
            $rows[] = [
                'parameter' => $param,
                'label' => $label,
                'outcome_id' => $id,
                'low_value' => $lowV,
                'high_value' => $highV,
                'sroi_ratio_low' => $lo['sroi_ratio'],
                'sroi_ratio_high' => $hi['sroi_ratio'],
                'present_value_low' => $lo['present_value_of_impact'],
                'present_value_high' => $hi['present_value_of_impact'],
                'swing_present_value' => round($swing, 2),
            ];
        };

        $r = $base['profile']['discount_rate'];
        $lowR = max(0.0, $r - $dpp);
        $highR = min(1.0, $r + $dpp);
        $setR = fn(float $v) => function (array &$c) use ($v) {
            $c['scenario']['assumptions']['global']['discount_rate'] = $v;
        };
        $push('discount_rate', 'Discount rate', null, $lowR, $highR, $run($setR($lowR)), $run($setR($highR)));

        foreach ($s['outcomes'] as $o) {
            $e = $eff[$o['id']];
            if (!$e['included']) {
                continue;
            }
            $id = $o['id'];
            $set = fn(string $f, float $v) => function (array &$c) use ($id, $f, $v) {
                $c['scenario']['assumptions']['outcomes'][$id][$f] = $v;
            };
            $name = $o['name'];
            $q = (float)$e['quantity'];
            $push('quantity', "$name — quantity", $id, $q * (1 - $qtyPct), $q * (1 + $qtyPct),
                $run($set('quantity', $q * (1 - $qtyPct))), $run($set('quantity', $q * (1 + $qtyPct))));
            $p = (float)$e['proxy_value'];
            $push('proxy_value', "$name — financial proxy", $id, $p * (1 - $proxyPct), $p * (1 + $proxyPct),
                $run($set('proxy_value', $p * (1 - $proxyPct))), $run($set('proxy_value', $p * (1 + $proxyPct))));
            foreach (['deadweight', 'attribution'] as $f) {
                $v = (float)($e[$f] ?? 0.0);
                $lo = max(0.0, $v - $pp);
                $hi = min(1.0, $v + $pp);
                // higher deadweight/attribution = lower value, so "low" scenario uses the high deduction
                $push($f, "$name — $f", $id, $hi, $lo, $run($set($f, $hi)), $run($set($f, $lo)));
            }
        }
        usort($rows, fn($a, $b) => $b['swing_present_value'] <=> $a['swing_present_value']);
        return ['base' => ['sroi_ratio' => $baseRatio, 'present_value_of_impact' => $basePv], 'rows' => $rows];
    }

    // ------------------------------------------------------------------------------------------------
    // Normalisation + validation
    // ------------------------------------------------------------------------------------------------

    /** @return array{0:?array<string,mixed>,1:list<array{code:string,message:string,path:string}>} */
    private function normalize(array $raw): array
    {
        $errors = [];
        $err = function (string $code, string $msg, string $path) use (&$errors) {
            $errors[] = ['code' => $code, 'message' => $msg, 'path' => $path];
        };
        $isNum = fn($v) => (is_int($v) || is_float($v) || (is_string($v) && is_numeric($v))) && is_finite((float)$v);
        $frac = function ($v, string $path) use (&$errors, $isNum, $err): ?float {
            if ($v === null || $v === '') {
                return null;
            }
            if (!$isNum($v) || (float)$v < 0 || (float)$v > 1) {
                $err('invalid_percentage', 'must be a fraction between 0 and 1 (0.15 = 15%)', $path);
                return null;
            }
            return (float)$v;
        };

        $p = $raw['project'] ?? null;
        if (!is_array($p)) {
            $err('missing_project', 'project is required', 'project');
            return [null, $errors];
        }
        $cur = strtoupper((string)($p['currency'] ?? ''));
        if (!preg_match('/^[A-Z]{3}$/', $cur)) {
            $err('currency_required', 'project currency must be a 3-letter code', 'project.currency');
        }
        $T = $p['analysis_period_years'] ?? null;
        if (!is_int($T) && !(is_string($T) && ctype_digit($T))) {
            $err('analysis_period_required', 'Set the analysis period (years) before calculating', 'project.analysis_period_years');
            $T = 1;
        }
        $T = (int)$T;
        if ($T < 1 || $T > 100) {
            $err('analysis_period_invalid', 'analysis period must be between 1 and 100 years', 'project.analysis_period_years');
            $T = max(1, min(100, $T));
        }
        $basis = $p['investment_basis'] ?? null;
        if (!in_array($basis, ['nominal', 'present_value'], true)) {
            $err('investment_basis_required', 'Choose how investment is compared with present-value outcomes (nominal or present_value)', 'project.investment_basis');
        }
        $baseYear = $p['discount_base_year'] ?? 0;
        if (!$isNum($baseYear) || (int)$baseYear < 0) {
            $err('invalid_discount_base_year', 'discount_base_year must be >= 0', 'project.discount_base_year');
            $baseYear = 0;
        }
        $rate = $p['discount_rate'] ?? null;
        $scenarioIn = is_array($raw['scenario'] ?? null) ? $raw['scenario'] : [];
        $assumeIn = is_array($scenarioIn['assumptions'] ?? null) ? $scenarioIn['assumptions'] : [];
        $globalIn = is_array($assumeIn['global'] ?? null) ? $assumeIn['global'] : [];
        $rateOverride = $globalIn['discount_rate'] ?? null;
        if (($rate === null || $rate === '') && $rateOverride === null) {
            $err('discount_rate_required', 'A discount rate must be chosen explicitly (0 is allowed); none is assumed', 'project.discount_rate');
        }
        $project = [
            'currency' => $cur,
            'price_basis' => isset($p['price_basis']) ? (string)$p['price_basis'] : null,
            'analysis_period_years' => $T,
            'discount_rate' => $frac($rate, 'project.discount_rate'),
            'discount_rate_basis' => $p['discount_rate_basis'] ?? null,
            'discount_rate_source' => isset($p['discount_rate_source']) ? (string)$p['discount_rate_source'] : null,
            'discount_base_year' => (int)$baseYear,
            'investment_basis' => $basis,
            'include_in_kind' => !array_key_exists('include_in_kind', $p) || filter_var($p['include_in_kind'], FILTER_VALIDATE_BOOLEAN),
        ];

        // stakeholders
        $stakeholders = [];
        foreach ((array)($raw['stakeholders'] ?? []) as $i => $st) {
            if (!is_array($st) || !isset($st['id'])) {
                $err('invalid_stakeholder', 'stakeholder needs an id', "stakeholders.$i");
                continue;
            }
            $stakeholders[(int)$st['id']] = ['id' => (int)$st['id'], 'name' => (string)($st['name'] ?? 'Stakeholder ' . $st['id'])];
        }

        // costs
        $costs = [];
        $rawCosts = (array)($raw['costs'] ?? []);
        if (count($rawCosts) > self::MAX_COSTS) {
            $err('too_many_costs', 'too many cost items', 'costs');
            $rawCosts = [];
        }
        foreach ($rawCosts as $i => $c) {
            $path = "costs.$i";
            if (!is_array($c)) {
                $err('invalid_cost', 'cost must be an object', $path);
                continue;
            }
            if (!$isNum($c['amount'] ?? null) || (float)$c['amount'] < 0) {
                $err('invalid_cost_amount', 'amount must be a non-negative number', "$path.amount");
                continue;
            }
            $year = $c['year'] ?? null;
            if (!$isNum($year) || (int)$year != $year || (int)$year < 0 || (int)$year > $T) {
                $err('cost_year_outside_period', "cost year must be an integer between 0 and the analysis period ($T)", "$path.year");
                continue;
            }
            $fx = $c['exchange_rate'] ?? 1;
            if (!$isNum($fx) || (float)$fx <= 0) {
                $err('invalid_exchange_rate', 'exchange_rate must be > 0', "$path.exchange_rate");
                continue;
            }
            $category = $c['category'] ?? 'other';
            if (!in_array($category, self::COST_CATEGORIES, true)) {
                $err('invalid_cost_category', 'unknown cost category', "$path.category");
                continue;
            }
            $costs[] = [
                'id' => $c['id'] ?? null,
                'category' => $category,
                'description' => (string)($c['description'] ?? ''),
                'amount' => (float)$c['amount'],
                'currency' => strtoupper((string)($c['currency'] ?? $cur)),
                'exchange_rate' => (float)$fx,
                'year' => (int)$year,
                'is_cash' => !array_key_exists('is_cash', $c) || filter_var($c['is_cash'], FILTER_VALIDATE_BOOLEAN),
                'include_in_calculation' => !array_key_exists('include_in_calculation', $c) || filter_var($c['include_in_calculation'], FILTER_VALIDATE_BOOLEAN),
            ];
        }

        // outcomes
        $outcomes = [];
        $rawOutcomes = (array)($raw['outcomes'] ?? []);
        if (count($rawOutcomes) > self::MAX_OUTCOMES) {
            $err('too_many_outcomes', 'too many outcomes', 'outcomes');
            $rawOutcomes = [];
        }
        foreach ($rawOutcomes as $i => $o) {
            $path = "outcomes.$i";
            if (!is_array($o) || !isset($o['id'])) {
                $err('invalid_outcome', 'outcome needs an id', $path);
                continue;
            }
            $id = (int)$o['id'];
            $label = (string)($o['name'] ?? "outcome $id");
            $sid = (int)($o['stakeholder_id'] ?? 0);
            if (!isset($stakeholders[$sid])) {
                $err('outcome_stakeholder_missing', "Outcome \"$label\" must be linked to a stakeholder", "$path.stakeholder_id");
            }
            $model = $o['projection_model'] ?? 'cohort';
            if (!in_array($model, self::MODELS, true)) {
                $err('invalid_projection_model', 'projection_model must be one of ' . implode(', ', self::MODELS), "$path.projection_model");
                $model = 'cohort';
            }
            $polarity = $o['polarity'] ?? 'positive';
            if (!in_array($polarity, ['positive', 'negative'], true)) {
                $err('invalid_polarity', 'polarity must be positive or negative', "$path.polarity");
                $polarity = 'positive';
            }
            $quality = $o['evidence_quality'] ?? null;
            if (!in_array($quality, self::QUALITIES, true)) {
                $err('invalid_evidence_quality', "Outcome \"$label\" needs an evidence quality (" . implode(', ', self::QUALITIES) . ')', "$path.evidence_quality");
                $quality = 'assumed';
            }
            $qty = $o['quantity'] ?? 0;
            if (!$isNum($qty) || (float)$qty < 0) {
                $err('invalid_quantity', "Outcome \"$label\": quantity must be >= 0", "$path.quantity");
                $qty = 0;
            }
            $proxy = $o['proxy_value'] ?? null;
            if ($proxy !== null && $proxy !== '') {
                if (!$isNum($proxy) || (float)$proxy < 0) {
                    $err('invalid_proxy_value', "Outcome \"$label\": proxy value must be >= 0 (use polarity 'negative' for harms)", "$path.proxy_value");
                    $proxy = null;
                } else {
                    $proxy = (float)$proxy;
                }
            } else {
                $proxy = null;
            }
            $start = $o['start_year'] ?? 1;
            $dur = $o['duration_years'] ?? 1;
            if (!$isNum($start) || (int)$start < 1 || (int)$start > $T) {
                $err('outcome_start_outside_period', "Outcome \"$label\": start_year must be between 1 and the analysis period ($T)", "$path.start_year");
                $start = 1;
            }
            if (!$isNum($dur) || (int)$dur < 1 || (int)$dur > 200) {
                $err('invalid_duration', "Outcome \"$label\": duration_years must be >= 1", "$path.duration_years");
                $dur = 1;
            }
            $entry = $o['entry_years'] ?? null;
            if ($entry !== null && (!$isNum($entry) || (int)$entry < 1)) {
                $err('invalid_entry_years', 'entry_years must be >= 1', "$path.entry_years");
                $entry = null;
            }
            $adjIn = is_array($o['adjustment'] ?? null) ? $o['adjustment'] : null;
            $adj = null;
            if ($adjIn !== null) {
                $adj = [
                    'deadweight' => $frac($adjIn['deadweight'] ?? null, "$path.adjustment.deadweight"),
                    'attribution' => $frac($adjIn['attribution'] ?? null, "$path.adjustment.attribution"),
                    'displacement' => $frac($adjIn['displacement'] ?? null, "$path.adjustment.displacement"),
                    'drop_off' => $frac($adjIn['drop_off'] ?? null, "$path.adjustment.drop_off"),
                    'justification' => isset($adjIn['justification']) ? (string)$adjIn['justification'] : null,
                    'source' => isset($adjIn['source']) ? (string)$adjIn['source'] : null,
                ];
            }
            $ovs = [];
            foreach ((array)($o['year_overrides'] ?? []) as $j => $ov) {
                $yp = "$path.year_overrides.$j";
                if (!is_array($ov) || !$isNum($ov['year'] ?? null) || (int)$ov['year'] < 1) {
                    $err('invalid_year_override', 'year override needs year >= 1', $yp);
                    continue;
                }
                $oq = $ov['quantity'] ?? null;
                if ($oq !== null && (!$isNum($oq) || (float)$oq < 0)) {
                    $err('invalid_year_override', 'quantity must be >= 0', "$yp.quantity");
                    continue;
                }
                if ($oq !== null && $model === 'cohort') {
                    $err('cohort_quantity_override', "Outcome \"$label\": a single cohort has one quantity; use the recurring_cohorts or independent model for per-year quantities", "$yp.quantity");
                    continue;
                }
                $od = $frac($ov['drop_off'] ?? null, "$yp.drop_off");
                $ovs[(int)$ov['year']] = ['quantity' => $oq === null ? null : (float)$oq, 'drop_off' => $od];
            }
            $outcomes[] = [
                'id' => $id,
                'name' => $label,
                'stakeholder_id' => $sid,
                'polarity' => $polarity,
                'projection_model' => $model,
                'quantity' => (float)$qty,
                'proxy_value' => $proxy,
                'proxy_source' => isset($o['proxy_source']) ? (string)$o['proxy_source'] : null,
                'start_year' => (int)$start,
                'duration_years' => (int)$dur,
                'entry_years' => $entry === null ? null : (int)$entry,
                'evidence_quality' => $quality,
                'overlap_group' => isset($o['overlap_group']) && $o['overlap_group'] !== '' ? (string)$o['overlap_group'] : null,
                'include_in_total' => !array_key_exists('include_in_total', $o) || filter_var($o['include_in_total'], FILTER_VALIDATE_BOOLEAN),
                'adjustment' => $adj,
                'year_overrides' => $ovs,
            ];
        }

        // scenario assumptions (validated by the same public parser the scenario endpoint uses)
        [$assumptions, $assumptionErrors] = $this->parseAssumptions($assumeIn);
        foreach ($assumptionErrors as $ae) {
            $errors[] = $ae;
        }
        $global = $assumptions['global'];
        $ovOut = $assumptions['outcomes'];

        $s = [
            'project' => $project,
            'costs' => $costs,
            'stakeholders' => $stakeholders,
            'outcomes' => $outcomes,
            'scenario' => [
                'id' => $scenarioIn['id'] ?? null,
                'name' => (string)($scenarioIn['name'] ?? 'Base case'),
                'kind' => (string)($scenarioIn['kind'] ?? 'base'),
                'assumptions' => ['global' => $global, 'outcomes' => $ovOut],
            ],
        ];
        // fall back so a scenario-only discount rate is usable
        if ($s['project']['discount_rate'] === null && isset($global['discount_rate'])) {
            $s['project']['discount_rate'] = $global['discount_rate'];
        }
        if ($errors !== []) {
            return [null, $errors];
        }
        return [$s, []];
    }

    /**
     * Validate and clean scenario assumptions. All percentages are fractions; deltas are percentage points.
     * @param array<string,mixed> $in
     * @return array{0:array{global:array<string,mixed>,outcomes:array<int,array<string,mixed>>},1:list<array{code:string,message:string,path:string}>}
     */
    public function parseAssumptions(array $in): array
    {
        $errors = [];
        $err = function (string $msg, string $path) use (&$errors) {
            $errors[] = ['code' => 'invalid_scenario', 'message' => $msg, 'path' => $path];
        };
        $isNum = fn($v) => (is_int($v) || is_float($v) || (is_string($v) && is_numeric($v))) && is_finite((float)$v);
        $frac = function ($v, string $path) use ($isNum, $err): ?float {
            if ($v === null || $v === '') {
                return null;
            }
            if (!$isNum($v) || (float)$v < 0 || (float)$v > 1) {
                $err('must be a fraction between 0 and 1 (0.15 = 15%)', $path);
                return null;
            }
            return (float)$v;
        };
        $globalIn = is_array($in['global'] ?? null) ? $in['global'] : [];
        $global = [];
        foreach (['quantity_multiplier', 'proxy_multiplier'] as $k) {
            if (isset($globalIn[$k])) {
                if (!$isNum($globalIn[$k]) || (float)$globalIn[$k] < 0) {
                    $err("$k must be >= 0", "scenario.assumptions.global.$k");
                } else {
                    $global[$k] = (float)$globalIn[$k];
                }
            }
        }
        foreach (['deadweight_delta', 'attribution_delta', 'displacement_delta', 'drop_off_delta'] as $k) {
            if (isset($globalIn[$k])) {
                if (!$isNum($globalIn[$k]) || abs((float)$globalIn[$k]) > 1) {
                    $err("$k must be between -1 and 1 (percentage points as a fraction)", "scenario.assumptions.global.$k");
                } else {
                    $global[$k] = (float)$globalIn[$k];
                }
            }
        }
        if (isset($globalIn['duration_delta_years'])) {
            if (!$isNum($globalIn['duration_delta_years'])) {
                $err('duration_delta_years must be a number', 'scenario.assumptions.global.duration_delta_years');
            } else {
                $global['duration_delta_years'] = (int)$globalIn['duration_delta_years'];
            }
        }
        if (isset($globalIn['discount_rate'])) {
            $g = $frac($globalIn['discount_rate'], 'scenario.assumptions.global.discount_rate');
            if ($g !== null) {
                $global['discount_rate'] = $g;
            }
        }
        $ovOut = [];
        foreach ((array)($in['outcomes'] ?? []) as $oid => $ov) {
            if (!is_array($ov) || !ctype_digit((string)$oid)) {
                $err('outcome override must be an object keyed by outcome id', "scenario.assumptions.outcomes.$oid");
                continue;
            }
            $clean = [];
            foreach (['quantity', 'proxy_value', 'duration_years'] as $k) {
                if (array_key_exists($k, $ov) && $ov[$k] !== null) {
                    if (!$isNum($ov[$k]) || (float)$ov[$k] < 0) {
                        $err("$k must be >= 0", "scenario.assumptions.outcomes.$oid.$k");
                    } else {
                        $clean[$k] = $k === 'duration_years' ? max(1, (int)$ov[$k]) : (float)$ov[$k];
                    }
                }
            }
            foreach (['deadweight', 'attribution', 'displacement', 'drop_off'] as $k) {
                if (array_key_exists($k, $ov) && $ov[$k] !== null) {
                    $v = $frac($ov[$k], "scenario.assumptions.outcomes.$oid.$k");
                    if ($v !== null) {
                        $clean[$k] = $v;
                    }
                }
            }
            if (array_key_exists('include', $ov)) {
                $clean['include'] = filter_var($ov['include'], FILTER_VALIDATE_BOOLEAN);
            }
            $ovOut[(int)$oid] = $clean;
        }
        return [['global' => $global, 'outcomes' => $ovOut], $errors];
    }

    // ------------------------------------------------------------------------------------------------
    // Core computation
    // ------------------------------------------------------------------------------------------------

    /** @return array<int,array<string,mixed>> effective (scenario-adjusted) values keyed by outcome id */
    private function effectiveOutcomes(array $s): array
    {
        $g = $s['scenario']['assumptions']['global'];
        $ovs = $s['scenario']['assumptions']['outcomes'];
        $out = [];
        $clamp = fn(float $v) => max(0.0, min(1.0, $v));
        foreach ($s['outcomes'] as $o) {
            $x = $ovs[$o['id']] ?? [];
            $a = $o['adjustment'] ?? [];
            $e = [];
            $e['quantity'] = $x['quantity'] ?? $o['quantity'] * ($g['quantity_multiplier'] ?? 1.0);
            $e['proxy_value'] = $o['proxy_value'] === null ? null : ($x['proxy_value'] ?? $o['proxy_value'] * ($g['proxy_multiplier'] ?? 1.0));
            foreach (['deadweight', 'attribution', 'displacement', 'drop_off'] as $k) {
                $base = $a[$k] ?? null;
                $delta = $g[$k . '_delta'] ?? 0.0;
                if (array_key_exists($k, $x)) {
                    $e[$k] = $x[$k];
                } elseif ($base === null && $delta == 0.0) {
                    $e[$k] = null; // still "not assessed"
                } else {
                    $e[$k] = $clamp(($base ?? 0.0) + $delta);
                }
            }
            $e['duration_years'] = $x['duration_years'] ?? max(1, $o['duration_years'] + ($g['duration_delta_years'] ?? 0));
            $e['included'] = ($x['include'] ?? $o['include_in_total']) && $o['proxy_value'] !== null;
            $out[$o['id']] = $e;
        }
        return $out;
    }

    private function r2(float $v): float
    {
        $r = round($v, 2);
        return $r == 0.0 ? 0.0 : $r; // avoid -0
    }

    private function sum(array $vals): float
    {
        $t = 0.0;
        foreach ($vals as $v) {
            $t += $v;
        }
        return $this->r2($t);
    }

    private function compute(array $s): array
    {
        $p = $s['project'];
        $T = $p['analysis_period_years'];
        $base = $p['discount_base_year'];
        $r = (float)($s['scenario']['assumptions']['global']['discount_rate'] ?? $p['discount_rate']);
        $df = fn(int $year) => 1.0 / ((1.0 + $r) ** max(0, $year - $base));
        $eff = $this->effectiveOutcomes($s);
        $warnings = [];
        $warn = function (string $code, string $sev, string $msg, ?string $type = null, $id = null) use (&$warnings) {
            $warnings[] = ['code' => $code, 'severity' => $sev, 'message' => $msg, 'entity_type' => $type, 'entity_id' => $id];
        };

        // ---- investment
        $costLines = [];
        $byCategory = [];
        $byYear = array_fill(0, $T + 1, ['nominal' => 0.0, 'pv' => 0.0]);
        $nominal = [];
        $pvs = [];
        $cash = [];
        $inKind = [];
        foreach ($s['costs'] as $c) {
            $amt = $this->r2($c['amount'] * $c['exchange_rate']);
            $counted = $c['include_in_calculation'] && ($c['is_cash'] || $p['include_in_kind']);
            $pv = $this->r2($amt * $df($c['year']));
            $costLines[] = $c + ['amount_in_project_currency' => $amt, 'present_value' => $pv, 'counted' => $counted];
            if ($c['currency'] !== $p['currency'] && $c['exchange_rate'] == 1.0) {
                $warn('CURRENCY_RATE_UNSET', 'warning', "Cost \"{$c['description']}\" is in {$c['currency']} but its exchange rate to {$p['currency']} is 1.", 'cost', $c['id']);
            }
            if (!$counted) {
                if ($c['include_in_calculation'] && !$c['is_cash']) {
                    $warn('IN_KIND_EXCLUDED', 'info', "In-kind cost \"{$c['description']}\" is excluded by the project's in-kind setting.", 'cost', $c['id']);
                }
                continue;
            }
            $nominal[] = $amt;
            $pvs[] = $pv;
            if ($c['is_cash']) {
                $cash[] = $amt;
            } else {
                $inKind[] = $amt;
            }
            $byCategory[$c['category']][] = $amt;
            $byYear[$c['year']]['nominal'] += $amt;
            $byYear[$c['year']]['pv'] += $pv;
        }
        $investNominal = $this->sum($nominal);
        $investPv = $this->sum($pvs);
        $used = $p['investment_basis'] === 'present_value' ? $investPv : $investNominal;
        $dupes = [];
        foreach ($costLines as $l) {
            $k = strtolower($l['category'] . '|' . trim($l['description']) . '|' . $l['amount'] . '|' . $l['year']);
            $dupes[$k][] = $l;
        }
        foreach ($dupes as $group) {
            if (count($group) > 1) {
                $warn('DUPLICATE_COST', 'warning', "Possible double counting: {$group[0]['description']} appears " . count($group) . ' times with the same amount and year.', 'cost', $group[0]['id']);
            }
        }
        if ($used <= 0) {
            $warn('ZERO_INVESTMENT', 'warning', 'Total investment is zero, so the SROI ratio is undefined. Net social value is still reported.');
        }
        if ($p['investment_basis'] === 'nominal' && $r > 0 && abs($investNominal - $investPv) > 0.005) {
            $warn('INVESTMENT_BASIS_MIXED', 'info', 'Investment is compared on a nominal basis while outcomes are discounted; costs occur in different years. The present-value ratio is also reported.');
        }

        // ---- outcomes
        $stakeById = $s['stakeholders'];
        $outLines = [];
        $annualAdj = array_fill(0, $T + 1, []);
        $annualPv = array_fill(0, $T + 1, []);
        $stk = [];
        $quality = array_fill_keys(self::QUALITIES, 0.0);
        $unmonetized = [];
        $allPv = [];
        $allAdj = [];
        $groups = [];
        $names = [];

        foreach ($s['outcomes'] as $o) {
            $e = $eff[$o['id']];
            $adj = $o['adjustment'];
            $line = [
                'id' => $o['id'],
                'name' => $o['name'],
                'stakeholder_id' => $o['stakeholder_id'],
                'stakeholder_name' => $stakeById[$o['stakeholder_id']]['name'] ?? '',
                'polarity' => $o['polarity'],
                'projection_model' => $o['projection_model'],
                'evidence_quality' => $o['evidence_quality'],
                'monetized' => $o['proxy_value'] !== null,
                'included' => $e['included'],
                'effective' => [
                    'quantity' => $e['quantity'],
                    'proxy_value' => $e['proxy_value'],
                    'deadweight' => $e['deadweight'],
                    'attribution' => $e['attribution'],
                    'displacement' => $e['displacement'],
                    'drop_off' => $e['drop_off'],
                    'start_year' => $o['start_year'],
                    'duration_years' => $e['duration_years'],
                ],
                'adjustment_factor' => null,
                'years' => [],
                'totals' => ['gross' => 0.0, 'retained' => 0.0, 'adjusted' => 0.0, 'present_value' => 0.0],
            ];
            if ($o['proxy_value'] === null) {
                $unmonetized[] = ['id' => $o['id'], 'name' => $o['name'], 'stakeholder_id' => $o['stakeholder_id'],
                    'stakeholder_name' => $line['stakeholder_name'], 'evidence_quality' => $o['evidence_quality']];
                $warn('UNMONETIZED_OUTCOME', 'info', "Outcome \"{$o['name']}\" has no financial proxy and is reported qualitatively only.", 'outcome', $o['id']);
                $outLines[] = $line;
                continue;
            }
            if (!$e['included']) {
                $warn('OUTCOME_EXCLUDED', 'info', "Outcome \"{$o['name']}\" is excluded from the totals.", 'outcome', $o['id']);
                $outLines[] = $line;
                continue;
            }

            // warnings about evidence + double counting
            if ($adj === null || ($adj['deadweight'] === null && $adj['attribution'] === null && $adj['displacement'] === null)) {
                $warn('ADJUSTMENT_NOT_ASSESSED', 'warning', "Outcome \"{$o['name']}\": deadweight, attribution and displacement have not been assessed; they are treated as 0%, which may overstate impact.", 'outcome', $o['id']);
            } elseif (trim((string)($adj['justification'] ?? '')) === '' && trim((string)($adj['source'] ?? '')) === '') {
                $warn('ADJUSTMENT_NO_EVIDENCE', 'warning', "Outcome \"{$o['name']}\": impact adjustments have no source or justification.", 'outcome', $o['id']);
            }
            if ($o['evidence_quality'] === 'assumed') {
                $warn('EVIDENCE_ASSUMED', 'warning', "Outcome \"{$o['name']}\" rests on an assumption rather than evidence.", 'outcome', $o['id']);
            }
            if (trim((string)($o['proxy_source'] ?? '')) === '') {
                $warn('PROXY_NO_SOURCE', 'warning', "Outcome \"{$o['name']}\": the financial proxy has no source or stated rationale.", 'outcome', $o['id']);
            }
            if ($o['overlap_group'] !== null) {
                $groups[$o['overlap_group']][] = $o['name'];
            }
            $names[$o['stakeholder_id'] . '|' . strtolower(trim($o['name']))][] = $o['name'];
            if ($o['projection_model'] === 'independent' && (($e['drop_off'] ?? 0) > 0 || array_filter($o['year_overrides'], fn($v) => $v['drop_off'] !== null))) {
                $warn('DROPOFF_IGNORED', 'warning', "Outcome \"{$o['name']}\" uses independently measured annual quantities, so its drop-off was NOT applied (applying both would double-count the decline).", 'outcome', $o['id']);
            }

            $factor = (1 - ($e['deadweight'] ?? 0.0)) * (1 - ($e['attribution'] ?? 0.0)) * (1 - ($e['displacement'] ?? 0.0));
            $line['adjustment_factor'] = round($factor, 6);
            $sign = $o['polarity'] === 'negative' ? -1.0 : 1.0;
            $proxy = (float)$e['proxy_value'];
            $years = $this->project($o, $e, $T);
            ksort($years);
            $truncated = $o['start_year'] + $e['duration_years'] - 1 > $T && $o['projection_model'] !== 'recurring_cohorts';
            if ($truncated) {
                $warn('HORIZON_TRUNCATED', 'info', "Outcome \"{$o['name']}\" persists beyond the {$T}-year analysis period; later years are not counted.", 'outcome', $o['id']);
            }
            $gT = [];
            $rT = [];
            $aT = [];
            $pT = [];
            foreach ($years as $y => $v) {
                $gross = $this->r2($sign * $v['gross'] * $proxy);
                $retained = $this->r2($sign * $v['retained'] * $proxy);
                $adjusted = $this->r2($sign * $v['retained'] * $proxy * $factor);
                $pv = $this->r2($adjusted * $df($y));
                $line['years'][] = [
                    'year' => $y,
                    'quantity' => round($v['quantity'], 6),
                    'gross_value' => $gross,
                    'persistence' => $v['gross'] > 0 ? round($v['retained'] / $v['gross'], 6) : 1.0,
                    'value_after_drop_off' => $retained,
                    'adjusted_impact' => $adjusted,
                    'discount_factor' => round($df($y), 8),
                    'present_value' => $pv,
                ];
                $gT[] = $gross;
                $rT[] = $retained;
                $aT[] = $adjusted;
                $pT[] = $pv;
                $annualAdj[$y][] = $adjusted;
                $annualPv[$y][] = $pv;
                $allAdj[] = $adjusted;
                $allPv[] = $pv;
            }
            $line['totals'] = [
                'gross' => $this->sum($gT), 'retained' => $this->sum($rT),
                'adjusted' => $this->sum($aT), 'present_value' => $this->sum($pT),
            ];
            $quality[$o['evidence_quality']] += abs($line['totals']['present_value']);
            $sid = $o['stakeholder_id'];
            $stk[$sid] ??= ['stakeholder_id' => $sid, 'name' => $stakeById[$sid]['name'] ?? '', 'pos' => [], 'neg' => []];
            foreach ($pT as $pv) {
                $stk[$sid][$pv >= 0 ? 'pos' : 'neg'][] = $pv;
            }
            $outLines[] = $line;
        }
        foreach ($groups as $g => $list) {
            if (count($list) > 1) {
                $warn('POSSIBLE_DOUBLE_COUNT', 'warning', "Outcomes sharing overlap group \"$g\" may count the same value more than once: " . implode('; ', $list) . '.');
            }
        }
        foreach ($names as $list) {
            if (count($list) > 1) {
                $warn('POSSIBLE_DOUBLE_COUNT', 'warning', "Outcome \"{$list[0]}\" is listed more than once for the same stakeholder.");
            }
        }
        if (!array_filter($outLines, fn($l) => $l['included'])) {
            $warn('NO_MONETIZED_OUTCOMES', 'warning', 'No monetised outcomes are included, so social value is zero.');
        }

        // ---- aggregates (positive and negative are reported separately)
        $posTotal = $this->sum(array_filter($allPv, fn($v) => $v >= 0));
        $negTotal = $this->sum(array_filter($allPv, fn($v) => $v < 0));
        $totalPv = $this->sum($allPv);
        $ratio = fn(float $inv) => $inv > 0 ? round($totalPv / $inv, 4) : null;
        $sroi = $ratio($used);
        $summary = [
            'currency' => $p['currency'],
            'total_investment_nominal' => $investNominal,
            'total_investment_present_value' => $investPv,
            'investment_used' => $used,
            'investment_basis' => $p['investment_basis'],
            'present_value_of_impact' => $totalPv,
            'positive_present_value' => $posTotal,
            'negative_present_value' => $negTotal,
            'adjusted_impact_undiscounted' => $this->sum($allAdj),
            'sroi_ratio' => $sroi,
            'sroi_ratio_nominal_investment' => $ratio($investNominal),
            'sroi_ratio_present_value_investment' => $ratio($investPv),
            'net_social_value' => $this->r2($totalPv - $used),
            'net_return_pct' => $used > 0 ? round(($totalPv - $used) / $used * 100, 2) : null,
            'monetized_outcomes_included' => count(array_filter($outLines, fn($l) => $l['included'])),
            'unmonetized_outcomes' => count($unmonetized),
        ];

        $stakeOut = [];
        foreach ($stk as $row) {
            $pos = $this->sum($row['pos']);
            $neg = $this->sum($row['neg']);
            $stakeOut[] = [
                'stakeholder_id' => $row['stakeholder_id'], 'name' => $row['name'],
                'positive_present_value' => $pos, 'negative_present_value' => $neg, 'net_present_value' => $this->r2($pos + $neg),
                'share_of_positive_pct' => $posTotal > 0 ? round($pos / $posTotal * 100, 2) : null,
            ];
        }
        usort($stakeOut, fn($a, $b) => $b['net_present_value'] <=> $a['net_present_value']);

        $annual = [];
        $cI = $cA = $cP = 0.0;
        for ($y = 0; $y <= $T; $y++) {
            $inv = $this->r2($byYear[$y]['nominal']);
            $invPv = $this->r2($byYear[$y]['pv']);
            $adjY = $this->sum($annualAdj[$y]);
            $pvY = $this->sum($annualPv[$y]);
            $cI = $this->r2($cI + $inv);
            $cA = $this->r2($cA + $adjY);
            $cP = $this->r2($cP + $pvY);
            $annual[] = ['year' => $y, 'investment' => $inv, 'investment_present_value' => $invPv, 'adjusted_impact' => $adjY,
                'present_value' => $pvY, 'cumulative_investment' => $cI, 'cumulative_adjusted_impact' => $cA, 'cumulative_present_value' => $cP];
        }

        $qTotal = array_sum($quality);
        $eq = [];
        foreach ($quality as $k => $v) {
            $eq[$k] = ['absolute_present_value' => $this->r2($v), 'share_pct' => $qTotal > 0 ? round($v / $qTotal * 100, 2) : null];
        }
        if ($qTotal > 0 && ($quality['estimated'] + $quality['assumed']) / $qTotal > 0.5) {
            $warn('WEAK_EVIDENCE_SHARE', 'warning', 'More than half of the monetised value rests on estimated or assumed inputs. Treat the ratio as indicative, not proven.');
        }
        if ($s['scenario']['kind'] !== 'base' && $s['scenario']['assumptions']['global'] === [] && $s['scenario']['assumptions']['outcomes'] === []) {
            $warn('SCENARIO_NOT_CONFIGURED', 'info', "Scenario \"{$s['scenario']['name']}\" has no overrides, so it is identical to the base case.");
        }
        if ($p['discount_rate_basis'] === null || trim((string)$p['discount_rate_source']) === '') {
            $warn('DISCOUNT_RATE_UNDOCUMENTED', 'info', 'State whether the discount rate is real or nominal and cite why it was chosen.');
        }

        // grouped by stakeholder: how much of total value is concentrated
        return [
            'methodology_version' => self::METHODOLOGY_VERSION,
            'profile' => [
                'discount_rate' => $r,
                'discount_rate_basis' => $p['discount_rate_basis'],
                'discount_rate_source' => $p['discount_rate_source'],
                'discount_base_year' => $base,
                'analysis_period_years' => $T,
                'investment_basis' => $p['investment_basis'],
                'include_in_kind' => $p['include_in_kind'],
                'price_basis' => $p['price_basis'],
                'currency' => $p['currency'],
                'adjustments' => 'multiplicative: (1-deadweight) x (1-attribution) x (1-displacement)',
                'rounding' => 'each monetary line rounded to 2 dp; totals are sums of rounded lines',
                'negative_outcomes' => 'recorded with negative sign and reported separately from positive value',
            ],
            'scenario' => ['id' => $s['scenario']['id'], 'name' => $s['scenario']['name'], 'kind' => $s['scenario']['kind']],
            'summary' => $summary,
            'investment' => [
                'cash' => $this->sum($cash),
                'in_kind' => $this->sum($inKind),
                'by_category' => array_map(fn($v) => $this->sum($v), $byCategory),
                'items' => $costLines,
            ],
            'outcomes' => $outLines,
            'by_stakeholder' => $stakeOut,
            'annual' => $annual,
            'evidence_quality' => $eq,
            'unmonetized_outcomes' => $unmonetized,
            'warnings' => $warnings,
        ];
    }

    /**
     * Year-by-year retained quantity for one outcome (before proxy and the other adjustments).
     * @return array<int,array{quantity:float,gross:float,retained:float}> keyed by project year (1..T)
     */
    private function project(array $o, array $e, int $T): array
    {
        $q = (float)$e['quantity'];
        $dur = (int)$e['duration_years'];
        $start = $o['start_year'];
        $drop = (float)($e['drop_off'] ?? 0.0);
        $ov = $o['year_overrides'];
        $dropAt = fn(int $k) => $ov[$k]['drop_off'] ?? $drop;
        $years = [];

        switch ($o['projection_model']) {
            case 'independent':
                // quantities are measured for each year; no decay is applied (it would double-count)
                for ($k = 1; $k <= $dur; $k++) {
                    $y = $start + $k - 1;
                    if ($y > $T) {
                        break;
                    }
                    $qk = $ov[$k]['quantity'] ?? $q;
                    $years[$y] = ['quantity' => $qk, 'gross' => $qk, 'retained' => $qk];
                }
                break;
            case 'recurring_cohorts':
                $entryYears = $o['entry_years'] ?? ($T - $start + 1);
                $lastEntry = min($start + $entryYears - 1, $T);
                for ($en = $start; $en <= $lastEntry; $en++) {
                    $qc = $ov[$en - $start + 1]['quantity'] ?? $q;
                    $persist = 1.0;
                    for ($age = 1; $age <= $dur; $age++) {
                        $y = $en + $age - 1;
                        if ($y > $T) {
                            break;
                        }
                        if ($age > 1) {
                            $persist *= (1 - $dropAt($age));
                        }
                        $years[$y] ??= ['quantity' => 0.0, 'gross' => 0.0, 'retained' => 0.0];
                        $years[$y]['quantity'] += $qc;
                        $years[$y]['gross'] += $qc;
                        $years[$y]['retained'] += $qc * $persist;
                    }
                }
                break;
            default: // cohort
                $persist = 1.0;
                for ($k = 1; $k <= $dur; $k++) {
                    $y = $start + $k - 1;
                    if ($y > $T) {
                        break;
                    }
                    if ($k > 1) {
                        $persist *= (1 - $dropAt($k));
                    }
                    $years[$y] = ['quantity' => $q, 'gross' => $q, 'retained' => $q * $persist];
                }
        }
        return $years;
    }
}
