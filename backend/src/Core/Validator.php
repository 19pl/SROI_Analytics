<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Declarative input validation.
 *
 * Rule keys: type (string|raw|int|number|fraction|bool|enum|date|email|array), required, nullable,
 * default (create only), min, max (value for numbers, length for strings), in (enum values),
 * check (callable(mixed):?string returning an error message).
 * Unknown input fields are ignored (whitelist).
 */
final class Validator
{
    /**
     * @param array<string,mixed> $input
     * @param array<string,array<string,mixed>> $rules
     * @return array<string,mixed>
     */
    public static function validate(array $input, array $rules, bool $partial = false): array
    {
        $out = [];
        $errors = [];
        foreach ($rules as $field => $rule) {
            if (!array_key_exists($field, $input)) {
                if (!$partial) {
                    if (!empty($rule['required'])) {
                        $errors[$field] = 'is required';
                    } elseif (array_key_exists('default', $rule)) {
                        $out[$field] = $rule['default'];
                    }
                }
                continue;
            }
            $v = $input[$field];
            if ($v === null || ($v === '' && !empty($rule['nullable']))) {
                if (!empty($rule['nullable'])) {
                    $out[$field] = null;
                } else {
                    $errors[$field] = 'must not be null';
                }
                continue;
            }
            $err = null;
            $clean = self::coerce($v, $rule, $err);
            if ($err === null && isset($rule['check'])) {
                $err = ($rule['check'])($clean);
            }
            if ($err !== null) {
                $errors[$field] = $err;
            } else {
                $out[$field] = $clean;
            }
        }
        if ($errors) {
            throw HttpException::unprocessable('Validation failed', $errors);
        }
        return $out;
    }

    /** @param array<string,mixed> $rule */
    private static function coerce(mixed $v, array $rule, ?string &$err): mixed
    {
        $type = $rule['type'] ?? 'string';
        $min = $rule['min'] ?? null;
        $max = $rule['max'] ?? null;
        switch ($type) {
            case 'string':
                if (!is_string($v)) {
                    $err = 'must be a string';
                    return null;
                }
                $v = trim($v);
                $len = mb_strlen($v);
                if (!empty($rule['required']) && $len === 0) {
                    $err = 'must not be empty';
                } elseif ($min !== null && $len < $min) {
                    $err = "must be at least $min characters";
                } elseif ($max !== null && $len > $max) {
                    $err = "must be at most $max characters";
                }
                return $v;
            case 'raw':
                // a spreadsheet-style cell: a number or a short formula, kept as the text the user typed
                if (is_int($v) || is_float($v)) {
                    $v = is_float($v) && floor($v) == $v && abs($v) < 1e15 ? (string)(int)$v : (string)$v;
                }
                if (!is_string($v)) {
                    $err = 'must be a number or a formula';
                    return null;
                }
                $v = trim($v);
                if ($max !== null && mb_strlen($v) > $max) {
                    $err = "must be at most $max characters";
                }
                return $v === '' ? null : $v;
            case 'int':
                if (is_string($v) && preg_match('/^-?\d{1,15}$/', $v)) {
                    $v = (int)$v;
                }
                if (!is_int($v)) {
                    $err = 'must be an integer';
                    return null;
                }
                break;
            case 'number':
            case 'fraction':
                if (is_string($v) && is_numeric($v)) {
                    $v = (float)$v;
                }
                if (is_int($v)) {
                    $v = (float)$v;
                }
                if (!is_float($v) || is_nan($v) || is_infinite($v)) {
                    $err = 'must be a number';
                    return null;
                }
                if ($type === 'fraction') {
                    $min = 0;
                    $max = 1;
                    if ($v < 0 || $v > 1) {
                        $err = 'must be a fraction between 0 and 1 (e.g. 0.15 for 15%)';
                        return null;
                    }
                }
                break;
            case 'bool':
                if (is_bool($v)) {
                    return $v;
                }
                if (in_array($v, [0, 1, '0', '1', 'true', 'false'], true)) {
                    return $v === 1 || $v === '1' || $v === 'true';
                }
                $err = 'must be a boolean';
                return null;
            case 'enum':
                if (!is_string($v) || !in_array($v, $rule['in'], true)) {
                    $err = 'must be one of: ' . implode(', ', $rule['in']);
                    return null;
                }
                return $v;
            case 'date':
                $d = is_string($v) ? \DateTime::createFromFormat('!Y-m-d', $v) : false;
                if (!$d || $d->format('Y-m-d') !== $v) {
                    $err = 'must be a date in YYYY-MM-DD format';
                    return null;
                }
                return $v;
            case 'email':
                if (!is_string($v) || !filter_var(trim($v), FILTER_VALIDATE_EMAIL) || strlen($v) > 254) {
                    $err = 'must be a valid email address';
                    return null;
                }
                return strtolower(trim($v));
            case 'array':
                if (!is_array($v)) {
                    $err = 'must be an object';
                    return null;
                }
                return $v;
            default:
                throw new \LogicException("Unknown rule type $type");
        }
        // numeric bounds
        if ($min !== null && $v < $min) {
            $err = "must be >= $min";
            return null;
        }
        if ($max !== null && $v > $max) {
            $err = "must be <= $max";
            return null;
        }
        return $v;
    }
}
