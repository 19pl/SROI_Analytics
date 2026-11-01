<?php
declare(strict_types=1);

namespace App\Domain\Calculation;

/**
 * Safe arithmetic for sheet cells. The customer's workbooks put small formulas straight into cells, for example
 *   =63999000/20            =(904840+123500+88120)*9%            =1300000/20+(400000/20)+49000
 * This is a hand-written recursive-descent parser: it never uses eval() and understands only
 *   numbers (thousands commas allowed: 27,500), + - * / ^, unary +/-, parentheses, a postfix % (9% = 0.09),
 *   and × ÷ as aliases for * /. A leading "=" is optional. No cell references and no functions.
 *
 * Empty input means "not entered" and evaluates to null — it is never silently turned into 0.
 */
final class Formula
{
    public const MAX_LENGTH = 500;

    /** @var list<array{t:string,v:float|string,p:int}> */
    private array $tok = [];
    private int $i = 0;

    /** @throws FormulaException */
    public static function evaluate(mixed $raw): ?float
    {
        if ($raw === null) {
            return null;
        }
        if (is_int($raw) || is_float($raw)) {
            if (!is_finite((float)$raw)) {
                throw new FormulaException('Value is not a finite number', 0);
            }
            return (float)$raw;
        }
        $s = trim((string)$raw);
        if ($s === '' || $s === '=') {
            return null;
        }
        if (mb_strlen($s) > self::MAX_LENGTH) {
            throw new FormulaException('Formula is too long (max ' . self::MAX_LENGTH . ' characters)', 0);
        }
        $f = new self();
        $f->tok = $f->tokenize(ltrim($s, '='));
        $f->i = 0;
        if ($f->tok === []) {
            return null;
        }
        $v = $f->expr();
        if ($f->i < count($f->tok)) {
            throw new FormulaException('Unexpected "' . $f->tok[$f->i]['v'] . '"', $f->tok[$f->i]['p']);
        }
        if (!is_finite($v)) {
            throw new FormulaException('Result is not a finite number', 0);
        }
        return $v;
    }

    /** True when the text parses; otherwise the message explains why. */
    public static function check(mixed $raw): ?string
    {
        try {
            self::evaluate($raw);
            return null;
        } catch (FormulaException $e) {
            return $e->getMessage();
        }
    }

    /** @return list<array{t:string,v:float|string,p:int}> */
    private function tokenize(string $s): array
    {
        $out = [];
        $n = strlen($s);
        $p = 0;
        while ($p < $n) {
            $c = $s[$p];
            if ($c === ' ' || $c === "\t" || $c === "\n" || $c === "\r") {
                $p++;
                continue;
            }
            if (ctype_digit($c) || ($c === '.' && $p + 1 < $n && ctype_digit($s[$p + 1]))) {
                // number with optional thousands commas (1,234,567.89) and decimals
                if (preg_match('/\G(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?/', $s, $m, 0, $p) && $m[0] !== '') {
                    $out[] = ['t' => 'num', 'v' => (float)str_replace(',', '', $m[0]), 'p' => $p];
                    $p += strlen($m[0]);
                    continue;
                }
            }
            if (str_starts_with(substr($s, $p, 2), '×')) {
                $out[] = ['t' => 'op', 'v' => '*', 'p' => $p];
                $p += strlen('×');
                continue;
            }
            if (str_starts_with(substr($s, $p, 2), '÷')) {
                $out[] = ['t' => 'op', 'v' => '/', 'p' => $p];
                $p += strlen('÷');
                continue;
            }
            if (strpos('+-*/^%()', $c) !== false) {
                $out[] = ['t' => 'op', 'v' => $c, 'p' => $p];
                $p++;
                continue;
            }
            throw new FormulaException('Unexpected character "' . $c . '"', $p);
        }
        return $out;
    }

    private function peek(): ?string
    {
        return ($this->tok[$this->i]['t'] ?? null) === 'op' ? (string)$this->tok[$this->i]['v'] : null;
    }

    private function expr(): float
    {
        $v = $this->term();
        while (($op = $this->peek()) === '+' || $op === '-') {
            $this->i++;
            $r = $this->term();
            $v = $op === '+' ? $v + $r : $v - $r;
        }
        return $v;
    }

    private function term(): float
    {
        $v = $this->power();
        while (($op = $this->peek()) === '*' || $op === '/') {
            $pos = $this->tok[$this->i]['p'];
            $this->i++;
            $r = $this->power();
            if ($op === '/') {
                if ($r == 0.0) {
                    throw new FormulaException('Division by zero', $pos);
                }
                $v /= $r;
            } else {
                $v *= $r;
            }
        }
        return $v;
    }

    private function power(): float
    {
        $v = $this->unary();
        if ($this->peek() === '^') {
            $this->i++;
            $v = $v ** $this->power();
        }
        return $v;
    }

    private function unary(): float
    {
        $op = $this->peek();
        if ($op === '-' || $op === '+') {
            $this->i++;
            $v = $this->unary();
            return $op === '-' ? -$v : $v;
        }
        $v = $this->primary();
        while ($this->peek() === '%') {
            $this->i++;
            $v /= 100.0;
        }
        return $v;
    }

    private function primary(): float
    {
        $t = $this->tok[$this->i] ?? null;
        if ($t === null) {
            throw new FormulaException('Formula ends unexpectedly', 0);
        }
        if ($t['t'] === 'num') {
            $this->i++;
            return (float)$t['v'];
        }
        if ($t['v'] === '(') {
            $this->i++;
            $v = $this->expr();
            if ($this->peek() !== ')') {
                throw new FormulaException('Missing closing parenthesis', $t['p']);
            }
            $this->i++;
            return $v;
        }
        throw new FormulaException('Unexpected "' . $t['v'] . '"', $t['p']);
    }
}
